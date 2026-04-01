const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");

// Icons
const { FaRocket, FaLock, FaBookmark, FaBell, FaFilePdf, FaMoon, FaCreditCard, FaGoogle, FaChrome, FaCloudUploadAlt, FaGavel, FaClock, FaShieldAlt, FaUsers } = require("react-icons/fa");

// ─── Color palette: Midnight Executive (legal/professional) ───
const C = {
  navy: "1A2744",
  darkNavy: "111B30",
  blue: "2E5090",
  accent: "3B82F6",
  accentLight: "60A5FA",
  gold: "F59E0B",
  white: "FFFFFF",
  offWhite: "F1F5F9",
  lightGray: "E2E8F0",
  gray: "94A3B8",
  darkGray: "64748B",
  text: "1E293B",
  green: "10B981",
  red: "EF4444",
};

// ─── Icon helper ───
function renderIconSvg(IconComponent, color, size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}

async function iconToBase64Png(IconComponent, color, size = 256) {
  const svg = renderIconSvg(IconComponent, color, size);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + pngBuffer.toString("base64");
}

// ─── Shadow factory (fresh objects each time) ───
const cardShadow = () => ({ type: "outer", blur: 4, offset: 2, angle: 135, color: "000000", opacity: 0.1 });

async function buildPresentation() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "ProcuAsist";
  pres.title = "ProcuAsist - Copiloto Legal para Abogados";

  // Pre-render icons
  const icons = {
    rocket: await iconToBase64Png(FaRocket, `#${C.white}`),
    lock: await iconToBase64Png(FaLock, `#${C.white}`),
    bookmark: await iconToBase64Png(FaBookmark, `#${C.white}`),
    bell: await iconToBase64Png(FaBell, `#${C.white}`),
    pdf: await iconToBase64Png(FaFilePdf, `#${C.white}`),
    moon: await iconToBase64Png(FaMoon, `#${C.white}`),
    credit: await iconToBase64Png(FaCreditCard, `#${C.white}`),
    google: await iconToBase64Png(FaGoogle, `#${C.white}`),
    chrome: await iconToBase64Png(FaChrome, `#${C.accent}`),
    cloud: await iconToBase64Png(FaCloudUploadAlt, `#${C.white}`),
    gavel: await iconToBase64Png(FaGavel, `#${C.gold}`),
    clock: await iconToBase64Png(FaClock, `#${C.white}`),
    shield: await iconToBase64Png(FaShieldAlt, `#${C.white}`),
    users: await iconToBase64Png(FaUsers, `#${C.white}`),
    rocketBlue: await iconToBase64Png(FaRocket, `#${C.accent}`),
    lockBlue: await iconToBase64Png(FaLock, `#${C.accent}`),
    bellBlue: await iconToBase64Png(FaBell, `#${C.accent}`),
    pdfBlue: await iconToBase64Png(FaFilePdf, `#${C.accent}`),
    bookmarkBlue: await iconToBase64Png(FaBookmark, `#${C.accent}`),
    clockBlue: await iconToBase64Png(FaClock, `#${C.accent}`),
    cloudBlue: await iconToBase64Png(FaCloudUploadAlt, `#${C.accent}`),
    moonBlue: await iconToBase64Png(FaMoon, `#${C.accent}`),
  };

  // ══════════════════════════════════════════
  // SLIDE 1: Title
  // ══════════════════════════════════════════
  let s1 = pres.addSlide();
  s1.background = { color: C.darkNavy };
  // Decorative accent shape top-right
  s1.addShape(pres.shapes.RECTANGLE, { x: 7, y: 0, w: 3, h: 0.08, fill: { color: C.accent } });
  s1.addShape(pres.shapes.RECTANGLE, { x: 9.92, y: 0, w: 0.08, h: 2, fill: { color: C.accent } });
  // Icon
  s1.addImage({ data: icons.gavel, x: 0.8, y: 1.2, w: 0.7, h: 0.7 });
  // Title
  s1.addText("ProcuAsist", { x: 0.8, y: 2.0, w: 8, h: 1.0, fontSize: 48, fontFace: "Trebuchet MS", bold: true, color: C.white, margin: 0 });
  s1.addText("Copiloto Legal para Abogados Argentinos", { x: 0.8, y: 2.9, w: 8, h: 0.6, fontSize: 22, fontFace: "Calibri", color: C.accentLight, margin: 0 });
  // Tagline
  s1.addText("Automatiza tus tareas en portales judiciales de la Provincia de Buenos Aires y Nacion", {
    x: 0.8, y: 3.7, w: 7, h: 0.5, fontSize: 14, fontFace: "Calibri", color: C.gray, margin: 0
  });
  // Chrome badge
  s1.addImage({ data: icons.chrome, x: 0.8, y: 4.6, w: 0.3, h: 0.3 });
  s1.addText("Extension para Google Chrome", { x: 1.2, y: 4.6, w: 4, h: 0.3, fontSize: 12, fontFace: "Calibri", color: C.darkGray, margin: 0 });

  // ══════════════════════════════════════════
  // SLIDE 2: The Problem
  // ══════════════════════════════════════════
  let s2 = pres.addSlide();
  s2.background = { color: C.offWhite };
  s2.addText("El problema", { x: 0.7, y: 0.4, w: 8, h: 0.7, fontSize: 36, fontFace: "Trebuchet MS", bold: true, color: C.navy, margin: 0 });
  s2.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.1, w: 1.5, h: 0.04, fill: { color: C.accent } });

  const problems = [
    { title: "Login repetitivo", desc: "Ingresar usuario y clave cada vez que la sesion expira (cada 15-20 minutos)" },
    { title: "Seguimiento manual", desc: "Revisar causa por causa para ver si hay movimientos nuevos" },
    { title: "Sin organizacion", desc: "No hay forma rapida de acceder a las causas que mas importan" },
    { title: "Tiempo perdido", desc: "Horas semanales en tareas mecanicas que no agregan valor al cliente" },
  ];

  problems.forEach((p, i) => {
    const y = 1.5 + i * 0.95;
    s2.addShape(pres.shapes.RECTANGLE, { x: 0.7, y, w: 8.6, h: 0.8, fill: { color: C.white }, shadow: cardShadow() });
    s2.addShape(pres.shapes.RECTANGLE, { x: 0.7, y, w: 0.06, h: 0.8, fill: { color: C.red } });
    s2.addText(p.title, { x: 1.1, y, w: 3, h: 0.8, fontSize: 16, fontFace: "Calibri", bold: true, color: C.text, valign: "middle", margin: 0 });
    s2.addText(p.desc, { x: 3.8, y, w: 5.3, h: 0.8, fontSize: 13, fontFace: "Calibri", color: C.darkGray, valign: "middle", margin: 0 });
  });

  // ══════════════════════════════════════════
  // SLIDE 3: The Solution
  // ══════════════════════════════════════════
  let s3 = pres.addSlide();
  s3.background = { color: C.navy };
  s3.addText("La solucion", { x: 0.7, y: 0.4, w: 8, h: 0.7, fontSize: 36, fontFace: "Trebuchet MS", bold: true, color: C.white, margin: 0 });
  s3.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.1, w: 1.5, h: 0.04, fill: { color: C.gold } });

  s3.addText("Una extension de Chrome que se integra directamente en los portales judiciales y automatiza las tareas repetitivas del dia a dia.", {
    x: 0.7, y: 1.4, w: 8.6, h: 0.7, fontSize: 16, fontFace: "Calibri", color: C.lightGray, margin: 0
  });

  const solutions = [
    { icon: icons.rocket, title: "Auto-login", desc: "Entra a los portales sin escribir credenciales" },
    { icon: icons.clock, title: "Sesion activa", desc: "Mantiene la sesion viva y reconecta si expira" },
    { icon: icons.bell, title: "Alertas", desc: "Te avisa cuando hay movimientos nuevos" },
    { icon: icons.pdf, title: "PDFs", desc: "Genera expedientes en PDF con un click" },
    { icon: icons.bookmark, title: "Marcadores", desc: "Acceso rapido a las causas que importan" },
    { icon: icons.cloud, title: "Sync", desc: "Tus datos sincronizados entre dispositivos" },
  ];

  solutions.forEach((s, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.7 + col * 3.1;
    const y = 2.4 + row * 1.5;
    s3.addShape(pres.shapes.RECTANGLE, { x, y, w: 2.8, h: 1.3, fill: { color: C.blue }, shadow: cardShadow() });
    s3.addImage({ data: s.icon, x: x + 0.2, y: y + 0.2, w: 0.35, h: 0.35 });
    s3.addText(s.title, { x: x + 0.65, y: y + 0.15, w: 2, h: 0.4, fontSize: 15, fontFace: "Calibri", bold: true, color: C.white, margin: 0 });
    s3.addText(s.desc, { x: x + 0.2, y: y + 0.65, w: 2.4, h: 0.5, fontSize: 12, fontFace: "Calibri", color: C.lightGray, margin: 0 });
  });

  // ══════════════════════════════════════════
  // SLIDE 4: Features deep-dive
  // ══════════════════════════════════════════
  let s4 = pres.addSlide();
  s4.background = { color: C.offWhite };
  s4.addText("Funcionalidades principales", { x: 0.7, y: 0.4, w: 8, h: 0.7, fontSize: 36, fontFace: "Trebuchet MS", bold: true, color: C.navy, margin: 0 });
  s4.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.1, w: 1.5, h: 0.04, fill: { color: C.accent } });

  const features = [
    { icon: icons.rocketBlue, title: "Auto-login inteligente", desc: "Detecta la pagina de login, completa credenciales y entra automaticamente. Funciona en MEV, PJN y SCBA." },
    { icon: icons.clockBlue, title: "Keep-alive y reconexion", desc: "Mantiene las sesiones activas en segundo plano. Si expira, se reconecta y vuelve a la pagina donde estabas." },
    { icon: icons.bellBlue, title: "Monitoreo de causas", desc: "Escanea tus causas periodicamente y te envia notificaciones Chrome cuando detecta movimientos nuevos." },
    { icon: icons.pdfBlue, title: "Generacion de PDF", desc: "Exporta expedientes completos a PDF: caratula, juzgado, movimientos y fechas. Un click, descarga directa." },
    { icon: icons.bookmarkBlue, title: "Marcadores rapidos", desc: "Guarda causas como favoritos para acceder sin buscar. Busca por numero, caratula o juzgado." },
    { icon: icons.cloudBlue, title: "Sincronizacion en la nube", desc: "Tus marcadores, monitores y configuracion se sincronizan entre computadoras via Supabase." },
    { icon: icons.moonBlue, title: "Modo oscuro", desc: "Tema oscuro para la extension y las paginas de los portales. Menos fatiga visual en jornadas largas." },
    { icon: icons.lockBlue, title: "Seguridad avanzada", desc: "Credenciales encriptadas con AES-256-GCM. Protegidas con PIN personal. Nunca salen de tu computadora." },
  ];

  features.forEach((f, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.7 + col * 4.6;
    const y = 1.35 + row * 1.0;
    s4.addImage({ data: f.icon, x, y: y + 0.12, w: 0.3, h: 0.3 });
    s4.addText(f.title, { x: x + 0.45, y, w: 3.8, h: 0.35, fontSize: 14, fontFace: "Calibri", bold: true, color: C.text, valign: "middle", margin: 0 });
    s4.addText(f.desc, { x: x + 0.45, y: y + 0.35, w: 3.8, h: 0.55, fontSize: 11, fontFace: "Calibri", color: C.darkGray, margin: 0 });
  });

  // ══════════════════════════════════════════
  // SLIDE 5: Portals
  // ══════════════════════════════════════════
  let s5 = pres.addSlide();
  s5.background = { color: C.offWhite };
  s5.addText("Portales soportados", { x: 0.7, y: 0.4, w: 8, h: 0.7, fontSize: 36, fontFace: "Trebuchet MS", bold: true, color: C.navy, margin: 0 });
  s5.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.1, w: 1.5, h: 0.04, fill: { color: C.accent } });

  const portals = [
    { name: "MEV", full: "Mesa de Entradas Virtual", org: "Suprema Corte de Buenos Aires", url: "mev.scba.gov.ar", features: "Auto-login, extraccion de causas, monitoreo de movimientos, generacion de PDF, descarga de adjuntos, seleccion de departamento judicial" },
    { name: "PJN", full: "Poder Judicial de la Nacion", org: "Justicia Nacional y Federal", url: "eje.jus.gov.ar", features: "Auto-login, extraccion de causas, monitoreo de movimientos, keep-alive de sesion" },
    { name: "SCBA Notif.", full: "SCBA Notificaciones", org: "Suprema Corte de Buenos Aires", url: "notificaciones.scba.gov.ar", features: "Importacion de notificaciones al panel lateral, acceso rapido desde marcadores" },
  ];

  portals.forEach((p, i) => {
    const y = 1.4 + i * 1.3;
    s5.addShape(pres.shapes.RECTANGLE, { x: 0.7, y, w: 8.6, h: 1.1, fill: { color: C.white }, shadow: cardShadow() });
    // Badge
    s5.addShape(pres.shapes.RECTANGLE, { x: 0.9, y: y + 0.2, w: 1.2, h: 0.7, fill: { color: C.navy } });
    s5.addText(p.name, { x: 0.9, y: y + 0.2, w: 1.2, h: 0.7, fontSize: 18, fontFace: "Trebuchet MS", bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
    // Info
    s5.addText(p.full, { x: 2.3, y: y + 0.1, w: 4, h: 0.35, fontSize: 15, fontFace: "Calibri", bold: true, color: C.text, margin: 0 });
    s5.addText(`${p.org}  |  ${p.url}`, { x: 2.3, y: y + 0.4, w: 5, h: 0.25, fontSize: 11, fontFace: "Calibri", color: C.darkGray, margin: 0 });
    s5.addText(p.features, { x: 2.3, y: y + 0.65, w: 6.8, h: 0.35, fontSize: 11, fontFace: "Calibri", color: C.gray, margin: 0 });
  });

  // ══════════════════════════════════════════
  // SLIDE 6: Security
  // ══════════════════════════════════════════
  let s6 = pres.addSlide();
  s6.background = { color: C.navy };
  s6.addText("Seguridad", { x: 0.7, y: 0.4, w: 8, h: 0.7, fontSize: 36, fontFace: "Trebuchet MS", bold: true, color: C.white, margin: 0 });
  s6.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.1, w: 1.5, h: 0.04, fill: { color: C.gold } });

  s6.addText("La seguridad de tus credenciales es nuestra prioridad. Todo se encripta localmente.", {
    x: 0.7, y: 1.35, w: 8.6, h: 0.5, fontSize: 15, fontFace: "Calibri", color: C.lightGray, margin: 0
  });

  const secFeatures = [
    { icon: icons.lock, title: "AES-256-GCM", desc: "El mismo cifrado que usan los bancos. Tus credenciales se encriptan en tu computadora." },
    { icon: icons.shield, title: "PIN personal", desc: "Solo vos podes desencriptar tus datos. El PIN nunca se almacena." },
    { icon: icons.google, title: "OAuth con Google", desc: "Login seguro sin crear otra cuenta ni recordar otra clave." },
    { icon: icons.cloud, title: "Datos locales", desc: "Las credenciales nunca salen de tu computadora. Solo marcadores y config se sincronizan." },
  ];

  secFeatures.forEach((f, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.7 + col * 4.6;
    const y = 2.2 + row * 1.5;
    s6.addShape(pres.shapes.RECTANGLE, { x, y, w: 4.3, h: 1.25, fill: { color: C.blue }, shadow: cardShadow() });
    s6.addImage({ data: f.icon, x: x + 0.25, y: y + 0.25, w: 0.4, h: 0.4 });
    s6.addText(f.title, { x: x + 0.8, y: y + 0.15, w: 3.2, h: 0.4, fontSize: 16, fontFace: "Calibri", bold: true, color: C.white, valign: "middle", margin: 0 });
    s6.addText(f.desc, { x: x + 0.25, y: y + 0.65, w: 3.8, h: 0.5, fontSize: 12, fontFace: "Calibri", color: C.lightGray, margin: 0 });
  });

  // ══════════════════════════════════════════
  // SLIDE 7: Plans & Pricing
  // ══════════════════════════════════════════
  let s7 = pres.addSlide();
  s7.background = { color: C.offWhite };
  s7.addText("Planes", { x: 0.7, y: 0.4, w: 8, h: 0.7, fontSize: 36, fontFace: "Trebuchet MS", bold: true, color: C.navy, margin: 0 });
  s7.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.1, w: 1.5, h: 0.04, fill: { color: C.accent } });

  const plans = [
    { name: "Free", price: "Gratis", features: ["3 marcadores", "1 monitor", "5 PDFs/mes", "Auto-login", "Keep-alive"], color: C.darkGray, highlight: false },
    { name: "Junior", price: "$8.900/mes", features: ["50 marcadores", "50 monitores", "50 PDFs/mes", "Todo lo de Free", "Soporte prioritario"], color: C.accent, highlight: true },
    { name: "Senior", price: "$15.275/mes", features: ["500 marcadores", "500 monitores", "PDFs ilimitados", "Todo lo de Junior", "Para estudios"], color: C.navy, highlight: false },
  ];

  plans.forEach((p, i) => {
    const x = 0.7 + i * 3.15;
    const w = 2.85;
    const y = 1.4;
    const h = 3.8;

    s7.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.white }, shadow: cardShadow() });
    if (p.highlight) {
      s7.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.06, fill: { color: C.accent } });
    }
    // Header
    s7.addShape(pres.shapes.RECTANGLE, { x: x + 0.3, y: y + 0.3, w: w - 0.6, h: 0.7, fill: { color: p.color } });
    s7.addText(p.name, { x: x + 0.3, y: y + 0.3, w: w - 0.6, h: 0.7, fontSize: 20, fontFace: "Trebuchet MS", bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
    // Price
    s7.addText(p.price, { x, y: y + 1.2, w, h: 0.5, fontSize: 22, fontFace: "Calibri", bold: true, color: C.text, align: "center", margin: 0 });
    // Features
    const featureText = p.features.map((f, fi) => ({
      text: f,
      options: { bullet: true, breakLine: fi < p.features.length - 1, fontSize: 12, color: C.darkGray }
    }));
    s7.addText(featureText, { x: x + 0.3, y: y + 1.8, w: w - 0.6, h: 1.8, fontFace: "Calibri", margin: 0 });
  });

  // Payment info
  s7.addText("Pago seguro via MercadoPago. Tarjeta, transferencia, Rapipago, Pago Facil.", {
    x: 0.7, y: 5.15, w: 8.6, h: 0.3, fontSize: 11, fontFace: "Calibri", color: C.gray, align: "center", margin: 0
  });

  // ══════════════════════════════════════════
  // SLIDE 8: Tech Stack
  // ══════════════════════════════════════════
  let s8 = pres.addSlide();
  s8.background = { color: C.offWhite };
  s8.addText("Stack tecnologico", { x: 0.7, y: 0.4, w: 8, h: 0.7, fontSize: 36, fontFace: "Trebuchet MS", bold: true, color: C.navy, margin: 0 });
  s8.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.1, w: 1.5, h: 0.04, fill: { color: C.accent } });

  const techRows = [
    ["Extension", "WXT 0.20 (Manifest V3)", "Framework moderno para extensiones Chrome"],
    ["Frontend", "React 19 + TypeScript 5.9", "UI reactiva con tipado estricto"],
    ["Estilos", "Tailwind CSS v4", "Diseno rapido y consistente"],
    ["Backend", "Supabase", "Auth + PostgreSQL + Edge Functions + RLS"],
    ["Pagos", "MercadoPago API", "Checkout Preferences para suscripciones"],
    ["Crypto", "Web Crypto API", "PBKDF2 + AES-256-GCM nativo del navegador"],
    ["PDF", "jsPDF 4", "Generacion de PDFs del lado del cliente"],
    ["State", "Zustand + chrome.storage", "Estrategia local-first"],
  ];

  // Table header
  s8.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.35, w: 8.6, h: 0.45, fill: { color: C.navy } });
  s8.addText("Componente", { x: 0.8, y: 1.35, w: 2, h: 0.45, fontSize: 12, fontFace: "Calibri", bold: true, color: C.white, valign: "middle", margin: 0 });
  s8.addText("Tecnologia", { x: 2.8, y: 1.35, w: 3, h: 0.45, fontSize: 12, fontFace: "Calibri", bold: true, color: C.white, valign: "middle", margin: 0 });
  s8.addText("Descripcion", { x: 5.8, y: 1.35, w: 3.5, h: 0.45, fontSize: 12, fontFace: "Calibri", bold: true, color: C.white, valign: "middle", margin: 0 });

  techRows.forEach((row, i) => {
    const y = 1.8 + i * 0.45;
    const bg = i % 2 === 0 ? C.white : C.offWhite;
    s8.addShape(pres.shapes.RECTANGLE, { x: 0.7, y, w: 8.6, h: 0.45, fill: { color: bg } });
    s8.addText(row[0], { x: 0.8, y, w: 2, h: 0.45, fontSize: 12, fontFace: "Calibri", bold: true, color: C.text, valign: "middle", margin: 0 });
    s8.addText(row[1], { x: 2.8, y, w: 3, h: 0.45, fontSize: 12, fontFace: "Calibri", color: C.accent, valign: "middle", margin: 0 });
    s8.addText(row[2], { x: 5.8, y, w: 3.5, h: 0.45, fontSize: 11, fontFace: "Calibri", color: C.darkGray, valign: "middle", margin: 0 });
  });

  // ══════════════════════════════════════════
  // SLIDE 9: How it works (Flow)
  // ══════════════════════════════════════════
  let s9 = pres.addSlide();
  s9.background = { color: C.navy };
  s9.addText("Como funciona", { x: 0.7, y: 0.4, w: 8, h: 0.7, fontSize: 36, fontFace: "Trebuchet MS", bold: true, color: C.white, margin: 0 });
  s9.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.1, w: 1.5, h: 0.04, fill: { color: C.gold } });

  const steps = [
    { num: "1", title: "Instala la extension", desc: "Descarga el .zip y cargalo en Chrome" },
    { num: "2", title: "Inicia sesion con Google", desc: "Un click, sin crear cuentas nuevas" },
    { num: "3", title: "Configura tu PIN y credenciales", desc: "Se encriptan localmente en tu PC" },
    { num: "4", title: "Navega a un portal judicial", desc: "ProcuAsist te logea automaticamente" },
    { num: "5", title: "Trabaja con el panel lateral", desc: "Marcadores, monitores, PDFs, alertas" },
  ];

  steps.forEach((step, i) => {
    const y = 1.5 + i * 0.8;
    // Number circle
    s9.addShape(pres.shapes.OVAL, { x: 0.9, y: y + 0.05, w: 0.5, h: 0.5, fill: { color: C.accent } });
    s9.addText(step.num, { x: 0.9, y: y + 0.05, w: 0.5, h: 0.5, fontSize: 18, fontFace: "Calibri", bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
    // Connector line
    if (i < steps.length - 1) {
      s9.addShape(pres.shapes.LINE, { x: 1.15, y: y + 0.55, w: 0, h: 0.3, line: { color: C.accent, width: 2 } });
    }
    // Text
    s9.addText(step.title, { x: 1.7, y: y - 0.02, w: 7, h: 0.35, fontSize: 16, fontFace: "Calibri", bold: true, color: C.white, margin: 0 });
    s9.addText(step.desc, { x: 1.7, y: y + 0.3, w: 7, h: 0.3, fontSize: 13, fontFace: "Calibri", color: C.gray, margin: 0 });
  });

  // ══════════════════════════════════════════
  // SLIDE 10: Roadmap
  // ══════════════════════════════════════════
  let s10 = pres.addSlide();
  s10.background = { color: C.offWhite };
  s10.addText("Roadmap futuro", { x: 0.7, y: 0.4, w: 8, h: 0.7, fontSize: 36, fontFace: "Trebuchet MS", bold: true, color: C.navy, margin: 0 });
  s10.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.1, w: 1.5, h: 0.04, fill: { color: C.accent } });

  const roadmap = [
    { phase: "v0.2", items: "Tests automatizados, mejora de UI, optimizacion de performance" },
    { phase: "v0.3", items: "Nuevos portales: CABA, Santa Fe, Cordoba" },
    { phase: "v0.4", items: "IA para analisis de expedientes y resumen automatico" },
    { phase: "v1.0", items: "Publicacion en Chrome Web Store, app mobile companion" },
  ];

  roadmap.forEach((r, i) => {
    const y = 1.5 + i * 0.95;
    s10.addShape(pres.shapes.RECTANGLE, { x: 0.7, y, w: 8.6, h: 0.75, fill: { color: C.white }, shadow: cardShadow() });
    s10.addShape(pres.shapes.RECTANGLE, { x: 0.7, y, w: 0.06, h: 0.75, fill: { color: C.accent } });
    // Badge
    s10.addShape(pres.shapes.RECTANGLE, { x: 1.0, y: y + 0.15, w: 0.9, h: 0.45, fill: { color: C.accent } });
    s10.addText(r.phase, { x: 1.0, y: y + 0.15, w: 0.9, h: 0.45, fontSize: 14, fontFace: "Calibri", bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
    s10.addText(r.items, { x: 2.2, y, w: 7, h: 0.75, fontSize: 14, fontFace: "Calibri", color: C.text, valign: "middle", margin: 0 });
  });

  // ══════════════════════════════════════════
  // SLIDE 11: CTA / Closing
  // ══════════════════════════════════════════
  let s11 = pres.addSlide();
  s11.background = { color: C.darkNavy };
  // Decorative
  s11.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 3, h: 0.08, fill: { color: C.accent } });
  s11.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.08, h: 2, fill: { color: C.accent } });

  s11.addImage({ data: icons.gavel, x: 4.4, y: 1.0, w: 1.2, h: 1.2 });
  s11.addText("ProcuAsist", { x: 0.7, y: 2.3, w: 8.6, h: 0.8, fontSize: 44, fontFace: "Trebuchet MS", bold: true, color: C.white, align: "center", margin: 0 });
  s11.addText("Tu copiloto legal en los portales judiciales", { x: 0.7, y: 3.1, w: 8.6, h: 0.5, fontSize: 20, fontFace: "Calibri", color: C.accentLight, align: "center", margin: 0 });

  s11.addShape(pres.shapes.RECTANGLE, { x: 3.5, y: 3.9, w: 3, h: 0.04, fill: { color: C.gold } });

  s11.addText("Automatiza. Organiza. Monitorea.", { x: 0.7, y: 4.2, w: 8.6, h: 0.4, fontSize: 16, fontFace: "Calibri", color: C.gray, align: "center", margin: 0 });
  s11.addText("github.com/blancoilari/procu-asist", { x: 0.7, y: 4.8, w: 8.6, h: 0.3, fontSize: 13, fontFace: "Calibri", color: C.darkGray, align: "center", margin: 0 });

  // Save
  await pres.writeFile({ fileName: "C:/Users/Patricio/proyectos/plugin turbolex/docs/ProcuAsist-Presentacion.pptx" });
  console.log("Presentation saved!");
}

buildPresentation().catch(console.error);
