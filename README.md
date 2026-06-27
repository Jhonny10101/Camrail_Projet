# 🚂 CAMRAIL — Modèle Prédictif de Durées d'Occupation de Cantons

## ⚡ Démarrage rapide

### Sur Windows
1. Installe **Python** → https://python.org *(coche "Add to PATH")*
2. Installe **Node.js** → https://nodejs.org *(version LTS)*
3. **Double-clique** sur `LANCER_APPLICATION.bat`
4. Attends 2-3 minutes (installation automatique au premier lancement)
5. L'application s'ouvre dans ton navigateur sur **http://localhost:3000**

### Sur Mac/Linux
```bash
chmod +x lancer_application.sh
./lancer_application.sh
```

---

## 🔐 Comptes de connexion

| Identifiant | Mot de passe | Rôle | Accès |
|---|---|---|---|
| `admin` | `Admin@Camrail2026` | ADMIN | Tout + gestion utilisateurs |
| `cellule_crise` | `Crise@2026!` | CELLULE_CRISE | Prédiction + RET |
| `coord_nord` | `Nord@2026!` | CELLULE_CRISE | Prédiction + RET |
| `coord_sud` | `Sud@2026!` | CELLULE_CRISE | Prédiction + RET |
| `dmat` | `Dmat@2026!` | OPERATEUR | Lecture seule |
| `mobirail` | `Mobirail@2026!` | OPERATEUR | Lecture seule |

---

## 📁 Structure du projet

```
camrail/
├── LANCER_APPLICATION.bat   ← Démarrage Windows (double-clic)
├── lancer_application.sh    ← Démarrage Mac/Linux
├── main.py                  ← API FastAPI (backend)
├── requirements.txt         ← Dépendances Python
├── auth/
│   └── jwt_auth.py          ← Authentification JWT
├── data/
│   └── generate_data.py     ← Générateur données RET
├── models/
│   └── train_pipeline.py    ← Pipeline ML (Random Forest)
├── nginx/
│   └── camrail.conf         ← Config Nginx (déploiement intranet)
├── scripts/
│   └── deploy.sh            ← Script déploiement Docker
└── frontend/
    ├── package.json
    ├── public/index.html
    └── src/
        ├── index.js
        └── App.jsx          ← Interface React
```

---

## 🌐 URLs disponibles

| URL | Description |
|---|---|
| http://localhost:3000 | Interface utilisateur React |
| http://localhost:8000/docs | Documentation API Swagger |
| http://localhost:8000 | API REST (JSON) |

---

## 🛠️ En cas de problème

**"Python non trouvé"** → Réinstalle Python en cochant *"Add to PATH"*

**"Port déjà utilisé"** → Ferme les fenêtres de terminal ouvertes et relance

**"npm : commande introuvable"** → Réinstalle Node.js depuis nodejs.org

**Le modèle ne démarre pas** → Supprime le dossier `models/` et relance, il se réentraîne automatiquement

---

## 📊 Fonctionnalités

- 🎯 **Prédiction** — Durée d'occupation + intervalle de confiance 85% + heure de reprise
- 📝 **Collecte RET** — Saisie des données post-incident pour enrichir le modèle
- 📊 **Historiques** — Tableaux de bord par coordination et par période
- 🤖 **Modèle ML** — Métriques Random Forest + feature importance
- ⚙️ **Administration** — Gestion des utilisateurs (ADMIN uniquement)

---

*CAMRAIL · Programme Innovation Ferroviaire · v1.0 · 15/06/2026*
