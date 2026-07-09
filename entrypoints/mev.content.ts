/**
 * Content script for MEV (Mesa de Entradas Virtual)
 * https://mev.scba.gov.ar/*
 *
 * Handles: auto-login, post-login department selection, session monitoring,
 * case data extraction, and dark mode.
 */

import {
  MEV_BASE_URL,
  MEV_DEPARTAMENTOS,
  MEV_SELECTORS,
  MEV_URLS,
} from '@/modules/portals/mev-selectors';
import type { Movement } from '@/modules/portals/types';
import type { MevCaseData, MevSearchResult } from '@/modules/portals/mev-parser';
import {
  isLoginPage,
  isPosLoginPage,
  isBusquedaPage,
  isCasePage,
  isResultsPage,
  isProveidoPage,
  parseCaseData,
  parseMovements,
  parseSearchResults,
  parseAdjuntos,
} from '@/modules/portals/mev-parser';
import { PORTAL_COLORS } from '@/modules/ui/portal-colors';
import {
  ICON_STAR,
  ICON_CHECK,
  ICON_X,
  ICON_LOADER,
  ICON_PACKAGE,
  ICON_DOWNLOAD,
} from '@/modules/ui/icon-strings';
import {
  createConfigActionButton,
  createPortalActionBar,
  createPortalActionButton,
  createPortalModalButton,
  setPortalActionButtonState,
} from '@/modules/ui/portal-action-bar';
import { IMPORT_ALL_CANCEL_STORAGE_KEY } from '@/modules/messages/types';

const MEV_COLORS = PORTAL_COLORS.mev;
const MEV_ACTION_BAR_ID = 'procu-asist-action-bar';
const MEV_CONFIG_ID = 'procu-asist-config';
const MEV_SET_IMPORT_SESSION_KEY = 'procu_asist_mev_set_import';
const DANGER_COLOR = '#dc2626';

interface MevSetImportSession {
  collected: MevSearchResult[];
  remainingValues: string[];
  startedAt: number;
  totalOrganisms: number;
  /** Recorrido multi-departamento con select EN la página de resultados
   *  (opcional, sesiones viejas no lo tienen). */
  remainingDeptValues?: string[];
  totalDepts?: number;
  deptsDone?: number;
  /** Tras cambiar de departamento hay que re-leer los organismos del set. */
  pendingOrganismRefresh?: boolean;
  /**
   * Plan B multi-departamento: cuando la página del set NO ofrece un select
   * de departamento, se recorre cambiando de departamento vía POSloguin.asp
   * (la página de selección de departamento de la MEV) y re-lanzando la
   * búsqueda del set en cada uno.
   */
  deptHop?: {
    /** Valor del set en el select de busqueda.asp, para re-buscar en cada depto. */
    setId: string;
    /** Códigos de depto pendientes; null = aún no leídos de POSloguin. */
    remaining: string[] | null;
    /** Cuántos deptos ya se recorrieron (para el progreso). */
    done: number;
    total: number | null;
    /** 'walk' organismos, 'switch' eligiendo depto, 'search' re-buscando el set. */
    phase: 'walk' | 'switch' | 'search';
    /** Reintentos de búsqueda en el depto actual (corta rebotes infinitos). */
    searchAttempts: number;
  };
  /** Corrida del asistente "Importar todo" que disparó este recorrido:
   *  al terminar (o cancelar) se reporta al background en vez de solo
   *  mostrar el estado en la botonera. */
  wizardRunId?: string;
  wizardSourceKey?: string;
}

export default defineContentScript({
  matches: ['https://mev.scba.gov.ar/*'],
  registration: 'manifest',
  runAt: 'document_idle',

  main() {
    console.debug('[ProcuAsist] MEV content script loaded');
    const doc = document;

    installWizardMessageListener();

    if (isLoginPage(doc)) {
      // Una corrida del asistente que cae al login no puede seguir: avisar
      // al background en vez de dejarlo esperando el timeout.
      failWizardIfActive('La sesión de MEV expiró durante la importación.');
      handleLoginPage(doc);
    } else if (isPosLoginPage(doc)) {
      // Si hay un recorrido de set esperando cambiar de departamento, esta
      // carga de POSloguin es parte del recorrido, no un login del usuario.
      if (!handleDeptHopPosLogin(doc)) {
        handlePosLoginPage(doc);
      }
    } else {
      // Start session expiry monitoring
      startSessionMonitor();

      if (isBusquedaPage(doc)) {
        handleBusquedaPage(doc);
      } else if (isResultsPage(doc)) {
        handleResultsPage(doc);
      } else if (isCasePage(doc)) {
        handleCasePage(doc);
      } else if (isProveidoPage(doc)) {
        handleProveidoPage(doc);
      } else {
        // Página intermedia (p. ej. bienvenida tras cambiar de departamento):
        // si un recorrido multi-departamento espera re-buscar el set, seguir.
        redirectDeptHopToBusquedaIfPending();
      }
    }

    applyDarkModeIfEnabled();
  },
});

// --- Login Page ---

const LOGIN_ATTEMPTS_KEY = 'procu_asist_login_attempts';
const MAX_AUTO_LOGIN_ATTEMPTS = 2;
const LOGIN_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Auto-login retry guard. Without it, wrong saved credentials loop forever
 * (submit → error page → content script re-runs → submit…), which can get
 * the MEV account blocked by the portal.
 */
function canAttemptAutoLogin(): boolean {
  try {
    const raw = sessionStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (!raw) return true;
    const data = JSON.parse(raw) as { count: number; firstAt: number };
    if (Date.now() - data.firstAt > LOGIN_ATTEMPT_WINDOW_MS) return true;
    return data.count < MAX_AUTO_LOGIN_ATTEMPTS;
  } catch {
    return true;
  }
}

function recordAutoLoginAttempt(): void {
  try {
    const now = Date.now();
    const raw = sessionStorage.getItem(LOGIN_ATTEMPTS_KEY);
    let data = { count: 0, firstAt: now };
    if (raw) {
      const parsed = JSON.parse(raw) as { count: number; firstAt: number };
      if (now - parsed.firstAt <= LOGIN_ATTEMPT_WINDOW_MS) data = parsed;
    }
    data.count += 1;
    sessionStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage unavailable — nothing to record
  }
}

function clearAutoLoginAttempts(): void {
  try {
    sessionStorage.removeItem(LOGIN_ATTEMPTS_KEY);
  } catch {
    // ignore
  }
}

async function handleLoginPage(doc: Document) {
  console.debug('[ProcuAsist] MEV login page detected');

  // If MEV is already showing a login error (wrong or blocked credentials),
  // retrying with the same saved credentials would only make it worse.
  const bodyText = doc.body?.textContent ?? '';
  if (/incorrect|bloquead|deshabilitad/i.test(bodyText)) {
    console.warn('[ProcuAsist] MEV login page shows an error — skipping auto-login');
    return;
  }

  if (!canAttemptAutoLogin()) {
    console.warn(
      '[ProcuAsist] Auto-login attempt limit reached for MEV — log in manually'
    );
    return;
  }

  // Request credentials from background
  const response = await chrome.runtime.sendMessage({
    type: 'GET_CREDENTIALS',
    portal: 'mev',
  });

  if (!response?.success || !response.credentials) {
    console.debug('[ProcuAsist] No credentials available for auto-login');
    return;
  }

  const { username, password } = response.credentials;

  // Fill login form
  const usuarioInput = doc.querySelector(
    MEV_SELECTORS.login.usuario
  ) as HTMLInputElement | null;
  const claveInput = doc.querySelector(
    MEV_SELECTORS.login.clave
  ) as HTMLInputElement | null;
  const deptoSelect = doc.querySelector(
    MEV_SELECTORS.login.depto
  ) as HTMLSelectElement | null;

  if (!usuarioInput || !claveInput) {
    console.warn('[ProcuAsist] Login form fields not found');
    return;
  }

  // Fill credentials
  usuarioInput.value = username;
  claveInput.value = password;

  // Si hay un departamento preferido (aprendido o configurado), loguear
  // directo a ese departamento: se saltea POSloguin y la sesión queda
  // operativa de una. Sin preferencia, "TODOS" deja elegir en POSloguin.
  if (deptoSelect) {
    const stored = await chrome.storage.local.get('tl_settings');
    const settings = stored.tl_settings as Record<string, unknown> | undefined;
    const preferred = (settings?.mevDepartamento as string) ?? 'aa';
    deptoSelect.value = preferred;
    if (deptoSelect.value !== preferred) {
      // Código inexistente en el form de login: caer a "TODOS".
      deptoSelect.value = 'aa';
    }
  }

  // Small delay to mimic human interaction, then submit
  setTimeout(() => {
    const form = doc.querySelector(MEV_SELECTORS.login.form) as HTMLFormElement;
    if (form) {
      console.debug('[ProcuAsist] Submitting login form');
      recordAutoLoginAttempt();
      markLoginFlow();
      form.submit();
    }
  }, 500);
}

// Marca "estoy en el flujo de login" para que POSloguin sepa distinguir el
// paso posterior al login de una visita manual (Cambiar Jurisdicción). El
// referrer no alcanza: según cómo redirija el portal puede llegar vacío.
const MEV_LOGIN_FLOW_KEY = 'procu_asist_login_flow';
const MEV_LOGIN_FLOW_TTL_MS = 2 * 60 * 1000;

function markLoginFlow(): void {
  try {
    sessionStorage.setItem(MEV_LOGIN_FLOW_KEY, String(Date.now()));
  } catch {
    // sessionStorage no disponible
  }
}

/** Consume la marca de flujo de login (una sola lectura). */
function consumeLoginFlow(): boolean {
  try {
    const raw = sessionStorage.getItem(MEV_LOGIN_FLOW_KEY);
    if (!raw) return false;
    sessionStorage.removeItem(MEV_LOGIN_FLOW_KEY);
    return Date.now() - Number(raw) < MEV_LOGIN_FLOW_TTL_MS;
  } catch {
    return false;
  }
}

// --- Post-Login Page (Department Selection) ---

