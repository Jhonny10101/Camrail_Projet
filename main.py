"""
CAMRAIL — Backend FastAPI v1.0
API REST sécurisée JWT — Modèle Prédictif Durées d'Occupation de Cantons
Base de données : PostgreSQL (Supabase)
"""
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from typing import Optional
import pandas as pd
import numpy as np
import joblib, json, os
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

from auth.jwt_auth import (
    authenticate_user, create_access_token, get_current_user,
    require_permission, require_admin,
    UserInDB, UserPublic, Token, Role,
    TOKEN_EXPIRE_MINUTES, load_users, save_users,
    pwd_ctx, init_users_db,
)
from database import (
    init_db, test_connection, get_db, migrate_csv_to_db,
    RETDataset, RETLog, PredictionLog, ValidationLog,
)

MODEL_DIR = Path("models")
DATA_DIR  = Path("data")
FEATURES  = [
    "nb_vehicules_derailles","position_vehicule","etat_voie",
    "position_grues","type_voie","heure_incident","coordination","mois","saison",
]

app = FastAPI(title="CAMRAIL Predictive API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

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

# ── Schémas ──────────────────────────────────────────────────────
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
    duree_heures:          float
    ic_min_heures:         float
    ic_max_heures:         float
    fiabilite_pct:         float
    heure_reprise:         Optional[str]
    heure_reprise_min:     Optional[str]
    heure_reprise_max:     Optional[str]
    niveau_risque:         str
    feature_contributions: dict
    predicted_by:          str
    predicted_at:          str

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

class ValidationInput(BaseModel):
    id_prediction: str
    duree_predite: float
    duree_reelle:  float
    heure_reelle:  Optional[str] = None
    commentaire:   Optional[str] = None

class CreateUserRequest(BaseModel):
    username:     str
    full_name:    str
    password:     str = Field(..., min_length=8)
    role:         str
    coordination: Optional[str] = None

# ── Utilitaires ───────────────────────────────────────────────────
def compute_heure_reprise(heure_pcc, duree_h):
    try:
        h, m  = map(int, heure_pcc.split(":"))
        total = h * 60 + m + int(duree_h * 60)
        return f"{(total//60)%24:02d}:{total%60:02d}"
    except:
        return None

def get_niveau_risque(d):
    return "FAIBLE" if d < 10 else "MODÉRÉ" if d < 20 else "ÉLEVÉ"

def input_to_df(inp):
    dt = datetime.now()
    return pd.DataFrame([{
        "nb_vehicules_derailles": inp.nb_vehicules_derailles,
        "position_vehicule": inp.position_vehicule,
        "etat_voie": inp.etat_voie,
        "position_grues": inp.position_grues,
        "type_voie": inp.type_voie,
        "heure_incident": inp.heure_incident,
        "coordination": inp.coordination,
        "mois": dt.month,
        "saison": (dt.month % 12) // 3,
    }])

# ── Démarrage ─────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    init_users_db()
    if test_connection():
        init_db()
        print("✅ CAMRAIL API v1.0 — PostgreSQL Supabase connecté")
    else:
        print("⚠️  Démarré sans PostgreSQL")

# ── AUTH ──────────────────────────────────────────────────────────
@app.post("/auth/login", response_model=Token, tags=["Auth"])
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Identifiants incorrects",
            headers={"WWW-Authenticate": "Bearer"})
    token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=timedelta(minutes=TOKEN_EXPIRE_MINUTES))
    return Token(access_token=token, token_type="bearer",
        expires_in=TOKEN_EXPIRE_MINUTES*60,
        user=UserPublic(username=user.username, full_name=user.full_name,
            role=user.role, coordination=user.coordination))

@app.get("/auth/me", response_model=UserPublic, tags=["Auth"])
async def get_me(cu: UserInDB = Depends(get_current_user)):
    return UserPublic(**cu.dict())

@app.post("/auth/refresh", response_model=Token, tags=["Auth"])
async def refresh(cu: UserInDB = Depends(get_current_user)):
    token = create_access_token(data={"sub": cu.username, "role": cu.role})
    return Token(access_token=token, token_type="bearer",
        expires_in=TOKEN_EXPIRE_MINUTES*60, user=UserPublic(**cu.dict()))

