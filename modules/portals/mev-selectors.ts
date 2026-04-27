/**
 * MEV (Mesa de Entradas Virtual) portal selectors and URL patterns.
 * Extracted from Procuración Digital project + portal analysis.
 *
 * Portal: https://mev.scba.gov.ar
 * Tech: ASP classic, cookie-based sessions (~20 min timeout), iso-8859-1 encoding
 */

export const MEV_BASE_URL = 'https://mev.scba.gov.ar';

export const MEV_URLS = {
  login: '/loguin.asp',
  posLogin: '/POSloguin.asp',
  busqueda: '/busqueda.asp',
  resultados: '/resultados.asp',
  muestraCausas: '/MuestraCausas.asp',
  procesales: '/procesales.asp', // ?nidCausa=X&pidJuzgado=Y
  proveido: '/proveido.asp', // ?nPosi=Z
} as const;

export const MEV_SELECTORS = {
  login: {
    form: 'form#frmLoguin',
    usuario: "input[name='usuario']",
    clave: "input[name='clave']",
    depto: "select[name='DeptoRegistrado']",
    submit: "input[type='submit']",
  },
  posLogin: {
    depto: "select[name='DtoJudElegido']",
    tipoFamilia: "input[name='TipoF']",
    tipoPenal: "input[name='TipoP']",
    aceptar: "input[type='submit'][value='Aceptar']",
    // Radio button to select "Departamento Judicial" as organism type
    deptJudRadio: "input[type='radio'][value='DJ']",
  },
  busqueda: {
    radioNumero: "input[name='radio'][value='xNc']",
    radioSet: "input[name='radio'][value='xSb']",
    radioCaratula: "input[name='radio'][value='xCa']",
    numeroCausa: "input[name='NCausa']",
    caratula: "input[name='caratula']",
    set: "select[name='Set']",
    buscar: "input[name='Buscar']",
    juzgado: "select[name='JuzgadoElegido']",
    consultar: "input[name='Consultar']",
  },
  resultados: {
    casoLink: "a[href*='procesales.asp?nidCausa=']",
  },
  procesales: {
    proveidoLink: "a[href*='proveido.asp']",
    firmaImg: "img[src*='firma']",
    masTramitacion: "a[href*='VerMasTramitacion']",
  },
  proveido: {
    // Adjuntos are <a> tags with text containing "VER ADJUNTO"
    adjuntoLinkText: 'VER ADJUNTO',
  },
} as const;

/** Departamentos Judiciales de la Provincia de Buenos Aires */
export const MEV_DEPARTAMENTOS: Record<string, string> = {
  aa: 'TODOS los Deptos',
  '80': 'Avellaneda-Lanús',
  '10': 'Azul',
  '11': 'Bahía Blanca',
  '12': 'Dolores',
  '13': 'Junín',
  '14': 'La Matanza',
  '6': 'La Plata',
  '16': 'Lomas de Zamora',
  '17': 'Mar del Plata',
  '18': 'Mercedes',
  '52': 'Moreno-Gral. Rodríguez',
  '19': 'Morón',
  '20': 'Necochea',
  '21': 'Olavarría',
  '22': 'Pergamino',
  '23': 'Quilmes',
  '24': 'San Isidro',
  '25': 'San Martín',
  '26': 'San Nicolás',
  '28': 'Trenque Lauquen',
  '29': 'Tandil',
  '30': 'Tres Arroyos',
  '41': 'Zárate-Campana',
};

/** Regex patterns used for parsing */
export const MEV_PATTERNS = {
  /** Case number format: XX-NNNNN-YYYY */
  caseNumber: /([A-Z]{2})\s*-\s*(\d+)\s*-\s*(\d{4})/,
  /** Date format: dd/mm/yyyy */
  date: /\d{2}\/\d{2}\/\d{4}/,
  /** Extract nidCausa from URL */
  nidCausa: /[?&]nidCausa=([^&]+)/i,
  /** Extract pidJuzgado from URL. MEV uses numeric and alphanumeric court ids. */
  pidJuzgado: /[?&]pidJuzgado=([^&]+)/i,
  /** Extract nPosi from URL */
  nPosi: /nPosi=(\d+)/,
} as const;