async function handlePosLoginPage(doc: Document) {
  console.debug('[ProcuAsist] MEV post-login page detected');

  // Aprender el departamento que el usuario elige a mano: cuando envía el
  // formulario, se guarda como departamento preferido. Así la próxima
  // reconexión automática entra directo a su departamento sin configurar
  // nada en Opciones.
  installDepartmentLearner(doc);

  // El auto-envío corre SOLO cuando POSloguin es parte del flujo de login
  // (marca en sessionStorage puesta al enviar loguin.asp, con el referrer
  // como respaldo). Si el usuario llegó con "Cambiar Jurisdicción" o
  // navegando a mano, vino a ELEGIR departamento: auto-enviar acá le
  // secuestraría la pantalla (verificado en vivo 2026-07-08).
  const cameFromLogin =
    consumeLoginFlow() || /\/loguin\.asp/i.test(document.referrer);

  // Get preferred department from settings
  const stored = await chrome.storage.local.get('tl_settings');
  const settings = stored.tl_settings as Record<string, unknown> | undefined;
  const preferredDepto = (settings?.mevDepartamento as string) ?? 'aa';
  const hasPreference = Boolean(preferredDepto) && preferredDepto !== 'aa';

  // Sin auto-envío posible (visita manual, o sin departamento aprendido):
  // guiar con un aviso; el learner registra lo que el usuario elija.
  if (!cameFromLogin || !hasPreference) {
    console.debug(
      `[ProcuAsist] POSloguin sin auto-submit (login=${cameFromLogin}, pref=${hasPreference}) — elige el usuario.`
    );
    showPosLoginHint(
      'Elegí tu Departamento Judicial habitual y tocá Aceptar. ProcuAsist lo va a recordar para loguearte directo la próxima vez.'
    );
    return;
  }

  const deptoSelect = doc.querySelector(
    MEV_SELECTORS.posLogin.depto
  ) as HTMLSelectElement | null;
  const aceptarBtn = doc.querySelector(
    MEV_SELECTORS.posLogin.aceptar
  ) as HTMLInputElement | null;

  if (!deptoSelect || !aceptarBtn) {
    console.warn('[ProcuAsist] Post-login form elements not found');
    return;
  }

  // First, select the "Departamento Judicial" radio button so the form
  // is in the correct state before we choose the department.
  const deptRadio = doc.querySelector(
    MEV_SELECTORS.posLogin.deptJudRadio
  ) as HTMLInputElement | null;
  if (deptRadio && !deptRadio.checked) {
    deptRadio.click();
    console.debug('[ProcuAsist] Clicked Departamento Judicial radio');
  }

  // Set preferred department
  deptoSelect.value = preferredDepto;

  // Verify the value was actually set (if the code doesn't exist in the
  // dropdown the browser silently ignores the assignment)
  if (deptoSelect.value !== preferredDepto) {
    console.warn(
      `[ProcuAsist] Department code '${preferredDepto}' not found in POSloguin dropdown — skipping auto-submit`
    );
    return;
  }

  // Auto-click Aceptar after short delay
  setTimeout(() => {
    console.debug(
      `[ProcuAsist] Selecting department: ${preferredDepto}, clicking Aceptar`
    );
    programmaticPosLoginSubmit = true;
    aceptarBtn.click();
  }, 600);
}

/** Los envíos automáticos de POSloguin no deben "aprenderse" como elección. */
let programmaticPosLoginSubmit = false;

/**
 * Escucha el envío del formulario de POSloguin y guarda el departamento
 * elegido como preferido (settings.mevDepartamento). El último elegido por
 * EL USUARIO gana: la reconexión automática vuelve siempre a su departamento
 * habitual. Los clicks programáticos (auto-submit propio) se ignoran.
 */
function installDepartmentLearner(doc: Document): void {
  const deptoSelect = doc.querySelector(
    MEV_SELECTORS.posLogin.depto
  ) as HTMLSelectElement | null;
  if (!deptoSelect) return;

  const learn = () => {
    if (programmaticPosLoginSubmit) {
      programmaticPosLoginSubmit = false;
      return;
    }
    const value = deptoSelect.value;
    if (!value || value === 'aa') return;
    chrome.runtime
      .sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: { mevDepartamento: value },
      })
      .catch(() => {});
  };

  const aceptarBtn = doc.querySelector(
    MEV_SELECTORS.posLogin.aceptar
  ) as HTMLInputElement | null;
  aceptarBtn?.addEventListener('click', learn);
  deptoSelect.form?.addEventListener('submit', learn);
}

/** Aviso chico y descartable sobre POSloguin (no tapa el formulario). */
function showPosLoginHint(message: string): void {
  if (document.getElementById('procu-asist-poslogin-hint')) return;
  const hint = document.createElement('div');
  hint.id = 'procu-asist-poslogin-hint';
  Object.assign(hint.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    zIndex: '999999',
    maxWidth: '300px',
    padding: '12px 14px',
    borderRadius: '10px',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: MEV_COLORS.primary,
    fontSize: '13px',
    fontWeight: '600',
    lineHeight: '1.45',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.16)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    cursor: 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);
  hint.textContent = message;
  hint.title = 'Click para cerrar';
  hint.addEventListener('click', () => hint.remove());
  document.body.appendChild(hint);
}

// --- Búsqueda Page ---

function handleBusquedaPage(doc: Document) {
  console.debug('[ProcuAsist] MEV search page detected');

  // Recorrido multi-departamento en curso: si acabamos de cambiar de
  // departamento, esta carga de la búsqueda es para re-lanzar el set.
  if (continueDeptHopOnBusqueda()) return;

  // Registrar la última búsqueda por set del usuario: si después quiere
  // "Importar set - todos los departamentos" y la página de resultados no
  // ofrece selector de departamento, este dato permite re-buscar el set en
  // cada departamento.
  installLastSetSearchRecorder(doc);

  // Si hay un arranque de set del asistente pendiente y volvimos a caer en
  // la búsqueda, la consulta rebotó (no llegó a resultados): avisar rápido.
  failWizardIfActive('La búsqueda del set no llegó a la página de resultados.');

  // Notify background that login was successful
  chrome.runtime.sendMessage({ type: 'LOGIN_SUCCESS', portal: 'mev' });
  clearAutoLoginAttempts();

  // Check if there's a returnUrl to navigate back to
  const returnUrl = sessionStorage.getItem('procu_asist_return_url');
  if (returnUrl) {
    sessionStorage.removeItem('procu_asist_return_url');
    console.debug('[ProcuAsist] Navigating back to:', returnUrl);
    window.location.href = returnUrl;
  }
}

// --- Última búsqueda por set (para el plan B multi-departamento) ---------

const MEV_LAST_SET_SEARCH_KEY = 'procu_asist_last_set_search';
const MEV_LAST_SET_SEARCH_TTL_MS = 30 * 60 * 1000;

interface MevLastSetSearch {
  setId: string;
  at: number;
}

function installLastSetSearchRecorder(doc: Document): void {
  const setSelect = doc.querySelector(
    MEV_SELECTORS.busqueda.set
  ) as HTMLSelectElement | null;
  if (!setSelect) return;

  const record = () => {
    const radio = doc.querySelector(
      MEV_SELECTORS.busqueda.radioSet
    ) as HTMLInputElement | null;
    if (!radio?.checked || !setSelect.value) return;
    try {
      const data: MevLastSetSearch = { setId: setSelect.value, at: Date.now() };
      sessionStorage.setItem(MEV_LAST_SET_SEARCH_KEY, JSON.stringify(data));
    } catch {
      // sessionStorage no disponible
    }
  };

  const buscar = doc.querySelector(
    MEV_SELECTORS.busqueda.buscar
  ) as HTMLElement | null;
  buscar?.addEventListener('click', record);
  (setSelect.form ?? doc.querySelector('form'))?.addEventListener(
    'submit',
    record
  );
}

