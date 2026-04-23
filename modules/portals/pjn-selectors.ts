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
  /**
   * Página dedicada de actuaciones históricas. "Ver históricas" en
   * expediente.seam es un link — no un botón AJAX — que navega a esta URL
   * con el mismo `cid`. Acá se listan las actuaciones antiguas paginadas.
   */
  actuacionesHistoricas: '/scw/actuacionesHistoricas.seam',
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

/**
 * Header fragments for the Actuaciones tab columns (plan §5.5.3).
 */
export const PJN_ACTUACIONES_HEADERS = {
  oficina: 'oficina',
  fecha: 'fecha',
  tipo: 'tipo',
  descripcion: 'descrip',
  foja: 'fs',
} as const;

export type PjnActuacionHeaderKey = keyof typeof PJN_ACTUACIONES_HEADERS;

/**
 * Header fragments for the Intervinientes > PARTES table (plan §5.5.4).
 */
export const PJN_INTERVINIENTES_HEADERS = {
  tipo: 'tipo',
  nombre: 'nombre',
  tomoFolio: 'tomo',
  iej: 'e.j',
} as const;

export type PjnIntervinienteHeaderKey = keyof typeof PJN_INTERVINIENTES_HEADERS;

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
  expediente: {
    /** Tab strip uses PrimeFaces/RichFaces; the four tabs in order per plan §5.5.2 */
    tabNames: ['actuaciones', 'intervinientes', 'vinculados', 'recursos'] as const,
    /**
     * Active tab indicators, in order of preference. The first matching
     * element is treated as the currently-visible tab.
     */
    activeTabCandidates: [
      '[role="tab"][aria-selected="true"]',
      '.ui-tabs-selected',
      '.rf-tab-lbl-act',
      'li.active[role="tab"]',
    ],
    /** All tab labels, to enumerate them by name. */
    tabLabelCandidates: [
      '[role="tab"]',
      '.ui-tabs-header',
      '.rf-tab-hdr',
    ],
    /**
     * "Ver históricas" button (plan §5.5.3). Detected by text, not id, since
     * the control could be <button>, <a> or <input type=button> in JSF.
     */
    verHistoricasPattern: /ver\s+hist[óo]ricas/i,
    /** Notas block label at the bottom of the actuaciones tab. */
    notasLabelPattern: /^notas\b/i,
  },
} as const;