# ── PRÉDICTION ────────────────────────────────────────────────────
@app.post("/predict", response_model=PredictionResult, tags=["Prédiction"])
async def predict(
    inp: PredictionInput,
    cu: UserInDB = Depends(require_permission("predict")),
    models=Depends(get_models),
    db: Session = Depends(get_db),
):
    X      = input_to_df(inp)
    duree  = float(models["rf"].predict(X)[0])
    ic_min = float(models["gbq_low"].predict(X)[0])
    ic_max = float(models["gbq_high"].predict(X)[0])
    ic_min = min(ic_min, duree * 0.85)
    ic_max = max(ic_max, duree * 1.15)
    duree  = max(2.0, round(duree, 1))
    ic_min = max(1.0, round(ic_min, 1))
    ic_max = round(ic_max, 1)

    feat_contrib = {}
    for feat in FEATURES:
        Xp = X.copy(); Xp[feat] = Xp[feat].mean()
        feat_contrib[feat] = round(duree - float(models["rf"].predict(Xp)[0]), 3)

    hr = hrm = hrM = None
    if inp.heure_information_pcc:
        hr  = compute_heure_reprise(inp.heure_information_pcc, duree)
        hrm = compute_heure_reprise(inp.heure_information_pcc, ic_min)
        hrM = compute_heure_reprise(inp.heure_information_pcc, ic_max)

    now     = datetime.now()
    pred_id = f"PRED-{now.strftime('%Y%m%d-%H%M%S')}-{cu.username}"

    try:
        db.add(PredictionLog(
            id_prediction=pred_id, predicted_by=cu.username,
            predicted_at=now.isoformat(), duree_heures=duree,
            ic_min_heures=ic_min, ic_max_heures=ic_max,
            niveau_risque=get_niveau_risque(duree), heure_reprise=hr,
            heure_information_pcc=inp.heure_information_pcc,
            nb_vehicules=inp.nb_vehicules_derailles,
            position_vehicule=inp.position_vehicule, etat_voie=inp.etat_voie,
            position_grues=inp.position_grues, type_voie=inp.type_voie,
            heure_incident=inp.heure_incident, coordination=inp.coordination,
        ))
        db.commit()
    except Exception as e:
        db.rollback(); print(f"⚠️ Log prédiction : {e}")

    meta = models["meta"]["metrics"]
    return PredictionResult(
        duree_heures=duree, ic_min_heures=ic_min, ic_max_heures=ic_max,
        fiabilite_pct=round(meta.get("ic85_coverage",0.87)*100,1),
        heure_reprise=hr, heure_reprise_min=hrm, heure_reprise_max=hrM,
        niveau_risque=get_niveau_risque(duree),
        feature_contributions=feat_contrib,
        predicted_by=pred_id, predicted_at=now.isoformat(),
    )

# ── VALIDATION ────────────────────────────────────────────────────
@app.post("/predict/valider", tags=["Validation"])
async def valider_prediction(
    data: ValidationInput,
    cu: UserInDB = Depends(require_permission("predict")),
    db: Session = Depends(get_db),
):
    ecart = round(data.duree_reelle - data.duree_predite, 2)
    ae    = abs(ecart)
    statut    = "CORRECT" if ae<=2 else "PROCHE" if ae<=5 else "INCORRECT"
    precision = "Excellente (±2h)" if ae<=2 else "Acceptable (±5h)" if ae<=5 else f"Écart important ({ecart:+.1f}h)"
    now = datetime.now()
    try:
        db.add(ValidationLog(
            id_validation=f"VAL-{now.strftime('%Y%m%d-%H%M%S')}",
            id_prediction=data.id_prediction, duree_predite=data.duree_predite,
            duree_reelle=data.duree_reelle, ecart_heures=ecart, statut=statut,
            precision=precision, heure_reelle=data.heure_reelle,
            commentaire=data.commentaire, valide_par=cu.username, valide_le=now.isoformat(),
        ))
        pred = db.query(PredictionLog).filter(
            PredictionLog.id_prediction == data.id_prediction).first()
        if pred:
            pred.validation_statut = statut
            pred.duree_reelle      = data.duree_reelle
            pred.ecart_heures      = ecart
        db.commit()
    except Exception as e:
        db.rollback(); raise HTTPException(status_code=500, detail=str(e))
    return {"status":"success","statut":statut,"precision":precision,"ecart":ecart,
            "message":f"Prédiction:{data.duree_predite}h | Réel:{data.duree_reelle}h | Écart:{ecart:+.1f}h — {statut}"}

