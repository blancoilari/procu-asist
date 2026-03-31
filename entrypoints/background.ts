import { setupAlarms } from './background/alarm-manager';
import { setupMessageRouter } from './background/message-router';

export default defineBackground(() => {
  console.debug('[ProcuAsist] Background service worker started');

  // Register alarms for keep-alive, session checks, and monitoring
  setupAlarms();

  // Register message handlers
  setupMessageRouter();

  // Open side panel on toolbar icon click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
