import { setupAlarms } from './background/alarm-manager';
import { setupMessageRouter } from './background/message-router';
import { setupPjnTokenCapture } from './background/pjn-token-capture';
import { installPjnDebugHelpers } from './background/pjn-debug-helpers';
import { ensureKey } from '@/modules/crypto/key-manager';

export default defineBackground(() => {
  console.debug('[ProcuAsist] Background service worker started');

  // Restore the vault key after a service-worker restart so auto-login,
  // keep-alive and monitoring keep working without re-prompting for the PIN.
  void ensureKey();

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
});
