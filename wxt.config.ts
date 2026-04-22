import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'ProcuAsist - Copiloto Legal',
    description:
      'Copiloto legal para abogados argentinos. Auto-login, marcadores rápidos, procuración automática y descarga de expedientes en PDF.',
    permissions: [
      'storage',
      'alarms',
      'notifications',
      'sidePanel',
      'activeTab',
      'scripting',
      'offscreen',
      'tabs',
      'downloads',
      'webRequest',
    ],
    host_permissions: [
      'https://mev.scba.gov.ar/*',
      'https://docs.scba.gov.ar/*',
      'https://eje.jus.gov.ar/*',
      'https://sso.pjn.gov.ar/*',
      'https://portalpjn.pjn.gov.ar/*',
      'https://api.pjn.gov.ar/*',
      'https://scw.pjn.gov.ar/*',
      'https://notificaciones.scba.gov.ar/*',
    ],
    action: {},
    side_panel: {
      default_path: 'sidepanel.html',
    },
    web_accessible_resources: [
      {
        resources: ['assets/*'],
        matches: [
          'https://mev.scba.gov.ar/*',
          'https://eje.jus.gov.ar/*',
          'https://notificaciones.scba.gov.ar/*',
        ],
      },
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
