"""
CAMRAIL — Module Base de Données PostgreSQL (Supabase)
"""
import os
from sqlalchemy import create_engine, text, Column, Integer, Float, String, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# ── Charger .env AVANT tout ──────────────────────────────────────
load_dotenv(override=True)
DATABASE_URL = os.getenv("DATABASE_URL", "")

# ── Vérification de l'URL ────────────────────────────────────────
if not DATABASE_URL or DATABASE_URL.strip() == "":
    print("⚠️  DATABASE_URL non trouvée dans .env")
    DATABASE_URL = None

if DATABASE_URL and not DATABASE_URL.startswith("postgresql"):
    print(f"⚠️  URL invalide : {DATABASE_URL[:30]}...")
    DATABASE_URL = None

# ── Création de l'engine (seulement si URL valide) ───────────────
engine       = None
SessionLocal = None
Base         = declarative_base()

if DATABASE_URL:
    try:
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            connect_args={"connect_timeout": 10},
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        print(f"✅ Engine PostgreSQL créé")
    except Exception as e:
        print(f"❌ Erreur création engine : {e}")
        engine = None
        SessionLocal = None

# ── Tables ───────────────────────────────────────────────────────
class RETDataset(Base):
    __tablename__ = "ret_dataset"
    id                      = Column(Integer, primary_key=True, index=True)
    id_ret                  = Column(String, unique=True, index=True)
    date_incident           = Column(String)
    heure_incident          = Column(Integer)
    mois                    = Column(Integer)
    saison                  = Column(Integer)
    coordination            = Column(Integer)
    type_voie               = Column(Integer)
    nb_vehicules_derailles  = Column(Integer)
    position_vehicule       = Column(Integer)
    etat_voie               = Column(Integer)
    position_grues          = Column(Integer)
    duree_occupation_heures = Column(Float)

class RETLog(Base):
    __tablename__ = "ret_log"
    id                      = Column(Integer, primary_key=True, index=True)
    id_ret                  = Column(String, unique=True, index=True)
    date_incident           = Column(String)
    heure_incident          = Column(Integer)
    coordination            = Column(Integer)
    type_voie               = Column(Integer)
    nb_vehicules_derailles  = Column(Integer)
    position_vehicule       = Column(Integer)
    etat_voie               = Column(Integer)
    position_grues          = Column(Integer)
    duree_reelle_heures     = Column(Float)
    faits_saillants         = Column(String, nullable=True)
    cause_probable          = Column(String, nullable=True)
    submitted_by            = Column(String)
    submitted_at            = Column(String)
    mois                    = Column(Integer, nullable=True)
    saison                  = Column(Integer, nullable=True)

class PredictionLog(Base):
    __tablename__ = "predictions_log"
    id                    = Column(Integer, primary_key=True, index=True)
    id_prediction         = Column(String, unique=True, index=True)
    predicted_by          = Column(String)
    predicted_at          = Column(String)
    duree_heures          = Column(Float)
    ic_min_heures         = Column(Float)
    ic_max_heures         = Column(Float)
    niveau_risque         = Column(String)
    heure_reprise         = Column(String, nullable=True)
    heure_information_pcc = Column(String, nullable=True)
    nb_vehicules          = Column(Integer)
    position_vehicule     = Column(Integer)
    etat_voie             = Column(Integer)
    position_grues        = Column(Integer)
    type_voie             = Column(Integer)
    heure_incident        = Column(Integer)
    coordination          = Column(Integer)
    validation_statut     = Column(String, nullable=True)
    duree_reelle          = Column(Float, nullable=True)
    ecart_heures          = Column(Float, nullable=True)

class ValidationLog(Base):
    __tablename__ = "validations_log"
    id            = Column(Integer, primary_key=True, index=True)
    id_validation = Column(String, unique=True, index=True)
    id_prediction = Column(String)
    duree_predite = Column(Float)
    duree_reelle  = Column(Float)
    ecart_heures  = Column(Float)
    statut        = Column(String)
    precision     = Column(String)
    heure_reelle  = Column(String, nullable=True)
    commentaire   = Column(String, nullable=True)
    valide_par    = Column(String)
    valide_le     = Column(String)