function readLastSetSearch(): MevLastSetSearch | null {
  try {
    const raw = sessionStorage.getItem(MEV_LAST_SET_SEARCH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as MevLastSetSearch;
    if (!data.setId || Date.now() - data.at > MEV_LAST_SET_SEARCH_TTL_MS) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// --- Results Page ---

function handleResultsPage(doc: Document) {
  console.debug('[ProcuAsist] MEV results page detected');

  const results = parseSearchResults(doc);
  if (results.length > 0) {
    console.debug(`[ProcuAsist] Found ${results.length} cases in results`);
    // Send results to side panel for display
    chrome.runtime.sendMessage({
      type: 'SEARCH_RESULTS',
      results,
    });
    injectResultsImportButton(results);
  }
  // Continuar recorridos activos AUNQUE esta página no tenga resultados:
  // un organismo o página sin causas no debe frenar la sesión de importación.
  // El asistente "Importar todo" tiene prioridad: si acaba de disparar una
  // búsqueda de set, acá se adopta la sesión (sin modales) y recién después
  // corren las continuaciones normales.
  void (async () => {
    const adopted = await adoptWizardSessionIfPending(results);
    if (!adopted) {
      await continueSetImportIfActive(results);
      await continuePageWalkIfActive(results);
    }
  })();
}

function injectResultsImportButton(results: MevSearchResult[]) {
  if (document.getElementById('procu-asist-import-results')) return;

  const bar = ensureMevActionBar();
  const setSelect = findSetOrganismSelect();
  const isSetPage = !!setSelect && getSetOptionValues(setSelect).length > 1;
  const btn = createPortalActionButton({
    id: 'procu-asist-import-results',
    icon: ICON_DOWNLOAD,
    label: isSetPage ? 'Importar set' : 'Importar',
    title: isSetPage
      ? 'Importar y monitorear todas las causas del set'
      : `Importar y monitorear ${results.length} causas visibles`,
    variant: 'secondary',
  });

  btn.addEventListener('click', async () => {
    if (await startSetImportIfPossible(results, btn)) return;
    // Multi-page results: walk every page first, then offer the selection.
    if (startPageWalkIfPossible(results, btn)) return;

    // Let the user pick which results to import.
    const selected = await showMevImportSelectionModal(results);
    if (!selected) return; // cancelled
    if (selected.length === 0) {
      setPortalActionButtonState(btn, ICON_X, 'Nada elegido', 'warning');
      setTimeout(() => {
        setPortalActionButtonState(btn, ICON_DOWNLOAD, 'Importar', 'secondary');
      }, 2200);
      return;
    }

    setPortalActionButtonState(btn, ICON_LOADER, 'Importando', 'muted');
    btn.disabled = true;

    try {
      const response = await bulkImportMevResults(selected);

      setPortalActionButtonState(
        btn,
        ICON_CHECK,
        `Importadas ${response.imported}`,
        'success'
      );
      btn.title = `${response.imported} nuevas, ${response.existing} existentes, ${response.monitored} monitoreadas`;
    } catch (err) {
      console.error('[ProcuAsist] MEV results import error:', err);
      setPortalActionButtonState(btn, ICON_X, 'Error', 'danger');
    }

    setTimeout(() => {
      setPortalActionButtonState(btn, ICON_DOWNLOAD, 'Importar', 'secondary');
      btn.disabled = false;
    }, 5000);
  });

  const configBtn = document.getElementById(MEV_CONFIG_ID);
  if (configBtn?.nextSibling) {
    bar.insertBefore(btn, configBtn.nextSibling);
  } else {
    bar.appendChild(btn);
  }
}

async function startSetImportIfPossible(
  results: MevSearchResult[],
  btn: HTMLButtonElement
): Promise<boolean> {
  const select = findSetOrganismSelect();
  if (!select) return false;

  const options = getSetOptionValues(select);
  const deptSelect = findSetDepartmentSelect(select);
  const deptOptions = deptSelect ? getSetOptionValues(deptSelect) : [];
  const multiOrganism = options.length > 1;
  const multiDeptInPage = deptOptions.length > 1;
  // Plan B: sin select de departamento en la página, se puede recorrer el
  // set completo cambiando de departamento vía POSloguin, siempre que
  // sepamos qué set buscó el usuario (capturado en busqueda.asp).
  const lastSet = readLastSetSearch();
  const canHopDepts = !multiDeptInPage && !!lastSet;
  if (!multiOrganism && !multiDeptInPage && !canHopDepts) return false;

  // Si el set puede abarcar varios departamentos judiciales, el usuario
  // elige el alcance: solo el departamento actual o el set COMPLETO.
  let includeAllDepts = false;
  if (multiDeptInPage || canHopDepts) {
    const choice = await showSetScopeChoiceModal(
      multiDeptInPage ? deptOptions.length : null
    );
    if (choice === 'cancel') {
      setPortalActionButtonState(btn, ICON_DOWNLOAD, 'Importar set', 'secondary');
      btn.disabled = false;
      return true;
    }
    includeAllDepts = choice === 'all';
  }

  const currentValue = select.value;
  const remainingValues = options
    .map((option) => option.value)
    .filter((value) => value !== currentValue);

  const session: MevSetImportSession = {
    collected: results,
    remainingValues,
    startedAt: Date.now(),
    totalOrganisms: options.length,
  };
  if (includeAllDepts && multiDeptInPage && deptSelect) {
    session.remainingDeptValues = deptOptions
      .map((option) => option.value)
      .filter((value) => value !== deptSelect.value);
    session.totalDepts = deptOptions.length;
    session.deptsDone = 0;
  } else if (includeAllDepts && lastSet) {
    session.deptHop = {
      setId: lastSet.setId,
      remaining: null,
      done: 0,
      total: null,
      phase: 'walk',
      searchAttempts: 0,
    };
  }

  sessionStorage.setItem(MEV_SET_IMPORT_SESSION_KEY, JSON.stringify(session));

  setPortalActionButtonState(btn, ICON_LOADER, 'Importando set', 'muted');
  btn.disabled = true;

  if (!goToNextSetOrganism(session)) {
    // Sin más organismos en este departamento: saltar de departamento si
    // corresponde; si no, cerrar con lo visible.
    if (includeAllDepts && goToNextSetDepartment(session)) return true;
    if (includeAllDepts && startDeptHopSwitch(session)) return true;

    sessionStorage.removeItem(MEV_SET_IMPORT_SESSION_KEY);
    const response = await bulkImportMevResults(results);
    setPortalActionButtonState(btn, ICON_CHECK, `Importadas ${response.imported}`, 'success');
    btn.title = `${response.imported} nuevas, ${response.existing} existentes, ${response.monitored} monitoreadas`;
  }

  return true;
}

/** Nombres de departamentos conocidos, compactados para comparar. */
const KNOWN_DEPT_NAMES = Object.entries(MEV_DEPARTAMENTOS)
  .filter(([code]) => code !== 'aa')
  .map(([, name]) => compactText(name));

function compactText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

/**
 * Selector de "Departamento Judicial" en la página del set (distinto del de
 * organismos). Tres heurísticas en cascada, porque el markup de la MEV pone
 * la etiqueta en la celda hermana (el textContent del padre directo no
 * alcanza, ese era el bug por el que el diálogo multi-departamento nunca
 * aparecía):
 *  1. name/id del select con pinta de departamento;
 *  2. "departamento" en el contexto cercano (padre, celda anterior o fila);
 *  3. opciones cuyo texto coincide con nombres de departamentos conocidos.
 */
function findSetDepartmentSelect(
  exclude: HTMLSelectElement | null
): HTMLSelectElement | null {
  const selects = (
    Array.from(document.querySelectorAll('select')) as HTMLSelectElement[]
  ).filter((select) => select !== exclude);

  for (const select of selects) {
    const nameId = `${select.getAttribute('name') ?? ''} ${select.id}`;
    if (/depto|dtojud|departamento/i.test(nameId)) return select;
  }

  for (const select of selects) {
    const context = [
      select.parentElement?.textContent ?? '',
      select.closest('td')?.previousElementSibling?.textContent ?? '',
      select.closest('tr')?.textContent ?? '',
    ].join(' ');
    if (/departamento/i.test(context)) return select;
  }

  for (const select of selects) {
    const labels = Array.from(select.options).map((option) =>
      compactText(option.textContent ?? '')
    );
    const hits = labels.filter(
      (label) =>
        label &&
        KNOWN_DEPT_NAMES.some(
          (known) => label.includes(known) || known.includes(label)
        )
    ).length;
    if (hits >= 2) return select;
  }

  return null;
}

/**
 * Pasa al siguiente departamento judicial del set: cambia el select, deja
 * que el onchange del portal recargue (o consulta a mano a los 800 ms) y
 * marca la sesión para re-leer los organismos en la próxima carga.
 */
function goToNextSetDepartment(session: MevSetImportSession): boolean {
  const deptSelect = findSetDepartmentSelect(findSetOrganismSelect());
  const nextDept = session.remainingDeptValues?.shift();
  if (!deptSelect || !nextDept) return false;

  deptSelect.value = nextDept;
  if (deptSelect.value !== nextDept) return false; // opción inexistente

  session.deptsDone = (session.deptsDone ?? 0) + 1;
  session.pendingOrganismRefresh = true;
  session.remainingValues = [];
  sessionStorage.setItem(MEV_SET_IMPORT_SESSION_KEY, JSON.stringify(session));

  deptSelect.dispatchEvent(new Event('change', { bubbles: true }));

  // Si el onchange del portal no navegó solo, consultamos manualmente.
  window.setTimeout(() => {
    findConsultarControl()?.click();
  }, 800);

  return true;
}

// --- Plan B multi-departamento vía POSloguin ------------------------------
// Cuando la página de resultados del set NO ofrece un select de departamento,
// el recorrido completo se hace como lo haría el usuario: ir a la página de
// selección de departamento (POSloguin.asp), entrar al siguiente
// departamento, repetir la búsqueda del set y recorrer sus organismos. Los
// resultados se acumulan en la misma sesión y se deduplican por nidCausa.

/**
 * Si la sesión tiene recorrido por POSloguin (deptHop) con departamentos
 * pendientes (o aún sin leer), navega a la selección de departamento.
 * Devuelve true si tomó el control de la navegación.
 */
function startDeptHopSwitch(session: MevSetImportSession): boolean {
  const hop = session.deptHop;
  if (!hop) return false;
  if (hop.remaining !== null && hop.remaining.length === 0) return false;

  hop.phase = 'switch';
  hop.searchAttempts = 0;
  session.startedAt = Date.now();
  sessionStorage.setItem(MEV_SET_IMPORT_SESSION_KEY, JSON.stringify(session));

  showSetImportStatus('Cambiando de departamento judicial...');
  if (session.wizardRunId) {
    reportWizardProgress(
      session.wizardRunId,
      session.wizardSourceKey ?? '',
      'cambiando de departamento judicial...'
    );
  }

  // Preferir el link "Cambio de departamento" del propio portal; si no está
  // a la vista, navegar directo a POSloguin.asp.
  const link = findChangeDepartmentLink();
  if (link) {
    link.click();
  } else {
    window.location.href = new URL(MEV_URLS.posLogin, MEV_BASE_URL).href;
  }
  return true;
}

function findChangeDepartmentLink(): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll('a, input[type="button"], input[type="submit"], button')
  ) as HTMLElement[];
  for (const el of candidates) {
    if (el.closest('[id^="procu-asist"]')) continue;
    const text = ((el as HTMLInputElement).value || el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    // El portal lo llama "Cambiar Jurisdicción" (verificado en vivo).
    if (/cambi\w*\s+(de\s+)?(depto|departamento|jurisdicci)/i.test(text)) {
      return el;
    }
    if (/posloguin/i.test(el.getAttribute('href') ?? '')) return el;
  }
  return null;
}

/**
 * En POSloguin durante un recorrido multi-departamento: elegir el próximo
 * departamento del select real del portal y aceptar. Devuelve true si esta
 * carga de POSloguin es parte del recorrido (y no un login del usuario).
 *
 * Se acepta cualquier fase: 'switch' es lo esperado; 'search' significa que
 * el portal nos devolvió a POSloguin en vez de a la búsqueda; 'walk' que la
 * sesión del portal nos soltó en la selección de departamento a mitad del
 * recorrido. En todos los casos, seguir con el próximo departamento conserva
 * lo ya recolectado.
 */
function handleDeptHopPosLogin(doc: Document): boolean {
  const session = readSetImportSession();
  const hop = session?.deptHop;
  if (!session || !hop) return false;

  void (async () => {
    // Corrida del asistente cancelada desde el panel: cortar limpio acá,
    // sin entrar a un departamento más.
    if (session.wizardRunId && (await isImportAllCancelled())) {
      sessionStorage.removeItem(MEV_SET_IMPORT_SESSION_KEY);
      reportWizardSetDone(session.wizardRunId, session.wizardSourceKey ?? '', {
        ok: true,
        cancelled: true,
      });
      showSetImportStatus('Importación cancelada.');
      return;
    }

    const deptoSelect = doc.querySelector(
      MEV_SELECTORS.posLogin.depto
    ) as HTMLSelectElement | null;
    const aceptarBtn = doc.querySelector(
      MEV_SELECTORS.posLogin.aceptar
    ) as HTMLInputElement | null;
    if (!deptoSelect || !aceptarBtn) {
      // Página inesperada: cerrar con lo recolectado hasta acá.
      void finishSetImportSession(session);
      return;
    }

    if (hop.remaining === null) {
      // Primera visita: leer los códigos reales de departamento del portal.
      // El departamento inicial ya se recorrió: si su código quedó aprendido
      // en settings (installDepartmentLearner), se excluye para no repetirlo;
      // si no, la dedup de resultados por nidCausa evita duplicados igual.
      const stored = await chrome.storage.local.get('tl_settings');
      const settings = stored.tl_settings as
        | Record<string, unknown>
        | undefined;
      const initialDept = (settings?.mevDepartamento as string) ?? '';
      const values = Array.from(deptoSelect.options)
        .map((option) => option.value)
        .filter(
          (value) => value && value !== 'aa' && value !== initialDept
        );
      hop.remaining = values;
      hop.total = values.length + 1; // +1: el departamento inicial
    }

    let next = hop.remaining.shift();
    while (next) {
      deptoSelect.value = next;
      if (deptoSelect.value === next) break;
      next = hop.remaining.shift();
    }
    if (!next) {
      void finishSetImportSession(session);
      return;
    }

    // El radio "Departamento Judicial" deja el form en el estado correcto.
    const deptRadio = doc.querySelector(
      MEV_SELECTORS.posLogin.deptJudRadio
    ) as HTMLInputElement | null;
    if (deptRadio && !deptRadio.checked) deptRadio.click();

    hop.phase = 'search';
    hop.done += 1;
    hop.searchAttempts = 0;
    session.startedAt = Date.now();
    sessionStorage.setItem(
      MEV_SET_IMPORT_SESSION_KEY,
      JSON.stringify(session)
    );

    const totalInfo = hop.total ? `/${hop.total}` : '';
    showSetImportStatus(
      `Entrando al departamento ${hop.done + 1}${totalInfo}...`
    );
    if (session.wizardRunId) {
      reportWizardProgress(
        session.wizardRunId,
        session.wizardSourceKey ?? '',
        `entrando al departamento ${hop.done + 1}${totalInfo}...`
      );
    }

    window.setTimeout(() => aceptarBtn.click(), 500);
  })();

  return true;
}

/**
 * En busqueda.asp durante un recorrido multi-departamento: re-lanzar la
 * búsqueda del set en el departamento recién elegido. Devuelve true si esta
 * carga es parte del recorrido.
 */
function continueDeptHopOnBusqueda(): boolean {
  const session = readSetImportSession();
  const hop = session?.deptHop;
  if (!session || !hop || hop.phase === 'walk') return false;

  void (async () => {
    // Corrida del asistente cancelada desde el panel: cortar limpio.
    if (session.wizardRunId && (await isImportAllCancelled())) {
      sessionStorage.removeItem(MEV_SET_IMPORT_SESSION_KEY);
      reportWizardSetDone(session.wizardRunId, session.wizardSourceKey ?? '', {
        ok: true,
        cancelled: true,
      });
      showSetImportStatus('Importación cancelada.');
      return;
    }

    // Fase 'switch' en la búsqueda: el "cambio de departamento" no pasó por
    // POSloguin (p. ej. el portal redirigió directo). Reintentar POSloguin
    // un par de veces y, si no hay caso, cerrar con lo recolectado.
    if (hop.phase === 'switch') {
      hop.searchAttempts += 1;
      session.startedAt = Date.now();
      sessionStorage.setItem(
        MEV_SET_IMPORT_SESSION_KEY,
        JSON.stringify(session)
      );
      if (hop.searchAttempts > 2) {
        void finishSetImportSession(session);
        return;
      }
      window.location.href = new URL(MEV_URLS.posLogin, MEV_BASE_URL).href;
      return;
    }

    // Guard anti-rebote: si la búsqueda del set vuelve a caer acá, pasamos
    // al próximo departamento en vez de reintentar para siempre.
    hop.searchAttempts += 1;
    if (hop.searchAttempts > 2) {
      if (!startDeptHopSwitch(session)) void finishSetImportSession(session);
      return;
    }

    const setSelect = document.querySelector(
      MEV_SELECTORS.busqueda.set
    ) as HTMLSelectElement | null;
    if (!setSelect) {
      if (!startDeptHopSwitch(session)) void finishSetImportSession(session);
      return;
    }

    const radio = document.querySelector(
      MEV_SELECTORS.busqueda.radioSet
    ) as HTMLInputElement | null;
    if (radio && !radio.checked) radio.click();

    setSelect.value = hop.setId;
    if (setSelect.value !== hop.setId) {
      // El set no aparece en este departamento: probar el siguiente.
      if (!startDeptHopSwitch(session)) void finishSetImportSession(session);
      return;
    }
    setSelect.dispatchEvent(new Event('change', { bubbles: true }));

    // Los organismos del nuevo departamento se leen al llegar a resultados.
    session.remainingValues = [];
    session.pendingOrganismRefresh = true;
    session.startedAt = Date.now();
    sessionStorage.setItem(
      MEV_SET_IMPORT_SESSION_KEY,
      JSON.stringify(session)
    );

    const totalInfo = hop.total ? `/${hop.total}` : '';
    showSetImportStatus(
      `Buscando el set en el departamento ${hop.done + 1}${totalInfo}...`
    );
    if (session.wizardRunId) {
      reportWizardProgress(
        session.wizardRunId,
        session.wizardSourceKey ?? '',
        `buscando el set en el departamento ${hop.done + 1}${totalInfo}...`
      );
    }

    const buscar = document.querySelector(
      MEV_SELECTORS.busqueda.buscar
    ) as HTMLElement | null;
    const form = setSelect.form ?? setSelect.closest('form');
    window.setTimeout(() => {
      if (buscar) {
        buscar.click();
      } else if (form) {
        form.requestSubmit ? form.requestSubmit() : form.submit();
      }
    }, 400);
  })();

  return true;
}

/**
 * Página intermedia (p. ej. bienvenida tras elegir departamento): si hay un
 * recorrido esperando re-buscar el set (fase 'search') se va a la búsqueda;
 * si quedó esperando la selección de departamento (fase 'switch', p. ej. el
 * link de cambio de departamento cayó en un menú), se va a POSloguin.
 */
function redirectDeptHopToBusquedaIfPending(): void {
  const session = readSetImportSession();
  const hop = session?.deptHop;
  if (!session || !hop || hop.phase === 'walk') return;

  // Guard anti-loop: si el portal nos devuelve una y otra vez a una página
  // intermedia, cerrar con lo recolectado en vez de navegar para siempre.
  hop.searchAttempts += 1;
  session.startedAt = Date.now();
  sessionStorage.setItem(MEV_SET_IMPORT_SESSION_KEY, JSON.stringify(session));
  if (hop.searchAttempts > 3) {
    void finishSetImportSession(session);
    return;
  }

  if (hop.phase === 'search') {
    window.location.href = new URL(MEV_URLS.busqueda, MEV_BASE_URL).href;
  } else {
    window.location.href = new URL(MEV_URLS.posLogin, MEV_BASE_URL).href;
  }
}

/**
 * Modal chico para elegir el alcance de la importación del set.
 * deptCount null = no sabemos cuántos departamentos abarca (plan B por
 * POSloguin: se descubren al recorrer).
 */
function showSetScopeChoiceModal(
  deptCount: number | null
): Promise<'current' | 'all' | 'cancel'> {
  return new Promise((resolve) => {
    document.getElementById('procu-asist-set-scope-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'procu-asist-set-scope-modal';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: '9999999', display: 'flex', alignItems: 'center',
      justifyContent: 'center',
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      backgroundColor: 'white', borderRadius: '12px', padding: '20px',
      maxWidth: '420px', width: '92%', display: 'flex',
      flexDirection: 'column', gap: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      fontFamily: 'system-ui, sans-serif',
    });

    const title = document.createElement('h3');
    title.textContent = 'Importar set de búsqueda';
    Object.assign(title.style, { margin: '0', color: '#1f2937', fontSize: '15px' });

    const text = document.createElement('p');
    text.textContent =
      deptCount !== null
        ? `Este set abarca ${deptCount} departamentos judiciales. ¿Querés importar solo el departamento actual o recorrer el set completo? (Recorrer todos puede tardar varios minutos.)`
        : '¿Querés importar solo el departamento actual o recorrer el set en TODOS los departamentos judiciales? ProcuAsist cambia de departamento en automático y repite la búsqueda del set en cada uno. (Recorrer todos puede tardar varios minutos.)';
    Object.assign(text.style, { margin: '0', color: '#6b7280', fontSize: '12px', lineHeight: '1.5' });

    const buttons = document.createElement('div');
    Object.assign(buttons.style, {
      display: 'flex', flexDirection: 'column', gap: '8px',
    });

    const finish = (value: 'current' | 'all' | 'cancel') => {
      overlay.remove();
      resolve(value);
    };

    const allBtn = createPortalModalButton({
      label:
        deptCount !== null
          ? `Todos los departamentos (${deptCount})`
          : 'Todos los departamentos',
      variant: 'primary',
    });
    allBtn.addEventListener('click', () => finish('all'));

    const currentBtn = createPortalModalButton({
      label: 'Solo este departamento',
      variant: 'secondary',
    });
    currentBtn.addEventListener('click', () => finish('current'));

    const cancelBtn = createPortalModalButton({
      label: 'Cancelar',
      variant: 'secondary',
    });
    cancelBtn.addEventListener('click', () => finish('cancel'));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish('cancel');
    });

    buttons.appendChild(allBtn);
    buttons.appendChild(currentBtn);
    buttons.appendChild(cancelBtn);
    modal.appendChild(title);
    modal.appendChild(text);
    modal.appendChild(buttons);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

// --- Asistente "Importar todo" (disparado desde el panel lateral) ---------
// El background navega la pestaña MEV a busqueda.asp y manda
// IMPORT_ALL_MEV_START_SET. Acá se opera el form REAL del portal (radio de
// set + select + botón Buscar, los mismos selectores del flujo manual) y se
// deja un marcador en sessionStorage; al cargar los resultados, el marcador
// se adopta como sesión de importación de set SIN modales, con alcance
// "todos los departamentos". El final (o la cancelación) se reporta al
// background con IMPORT_ALL_MEV_SET_DONE.

const MEV_WIZARD_PENDING_KEY = 'procu_asist_wizard_set_pending';

interface MevWizardPending {
  runId: string;
  sourceKey: string;
  setId: string;
  startedAt: number;
}

function installWizardMessageListener(): void {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return false;
    const m = msg as {
      type?: string;
      runId?: string;
      sourceKey?: string;
      setId?: string;
    };
    if (m.type !== 'IMPORT_ALL_MEV_START_SET') return false;

    try {
      if (isLoginPage(document)) {
        sendResponse({ ok: false, error: 'session_expired' });
        return false;
      }
      if (!isBusquedaPage(document)) {
        sendResponse({
          ok: false,
          error: 'La pestaña MEV no está en la página de búsqueda.',
        });
        return false;
      }
      sendResponse(
        startWizardSetSearch(m.setId ?? '', m.runId ?? '', m.sourceKey ?? '')
      );
    } catch (err) {
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return false;
  });
}

function startWizardSetSearch(
  setId: string,
  runId: string,
  sourceKey: string
): { ok: boolean; error?: string } {
  const setSelect = document.querySelector(
    MEV_SELECTORS.busqueda.set
  ) as HTMLSelectElement | null;
  if (!setSelect) {
    return { ok: false, error: 'No se encontró el selector de sets en la búsqueda.' };
  }

  // Operar el form real: marcar el radio de "Set de Búsqueda" deja que el JS
  // propio del portal complete OpcionBusqueda al buscar.
  const radio = document.querySelector(
    MEV_SELECTORS.busqueda.radioSet
  ) as HTMLInputElement | null;
  if (radio && !radio.checked) radio.click();

  setSelect.value = setId;
  if (setSelect.value !== setId) {
    return { ok: false, error: 'El set indicado ya no existe en la página.' };
  }
  setSelect.dispatchEvent(new Event('change', { bubbles: true }));

  const pending: MevWizardPending = {
    runId,
    sourceKey,
    setId,
    startedAt: Date.now(),
  };
  sessionStorage.setItem(MEV_WIZARD_PENDING_KEY, JSON.stringify(pending));

  const buscar = document.querySelector(
    MEV_SELECTORS.busqueda.buscar
  ) as HTMLElement | null;
  const form = setSelect.form ?? setSelect.closest('form');
  if (!buscar && !form) {
    sessionStorage.removeItem(MEV_WIZARD_PENDING_KEY);
    return { ok: false, error: 'No se encontró el botón Buscar del formulario.' };
  }

  window.setTimeout(() => {
    if (buscar) {
      buscar.click();
    } else if (form) {
      form.requestSubmit ? form.requestSubmit() : form.submit();
    }
  }, 300);

  return { ok: true };
}

/**
 * Al cargar una página de resultados, si hay un arranque de set del asistente
 * pendiente, se convierte en sesión de importación (alcance: todos los
 * departamentos, sin modales). Devuelve true si el asistente tomó el control
 * de esta carga de página.
 */
async function adoptWizardSessionIfPending(
  results: MevSearchResult[]
): Promise<boolean> {
  const raw = sessionStorage.getItem(MEV_WIZARD_PENDING_KEY);
  if (!raw) return false;
  sessionStorage.removeItem(MEV_WIZARD_PENDING_KEY);

  let pending: MevWizardPending;
  try {
    pending = JSON.parse(raw) as MevWizardPending;
  } catch {
    return false;
  }
  if (!pending.runId || Date.now() - pending.startedAt > 5 * 60_000) {
    return false;
  }

  if (await isImportAllCancelled()) {
    reportWizardSetDone(pending.runId, pending.sourceKey, {
      ok: true,
      cancelled: true,
    });
    return true;
  }

  const select = findSetOrganismSelect();
  const options = select ? getSetOptionValues(select) : [];
  const deptSelect = select ? findSetDepartmentSelect(select) : null;
  const deptOptions = deptSelect ? getSetOptionValues(deptSelect) : [];

  if (!select && findNextResultsPageControl()) {
    // Resultados planos multi-página (sin UI de set): recorrer páginas.
    const walkSession: MevPageWalkSession = {
      collected: results,
      pagesVisited: 1,
      startedAt: Date.now(),
      wizardRunId: pending.runId,
      wizardSourceKey: pending.sourceKey,
    };
    sessionStorage.setItem(
      MEV_PAGE_WALK_SESSION_KEY,
      JSON.stringify(walkSession)
    );
    showSetImportStatus('Recolectando resultados (página 1)...');
    findNextResultsPageControl()?.click();
    return true;
  }

  const session: MevSetImportSession = {
    collected: results,
    remainingValues: select
      ? options.map((o) => o.value).filter((v) => v !== select.value)
      : [],
    startedAt: Date.now(),
    totalOrganisms: Math.max(options.length, 1),
    wizardRunId: pending.runId,
    wizardSourceKey: pending.sourceKey,
  };
  if (deptSelect && deptOptions.length > 1) {
    session.remainingDeptValues = deptOptions
      .map((o) => o.value)
      .filter((v) => v !== deptSelect.value);
    session.totalDepts = deptOptions.length;
    session.deptsDone = 0;
  } else {
    // Sin select de departamento en la página: recorrer el set completo
    // cambiando de departamento vía POSloguin (el asistente importa SIEMPRE
    // todos los departamentos).
    session.deptHop = {
      setId: pending.setId,
      remaining: null,
      done: 0,
      total: null,
      phase: 'walk',
      searchAttempts: 0,
    };
  }
  sessionStorage.setItem(MEV_SET_IMPORT_SESSION_KEY, JSON.stringify(session));

  // Ya estamos parados en la primera página de resultados del set: el camino
  // normal de sets se encarga del resto (organismos, departamentos, cierre).
  await continueSetImportIfActive(results);
  return true;
}

/**
 * Corta una corrida del asistente que quedó a mitad de camino en esta pestaña
 * (marker pendiente o sesión de recorrido con wizardRunId) y reporta el error
 * al background para que no espere hasta el timeout.
 */
function failWizardIfActive(reason: string): void {
  try {
    const rawPending = sessionStorage.getItem(MEV_WIZARD_PENDING_KEY);
    if (rawPending) {
      sessionStorage.removeItem(MEV_WIZARD_PENDING_KEY);
      const pending = JSON.parse(rawPending) as MevWizardPending;
      if (pending.runId) {
        reportWizardSetDone(pending.runId, pending.sourceKey ?? '', {
          ok: false,
          error: reason,
        });
      }
    }

    const rawSession = sessionStorage.getItem(MEV_SET_IMPORT_SESSION_KEY);
    if (rawSession) {
      const session = JSON.parse(rawSession) as MevSetImportSession;
      if (session.wizardRunId) {
        sessionStorage.removeItem(MEV_SET_IMPORT_SESSION_KEY);
        reportWizardSetDone(session.wizardRunId, session.wizardSourceKey ?? '', {
          ok: false,
          error: reason,
        });
      }
    }

    const rawWalk = sessionStorage.getItem(MEV_PAGE_WALK_SESSION_KEY);
    if (rawWalk) {
      const walk = JSON.parse(rawWalk) as MevPageWalkSession;
      if (walk.wizardRunId) {
        sessionStorage.removeItem(MEV_PAGE_WALK_SESSION_KEY);
        reportWizardSetDone(walk.wizardRunId, walk.wizardSourceKey ?? '', {
          ok: false,
          error: reason,
        });
      }
    }
  } catch {
    // sessionStorage dañado: nada que reportar
  }
}

async function isImportAllCancelled(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get(IMPORT_ALL_CANCEL_STORAGE_KEY);
    return stored[IMPORT_ALL_CANCEL_STORAGE_KEY] === true;
  } catch {
    return false;
  }
}