@app.get("/predict/historique", tags=["Validation"])
async def get_predictions_historique(
    cu: UserInDB = Depends(require_permission("historique")),
    db: Session = Depends(get_db),
):
    COORD={1:"Nord",2:"Sud",3:"Est",4:"Ouest"}
    POS={1:"Tête",2:"Milieu",3:"Queue"}
    ETAT={1:"Léger",2:"Modéré",3:"Grave"}
    GRUE={1:"Proche",2:"Moyen",3:"Loin"}
    preds = db.query(PredictionLog).order_by(PredictionLog.id.desc()).limit(50).all()
    data  = [{"id_prediction":p.id_prediction,"predicted_by":p.predicted_by,
              "predicted_at":p.predicted_at,"duree_heures":p.duree_heures,
              "ic_min_heures":p.ic_min_heures,"ic_max_heures":p.ic_max_heures,
              "niveau_risque":p.niveau_risque,"heure_reprise":p.heure_reprise,
              "nb_vehicules":p.nb_vehicules,"coordination_label":COORD.get(p.coordination,""),
              "position_label":POS.get(p.position_vehicule,""),"etat_label":ETAT.get(p.etat_voie,""),
              "grue_label":GRUE.get(p.position_grues,""),"validation_statut":p.validation_statut or "",
              "duree_reelle":p.duree_reelle,"ecart_heures":p.ecart_heures} for p in preds]
    total=db.query(PredictionLog).count()
    valides=db.query(PredictionLog).filter(PredictionLog.validation_statut!=None).all()
    correct=sum(1 for v in valides if v.validation_statut=="CORRECT")
    proche =sum(1 for v in valides if v.validation_statut=="PROCHE")
    return {"predictions":data,"stats":{"total":total,"validees":len(valides),
            "en_attente":total-len(valides),"correct":correct,"proche":proche,
            "incorrect":len(valides)-correct-proche,
            "precision_pct":round((correct+proche)/len(valides)*100,1) if valides else 0}}

@app.get("/predict/stats", tags=["Validation"])
async def get_prediction_stats(
    cu: UserInDB = Depends(require_permission("historique")),
    db: Session = Depends(get_db),
):
    vals=db.query(ValidationLog).all(); total=len(vals)
    if not total: return {"message":"Aucune validation","total_validations":0}
    correct=sum(1 for v in vals if v.statut=="CORRECT")
    proche =sum(1 for v in vals if v.statut=="PROCHE")
    return {"total_validations":total,"correct":correct,"proche":proche,
            "incorrect":total-correct-proche,
            "precision_globale":round((correct+proche)/total*100,1),
            "ecart_moyen_heures":round(sum(abs(v.ecart_heures) for v in vals)/total,2)}

# ── RET ───────────────────────────────────────────────────────────
@app.post("/ret/submit", tags=["Collecte RET"])
async def submit_ret(
    record: RETRecord,
    cu: UserInDB = Depends(require_permission("ret_submit")),
    db: Session = Depends(get_db),
):
    if not record.id_ret:
        record.id_ret = f"RET-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    try:
        dt=datetime.strptime(record.date_incident,"%Y-%m-%d"); mois=dt.month; saison=(dt.month%12)//3
    except: mois=saison=None
    try:
        db.add(RETLog(id_ret=record.id_ret,date_incident=record.date_incident,
            heure_incident=record.heure_incident,coordination=record.coordination,
            type_voie=record.type_voie,nb_vehicules_derailles=record.nb_vehicules_derailles,
            position_vehicule=record.position_vehicule,etat_voie=record.etat_voie,
            position_grues=record.position_grues,duree_reelle_heures=record.duree_reelle_heures,
            faits_saillants=record.faits_saillants,cause_probable=record.cause_probable,
            submitted_by=cu.username,submitted_at=datetime.now().isoformat(),mois=mois,saison=saison))
        db.commit()
        total=db.query(RETLog).count()
        return {"status":"success","id_ret":record.id_ret,"submitted_by":cu.username,
                "total_ret_log":total,"message":f"RET #{total} enregistré dans PostgreSQL"}
    except Exception as e:
        db.rollback(); raise HTTPException(status_code=500,detail=str(e))

