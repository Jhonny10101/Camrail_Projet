// ─── PdfExport.js — Génération du Rapport PDF Officiel CAMRAIL ──────────────
// Utilise jsPDF (chargé via CDN dans index.html)
// Appelé depuis App.jsx après une prédiction réussie

export function generatePredictionPDF({ result, inputs, heurePCC, user, logoB64 }) {

  // ── jsPDF depuis window (CDN) ──────────────────────────────────────────────
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210;   // largeur A4
  const M = 15;    // marge
  const CW = W - M * 2; // largeur contenu

  // ── Palette couleurs ───────────────────────────────────────────────────────
  const RED   = [204, 0, 0];
  const NAVY  = [10, 22, 40];
  const STEEL = [30, 58, 95];
  const LIGHT = [238, 242, 247];
  const WHITE = [255, 255, 255];
  const GREEN = [26, 122, 74];
  const ORANGE= [224, 123, 0];
  const SILVER= [139, 155, 180];

  const risqueColor = result.niveau_risque === "ÉLEVÉ"  ? RED
                    : result.niveau_risque === "MODÉRÉ" ? ORANGE
                    : GREEN;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const setColor = (rgb) => { doc.setTextColor(...rgb); };
  const setFill  = (rgb) => { doc.setFillColor(...rgb); };
  const setDraw  = (rgb) => { doc.setDrawColor(...rgb); };
  const rect     = (x, y, w, h, rgb, style = "F") => { setFill(rgb); setDraw(rgb); doc.rect(x, y, w, h, style); };
  const text     = (txt, x, y, opts = {}) => {
    doc.setFontSize(opts.size || 11);
    doc.setFont("helvetica", opts.bold ? "bold" : opts.italic ? "italic" : "normal");
    setColor(opts.color || NAVY);
    doc.text(String(txt), x, y, { align: opts.align || "left", maxWidth: opts.maxWidth });
  };

  let y = 0;

  // ══════════════════════════════════════════════════════════════════════════
  // EN-TÊTE
  // ══════════════════════════════════════════════════════════════════════════
  // Bande rouge principale
  rect(0, 0, W, 28, RED);

  // Logo CAMRAIL
  if (logoB64) {
    try { doc.addImage(logoB64, "JPEG", M, 3, 38, 22); } catch (e) {}
  }

  // Titre en-tête
  text("RAPPORT DE PRÉDICTION OFFICIEL", M + 45, 12, { size: 14, bold: true, color: WHITE });
  text("Modèle Prédictif — Durées d'Occupation de Cantons", M + 45, 19, { size: 9, color: WHITE });

  // Bande navy sous l'en-tête
  rect(0, 28, W, 10, NAVY);
  text("CAMRAIL — Direction Générale — Conseil Technique Études & Développement", M, 34.5, { size: 8, color: WHITE });
  text("Programme Innovation Ferroviaire — v1.0", W - M, 34.5, { size: 8, color: [200, 200, 200], align: "right" });

  y = 46;

  // ══════════════════════════════════════════════════════════════════════════
  // INFORMATIONS DU RAPPORT
  // ══════════════════════════════════════════════════════════════════════════
  rect(M, y, CW, 22, LIGHT);
  doc.setDrawColor(...STEEL);
  doc.setLineWidth(0.3);
  doc.rect(M, y, CW, 22, "S");

  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", { day:"2-digit", month:"long", year:"numeric" });
  const heureStr = now.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });

  const infos = [
    ["Référence rapport", `RPT-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}-${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}`],
    ["Date de génération", `${dateStr} à ${heureStr}`],
    ["Généré par", user?.full_name || user?.username || "Cellule de Crise"],
    ["Rôle", user?.role || "CELLULE_CRISE"],
  ];

  infos.forEach(([label, val], i) => {
    const col = i < 2 ? M + 3 : M + CW / 2 + 3;
    const row = i < 2 ? y + 7 + (i * 7) : y + 7 + ((i - 2) * 7);
    text(label + " :", col, row, { size: 8, bold: true, color: STEEL });
    text(val, col + 38, row, { size: 8, color: NAVY });
  });

  y += 28;

  // ══════════════════════════════════════════════════════════════════════════
  // RÉSULTAT PRINCIPAL
  // ══════════════════════════════════════════════════════════════════════════
  rect(M, y, CW, 6, NAVY);
  text("▶  RÉSULTAT DE LA PRÉDICTION", M + 3, y + 4.3, { size: 9, bold: true, color: WHITE });
  y += 8;

  // Grande carte résultat
  rect(M, y, CW, 38, WHITE);
  doc.setDrawColor(...risqueColor);
  doc.setLineWidth(0.8);
  doc.rect(M, y, CW, 38, "S");
  // Bordure gauche colorée
  rect(M, y, 3, 38, risqueColor);

  // Durée centrale
  text("DURÉE PRÉDITE", M + 55, y + 10, { size: 9, color: SILVER, bold: false, align: "center" });
  text(`${result.duree_heures}h`, M + 55, y + 24, { size: 32, bold: true, color: risqueColor, align: "center" });
  text(`IC 85%  [${result.ic_min_heures}h – ${result.ic_max_heures}h]`, M + 55, y + 30, { size: 8, color: STEEL, align: "center" });

  // Séparateur vertical
  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(0.5);
  doc.line(M + 100, y + 4, M + 100, y + 34);

  // Niveau de risque + fiabilité
  rect(M + 103, y + 6, 30, 9, risqueColor);
  text(`RISQUE ${result.niveau_risque}`, M + 118, y + 12, { size: 9, bold: true, color: WHITE, align: "center" });
  text("Couverture IC", M + 118, y + 22, { size: 8, color: SILVER, align: "center" });
  text(`${result.fiabilite_pct}%`, M + 118, y + 30, { size: 18, bold: true, color: risqueColor, align: "center" });

  // Prédit par
  text(`Prédit par : ${result.predicted_by || user?.username}  |  à ${result.predicted_at?.slice(11,16) || heureStr}`, M + 5, y + 35, { size: 7, italic: true, color: SILVER });

  y += 44;

  // ══════════════════════════════════════════════════════════════════════════
  // HEURES DE REPRISE
  // ══════════════════════════════════════════════════════════════════════════
  if (result.heure_reprise) {
    rect(M, y, CW, 6, STEEL);
    text("▶  HEURE DE REPRISE DES CIRCULATIONS", M + 3, y + 4.3, { size: 9, bold: true, color: WHITE });
    y += 8;

    const heures = [
      { label: "AU PLUS TÔT",  val: result.heure_reprise_min, color: GREEN },
      { label: "PRÉDICTION",   val: result.heure_reprise,     color: RED },
      { label: "AU PLUS TARD", val: result.heure_reprise_max, color: ORANGE },
    ];

    const cardW = (CW - 6) / 3;
    heures.forEach((h, i) => {
      const cx = M + i * (cardW + 3);
      rect(cx, y, cardW, 22, LIGHT);
      doc.setDrawColor(...h.color);
      doc.setLineWidth(0.5);
      doc.rect(cx, y, cardW, 22, "S");
      text(h.label, cx + cardW / 2, y + 7, { size: 7, bold: true, color: h.color, align: "center" });
      text(h.val, cx + cardW / 2, y + 17, { size: 18, bold: true, color: h.color, align: "center" });
    });

    text(`Heure d'information PCC : ${heurePCC}`, M, y + 26, { size: 7, italic: true, color: SILVER });
    y += 32;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PARAMÈTRES DE L'INCIDENT
  // ══════════════════════════════════════════════════════════════════════════
  y += 2;
  rect(M, y, CW, 6, RED);
  text("▶  PARAMÈTRES DE L'INCIDENT SAISIS", M + 3, y + 4.3, { size: 9, bold: true, color: WHITE });
  y += 8;

  const coordLabels = { 1: "Nord", 2: "Sud", 3: "Est", 4: "Ouest" };
  const posLabels   = { 1: "Tête de rame", 2: "Milieu de rame", 3: "Queue de rame" };
  const etatLabels  = { 1: "Léger", 2: "Modéré", 3: "Grave" };
  const grueLabels  = { 1: "Proche (< 50km)", 2: "Moyenne distance", 3: "Loin (> 150km)" };
  const voieLabels  = { 1: "Principale", 2: "Secondaire" };

  const params = [
    ["Heure info PCC",          heurePCC || "—"],
    ["Nb véhicules déraillés",  inputs?.nbVehicules || "—"],
    ["Position dans la rame",   posLabels[inputs?.positionVehicule] || "—"],
    ["État de la voie",         etatLabels[inputs?.etatVoie] || "—"],
    ["Position des grues",      grueLabels[inputs?.positionGrues] || "—"],
    ["Type de voie",            voieLabels[inputs?.typeVoie] || "—"],
    ["Heure de l'incident",     `${inputs?.heureIncident}h00` || "—"],
    ["Coordination",            coordLabels[inputs?.coordination] || "—"],
  ];

  // Grille 2 colonnes
  params.forEach(([label, val], i) => {
    const col = i % 2 === 0 ? M : M + CW / 2 + 2;
    const row = y + Math.floor(i / 2) * 9 + 5;
    const bg = Math.floor(i / 2) % 2 === 0 ? LIGHT : WHITE;
    if (i % 2 === 0) rect(M, row - 4, CW, 9, bg);
    text(label + " :", col + 2, row, { size: 8, bold: true, color: STEEL });
    text(val, col + 55, row, { size: 8, color: NAVY });
  });

  y += Math.ceil(params.length / 2) * 9 + 8;

  // ══════════════════════════════════════════════════════════════════════════
  // CONTRIBUTIONS DES FEATURES
  // ══════════════════════════════════════════════════════════════════════════
  if (result.feature_contributions) {
    rect(M, y, CW, 6, NAVY);
    text("▶  CONTRIBUTION DES VARIABLES (FEATURE IMPORTANCE)", M + 3, y + 4.3, { size: 9, bold: true, color: WHITE });
    y += 8;

    const sorted = Object.entries(result.feature_contributions)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    sorted.forEach(([feat, val], i) => {
      const bg = i % 2 === 0 ? LIGHT : WHITE;
      rect(M, y + i * 7, CW, 7, bg);
      text(feat.replace(/_/g, " "), M + 3, y + i * 7 + 4.5, { size: 8, color: STEEL });
      const valStr = `${val > 0 ? "+" : ""}${val}h`;
      const valColor = val > 0 ? RED : GREEN;
      text(valStr, W - M - 3, y + i * 7 + 4.5, { size: 8, bold: true, color: valColor, align: "right" });

      // Barre de contribution
      const maxBar = 30;
      const barW = Math.min(Math.abs(val) * 500, maxBar);
      const barColor = val > 0 ? RED : GREEN;
      rect(W - M - 38, y + i * 7 + 1.5, barW, 3, barColor);
    });

    y += sorted.length * 7 + 6;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PIED DE PAGE
  // ══════════════════════════════════════════════════════════════════════════
  const pageH = 297;
  rect(0, pageH - 18, W, 18, NAVY);
  doc.setDrawColor(...RED);
  doc.setLineWidth(1);
  doc.line(0, pageH - 18, W, pageH - 18);

  text("CAMRAIL — Gare Centrale Douala-Bessengue — BP 766 Douala — Cameroun", W / 2, pageH - 11, { size: 7, color: WHITE, align: "center" });
  text("Tél : 233 50 26 00 / Fax : 233 50 26 04 — www.camrail.net — Une concession de AGL", W / 2, pageH - 6, { size: 7, color: [180, 180, 180], align: "center" });

  // Note confidentialité
  text("Document officiel CAMRAIL — Usage interne exclusif — Ne pas diffuser sans autorisation", W / 2, pageH - 21, { size: 6, italic: true, color: SILVER, align: "center" });

  // ── Télécharger ───────────────────────────────────────────────────────────
  const filename = `CAMRAIL_Prediction_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}h${String(now.getMinutes()).padStart(2,"0")}.pdf`;
  doc.save(filename);
  return filename;
}
