/**
 * Shared floating action bar for UI injected into judicial portals.
 *
 * Content scripts run outside React, so this module keeps the DOM API small and
 * predictable while making MEV/PJN/EJE actions look and behave consistently.
 */

import { ICON_SETTINGS, iconLabel } from './icon-strings';

const ACTION_PRIMARY = '#2a5d9f';
const ACTION_PRIMARY_HOVER = '#1e4577';
const ACTION_SUCCESS = '#16a34a';
const ACTION_DANGER = '#dc2626';
const ACTION_WARNING = '#f59e0b';
const ACTION_MUTED = '#9ca3af';
const ACTION_BORDER = '#d1d5db';
const BAR_Z_INDEX = '999999';

export type PortalActionVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'muted';

export interface PortalActionButtonOptions {
  id?: string;
  icon: string;
  label: string;
  title: string;
  variant?: PortalActionVariant;
  onClick?: (event: MouseEvent) => void;
}

export interface PortalModalButtonOptions {
  label: string;
  title?: string;
  variant?: PortalActionVariant;
  onClick?: (event: MouseEvent) => void;
}

export function createPortalActionBar(id: string): HTMLDivElement {
  const existing = document.getElementById(id);
  if (existing instanceof HTMLDivElement) return existing;

  const bar = document.createElement('div');
  bar.id = id;
  Object.assign(bar.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    zIndex: BAR_Z_INDEX,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '8px',
    width: '156px',
    maxWidth: 'calc(100vw - 40px)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } satisfies Partial<CSSStyleDeclaration>);

  document.body.appendChild(bar);
  return bar;
}

export function createPortalActionButton(
  options: PortalActionButtonOptions
): HTMLButtonElement {
  const btn = document.createElement('button');
  if (options.id) btn.id = options.id;
  btn.type = 'button';
  btn.title = options.title;
  btn.innerHTML = iconLabel(options.icon, options.label);
  applyPortalActionButtonStyle(btn, options.variant ?? 'primary');
  if (options.onClick) btn.addEventListener('click', options.onClick);
  return btn;
}

export function createConfigActionButton(): HTMLButtonElement {
  return createPortalActionButton({
    icon: ICON_SETTINGS,
    label: 'Configurar',
    title: 'Abrir configuracion de ProcuAsist',
    variant: 'secondary',
    onClick: () => {
      chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' }).catch(() => {
        chrome.runtime.openOptionsPage();
      });
    },
  });
}

export function setPortalActionButtonState(
  btn: HTMLButtonElement,
  icon: string,
  label: string,
  variant: PortalActionVariant
): void {
  btn.innerHTML = iconLabel(icon, label);
  applyPortalActionButtonStyle(btn, variant);
}

export function createPortalModalButton(
  options: PortalModalButtonOptions
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = options.label;
  if (options.title) btn.title = options.title;
  applyPortalModalButtonStyle(btn, options.variant ?? 'secondary');
  if (options.onClick) btn.addEventListener('click', options.onClick);
  return btn;
}

export function applyPortalActionButtonStyle(
  btn: HTMLButtonElement,
  variant: PortalActionVariant
): void {
  const colors = getVariantColors(variant);
  Object.assign(btn.style, {
    width: '100%',
    minHeight: '36px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: colors.border,
    backgroundColor: colors.background,
    color: colors.color,
    fontSize: '13px',
    fontWeight: '600',
    lineHeight: '1',
    cursor: btn.disabled ? 'default' : 'pointer',
    boxShadow: '0 6px 16px rgba(15,23,42,0.22)',
    transition:
      'transform 0.16s ease, background-color 0.16s ease, color 0.16s ease, opacity 0.16s ease',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    whiteSpace: 'nowrap',
  } satisfies Partial<CSSStyleDeclaration>);

  btn.onmouseenter = () => {
    if (btn.disabled) return;
    btn.style.transform = 'translateY(-1px)';
    btn.style.backgroundColor = colors.hoverBackground;
  };
  btn.onmouseleave = () => {
    btn.style.transform = 'translateY(0)';
    btn.style.backgroundColor = colors.background;
  };
}

export function applyPortalModalButtonStyle(
  btn: HTMLButtonElement,
  variant: PortalActionVariant
): void {
  const colors = getVariantColors(variant);
  Object.assign(btn.style, {
    minHeight: '34px',
    padding: '8px 14px',
    borderRadius: '8px',
    border: colors.border,
    backgroundColor: colors.background,
    color: colors.color,
    fontSize: '13px',
    fontWeight: variant === 'secondary' ? '500' : '600',
    cursor: btn.disabled ? 'default' : 'pointer',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    transition:
      'background-color 0.16s ease, color 0.16s ease, opacity 0.16s ease',
  } satisfies Partial<CSSStyleDeclaration>);

  btn.onmouseenter = () => {
    if (btn.disabled) return;
    btn.style.backgroundColor = colors.hoverBackground;
  };
  btn.onmouseleave = () => {
    btn.style.backgroundColor = colors.background;
  };
}

function getVariantColors(variant: PortalActionVariant): {
  background: string;
  hoverBackground: string;
  color: string;
  border: string;
} {
  switch (variant) {
    case 'secondary':
      return {
        background: '#ffffff',
        hoverBackground: '#eff6ff',
        color: ACTION_PRIMARY,
        border: `1px solid ${ACTION_PRIMARY}`,
      };
    case 'success':
      return {
        background: ACTION_SUCCESS,
        hoverBackground: '#15803d',
        color: '#ffffff',
        border: '1px solid transparent',
      };
    case 'danger':
      return {
        background: ACTION_DANGER,
        hoverBackground: '#b91c1c',
        color: '#ffffff',
        border: '1px solid transparent',
      };
    case 'warning':
      return {
        background: ACTION_WARNING,
        hoverBackground: '#d97706',
        color: '#ffffff',
        border: '1px solid transparent',
      };
    case 'muted':
      return {
        background: ACTION_MUTED,
        hoverBackground: '#6b7280',
        color: '#ffffff',
        border: '1px solid transparent',
      };
    case 'primary':
    default:
      return {
        background: ACTION_PRIMARY,
        hoverBackground: ACTION_PRIMARY_HOVER,
        color: '#ffffff',
        border: '1px solid transparent',
      };
  }
}
