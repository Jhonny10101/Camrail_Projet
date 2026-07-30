import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { generatePredictionPDF } from "./PdfExport";
import { CAMRAIL_LOGO_B64 } from "./camrailLogo";
import { Icon, IconLabel } from "./icons";
import { t as tr } from "./i18n";

function BrandLogo({ height = 36, style = {} }) {
  return (
    <img
      src={CAMRAIL_LOGO_B64}
      alt="CAMRAIL"
      height={height}
      style={{
        height,
        width: "auto",
        display: "block",
        objectFit: "contain",
        ...style,
      }}
    />
  );
}

// ─── Theme ───────────────────────────────────────────────────────
const C = {
  red: "#C8102E", navy: "#0A1628", steel: "#2A4A6F",
  silver: "#7A8FA8", mist: "#E8EEF5", white: "#FFFFFF",
  green: "#0F7A4A", orange: "#D97706", navyMid: "#132844",
};

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";
const LangCtx = createContext({ lang: "fr", setLang: () => {}, t: (k) => k });
const useLang = () => useContext(LangCtx);

function useIsMobile(bp = 768) {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.innerWidth < bp);
  useEffect(() => {
    const h = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [bp]);
  return m;
}

// ─── API ─────────────────────────────────────────────────────────
async function apiCall(endpoint, options = {}, token = null) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : `Erreur ${res.status}`);
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

// ─── UI primitives ───────────────────────────────────────────────
function Card({ children, style = {}, className = "" }) {
  return (
    <div className={className} style={{
      background: C.white, borderRadius: 16, padding: "22px 24px",
      boxShadow: "0 4px 24px rgba(10,22,40,0.06)",
      border: `1px solid rgba(10,22,40,0.06)`, ...style,
    }}>{children}</div>
  );
}

function Badge({ color, children }) {
  return (
    <span style={{
      background: color + "18", color, border: `1px solid ${color}44`,
      padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700,
      letterSpacing: 0.3, display: "inline-flex", alignItems: "center", gap: 5,
    }}>{children}</span>
  );
}

function Btn({ onClick, disabled, color = C.red, children, style = {}, variant = "solid" }) {
  const solid = variant === "solid";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "12px 18px",
      background: disabled ? C.silver : solid ? color : "transparent",
      color: solid ? C.white : color,
      border: solid ? "none" : `1.5px solid ${color}`,
      borderRadius: 10, fontSize: 13, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "transform 0.15s, box-shadow 0.2s, opacity 0.2s",
      boxShadow: disabled || !solid ? "none" : `0 6px 18px ${color}33`,
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      letterSpacing: 0.2, ...style,
    }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = "scale(0.98)"; }}
      onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
    >{children}</button>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={lbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} style={inp} />
    </div>
  );
}