@app.get("/ret/list", tags=["Collecte RET"])
async def list_ret(cu: UserInDB=Depends(require_permission("historique")), db: Session=Depends(get_db)):
    rets=db.query(RETLog).order_by(RETLog.id.desc()).limit(20).all()
    return {"ret_list":[{"id_ret":r.id_ret,"date_incident":r.date_incident,
        "coordination":r.coordination,"nb_vehicules":r.nb_vehicules_derailles,
        "duree_reelle_heures":r.duree_reelle_heures,"submitted_by":r.submitted_by,
        "submitted_at":r.submitted_at} for r in rets],"total":db.query(RETLog).count()}

# ── HISTORIQUES ───────────────────────────────────────────────────
@app.get("/historique", tags=["Historiques"])
async def get_historique(
    coordination: Optional[int]=None,
    cu: UserInDB=Depends(require_permission("historique")),
    db: Session=Depends(get_db),
):
    q=db.query(RETDataset)
    lq=db.query(RETLog)
    if coordination:
        q=q.filter(RETDataset.coordination==coordination)
        lq=lq.filter(RETLog.coordination==coordination)
    recs=q.all(); logs=lq.all()
    durees=[r.duree_occupation_heures for r in recs]+[r.duree_reelle_heures for r in logs]
    total=len(recs)+len(logs)
    par_coord={}
    for r in recs+logs:
        c=str(r.coordination); par_coord[c]=par_coord.get(c,0)+1
    return {"stats_globales":{"total_incidents":total,
        "duree_moyenne":round(sum(durees)/len(durees),1) if durees else 0,
        "duree_max":round(max(durees),1) if durees else 0,
        "duree_min":round(min(durees),1) if durees else 0,
        "par_coordination":par_coord},"serie_mensuelle":[],"accessed_by":cu.username}

# ── MODÈLE ML ─────────────────────────────────────────────────────
@app.get("/modele/info", tags=["Modèle ML"])
async def get_model_info(cu: UserInDB=Depends(require_permission("modele_info")), models=Depends(get_models)):
    return {**models["meta"],"accessed_by":cu.username}

@app.post("/modele/retrain", tags=["Modèle ML"])
async def retrain_model(cu: UserInDB=Depends(require_permission("modele_retrain")), db: Session=Depends(get_db)):
    import subprocess, sys
    try:
        rows=[]
        for r in db.query(RETDataset).all():
            rows.append({"id_ret":r.id_ret,"date_incident":r.date_incident,"heure_incident":r.heure_incident,
                "mois":r.mois,"saison":r.saison,"coordination":r.coordination,"type_voie":r.type_voie,
                "nb_vehicules_derailles":r.nb_vehicules_derailles,"position_vehicule":r.position_vehicule,
                "etat_voie":r.etat_voie,"position_grues":r.position_grues,"duree_occupation_heures":r.duree_occupation_heures})
        for r in db.query(RETLog).all():
            rows.append({"id_ret":r.id_ret,"date_incident":r.date_incident,"heure_incident":r.heure_incident,
                "mois":r.mois or 1,"saison":r.saison or 0,"coordination":r.coordination,"type_voie":r.type_voie,
                "nb_vehicules_derailles":r.nb_vehicules_derailles,"position_vehicule":r.position_vehicule,
                "etat_voie":r.etat_voie,"position_grues":r.position_grues,"duree_occupation_heures":r.duree_reelle_heures})
        pd.DataFrame(rows).to_csv(DATA_DIR/"ret_dataset.csv",index=False)
        result=subprocess.run([sys.executable,str(MODEL_DIR/"train_pipeline.py")],capture_output=True,text=True,timeout=180)
        _models.clear()
        return {"status":"success","triggered_by":cu.username,"triggered_at":datetime.now().isoformat(),
                "nb_samples":len(rows),"message":f"Modèle réentraîné sur {len(rows)} RET"}
    except Exception as e:
        raise HTTPException(status_code=500,detail=str(e))

