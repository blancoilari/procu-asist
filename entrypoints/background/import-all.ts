/**
 * Orquestador del asistente "Importar todo".
 *
 * Fase de conteo: detecta pestañas MEV/SCW con sesión (el mismo patrón que el
 * monitoreo), estima los listados PJN por paginador (última página × filas
 * por página, navegando la pestaña SCW entre relacionados y favoritos) y
 * enumera los sets MEV leyendo el form de busqueda.asp. Los sets NO se
 * cuentan por adelantado: caminar páginas solo para contar castiga al portal.
 *
 * Fase de ejecución: reusa los caminos de importación existentes. PJN corre
 * el collector multi-página del content script (tope elevado + pausas de
 * cortesía); MEV dispara el flujo de set multi-departamento existente. Todo
 * el trabajo largo vive en los content scripts, que reportan progreso por
 * mensajes de runtime: cada mensaje resetea el timer de idle del service
 * worker MV3, que de otro modo moriría a los ~30s. Si igual el SW muere en
 * el medio (caso borde), la corrida queda marcada como error por timeout en
 * la próxima lectura del progreso; nada se corrompe porque la deduplicación
 * de marcadores/monitores es idempotente.
 *
 * Todas las causas importadas entran con avisos ACTIVOS: guardar = monitorear,
 * sin excepciones (la pausa por umbral de 0.7.0 se eliminó a pedido del
 * titular; los avisos se pausan por causa desde la lista si hace falta).
 */

import {
  IMPORT_ALL_CANCEL_STORAGE_KEY,
  IMPORT_ALL_PROGRESS_STORAGE_KEY,
  type ImportAllDetectResult,
  type ImportAllMevSetDoneMessage,
  type ImportAllPjnSource,
  type ImportAllRunProgress,
  type ImportAllSelection,
  type ImportAllSourceDoneMessage,
  type ImportAllSourceProgress,
} from '@/modules/messages/types';
import { runBulkImport } from '@/modules/storage/bulk-import';
import { getSettings } from '@/modules/storage/settings-store';
import { MEV_BASE_URL, MEV_URLS } from '@/modules/portals/mev-selectors';
import {
  PJN_SCW_BASE_URL,
  PJN_SCW_PATHS,
} from '@/modules/portals/pjn-selectors';

const IMPORT_ALL_PROGRESS_KEY = IMPORT_ALL_PROGRESS_STORAGE_KEY;
const IMPORT_ALL_CANCEL_KEY = IMPORT_ALL_CANCEL_STORAGE_KEY;

const PJN_SOURCE_TIMEOUT_MS = 15 * 60_000;
// Un set puede recorrer TODOS los departamentos judiciales vía POSloguin
// (~20 saltos con búsquedas y organismos): margen amplio.
const MEV_SET_TIMEOUT_MS = 45 * 60_000;
const NAVIGATION_TIMEOUT_MS = 25_000;
const SETTLE_DELAY_MS = 2_000;

// ────────────────────────────────────────────────────────
// Estado en memoria de la corrida activa
// ────────────────────────────────────────────────────────

interface ActiveRun {
  runId: string;
  progress: ImportAllRunProgress;
  /** Resolvers pendientes por sourceKey (una fuente a la vez, pero el mapa
   *  tolera respuestas tardías sin romper). */
  resolvers: Map<string, (msg: SourceDone) => void>;
}

type SourceDone =
  | ImportAllSourceDoneMessage
  | ImportAllMevSetDoneMessage
  | { timeout: true };

let activeRun: ActiveRun | null = null;

export function isImportAllRunning(): boolean {
  return !!activeRun?.progress.running;
}

async function saveProgress(): Promise<void> {
  if (!activeRun) return;
  await chrome.storage.session.set({
    [IMPORT_ALL_PROGRESS_KEY]: activeRun.progress,
  });
}

async function isCancelRequested(): Promise<boolean> {
  const stored = await chrome.storage.local.get(IMPORT_ALL_CANCEL_KEY);
  return stored[IMPORT_ALL_CANCEL_KEY] === true;
}

// ────────────────────────────────────────────────────────
// Fase 1: detección y conteo
// ────────────────────────────────────────────────────────

export async function detectImportAllSources(): Promise<ImportAllDetectResult> {
  const [pjn, mev] = await Promise.all([detectPjn(), detectMev()]);
  return { pjn, mev };
}