# ── Fonctions utilitaires ────────────────────────────────────────
def get_db():
    if not SessionLocal:
        raise Exception("Base de données non configurée. Vérifiez DATABASE_URL dans .env")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    if not engine:
        print("⚠️  Engine non disponible, tables non créées")
        return False
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Tables PostgreSQL créées/vérifiées")
        return True
    except Exception as e:
        print(f"❌ Erreur création tables : {e}")
        return False

def test_connection():
    if not engine:
        print("❌ Engine non disponible")
        return False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Connexion PostgreSQL Supabase OK")
        return True
    except Exception as e:
        print(f"❌ Connexion échouée : {e}")
        return False

def migrate_csv_to_db():
    import pandas as pd
    from pathlib import Path
    if not SessionLocal:
        raise Exception("Base non configurée")

    db = SessionLocal()
    DATA_DIR = Path("data")
    migrated = {"ret_dataset": 0, "ret_log": 0}

    try:
        # Migrer ret_dataset.csv
        csv_path = DATA_DIR / "ret_dataset.csv"
        if csv_path.exists():
            df = pd.read_csv(csv_path)
            for _, row in df.iterrows():
                existing = db.query(RETDataset).filter(
                    RETDataset.id_ret == str(row.get("id_ret",""))
                ).first()
                if not existing:
                    db.add(RETDataset(
                        id_ret=str(row.get("id_ret","")),
                        date_incident=str(row.get("date_incident","")),
                        heure_incident=int(row.get("heure_incident",0)),
                        mois=int(row.get("mois",1)),
                        saison=int(row.get("saison",0)),
                        coordination=int(row.get("coordination",1)),
                        type_voie=int(row.get("type_voie",1)),
                        nb_vehicules_derailles=int(row.get("nb_vehicules_derailles",1)),
                        position_vehicule=int(row.get("position_vehicule",1)),
                        etat_voie=int(row.get("etat_voie",1)),
                        position_grues=int(row.get("position_grues",1)),
                        duree_occupation_heures=float(row.get("duree_occupation_heures",0)),
                    ))
                    migrated["ret_dataset"] += 1
            db.commit()
            print(f"✅ ret_dataset : {migrated['ret_dataset']} enregistrements migrés")

        # Migrer ret_log.csv
        log_path = DATA_DIR / "ret_log.csv"
        if log_path.exists():
            df = pd.read_csv(log_path)
            for _, row in df.iterrows():
                existing = db.query(RETLog).filter(
                    RETLog.id_ret == str(row.get("id_ret",""))
                ).first()
                if not existing:
                    db.add(RETLog(
                        id_ret=str(row.get("id_ret","")),
                        date_incident=str(row.get("date_incident","")),
                        heure_incident=int(row.get("heure_incident",0)),
                        coordination=int(row.get("coordination",1)),
                        type_voie=int(row.get("type_voie",1)),
                        nb_vehicules_derailles=int(row.get("nb_vehicules_derailles",1)),
                        position_vehicule=int(row.get("position_vehicule",1)),
                        etat_voie=int(row.get("etat_voie",1)),
                        position_grues=int(row.get("position_grues",1)),
                        duree_reelle_heures=float(row.get("duree_reelle_heures",0)),
                        faits_saillants=str(row.get("faits_saillants","")),
                        cause_probable=str(row.get("cause_probable","")),
                        submitted_by=str(row.get("submitted_by","")),
                        submitted_at=str(row.get("submitted_at","")),
                        mois=int(row.get("mois",1)) if row.get("mois") else None,
                        saison=int(row.get("saison",0)) if row.get("saison") else None,
                    ))
                    migrated["ret_log"] += 1
            db.commit()
            print(f"✅ ret_log : {migrated['ret_log']} enregistrements migrés")

        print(f"🎉 Migration terminée : {sum(migrated.values())} enregistrements")
        return migrated

    except Exception as e:
        db.rollback()
        print(f"❌ Erreur migration : {e}")
        raise
    finally:
        db.close()