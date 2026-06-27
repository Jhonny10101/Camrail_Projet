"""
Génération de données RET simulées réalistes pour CAMRAIL
Simule 4 ans de Rapports d'Enquête Technique sur déraillements
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random

np.random.seed(42)
random.seed(42)

def generate_ret_dataset(n_samples=200):
    records = []
    start_date = datetime(2022, 1, 1)

    for i in range(n_samples):
        # Date de l'incident
        days_offset = random.randint(0, 4 * 365)
        incident_dt = start_date + timedelta(days=days_offset)
        mois = incident_dt.month
        saison = (mois % 12) // 3  # 0=hiver, 1=printemps, 2=été, 3=automne

        # Features
        nb_vehicules = np.random.choice([1,2,3,4,5,6,7,8], p=[0.15,0.22,0.20,0.18,0.12,0.07,0.04,0.02])
        position_vehicule = np.random.choice([1,2,3], p=[0.35,0.40,0.25])  # 1=tête,2=milieu,3=queue
        etat_voie = np.random.choice([1,2,3], p=[0.30,0.45,0.25])          # 1=léger,2=modéré,3=grave
        position_grues = np.random.choice([1,2,3], p=[0.40,0.35,0.25])     # 1=proche,2=moyen,3=loin
        type_voie = np.random.choice([1,2], p=[0.75,0.25])                  # 1=principale,2=secondaire
        heure_incident = np.random.randint(0, 24)
        coordination = np.random.choice([1,2,3,4], p=[0.30,0.28,0.22,0.20])

        # Calcul durée réaliste (heures)
        base = 4.5
        d_vehicules = nb_vehicules * 1.8
        d_position  = {1: 1.0, 2: 1.5, 3: 2.2}[position_vehicule]
        d_etat      = {1: 1.0, 2: 2.5, 3: 4.8}[etat_voie]
        d_grues     = {1: 0.8, 2: 1.6, 3: 3.2}[position_grues]
        d_voie      = 1.3 if type_voie == 1 else 0.9
        d_heure     = 1.35 if (heure_incident >= 20 or heure_incident <= 6) else 1.0
        d_coord     = {1: 1.0, 2: 1.15, 3: 0.95, 4: 1.1}[coordination]
        d_saison    = {0: 1.1, 1: 1.0, 2: 0.95, 3: 1.05}[saison]

        duree_theorique = (base + d_vehicules + d_position + d_etat + d_grues) * d_voie * d_heure * d_coord * d_saison
        bruit = np.random.normal(0, 1.5)
        duree_reelle = max(2.0, round(duree_theorique + bruit, 1))

        records.append({
            "id_ret": f"RET-{2022 + days_offset//365}-{i+1:04d}",
            "date_incident": incident_dt.strftime("%Y-%m-%d"),
            "heure_incident": heure_incident,
            "mois": mois,
            "saison": saison,
            "coordination": coordination,
            "type_voie": type_voie,
            "nb_vehicules_derailles": nb_vehicules,
            "position_vehicule": position_vehicule,
            "etat_voie": etat_voie,
            "position_grues": position_grues,
            "duree_occupation_heures": duree_reelle,
        })

    df = pd.DataFrame(records)
    df.to_csv("data/ret_dataset.csv", index=False)
    print(f"✅ Dataset généré : {len(df)} enregistrements")
    print(df.describe())
    return df

if __name__ == "__main__":
    generate_ret_dataset()
