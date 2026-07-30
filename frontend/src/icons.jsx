/** Professional SVG icons — CAMRAIL UI */
const S = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" };

export function Icon({ name, size = 20, style = {} }) {
  const props = { ...S, width: size, height: size, style: { display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style } };
  const paths = {
    lock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></>,
    clipboard: <><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M9 5H7a2 2 0 00-2 2v13a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/></>,
    chart: <><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-4 3 2 4-6"/></>,
    cpu: <><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9z"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M21 19c0-2.2-1.5-3.8-4-4.5"/></>,
    userPlus: <><circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5"/><path d="M19 8v6M16 11h6"/></>,
    train: <><rect x="4" y="4" width="16" height="12" rx="2"/><circle cx="8" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/><path d="M8 16v3M16 16v3M4 10h16M10 7h4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    check: <><path d="M5 12l5 5L20 7"/></>,
    checkCircle: <><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></>,
    x: <><path d="M6 6l12 12M18 6L6 18"/></>,
    xCircle: <><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></>,
    alert: <><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17h.01"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
    file: <><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path d="M14 3v5h5"/></>,
    download: <><path d="M12 4v12M7 12l5 5 5-5M5 20h14"/></>,
    refresh: <><path d="M21 12a9 9 0 11-2.6-6.2"/><path d="M21 4v5h-5"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 4v16a2 2 0 01-2 2h-4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
    filter: <><path d="M4 5h16l-6 7v5l-4 2v-7L4 5z"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
    pin: <><path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></>,
    star: <><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.3L12 17.5 6.4 20.3l1.1-6.3L3 9.6l6.2-.9L12 3z"/></>,
    activity: <><path d="M3 12h4l2-7 4 14 2-7h6"/></>,
    database: <><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></>,
    shield: <><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    book: <><path d="M4 5a2 2 0 012-2h12v18H6a2 2 0 01-2-2V5z"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
    bolt: <><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></>,
    arrowRight: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    chevronRight: <><path d="M9 6l6 6-6 6"/></>,
    close: <><path d="M6 6l12 12M18 6L6 18"/></>,
    save: <><path d="M5 4h11l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/></>,
    spark: <><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></>,
    list: <><path d="M8 7h12M8 12h12M8 17h12"/><path d="M4 7h.01M4 12h.01M4 17h.01"/></>,
    layers: <><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5M3 18l9 5 9-5"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  };
  return <svg {...props}>{paths[name] || paths.info}</svg>;
}

export function IconLabel({ icon, children, gap = 8, size = 18 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap }}>
      <Icon name={icon} size={size} />
      <span>{children}</span>
    </span>
  );
}
