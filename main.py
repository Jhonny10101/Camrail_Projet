"""
CAMRAIL — Backend FastAPI v1.0
API REST sécurisée JWT — Modèle Prédictif Durées d'Occupation de Cantons
"""
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, validator
from typing import Optional
import pandas as pd
import numpy as np
import joblib, json, csv, os
from pathlib import Path
from datetime import datetime, timedelta

from auth.jwt_auth import (
    authenticate_user, create_access_token, get_current_user,
    require_permission, require_admin,
    UserInDB, UserPublic, Token, Role,
    TOKEN_EXPIRE_MINUTES, load_users, save_users,
    pwd_ctx, init_users_db,
)

# ─── Chemins ─────────────────────────────────────────────────────────────────
MODEL_DIR = Path("models")
DATA_DIR  = Path("data")
RET_LOG   = DATA_DIR / "ret_log.csv"

FEATURES = [
    "nb_vehicules_derailles", "position_vehicule", "etat_voie",
    "position_grues", "type_voie", "heure_incident",
    "coordination", "mois", "saison",
]

# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CAMRAIL Predictive API",
    description="""
## API Sécurisée — Modèle Prédictif de Durées d'Occupation de Cantons

### Rôles et Accès
| Rôle | Accès |
|------|-------|
| `ADMIN` | Tout + gestion utilisateurs |
| `CELLULE_CRISE` | Prédiction + soumission RET + historiques |
| `OPERATEUR` | Historiques + info modèle (lecture seule) |

### Authentification
1. `POST /auth/login` avec username/password
2. Utiliser le `access_token` en header : `Authorization: Bearer <token>`
""",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Modèles ML (cache) ──────────────────────────────────────────────────────
_models = {}

def get_models():
    if not _models:
        try:
            _models["rf"]       = joblib.load(MODEL_DIR / "rf_model.joblib")
            _models["gbq_low"]  = joblib.load(MODEL_DIR / "gbq_low.joblib")
            _models["gbq_high"] = joblib.load(MODEL_DIR / "gbq_high.joblib")
            with open(MODEL_DIR / "model_meta.json") as f:
                _models["meta"] = json.load(f)
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Modèles non disponibles : {e}")
    return _models

# ─── Schémas ─────────────────────────────────────────────────────────────────
class PredictionInput(BaseModel):
    nb_vehicules_derailles: int   = Field(..., ge=1, le=30)
    position_vehicule:      int   = Field(..., ge=1, le=3)
    etat_voie:              int   = Field(..., ge=1, le=3)
    position_grues:         int   = Field(..., ge=1, le=3)
    type_voie:              int   = Field(..., ge=1, le=2)
    heure_incident:         int   = Field(..., ge=0, le=23)
    coordination:           int   = Field(..., ge=1, le=4)
    heure_information_pcc:  Optional[str] = None

class PredictionResult(BaseModel):
    duree_heures:      float
    ic_min_heures:     float
    ic_max_heures:     float
    fiabilite_pct:     float
    heure_reprise:     Optional[str]
    heure_reprise_min: Optional[str]
    heure_reprise_max: Optional[str]
    niveau_risque:     str
    feature_contributions: dict
    predicted_by:      str
    predicted_at:      str

class RETRecord(BaseModel):
    id_ret:                 Optional[str] = None
    date_incident:          str
    heure_incident:         int   = Field(..., ge=0, le=23)
    coordination:           int   = Field(..., ge=1, le=4)
    type_voie:              int   = Field(..., ge=1, le=2)
    nb_vehicules_derailles: int   = Field(..., ge=1)
    position_vehicule:      int   = Field(..., ge=1, le=3)
    etat_voie:              int   = Field(..., ge=1, le=3)
    position_grues:         int   = Field(..., ge=1, le=3)
    duree_reelle_heures:    float = Field(..., gt=0)
    faits_saillants:        Optional[str] = None
    cause_probable:         Optional[str] = None

class CreateUserRequest(BaseModel):
    username:     str
    full_name:    str
    password:     str = Field(..., min_length=8)
    role:         str = Field(..., pattern="^(ADMIN|CELLULE_CRISE|OPERATEUR)$")
    coordination: Optional[str] = None

# ─── Utilitaires ─────────────────────────────────────────────────────────────
def compute_heure_reprise(heure_pcc: str, duree_h: float) -> str:
    try:
        h, m   = map(int, heure_pcc.split(":"))
        total  = h * 60 + m + int(duree_h * 60)
        return f"{(total // 60) % 24:02d}:{total % 60:02d}"
    except:
        return None

