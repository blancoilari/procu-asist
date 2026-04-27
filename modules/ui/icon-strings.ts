/**
 * Inline SVG icon strings for use in content scripts (non-React contexts).
 *
 * Each icon is a minimal Lucide-style stroke SVG using `currentColor`, so
 * the icon inherits the button's `color` CSS property. Buttons render them
 * via `innerHTML` together with an optional label.
 *
 * Keep this set small — only icons actually used in injected UI belong here.
 * For React UI, import from `lucide-react` instead.
 */

const BASE = 'width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

/** Star — bookmark action. */
export const ICON_STAR = `<svg xmlns="http://www.w3.org/2000/svg" ${BASE}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

/** Eye — monitor action. */
export const ICON_EYE = `<svg xmlns="http://www.w3.org/2000/svg" ${BASE}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;

/** Check — success state. */
export const ICON_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" ${BASE}><polyline points="20 6 9 17 4 12"/></svg>`;

/** X — error state. */
export const ICON_X = `<svg xmlns="http://www.w3.org/2000/svg" ${BASE}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

/** Hourglass / loader — in-progress state. */
export const ICON_LOADER = `<svg xmlns="http://www.w3.org/2000/svg" ${BASE}><path d="M12 2v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="M18 12h4"/><path d="m16.24 16.24 2.83 2.83"/><path d="M12 18v4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M2 12h4"/><path d="m4.93 4.93 2.83 2.83"/></svg>`;

/** Download — import / bulk-import action. */
export const ICON_DOWNLOAD = `<svg xmlns="http://www.w3.org/2000/svg" ${BASE}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

/** Triangle alert — warning state. */
export const ICON_ALERT = `<svg xmlns="http://www.w3.org/2000/svg" ${BASE}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

/** Package — ZIP / bundle action. */
export const ICON_PACKAGE = `<svg xmlns="http://www.w3.org/2000/svg" ${BASE}><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>`;

/** Settings - opens extension configuration. */
export const ICON_SETTINGS = `<svg xmlns="http://www.w3.org/2000/svg" ${BASE}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/></svg>`;

/**
 * Build a button inner HTML with an icon + label side by side.
 * The flex wrapper ensures vertical alignment regardless of the icon's natural baseline.
 */
export function iconLabel(iconSvg: string, label: string): string {
  return `<span style="display:inline-flex;align-items:center;gap:6px;">${iconSvg}<span>${label}</span></span>`;
}
