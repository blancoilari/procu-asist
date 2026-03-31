/**
 * SCBA Notificaciones Electrónicas portal selectors.
 *
 * Portal: https://notificaciones.scba.gov.ar
 * Tech: ASP.NET WebForms + jQuery + DataTables + Bootstrap
 *
 * This portal lists electronic notifications for lawyers in
 * Buenos Aires Province (SCBA). We use it to bulk-import cases.
 */

export const SCBA_NOTIF_BASE_URL = 'https://notificaciones.scba.gov.ar';

export const SCBA_NOTIF_URLS = {
  login: '/InterfazBootstrap/Login.aspx',
  novedades: '/InterfazBootstrap/novedades.aspx',
  logout: '/desconectar.aspx',
} as const;

export const SCBA_NOTIF_SELECTORS = {
  login: {
    form: '#aspnetForm',
    /** Email/domicilio electrónico input */
    email: '#domicilio',
    /** Password input */
    password: '#clave',
    /** Login button (sin certificado) */
    submitButton: 'button.btn-success.btn-primary',
    /** Error message div */
    errorDiv: '#errorLogin',
    /** Hidden VIEWSTATE fields (required for ASP.NET postback) */
    viewState: '#__VIEWSTATE',
    viewStateGenerator: '#__VIEWSTATEGENERATOR',
    /** Hidden redirect URL */
    redirectUrl: '#url',
  },
  novedades: {
    /** DataTable wrapper */
    tableWrapper: '.dataTables_wrapper',
    /** The main table (DataTable) */
    table: 'table.dataTable',
    /** Table body rows */
    rows: 'table.dataTable tbody tr',
    /** User info after login */
    userName: '#usuario',
    /** Logout link */
    logout: '#cerrar-sesion',
  },
  /** Column indices in the notifications DataTable */
  columns: {
    /** These may vary — we detect them from <th> headers */
    headerRow: 'table.dataTable thead tr',
  },
} as const;

/**
 * Known column header texts in the notifications table.
 * We use these to identify which column contains which data.
 */
export const SCBA_NOTIF_COLUMN_HEADERS = {
  causa: ['causa', 'expediente', 'nro. causa'],
  caratula: ['carátula', 'caratula', 'autos'],
  juzgado: ['juzgado', 'organismo', 'tribunal'],
  fecha: ['fecha', 'fecha notif'],
  tipo: ['tipo', 'tipo notif'],
  estado: ['estado'],
} as const;