function reportWizardSetDone(
  runId: string,
  sourceKey: string,
  payload: {
    ok: boolean;
    imported?: number;
    existing?: number;
    monitored?: number;
    failed?: number;
    cancelled?: boolean;
    error?: string;
  }
): void {
  chrome.runtime
    .sendMessage({
      type: 'IMPORT_ALL_MEV_SET_DONE',
      runId,
      sourceKey,
      ...payload,
    })
    .catch(() => {});
}

function reportWizardProgress(
  runId: string,
  sourceKey: string,
  detail: string
): void {
  chrome.runtime
    .sendMessage({ type: 'IMPORT_ALL_PROGRESS', runId, sourceKey, detail })
    .catch(() => {});
}

async function continueSetImportIfActive(results: MevSearchResult[]) {
  const session = readSetImportSession();
  if (!session) return;

  // Corrida del asistente cancelada desde el panel: cortar limpio.
  if (session.wizardRunId && (await isImportAllCancelled())) {
    sessionStorage.removeItem(MEV_SET_IMPORT_SESSION_KEY);
    reportWizardSetDone(session.wizardRunId, session.wizardSourceKey ?? '', {
      ok: true,
      cancelled: true,
    });
    showSetImportStatus('Importación cancelada.');
    return;
  }

  // Refrescar startedAt mientras el recorrido sigue vivo: sin esto, un set
  // grande (>10 min) moría a mitad de camino por el guard de sesiones rancias.
  session.startedAt = Date.now();

  // Llegamos a resultados tras re-buscar el set en otro departamento
  // (plan B por POSloguin): retomar el recorrido normal de organismos.
  if (session.deptHop && session.deptHop.phase !== 'walk') {
    session.deptHop.phase = 'walk';
    session.deptHop.searchAttempts = 0;
  }

  session.collected = mergeMevSearchResults(session.collected, results);

  // Recién cambiamos de departamento: re-leer los organismos de ESTE depto.
  if (session.pendingOrganismRefresh) {
    session.pendingOrganismRefresh = false;
    const select = findSetOrganismSelect();
    if (select) {
      const options = getSetOptionValues(select);
      session.totalOrganisms = options.length;
      session.remainingValues = options
        .map((option) => option.value)
        .filter((value) => value !== select.value);
    } else {
      session.remainingValues = [];
    }
  }

  const hopTotal = session.deptHop?.total;
  const deptInfo =
    session.totalDepts && session.totalDepts > 1
      ? ` — depto ${(session.deptsDone ?? 0) + 1}/${session.totalDepts}`
      : session.deptHop
        ? ` — depto ${session.deptHop.done + 1}${hopTotal ? `/${hopTotal}` : ''}`
        : '';
  const currentStep = session.totalOrganisms - session.remainingValues.length;
  const statusMessage = `Importando set (organismo ${currentStep}/${session.totalOrganisms}${deptInfo}, ${session.collected.length} causas)...`;
  showSetImportStatus(statusMessage);
  if (session.wizardRunId) {
    // El progreso viaja al panel Y mantiene despierto al service worker.
    reportWizardProgress(
      session.wizardRunId,
      session.wizardSourceKey ?? '',
      `organismo ${currentStep}/${session.totalOrganisms}${deptInfo}, ${session.collected.length} causas`
    );
  }

  if (session.remainingValues.length > 0) {
    sessionStorage.setItem(MEV_SET_IMPORT_SESSION_KEY, JSON.stringify(session));
    setTimeout(() => {
      const latestSession = readSetImportSession();
      if (latestSession) goToNextSetOrganism(latestSession);
    }, 450);
    return;
  }

  // Organismos agotados en este departamento: ¿quedan departamentos del set?
  if (session.remainingDeptValues && session.remainingDeptValues.length > 0) {
    if (goToNextSetDepartment(session)) return;
    // Si el salto de departamento falla, cerramos con lo recolectado.
  }

  // Plan B multi-departamento: cambiar de departamento vía POSloguin.
  if (startDeptHopSwitch(session)) return;

  await finishSetImportSession(session);
}

