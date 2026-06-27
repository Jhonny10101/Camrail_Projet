"""
Pipeline ML CAMRAIL — Modèle Prédictif de Durées d'Occupation de Cantons
Random Forest + Gradient Boosting Quantile pour intervalles de confiance 85%
"""
import pandas as pd
import numpy as np
import joblib
import json
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import cross_val_score, KFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error

MODEL_DIR = Path("models")
DATA_DIR  = Path("data")
MODEL_DIR.mkdir(exist_ok=True)

FEATURES = [
    "nb_vehicules_derailles",
    "position_vehicule",
    "etat_voie",
    "position_grues",
    "type_voie",
    "heure_incident",
    "coordination",
    "mois",
    "saison",
]
TARGET = "duree_occupation_heures"


def load_data():
    df = pd.read_csv(DATA_DIR / "ret_dataset.csv")
    X = df[FEATURES]
    y = df[TARGET]
    print(f"📂 Données chargées : {len(df)} RET | Features : {len(FEATURES)}")
    return X, y, df


def train_models(X, y):
    print("\n🤖 Entraînement des modèles...")

    # ── 1. Random Forest (prédiction centrale) ──────────────────────────────
    rf = RandomForestRegressor(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=3,
        max_features="sqrt",
        oob_score=True,
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X, y)
    print(f"  ✅ Random Forest — OOB R²: {rf.oob_score_:.4f}")

    # ── 2. Gradient Boosting Quantile (IC bas — 7.5%) ───────────────────────
    gbq_low = GradientBoostingRegressor(
        loss="quantile", alpha=0.075,
        n_estimators=200, max_depth=5,
        learning_rate=0.05, random_state=42,
    )
    gbq_low.fit(X, y)
    print(f"  ✅ GBQ Lower (7.5%) entraîné")

    # ── 3. Gradient Boosting Quantile (IC haut — 92.5%) ─────────────────────
    gbq_high = GradientBoostingRegressor(
        loss="quantile", alpha=0.925,
        n_estimators=200, max_depth=5,
        learning_rate=0.05, random_state=42,
    )
    gbq_high.fit(X, y)
    print(f"  ✅ GBQ Upper (92.5%) entraîné")

    return rf, gbq_low, gbq_high


def evaluate_models(rf, gbq_low, gbq_high, X, y):
    print("\n📊 Évaluation des performances...")

    y_pred = rf.predict(X)
    mae  = mean_absolute_error(y, y_pred)
    rmse = np.sqrt(mean_squared_error(y, y_pred))
    r2   = r2_score(y, y_pred)

    # Validation croisée 5-fold
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(rf, X, y, cv=kf, scoring="r2")

    # Couverture de l'intervalle de confiance 85%
    y_low  = gbq_low.predict(X)
    y_high = gbq_high.predict(X)
    coverage = np.mean((y >= y_low) & (y <= y_high))

    metrics = {
        "mae":          round(float(mae), 3),
        "rmse":         round(float(rmse), 3),
        "r2_train":     round(float(r2), 4),
        "r2_cv_mean":   round(float(cv_scores.mean()), 4),
        "r2_cv_std":    round(float(cv_scores.std()), 4),
        "oob_score":    round(float(rf.oob_score_), 4),
        "ic85_coverage":round(float(coverage), 4),
        "n_samples":    len(y),
        "n_features":   len(FEATURES),
    }

    print(f"  MAE       : {metrics['mae']} h")
    print(f"  RMSE      : {metrics['rmse']} h")
    print(f"  R² train  : {metrics['r2_train']}")
    print(f"  R² CV     : {metrics['r2_cv_mean']} ± {metrics['r2_cv_std']}")
    print(f"  OOB Score : {metrics['oob_score']}")
    print(f"  IC 85% couverture réelle : {coverage*100:.1f}%")

    return metrics


def compute_feature_importance(rf, X):
    importances = rf.feature_importances_
    feat_imp = sorted(
        zip(FEATURES, importances),
        key=lambda x: x[1], reverse=True
    )
    return [{"feature": f, "importance": round(float(v), 4)} for f, v in feat_imp]


def save_all(rf, gbq_low, gbq_high, metrics, feat_imp):
    print("\n💾 Sauvegarde des modèles...")
    joblib.dump(rf,       MODEL_DIR / "rf_model.joblib")
    joblib.dump(gbq_low,  MODEL_DIR / "gbq_low.joblib")
    joblib.dump(gbq_high, MODEL_DIR / "gbq_high.joblib")

    meta = {
        "features": FEATURES,
        "target": TARGET,
        "metrics": metrics,
        "feature_importance": feat_imp,
        "model_version": "0.3",
        "training_date": "2026-06-15",
    }
    with open(MODEL_DIR / "model_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    print("  ✅ rf_model.joblib")
    print("  ✅ gbq_low.joblib")
    print("  ✅ gbq_high.joblib")
    print("  ✅ model_meta.json")


def run_pipeline():
    print("=" * 55)
    print("  CAMRAIL — Pipeline ML v0.3")
    print("  Modèle Prédictif Durées d'Occupation de Cantons")
    print("=" * 55)

    X, y, df = load_data()
    rf, gbq_low, gbq_high = train_models(X, y)
    metrics = evaluate_models(rf, gbq_low, gbq_high, X, y)
    feat_imp = compute_feature_importance(rf, X)
    save_all(rf, gbq_low, gbq_high, metrics, feat_imp)

    print("\n🎯 Feature importances :")
    for item in feat_imp:
        bar = "█" * int(item["importance"] * 100)
        print(f"  {item['feature']:<30} {bar} {item['importance']:.4f}")

    print("\n✅ Pipeline terminé avec succès !")
    return metrics, feat_imp


if __name__ == "__main__":
    run_pipeline()
