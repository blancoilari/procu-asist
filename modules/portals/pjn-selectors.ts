/**
 * PJN/EJE (Expediente Judicial Electrónico) portal selectors and URL patterns.
 *
 * Portal: https://eje.jus.gov.ar (Federal)
 *         https://eje.juscaba.gob.ar (CABA — same stack)
 * Tech: Angular 6 SPA (IURIX), Keycloak SSO, REST API
 *
 * Authentication goes through Keycloak at sso.pjn.gov.ar.
 * The portal is a full SPA with Angular Material components.
 */

export const PJN_BASE_URL = 'https://eje.jus.gov.ar';
export const PJN_API_BASE = 'https://eje.jus.gov.ar/iol-api';

/** Keycloak SSO URLs */
export const PJN_SSO = {
  base: 'https://sso.pjn.gov.ar',
  realm: 'pjn',
  loginFormId: '#kc-form-login',
  usernameField: '#username',
  passwordField: '#password',
  submitButton: '#kc-login',
} as const;

/** SPA route patterns */
export const PJN_ROUTES = {
  home: '/iol-ui/p/inicio',
  search: '/iol-ui/p/expedientes',
  /** Case detail opens inline within search results — no separate URL */
} as const;

/** API endpoints (relative to PJN_API_BASE) */
export const PJN_API = {
  /** POST — search cases. Body: info={"filter":"{...}","tipoBusqueda":"CAU","page":1,"size":10} */
  searchCases: '/api/public/expedientes/lista',
  /** GET ?expId=X — case header (CUIJ, carátula, fecha, estado) */
  caseHeader: '/api/public/expedientes/encabezado',
  /** GET ?expId=X — last action on case */
  lastAction: '/api/public/expedientes/ultimaAccion',
  /** GET ?filtro={...}&page=0&size=N — actuaciones/movements */
  actuaciones: '/api/public/expedientes/actuaciones',
  /** GET ?expId=X — access permissions */
  caseAccess: '/api/public/expedientes/accesosExpediente',
  /** GET — current user data (204 if not logged in) */
  userData: '/api/public/usuario/buscarMisDatos',
  /** GET — session info */
  session: '/session',
  /** GET — keycloak config for the portal */
  keycloakConfig: '/api/public/ui/configuracion/keycloak',
} as const;

/** DOM selectors for the Angular SPA */
export const PJN_SELECTORS = {
  /** Root Angular app component */
  appRoot: 'iol-root',

  /** Search interface */
  search: {
    /** Search type dropdown (CAUSAS/PERSONAS) */
    typeSelector: '#menuOpciones',
    /** Search text input */
    input: '#inputSearch',
    /** Submit search button (has search icon) */
    submitButton: '#custom-search-input button[mat-icon-button]',
  },

  /** Case result cards */
  results: {
    /** Each result card is an iol-expediente-tarjeta */
    card: 'iol-expediente-tarjeta',
    /** Card header with CUIJ + carátula (clickable link) */
    titleLink: 'a.textColorEncabezado',
    /** Carátula text (first line = CUIJ, rest = carátula) */
    caratulaText: '.fontSizeEncabezadoCaratula',
    /** Case start date */
    fechaInicio: '.fechaIni-sty.fontSizeInicio',
    /** Status badge */
    statusBadge: '.badge.badge-pill',
    /** Last action footer */
    lastActionText: 'iol-expediente-tarjeta-pie .fontSizePie',
    /** Open in new tab button */
    openNewTab: 'button[title*="nueva"]',
  },

  /** Case detail (inline tabs within card) */
  detail: {
    /** Tab list */
    tabList: '[role="tablist"]',
    /** Tab panels */
    tabPanels: '[role="tabpanel"]',
    /** Ficha tab (index 0) */
    fichaTab: '[role="tab"]:nth-child(1)',
    /** Actuaciones tab (index 1) */
    actuacionesTab: '[role="tab"]:nth-child(2)',
  },

  /** Actuaciones table (inside expanded card) */
  actuaciones: {
    /** The Angular Material table */
    table: 'iol-expediente-actuaciones mat-table',
    /** Each row */
    row: 'iol-expediente-actuaciones mat-row',
    /** Title link within a row (first mat-cell a) */
    titleLink: 'mat-cell a',
    /** All cells in a row */
    cells: 'mat-cell',
    /** Attachment icon */
    attachmentIcon: 'mat-cell a i.material-icons',
    /** Filter checkboxes */
    filterDespachos: 'mat-checkbox:nth-child(1)',
    filterEscritos: 'mat-checkbox:nth-child(2)',
    filterCedulas: 'mat-checkbox:nth-child(3)',
    filterNotas: 'mat-checkbox:nth-child(4)',
  },

  /** Header / nav */
  header: {
    component: 'iol-encabezado',
    topBar: '#topFixed',
    sideNav: '#sidenavNotificacion',
  },
} as const;

/** Regex patterns for PJN data */
export const PJN_PATTERNS = {
  /** CUIJ format: EXP J-XX-XXXXXXXX-X/YYYY-X or similar */
  cuij: /EXP\s+[A-Z]-\d{2}-\d{8}-\d\/\d{4}-\d/,
  /** Case number: NNNNNN/YYYY-S */
  caseNumber: /(\d+)\/(\d{4})-(\d)/,
  /** Date from timestamp (ms since epoch) */
  timestampMs: /^\d{13}$/,
  /** expId parameter in API calls */
  expId: /expId[=:](\d+)/,
} as const;
