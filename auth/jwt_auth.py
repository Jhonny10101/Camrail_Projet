"""
CAMRAIL — Module d'Authentification JWT
Gestion des rôles : CELLULE_CRISE (écriture) | OPERATEUR (lecture) | ADMIN (tout)
Conforme au cahier des charges section Sécurité
"""
from datetime import datetime, timedelta
from typing import Optional, List
from pathlib import Path
import json, os

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

# ─── Configuration ───────────────────────────────────────────────────────────
SECRET_KEY  = os.getenv("CAMRAIL_SECRET_KEY", "camrail-jwt-secret-clef-tres-longue-2026-intranet")
ALGORITHM   = "HS256"
TOKEN_EXPIRE_MINUTES = 480  # 8 heures (durée d'un quart de travail)

USERS_FILE = Path("auth/users.json")

pwd_ctx = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ─── Rôles ──────────────────────────────────────────────────────────────────
class Role:
    ADMIN          = "ADMIN"           # Accès total + administration
    CELLULE_CRISE  = "CELLULE_CRISE"   # Écriture (prédiction + soumission RET)
    OPERATEUR      = "OPERATEUR"       # Lecture seule (historiques, infos modèle)

PERMISSIONS = {
    Role.ADMIN:         ["predict", "ret_submit", "historique", "modele_info", "modele_retrain", "users_manage"],
    Role.CELLULE_CRISE: ["predict", "ret_submit", "historique", "modele_info"],
    Role.OPERATEUR:     ["historique", "modele_info"],
}

# ─── Schémas ─────────────────────────────────────────────────────────────────
class UserInDB(BaseModel):
    username:     str
    full_name:    str
    role:         str
    coordination: Optional[str] = None
    hashed_password: str
    disabled:     bool = False

class UserPublic(BaseModel):
    username:     str
    full_name:    str
    role:         str
    coordination: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type:   str
    expires_in:   int
    user:         UserPublic

class TokenData(BaseModel):
    username: Optional[str] = None
    role:     Optional[str] = None

# ─── Base de données utilisateurs (JSON) ────────────────────────────────────
DEFAULT_USERS = [
    {
        "username":     "admin",
        "full_name":    "Administrateur Système",
        "role":         Role.ADMIN,
        "coordination": None,
        "hashed_password": pwd_ctx.hash("Admin@Camrail2026"),
        "disabled":     False,
    },
    {
        "username":     "cellule_crise",
        "full_name":    "Cellule de Crise CAMRAIL",
        "role":         Role.CELLULE_CRISE,
        "coordination": None,
        "hashed_password": pwd_ctx.hash("Crise@2026!"),
        "disabled":     False,
    },
    {
        "username":     "coord_nord",
        "full_name":    "Coordination Nord",
        "role":         Role.CELLULE_CRISE,
        "coordination": "Nord",
        "hashed_password": pwd_ctx.hash("Nord@2026!"),
        "disabled":     False,
    },
    {
        "username":     "coord_sud",
        "full_name":    "Coordination Sud",
        "role":         Role.CELLULE_CRISE,
        "coordination": "Sud",
        "hashed_password": pwd_ctx.hash("Sud@2026!"),
        "disabled":     False,
    },
    {
        "username":     "dmat",
        "full_name":    "Direction du Matériel (DMAT)",
        "role":         Role.OPERATEUR,
        "coordination": None,
        "hashed_password": pwd_ctx.hash("Dmat@2026!"),
        "disabled":     False,
    },
    {
        "username":     "mobirail",
        "full_name":    "MOBIRAIL Operating Manager",
        "role":         Role.OPERATEUR,
        "coordination": None,
        "hashed_password": pwd_ctx.hash("Mobirail@2026!"),
        "disabled":     False,
    },
]

def init_users_db():
    """Initialise la base si elle n'existe pas."""
    USERS_FILE.parent.mkdir(exist_ok=True)
    if not USERS_FILE.exists():
        with open(USERS_FILE, "w") as f:
            json.dump(DEFAULT_USERS, f, indent=2)
        print(f"✅ Base utilisateurs créée : {len(DEFAULT_USERS)} comptes")

def load_users() -> dict:
    init_users_db()
    with open(USERS_FILE) as f:
        users = json.load(f)
    return {u["username"]: UserInDB(**u) for u in users}

def save_users(users_dict: dict):
    with open(USERS_FILE, "w") as f:
        json.dump([u.dict() for u in users_dict.values()], f, indent=2)

# ─── Fonctions utilitaires ───────────────────────────────────────────────────
def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def get_user(username: str) -> Optional[UserInDB]:
    return load_users().get(username)

def authenticate_user(username: str, password: str) -> Optional[UserInDB]:
    user = get_user(username)
    if not user or user.disabled:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# ─── Dépendances FastAPI ─────────────────────────────────────────────────────
async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserInDB:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception

    user = get_user(token_data.username)
    if user is None or user.disabled:
        raise credentials_exception
    return user

def require_permission(permission: str):
    """Décorateur de permission basé sur le rôle."""
    async def check(current_user: UserInDB = Depends(get_current_user)):
        allowed = PERMISSIONS.get(current_user.role, [])
        if permission not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès refusé. Rôle requis : permissions '{permission}' non accordées au rôle '{current_user.role}'",
            )
        return current_user
    return check

def require_admin(current_user: UserInDB = Depends(get_current_user)):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Réservé à l'administrateur")
    return current_user
