@echo off
chcp 65001 >nul
title CAMRAIL — Démarrage Application

echo.
echo  ██████╗ █████╗ ███╗   ███╗██████╗  █████╗ ██╗██╗
echo ██╔════╝██╔══██╗████╗ ████║██╔══██╗██╔══██╗██║██║
echo ██║     ███████║██╔████╔██║██████╔╝███████║██║██║
echo ██║     ██╔══██║██║╚██╔╝██║██╔══██╗██╔══██║██║██║
echo ╚██████╗██║  ██║██║ ╚═╝ ██║██║  ██║██║  ██║██║███████╗
echo  ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝
echo.
echo  Modèle Prédictif — Durées d'Occupation de Cantons
echo  ══════════════════════════════════════════════════
echo.

:: ── Vérifier Python ──────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Python non trouvé !
    echo Télécharge Python sur : https://python.org
    echo Coche bien "Add Python to PATH" lors de l'installation.
    pause
    exit /b 1
)
echo [OK] Python détecté

:: ── Vérifier Node.js ─────────────────────────────────────────────
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js non trouvé !
    echo Télécharge Node.js sur : https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js détecté

:: ── Créer environnement virtuel si nécessaire ────────────────────
if not exist "venv" (
    echo.
    echo [1/5] Création de l'environnement Python...
    python -m venv venv
    echo [OK] Environnement créé
)

:: ── Activer venv et installer dépendances ────────────────────────
echo.
echo [2/5] Installation des dépendances Python...
call venv\Scripts\activate.bat
pip install -r requirements.txt -q --no-warn-script-location
echo [OK] Dépendances installées

:: ── Générer données et entraîner modèle ──────────────────────────
if not exist "data\ret_dataset.csv" (
    echo.
    echo [3/5] Génération des données RET...
    python data\generate_data.py
    echo [OK] Données générées
) else (
    echo [OK] Données existantes conservées
)

if not exist "models\rf_model.joblib" (
    echo.
    echo [4/5] Entraînement du modèle ML (Random Forest)...
    python models\train_pipeline.py
    echo [OK] Modèle entraîné
) else (
    echo [OK] Modèle existant conservé
)

:: ── Installer dépendances Node ────────────────────────────────────
if not exist "frontend\node_modules" (
    echo.
    echo [5/5] Installation des dépendances React...
    cd frontend
    npm install -q
    cd ..
    echo [OK] Dépendances React installées
) else (
    echo [OK] React déjà installé
)

:: ── Démarrer Backend ─────────────────────────────────────────────
echo.
echo ══════════════════════════════════════════════════
echo  Démarrage des services...
echo ══════════════════════════════════════════════════
echo.
echo [BACKEND] Démarrage FastAPI sur http://localhost:8000
start "CAMRAIL Backend" cmd /k "call venv\Scripts\activate.bat && uvicorn main:app --reload --port 8000"

:: Attendre que le backend soit prêt
timeout /t 4 /nobreak >nul

:: ── Démarrer Frontend ─────────────────────────────────────────────
echo [FRONTEND] Démarrage React sur http://localhost:3000
start "CAMRAIL Frontend" cmd /k "cd frontend && npm start"

:: Attendre que le frontend soit prêt
timeout /t 6 /nobreak >nul

:: ── Ouvrir le navigateur ──────────────────────────────────────────
echo.
echo ══════════════════════════════════════════════════
echo  Application CAMRAIL démarrée !
echo.
echo  Interface  : http://localhost:3000
echo  API Docs   : http://localhost:8000/docs
echo.
echo  Comptes de connexion :
echo    admin         / Admin@Camrail2026   (Administrateur)
echo    cellule_crise / Crise@2026!         (Cellule de Crise)
echo    coord_nord    / Nord@2026!          (Coordination Nord)
echo    dmat          / Dmat@2026!          (Lecture seule)
echo ══════════════════════════════════════════════════
echo.
start http://localhost:3000
echo  Appuie sur une touche pour fermer ce lanceur...
echo  (Les serveurs continuent de tourner dans leurs fenetres)
pause >nul