def get_niveau_risque(duree: float) -> str:
    if duree < 10: return "FAIBLE"
    if duree < 20: return "MODÉRÉ"
    return "ÉLEVÉ"

def input_to_df(inp: PredictionInput) -> pd.DataFrame:
    dt = datetime.now()
    return pd.DataFrame([{
        "nb_vehicules_derailles": inp.nb_vehicules_derailles,
        "position_vehicule":      inp.position_vehicule,
        "etat_voie":              inp.etat_voie,
        "position_grues":         inp.position_grues,
        "type_voie":              inp.type_voie,
        "heure_incident":         inp.heure_incident,
        "coordination":           inp.coordination,
        "mois":   dt.month,
        "saison": (dt.month % 12) // 3,
    }])

# ─── Démarrage ───────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    init_users_db()
    print("✅ CAMRAIL API v1.0 démarrée")

# ════════════════════════════════════════════════════════════════════════════
# AUTHENTIFICATION
# ════════════════════════════════════════════════════════════════════════════

@app.post("/auth/login", response_model=Token, tags=["Authentification"])
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Connexion — retourne un JWT valable 8 heures."""
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants incorrects",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=timedelta(minutes=TOKEN_EXPIRE_MINUTES),
    )
    return Token(
        access_token=token,
        token_type="bearer",
        expires_in=TOKEN_EXPIRE_MINUTES * 60,
        user=UserPublic(
            username=user.username,
            full_name=user.full_name,
            role=user.role,
            coordination=user.coordination,
        ),
    )

@app.get("/auth/me", response_model=UserPublic, tags=["Authentification"])
async def get_me(current_user: UserInDB = Depends(get_current_user)):
    """Retourne les infos de l'utilisateur connecté."""
    return UserPublic(**current_user.dict())

@app.post("/auth/refresh", response_model=Token, tags=["Authentification"])
async def refresh_token(current_user: UserInDB = Depends(get_current_user)):
    """Renouvelle le token JWT."""
    token = create_access_token(data={"sub": current_user.username, "role": current_user.role})
    return Token(
        access_token=token,
        token_type="bearer",
        expires_in=TOKEN_EXPIRE_MINUTES * 60,
        user=UserPublic(**current_user.dict()),
    )

# ════════════════════════════════════════════════════════════════════════════
# PRÉDICTION (CELLULE_CRISE + ADMIN)
# ════════════════════════════════════════════════════════════════════════════

@app.post("/predict", response_model=PredictionResult, tags=["Prédiction"])
async def predict(
    inp: PredictionInput,
    current_user: UserInDB = Depends(require_permission("predict")),
    models=Depends(get_models),
):
    """Prédit la durée d'occupation du canton. Réservé Cellule de Crise."""
    X = input_to_df(inp)

    duree  = float(models["rf"].predict(X)[0])
    ic_min = float(models["gbq_low"].predict(X)[0])
    ic_max = float(models["gbq_high"].predict(X)[0])

    ic_min = min(ic_min, duree * 0.85)
    ic_max = max(ic_max, duree * 1.15)
    duree  = max(2.0, round(duree, 1))
    ic_min = max(1.0, round(ic_min, 1))
    ic_max = round(ic_max, 1)

    # Contributions features
    feat_contrib = {}
    for feat in FEATURES:
        X_p = X.copy()
        X_p[feat] = X_p[feat].mean()
        feat_contrib[feat] = round(duree - float(models["rf"].predict(X_p)[0]), 3)

    # Heures de reprise
    hr = hrm = hrM = None
    if inp.heure_information_pcc:
        hr  = compute_heure_reprise(inp.heure_information_pcc, duree)
        hrm = compute_heure_reprise(inp.heure_information_pcc, ic_min)
        hrM = compute_heure_reprise(inp.heure_information_pcc, ic_max)

    meta = models["meta"]["metrics"]

    return PredictionResult(
        duree_heures=duree,
        ic_min_heures=ic_min,
        ic_max_heures=ic_max,
        fiabilite_pct=round(meta.get("ic85_coverage", 0.87) * 100, 1),
        heure_reprise=hr,
        heure_reprise_min=hrm,
        heure_reprise_max=hrM,
        niveau_risque=get_niveau_risque(duree),
        feature_contributions=feat_contrib,
        predicted_by=current_user.username,
        predicted_at=datetime.now().isoformat(),
    )