function Select({ label, value, onChange, options, numeric = true }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={lbl}>{label}</label>
      <select value={value}
        onChange={e => onChange(numeric ? Number(e.target.value) : e.target.value)}
        style={{ ...inp, cursor: "pointer", background: C.white }}>
        {options.map(o => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function DurationBar({ value, max = 50, color }) {
  return (
    <div style={{ background: C.mist, borderRadius: 6, height: 7, overflow: "hidden", marginTop: 4 }}>
      <div style={{
        width: `${Math.min(100, (value / max) * 100)}%`, height: "100%",
        background: `linear-gradient(90deg, ${color}, ${color}bb)`,
        borderRadius: 6, transition: "width 0.7s cubic-bezier(.2,.8,.2,1)",
      }} />
    </div>
  );
}

function Alert({ type, message }) {
  const colors = { success: C.green, error: C.red, info: C.steel };
  const color = colors[type] || C.steel;
  const icon = type === "success" ? "checkCircle" : type === "error" ? "xCircle" : "info";
  return (
    <div style={{
      background: color + "12", border: `1px solid ${color}40`, borderRadius: 10,
      padding: "11px 14px", fontSize: 13, color, marginBottom: 12,
      display: "flex", alignItems: "flex-start", gap: 10,
    }}>
      <Icon name={icon} size={18} style={{ marginTop: 1 }} />
      <span style={{ flex: 1, lineHeight: 1.45 }}>{message}</span>
    </div>
  );
}

const lbl = {
  display: "block", fontSize: 11, fontWeight: 700, color: C.steel,
  marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6,
};
const inp = {
  width: "100%", padding: "11px 13px", borderRadius: 10,
  border: `1.5px solid ${C.mist}`, fontSize: 14, color: C.navy,
  outline: "none", boxSizing: "border-box", background: "#FAFBFD",
  transition: "border-color 0.15s",
};

function SectionTitle({ icon, children }) {
  return (
    <h3 style={{
      margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: C.navy,
      fontFamily: "var(--font-display)", display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{
        width: 34, height: 34, borderRadius: 10, background: C.mist,
        display: "inline-flex", alignItems: "center", justifyContent: "center", color: C.red,
      }}>
        <Icon name={icon} size={18} />
      </span>
      {children}
    </h3>
  );
}

function LangSwitch({ lang, setLang }) {
  return (
    <div style={{
      display: "inline-flex", background: "rgba(255,255,255,0.08)",
      borderRadius: 8, padding: 3, border: "1px solid rgba(255,255,255,0.12)",
    }}>
      {["fr", "en"].map(l => (
        <button key={l} onClick={() => setLang(l)} style={{
          border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
          padding: "5px 10px", borderRadius: 6, letterSpacing: 0.5,
          background: lang === l ? C.red : "transparent",
          color: lang === l ? C.white : C.silver,
          transition: "all 0.2s",
        }}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

// ─── Detail modal ────────────────────────────────────────────────
function ReportModal({ item, kind, onClose }) {
  const { t } = useLang();
  const isMobile = useIsMobile();
  if (!item) return null;

  const rows = kind === "prediction" ? [
    [t("idLabel"), item.id_prediction],
    [t("agent"), item.predicted_by_name || item.predicted_by],
    [t("dateTime"), formatDateTime(item.predicted_at)],
    [t("coordination"), item.coordination_label],
    [t("vehicles"), item.nb_vehicules],
    [t("positionTrain"), item.position_label],
    [t("trackState"), item.etat_label],
    [t("cranePos"), item.grue_label],
    [t("trackType"), item.type_voie_label],
    [t("incidentHour"), item.heure_incident != null ? `${item.heure_incident}h` : "—"],
    [t("hourPcc"), item.heure_information_pcc || "—"],
    [t("predDuration"), `${item.duree_heures}h`],
    ["IC 85%", `[${item.ic_min_heures}h – ${item.ic_max_heures}h]`],
    [t("risk"), item.niveau_risque],
    [t("resumeHour"), item.heure_reprise || "—"],
    [t("realDuration"), item.duree_reelle != null ? `${item.duree_reelle}h` : t("pending")],
    [t("gap"), item.ecart_heures != null && item.ecart_heures !== "" ? `${item.ecart_heures > 0 ? "+" : ""}${item.ecart_heures}h` : "—"],
    [t("status"), item.validation_statut || t("pending")],
  ] : [
    [t("idLabel"), item.id],
    [t("source"), item.source],
    [t("agent"), item.submitted_by_name || item.submitted_by || "—"],
    [t("dateIncident"), item.date_incident],
    [t("incidentHour"), item.heure_incident != null ? `${item.heure_incident}h` : "—"],
    [t("coordination"), item.coordination_label],
    [t("vehicles"), item.nb_vehicules],
    [t("positionTrain"), item.position_label],
    [t("trackState"), item.etat_label],
    [t("cranePos"), item.grue_label],
    [t("trackType"), item.type_voie_label],
    [t("realDurationH"), item.duree_heures != null ? `${item.duree_heures}h` : "—"],
    [t("highlights"), item.faits_saillants || "—"],
    [t("cause"), item.cause_probable || "—"],
    [t("dateTime"), formatDateTime(item.submitted_at)],
  ];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(10,22,40,0.55)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: isMobile ? 12 : 24, animation: "fadeUp 0.25s ease",
    }}>
      <div onClick={e => e.stopPropagation()} className="fade-up" style={{
        background: C.white, borderRadius: 20, width: "100%", maxWidth: 560,
        maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(10,22,40,0.35)",
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyMid} 60%, ${C.steel} 100%)`,
          padding: "20px 14px", color: C.white, display: "flex",
          alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 11, color: C.silver, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              CAMRAIL
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="file" size={20} />
              {t("reportTitle")}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.1)", border: "none", color: C.white,
            width: 36, height: 36, borderRadius: 10, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", overflowY: "auto" }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{
              display: "grid", gridTemplateColumns: isMobile ? "1fr" : "140px 1fr",
              gap: isMobile ? 2 : 12, padding: "10px 0",
              borderBottom: `1px solid ${C.mist}`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.silver, textTransform: "uppercase", letterSpacing: 0.4 }}>{k}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.navy, wordBreak: "break-word" }}>{v ?? "—"}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 22px", borderTop: `1px solid ${C.mist}` }}>
          <Btn onClick={onClose} color={C.navy} style={{ width: "100%" }}>
            <IconLabel icon="close" size={16}>{t("close")}</IconLabel>
          </Btn>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const s = String(iso).replace("T", " ");
  return s.length >= 16 ? s.slice(0, 16) : s;
}

function FilterBar({ filters, setFilters, showName = true, onApply, onReset }) {
  const { t } = useLang();
  const isMobile = useIsMobile();
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr 1fr" : showName ? "1.4fr 1fr 1fr 1fr auto auto" : "1fr 1fr 1fr auto auto",
      gap: 10, marginBottom: 18, alignItems: "end",
    }}>
      {showName && (
        <div style={{ gridColumn: isMobile ? "1 / -1" : "auto" }}>
          <label style={lbl}>{t("filterName")}</label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: 12, color: C.silver }}><Icon name="search" size={16} /></span>
            <input value={filters.nom} onChange={e => setFilters(f => ({ ...f, nom: e.target.value }))}
              placeholder={t("filterNamePh")}
              style={{ ...inp, paddingLeft: 36 }} />
          </div>
        </div>
      )}
      <div>
        <label style={lbl}>{t("dateFrom")}</label>
        <input type="date" value={filters.date_from}
          onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} style={inp} />
      </div>
      <div>
        <label style={lbl}>{t("dateTo")}</label>
        <input type="date" value={filters.date_to}
          onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} style={inp} />
      </div>
      <div style={{ gridColumn: isMobile ? "1 / -1" : "auto" }}>
        <label style={lbl}>{t("coordination")}</label>
        <select value={filters.coordination || "0"}
          onChange={e => setFilters(f => ({ ...f, coordination: e.target.value === "0" ? null : Number(e.target.value) }))}
          style={{ ...inp, cursor: "pointer", background: C.white }}>
          <option value="0">{t("allCoords")}</option>
          {[1, 2, 3, 4].map(c => (
            <option key={c} value={c}>{t(["", "north", "south", "east", "west"][c])}</option>
          ))}
        </select>
      </div>
      <div style={{
        gridColumn: isMobile ? "1 / -1" : "auto",
        display: "flex", gap: 8,
      }}>
        <Btn onClick={onApply} color={C.navy} style={{ padding: "11px 14px", flex: isMobile ? 1 : "none" }}>
          <Icon name="filter" size={16} />
          {t("applyFilters")}
        </Btn>
        <Btn onClick={onReset} variant="ghost" color={C.steel}
          style={{ padding: "11px 14px", border: `1.5px solid ${C.mist}`, flex: isMobile ? 1 : "none" }}>
          <Icon name="refresh" size={16} />
          {isMobile && t("resetFilters")}
        </Btn>
      </div>
    </div>
  );
}

// ─── Login ───────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const { lang, setLang, t } = useLang();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isMobile = useIsMobile();

  const handleLogin = async () => {
    if (!username || !password) return setError(t("loginError"));
    setLoading(true); setError(null);
    try { onLogin(await apiLogin(username, password)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      background: `linear-gradient(145deg, #050b14 0%, ${C.navy} 42%, ${C.navyMid} 100%)`,
      fontFamily: "var(--font-body)", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, opacity: 0.4,
        backgroundImage: `repeating-linear-gradient(-12deg, transparent, transparent 40px, rgba(200,16,46,0.04) 40px, rgba(200,16,46,0.04) 41px)`,
      }} />
      <div style={{
        flex: isMobile ? "none" : 1.1, display: isMobile ? "none" : "flex",
        flexDirection: "column", justifyContent: "center", padding: "48px 56px",
        position: "relative", zIndex: 1,
      }}>
        <div className="fade-up" style={{ alignSelf: "flex-start", marginBottom: 28 }}>
          <BrandLogo height={110} />
        </div>
        <p className="fade-up-d1" style={{
          color: C.silver, fontSize: 17, margin: 0, maxWidth: 400, lineHeight: 1.55,
          fontFamily: "var(--font-display)", fontWeight: 600,
        }}>{t("appTitle")}</p>
        <p className="fade-up-d2" style={{
          color: "rgba(255,255,255,0.45)", fontSize: 14, marginTop: 8, maxWidth: 360, lineHeight: 1.55,
        }}>{t("appSubtitle")}</p>
      </div>

      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: isMobile ? 20 : 40, position: "relative", zIndex: 1,
      }}>
        <div style={{ position: "absolute", top: 20, right: 20 }}><LangSwitch lang={lang} setLang={setLang} /></div>
        <Card className="fade-up" style={{ width: "100%", maxWidth: 400, padding: 32 }}>
          {isMobile && (
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{
                display: "inline-flex", background: "#0A1628", borderRadius: 14,
                padding: "16px 28px", marginBottom: 8,
              }}>
                <BrandLogo height={80} />
              </div>
            </div>
          )}
          <h2 style={{
            margin: "0 0 22px", fontSize: 20, fontWeight: 700, color: C.navy,
            fontFamily: "var(--font-display)", display: "flex", alignItems: "center", gap: 10,
            justifyContent: isMobile ? "center" : "flex-start",
          }}>
            <Icon name="lock" size={22} style={{ color: C.red }} />
            {t("loginTitle")}
          </h2>
          {error && <Alert type="error" message={error} />}
          <div onKeyDown={e => e.key === "Enter" && handleLogin()}>
            <Field label={t("loginId")} value={username} onChange={setUsername} placeholder="ex: cellule_crise" />
            <Field label={t("loginPassword")} value={password} onChange={setPassword} type="password" placeholder="••••••••" />
          </div>
          <Btn onClick={handleLogin} disabled={loading} style={{ width: "100%", marginTop: 8, padding: 14, fontSize: 14 }}>
            {loading
              ? <IconLabel icon="spark" size={16}>{t("loginLoading")}</IconLabel>
              : <IconLabel icon="arrowRight" size={16}>{t("loginBtn")}</IconLabel>}
          </Btn>
          <div style={{ marginTop: 20, padding: 14, background: C.mist, borderRadius: 12, fontSize: 12, color: C.steel }}>
            <div style={{ fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="users" size={14} /> {t("demoAccounts")}
            </div>
            {[
              ["admin", "Admin@Camrail2026", "ADMIN"],
              ["cellule_crise", "Crise@2026!", "CELLULE_CRISE"],
              ["dmat", "Dmat@2026!", "OPERATEUR"],
            ].map(([u, p, r]) => (
              <div key={u} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "7px 0", borderBottom: `1px solid ${C.white}`, cursor: "pointer",
              }} onClick={() => { setUsername(u); setPassword(p); }}>
                <span style={{ fontWeight: 600 }}>{u}</span>
                <Badge color={r === "ADMIN" ? C.red : r === "CELLULE_CRISE" ? C.navy : C.steel}>{r}</Badge>
              </div>
            ))}
            <div style={{ marginTop: 8, fontSize: 11, color: C.silver }}>{t("demoHint")}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Header({
  user, onLogout, apiStatus, tabs = [], activeTab, onNavigate,
  menuOpen, setMenuOpen,
}) {
  const { lang, setLang, t } = useLang();
  const isMobile = useIsMobile();
  const roleColors = { ADMIN: C.red, CELLULE_CRISE: C.navy, OPERATEUR: C.steel };

  // Lock body scroll when drawer open
  useEffect(() => {
    if (!isMobile) return;
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen, isMobile]);

  useEffect(() => {
    if (!isMobile && menuOpen) setMenuOpen(false);
  }, [isMobile, menuOpen, setMenuOpen]);

  return (
    <>
      <header style={{
        background: "linear-gradient(105deg, #050b14 0%, #0A1628 55%, #132844 100%)",
        boxShadow: "0 4px 28px rgba(0,0,0,0.35)",
        position: "sticky", top: 0, zIndex: 80,
        borderBottom: `2px solid ${C.red}`,
      }}>
        <div style={{
          maxWidth: 1140, margin: "0 auto", display: "flex",
          alignItems: "center", justifyContent: "space-between",
          padding: isMobile ? "10px 12px" : "11px 20px", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <BrandLogo height={isMobile ? 30 : 40} />
            {!isMobile && (
              <>
                <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.12)" }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    color: C.white, fontSize: 14, fontWeight: 700,
                    fontFamily: "var(--font-display)", letterSpacing: 0.2,
                  }}>{t("appTitle")}</div>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>{t("appSubtitle")}</div>
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, flexShrink: 0 }}>
            {!isMobile && <LangSwitch lang={lang} setLang={setLang} />}
            {!isMobile && (
              <Badge color={apiStatus === "ok" ? C.green : C.red}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", background: "currentColor",
                  display: "inline-block", animation: apiStatus === "ok" ? "pulseSoft 2s infinite" : "none",
                }} />
                {apiStatus === "ok" ? t("apiOk") : t("apiOff")}
              </Badge>
            )}
            {!isMobile && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ color: C.white, fontSize: 12, fontWeight: 700 }}>{user.full_name}</span>
                <Badge color={roleColors[user.role] || C.steel}>{user.role}</Badge>
              </div>
            )}
            {!isMobile && (
              <button onClick={onLogout} style={{
                background: "transparent", border: "1px solid rgba(255,255,255,0.22)",
                color: C.silver, padding: "8px 12px", borderRadius: 9, fontSize: 11,
                cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                <Icon name="logout" size={14} />
                {t("logout")}
              </button>
            )}
            {isMobile && (
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: apiStatus === "ok" ? C.green : C.red,
                boxShadow: `0 0 0 3px ${apiStatus === "ok" ? C.green : C.red}33`,
              }} title={apiStatus === "ok" ? t("apiOk") : t("apiOff")} />
            )}
            {isMobile && (
              <button
                type="button"
                aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(o => !o)}
                style={{
                  width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: menuOpen ? C.red : "rgba(255,255,255,0.06)",
                  color: C.white, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s",
                }}
              >
                <Icon name={menuOpen ? "close" : "menu"} size={20} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {isMobile && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 90,
              background: "rgba(5,11,20,0.55)",
              backdropFilter: "blur(4px)",
              opacity: menuOpen ? 1 : 0,
              pointerEvents: menuOpen ? "auto" : "none",
              transition: "opacity 0.25s ease",
            }}
          />
          <aside
            aria-hidden={!menuOpen}
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 100,
              width: "min(86vw, 320px)",
              background: "linear-gradient(180deg, #050b14 0%, #0A1628 60%, #132844 100%)",
              boxShadow: "-12px 0 40px rgba(0,0,0,0.45)",
              transform: menuOpen ? "translateX(0)" : "translateX(105%)",
              transition: "transform 0.28s cubic-bezier(.2,.8,.2,1)",
              display: "flex", flexDirection: "column",
              borderLeft: `2px solid ${C.red}`,
            }}
          >
            <div style={{
              padding: "18px 18px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <BrandLogo height={34} />
              <button type="button" aria-label={t("closeMenu")} onClick={() => setMenuOpen(false)}
                style={{
                  width: 38, height: 38, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)", color: C.white, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                <Icon name="close" size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 18px 8px" }}>
              <div style={{ color: C.white, fontWeight: 700, fontSize: 14 }}>{user.full_name}</div>
              <div style={{ marginTop: 6 }}>
                <Badge color={roleColors[user.role] || C.steel}>{user.role}</Badge>
              </div>
            </div>

            <div style={{ padding: "8px 12px", color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
              {t("navigation")}
            </div>

            <nav style={{ flex: 1, overflowY: "auto", padding: "0 10px 16px" }}>
              {tabs.map(tab => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => { onNavigate(tab.key); setMenuOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "14px 14px", marginBottom: 6, borderRadius: 12,
                      border: active ? `1px solid ${C.red}66` : "1px solid transparent",
                      background: active ? "rgba(200,16,46,0.18)" : "transparent",
                      color: active ? C.white : "rgba(255,255,255,0.72)",
                      fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "left",
                      transition: "background 0.15s",
                    }}
                  >
                    <span style={{
                      width: 34, height: 34, borderRadius: 9,
                      background: active ? C.red : "rgba(255,255,255,0.08)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      color: C.white,
                    }}>
                      <Icon name={tab.icon} size={17} />
                    </span>
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            <div style={{
              padding: 16, borderTop: "1px solid rgba(255,255,255,0.08)",
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <LangSwitch lang={lang} setLang={setLang} />
                <Badge color={apiStatus === "ok" ? C.green : C.red}>
                  {apiStatus === "ok" ? t("apiOk") : t("apiOff")}
                </Badge>
              </div>
              <button onClick={() => { setMenuOpen(false); onLogout(); }} style={{
                width: "100%", background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.16)",
                color: C.white, padding: "12px 14px", borderRadius: 11, fontSize: 13,
                cursor: "pointer", fontWeight: 700, display: "inline-flex",
                alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <Icon name="logout" size={16} />
                {t("logout")}
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

// ─── Main App ────────────────────────────────────────────────────
export default function CamrailApp() {
  const [lang, setLangState] = useState(() => localStorage.getItem("camrail_lang") || "fr");
  const setLang = (l) => { localStorage.setItem("camrail_lang", l); setLangState(l); document.documentElement.lang = l; };
  const t = useCallback((k) => tr(lang, k), [lang]);

  const isMobile = useIsMobile();
  const [auth, setAuth] = useState(null);
  const [activeTab, setActiveTab] = useState("prediction");
  const [apiStatus, setApiStatus] = useState("unknown");
  const [menuOpen, setMenuOpen] = useState(false);
  const [histSub, setHistSub] = useState("predictions");

  const [inputs, setInputs] = useState({
    nbVehicules: 2, positionVehicule: 1, etatVoie: 2,
    positionGrues: 2, typeVoie: 1, heureIncident: 10, coordination: 1,
  });
  const [heurePCC, setHeurePCC] = useState("08:00");
  const [result, setResult] = useState(null);
  const [predLoading, setPredLoading] = useState(false);
  const [predError, setPredError] = useState(null);

  const [histData, setHistData] = useState(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histFilters, setHistFilters] = useState({ nom: "", date_from: "", date_to: "", coordination: null });
  const [histApplied, setHistApplied] = useState({ nom: "", date_from: "", date_to: "", coordination: null });

  const [predHist, setPredHist] = useState(null);
  const [predHistLoading, setPredHistLoading] = useState(false);
  const [predFilters, setPredFilters] = useState({ nom: "", date_from: "", date_to: "", coordination: null });
  const [predApplied, setPredApplied] = useState({ nom: "", date_from: "", date_to: "", coordination: null });

  const [selectedReport, setSelectedReport] = useState(null);
  const [reportKind, setReportKind] = useState("prediction");

  const [modelInfo, setModelInfo] = useState(null);
  const [retraining, setRetraining] = useState(false);
  const [retrainMsg, setRetrainMsg] = useState(null);

  const [retForm, setRetForm] = useState({
    date_incident: new Date().toISOString().split("T")[0],
    heure_incident: 10, coordination: 1, type_voie: 1,
    nb_vehicules_derailles: 2, position_vehicule: 1,
    etat_voie: 2, position_grues: 2, duree_reelle_heures: 20,
    faits_saillants: "", cause_probable: "",
  });
  const [retLoading, setRetLoading] = useState(false);
  const [retMsg, setRetMsg] = useState(null);

  const [valForm, setValForm] = useState({
    id_prediction: "", duree_predite: 0, duree_reelle: 0,
    heure_reelle: "", commentaire: "", heure_pcc: "", heure_reprise_reelle: "",
  });
  const [valMsg, setValMsg] = useState(null);
  const [valLoading, setValLoading] = useState(false);

  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: "", full_name: "", password: "", role: "OPERATEUR", coordination: "" });
  const [userMsg, setUserMsg] = useState(null);

  const token = auth?.access_token;
  const user = auth?.user;

  const can = (perm) => {
    const perms = {
      ADMIN: ["predict", "ret", "historique", "modele", "admin"],
      CELLULE_CRISE: ["predict", "ret", "historique", "modele"],
      OPERATEUR: ["historique", "modele"],
    };
    return perms[user?.role]?.includes(perm) || false;
  };

  const buildQuery = (f) => {
    const p = new URLSearchParams();
    if (f.coordination) p.set("coordination", f.coordination);
    if (f.nom?.trim()) p.set("nom", f.nom.trim());
    if (f.date_from) p.set("date_from", f.date_from);
    if (f.date_to) p.set("date_to", f.date_to);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  const loadPredHist = useCallback(async (filters) => {
    if (!token) return;
    setPredHistLoading(true);
    try {
      const data = await apiCall(`/predict/historique${buildQuery(filters)}`, {}, token);
      setPredHist(data);
    } catch { setPredHist(null); }
    finally { setPredHistLoading(false); }
  }, [token]);

  const loadHist = useCallback(async (filters) => {
    if (!token) return;
    setHistLoading(true);
    try {
      const data = await apiCall(`/historique${buildQuery(filters)}`, {}, token);
      setHistData(data);
    } catch { setHistData(null); }
    finally { setHistLoading(false); }
  }, [token]);

  useEffect(() => {
    fetch(`${API_BASE}/`).then(() => setApiStatus("ok")).catch(() => setApiStatus("error"));
  }, []);

  useEffect(() => {
    if (!token) return;
    if (activeTab === "historique") {
      if (histSub === "predictions") loadPredHist(predApplied);
      else loadHist(histApplied);
    }
    if (activeTab === "modele") {
      apiCall("/modele/info", {}, token).then(setModelInfo).catch(() => setModelInfo(null));
    }
    if (activeTab === "admin" && user?.role === "ADMIN") {
      apiCall("/admin/users", {}, token).then(setUsers).catch(() => setUsers([]));
    }
  }, [activeTab, token, histSub, predApplied, histApplied, loadPredHist, loadHist, user?.role]);

  const handleLogin = (data) => {
    setAuth(data);
    setActiveTab(data.user.role === "OPERATEUR" ? "historique" : "prediction");
  };

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
      setValForm({
        id_prediction: data.id_prediction, duree_predite: data.duree_heures,
        duree_reelle: 0, heure_reelle: "", commentaire: "",
        heure_pcc: heurePCC, heure_reprise_reelle: "",
      });
    } catch (e) { setPredError(e.message); }
    finally { setPredLoading(false); }
  };

  const handleValider = async () => {
    setValLoading(true); setValMsg(null);
    try {
      const body = {
        id_prediction: valForm.id_prediction || result?.id_prediction,
        duree_predite: valForm.duree_predite || result?.duree_heures,
        duree_reelle: valForm.duree_reelle,
        heure_reelle: valForm.heure_reelle,
        commentaire: valForm.commentaire,
      };
      const resp = await apiCall("/predict/valider", { method: "POST", body: JSON.stringify(body) }, token);
      setValMsg({ type: "success", message: resp.message });
      loadPredHist(predApplied);
    } catch (e) { setValMsg({ type: "error", message: e.message }); }
    finally { setValLoading(false); }
  };

  const handleRetSubmit = async () => {
    setRetLoading(true); setRetMsg(null);
    try {
      const resp = await apiCall("/ret/submit", { method: "POST", body: JSON.stringify(retForm) }, token);
      setRetMsg({ type: "success", message: resp.message });
    } catch (e) { setRetMsg({ type: "error", message: e.message }); }
    finally { setRetLoading(false); }
  };

  const handleRetrain = async () => {
    setRetraining(true); setRetrainMsg(null);
    try {
      const resp = await apiCall("/modele/retrain", { method: "POST" }, token);
      setRetrainMsg({ type: "success", message: resp.message });
      apiCall("/modele/info", {}, token).then(setModelInfo).catch(() => {});
    } catch (e) { setRetrainMsg({ type: "error", message: e.message }); }
    finally { setRetraining(false); }
  };

  const handleCreateUser = async () => {
    try {
      const resp = await apiCall("/admin/users", { method: "POST", body: JSON.stringify(newUser) }, token);
      setUserMsg({ type: "success", message: resp.message });
      apiCall("/admin/users", {}, token).then(setUsers);
      setNewUser({ username: "", full_name: "", password: "", role: "OPERATEUR", coordination: "" });
    } catch (e) { setUserMsg({ type: "error", message: e.message }); }
  };

  const handleDeleteUser = async (username) => {
    if (!window.confirm(`${t("confirmDeactivate")} « ${username} » ?`)) return;
    try {
      await apiCall(`/admin/users/${username}`, { method: "DELETE" }, token);
      setUserMsg({ type: "success", message: `${username}` });
      apiCall("/admin/users", {}, token).then(setUsers);
    } catch (e) { setUserMsg({ type: "error", message: e.message }); }
  };

  const si = (k) => (v) => setInputs(p => ({ ...p, [k]: v }));
  const sf = (k) => (v) => setRetForm(p => ({ ...p, [k]: v }));
  const sn = (k) => (v) => setNewUser(p => ({ ...p, [k]: v }));
  const getRisque = (d) => d < 10 ? { label: "FAIBLE", color: C.green } : d < 20 ? { label: "MODÉRÉ", color: C.orange } : { label: "ÉLEVÉ", color: C.red };

  const coordOpts = () => [
    { value: 1, label: t("north") }, { value: 2, label: t("south") },
    { value: 3, label: t("east") }, { value: 4, label: t("west") },
  ];

  const ctx = { lang, setLang, t };

  if (!auth) {
    return (
      <LangCtx.Provider value={ctx}>
        <LoginPage onLogin={handleLogin} />
      </LangCtx.Provider>
    );
  }

  const tabs = [
    can("predict") && { key: "prediction", label: t("tabPredict"), icon: "target" },
    can("ret") && { key: "ret", label: t("tabRet"), icon: "clipboard" },
    can("historique") && { key: "historique", label: t("tabHistory"), icon: "chart" },
    can("modele") && { key: "modele", label: t("tabModel"), icon: "cpu" },
    can("admin") && { key: "admin", label: t("tabAdmin"), icon: "settings" },
  ].filter(Boolean);

  const statutColor = (s) =>
    s === "CORRECT" ? C.green : s === "PROCHE" ? C.orange : s === "INCORRECT" ? C.red : C.silver;

  return (
    <LangCtx.Provider value={ctx}>
      <div style={{ fontFamily: "var(--font-body)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Header
          user={user}
          onLogout={() => { setAuth(null); setResult(null); setMenuOpen(false); }}
          apiStatus={apiStatus}
          tabs={tabs}
          activeTab={activeTab}
          onNavigate={setActiveTab}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
        />

        {/* Desktop secondary nav — hidden on mobile (drawer replaces it) */}
        {!isMobile && (
          <nav style={{
            background: "rgba(255,255,255,0.94)", backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${C.mist}`, position: "sticky", top: 64, zIndex: 40,
          }}>
            <div style={{
              maxWidth: 1140, margin: "0 auto", display: "flex",
              gap: 2, padding: "0 12px",
            }}>
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                  padding: "14px 18px", border: "none", background: "none",
                  cursor: "pointer", fontSize: 13, fontWeight: 700,
                  color: activeTab === tab.key ? C.red : C.silver,
                  borderBottom: activeTab === tab.key ? `3px solid ${C.red}` : "3px solid transparent",
                  display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
                  transition: "color 0.2s",
                }}>
                  <Icon name={tab.icon} size={16} />
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>
        )}

        <main style={{
          maxWidth: 1140, width: "100%", margin: "0 auto", flex: 1,
          padding: isMobile ? "16px 12px 48px" : "28px 20px 56px",
        }}>

          {/* ── PREDICTION ── */}
          {activeTab === "prediction" && (
            <div className="fade-up" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 14 : 22 }}>
              <Card>
                <SectionTitle icon="clipboard">{t("predParams")}</SectionTitle>
                <Field label={t("hourPcc")} value={heurePCC} onChange={setHeurePCC} type="time" />
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>{t("nbVehicles")}</label>
                  <input type="number" min={1} max={30} value={inputs.nbVehicules}
                    onChange={e => si("nbVehicules")(Number(e.target.value))} style={inp} />
                </div>
                <Select label={t("positionTrain")} value={inputs.positionVehicule} onChange={si("positionVehicule")}
                  options={[{ value: 1, label: t("head") }, { value: 2, label: t("middle") }, { value: 3, label: t("tail") }]} />
                <Select label={t("trackState")} value={inputs.etatVoie} onChange={si("etatVoie")}
                  options={[{ value: 1, label: t("light") }, { value: 2, label: t("moderate") }, { value: 3, label: t("severe") }]} />
                <Select label={t("cranePos")} value={inputs.positionGrues} onChange={si("positionGrues")}
                  options={[{ value: 1, label: t("near") }, { value: 2, label: t("midRange") }, { value: 3, label: t("far") }]} />
                <Select label={t("coordination")} value={inputs.coordination} onChange={si("coordination")} options={coordOpts()} />
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>{t("incidentHour")}</label>
                  <input type="number" min={0} max={23} value={inputs.heureIncident}
                    onChange={e => si("heureIncident")(Number(e.target.value))} style={inp} />
                </div>
                {predError && <Alert type="error" message={predError} />}
                <Btn onClick={handlePredict} disabled={predLoading} style={{ width: "100%", padding: 14 }}>
                  {predLoading
                    ? <IconLabel icon="spark">{t("calculating")}</IconLabel>
                    : <IconLabel icon="bolt">{t("launchPred")}</IconLabel>}
                </Btn>
              </Card>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {!result && !predLoading && (
                  <Card style={{
                    flex: 1, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", minHeight: 240,
                    background: `linear-gradient(160deg, ${C.white}, ${C.mist})`,
                  }}>
                    <div style={{
                      width: 72, height: 72, borderRadius: 20, background: C.navy,
                      color: C.white, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
                    }}>
                      <Icon name="train" size={36} />
                    </div>
                    <p style={{ color: C.steel, textAlign: "center", fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 280 }}>
                      {t("predEmpty")}<br />
                      <span style={{ fontSize: 12, color: C.silver }}>{t("predEmptyHint")}</span>
                    </p>
                  </Card>
                )}
                {predLoading && (
                  <Card style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 240 }}>
                    <div style={{ color: C.red, animation: "pulseSoft 1.2s infinite", marginBottom: 12 }}>
                      <Icon name="cpu" size={40} />
                    </div>
                    <p style={{ color: C.steel, fontWeight: 700 }}>{t("inferring")}</p>
                  </Card>
                )}
                {result && !predLoading && (() => {
                  const risque = getRisque(result.duree_heures);
                  return (
                    <>
                      <Card className="fade-up" style={{ borderLeft: `5px solid ${risque.color}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.silver, textTransform: "uppercase" }}>{t("predictedDuration")}</div>
                            <div style={{ fontSize: isMobile ? 40 : 48, fontWeight: 800, color: C.navy, fontFamily: "var(--font-display)", lineHeight: 1.05 }}>
                              {result.duree_heures}<span style={{ fontSize: 22 }}>h</span>
                            </div>
                            <div style={{ fontSize: 12, color: C.silver }}>IC 85% : [{result.ic_min_heures}h – {result.ic_max_heures}h]</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <Badge color={risque.color}>{t("risk")} {result.niveau_risque}</Badge>
                            <div style={{ marginTop: 10, fontSize: 11, color: C.silver }}>{t("icCoverage")}</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: risque.color }}>{result.fiabilite_pct}%</div>
                          </div>
                        </div>
                        <DurationBar value={result.duree_heures} color={risque.color} />
                        <div style={{ marginTop: 12, fontSize: 12, color: C.silver, display: "flex", alignItems: "center", gap: 6 }}>
                          <Icon name="users" size={14} />
                          {t("predictedBy")} <b style={{ color: C.navy }}>{result.predicted_by_name || result.predicted_by}</b>
                          {" "}{t("at")} {result.predicted_at?.slice(11, 16)}
                        </div>
                      </Card>

                      {result.heure_reprise && (
                        <Card className="fade-up-d1">
                          <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                            <Icon name="clock" size={16} style={{ color: C.red }} /> {t("resumeHour")}
                          </h4>
                          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
                            {[
                              { label: t("earliest"), value: result.heure_reprise_min, color: C.green },
                              { label: t("prediction"), value: result.heure_reprise, color: C.red },
                              { label: t("latest"), value: result.heure_reprise_max, color: C.orange },
                            ].map(item => (
                              <div key={item.label} style={{
                                background: item.color + "10", borderRadius: 12, padding: "14px 8px",
                                textAlign: "center", border: `1.5px solid ${item.color}28`,
                              }}>
                                <div style={{ fontSize: 10, color: item.color, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{item.label}</div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: item.color, fontFamily: "var(--font-display)" }}>{item.value}</div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}

                      <Card>
                        <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                          <Icon name="activity" size={16} style={{ color: C.steel }} /> {t("contributions")}
                        </h4>
                        {Object.entries(result.feature_contributions || {})
                          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6)
                          .map(([feat, val]) => (
                            <div key={feat} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.mist}` }}>
                              <span style={{ fontSize: 12, color: C.steel }}>{feat.replace(/_/g, " ")}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: val > 0 ? C.red : C.green }}>
                                {val > 0 ? "+" : ""}{val}h
                              </span>
                            </div>
                          ))}
                      </Card>

                      <Btn color={C.navy} style={{ width: "100%", padding: 13 }}
                        onClick={() => {
                          try {
                            const filename = generatePredictionPDF({ result, inputs, heurePCC, user, logoB64: CAMRAIL_LOGO_B64 });
                            alert(`${t("pdfOk")} : ${filename}`);
                          } catch (e) { alert(`${t("pdfErr")} : ${e.message}`); }
                        }}>
                        <IconLabel icon="download">{t("downloadPdf")}</IconLabel>
                      </Btn>

                      <Card style={{ background: "#F3FAF6", border: `1.5px solid ${C.green}40` }}>
                        <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: C.green, display: "flex", alignItems: "center", gap: 8 }}>
                          <Icon name="checkCircle" size={18} /> {t("validateTitle")}
                        </h4>
                        <p style={{ margin: "0 0 14px", fontSize: 12, color: C.silver, lineHeight: 1.55 }}>{t("validateHint")}</p>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 12 }}>
                          <div>
                            <label style={lbl}>{t("startPcc")}</label>
                            <input type="time" value={valForm.heure_pcc || heurePCC}
                              onChange={e => setValForm(p => ({ ...p, heure_pcc: e.target.value }))} style={{ ...inp, background: C.white }} />
                          </div>
                          <div>
                            <label style={lbl}>{t("realResume")}</label>
                            <input type="time" value={valForm.heure_reprise_reelle || ""}
                              onChange={e => {
                                const heureReprise = e.target.value;
                                const hPCC = valForm.heure_pcc || heurePCC || "00:00";
                                const [h1, m1] = hPCC.split(":").map(Number);
                                const [h2, m2] = heureReprise.split(":").map(Number);
                                let totalMin = (h2 * 60 + m2) - (h1 * 60 + m1);
                                if (totalMin <= 0) totalMin += 24 * 60;
                                const dureeReelle = parseFloat((totalMin / 60).toFixed(2));
                                setValForm(p => ({
                                  ...p, heure_reprise_reelle: heureReprise,
                                  id_prediction: result.id_prediction,
                                  duree_predite: result.duree_heures,
                                  duree_reelle: dureeReelle, heure_reelle: heureReprise,
                                }));
                              }}
                              style={{ ...inp, border: `1.5px solid ${C.green}`, background: C.white }} />
                          </div>
                        </div>
                        {valForm.duree_reelle > 0 && (
                          <div style={{ background: C.white, borderRadius: 12, padding: "12px 14px", marginBottom: 12, border: `1.5px solid ${C.green}33` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                              <div style={{ textAlign: "center", flex: 1 }}>
                                <div style={{ fontSize: 10, color: C.silver, textTransform: "uppercase", fontWeight: 700 }}>{t("realDuration")}</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{valForm.duree_reelle}h</div>
                              </div>
                              <div style={{ fontSize: 12, color: C.silver, fontWeight: 700 }}>{t("vs")}</div>
                              <div style={{ textAlign: "center", flex: 1 }}>
                                <div style={{ fontSize: 10, color: C.silver, textTransform: "uppercase", fontWeight: 700 }}>{t("predDuration")}</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: C.red }}>{result.duree_heures}h</div>
                              </div>
                              <div style={{ textAlign: "center", flex: 1 }}>
                                <div style={{ fontSize: 10, color: C.silver, textTransform: "uppercase", fontWeight: 700 }}>{t("gap")}</div>
                                <div style={{
                                  fontSize: 20, fontWeight: 800,
                                  color: Math.abs(valForm.duree_reelle - result.duree_heures) <= 2 ? C.green
                                    : Math.abs(valForm.duree_reelle - result.duree_heures) <= 5 ? C.orange : C.red,
                                }}>
                                  {(valForm.duree_reelle - result.duree_heures) > 0 ? "+" : ""}
                                  {(valForm.duree_reelle - result.duree_heures).toFixed(1)}h
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        <div style={{ marginBottom: 12 }}>
                          <label style={lbl}>{t("comment")}</label>
                          <input type="text" value={valForm.commentaire}
                            onChange={e => setValForm(p => ({ ...p, commentaire: e.target.value }))}
                            style={inp} placeholder={t("commentPh")} />
                        </div>
                        {valMsg && <Alert type={valMsg.type} message={valMsg.message} />}
                        <Btn onClick={handleValider}
                          disabled={valLoading || !valForm.duree_reelle || !valForm.heure_reprise_reelle}
                          color={C.green} style={{ width: "100%", padding: 13 }}>
                          {valLoading
                            ? <IconLabel icon="spark">{t("saving")}</IconLabel>
                            : <IconLabel icon="check">{t("validateBtn")}</IconLabel>}
                        </Btn>
                      </Card>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── RET ── */}
          {activeTab === "ret" && (
            <div className="fade-up" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 14 : 22 }}>
              <Card>
                <SectionTitle icon="clipboard">{t("retTitle")}</SectionTitle>
                <p style={{ margin: "-8px 0 16px", fontSize: 13, color: C.silver }}>{t("retSubtitle")}</p>
                <Field label={t("dateIncident")} value={retForm.date_incident} onChange={sf("date_incident")} type="date" />
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>{t("incidentHour")}</label>
                  <input type="number" min={0} max={23} value={retForm.heure_incident}
                    onChange={e => sf("heure_incident")(Number(e.target.value))} style={inp} />
                </div>
                <Select label={t("coordination")} value={retForm.coordination} onChange={sf("coordination")} options={coordOpts()} />
                <Select label={t("trackType")} value={retForm.type_voie} onChange={sf("type_voie")}
                  options={[{ value: 1, label: t("mainTrack") }, { value: 2, label: t("secondaryTrack") }]} />
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>{t("nbVehicles")}</label>
                  <input type="number" min={1} value={retForm.nb_vehicules_derailles}
                    onChange={e => sf("nb_vehicules_derailles")(Number(e.target.value))} style={inp} />
                </div>
                <Select label={t("positionTrain")} value={retForm.position_vehicule} onChange={sf("position_vehicule")}
                  options={[{ value: 1, label: t("head") }, { value: 2, label: t("middle") }, { value: 3, label: t("tail") }]} />
                <Select label={t("trackState")} value={retForm.etat_voie} onChange={sf("etat_voie")}
                  options={[{ value: 1, label: t("light") }, { value: 2, label: t("moderate") }, { value: 3, label: t("severe") }]} />
                <Select label={t("cranePos")} value={retForm.position_grues} onChange={sf("position_grues")}
                  options={[{ value: 1, label: t("near") }, { value: 2, label: t("midRange") }, { value: 3, label: t("far") }]} />
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>{t("realDurationH")}</label>
                  <input type="number" step="0.5" min="0.5" value={retForm.duree_reelle_heures}
                    onChange={e => sf("duree_reelle_heures")(parseFloat(e.target.value))} style={inp} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>{t("highlights")}</label>
                  <textarea rows={2} value={retForm.faits_saillants}
                    onChange={e => sf("faits_saillants")(e.target.value)}
                    style={{ ...inp, resize: "vertical" }} />
                </div>
                <Field label={t("cause")} value={retForm.cause_probable} onChange={sf("cause_probable")} />
                {retMsg && <Alert type={retMsg.type} message={retMsg.message} />}
                <Btn onClick={handleRetSubmit} disabled={retLoading} color={C.navy} style={{ width: "100%", padding: 13 }}>
                  {retLoading
                    ? <IconLabel icon="spark">{t("saving")}</IconLabel>
                    : <IconLabel icon="save">{t("submitRet")}</IconLabel>}
                </Btn>
              </Card>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Card style={{ background: `linear-gradient(145deg, ${C.navy}, ${C.steel})`, color: C.white }}>
                  <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="info" size={16} /> {t("retTitle")}
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: C.silver, lineHeight: 1.7 }}>{t("retBrief")}</p>
                </Card>
                <Card>
                  <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="check" size={16} style={{ color: C.green }} /> {t("checklist")}
                  </h4>
                  {(lang === "en"
                    ? ["Precise date & time", "Coordination", "Track type", "Vehicle count", "Consist position", "Track inspection", "Crane availability", "Real reopen duration", "Documented key facts", "Probable cause"]
                    : ["Date et heure précises", "Coordination concernée", "Type de voie", "Nombre exact de véhicules", "Position dans la rame", "État de la voie (inspection)", "Disponibilité des grues", "Durée réelle jusqu'à réouverture", "Faits saillants documentés", "Cause probable identifiée"]
                  ).map((item, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 8, padding: "7px 0", fontSize: 13, color: C.steel,
                      borderBottom: `1px solid ${C.mist}`, alignItems: "center",
                    }}>
                      <Icon name="checkCircle" size={14} style={{ color: C.green }} />{item}
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          )}

          {/* ── HISTORIQUES ── */}
          {activeTab === "historique" && (
            <div className="fade-up">
              <div style={{
                display: "inline-flex", background: C.white, borderRadius: 12, padding: 4,
                border: `1px solid ${C.mist}`, marginBottom: 18, boxShadow: "0 2px 10px rgba(10,22,40,0.04)",
              }}>
                {[
                  { key: "predictions", label: t("histPredictions"), icon: "target" },
                  { key: "incidents", label: t("histIncidents"), icon: "list" },
                ].map(s => (
                  <button key={s.key} onClick={() => setHistSub(s.key)} style={{
                    border: "none", cursor: "pointer", padding: "10px 16px", borderRadius: 9,
                    fontSize: 13, fontWeight: 700,
                    background: histSub === s.key ? C.navy : "transparent",
                    color: histSub === s.key ? C.white : C.steel,
                    display: "inline-flex", alignItems: "center", gap: 8, transition: "all 0.2s",
                  }}>
                    <Icon name={s.icon} size={15} /> {s.label}
                  </button>
                ))}
              </div>

              {histSub === "predictions" && (
                <>
                  <Card style={{ marginBottom: 16 }}>
                    <FilterBar
                      filters={predFilters} setFilters={setPredFilters}
                      onApply={() => setPredApplied({ ...predFilters })}
                      onReset={() => {
                        const z = { nom: "", date_from: "", date_to: "", coordination: null };
                        setPredFilters(z); setPredApplied(z);
                      }}
                    />
                    {predHist?.stats && (
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",
                        gap: 12, marginTop: 4,
                      }}>
                        {[
                          { label: t("histPredictions"), value: predHist.stats.filtered_count ?? predHist.stats.total, color: C.navy, icon: "layers" },
                          { label: "CORRECT", value: predHist.stats.correct, color: C.green, icon: "checkCircle" },
                          { label: "PROCHE", value: predHist.stats.proche, color: C.orange, icon: "activity" },
                          { label: "%", value: `${predHist.stats.precision_pct || 0}%`, color: C.red, icon: "star" },
                        ].map((s, i) => (
                          <div key={i} style={{
                            padding: "14px 12px", borderRadius: 12, background: C.mist,
                            textAlign: "center",
                          }}>
                            <div style={{ color: s.color, marginBottom: 4 }}><Icon name={s.icon} size={18} /></div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "var(--font-display)" }}>{s.value}</div>
                            <div style={{ fontSize: 11, color: C.silver, marginTop: 2 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                      <SectionTitle icon="chart">{t("histPredictions")}</SectionTitle>
                      <span style={{ fontSize: 11, color: C.silver }}>{t("clickForReport")}</span>
                    </div>
                    {predHistLoading && (
                      <div style={{ textAlign: "center", padding: 40, color: C.silver }}>
                        <Icon name="spark" size={24} style={{ animation: "pulseSoft 1s infinite" }} /><div style={{ marginTop: 8 }}>{t("loading")}</div>
                      </div>
                    )}
                    {!predHistLoading && predHist && (
                      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: C.navy }}>
                              {[t("dateTime"), t("agent"), t("coordination"), t("vehicles"), t("predDuration"), t("realDuration"), t("gap"), t("status")].map(h => (
                                <th key={h} style={{
                                  padding: "11px 12px", textAlign: "left", fontSize: 10, fontWeight: 700,
                                  color: C.white, textTransform: "uppercase", whiteSpace: "nowrap", letterSpacing: 0.4,
                                }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {predHist.predictions.map((p, i) => (
                              <tr key={p.id_prediction || i}
                                onClick={() => { setReportKind("prediction"); setSelectedReport(p); }}
                                style={{
                                  borderBottom: `1px solid ${C.mist}`,
                                  background: i % 2 === 0 ? "#F8FAFC" : C.white,
                                  cursor: "pointer", transition: "background 0.15s",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = C.mist; }}
                                onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "#F8FAFC" : C.white; }}
                              >
                                <td style={{ padding: "11px 12px", whiteSpace: "nowrap", color: C.steel }}>{formatDateTime(p.predicted_at)}</td>
                                <td style={{ padding: "11px 12px", fontWeight: 700, color: C.navy }}>{p.predicted_by_name || p.predicted_by}</td>
                                <td style={{ padding: "11px 12px" }}><Badge color={C.steel}>{p.coordination_label || "—"}</Badge></td>
                                <td style={{ padding: "11px 12px", textAlign: "center", fontWeight: 700 }}>{p.nb_vehicules ?? "—"}</td>
                                <td style={{ padding: "11px 12px", fontWeight: 700, color: C.red }}>{p.duree_heures}h</td>
                                <td style={{ padding: "11px 12px", fontWeight: 700, color: C.green }}>
                                  {p.duree_reelle != null ? `${p.duree_reelle}h` : <span style={{ color: C.silver }}>{t("pending")}</span>}
                                </td>
                                <td style={{ padding: "11px 12px", fontWeight: 700, color: p.ecart_heures > 0 ? C.orange : p.ecart_heures < 0 ? C.green : C.silver }}>
                                  {p.ecart_heures != null && p.ecart_heures !== ""
                                    ? `${p.ecart_heures > 0 ? "+" : ""}${p.ecart_heures}h` : "—"}
                                </td>
                                <td style={{ padding: "11px 12px" }}>
                                  <Badge color={statutColor(p.validation_statut)}>
                                    {p.validation_statut || t("pending")}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {predHist.predictions.length === 0 && (
                          <div style={{ textAlign: "center", padding: 36, color: C.silver }}>{t("noPredictions")}</div>
                        )}
                      </div>
                    )}
                  </Card>

                  <Card style={{ marginTop: 16 }}>
                    <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon name="book" size={16} /> {t("legend")}
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
                      {[
                        { statut: "CORRECT", color: C.green, desc: t("legendCorrect") },
                        { statut: "PROCHE", color: C.orange, desc: t("legendClose") },
                        { statut: "INCORRECT", color: C.red, desc: t("legendIncorrect") },
                      ].map(s => (
                        <div key={s.statut} style={{ padding: 14, background: s.color + "10", borderRadius: 12, border: `1px solid ${s.color}28` }}>
                          <Badge color={s.color}>{s.statut}</Badge>
                          <p style={{ margin: "8px 0 0", fontSize: 12, color: C.steel, lineHeight: 1.45 }}>{s.desc}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              )}

              {histSub === "incidents" && (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: isMobile ? 14 : 20 }}>
                  <Card>
                    <FilterBar
                      filters={histFilters} setFilters={setHistFilters}
                      onApply={() => setHistApplied({ ...histFilters })}
                      onReset={() => {
                        const z = { nom: "", date_from: "", date_to: "", coordination: null };
                        setHistFilters(z); setHistApplied(z);
                      }}
                    />
                    {histLoading && (
                      <div style={{ textAlign: "center", padding: 40, color: C.silver }}>{t("loading")}</div>
                    )}
                    {histData && !histLoading && (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-around", padding: "8px 0 18px", borderBottom: `1px solid ${C.mist}`, flexWrap: "wrap", gap: 12 }}>
                          {[
                            { label: t("totalIncidents"), value: histData.stats_globales.total_incidents, color: C.red },
                            { label: t("avgDuration"), value: `${histData.stats_globales.duree_moyenne}h`, color: C.navy },
                            { label: t("maxDuration"), value: `${histData.stats_globales.duree_max}h`, color: C.orange },
                          ].map(s => (
                            <div key={s.label} style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: "var(--font-display)" }}>{s.value}</div>
                              <div style={{ fontSize: 11, color: C.silver }}>{s.label}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: 16, marginBottom: 8, fontSize: 11, color: C.silver }}>{t("clickForReport")}</div>
                        <div style={{ maxHeight: 360, overflowY: "auto" }}>
                          {(histData.incidents || []).length === 0 ? (
                            <div style={{ textAlign: "center", padding: 30, color: C.silver }}>{t("noIncidents")}</div>
                          ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead>
                                <tr style={{ background: C.mist }}>
                                  {[t("dateIncident"), t("agent"), t("coordination"), t("vehicles"), t("realDurationH")].map(h => (
                                    <th key={h} style={{
                                      padding: "9px 10px", textAlign: "left", fontSize: 10, fontWeight: 700,
                                      color: C.steel, textTransform: "uppercase", position: "sticky", top: 0, background: C.mist,
                                    }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(histData.incidents || []).map((inc, i) => (
                                  <tr key={`${inc.id}-${i}`}
                                    onClick={() => { setReportKind("incident"); setSelectedReport(inc); }}
                                    style={{ borderBottom: `1px solid ${C.mist}`, cursor: "pointer" }}
                                    onMouseEnter={e => { e.currentTarget.style.background = C.mist; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                                  >
                                    <td style={{ padding: "10px", fontWeight: 600 }}>{inc.date_incident}</td>
                                    <td style={{ padding: "10px", color: C.navy, fontWeight: 600 }}>{inc.submitted_by_name || "—"}</td>
                                    <td style={{ padding: "10px" }}><Badge color={C.steel}>{inc.coordination_label}</Badge></td>
                                    <td style={{ padding: "10px", textAlign: "center" }}>{inc.nb_vehicules}</td>
                                    <td style={{ padding: "10px", fontWeight: 700, color: C.red }}>{inc.duree_heures}h</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>

                        {(histData.serie_mensuelle || []).length > 0 && (
                          <div style={{ marginTop: 20 }}>
                            <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700 }}>{t("period")}</h4>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead>
                                <tr style={{ background: C.mist }}>
                                  {[t("period"), t("incidents"), t("avg"), t("max"), t("min")].map(h => (
                                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.steel, textTransform: "uppercase" }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {histData.serie_mensuelle.map((d, i) => (
                                  <tr key={i} style={{ borderBottom: `1px solid ${C.mist}` }}>
                                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{d.mois_label}</td>
                                    <td style={{ padding: "8px 10px" }}>{d.nb_incidents}</td>
                                    <td style={{ padding: "8px 10px", color: d.duree_moyenne > 25 ? C.red : C.green, fontWeight: 700 }}>{d.duree_moyenne}h</td>
                                    <td style={{ padding: "8px 10px", color: C.orange }}>{d.duree_max}h</td>
                                    <td style={{ padding: "8px 10px", color: C.green }}>{d.duree_min}h</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </Card>
                  <div>
                    {histData && (
                      <Card>
                        <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>{t("byCoord")}</h4>
                        {Object.entries(histData.stats_globales.par_coordination || {}).map(([coord, nb]) => (
                          <div key={coord} style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>{t(["", "north", "south", "east", "west"][coord] || coord)}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{nb}</span>
                            </div>
                            <DurationBar value={nb} max={Math.max(5, ...Object.values(histData.stats_globales.par_coordination))} color={C.red} />
                          </div>
                        ))}
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MODELE ── */}
          {activeTab === "modele" && (
            <div className="fade-up" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 14 : 22 }}>
              <Card>
                <SectionTitle icon="cpu">{t("modelArch")}</SectionTitle>
                {[
                  { step: "01", label: "Collecte RET", desc: "CSV + API /ret/submit JWT", color: C.steel },
                  { step: "02", label: "Preprocessing", desc: "Pandas — encodage, mois, saison", color: C.steel },
                  { step: "03", label: "Random Forest", desc: "200 arbres, OOB, max_depth=12", color: C.red },
                  { step: "04", label: "Quantile GBR", desc: "alpha 0.075 / 0.925 → IC 85%", color: C.navy },
                  { step: "05", label: "Auto-retrain", desc: "POST /modele/retrain (ADMIN)", color: C.green },
                  { step: "06", label: "Docker + Nginx", desc: "Intranet CAMRAIL — HTTPS", color: C.orange },
                ].map(item => (
                  <div key={item.step} style={{
                    display: "flex", gap: 14, marginBottom: 12, padding: 12,
                    background: C.mist, borderRadius: 12,
                  }}>
                    <div style={{
                      background: item.color, color: C.white, borderRadius: 10,
                      width: 36, height: 36, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0,
                      fontFamily: "var(--font-display)",
                    }}>{item.step}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: C.silver, marginTop: 2 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </Card>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {modelInfo ? (
                  <>
                    <Card>
                      <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon name="activity" size={16} style={{ color: C.red }} /> {t("metrics")}
                      </h4>
                      {[
                        ["MAE", `${modelInfo.metrics.mae} h`],
                        ["RMSE", `${modelInfo.metrics.rmse} h`],
                        ["R² train", modelInfo.metrics.r2_train],
                        ["R² CV (5-fold)", `${modelInfo.metrics.r2_cv_mean} ± ${modelInfo.metrics.r2_cv_std}`],
                        ["OOB Score", modelInfo.metrics.oob_score],
                        ["IC 85%", `${(modelInfo.metrics.ic85_coverage * 100).toFixed(1)}%`],
                        ["N", modelInfo.metrics.n_samples],
                      ].map(([label, value]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.mist}` }}>
                          <span style={{ fontSize: 13, color: C.steel }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: C.navy }}>{value}</span>
                        </div>
                      ))}
                    </Card>
                    <Card>
                      <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon name="layers" size={16} /> {t("featureImp")}
                      </h4>
                      {modelInfo.feature_importance.map((item, i) => (
                        <div key={i} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 12, color: C.steel }}>{item.feature.replace(/_/g, " ")}</span>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{(item.importance * 100).toFixed(1)}%</span>
                          </div>
                          <DurationBar value={item.importance * 100} max={45} color={i === 0 ? C.red : C.steel} />
                        </div>
                      ))}
                    </Card>
                  </>
                ) : (
                  <Card style={{ textAlign: "center", padding: 30, color: C.silver }}>{t("loading")}</Card>
                )}
                {can("admin") && (
                  <Card style={{ background: `linear-gradient(145deg, ${C.navy}, ${C.steel})` }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.white, display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon name="refresh" size={16} /> {t("retrainTitle")}
                    </h4>
                    <p style={{ margin: "0 0 12px", fontSize: 12, color: C.silver }}>{t("retrainHint")}</p>
                    {retrainMsg && <Alert type={retrainMsg.type} message={retrainMsg.message} />}
                    <Btn onClick={handleRetrain} disabled={retraining} color={C.green} style={{ width: "100%" }}>
                      {retraining
                        ? <IconLabel icon="spark">{t("retraining")}</IconLabel>
                        : <IconLabel icon="refresh">{t("retrainBtn")}</IconLabel>}
                    </Btn>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* ── ADMIN ── */}
          {activeTab === "admin" && user?.role === "ADMIN" && (
            <div className="fade-up" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 14 : 22 }}>
              <Card>
                <SectionTitle icon="users">{t("usersTitle")}</SectionTitle>
                {userMsg && <Alert type={userMsg.type} message={userMsg.message} />}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: C.mist }}>
                        {[t("username"), t("fullName"), t("role"), ""].map((h, i) => (
                          <th key={i} style={{ padding: "9px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.steel, textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.mist}` }}>
                          <td style={{ padding: "10px", fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>{u.username}</td>
                          <td style={{ padding: "10px", fontSize: 12 }}>{u.full_name}</td>
                          <td style={{ padding: "10px" }}>
                            <Badge color={u.role === "ADMIN" ? C.red : u.role === "CELLULE_CRISE" ? C.navy : C.steel}>{u.role}</Badge>
                          </td>
                          <td style={{ padding: "10px" }}>
                            {u.username !== user.username && (
                              <button onClick={() => handleDeleteUser(u.username)} style={{
                                background: C.red + "12", color: C.red, border: `1px solid ${C.red}40`,
                                borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 700,
                              }}>{t("deactivate")}</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card>
                <SectionTitle icon="userPlus">{t("createUser")}</SectionTitle>
                <Field label={t("username")} value={newUser.username} onChange={sn("username")} placeholder="ex: coord_est" />
                <Field label={t("fullName")} value={newUser.full_name} onChange={sn("full_name")} placeholder="ex: Coordination Est" />
                <Field label={t("loginPassword")} value={newUser.password} onChange={sn("password")} type="password" />
                <Select label={t("role")} value={newUser.role} onChange={sn("role")} numeric={false}
                  options={[
                    { value: "OPERATEUR", label: "OPERATEUR" },
                    { value: "CELLULE_CRISE", label: "CELLULE_CRISE" },
                    { value: "ADMIN", label: "ADMIN" },
                  ]} />
                <Field label={t("coordOpt")} value={newUser.coordination} onChange={sn("coordination")} placeholder="Nord / Sud / Est / Ouest" />
                <Btn onClick={handleCreateUser} color={C.navy} style={{ width: "100%", padding: 13 }}>
                  <IconLabel icon="userPlus">{t("createBtn")}</IconLabel>
                </Btn>
                <div style={{ marginTop: 20, padding: 14, background: C.mist, borderRadius: 12, fontSize: 12, color: C.steel }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>{t("permMatrix")}</div>
                  {[
                    ["ADMIN", lang === "en" ? "All + user management" : "Tout + gestion utilisateurs"],
                    ["CELLULE_CRISE", lang === "en" ? "Predict + RET + history" : "Prédiction + RET + historiques"],
                    ["OPERATEUR", lang === "en" ? "History + model (read)" : "Historiques + info modèle (lecture)"],
                  ].map(([role, desc]) => (
                    <div key={role} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                      <Badge color={role === "ADMIN" ? C.red : role === "CELLULE_CRISE" ? C.navy : C.steel}>{role}</Badge>
                      <span style={{ fontSize: 11, marginTop: 2 }}>{desc}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </main>

        <footer style={{
          background: "linear-gradient(105deg, #050b14 0%, #0A1628 60%, #132844 100%)",
          padding: isMobile ? "22px 16px" : "24px 20px",
          marginTop: "auto",
          borderTop: `3px solid ${C.red}`,
        }}>
          <div style={{
            maxWidth: 1140, margin: "0 auto", display: "flex",
            alignItems: "center", justifyContent: "space-between",
            flexDirection: isMobile ? "column" : "row",
            flexWrap: "wrap", gap: isMobile ? 14 : 16, textAlign: isMobile ? "center" : "left",
          }}>
            <BrandLogo height={isMobile ? 28 : 34} />
            <p style={{
              margin: 0, color: "rgba(255,255,255,0.45)", fontSize: 11,
              lineHeight: 1.5, flex: isMobile ? "none" : 1,
              maxWidth: isMobile ? 280 : "none",
            }}>
              FastAPI · JWT · Scikit-learn · Docker · Nginx<br />
              {t("footer")} · v1.1
            </p>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Une concession de AGL</p>
          </div>
        </footer>

        {selectedReport && (
          <ReportModal item={selectedReport} kind={reportKind} onClose={() => setSelectedReport(null)} />
        )}
      </div>
    </LangCtx.Provider>
  );
}