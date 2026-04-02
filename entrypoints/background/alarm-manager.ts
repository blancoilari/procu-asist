/**
 * Chrome Alarms orchestrator.
 * MV3 service workers terminate after ~30s of inactivity,
 * so all periodic work must go through chrome.alarms.
 */

import { keepAlive } from './keep-alive';
import { scanMonitoredCases } from './case-monitor';

export const ALARMS = {
  KEEPALIVE_MEV: 'tl-keepalive-mev',
  KEEPALIVE_EJE: 'tl-keepalive-eje',
  MONITOR_SCAN: 'tl-monitor-scan',
} as const;

export function setupAlarms() {
  // Register alarms on install and startup
  chrome.runtime.onInstalled.addListener(createAlarms);
  chrome.runtime.onStartup.addListener(createAlarms);

  // Handle alarm events
  chrome.alarms.onAlarm.addListener(handleAlarm);
}

function createAlarms() {
  // Keep-alive heartbeats every 4 minutes (MEV timeout is ~20 min)
  chrome.alarms.create(ALARMS.KEEPALIVE_MEV, { periodInMinutes: 4 });
  chrome.alarms.create(ALARMS.KEEPALIVE_EJE, { periodInMinutes: 4 });

  // Case monitoring scan every 6 hours
  chrome.alarms.create(ALARMS.MONITOR_SCAN, { periodInMinutes: 360 });

  console.debug('[ProcuAsist] Alarms registered');
}

async function handleAlarm(alarm: chrome.alarms.Alarm) {
  switch (alarm.name) {
    case ALARMS.KEEPALIVE_MEV:
      await keepAlive('mev');
      break;
    case ALARMS.KEEPALIVE_EJE:
      await keepAlive('eje');
      break;
    case ALARMS.MONITOR_SCAN:
      await scanMonitoredCases();
      break;
  }
}