# ════════════════════════════════════════════════════════════════════════════
# COLLECTE RET (CELLULE_CRISE + ADMIN)
# ════════════════════════════════════════════════════════════════════════════

@app.post("/ret/submit", tags=["Collecte RET"])
async def submit_ret(
    record: RETRecord,
    current_user: UserInDB = Depends(require_permission("ret_submit")),
):
    """Enregistre un RET post-incident. Réservé Cellule de Crise."""
    if not record.id_ret:
        record.id_ret = f"RET-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

    row = record.dict()
    row["submitted_by"] = current_user.username
    row["submitted_at"] = datetime.now().isoformat()

    try:
        dt = datetime.strptime(record.date_incident, "%Y-%m-%d")
        row["mois"]   = dt.month
        row["saison"] = (dt.month % 12) // 3
    except:
        row["mois"] = row["saison"] = None

    file_exists = RET_LOG.exists()
    with open(RET_LOG, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=row.keys())
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)

    total = sum(1 for _ in open(RET_LOG)) - 1
    return {
        "status":        "success",
        "id_ret":        record.id_ret,
        "submitted_by":  current_user.username,
        "total_ret_log": total,
        "message":       f"RET #{total} enregistré. Réentraînement recommandé.",
    }

@app.get("/ret/list", tags=["Collecte RET"])
async def list_ret(
    current_user: UserInDB = Depends(require_permission("historique")),
):
    """Liste les RET soumis manuellement."""
    if not RET_LOG.exists():
        return {"ret_list": [], "total": 0}
    df = pd.read_csv(RET_LOG)
    return {"ret_list": df.tail(20).to_dict(orient="records"), "total": len(df)}

# ════════════════════════════════════════════════════════════════════════════
# HISTORIQUES (TOUS LES RÔLES)
# ════════════════════════════════════════════════════════════════════════════

@app.get("/historique", tags=["Historiques"])
async def get_historique(
    coordination: Optional[int] = None,
    current_user: UserInDB = Depends(require_permission("historique")),
):
    """Données historiques agrégées. Accessible à tous les rôles."""
    df = pd.read_csv(DATA_DIR / "ret_dataset.csv")
    if RET_LOG.exists():
        df_new = pd.read_csv(RET_LOG)
        if not df_new.empty:
            df_new = df_new.rename(columns={"duree_reelle_heures": "duree_occupation_heures"})
            df = pd.concat([df, df_new[df.columns.intersection(df_new.columns)]], ignore_index=True)

    if coordination:
        df = df[df["coordination"] == coordination]

    df["date_incident"] = pd.to_datetime(df["date_incident"])
    df["mois_label"]    = df["date_incident"].dt.strftime("%Y-%m")

    monthly = df.groupby("mois_label").agg(
        nb_incidents=("id_ret", "count"),
        duree_moyenne=("duree_occupation_heures", "mean"),
        duree_max=("duree_occupation_heures", "max"),
        duree_min=("duree_occupation_heures", "min"),
    ).reset_index()
    for col in ["duree_moyenne", "duree_max", "duree_min"]:
        monthly[col] = monthly[col].round(1)

    return {
        "stats_globales": {
            "total_incidents":  int(len(df)),
            "duree_moyenne":    round(float(df["duree_occupation_heures"].mean()), 1),
            "duree_max":        round(float(df["duree_occupation_heures"].max()), 1),
            "duree_min":        round(float(df["duree_occupation_heures"].min()), 1),
            "par_coordination": df.groupby("coordination")["id_ret"].count().to_dict(),
        },
        "serie_mensuelle": monthly.to_dict(orient="records"),
        "accessed_by": current_user.username,
    }

# ════════════════════════════════════════════════════════════════════════════
# MODÈLE ML (TOUS + RETRAIN ADMIN SEULEMENT)
# ════════════════════════════════════════════════════════════════════════════

@app.get("/modele/info", tags=["Modèle ML"])
async def get_model_info(
    current_user: UserInDB = Depends(require_permission("modele_info")),
    models=Depends(get_models),
):
    return {**models["meta"], "accessed_by": current_user.username}

