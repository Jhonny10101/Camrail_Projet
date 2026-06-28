import { useState, useEffect, useCallback } from "react";
import { generatePredictionPDF } from "./PdfExport";
import { CAMRAIL_LOGO_B64 } from "./camrailLogo";

const C = {
  red: "#CC0000", navy: "#0A1628", steel: "#1E3A5F",
  silver: "#8B9BB4", light: "#EEF2F7", white: "#FFFFFF",
  green: "#1A7A4A", orange: "#E07B00",
};

const API_BASE = Process.env.REACT_APP_API || "http://localhost:8000";

// ─── API helpers ────────────────────────────────────────────────
async function apiCall(endpoint, options = {}, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { headers, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Erreur ${res.status}`);
  }
  return res.json();
}

async function apiLogin(username, password) {
  const form = new URLSearchParams({ username, password });
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Identifiants incorrects");
  }
  return res.json();
}

// ─── Composants UI ──────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{ background: C.white, borderRadius: 12, padding: "20px 24px",
      boxShadow: "0 2px 12px rgba(10,22,40,0.08)", border: `1px solid ${C.light}`, ...style }}>
      {children}
    </div>
  );
}

function Badge({ color, children }) {
  return (
    <span style={{ background: color + "22", color, border: `1px solid ${color}55`,
      padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
      {children}
    </span>
  );
}

function Btn({ onClick, disabled, color = C.red, children, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "11px 20px", background: disabled ? C.silver : color,
      color: C.white, border: "none", borderRadius: 9, fontSize: 14, fontWeight: 800,
      cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.2s",
      boxShadow: disabled ? "none" : `0 3px 12px ${color}44`, ...style,
    }}>
      {children}
    </button>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.steel,
        marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "10px 13px", borderRadius: 8,
          border: `1.5px solid ${C.light}`, fontSize: 14, color: C.navy,
          outline: "none", boxSizing: "border-box" }} />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.steel,
        marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
      <select value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", padding: "10px 13px", borderRadius: 8,
          border: `1.5px solid ${C.light}`, fontSize: 14, color: C.navy,
          outline: "none", background: C.white, cursor: "pointer" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function DurationBar({ value, max = 50, color }) {
  return (
    <div style={{ background: C.light, borderRadius: 6, height: 8, overflow: "hidden", marginTop: 4 }}>
      <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: "100%",
        background: color, borderRadius: 6, transition: "width 0.6s ease" }} />
    </div>
  );
}

function Alert({ type, message }) {
  const colors = { success: C.green, error: C.red, info: C.steel };
  const color = colors[type] || C.steel;
  return (
    <div style={{ background: color + "11", border: `1px solid ${color}44`, borderRadius: 8,
      padding: "10px 14px", fontSize: 13, color, marginBottom: 12 }}>
      {message}
    </div>
  );
}

// ─── Page Login ─────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const handleLogin = async () => {
    if (!username || !password) return setError("Renseignez vos identifiants");
    setLoading(true); setError(null);
    try {
      const data = await apiLogin(username, password);
      onLogin(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.navy, display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter','Segoe UI',sans-serif" }}>

      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ background: C.red, borderRadius: 12, padding: "10px 20px",
          fontWeight: 900, color: C.white, fontSize: 28, letterSpacing: 2, display: "inline-block" }}>
          CAMRAIL
        </div>
        <div style={{ color: C.silver, marginTop: 10, fontSize: 14 }}>
          Modèle Prédictif — Durées d'Occupation de Cantons
        </div>
      </div>

      <Card style={{ width: 360, padding: 32 }}>
        <h2 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 800, color: C.navy, textAlign: "center" }}>
          🔐 Connexion Intranet
        </h2>

        {error && <Alert type="error" message={error} />}

        <Field label="Identifiant" value={username} onChange={setUsername} placeholder="ex: cellule_crise" />
        <Field label="Mot de passe" value={password} onChange={setPassword} type="password" placeholder="••••••••" />

        <Btn onClick={handleLogin} disabled={loading} style={{ width: "100%", marginTop: 8, padding: 13, fontSize: 15 }}>
          {loading ? "⏳ Connexion..." : "SE CONNECTER"}
        </Btn>

        <div style={{ marginTop: 20, padding: 14, background: C.light, borderRadius: 8, fontSize: 12, color: C.steel }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Comptes de démonstration :</div>
          {[
            ["admin",         "Admin@Camrail2026", "ADMIN"],
            ["cellule_crise", "Crise@2026!",       "CELLULE_CRISE"],
            ["dmat",          "Dmat@2026!",         "OPERATEUR"],
          ].map(([u, p, r]) => (
            <div key={u} style={{ display: "flex", justifyContent: "space-between",
              padding: "4px 0", borderBottom: `1px solid ${C.light}`, cursor: "pointer" }}
              onClick={() => { setUsername(u); setPassword(p); }}>
              <span style={{ fontWeight: 600 }}>{u}</span>
              <Badge color={r === "ADMIN" ? C.red : r === "CELLULE_CRISE" ? C.navy : C.steel}>{r}</Badge>
            </div>
          ))}
          <div style={{ marginTop: 6, fontSize: 11, color: C.silver }}>Cliquer pour remplir automatiquement</div>
        </div>
      </Card>

      <div style={{ color: C.silver, fontSize: 11, marginTop: 24 }}>
        Programme Innovation Ferroviaire · v1.0 · 15/06/2026
      </div>
    </div>
  );
}

// ─── Header connecté ─────────────────────────────────────────────
function Header({ user, onLogout, apiStatus }) {
  const roleColors = { ADMIN: C.red, CELLULE_CRISE: C.navy, OPERATEUR: C.steel };
  return (
    <div style={{ background: C.navy, padding: "0 24px", boxShadow: "0 2px 16px rgba(0,0,0,0.3)" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "flex",
        alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: C.red, borderRadius: 8, padding: "6px 12px",
            fontWeight: 900, color: C.white, fontSize: 18, letterSpacing: 1 }}>CAMRAIL</div>
          <div>
            <div style={{ color: C.white, fontSize: 14, fontWeight: 700 }}>Modèle Prédictif</div>
            <div style={{ color: C.silver, fontSize: 11 }}>Durées d'Occupation de Cantons</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Badge color={apiStatus === "ok" ? C.green : C.red}>
            {apiStatus === "ok" ? "● API CONNECTÉE" : "● API HORS LIGNE"}
          </Badge>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ color: C.white, fontSize: 13, fontWeight: 700 }}>{user.full_name}</span>
            <Badge color={roleColors[user.role] || C.steel}>{user.role}</Badge>
          </div>
          <button onClick={onLogout} style={{ background: "transparent", border: `1px solid ${C.silver}`,
            color: C.silver, padding: "6px 12px", borderRadius: 6, fontSize: 12,
            cursor: "pointer", fontWeight: 600 }}>
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App principale ──────────────────────────────────────────────
export default function CamrailApp() {
  const [auth, setAuth]           = useState(null); // { access_token, user }
  const [activeTab, setActiveTab] = useState("prediction");
  const [apiStatus, setApiStatus] = useState("unknown");

  // Prédiction
  const [inputs, setInputs] = useState({
    nbVehicules: 2, positionVehicule: 1, etatVoie: 2,
    positionGrues: 2, typeVoie: 1, heureIncident: 10, coordination: 1,
  });
  const [heurePCC, setHeurePCC] = useState("08:00");
  const [result, setResult]     = useState(null);
  const [predLoading, setPredLoading] = useState(false);
  const [predError, setPredError]     = useState(null);

  // Historique
  const [histData, setHistData]     = useState(null);
  const [histLoading, setHistLoading] = useState(false);
  const [coordFiltre, setCoordFiltre] = useState(null);

  // Modèle
  const [modelInfo, setModelInfo]   = useState(null);
  const [retraining, setRetraining] = useState(false);
  const [retrainMsg, setRetrainMsg] = useState(null);

  // RET
  const [retForm, setRetForm] = useState({
    date_incident: new Date().toISOString().split("T")[0],
    heure_incident: 10, coordination: 1, type_voie: 1,
    nb_vehicules_derailles: 2, position_vehicule: 1,
    etat_voie: 2, position_grues: 2, duree_reelle_heures: 20,
    faits_saillants: "", cause_probable: "",
  });
  const [retLoading, setRetLoading] = useState(false);
  const [retMsg, setRetMsg]         = useState(null);

  // Admin
  const [users, setUsers]       = useState([]);
  const [newUser, setNewUser]   = useState({ username: "", full_name: "", password: "", role: "OPERATEUR", coordination: "" });
  const [userMsg, setUserMsg]   = useState(null);

  const token = auth?.access_token;
  const user  = auth?.user;

  const can = (perm) => {
    const perms = {
      ADMIN:         ["predict","ret","historique","modele","admin"],
      CELLULE_CRISE: ["predict","ret","historique","modele"],
      OPERATEUR:     ["historique","modele"],
    };
    return perms[user?.role]?.includes(perm) || false;
  };

  // Vérifier statut API
  useEffect(() => {
    fetch(`${API_BASE}/`).then(() => setApiStatus("ok")).catch(() => setApiStatus("error"));
  }, []);

  // Charger données selon onglet actif
  useEffect(() => {
    if (!token) return;
    if (activeTab === "historique") {
      setHistLoading(true);
      apiCall(`/historique${coordFiltre ? `?coordination=${coordFiltre}` : ""}`, {}, token)
        .then(setHistData).catch(() => setHistData(null))
        .finally(() => setHistLoading(false));
    }
    if (activeTab === "modele") {
      apiCall("/modele/info", {}, token).then(setModelInfo).catch(() => setModelInfo(null));
    }
    if (activeTab === "admin" && user?.role === "ADMIN") {
      apiCall("/admin/users", {}, token).then(setUsers).catch(() => setUsers([]));
    }
  }, [activeTab, token, coordFiltre]);

  const handleLogin = (data) => {
    setAuth(data);
    setActiveTab(data.user.role === "OPERATEUR" ? "historique" : "prediction");
  };

  const handleLogout = () => { setAuth(null); setResult(null); };

  const handlePredict = async () => {
    setPredLoading(true); setPredError(null); setResult(null);
    try {
      const body = {
        nb_vehicules_derailles: inputs.nbVehicules,
        position_vehicule: inputs.positionVehicule,
        etat_voie: inputs.etatVoie,
        position_grues: inputs.positionGrues,
        type_voie: inputs.typeVoie,
        heure_incident: inputs.heureIncident,
        coordination: inputs.coordination,
        heure_information_pcc: heurePCC || null,
      };
      const data = await apiCall("/predict", { method: "POST", body: JSON.stringify(body) }, token);
      setResult(data);
    } catch (e) { setPredError(e.message); }
    finally { setPredLoading(false); }
  };

  const handleRetSubmit = async () => {
    setRetLoading(true); setRetMsg(null);
    try {
      const resp = await apiCall("/ret/submit", { method: "POST", body: JSON.stringify(retForm) }, token);
      setRetMsg({ type: "success", message: `✅ ${resp.message}` });
    } catch (e) { setRetMsg({ type: "error", message: `❌ ${e.message}`}); }
    finally { setRetLoading(false); }
  };

  const handleRetrain = async () => {
    setRetraining(true); setRetrainMsg(null);
    try {
      const resp = await apiCall("/modele/retrain", { method: "POST" }, token);
      setRetrainMsg({ type: "success", message: `✅ ${resp.message}` });
      apiCall("/modele/info", {}, token).then(setModelInfo).catch(() => {});
    } catch (e) { setRetrainMsg({ type: "error", message: `❌ ${e.message}` }); }
    finally { setRetraining(false); }
  };

  const handleCreateUser = async () => {
    try {
      const resp = await apiCall("/admin/users", { method: "POST", body: JSON.stringify(newUser) }, token);
      setUserMsg({ type: "success", message: `✅ ${resp.message}` });
      apiCall("/admin/users", {}, token).then(setUsers);
      setNewUser({ username: "", full_name: "", password: "", role: "OPERATEUR", coordination: "" });
    } catch (e) { setUserMsg({ type: "error", message: `❌ ${e.message}` }); }
  };

  const handleDeleteUser = async (username) => {
    if (!window.confirm(`Désactiver l'utilisateur "${username}" ?`)) return;
    try {
      await apiCall(`/admin/users/${username}`, { method: "DELETE" }, token);
      setUserMsg({ type: "success", message: `✅ Utilisateur "${username}" désactivé` });
      apiCall("/admin/users", {}, token).then(setUsers);
    } catch (e) { setUserMsg({ type: "error", message: `❌ ${e.message}` }); }
  };

  const si = (k) => (v) => setInputs(p => ({ ...p, [k]: v }));
  const sf = (k) => (v) => setRetForm(p => ({ ...p, [k]: v }));
  const sn = (k) => (v) => setNewUser(p => ({ ...p, [k]: v }));

  const getRisque = (d) => d < 10 ? { label:"FAIBLE", color:C.green } : d < 20 ? { label:"MODÉRÉ", color:C.orange } : { label:"ÉLEVÉ", color:C.red };

  // ── Ecran de connexion ─────────────────────────────────────────
  if (!auth) return <LoginPage onLogin={handleLogin} />;

  const tabs = [
    can("predict")    && { key:"prediction", label:"🎯 Prédiction" },
    can("ret")        && { key:"ret",        label:"📝 Collecte RET" },
    can("historique") && { key:"historique", label:"📊 Historiques" },
    can("modele")     && { key:"modele",     label:"🤖 Modèle ML" },
    can("admin")      && { key:"admin",      label:"⚙️ Administration" },
  ].filter(Boolean);

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", background: C.light, minHeight: "100vh" }}>
      <Header user={user} onLogout={handleLogout} apiStatus={apiStatus} />

      {/* Tabs */}
      <div style={{ background: C.white, borderBottom: `2px solid ${C.light}` }}>
        <div style={{ maxWidth: 980, margin: "0 auto", display: "flex" }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: "13px 20px", border: "none", background: "none", cursor: "pointer",
                fontSize: 14, fontWeight: 700,
                color: activeTab === tab.key ? C.red : C.silver,
                borderBottom: activeTab === tab.key ? `3px solid ${C.red}` : "3px solid transparent" }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>

        {/* ── PRÉDICTION ── */}
        {activeTab === "prediction" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Card>
              <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800 }}>📋 Paramètres de l'Incident</h3>
              <Field label="Heure info PCC" value={heurePCC} onChange={setHeurePCC} type="time" />
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.steel, marginBottom: 5, textTransform: "uppercase" }}>Nb véhicules déraillés</label>
                <input type="number" min={1} max={30} value={inputs.nbVehicules}
                  onChange={e => si("nbVehicules")(Number(e.target.value))}
                  style={{ width: "100%", padding: "10px 13px", borderRadius: 8, border: `1.5px solid ${C.light}`, fontSize: 14, color: C.navy, outline: "none", boxSizing: "border-box" }} />
              </div>
              <Select label="Position dans la rame" value={inputs.positionVehicule} onChange={si("positionVehicule")}
                options={[{value:1,label:"Tête"},{value:2,label:"Milieu"},{value:3,label:"Queue"}]} />
              <Select label="État de la voie" value={inputs.etatVoie} onChange={si("etatVoie")}
                options={[{value:1,label:"Léger"},{value:2,label:"Modéré"},{value:3,label:"Grave"}]} />
              <Select label="Position des grues" value={inputs.positionGrues} onChange={si("positionGrues")}
                options={[{value:1,label:"Proche < 50km"},{value:2,label:"Moyen"},{value:3,label:"Loin > 150km"}]} />
              <Select label="Coordination" value={inputs.coordination} onChange={si("coordination")}
                options={[{value:1,label:"Nord"},{value:2,label:"Sud"},{value:3,label:"Est"},{value:4,label:"Ouest"}]} />
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.steel, marginBottom: 5, textTransform: "uppercase" }}>Heure incident (0-23h)</label>
                <input type="number" min={0} max={23} value={inputs.heureIncident}
                  onChange={e => si("heureIncident")(Number(e.target.value))}
                  style={{ width: "100%", padding: "10px 13px", borderRadius: 8, border: `1.5px solid ${C.light}`, fontSize: 14, color: C.navy, outline: "none", boxSizing: "border-box" }} />
              </div>
              {predError && <Alert type="error" message={predError} />}
              <Btn onClick={handlePredict} disabled={predLoading} style={{ width: "100%", padding: 13, fontSize: 15 }}>
                {predLoading ? "⏳ Calcul en cours..." : "🚀 LANCER LA PRÉDICTION"}
              </Btn>
            </Card>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {!result && !predLoading && (
                <Card style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🚂</div>
                  <p style={{ color: C.silver, textAlign: "center", fontSize: 14, lineHeight: 1.6 }}>
                    Renseignez les paramètres et lancez la prédiction.<br />
                    <span style={{ fontSize: 12 }}>Backend FastAPI + Random Forest + JWT</span>
                  </p>
                </Card>
              )}
              {predLoading && (
                <Card style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
                  <p style={{ color: C.steel, fontWeight: 700 }}>Inférence Random Forest...</p>
                </Card>
              )}
              {result && !predLoading && (() => {
                const risque = getRisque(result.duree_heures);
                return (
                  <>
                    <Card style={{ borderLeft: `5px solid ${risque.color}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.silver, textTransform: "uppercase" }}>Durée prédite</div>
                          <div style={{ fontSize: 44, fontWeight: 900, color: C.navy }}>{result.duree_heures}h</div>
                          <div style={{ fontSize: 12, color: C.silver }}>IC 85% : [{result.ic_min_heures}h – {result.ic_max_heures}h]</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <Badge color={risque.color}>RISQUE {result.niveau_risque}</Badge>
                          <div style={{ marginTop: 10, fontSize: 11, color: C.silver }}>Couverture IC</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: risque.color }}>{result.fiabilite_pct}%</div>
                        </div>
                      </div>
                      <DurationBar value={result.duree_heures} color={risque.color} />
                      <div style={{ marginTop: 10, fontSize: 12, color: C.silver }}>
                        Prédit par <b>{result.predicted_by}</b> à {result.predicted_at?.slice(11,16)}
                      </div>
                    </Card>

                    {result.heure_reprise && (
                      <Card>
                        <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800 }}>🕐 Heure de Reprise</h4>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                          {[
                            { label: "Au plus tôt", value: result.heure_reprise_min, color: C.green },
                            { label: "Prédiction",  value: result.heure_reprise,     color: C.red },
                            { label: "Au plus tard",value: result.heure_reprise_max, color: C.orange },
                          ].map(item => (
                            <div key={item.label} style={{ background: item.color+"11", borderRadius: 10,
                              padding: "12px 8px", textAlign: "center", border: `1.5px solid ${item.color}33` }}>
                              <div style={{ fontSize: 10, color: item.color, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{item.label}</div>
                              <div style={{ fontSize: 26, fontWeight: 900, color: item.color }}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}

                    <Card>
                      <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800 }}>📌 Contributions des features</h4>
                      {Object.entries(result.feature_contributions || {})
                        .sort((a,b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0,6)
                        .map(([feat, val]) => (
                          <div key={feat} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${C.light}` }}>
                            <span style={{ fontSize: 12, color: C.steel }}>{feat.replace(/_/g," ")}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: val > 0 ? C.red : C.green }}>
                              {val > 0 ? "+" : ""}{val}h
                            </span>
                          </div>
                        ))}
                    </Card>

                    {/* ── Bouton Export PDF ── */}
                    <Btn
                      onClick={() => {
                        try {
                          const filename = generatePredictionPDF({
                            result,
                            inputs,
                            heurePCC,
                            user,
                            logoB64: CAMRAIL_LOGO_B64,
                          });
                          alert(`✅ Rapport téléchargé : ${filename}`);
                        } catch(e) {
                          alert("❌ Erreur PDF : " + e.message);
                        }
                      }}
                      color={C.navy}
                      style={{ width: "100%", padding: "13px", fontSize: 15 }}
                    >
                      📄 TÉLÉCHARGER LE RAPPORT PDF OFFICIEL
                    </Btn>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── RET ── */}
        {activeTab === "ret" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Card>
              <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800 }}>📝 Saisie RET Post-Incident</h3>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: C.silver }}>Fonctionnalité 2 — Collecte des données après réouverture de la voie</p>
              <Field label="Date incident" value={retForm.date_incident} onChange={sf("date_incident")} type="date" />
              <div style={{ marginBottom: 14 }}>
                <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.steel, marginBottom:5, textTransform:"uppercase" }}>Heure incident</label>
                <input type="number" min={0} max={23} value={retForm.heure_incident} onChange={e => sf("heure_incident")(Number(e.target.value))}
                  style={{ width:"100%", padding:"10px 13px", borderRadius:8, border:`1.5px solid ${C.light}`, fontSize:14, color:C.navy, outline:"none", boxSizing:"border-box" }} />
              </div>
              <Select label="Coordination" value={retForm.coordination} onChange={sf("coordination")}
                options={[{value:1,label:"Nord"},{value:2,label:"Sud"},{value:3,label:"Est"},{value:4,label:"Ouest"}]} />
              <Select label="Type voie" value={retForm.type_voie} onChange={sf("type_voie")}
                options={[{value:1,label:"Principale"},{value:2,label:"Secondaire"}]} />
              <div style={{ marginBottom: 14 }}>
                <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.steel, marginBottom:5, textTransform:"uppercase" }}>Nb véhicules déraillés</label>
                <input type="number" min={1} value={retForm.nb_vehicules_derailles} onChange={e => sf("nb_vehicules_derailles")(Number(e.target.value))}
                  style={{ width:"100%", padding:"10px 13px", borderRadius:8, border:`1.5px solid ${C.light}`, fontSize:14, color:C.navy, outline:"none", boxSizing:"border-box" }} />
              </div>
              <Select label="Position dans la rame" value={retForm.position_vehicule} onChange={sf("position_vehicule")}
                options={[{value:1,label:"Tête"},{value:2,label:"Milieu"},{value:3,label:"Queue"}]} />
              <Select label="État de la voie" value={retForm.etat_voie} onChange={sf("etat_voie")}
                options={[{value:1,label:"Léger"},{value:2,label:"Modéré"},{value:3,label:"Grave"}]} />
              <Select label="Position des grues" value={retForm.position_grues} onChange={sf("position_grues")}
                options={[{value:1,label:"Proche"},{value:2,label:"Moyen"},{value:3,label:"Loin"}]} />
              <div style={{ marginBottom: 14 }}>
                <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.steel, marginBottom:5, textTransform:"uppercase" }}>Durée réelle (heures)</label>
                <input type="number" step="0.5" min="0.5" value={retForm.duree_reelle_heures} onChange={e => sf("duree_reelle_heures")(parseFloat(e.target.value))}
                  style={{ width:"100%", padding:"10px 13px", borderRadius:8, border:`1.5px solid ${C.light}`, fontSize:14, color:C.navy, outline:"none", boxSizing:"border-box" }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.steel, marginBottom:5, textTransform:"uppercase" }}>Faits saillants</label>
                <textarea rows={2} value={retForm.faits_saillants} onChange={e => sf("faits_saillants")(e.target.value)}
                  style={{ width:"100%", padding:"10px 13px", borderRadius:8, border:`1.5px solid ${C.light}`, fontSize:13, color:C.navy, outline:"none", resize:"vertical", boxSizing:"border-box" }}
                  placeholder="Description..." />
              </div>
              <Field label="Cause probable" value={retForm.cause_probable} onChange={sf("cause_probable")} placeholder="Ex: Rupture de rail..." />
              {retMsg && <Alert type={retMsg.type} message={retMsg.message} />}
              <Btn onClick={handleRetSubmit} disabled={retLoading} color={C.navy} style={{ width:"100%", padding:13, fontSize:15 }}>
                {retLoading ? "⏳ Enregistrement..." : "💾 SOUMETTRE LE RET"}
              </Btn>
            </Card>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <Card style={{ background: C.navy }}>
                <h4 style={{ margin:"0 0 10px", fontSize:14, fontWeight:800, color:C.white }}>ℹ️ Fonctionnalité 2 — Cahier des charges</h4>
                <p style={{ margin:0, fontSize:13, color:C.silver, lineHeight:1.7 }}>
                  Chaque RET soumis est enregistré et automatiquement pris en compte lors du prochain réentraînement du modèle. Accès réservé à la <b style={{ color:C.white }}>Cellule de Crise</b>.
                </p>
              </Card>
              <Card>
                <h4 style={{ margin:"0 0 10px", fontSize:14, fontWeight:800 }}>✅ Checklist RET</h4>
                {["Date et heure précises","Coordination concernée","Type de voie","Nombre exact de véhicules","Position dans la rame","État de la voie (inspection)","Disponibilité des grues","Durée réelle jusqu'à réouverture","Faits saillants documentés","Cause probable identifiée"]
                  .map((item, i) => (
                    <div key={i} style={{ display:"flex", gap:8, padding:"5px 0", fontSize:13, color:C.steel, borderBottom:`1px solid ${C.light}` }}>
                      <span style={{ color:C.green, fontWeight:700 }}>✓</span>{item}
                    </div>
                  ))}
              </Card>
            </div>
          </div>
        )}

        {/* ── HISTORIQUES ── */}
        {activeTab === "historique" && (
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:20 }}>
            <Card>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <h3 style={{ margin:0, fontSize:16, fontWeight:800 }}>Incidents 2022–2026</h3>
                <select value={coordFiltre || "0"} onChange={e => setCoordFiltre(e.target.value === "0" ? null : Number(e.target.value))}
                  style={{ padding:"6px 10px", borderRadius:6, border:`1.5px solid ${C.light}`, fontSize:13, color:C.navy }}>
                  <option value="0">Toutes coordinations</option>
                  {[1,2,3,4].map(c => <option key={c} value={c}>{["","Nord","Sud","Est","Ouest"][c]}</option>)}
                </select>
              </div>
              {histLoading && <div style={{ textAlign:"center", padding:30, color:C.silver }}>⏳ Chargement...</div>}
              {histData && (
                <>
                  <div style={{ display:"flex", justifyContent:"space-around", padding:"16px 0", borderBottom:`1px solid ${C.light}` }}>
                    {[
                      { label:"Total incidents", value:histData.stats_globales.total_incidents, color:C.red },
                      { label:"Durée moyenne",   value:`${histData.stats_globales.duree_moyenne}h`, color:C.navy },
                      { label:"Durée max",       value:`${histData.stats_globales.duree_max}h`, color:C.orange },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign:"center" }}>
                        <div style={{ fontSize:26, fontWeight:900, color:s.color }}>{s.value}</div>
                        <div style={{ fontSize:11, color:C.silver }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ maxHeight:300, overflowY:"auto", marginTop:16 }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                      <thead>
                        <tr style={{ background:C.light }}>
                          {["Période","Incidents","Moy.","Max","Min"].map(h => (
                            <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:C.steel, textTransform:"uppercase", position:"sticky", top:0, background:C.light }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {histData.serie_mensuelle.map((d, i) => (
                          <tr key={i} style={{ borderBottom:`1px solid ${C.light}` }}>
                            <td style={{ padding:"8px 12px", fontWeight:600 }}>{d.mois_label}</td>
                            <td style={{ padding:"8px 12px" }}>{d.nb_incidents}</td>
                            <td style={{ padding:"8px 12px", color:d.duree_moyenne > 25 ? C.red : C.green, fontWeight:700 }}>{d.duree_moyenne}h</td>
                            <td style={{ padding:"8px 12px", color:C.orange }}>{d.duree_max}h</td>
                            <td style={{ padding:"8px 12px", color:C.green }}>{d.duree_min}h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {histData && (
                <Card>
                  <h4 style={{ margin:"0 0 12px", fontSize:14, fontWeight:800 }}>Par Coordination</h4>
                  {Object.entries(histData.stats_globales.par_coordination).map(([coord, nb]) => (
                    <div key={coord} style={{ marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontSize:13, fontWeight:600 }}>{["","Nord","Sud","Est","Ouest"][coord]}</span>
                        <span style={{ fontSize:13, fontWeight:700, color:C.red }}>{nb}</span>
                      </div>
                      <DurationBar value={nb} max={Math.max(...Object.values(histData.stats_globales.par_coordination))+5} color={C.red} />
                    </div>
                  ))}
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ── MODÈLE ── */}
        {activeTab === "modele" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
            <Card>
              <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:800 }}>🤖 Architecture du Modèle</h3>
              {[
                { step:"01", label:"Collecte RET",    desc:"CSV + API /ret/submit authentifiée JWT", color:C.steel },
                { step:"02", label:"Preprocessing",   desc:"Pandas — encodage, mois, saison", color:C.steel },
                { step:"03", label:"Random Forest",   desc:"200 arbres, OOB, max_depth=12", color:C.red },
                { step:"04", label:"Quantile GBR",    desc:"alpha 0.075 / 0.925 → IC 85%", color:C.navy },
                { step:"05", label:"Auto-retrain",    desc:"POST /modele/retrain (ADMIN)", color:C.green },
                { step:"06", label:"Docker + Nginx",  desc:"Intranet CAMRAIL — HTTPS", color:C.orange },
              ].map(item => (
                <div key={item.step} style={{ display:"flex", gap:14, marginBottom:12, padding:"11px", background:C.light, borderRadius:10 }}>
                  <div style={{ background:item.color, color:C.white, borderRadius:8, width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900, flexShrink:0 }}>{item.step}</div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{item.label}</div>
                    <div style={{ fontSize:12, color:C.silver, marginTop:2 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </Card>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {modelInfo ? (
                <>
                  <Card>
                    <h4 style={{ margin:"0 0 12px", fontSize:14, fontWeight:800 }}>📈 Métriques réelles</h4>
                    {[
                      ["MAE",             `${modelInfo.metrics.mae} h`],
                      ["RMSE",            `${modelInfo.metrics.rmse} h`],
                      ["R² train",        modelInfo.metrics.r2_train],
                      ["R² CV (5-fold)",  `${modelInfo.metrics.r2_cv_mean} ± ${modelInfo.metrics.r2_cv_std}`],
                      ["OOB Score",       modelInfo.metrics.oob_score],
                      ["IC 85% couverture",`${(modelInfo.metrics.ic85_coverage*100).toFixed(1)}%`],
                      ["Echantillons",    modelInfo.metrics.n_samples],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${C.light}` }}>
                        <span style={{ fontSize:13, color:C.steel }}>{label}</span>
                        <span style={{ fontSize:13, fontWeight:800, color:C.navy }}>{value}</span>
                      </div>
                    ))}
                  </Card>
                  <Card>
                    <h4 style={{ margin:"0 0 12px", fontSize:14, fontWeight:800 }}>⚙️ Feature Importance</h4>
                    {modelInfo.feature_importance.map((item, i) => (
                      <div key={i} style={{ marginBottom:8 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize:12, color:C.steel }}>{item.feature.replace(/_/g," ")}</span>
                          <span style={{ fontSize:12, fontWeight:700 }}>{(item.importance*100).toFixed(1)}%</span>
                        </div>
                        <DurationBar value={item.importance*100} max={45} color={i===0?C.red:C.steel} />
                      </div>
                    ))}
                  </Card>
                </>
              ) : <Card style={{ textAlign:"center", padding:30 }}><div style={{ color:C.silver }}>⏳ Chargement...</div></Card>}

              {can("admin") && (
                <Card style={{ background:C.navy }}>
                  <h4 style={{ margin:"0 0 10px", fontSize:13, fontWeight:800, color:C.white }}>🔄 Réentraîner le modèle</h4>
                  <p style={{ margin:"0 0 12px", fontSize:12, color:C.silver }}>Intègre tous les nouveaux RET soumis. Réservé ADMIN.</p>
                  {retrainMsg && <Alert type={retrainMsg.type} message={retrainMsg.message} />}
                  <Btn onClick={handleRetrain} disabled={retraining} color={C.green} style={{ width:"100%" }}>
                    {retraining ? "⏳ Réentraînement..." : "🔄 LANCER LE RÉENTRAÎNEMENT"}
                  </Btn>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ── ADMINISTRATION ── */}
        {activeTab === "admin" && user?.role === "ADMIN" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
            <Card>
              <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:800 }}>👥 Utilisateurs du système</h3>
              {userMsg && <Alert type={userMsg.type} message={userMsg.message} />}
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ background:C.light }}>
                    {["Utilisateur","Nom","Rôle","Action"].map(h => (
                      <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:11, fontWeight:700, color:C.steel, textTransform:"uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={i} style={{ borderBottom:`1px solid ${C.light}` }}>
                      <td style={{ padding:"9px 10px", fontWeight:700, fontFamily:"monospace" }}>{u.username}</td>
                      <td style={{ padding:"9px 10px", fontSize:12 }}>{u.full_name}</td>
                      <td style={{ padding:"9px 10px" }}>
                        <Badge color={u.role==="ADMIN"?C.red:u.role==="CELLULE_CRISE"?C.navy:C.steel}>{u.role}</Badge>
                      </td>
                      <td style={{ padding:"9px 10px" }}>
                        {u.username !== user.username && (
                          <button onClick={() => handleDeleteUser(u.username)}
                            style={{ background:C.red+"11", color:C.red, border:`1px solid ${C.red}44`, borderRadius:6, padding:"3px 8px", fontSize:11, cursor:"pointer", fontWeight:700 }}>
                            Désactiver
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card>
              <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:800 }}>➕ Créer un utilisateur</h3>
              <Field label="Identifiant" value={newUser.username} onChange={sn("username")} placeholder="ex: coord_est" />
              <Field label="Nom complet" value={newUser.full_name} onChange={sn("full_name")} placeholder="ex: Coordination Est" />
              <Field label="Mot de passe" value={newUser.password} onChange={sn("password")} type="password" />
              <Select label="Rôle" value={newUser.role} onChange={sn("role")}
                options={[{value:"OPERATEUR",label:"OPERATEUR (lecture)"},{value:"CELLULE_CRISE",label:"CELLULE_CRISE (écriture)"},{value:"ADMIN",label:"ADMIN (tout)"}]} />
              <Field label="Coordination (optionnel)" value={newUser.coordination} onChange={sn("coordination")} placeholder="Nord / Sud / Est / Ouest" />
              <Btn onClick={handleCreateUser} color={C.navy} style={{ width:"100%", padding:13 }}>
                ➕ CRÉER L'UTILISATEUR
              </Btn>

              <div style={{ marginTop:20, padding:14, background:C.light, borderRadius:8, fontSize:12, color:C.steel }}>
                <div style={{ fontWeight:700, marginBottom:8 }}>Matrice des permissions</div>
                {[
                  ["ADMIN",         "Tout + gestion utilisateurs"],
                  ["CELLULE_CRISE", "Prédiction + RET + historiques"],
                  ["OPERATEUR",     "Historiques + info modèle (lecture)"],
                ].map(([role, desc]) => (
                  <div key={role} style={{ display:"flex", gap:8, marginBottom:6, alignItems:"flex-start" }}>
                    <Badge color={role==="ADMIN"?C.red:role==="CELLULE_CRISE"?C.navy:C.steel}>{role}</Badge>
                    <span style={{ fontSize:11, marginTop:2 }}>{desc}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

      </div>

      <div style={{ background:C.navy, padding:"14px 24px", marginTop:32, textAlign:"center" }}>
        <p style={{ margin:0, color:C.silver, fontSize:12 }}>
          CAMRAIL · FastAPI + JWT + Scikit-learn + Docker + Nginx · Programme Innovation Ferroviaire · v1.0
        </p>
      </div>
    </div>
  );
}
