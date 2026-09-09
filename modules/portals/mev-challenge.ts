/**
 * Detección de la pantalla intermedia de verificación (el "desafío") que la
 * MEV interpone antes de servir una página.
 *
 * Qué se sabe (al 09/09/2026):
 *   - El 08/09/2026 la MEV mostró en el navegador una pantalla con los textos
 *     "Validando acceso" y "verificando si está siendo navegado por un ser
 *     humano" antes de dejar ver el portal.
 *   - Esa pantalla se sirve con HTTP 200. Para un fetch() eso es una respuesta
 *     buena: resp.ok da true, el código sigue, el parser no encuentra ninguno
 *     de los campos del proveído y el documento sale vacío.
 *
 * Qué no se sabe (sin sesión no se puede probar; ver README, sección
 * "Verificación de la MEV"):
 *   - Si la pantalla aparece siempre, por ráfagas, o solo para ciertos pedidos.
 *   - Si el HTML servido coincide con los textos vistos en pantalla.
 *   - Si resolver la verificación en la pestaña deja una cookie que sirva para
 *     los fetch posteriores de la extensión.
 *
 * Por eso la detección es deliberadamente angosta y con red de seguridad: una
 * página que trae la estructura de un proveído nunca se marca como desafío,
 * aunque su texto contenga alguna de las frases buscadas. La frase sola decide
 * únicamente cuando la página además carece de esa estructura.
 *
 * Módulo puro: no usa chrome.*, ni DOM, ni fetch. Se puede testear en node.
 */

/** Frases que identifican la pantalla de verificación. Se buscan sobre texto
 *  normalizado (minúsculas y sin tildes), así que van escritas sin acentos. */
export const MEV_CHALLENGE_MARKERS: readonly string[] = [
  'validando acceso',
  'navegado por un ser humano',
  'verificando si esta siendo navegado',
  'checking your browser',
  'verifying you are human',
  'enable javascript and cookies to continue',
];

/**
 * Piso de tamaño del HTML de un proveído real. Las páginas de la MEV son ASP
 * clásico con tablas: incluso el proveído más corto pasa holgadamente este
 * valor. Una respuesta más chica que esto, y sin la estructura esperada, es una
 * página de tránsito (verificación, redirección, error).
 */
export const MEV_MIN_PROVEIDO_HTML_LENGTH = 1200;

/** Cuántos caracteres de texto visible alcanza con traer para decidir. */
export const MEV_PROBE_SAMPLE_LENGTH = 600;

/** Datos mínimos que hay que traer de la página para poder juzgarla. */
export interface MevPageProbe {
  /** Largo del HTML crudo recibido, en caracteres. */
  htmlLength: number;
  /** Muestra acotada del texto visible de la página (se recorta en el origen). */
  bodyTextSample: string;
  /** true si la página trae al menos una marca estructural de un proveído. */
  hasProveidoStructure: boolean;
}

export type MevPageStatus = 'ok' | 'desafio' | 'respuesta-inesperada';

export interface MevPageVerdict {
  status: MevPageStatus;
  /** Frase o regla que disparó la detección, para el log. */
  marker?: string;
}

export const MEV_CHALLENGE_MESSAGE =
  'La MEV respondió con su pantalla de verificación ("Validando acceso") en vez ' +
  'de la página del expediente. La descarga se detuvo para no generar un PDF sin ' +
  'los despachos. Abrí la pestaña de la MEV, resolvé la verificación hasta ver el ' +
  'expediente en pantalla y volvé a intentar la descarga.';

export const MEV_UNEXPECTED_PAGE_MESSAGE =
  'La MEV devolvió una página que no es la del proveído. La descarga se detuvo ' +
  'para no generar un PDF sin los despachos. Fijate en la pestaña de la MEV que la ' +
  'sesión siga abierta y que el expediente se vea, y volvé a intentar.';

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

/** Devuelve la primera frase de desafío encontrada, o null. */
export function findChallengeMarker(text: string): string | null {
  const normalized = normalizeForMarkers(text);
  for (const marker of MEV_CHALLENGE_MARKERS) {
    if (normalized.includes(marker)) return marker;
  }
  return null;
}

/**
 * Juzga una respuesta de la MEV a partir de la sonda.
 *
 * Regla de oro: si la página trae estructura de proveído, es una página
 * legítima y se procesa, pase lo que pase con el resto de las señales. Eso es
 * lo que impide que un proveído cuyo texto hable de "un ser humano" quede
 * bloqueado por error.
 */
export function detectMevChallenge(probe: MevPageProbe): MevPageVerdict {
  if (probe.hasProveidoStructure) return { status: 'ok' };

  const marker = findChallengeMarker(probe.bodyTextSample);
  if (marker) return { status: 'desafio', marker };

  if (probe.htmlLength < MEV_MIN_PROVEIDO_HTML_LENGTH) {
    return { status: 'desafio', marker: 'respuesta-demasiado-corta' };
  }

  return { status: 'respuesta-inesperada' };
}

/** Texto para mostrarle al usuario según el veredicto. */
export function messageForVerdict(verdict: MevPageVerdict): string {
  return verdict.status === 'respuesta-inesperada'
    ? MEV_UNEXPECTED_PAGE_MESSAGE
    : MEV_CHALLENGE_MESSAGE;
}

/**
 * Versión para HTML crudo, sin sonda estructural: se usa donde solo se tiene el
 * texto de la respuesta (descarga de adjuntos, escaneo del monitoreo). Al no
 * contar con la red de seguridad estructural exige una frase explícita: nunca
 * decide por tamaño.
 */
export function htmlLooksLikeChallenge(html: string): boolean {
  return findChallengeMarker(html) !== null;
}
