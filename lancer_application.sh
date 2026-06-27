#!/bin/bash
# ══════════════════════════════════════════════════
#  CAMRAIL — Script de démarrage Mac/Linux
#  Usage : ./lancer_application.sh
# ══════════════════════════════════════════════════

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

clear
echo -e "${RED}${BOLD}"
echo "  ██████╗ █████╗ ███╗   ███╗██████╗  █████╗ ██╗██╗"
echo " ██╔════╝██╔══██╗████╗ ████║██╔══██╗██╔══██╗██║██║"
echo " ██║     ███████║██╔████╔██║██████╔╝███████║██║██║"
echo " ██║     ██╔══██║██║╚██╔╝██║██╔══██╗██╔══██║██║██║"
echo " ╚██████╗██║  ██║██║ ╚═╝ ██║██║  ██║██║  ██║██║███████╗"
echo "  ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝"
echo -e "${NC}"
echo -e "${BOLD}  Modèle Prédictif — Durées d'Occupation de Cantons${NC}"
echo "  ══════════════════════════════════════════════════"
echo ""

# ── Vérifications ─────────────────────────────────────────────────
command -v python3 >/dev/null 2>&1 || { echo -e "${RED}[ERREUR]${NC} Python3 non trouvé. Installe-le sur python.org"; exit 1; }
command -v node    >/dev/null 2>&1 || { echo -e "${RED}[ERREUR]${NC} Node.js non trouvé. Installe-le sur nodejs.org";  exit 1; }
echo -e "${GREEN}[OK]${NC} Python3 et Node.js détectés"

# ── Environnement virtuel ──────────────────────────────────────────
if [ ! -d "venv" ]; then
    echo -e "\n${YELLOW}[1/5]${NC} Création de l'environnement Python..."
    python3 -m venv venv
    echo -e "${GREEN}[OK]${NC} Environnement créé"
fi
source venv/bin/activate

# ── Dépendances Python ─────────────────────────────────────────────
echo -e "\n${YELLOW}[2/5]${NC} Installation des dépendances Python..."
pip install -r requirements.txt -q
echo -e "${GREEN}[OK]${NC} Dépendances installées"

# ── Données et modèle ──────────────────────────────────────────────
if [ ! -f "data/ret_dataset.csv" ]; then
    echo -e "\n${YELLOW}[3/5]${NC} Génération des données RET..."
    python3 data/generate_data.py
    echo -e "${GREEN}[OK]${NC} Données générées"
else
    echo -e "${GREEN}[OK]${NC} Données existantes conservées"
fi

if [ ! -f "models/rf_model.joblib" ]; then
    echo -e "\n${YELLOW}[4/5]${NC} Entraînement du modèle ML..."
    python3 models/train_pipeline.py
    echo -e "${GREEN}[OK]${NC} Modèle entraîné"
else
    echo -e "${GREEN}[OK]${NC} Modèle existant conservé"
fi

# ── Dépendances React ──────────────────────────────────────────────
if [ ! -d "frontend/node_modules" ]; then
    echo -e "\n${YELLOW}[5/5]${NC} Installation des dépendances React..."
    cd frontend && npm install -q && cd ..
    echo -e "${GREEN}[OK]${NC} React installé"
else
    echo -e "${GREEN}[OK]${NC} React déjà installé"
fi

# ── Démarrage des services ─────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
echo " Démarrage des services..."
echo "══════════════════════════════════════════════════"

# Backend dans un terminal séparé
if [[ "$OSTYPE" == "darwin"* ]]; then
    osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"' && source venv/bin/activate && uvicorn main:app --reload --port 8000"'
else
    gnome-terminal -- bash -c "cd $(pwd) && source venv/bin/activate && uvicorn main:app --reload --port 8000; exec bash" 2>/dev/null || \
    xterm -e "cd $(pwd) && source venv/bin/activate && uvicorn main:app --reload --port 8000" &
fi

sleep 4

# Frontend dans un autre terminal
if [[ "$OSTYPE" == "darwin"* ]]; then
    osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)/frontend"' && npm start"'
else
    gnome-terminal -- bash -c "cd $(pwd)/frontend && npm start; exec bash" 2>/dev/null || \
    xterm -e "cd $(pwd)/frontend && npm start" &
fi

sleep 5

# Ouvrir le navigateur
echo ""
echo "══════════════════════════════════════════════════"
echo -e "${GREEN}${BOLD} Application CAMRAIL démarrée !${NC}"
echo ""
echo " Interface  : http://localhost:3000"
echo " API Docs   : http://localhost:8000/docs"
echo ""
echo " Comptes de connexion :"
echo "   admin         / Admin@Camrail2026"
echo "   cellule_crise / Crise@2026!"
echo "   coord_nord    / Nord@2026!"
echo "   dmat          / Dmat@2026!"
echo "══════════════════════════════════════════════════"

# Ouvrir navigateur
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3000
else
    xdg-open http://localhost:3000 2>/dev/null || true
fi
