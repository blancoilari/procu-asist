import { setupAlarms } from './background/alarm-manager';
import { setupMessageRouter } from './background/message-router';
import { setupPjnTokenCapture } from './background/pjn-token-capture';
import { installPjnDebugHelpers } from './background/pjn-debug-helpers';
import { reconcileBookmarksAndMonitors } from './background/case-reconciler';
import { ensureKey, cleanupLegacyVault } from '@/modules/crypto/key-manager';

export default defineBackground(() => {
  console.debug('[ProcuAsist] Background service worker started');

  // Warm the device key (creates it on first run) and drop the legacy
  // PIN-vault material from pre-0.8.0 installs.
  void ensureKey();
  void cleanupLegacyVault();

  // Marcador = monitoreo: converge los stores (idempotente).
  void reconcileBookmarksAndMonitors();

  // Register alarms for keep-alive, session checks, and monitoring
  setupAlarms();

  // Register message handlers
  setupMessageRouter();

  // Capture PJN API bearer tokens from outgoing requests
  setupPjnTokenCapture();

  // Expose pjnGetEvents() / pjnTokenStatus() in the SW console for debugging
  installPjnDebugHelpers();

  // Open side panel on toolbar icon click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Primera instalación: abrir la bienvenida en una pestaña. El panel lateral
  // no se puede abrir sin gesto del usuario, pero la misma página funciona
  // como pestaña y ahí corre el onboarding (credenciales + importar todo).
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      void chrome.tabs.create({
        url: chrome.runtime.getURL('/sidepanel.html'),
      });
    }
  });
});
