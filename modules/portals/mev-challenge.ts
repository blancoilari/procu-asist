/**
 * Clasificación de las respuestas de la MEV y detección de su pantalla de
 * verificación ("Validando acceso").
 *
 * Qué se sabe (medido el 22/09/2026 contra el portal, con sesión real):
 *   - La MEV tiene un nginx delante del servidor ASP con un límite de unos 30
 *     pedidos de proveídos por minuto. Pasado el límite, TODA página
 *     responde, en la misma dirección y con HTTP 200, una pantalla de 2.000
 *     bytes con título "Validando acceso...", un script de Cloudflare
 *     Turnstile (challenges.cloudflare.com/turnstile) y ningún texto visible
 *     en el cuerpo: el texto que se ve lo arma un script. Por eso la
 *     detección del 09/09/2026, que buscaba las frases en el texto visible,
 *     no la reconocía y la descarga la tomaba por "página inesperada".
 *   - La página de login no carga Turnstile y su título es "Mesa de Entradas
 *     Virtual": el título alcanza para distinguirlas.
 *   - proveido.asp pedido sin que la sesión haya pasado antes por la ficha de
 *     esa causa (procesales.asp) redirige a busqueda.asp.
 *
 * Qué no se sabe: si la ficha y los adjuntos cuentan para el límite, si va
 * por usuario o por IP, y si pasar la verificación a mano acorta el bloqueo.
 *
 * Regla de oro, igual que antes: una página con estructura de proveído nunca
 * se marca como verificación, aunque su texto contenga las frases.
 *
 * Módulo puro: no usa chrome.*, ni DOM, ni fetch. Se prueba en node.
 */

/** Frases de la pantalla de verificación, sin acentos (se buscan normalizadas). */
export const MEV_CHALLENGE_MARKERS: readonly string[] = [
  'validando acceso',
  'navegado por un ser humano',
  'verificando si esta siendo navegado',
  'checking your browser',
  'verifying you are human',
  'enable javascript and cookies to continue',
];

/** Piso de tamaño del HTML de un proveído real. */
export const MEV_MIN_PROVEIDO_HTML_LENGTH = 1200;

/** Cuántos caracteres de texto visible se traen de la página. */
export const MEV_PROBE_SAMPLE_LENGTH = 600;

/**
 * Cuánto HTML crudo se trae para buscar las frases fuera del texto visible.
 * La pantalla de verificación entera mide 2.000 y el formulario de login
 * aparece antes del carácter 3.000 de su página.
 */
export const MEV_RAW_SAMPLE_LENGTH = 8000;

const TITLE_MARKER = 'validando acceso';
const TURNSTILE_SRC = /challenges\.cloudflare\.com\/turnstile/i;
const TITLE_TAG = /<title[^>]*>([\s\S]*?)<\/title>/i;

/** Datos mínimos de la respuesta para poder juzgarla. */
export interface MevPageProbe {
  /** Largo del HTML crudo recibido, en caracteres. */
  htmlLength: number;
  /** Muestra acotada del texto visible (sin scripts ni estilos). */
  bodyTextSample: string;
  /** true si la página trae al menos una marca estructural de un proveído. */
  hasProveidoStructure: boolean;
  /** Título del documento. */
  title?: string;
  /** true si la página carga el script de Cloudflare Turnstile. */
  hasTurnstile?: boolean;
  /** Ruta final después de las redirecciones, en minúsculas (p. ej. '/busqueda.asp'). */
  finalPath?: string;
  /** true si la página es el formulario de login (usuario y clave). */
  looksLikeLogin?: boolean;
  /** Comienzo del HTML crudo, para buscar las frases fuera del texto visible. */
  rawHtmlSample?: string;
}

export type MevPageStatus = 'ok' | 'desafio' | 'login' | 'sin-contexto' | 'respuesta-inesperada';

export interface MevPageVerdict {
  status: MevPageStatus;
  /** Regla que decidió, para el log. */
  marker?: string;
}

/** Marcas de combinación Unicode (los acentos que deja NFD). */
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Minúsculas, sin tildes y con los espacios colapsados. */
export function normalizeForMarkers(text: string): string {
  return text
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Devuelve la primera frase de verificación encontrada, o null. */
export function findChallengeMarker(text: string): string | null {
  const normalized = normalizeForMarkers(text);
  for (const marker of MEV_CHALLENGE_MARKERS) {
    if (normalized.includes(marker)) return marker;
  }
  return null;
}

/** ¿El título es el de la pantalla de verificación? */
export function isChallengeTitle(title: string | null | undefined): boolean {
  return !!title && normalizeForMarkers(title).includes(TITLE_MARKER);
}

/**
 * Juzga una respuesta de la MEV a partir de la sonda. El orden importa: la
 * estructura de proveído gana siempre; después las señales propias de la
 * verificación (título y frases); después el login y la búsqueda; y recién
 * al final las señales débiles (Turnstile solo, tamaño).
 */
export function classifyMevPage(probe: MevPageProbe): MevPageVerdict {
  if (probe.hasProveidoStructure) return { status: 'ok' };
  if (isChallengeTitle(probe.title)) return { status: 'desafio', marker: 'titulo' };
  const phrase =
    findChallengeMarker(probe.bodyTextSample) ?? findChallengeMarker(probe.rawHtmlSample ?? '');
  if (phrase) return { status: 'desafio', marker: phrase };
  if (probe.looksLikeLogin) return { status: 'login', marker: 'formulario-de-login' };
  if ((probe.finalPath ?? '').toLowerCase().endsWith('/busqueda.asp')) {
    return { status: 'sin-contexto', marker: 'busqueda' };
  }
  if (probe.hasTurnstile) return { status: 'desafio', marker: 'turnstile' };
  if (probe.htmlLength < MEV_MIN_PROVEIDO_HTML_LENGTH) {
    return { status: 'desafio', marker: 'respuesta-demasiado-corta' };
  }
  return { status: 'respuesta-inesperada' };
}

/** Texto corto de qué devolvió la MEV, para el informe de faltantes. */
export function describeProbe(probe: MevPageProbe): string {
  const parts: string[] = [];
  if (probe.finalPath) parts.push(`página ${probe.finalPath}`);
  if (probe.title) parts.push(`título "${probe.title.trim().slice(0, 60)}"`);
  parts.push(`${probe.htmlLength} caracteres`);
  return parts.join(', ');
}

/**
 * Versión para HTML crudo (adjuntos, reingreso a la ficha, monitoreo):
 * reconoce el título de la pantalla, el script de Turnstile o una frase
 * conocida. Nunca decide por tamaño.
 */
export function htmlLooksLikeChallenge(html: string): boolean {
  const title = html.match(TITLE_TAG)?.[1];
  if (isChallengeTitle(title)) return true;
  if (TURNSTILE_SRC.test(html)) return true;
  return findChallengeMarker(html) !== null;
}

/** ¿El HTML es el formulario de login de la MEV? */
export function htmlLooksLikeLogin(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes('ingrese los datos del usuario') ||
    (lower.includes('name="usuario"') && lower.includes('name="clave"'))
  );
}