/**
 * Cierre del recorrido de un set: importa lo recolectado, muestra el estado
 * y (si vino del asistente) reporta al background. Limpia la sesión antes de
 * importar para que un fallo no deje el recorrido colgado.
 */
async function finishSetImportSession(
  session: MevSetImportSession
): Promise<void> {
  sessionStorage.removeItem(MEV_SET_IMPORT_SESSION_KEY);
  try {
    const response = await bulkImportMevResults(session.collected);
    const hopNote =
      session.deptHop && session.deptHop.done > 0
        ? ' Ojo: la sesión de MEV quedó en el último departamento recorrido.'
        : '';
    showSetImportStatus(
      `Set importado: ${response.imported} nuevas, ${response.existing} existentes, ${response.monitored} monitoreadas.${hopNote}`,
      'success'
    );
    if (session.wizardRunId) {
      reportWizardSetDone(session.wizardRunId, session.wizardSourceKey ?? '', {
        ok: true,
        imported: response.imported,
        existing: response.existing,
        monitored: response.monitored,
        failed: response.failed ?? 0,
      });
    }
  } catch (err) {
    console.error('[ProcuAsist] MEV set import error:', err);
    showSetImportStatus('Error al importar el set.');
    if (session.wizardRunId) {
      reportWizardSetDone(session.wizardRunId, session.wizardSourceKey ?? '', {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// --- Multi-page results walk -------------------------------------------
// resultados.asp pagina del lado del servidor (POST/stateful), así que no
// se pueden fetchear las páginas: se recorren clickeando "Siguiente" y
// acumulando resultados en sessionStorage, igual que la importación de sets.

const MEV_PAGE_WALK_SESSION_KEY = 'procu_asist_mev_page_walk';
const MEV_PAGE_WALK_MAX_PAGES = 15;

interface MevPageWalkSession {
  collected: MevSearchResult[];
  pagesVisited: number;
  startedAt: number;
  /** Corrida del asistente "Importar todo" que disparó este recorrido. */
  wizardRunId?: string;
  wizardSourceKey?: string;
}

/** Busca el control "Siguiente" del paginador nativo de resultados.asp. */
function findNextResultsPageControl(): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll(
      'a, input[type="submit"], input[type="button"], button'
    )
  ) as HTMLElement[];

  for (const el of candidates) {
    // No matchear nuestra propia UI inyectada.
    if (el.closest('[id^="procu-asist"]')) continue;
    const text = (
      (el as HTMLInputElement).value ||
      el.textContent ||
      el.getAttribute('title') ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (!text) continue;
    if (/^(siguiente\b|p[áa]gina siguiente\b|pr[óo]xima\b|>{1,2}$)/.test(text)) {
      return el;
    }
  }
  return null;
}

function readPageWalkSession(): MevPageWalkSession | null {
  const raw = sessionStorage.getItem(MEV_PAGE_WALK_SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as MevPageWalkSession;
    if (!Array.isArray(session.collected)) return null;
    if (Date.now() - session.startedAt > 10 * 60 * 1000) {
      sessionStorage.removeItem(MEV_PAGE_WALK_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(MEV_PAGE_WALK_SESSION_KEY);
    return null;
  }
}

/** Si los resultados tienen más de una página, arranca el recorrido. */
function startPageWalkIfPossible(
  results: MevSearchResult[],
  btn: HTMLButtonElement
): boolean {
  const next = findNextResultsPageControl();
  if (!next) return false;

  const session: MevPageWalkSession = {
    collected: results,
    pagesVisited: 1,
    startedAt: Date.now(),
  };
  sessionStorage.setItem(MEV_PAGE_WALK_SESSION_KEY, JSON.stringify(session));

  setPortalActionButtonState(btn, ICON_LOADER, 'Recolectando', 'muted');
  btn.disabled = true;
  showSetImportStatus('Recolectando resultados (página 1)...');
  next.click();
  return true;
}

async function continuePageWalkIfActive(results: MevSearchResult[]) {
  // La importación de sets tiene prioridad si está en curso.
  if (readSetImportSession()) return;
  const session = readPageWalkSession();
  if (!session) return;

  // Corrida del asistente cancelada desde el panel: cortar limpio.
  if (session.wizardRunId && (await isImportAllCancelled())) {
    sessionStorage.removeItem(MEV_PAGE_WALK_SESSION_KEY);
    reportWizardSetDone(session.wizardRunId, session.wizardSourceKey ?? '', {
      ok: true,
      cancelled: true,
    });
    showSetImportStatus('Importación cancelada.');
    return;
  }

  session.collected = mergeMevSearchResults(session.collected, results);
  session.pagesVisited += 1;

  const next = findNextResultsPageControl();
  if (next && session.pagesVisited < MEV_PAGE_WALK_MAX_PAGES) {
    sessionStorage.setItem(MEV_PAGE_WALK_SESSION_KEY, JSON.stringify(session));
    showSetImportStatus(
      `Recolectando resultados (página ${session.pagesVisited}, ${session.collected.length} causas)...`
    );
    if (session.wizardRunId) {
      reportWizardProgress(
        session.wizardRunId,
        session.wizardSourceKey ?? '',
        `página ${session.pagesVisited}, ${session.collected.length} causas`
      );
    }
    setTimeout(() => next.click(), 400);
    return;
  }

  sessionStorage.removeItem(MEV_PAGE_WALK_SESSION_KEY);
  if (next) {
    showSetImportStatus(
      `Límite de ${MEV_PAGE_WALK_MAX_PAGES} páginas alcanzado — puede haber más resultados.`
    );
  }

  // Modo asistente: sin modal de selección, se importa todo lo recolectado
  // y se reporta el cierre al background.
  if (session.wizardRunId) {
    try {
      const response = await bulkImportMevResults(session.collected);
      showSetImportStatus(
        `Importadas: ${response.imported} nuevas, ${response.existing} existentes.`,
        'success'
      );
      reportWizardSetDone(session.wizardRunId, session.wizardSourceKey ?? '', {
        ok: true,
        imported: response.imported,
        existing: response.existing,
        monitored: response.monitored,
        failed: response.failed ?? 0,
      });
    } catch (err) {
      console.error('[ProcuAsist] MEV wizard page-walk import error:', err);
      showSetImportStatus('Error al importar los resultados.');
      reportWizardSetDone(session.wizardRunId, session.wizardSourceKey ?? '', {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  const selected = await showMevImportSelectionModal(session.collected);
  if (!selected || selected.length === 0) {
    document.getElementById('procu-asist-set-import-status')?.remove();
    return;
  }

  try {
    const response = await bulkImportMevResults(selected);
    showSetImportStatus(
      `Importadas: ${response.imported} nuevas, ${response.existing} existentes, ${response.monitored} monitoreadas.`,
      'success'
    );
  } catch (err) {
    console.error('[ProcuAsist] MEV page-walk import error:', err);
    showSetImportStatus('Error al importar los resultados.');
  }
}

function readSetImportSession(): MevSetImportSession | null {
  const raw = sessionStorage.getItem(MEV_SET_IMPORT_SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as MevSetImportSession;
    if (!Array.isArray(session.collected) || !Array.isArray(session.remainingValues)) {
      return null;
    }
    if (Date.now() - session.startedAt > 10 * 60 * 1000) {
      sessionStorage.removeItem(MEV_SET_IMPORT_SESSION_KEY);
      // No dejar al asistente esperando el timeout largo del background.
      if (session.wizardRunId) {
        reportWizardSetDone(session.wizardRunId, session.wizardSourceKey ?? '', {
          ok: false,
          error: 'El recorrido del set quedó inactivo demasiado tiempo.',
        });
      }
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(MEV_SET_IMPORT_SESSION_KEY);
    return null;
  }
}

function goToNextSetOrganism(session: MevSetImportSession): boolean {
  const nextValue = session.remainingValues.shift();
  if (!nextValue) return false;

  const select = findSetOrganismSelect();
  if (!select) return false;

  select.value = nextValue;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  sessionStorage.setItem(MEV_SET_IMPORT_SESSION_KEY, JSON.stringify(session));

  const consultar = findConsultarControl();
  if (consultar) {
    consultar.click();
    return true;
  }

  const form = select.form || select.closest('form');
  if (form) {
    form.requestSubmit?.();
    if (!form.requestSubmit) form.submit();
    return true;
  }

  return false;
}

function findConsultarControl(): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll('input, button'));
  for (const el of candidates) {
    const input = el as HTMLInputElement | HTMLButtonElement;
    if (/consultar/i.test(input.value || input.textContent || '')) {
      return el as HTMLElement;
    }
  }
  return null;
}

function findSetOrganismSelect(): HTMLSelectElement | null {
  const allSelects = Array.from(
    document.querySelectorAll('select')
  ) as HTMLSelectElement[];
  if (!allSelects.length) return null;

  const setText = document.body.textContent ?? '';
  if (!/Set de B[uú]squeda|Organismos del Set/i.test(setText)) return null;

  // Excluir el select de departamento para que el fallback "primer select"
  // no lo confunda con el de organismos.
  const deptSelect = findSetDepartmentSelect(null);
  const selects = allSelects.filter((select) => select !== deptSelect);

  return (
    selects.find((select) => {
      const context = [
        select.parentElement?.textContent ?? '',
        select.closest('td')?.previousElementSibling?.textContent ?? '',
        select.closest('tr')?.textContent ?? '',
      ].join(' ');
      return /organismo/i.test(context);
    }) ?? selects[0] ?? null
  );
}

function getSetOptionValues(select: HTMLSelectElement): Array<{ value: string; label: string }> {
  return Array.from(select.options)
    .map((option) => ({
      value: option.value,
      label: option.textContent?.trim() ?? option.value,
    }))
    .filter((option) => option.value);
}

function mergeMevSearchResults(
  previous: MevSearchResult[],
  next: MevSearchResult[]
): MevSearchResult[] {
  const map = new Map<string, MevSearchResult>();
  for (const result of [...previous, ...next]) {
    const key = result.nidCausa || result.numero || result.url;
    if (!key) continue;
    map.set(key, result);
  }
  return Array.from(map.values());
}

async function bulkImportMevResults(results: MevSearchResult[]) {
  return (await chrome.runtime.sendMessage({
    type: 'BULK_IMPORT',
    source: 'mev-results',
    monitor: true,
    cases: results.map((result) => ({
      id: result.nidCausa || result.numero,
      portal: 'mev' as const,
      caseNumber: result.numero || result.nidCausa,
      title: result.caratula || 'Sin caratula',
      court: '',
      fuero: '',
      portalUrl: result.url,
      lastMovementDate: result.ultimoMovimiento,
      metadata: {
        nidCausa: result.nidCausa,
        pidJuzgado: result.pidJuzgado,
      },
    })),
  })) as {
    status: string;
    imported: number;
    existing: number;
    monitored: number;
    failed?: number;
  };
}

function showSetImportStatus(message: string, variant: 'muted' | 'success' = 'muted') {
  const bar = ensureMevActionBar();
  let status = document.getElementById('procu-asist-set-import-status');
  if (!status) {
    status = document.createElement('div');
    status.id = 'procu-asist-set-import-status';
    Object.assign(status.style, {
      borderRadius: '10px',
      padding: '10px 14px',
      fontSize: '12px',
      fontWeight: '700',
      boxShadow: '0 10px 24px rgba(15, 23, 42, 0.16)',
      textAlign: 'center',
      maxWidth: '220px',
    });
    bar.prepend(status);
  }

  status.textContent = message;
  Object.assign(status.style, {
    backgroundColor: variant === 'success' ? '#16a34a' : '#eff6ff',
    color: variant === 'success' ? '#ffffff' : MEV_COLORS.primary,
    border: variant === 'success' ? '1px solid #16a34a' : '1px solid #bfdbfe',
  });

  if (variant === 'success') {
    setTimeout(() => status?.remove(), 8000);
  }
}

// --- Case Detail Page (procesales.asp) ---

function handleCasePage(doc: Document) {
  console.debug('[ProcuAsist] MEV case page detected');

  const caseData = parseCaseData(doc);
  if (!caseData) {
    console.warn('[ProcuAsist] Could not parse case data');
    return;
  }

  const movements = parseMovements(doc);
  console.debug(
    `[ProcuAsist] Case: ${caseData.numero} - ${caseData.caratula} (${movements.length} movements)`
  );

  // Send case data to background/sidepanel
  chrome.runtime.sendMessage({
    type: 'CASE_PAGE_DETECTED',
    caseData: {
      id: caseData.nidCausa,
      portal: 'mev' as const,
      caseNumber: caseData.numero,
      title: caseData.caratula,
      court: caseData.juzgado,
      fuero: '',
      portalUrl: window.location.href,
      metadata: {
        nidCausa: caseData.nidCausa,
        pidJuzgado: caseData.pidJuzgado,
        fechaInicio: caseData.fechaInicio,
        estadoPortal: caseData.estadoPortal,
        numeroReceptoria: caseData.numeroReceptoria,
      },
    },
  });

  // Inject action buttons (bookmark, monitor, PDF, ZIP)
  injectBookmarkButton(caseData);
  injectZipButton(caseData, movements);
}

// --- Proveido Page (Document View) ---

function handleProveidoPage(doc: Document) {
  console.debug('[ProcuAsist] MEV proveido page detected');

  const adjuntos = parseAdjuntos(doc);
  if (adjuntos.length > 0) {
    console.debug(`[ProcuAsist] Found ${adjuntos.length} adjuntos`);
  }
}

// --- Session Monitoring ---

function startSessionMonitor() {
  // Poll URL changes to detect session expiry redirect to login
  let lastUrl = window.location.href;
  let fired = false;

  // Single firing point: the interval and the MutationObserver can both
  // detect the login form, but SESSION_EXPIRED must only be sent once.
  const fireSessionExpired = () => {
    if (fired) return;
    fired = true;
    clearInterval(checkInterval);
    observer.disconnect();
    handleSessionExpired();
  };

  const checkInterval = setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      if (currentUrl.toLowerCase().includes('loguin')) {
        fireSessionExpired();
        return;
      }
    }

    // Also check DOM for login form appearing (e.g., via redirect within same page)
    if (isLoginPage(document)) {
      fireSessionExpired();
    }
  }, 3000);

  // Also watch for DOM mutations that might indicate session expiry
  const observer = new MutationObserver(() => {
    if (isLoginPage(document)) {
      fireSessionExpired();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function handleSessionExpired() {
  console.debug('[ProcuAsist] MEV session expired detected');

  // Store current URL so we can return after re-login
  sessionStorage.setItem('procu_asist_return_url', window.location.href);

  chrome.runtime.sendMessage({
    type: 'SESSION_EXPIRED',
    portal: 'mev',
    returnUrl: window.location.href,
  });
}

// --- UI Injections ---

function ensureMevActionBar(): HTMLDivElement {
  const bar = createPortalActionBar(MEV_ACTION_BAR_ID);
  if (!document.getElementById(MEV_CONFIG_ID)) {
    const configBtn = createConfigActionButton();
    configBtn.id = MEV_CONFIG_ID;
    bar.prepend(configBtn);
  }
  return bar;
}

function injectBookmarkButton(caseData: {
  numero: string;
  caratula: string;
  juzgado: string;
  nidCausa: string;
  pidJuzgado: string;
  fechaInicio: string;
  estadoPortal: string;
  numeroReceptoria: string;
}) {
  const bar = ensureMevActionBar();
  if (document.getElementById('procu-asist-bookmark')) return;

  // "Guardar" incluye el monitoreo: guardar = monitorear (modelo unificado).
  const btn = createPortalActionButton({
    id: 'procu-asist-bookmark',
    icon: ICON_STAR,
    label: 'Guardar',
    title: `Guardar y monitorear ${caseData.numero}`,
    variant: 'secondary',
  });

  // Check if already bookmarked (el nidCausa matchea causas importadas
  // desde sets, que entran sin el número de expediente formateado)
  chrome.runtime
    .sendMessage({
      type: 'IS_BOOKMARKED',
      portal: 'mev',
      caseNumber: caseData.numero,
      nidCausa: caseData.nidCausa,
    })
    .then((r) => {
      const resp = r as { success: boolean; isBookmarked: boolean };
      if (resp?.success && resp.isBookmarked) {
        setPortalActionButtonState(btn, ICON_CHECK, 'Guardado', 'success');
        btn.dataset.saved = 'true';
      }
    });

  btn.addEventListener('click', async () => {
    if (btn.dataset.saved === 'true') return;

    setPortalActionButtonState(btn, ICON_LOADER, 'Guardando', 'muted');
    btn.disabled = true;

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'ADD_BOOKMARK',
        caseData: {
          id: caseData.nidCausa,
          portal: 'mev' as const,
          caseNumber: caseData.numero,
          title: caseData.caratula,
          court: caseData.juzgado,
          fuero: '',
          portalUrl: window.location.href,
          metadata: {
            nidCausa: caseData.nidCausa,
            pidJuzgado: caseData.pidJuzgado,
            fechaInicio: caseData.fechaInicio,
            estadoPortal: caseData.estadoPortal,
            numeroReceptoria: caseData.numeroReceptoria,
          },
        },
      })) as { success: boolean };

      if (response?.success) {
        setPortalActionButtonState(btn, ICON_CHECK, 'Guardado', 'success');
        btn.dataset.saved = 'true';
      } else {
        setPortalActionButtonState(btn, ICON_X, 'Error', 'danger');
        setTimeout(() => {
          setPortalActionButtonState(btn, ICON_STAR, 'Guardar', 'secondary');
          btn.disabled = false;
        }, 2000);
      }
    } catch {
      setPortalActionButtonState(btn, ICON_X, 'Error', 'danger');
      setTimeout(() => {
        setPortalActionButtonState(btn, ICON_STAR, 'Guardar', 'secondary');
        btn.disabled = false;
      }, 2000);
    }
  });

  bar.appendChild(btn);
}

// --- Movement Selection Modal ---

function showMovementSelectionModal(
  movements: Movement[]
): Promise<{ movements: Movement[]; format: 'zip' | 'pdf' } | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: '9999999', display: 'flex', alignItems: 'center', justifyContent: 'center',
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      backgroundColor: 'white', borderRadius: '12px', padding: '24px',
      maxWidth: '650px', width: '92%', maxHeight: '80vh', display: 'flex',
      flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    });

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Seleccionar pasos procesales a descargar';
    Object.assign(title.style, {
      margin: '0 0 12px 0', color: '#1f2937', fontSize: '16px',
    });

    // Top buttons (select all / deselect all)
    const topBar = document.createElement('div');
    Object.assign(topBar.style, {
      display: 'flex', gap: '8px', marginBottom: '12px',
    });

    const selectAllBtn = createPortalModalButton({
      label: 'Seleccionar todos',
      variant: 'secondary',
    });

    const deselectAllBtn = createPortalModalButton({
      label: 'Deseleccionar todos',
      variant: 'secondary',
    });

    topBar.appendChild(selectAllBtn);
    topBar.appendChild(deselectAllBtn);

    // Scrollable list
    const list = document.createElement('div');
    Object.assign(list.style, {
      overflowY: 'auto', flex: '1', marginBottom: '12px', border: '1px solid #e5e7eb',
      borderRadius: '8px',
    });

    // Track checkboxes
    const checkboxes: HTMLInputElement[] = [];

    const updateDownloadBtn = () => {
      const count = checkboxes.filter((cb) => cb.checked).length;
      const disabled = count === 0;
      downloadBtn.textContent = `ZIP (${count})`;
      downloadPdfBtn.textContent = `Un PDF (${count})`;
      downloadBtn.disabled = disabled;
      downloadPdfBtn.disabled = disabled;
      downloadBtn.style.opacity = disabled ? '0.5' : '1';
      downloadPdfBtn.style.opacity = disabled ? '0.5' : '1';
    };

    for (let i = 0; i < movements.length; i++) {
      const mov = movements[i];
      const row = document.createElement('label');
      Object.assign(row.style, {
        display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
        borderBottom: i < movements.length - 1 ? '1px solid #f3f4f6' : 'none',
        cursor: 'pointer', fontSize: '12px', lineHeight: '1.4',
      });
      row.addEventListener('mouseenter', () => { row.style.backgroundColor = '#f9fafb'; });
      row.addEventListener('mouseleave', () => { row.style.backgroundColor = 'transparent'; });

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true; // All selected by default
      cb.style.flexShrink = '0';
      cb.addEventListener('change', updateDownloadBtn);
      checkboxes.push(cb);

      const info = document.createElement('div');
      info.style.flex = '1';

      const dateSpan = document.createElement('span');
      dateSpan.textContent = mov.date;
      Object.assign(dateSpan.style, { fontWeight: '600', color: '#1f2937', marginRight: '8px' });

      const fojasSpan = document.createElement('span');
      fojasSpan.textContent = mov.fojas ? `fs ${mov.fojas}` : '';
      Object.assign(fojasSpan.style, { color: '#9ca3af', marginRight: '8px', fontSize: '11px' });

      const descSpan = document.createElement('span');
      descSpan.textContent = mov.description.length > 50 ? mov.description.substring(0, 50) + '...' : mov.description;
      Object.assign(descSpan.style, { color: '#374151' });

      info.appendChild(dateSpan);
      if (mov.fojas) info.appendChild(fojasSpan);
      info.appendChild(descSpan);

      // Firma badge
      if (mov.type === 'firmado') {
        const firmaBadge = document.createElement('span');
        firmaBadge.textContent = 'Firm.';
        Object.assign(firmaBadge.style, {
          color: '#16a34a', fontSize: '11px', fontWeight: '600',
          backgroundColor: '#f0fdf4', padding: '2px 6px', borderRadius: '4px', flexShrink: '0',
        });
        row.appendChild(cb);
        row.appendChild(info);
        row.appendChild(firmaBadge);
      } else {
        row.appendChild(cb);
        row.appendChild(info);
      }

      list.appendChild(row);
    }

    selectAllBtn.addEventListener('click', () => {
      checkboxes.forEach((cb) => { cb.checked = true; });
      updateDownloadBtn();
    });

    deselectAllBtn.addEventListener('click', () => {
      checkboxes.forEach((cb) => { cb.checked = false; });
      updateDownloadBtn();
    });

    // Bottom buttons
    const bottomBar = document.createElement('div');
    Object.assign(bottomBar.style, {
      display: 'flex', justifyContent: 'flex-end', gap: '8px',
    });

    const cancelBtn = createPortalModalButton({
      label: 'Cancelar',
      variant: 'secondary',
    });

    const downloadBtn = createPortalModalButton({
      label: `ZIP (${movements.length})`,
      variant: 'secondary',
    });

    const downloadPdfBtn = createPortalModalButton({
      label: `Un PDF (${movements.length})`,
      variant: 'primary',
    });

    cancelBtn.addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });

    downloadBtn.addEventListener('click', () => {
      const selected = movements.filter((_, i) => checkboxes[i].checked);
      overlay.remove();
      resolve({ movements: selected, format: 'zip' });
    });

    downloadPdfBtn.addEventListener('click', () => {
      const selected = movements.filter((_, i) => checkboxes[i].checked);
      overlay.remove();
      resolve({ movements: selected, format: 'pdf' });
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(null);
      }
    });

    bottomBar.appendChild(cancelBtn);
    bottomBar.appendChild(downloadBtn);
    bottomBar.appendChild(downloadPdfBtn);

    modal.appendChild(title);
    modal.appendChild(topBar);
    modal.appendChild(list);
    modal.appendChild(bottomBar);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

// --- MEV Results Import Selection Modal ---

function showMevImportSelectionModal(
  results: MevSearchResult[]
): Promise<MevSearchResult[] | null> {
  return new Promise((resolve) => {
    document.getElementById('procu-asist-mev-import-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'procu-asist-mev-import-modal';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: '9999999', display: 'flex', alignItems: 'center',
      justifyContent: 'center',
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      backgroundColor: 'white', borderRadius: '12px', padding: '20px',
      maxWidth: '720px', width: '92%', maxHeight: '82vh',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      fontFamily: 'system-ui, sans-serif',
    });

    const title = document.createElement('h3');
    title.textContent = `Importar resultados — MEV (${results.length} causa(s))`;
    Object.assign(title.style, { margin: '0 0 4px 0', color: '#1f2937', fontSize: '16px' });

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Elegí cuáles importar como marcadores.';
    Object.assign(subtitle.style, { margin: '0 0 12px 0', color: '#6b7280', fontSize: '12px' });

    const topBar = document.createElement('div');
    Object.assign(topBar.style, { display: 'flex', gap: '8px', marginBottom: '10px' });
    const selectAllBtn = createPortalModalButton({ label: 'Seleccionar todos', variant: 'secondary' });
    const deselectAllBtn = createPortalModalButton({ label: 'Ninguno', variant: 'secondary' });
    topBar.appendChild(selectAllBtn);
    topBar.appendChild(deselectAllBtn);

    const list = document.createElement('div');
    Object.assign(list.style, {
      overflowY: 'auto', flex: '1', marginBottom: '12px',
      border: '1px solid #e5e7eb', borderRadius: '8px',
    });

    const checkboxes: HTMLInputElement[] = [];
    const importBtn = createPortalModalButton({ label: 'Importar', variant: 'primary' });

    const updateCount = () => {
      const count = checkboxes.filter((cb) => cb.checked).length;
      importBtn.textContent = `Importar seleccionados (${count})`;
      importBtn.disabled = count === 0;
      importBtn.style.opacity = count === 0 ? '0.5' : '1';
    };

    results.forEach((result, i) => {
      const label = document.createElement('label');
      Object.assign(label.style, {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 12px',
        borderBottom: i < results.length - 1 ? '1px solid #f3f4f6' : 'none',
        cursor: 'pointer', fontSize: '12px', lineHeight: '1.4',
      });

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.style.flexShrink = '0';
      cb.addEventListener('change', updateCount);
      checkboxes.push(cb);

      const info = document.createElement('div');
      info.style.flex = '1';
      const num = document.createElement('span');
      num.textContent = result.numero || result.nidCausa || '?';
      Object.assign(num.style, { fontWeight: '600', color: '#1f2937', marginRight: '8px' });
      const car = document.createElement('span');
      car.textContent = result.caratula || '(sin caratula)';
      car.style.color = '#374151';
      info.appendChild(num);
      info.appendChild(car);

      label.appendChild(cb);
      label.appendChild(info);
      list.appendChild(label);
    });

    selectAllBtn.addEventListener('click', () => {
      checkboxes.forEach((cb) => { cb.checked = true; });
      updateCount();
    });
    deselectAllBtn.addEventListener('click', () => {
      checkboxes.forEach((cb) => { cb.checked = false; });
      updateCount();
    });

    const bottomBar = document.createElement('div');
    Object.assign(bottomBar.style, { display: 'flex', justifyContent: 'flex-end', gap: '8px' });
    const cancelBtn = createPortalModalButton({ label: 'Cancelar', variant: 'secondary' });

    const finish = (value: MevSearchResult[] | null) => {
      overlay.remove();
      resolve(value);
    };

    cancelBtn.addEventListener('click', () => finish(null));
    importBtn.addEventListener('click', () => {
      finish(results.filter((_, i) => checkboxes[i].checked));
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(null);
    });

    bottomBar.appendChild(cancelBtn);
    bottomBar.appendChild(importBtn);

    modal.appendChild(title);
    modal.appendChild(subtitle);
    modal.appendChild(topBar);
    modal.appendChild(list);
    modal.appendChild(bottomBar);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    updateCount();
  });
}

