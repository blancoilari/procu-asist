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
    name: 'MEV - Mesa de Entradas Virtual',
    baseUrl: 'https://mev.scba.gov.ar',
    pattern: 'https://mev.scba.gov.ar/*',
    heartbeatUrl: 'https://mev.scba.gov.ar/',
    loginUrlPattern: 'https://mev.scba.gov.ar/login',
  },
  eje: {
    name: 'EJE - Expedientes Judiciales CABA',
    baseUrl: 'https://eje.jus.gov.ar',
    pattern: 'https://eje.jus.gov.ar/*',
    heartbeatUrl: 'https://eje.jus.gov.ar/',
    loginUrlPattern: 'https://eje.jus.gov.ar/login',
  },
};