async function detectPjn(): Promise<ImportAllDetectResult['pjn']> {
  const tabId = await findScwTabId();
  if (!tabId) {
    return { hasTab: false, hasSession: false, sources: [] };
  }

  const sources: ImportAllPjnSource[] = [];
  let hasSession = true;

  for (const list of ['relacionados', 'favoritos'] as const) {
    const url = `${PJN_SCW_BASE_URL}${PJN_SCW_PATHS[list]}`;
    try {
      await navigateTabAndWait(tabId, url);
      const tab = await chrome.tabs.get(tabId);
      // Si el SCW redirigió al SSO, no hay sesión: no seguimos estimando.
      if (!tab.url?.startsWith(PJN_SCW_BASE_URL)) {
        hasSession = false;
        break;
      }
      const estimate = await estimateScwList(tabId);
      if (estimate.loginDetected) {
        hasSession = false;
        break;
      }
      sources.push({
        list,
        estimatedCases: estimate.estimatedCases,
        pages: estimate.lastPage,
      });
    } catch (err) {
      sources.push({
        list,
        estimatedCases: null,
        pages: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { hasTab: true, hasSession, sources };
}

/**
 * Estimación del listado visible: filas de la primera página × última página
 * del paginador. Aproximada a propósito (la última página suele venir
 * incompleta y Relacionados tiene sub-solapas PARTE/LETRADO): alcanza para
 * decidir el umbral, el número exacto sale al importar.
 */
async function estimateScwList(tabId: number): Promise<{
  estimatedCases: number | null;
  lastPage: number | null;
  loginDetected: boolean;
}> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      const normalize = (value: string) =>
        value
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();

      const loginDetected = !!document.querySelector(
        '#kc-form-login, input#username[name="username"]'
      );

      // Tabla del listado: misma heurística de encabezados que el respaldo
      // del monitoreo (expediente + carátula + últ. actualización).
      let rowsVisible = 0;
      for (const table of document.querySelectorAll('table')) {
        const headers = Array.from(
          table.querySelectorAll('th, thead td')
        ).map((cell) => normalize(cell.textContent ?? ''));
        if (
          headers.some((h) => h.includes('expediente')) &&
          headers.some((h) => h.includes('caratula'))
        ) {
          rowsVisible = table.querySelectorAll('tbody tr').length;
          break;
        }
      }

      // Última página del paginador: número más alto dentro de contenedores
      // de paginación (Bootstrap, RichFaces 3/4, paginadores JSF genéricos).
      const containers = document.querySelectorAll(
        'ul.pagination, .pagination, [class*="datascr"], [class*="rf-ds"], [class*="paginator"], [class*="pager"]'
      );
      let lastPage = 0;
      for (const container of containers) {
        const candidates = [
          container,
          ...container.querySelectorAll('a, button, td, span, div, li'),
        ];
        for (const el of candidates) {
          if (el.childElementCount > 1) continue;
          const compact = normalize(el.textContent ?? '').replace(/\s+/g, '');
          if (/^\d{1,4}$/.test(compact)) {
            lastPage = Math.max(lastPage, Number(compact));
          }
        }
      }

      return { rowsVisible, lastPage, loginDetected };
    },
  });

  const result = results[0]?.result as
    | { rowsVisible: number; lastPage: number; loginDetected: boolean }
    | undefined;
  if (!result) return { estimatedCases: null, lastPage: null, loginDetected: false };
  if (result.loginDetected) {
    return { estimatedCases: null, lastPage: null, loginDetected: true };
  }

  const estimated =
    result.lastPage > 1
      ? result.lastPage * Math.max(result.rowsVisible, 1)
      : result.rowsVisible;

  return {
    estimatedCases: estimated,
    lastPage: result.lastPage > 1 ? result.lastPage : 1,
    loginDetected: false,
  };
}