// --- ZIP Download Button ---

function injectZipButton(caseData: MevCaseData, movements: Movement[]) {
  if (document.getElementById('procu-asist-zip')) return;

  const bar = ensureMevActionBar();
  const btn = createPortalActionButton({
    id: 'procu-asist-zip',
    icon: ICON_PACKAGE,
    label: 'Descargar',
    title: `Descargar expediente ${caseData.numero} (ZIP o un PDF único)`,
    variant: 'primary',
  });

  // Progress bar element (hidden by default)
  const progressBar = document.createElement('div');
  Object.assign(progressBar.style, {
    position: 'fixed',
    bottom: '20px',
    right: '188px',
    width: '280px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    padding: '8px 12px',
    fontSize: '11px',
    zIndex: '999999',
    display: 'none',
    flexDirection: 'column',
    gap: '4px',
  });

  const progressLabel = document.createElement('span');
  progressLabel.style.color = '#374151';
  progressLabel.textContent = '';

  const progressTrack = document.createElement('div');
  Object.assign(progressTrack.style, {
    height: '6px',
    backgroundColor: '#e5e7eb',
    borderRadius: '3px',
    overflow: 'hidden',
  });

  const progressFill = document.createElement('div');
  Object.assign(progressFill.style, {
    height: '100%',
    backgroundColor: MEV_COLORS.primary,
    borderRadius: '3px',
    width: '0%',
    transition: 'width 0.3s',
  });

  progressTrack.appendChild(progressFill);
  progressBar.appendChild(progressLabel);
  progressBar.appendChild(progressTrack);
  document.body.appendChild(progressBar);

  btn.addEventListener('click', async () => {
    // Show selection modal first (lets the user pick ZIP or single PDF)
    const choice = await showMovementSelectionModal(movements);
    if (!choice || choice.movements.length === 0) return;
    const selectedMovements = choice.movements;

    setPortalActionButtonState(btn, ICON_LOADER, 'Preparando', 'muted');
    btn.disabled = true;
    progressBar.style.display = 'flex';
    progressLabel.textContent = 'Iniciando...';
    progressFill.style.width = '5%';

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'GENERATE_ZIP',
        format: choice.format,
        caseData: {
          caseNumber: caseData.numero,
          title: caseData.caratula,
          court: caseData.juzgado,
          portal: 'mev',
          portalUrl: window.location.href,
          fechaInicio: caseData.fechaInicio,
          estadoPortal: caseData.estadoPortal,
          numeroReceptoria: caseData.numeroReceptoria,
          movements: selectedMovements.map((m) => ({
            date: m.date,
            fojas: m.fojas,
            description: m.description,
            type: m.type,
            hasDocuments: m.hasDocuments,
            documentUrls: m.documentUrls,
          })),
        },
      })) as {
        success: boolean;
        filename?: string;
        error?: string;
        stats?: {
          totalMovements: number;
          proveidosDownloaded: number;
          proveidosFailed: number;
          adjuntosDownloaded: number;
          adjuntosFailed: number;
          allSuccessful: boolean;
          failedItems: Array<{
            type: string;
            index: number;
            date: string;
            description: string;
            url: string;
            error: string;
          }>;
        };
      };

      if (response?.success) {
        const s = response.stats;
        const totalOk = (s?.proveidosDownloaded ?? 0) + (s?.adjuntosDownloaded ?? 0);
        const totalFailed = (s?.proveidosFailed ?? 0) + (s?.adjuntosFailed ?? 0);
        const summary = s
          ? `${totalOk} descargados${totalFailed > 0 ? `, ${totalFailed} fallaron` : ''}`
          : 'listo';
        setPortalActionButtonState(
          btn,
          ICON_CHECK,
          choice.format === 'pdf' ? 'PDF listo' : 'ZIP listo',
          s?.allSuccessful ? 'success' : 'warning'
        );
        progressLabel.textContent = `Listo: ${summary}`;
        progressFill.style.width = '100%';

        // Show error overlay if there were failures
        if (s && !s.allSuccessful && s.failedItems.length > 0) {
          showVerificationOverlay(s.failedItems);
        }
      } else {
        setPortalActionButtonState(btn, ICON_X, 'Error', 'danger');
        progressLabel.textContent = response?.error ?? 'Error';
        progressFill.style.backgroundColor = DANGER_COLOR;
        progressFill.style.width = '100%';
      }
    } catch (err) {
      setPortalActionButtonState(btn, ICON_X, 'Error', 'danger');
      progressLabel.textContent = String(err);
    }

    setTimeout(() => {
      setPortalActionButtonState(btn, ICON_PACKAGE, 'Descargar', 'primary');
      btn.disabled = false;
      progressBar.style.display = 'none';
    }, 5000);
  });

  const configBtn = document.getElementById(MEV_CONFIG_ID);
  if (configBtn?.nextSibling) {
    bar.insertBefore(btn, configBtn.nextSibling);
  } else {
    bar.prepend(btn);
  }
}

