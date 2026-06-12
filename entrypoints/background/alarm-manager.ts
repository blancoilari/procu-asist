/**
 * Chrome Alarms orchestrator.
 * MV3 service workers terminate after ~30s of inactivity,
 * so all periodic work must go through chrome.alarms.
 */

import { keepAlive } from './keep-alive';
import { scanMonitoredCases } from './case-monitor';
import { checkDeadlines } from './deadline-watcher';

export const ALARMS = {
  KEEPALIVE_MEV: 'tl-keepalive-mev',
  KEEPALIVE_EJE: 'tl-keepalive-eje',
  KEEPALIVE_PJN: 'tl-keepalive-pjn',
  MONITOR_SCAN: 'tl-monitor-scan',
  DEADLINE_CHECK: 'tl-deadline-check',
} as const;

export function setupAlarms() {
  // Register alarms on install and startup
  chrome.runtime.onInstalled.addListener(createAlarms);
  chrome.runtime.onStartup.addListener(createAlarms);

  // Handle alarm events
  chrome.alarms.onAlarm.addListener(handleAlarm);
}

async function createAlarms() {
  // Keep-alive heartbeats every 4 minutes (MEV timeout is ~20 min).
  // Re-creating these resets their timer, which is harmless at 4 min.
  chrome.alarms.create(ALARMS.KEEPALIVE_MEV, { periodInMinutes: 4 });
  chrome.alarms.create(ALARMS.KEEPALIVE_EJE, { periodInMinutes: 4 });
  chrome.alarms.create(ALARMS.KEEPALIVE_PJN, { periodInMinutes: 4 });

  // Case monitoring scan every 6 hours. chrome.alarms.create() with an
  // existing name cancels and replaces it, resetting the 6h countdown —
  // so re-creating it on every browser start means short sessions would
  // never reach a scan. Only create it if it doesn't already exist, and
  // give the first fire a short delay so a fresh install/startup scans soon.
  const existing = await chrome.alarms.get(ALARMS.MONITOR_SCAN);
  if (!existing) {
    chrome.alarms.create(ALARMS.MONITOR_SCAN, {
      delayInMinutes: 5,
      periodInMinutes: 360,
    });
  }

  // Chequeo de plazos/vencimientos cada 6 horas (mismo guard que arriba).
  const deadlineAlarm = await chrome.alarms.get(ALARMS.DEADLINE_CHECK);
  if (!deadlineAlarm) {
    chrome.alarms.create(ALARMS.DEADLINE_CHECK, {
      delayInMinutes: 3,
      periodInMinutes: 360,
    });
  }

  console.debug('[ProcuAsist] Alarms registered');
}

async function handleAlarm(alarm: chrome.alarms.Alarm) {
  try {
    switch (alarm.name) {
      case ALARMS.KEEPALIVE_MEV:
        await keepAlive('mev');
        break;
      case ALARMS.KEEPALIVE_EJE:
        await keepAlive('eje');
        break;
      case ALARMS.KEEPALIVE_PJN:
        await keepAlive('pjn');
        break;
      case ALARMS.MONITOR_SCAN:
        await scanMonitoredCases();
        break;
      case ALARMS.DEADLINE_CHECK:
        await checkDeadlines();
        break;
    }
  } catch (err) {
    console.error(`[ProcuAsist] Alarm handler failed (${alarm.name}):`, err);
  }
}