@app.post("/modele/retrain", tags=["Modèle ML"])
async def retrain_model(
    current_user: UserInDB = Depends(require_permission("modele_retrain")),
):
    """Réentraîne le modèle. Réservé ADMIN."""
    import subprocess, sys
    try:
        df_base = pd.read_csv(DATA_DIR / "ret_dataset.csv")
        if RET_LOG.exists():
            df_new = pd.read_csv(RET_LOG)
            if not df_new.empty:
                df_new = df_new.rename(columns={"duree_reelle_heures": "duree_occupation_heures"})
                df_merged = pd.concat(
                    [df_base, df_new[df_base.columns.intersection(df_new.columns)]],
                    ignore_index=True,
                )
                df_merged.to_csv(DATA_DIR / "ret_dataset.csv", index=False)

        result = subprocess.run(
            [sys.executable, str(MODEL_DIR / "train_pipeline.py")],
            capture_output=True, text=True, timeout=180,
        )
        _models.clear()
        return {
            "status":       "success",
            "triggered_by": current_user.username,
            "triggered_at": datetime.now().isoformat(),
            "message":      "Modèle réentraîné avec succès",
            "log":          result.stdout[-800:] if result.stdout else "",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ════════════════════════════════════════════════════════════════════════════
# GESTION UTILISATEURS (ADMIN SEULEMENT)
# ════════════════════════════════════════════════════════════════════════════

@app.get("/admin/users", tags=["Administration"])
async def list_users(current_user: UserInDB = Depends(require_admin)):
    """Liste tous les utilisateurs. Admin uniquement."""
    users = load_users()
    return [UserPublic(**u.dict()) for u in users.values()]

@app.post("/admin/users", tags=["Administration"])
async def create_user(
    req: CreateUserRequest,
    current_user: UserInDB = Depends(require_admin),
):
    """Crée un nouvel utilisateur. Admin uniquement."""
    users = load_users()
    if req.username in users:
        raise HTTPException(status_code=409, detail="Utilisateur déjà existant")

    from auth.jwt_auth import UserInDB as UIDB
    new_user = UIDB(
        username=req.username,
        full_name=req.full_name,
        role=req.role,
        coordination=req.coordination,
        hashed_password=pwd_ctx.hash(req.password),
        disabled=False,
    )
    users[req.username] = new_user
    save_users(users)
    return {"status": "success", "message": f"Utilisateur '{req.username}' créé", "role": req.role}

@app.delete("/admin/users/{username}", tags=["Administration"])
async def delete_user(
    username: str,
    current_user: UserInDB = Depends(require_admin),
):
    """Désactive un utilisateur. Admin uniquement."""
    if username == current_user.username:
        raise HTTPException(status_code=400, detail="Impossible de supprimer son propre compte")
    users = load_users()
    if username not in users:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    users[username].disabled = True
    save_users(users)
    return {"status": "success", "message": f"Utilisateur '{username}' désactivé"}

# ════════════════════════════════════════════════════════════════════════════
# FONCTION TEST (CELLULE_CRISE + ADMIN)
# ════════════════════════════════════════════════════════════════════════════

@app.get("/test/scenario", tags=["Fonction Test"])
async def test_scenario(
    scenario: str = "grave",
    current_user: UserInDB = Depends(require_permission("predict")),
    models=Depends(get_models),
):
    """Scénarios prédéfinis (F4 du cahier des charges)."""
    scenarios = {
        "leger":      PredictionInput(nb_vehicules_derailles=1, position_vehicule=1, etat_voie=1, position_grues=1, type_voie=2, heure_incident=10, coordination=1, heure_information_pcc="08:00"),
        "modere":     PredictionInput(nb_vehicules_derailles=3, position_vehicule=2, etat_voie=2, position_grues=2, type_voie=1, heure_incident=14, coordination=2, heure_information_pcc="14:00"),
        "grave":      PredictionInput(nb_vehicules_derailles=6, position_vehicule=3, etat_voie=3, position_grues=3, type_voie=1, heure_incident=22, coordination=1, heure_information_pcc="22:00"),
        "nuit_modere":PredictionInput(nb_vehicules_derailles=2, position_vehicule=1, etat_voie=2, position_grues=2, type_voie=1, heure_incident=3,  coordination=3, heure_information_pcc="03:00"),
    }
    if scenario not in scenarios:
        raise HTTPException(status_code=400, detail=f"Scénarios : {list(scenarios.keys())}")
    return await predict(scenarios[scenario], current_user, models)

@app.get("/", tags=["Info"])
def root():
    return {
        "service":  "CAMRAIL Predictive API",
        "version":  "1.0.0",
        "security": "JWT Bearer Token",
        "docs":     "/docs",
        "status":   "operational",
    }