async function detectMev(): Promise<ImportAllDetectResult['mev']> {
  const tabId = await findMevTabId();
  if (!tabId) {
    return { hasTab: false, hasSession: false, sets: [] };
  }

  const settings = await getSettings();

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (
        baseUrl: string,
        busquedaPath: string,
        posLoginPath: string,
        preferredDept: string
      ) => {
        const fetchHtml = async (
          input: string,
          init?: RequestInit
        ): Promise<string | { error: string }> => {
          const resp = await fetch(input, {
            credentials: 'include',
            headers: { Accept: 'text/html', ...(init?.headers ?? {}) },
            ...init,
          });
          if (!resp.ok) return { error: `HTTP ${resp.status}` };
          return new TextDecoder('windows-1252').decode(
            await resp.arrayBuffer()
          );
        };
        const isLoginHtml = (html: string) => {
          const low = html.toLowerCase();
          return (
            low.includes('ingrese los datos del usuario') ||
            (low.includes('name="usuario"') && low.includes('name="clave"'))
          );
        };
        const parseSets = (html: string) => {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const select = doc.querySelector("select[name='Set']");
          return select
            ? Array.from((select as HTMLSelectElement).options)
                .map((o) => ({
                  id: o.value,
                  nombre: (o.textContent ?? '').replace(/\s+/g, ' ').trim(),
                }))
                .filter((s) => s.id)
            : null;
        };

        try {
          const url = new URL(busquedaPath, baseUrl).href;
          let html = await fetchHtml(url);
          if (typeof html !== 'string') return html;
          if (isLoginHtml(html)) return { error: 'session_expired' };

          let sets = parseSets(html);

          // Sesión logueada pero sin departamento elegido (POSloguin): la MEV
          // no muestra la búsqueda hasta entrar a un departamento. Entrar
          // automáticamente (preferido o el primero real) y reintentar; para
          // importar da igual el departamento, el recorrido cubre todos.
          if (!sets && html.includes('DtoJudElegido')) {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const deptSelect = doc.querySelector(
              "select[name='DtoJudElegido']"
            ) as HTMLSelectElement | null;
            const codes = deptSelect
              ? Array.from(deptSelect.options)
                  .map((o) => o.value)
                  .filter((v) => v && v !== 'aa')
              : [];
            const target = codes.includes(preferredDept)
              ? preferredDept
              : codes[0];
            if (!target) return { error: 'needs_department' };

            const postResult = await fetchHtml(
              new URL(posLoginPath, baseUrl).href,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  TipoDto: 'CC',
                  DtoJudElegido: target,
                  Aceptar: 'Aceptar',
                }),
              }
            );
            if (typeof postResult !== 'string') return postResult;

            html = await fetchHtml(url);
            if (typeof html !== 'string') return html;
            if (isLoginHtml(html)) return { error: 'session_expired' };
            sets = parseSets(html);
            if (!sets) return { error: 'needs_department' };
          }

          return { sets: sets ?? [] };
        } catch (e) {
          return { error: String(e) };
        }
      },
      args: [
        MEV_BASE_URL,
        MEV_URLS.busqueda,
        MEV_URLS.posLogin,
        settings.mevDepartamento,
      ],
    });

    const result = results[0]?.result as
      | { sets: Array<{ id: string; nombre: string }>; error?: never }
      | { error: string; sets?: never }
      | undefined;

    if (!result || result.error) {
      return {
        hasTab: true,
        hasSession: result?.error !== 'session_expired' ? true : false,
        sets: [],
        error: result?.error ?? 'sin_respuesta',
      };
    }
    return { hasTab: true, hasSession: true, sets: result.sets ?? [] };
  } catch (err) {
    return {
      hasTab: true,
      hasSession: false,
      sets: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ────────────────────────────────────────────────────────
// Fase 3: ejecución
// ────────────────────────────────────────────────────────

export async function startImportAllRun(
  selection: ImportAllSelection
): Promise<{ success: boolean; error?: string }> {
  if (isImportAllRunning()) {
    return { success: false, error: 'Ya hay una importación en curso.' };
  }

  const runId = crypto.randomUUID();

  const sources: ImportAllSourceProgress[] = [];
  if (selection.pjnRelacionados) {
    sources.push(emptySource('pjn-relacionados', 'PJN: Relacionados'));
  }
  if (selection.pjnFavoritos) {
    sources.push(emptySource('pjn-favoritos', 'PJN: Favoritos'));
  }
  for (const set of selection.mevSets) {
    sources.push(emptySource(`mev-set-${set.id}`, `MEV: set "${set.nombre}"`));
  }
  if (!sources.length) {
    return { success: false, error: 'No hay fuentes seleccionadas.' };
  }

  activeRun = {
    runId,
    progress: {
      runId,
      running: true,
      cancelled: false,
      startedAt: new Date().toISOString(),
      sources,
      totalImported: 0,
      totalExisting: 0,
      totalFailed: 0,
    },
    resolvers: new Map(),
  };
  await chrome.storage.local.remove(IMPORT_ALL_CANCEL_KEY);
  await saveProgress();

  // La corrida sigue en background; el panel lee el progreso de
  // storage.session vía onChanged.
  void executeRun(selection).catch(async (err) => {
    console.error('[ProcuAsist] Importar todo: error no capturado:', err);
    if (activeRun) {
      activeRun.progress.running = false;
      activeRun.progress.finishedAt = new Date().toISOString();
      for (const source of activeRun.progress.sources) {
        if (source.state === 'pending' || source.state === 'running') {
          source.state = 'error';
          source.detail = 'La corrida se interrumpió.';
        }
      }
      await saveProgress();
    }
  });

  return { success: true };
}

function emptySource(key: string, label: string): ImportAllSourceProgress {
  return {
    key,
    label,
    state: 'pending',
    imported: 0,
    existing: 0,
    failed: 0,
  };
}

async function executeRun(selection: ImportAllSelection): Promise<void> {
  if (!activeRun) return;
  const run = activeRun;

  for (const source of run.progress.sources) {
    if (await isCancelRequested()) {
      source.state = 'cancelled';
      continue;
    }

    source.state = 'running';
    await saveProgress();

    try {
      if (source.key === 'pjn-relacionados' || source.key === 'pjn-favoritos') {
        await runPjnSource(
          run,
          source,
          source.key === 'pjn-favoritos' ? 'favoritos' : 'relacionados'
        );
      } else if (source.key.startsWith('mev-set-')) {
        const setId = source.key.slice('mev-set-'.length);
        await runMevSetSource(run, source, setId);
      }
    } catch (err) {
      source.state = 'error';
      source.detail = err instanceof Error ? err.message : String(err);
      console.warn(`[ProcuAsist] Importar todo: fuente ${source.key} falló:`, err);
    }

    await saveProgress();
  }

  run.progress.cancelled = await isCancelRequested();
  run.progress.running = false;
  run.progress.finishedAt = new Date().toISOString();
  await chrome.storage.local.remove(IMPORT_ALL_CANCEL_KEY);
  await saveProgress();
  activeRun = null;
}

async function runPjnSource(
  run: ActiveRun,
  source: ImportAllSourceProgress,
  list: 'relacionados' | 'favoritos'
): Promise<void> {
  const tabId = await findScwTabId();
  if (!tabId) {
    source.state = 'error';
    source.detail = 'No hay pestaña de scw.pjn.gov.ar abierta.';
    return;
  }

  await navigateTabAndWait(tabId, `${PJN_SCW_BASE_URL}${PJN_SCW_PATHS[list]}`);
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url?.startsWith(PJN_SCW_BASE_URL)) {
    source.state = 'error';
    source.detail = 'La sesión de PJN/SCW expiró. Iniciá sesión y reintentá.';
    return;
  }

  const donePromise = waitForSourceDone(run, source.key, PJN_SOURCE_TIMEOUT_MS);

  const ack = await sendTabMessageWithRetry<{ ok: boolean; error?: string }>(
    tabId,
    {
      type: 'IMPORT_ALL_COLLECT_LIST',
      runId: run.runId,
      sourceKey: source.key,
    }
  );

  if (!ack?.ok) {
    run.resolvers.delete(source.key);
    source.state = 'error';
    source.detail = ack?.error ?? 'El listado PJN no respondió.';
    return;
  }

  const done = await donePromise;
  if ('timeout' in done) {
    source.state = 'error';
    source.detail = 'La recolección PJN no terminó a tiempo.';
    return;
  }
  const doneMsg = done as ImportAllSourceDoneMessage;
  if (!doneMsg.ok) {
    source.state = 'error';
    source.detail = doneMsg.error ?? 'Error al recolectar el listado.';
    return;
  }

  const cases = doneMsg.cases ?? [];
  source.detail = `${doneMsg.pagesVisited ?? 1} página(s) recolectadas${
    doneMsg.truncated ? ' (corte por tope: puede haber más)' : ''
  }`;
  await saveProgress();

  const summary = await runBulkImport(cases, `import-all-${source.key}`, true);
  source.imported = summary.imported;
  source.existing = summary.existing;
  source.failed = summary.failed;
  run.progress.totalImported += summary.imported;
  run.progress.totalExisting += summary.existing;
  run.progress.totalFailed += summary.failed;

  source.state = doneMsg.cancelled ? 'cancelled' : 'done';
}

async function runMevSetSource(
  run: ActiveRun,
  source: ImportAllSourceProgress,
  setId: string
): Promise<void> {
  const tabId = await findMevTabId();
  if (!tabId) {
    source.state = 'error';
    source.detail = 'No hay pestaña de MEV abierta.';
    return;
  }

  await navigateTabAndWait(tabId, `${MEV_BASE_URL}${MEV_URLS.busqueda}`);

  const donePromise = waitForSourceDone(run, source.key, MEV_SET_TIMEOUT_MS);

  const ack = await sendTabMessageWithRetry<{ ok: boolean; error?: string }>(
    tabId,
    {
      type: 'IMPORT_ALL_MEV_START_SET',
      runId: run.runId,
      sourceKey: source.key,
      setId,
    }
  );

  if (!ack?.ok) {
    run.resolvers.delete(source.key);
    source.state = 'error';
    source.detail =
      ack?.error === 'session_expired'
        ? 'La sesión de MEV expiró. Iniciá sesión y reintentá.'
        : (ack?.error ?? 'La página de búsqueda MEV no respondió.');
    return;
  }

  const done = await donePromise;
  if ('timeout' in done) {
    source.state = 'error';
    source.detail = 'El recorrido del set no terminó a tiempo.';
    return;
  }
  const doneMsg = done as ImportAllMevSetDoneMessage;
  if (!doneMsg.ok && !doneMsg.cancelled) {
    source.state = 'error';
    source.detail = doneMsg.error ?? 'Error al recorrer el set.';
    return;
  }

  source.imported = doneMsg.imported ?? 0;
  source.existing = doneMsg.existing ?? 0;
  source.failed = doneMsg.failed ?? 0;
  run.progress.totalImported += source.imported;
  run.progress.totalExisting += source.existing;
  run.progress.totalFailed += source.failed;

  source.state = doneMsg.cancelled ? 'cancelled' : 'done';
}

function waitForSourceDone(
  run: ActiveRun,
  sourceKey: string,
  timeoutMs: number
): Promise<SourceDone> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      run.resolvers.delete(sourceKey);
      resolve({ timeout: true });
    }, timeoutMs);
    run.resolvers.set(sourceKey, (msg) => {
      clearTimeout(timer);
      run.resolvers.delete(sourceKey);
      resolve(msg);
    });
  });
}