# ── ADMIN ─────────────────────────────────────────────────────────
@app.post("/admin/migrate", tags=["Administration"])
async def migrate_data(cu: UserInDB=Depends(require_admin)):
    try:
        result=migrate_csv_to_db()
        return {"status":"success","migrated":result,"message":"Migration CSV → PostgreSQL terminée"}
    except Exception as e:
        raise HTTPException(status_code=500,detail=str(e))

@app.get("/admin/users", tags=["Administration"])
async def list_users(cu: UserInDB=Depends(require_admin)):
    return [UserPublic(**u.dict()) for u in load_users().values()]

@app.post("/admin/users", tags=["Administration"])
async def create_user(req: CreateUserRequest, cu: UserInDB=Depends(require_admin)):
    users=load_users()
    if req.username in users: raise HTTPException(status_code=409,detail="Utilisateur déjà existant")
    from auth.jwt_auth import UserInDB as UIDB
    users[req.username]=UIDB(username=req.username,full_name=req.full_name,role=req.role,
        coordination=req.coordination,hashed_password=pwd_ctx.hash(req.password),disabled=False)
    save_users(users)
    return {"status":"success","message":f"'{req.username}' créé"}

@app.delete("/admin/users/{username}", tags=["Administration"])
async def delete_user(username: str, cu: UserInDB=Depends(require_admin)):
    if username==cu.username: raise HTTPException(status_code=400,detail="Impossible de supprimer son propre compte")
    users=load_users()
    if username not in users: raise HTTPException(status_code=404,detail="Introuvable")
    users[username].disabled=True; save_users(users)
    return {"status":"success","message":f"'{username}' désactivé"}

# ── TEST & INFO ───────────────────────────────────────────────────
@app.get("/test/scenario", tags=["Fonction Test"])
async def test_scenario(scenario: str="grave",cu: UserInDB=Depends(require_permission("predict")),
    models=Depends(get_models),db: Session=Depends(get_db)):
    scenarios={
        "leger":PredictionInput(nb_vehicules_derailles=1,position_vehicule=1,etat_voie=1,position_grues=1,type_voie=2,heure_incident=10,coordination=1,heure_information_pcc="08:00"),
        "modere":PredictionInput(nb_vehicules_derailles=3,position_vehicule=2,etat_voie=2,position_grues=2,type_voie=1,heure_incident=14,coordination=2,heure_information_pcc="14:00"),
        "grave":PredictionInput(nb_vehicules_derailles=6,position_vehicule=3,etat_voie=3,position_grues=3,type_voie=1,heure_incident=22,coordination=1,heure_information_pcc="22:00"),
        "nuit_modere":PredictionInput(nb_vehicules_derailles=2,position_vehicule=1,etat_voie=2,position_grues=2,type_voie=1,heure_incident=3,coordination=3,heure_information_pcc="03:00"),
    }
    if scenario not in scenarios: raise HTTPException(status_code=400,detail=f"Scénarios:{list(scenarios.keys())}")
    return await predict(scenarios[scenario],cu,models,db)

@app.get("/db/status", tags=["Info"])
async def db_status():
    ok=test_connection()
    return {"postgresql":"connecté" if ok else "déconnecté","supabase":"ogcvmxbtawufxrsujyka.supabase.co","status":"ok" if ok else "error"}

@app.get("/", tags=["Info"])
def root():
    return {"service":"CAMRAIL Predictive API","version":"1.0.0",
            "database":"PostgreSQL (Supabase)","security":"JWT Bearer Token","docs":"/docs","status":"operational"}
