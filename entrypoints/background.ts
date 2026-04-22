import { setupAlarms } from './background/alarm-manager';
import { setupMessageRouter } from './background/message-router';
import { setupPjnTokenCapture } from './background/pjn-token-capture';
import { installPjnDebugHelpers } from './background/pjn-debug-helpers';

export default defineBackground(() => {
  console.debug('[ProcuAsist] Background service worker started');

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