// --- Verification Error Overlay ---

function showVerificationOverlay(
  failedItems: Array<{ type: string; index: number; date: string; description: string; url: string; error: string }>
) {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: '9999999', display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  const modal = document.createElement('div');
  Object.assign(modal.style, {
    backgroundColor: 'white', borderRadius: '12px', padding: '24px',
    maxWidth: '550px', width: '90%', maxHeight: '70vh', display: 'flex',
    flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  });

  const title = document.createElement('h3');
  title.textContent = `Descarga con ${failedItems.length} error(es)`;
  Object.assign(title.style, {
    margin: '0 0 12px 0', color: '#dc2626', fontSize: '16px',
  });

  const subtitle = document.createElement('p');
  subtitle.textContent = 'El ZIP se genero pero algunos archivos no pudieron descargarse. Ver archivo _verificacion.txt dentro del ZIP para mas detalles.';
  Object.assign(subtitle.style, {
    margin: '0 0 12px 0', color: '#6b7280', fontSize: '13px',
  });

  const list = document.createElement('div');
  Object.assign(list.style, {
    overflowY: 'auto', flex: '1', marginBottom: '12px',
  });

  for (const item of failedItems) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      padding: '8px', borderBottom: '1px solid #e5e7eb', fontSize: '12px',
    });
    // Built with textContent (not innerHTML): description/error come from
    // portal data and must never be interpreted as HTML.
    const badge = document.createElement('strong');
    badge.style.color = '#dc2626';
    badge.textContent = item.type === 'proveido' ? '[DOC]' : '[ADJ]';
    row.appendChild(badge);
    row.appendChild(
      document.createTextNode(` Paso ${item.index} — ${item.date}`)
    );
    row.appendChild(document.createElement('br'));
    const desc = document.createElement('span');
    desc.style.color = '#374151';
    desc.textContent = item.description;
    row.appendChild(desc);
    row.appendChild(document.createElement('br'));
    const errSpan = document.createElement('span');
    Object.assign(errSpan.style, { color: '#9ca3af', fontSize: '11px' });
    errSpan.textContent = `Error: ${item.error}`;
    row.appendChild(errSpan);
    list.appendChild(row);
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Cerrar';
  Object.assign(closeBtn.style, {
    padding: '8px 20px', borderRadius: '8px', border: 'none',
    backgroundColor: '#7c3aed', color: 'white', fontSize: '13px',
    fontWeight: '600', cursor: 'pointer', alignSelf: 'flex-end',
  });
  closeBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  modal.appendChild(title);
  modal.appendChild(subtitle);
  modal.appendChild(list);
  modal.appendChild(closeBtn);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// --- Dark Mode ---

function applyDarkModeIfEnabled() {
  chrome.storage.local.get('tl_settings', (result) => {
    const settings = result.tl_settings as Record<string, unknown> | undefined;
    if (settings?.darkMode) {
      // TODO Phase 7: Inject dark mode CSS for MEV
      console.debug('[ProcuAsist] Dark mode enabled (CSS injection pending)');
    }
  });
}
