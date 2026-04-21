/**
 * PJN (Poder Judicial de la Nación) portal selectors and URL patterns.
 *
 * Two subsystems in scope for v0.6.0 (see docs/plans/pjn-implementation.md):
 * - portalpjn.pjn.gov.ar + api.pjn.gov.ar → SPA + REST (M2)
 * - scw.pjn.gov.ar → JBoss Seam + JSF, ISO-8859-1 (M3+)
 *
 * JSF dynamic ids (j_idtNN) MUST NOT be used as anchors — they change between
 * sessions/deploys. Anchor on header text, stable classes, href fragments.
 */

export const PJN_SCW_BASE_URL = 'https://scw.pjn.gov.ar';

export const PJN_SCW_PATHS = {
  home: '/scw/homePrivado.seam',
  relacionados: '/scw/consultaListaRelacionados.seam',
  favoritos: '/scw/consultaListaFavoritos.seam',
  radicaciones: '/scw/consultaListaNoIniciados.seam',
  expediente: '/scw/expediente.seam',
  viewer: '/scw/viewer.seam',
} as const;

/**
 * Partial header texts (normalized: lowercase, no accents) we try to match
 * in the listing table to infer which column is which.
 */
export const PJN_LIST_HEADERS = {
  expediente: 'expediente',
  dependencia: 'dependencia',
  caratula: 'caratula',
  situacion: 'situacion',
  ultimaActualizacion: 'ult',
  favorito: 'favorito',
  quitar: 'quitar',
} as const;

export type PjnHeaderKey = keyof typeof PJN_LIST_HEADERS;

export const PJN_SELECTORS = {
  scw: {
    /**
     * Candidate selectors for the main listing table, tried in order.
     * SCW renders layout tables for styling too — we still need the header
     * heuristic in the parser to pick the right one.
     */
    listTableCandidates: [
      'table.rf-dt',
      'table.datagrid',
      'table.table',
      'table',
    ],
    /** Eye icon anchor in each row — links to expediente.seam?cid=... */
    detailLink: 'a[href*="expediente.seam"]',
    /** Star toggle in Relacionados rows (§5.7 of the plan) */
    favoritoLink: 'a[id$=":favorito:outputLink"]',
    favoritoLinkFallback: 'a[href*="favorito"], a[id*="favorito"]',
  },
} as const;
