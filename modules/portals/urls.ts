import type { PortalId } from './types';

interface PortalConfig {
  name: string;
  baseUrl: string;
  pattern: string; // URL pattern for chrome.tabs.query
  heartbeatUrl: string; // URL to ping for keep-alive
  loginUrlPattern: string; // Used to detect login pages
}

export const PORTAL_URLS: Record<PortalId, PortalConfig> = {
  mev: {
    name: 'MEV - Mesa de Entradas Virtual (Provincia de Buenos Aires)',
    baseUrl: 'https://mev.scba.gov.ar',
    pattern: 'https://mev.scba.gov.ar/*',
    heartbeatUrl: 'https://mev.scba.gov.ar/',
    loginUrlPattern: 'https://mev.scba.gov.ar/login',
  },
  eje: {
    name: 'JUSCABA - Poder Judicial de CABA',
    baseUrl: 'https://eje.jus.gov.ar',
    pattern: 'https://eje.jus.gov.ar/*',
    heartbeatUrl: 'https://eje.jus.gov.ar/',
    loginUrlPattern: 'https://eje.jus.gov.ar/login',
  },
  pjn: {
    name: 'PJN - Poder Judicial de la Nación',
    baseUrl: 'https://portalpjn.pjn.gov.ar',
    pattern: 'https://*.pjn.gov.ar/*',
    heartbeatUrl: 'https://scw.pjn.gov.ar/scw/homePrivado.seam',
    loginUrlPattern: 'https://sso.pjn.gov.ar/auth/realms/pjn/',
  },
};