// ────────────────────────────────────────────────────────
// Mensajes entrantes (content scripts → orquestador)
// ────────────────────────────────────────────────────────

export function handleImportAllSourceDone(
  msg: ImportAllSourceDoneMessage | ImportAllMevSetDoneMessage
): void {
  if (!activeRun || activeRun.runId !== msg.runId) return;
  activeRun.resolvers.get(msg.sourceKey)?.(msg);
}

export async function handleImportAllProgress(msg: {
  runId: string;
  sourceKey: string;
  detail: string;
}): Promise<void> {
  if (!activeRun || activeRun.runId !== msg.runId) return;
  const source = activeRun.progress.sources.find((s) => s.key === msg.sourceKey);
  if (source && source.state === 'running') {
    source.detail = msg.detail;
    await saveProgress();
  }
}

export async function cancelImportAllRun(): Promise<void> {
  await chrome.storage.local.set({ [IMPORT_ALL_CANCEL_KEY]: true });
  if (activeRun) {
    activeRun.progress.cancelled = true;
    await saveProgress();
  }
}

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

/**
 * tabs.sendMessage con reintentos: tras una navegación, el content script se
 * inyecta en document_idle y puede no estar listo cuando llega el primer
 * mensaje ("Receiving end does not exist").
 */
async function sendTabMessageWithRetry<T>(
  tabId: number,
  message: Record<string, unknown>,
  attempts = 3,
  gapMs = 1500
): Promise<(T & { error?: string }) | { ok: false; error: string }> {
  let lastError = '';
  for (let i = 0; i < attempts; i++) {
    try {
      return (await chrome.tabs.sendMessage(tabId, message)) as T & {
        error?: string;
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await new Promise((resolve) => setTimeout(resolve, gapMs));
    }
  }
  return { ok: false, error: lastError };
}

async function findScwTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: 'https://scw.pjn.gov.ar/*' });
  return tabs[0]?.id ?? null;
}

async function findMevTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: 'https://mev.scba.gov.ar/*' });
  return tabs[0]?.id ?? null;
}

/**
 * Navega una pestaña y espera el `status: complete` + un settle corto (los
 * listados JSF renderizan después del load). Si la navegación no completa en
 * NAVIGATION_TIMEOUT_MS, sigue igual: el caller valida la URL resultante.
 */
async function navigateTabAndWait(tabId: number, url: string): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (
      updatedTabId: number,
      changeInfo: { status?: string }
    ) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') finish();
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(finish, NAVIGATION_TIMEOUT_MS);
    void chrome.tabs.update(tabId, { url }).catch(() => finish());
  });
  await new Promise((resolve) => setTimeout(resolve, SETTLE_DELAY_MS));
}
