import type { Case, PortalId, Bookmark, Monitor, MovementAlert } from '@/modules/portals/types';

/** All message types used in chrome.runtime.sendMessage */
export type ProcuAsistMessage =
  | SessionExpiredMessage
  | LoginSuccessMessage
  | CasePageDetectedMessage
  | OpenSidePanelMessage
  | GenerateZipMessage
  | DownloadAttachmentMessage
  | GetCredentialsMessage
  | BulkImportMessage
  | SetupPinMessage
  | UnlockPinMessage
  | ResetPinMessage
  | LockMessage
  | GetLockStatusMessage
  | SaveCredentialsMessage
  | SearchResultsMessage
  | AddBookmarkMessage
  | RemoveBookmarkMessage
  | GetBookmarksMessage
  | IsBookmarkedMessage
  | UpdateSettingsMessage
  | GetSettingsMessage
  | AddMonitorMessage
  | RemoveMonitorMessage
  | GetMonitorsMessage
  | ToggleMonitorMessage
  | IsMonitoredMessage
  | GetAlertsMessage
  | MarkAlertReadMessage
  | MarkAllAlertsReadMessage
  | MarkMonitorAlertsReadMessage
  | EnrichScbaMisCausasMessage
  | RunScanNowMessage
  | RunScanSinceMessage
  | PjnGetEventsDebugMessage
  | PjnDownloadPdfMessage
  | PjnGenerateZipMessage
  | PjnCancelZipMessage
  | OpenPjnCaseMessage
  | ConsumePjnOpenTargetMessage
  | ImportAllDetectMessage
  | ImportAllRunMessage
  | ImportAllCancelMessage
  | ImportAllSourceDoneMessage
  | ImportAllProgressMessage
  | ImportAllMevSetDoneMessage;

export interface SetupPinMessage {
  type: 'SETUP_PIN';
  pin: string;
}

export interface UnlockPinMessage {
  type: 'UNLOCK_PIN';
  pin: string;
}

/**
 * Restablecer el PIN olvidado: borra el material del vault Y las credenciales
 * guardadas de todos los portales (sin el PIN viejo son indescifrables).
 * No toca marcadores, monitores, alertas ni plazos.
 */
export interface ResetPinMessage {
  type: 'RESET_PIN';
}

export interface LockMessage {
  type: 'LOCK';
}

export interface GetLockStatusMessage {
  type: 'GET_LOCK_STATUS';
}

export interface SaveCredentialsMessage {
  type: 'SAVE_CREDENTIALS';
  portal: PortalId;
  username: string;
  password: string;
}

export interface SessionExpiredMessage {
  type: 'SESSION_EXPIRED';
  portal: PortalId;
  returnUrl: string;
}

export interface LoginSuccessMessage {
  type: 'LOGIN_SUCCESS';
  portal: PortalId;
}

export interface CasePageDetectedMessage {
  type: 'CASE_PAGE_DETECTED';
  caseData: Case;
}

export interface OpenSidePanelMessage {
  type: 'OPEN_SIDEPANEL';
}

export interface GenerateZipMessage {
  type: 'GENERATE_ZIP';
  /** 'zip' (un PDF por paso) o 'pdf' (todo unido en un solo PDF). */
  format?: 'zip' | 'pdf';
  caseData: {
    caseNumber: string;
    title: string;
    court: string;
    portal: string;
    portalUrl: string;
    fechaInicio?: string;
    estadoPortal?: string;
    numeroReceptoria?: string;
    movements: Array<{
      date: string;
      fojas?: string;
      description: string;
      type?: string;
      hasDocuments: boolean;
      documentUrls: string[];
    }>;
  };
}

export interface DownloadAttachmentMessage {
  type: 'DOWNLOAD_ATTACHMENT';
  url: string;
  name: string;
}

export interface GetCredentialsMessage {
  type: 'GET_CREDENTIALS';
  portal: PortalId;
}

export interface BulkImportMessage {
  type: 'BULK_IMPORT';
  cases: Array<Partial<Case> & { caseNumber: string; title: string }>;
  source: string;
  monitor?: boolean;
}

export interface SearchResultsMessage {
  type: 'SEARCH_RESULTS';
  results: Array<{
    nidCausa: string;
    pidJuzgado: string;
    caratula: string;
    numero: string;
    url: string;
  }>;
}

// --- Bookmark Messages ---

export interface AddBookmarkMessage {
  type: 'ADD_BOOKMARK';
  caseData: Case;
}

export interface RemoveBookmarkMessage {
  type: 'REMOVE_BOOKMARK';
  portal: PortalId;
  caseNumber: string;
}

export interface GetBookmarksMessage {
  type: 'GET_BOOKMARKS';
  query?: string;
}

export interface IsBookmarkedMessage {
  type: 'IS_BOOKMARKED';
  portal: PortalId;
  caseNumber: string;
}

// --- Settings Messages ---

export interface UpdateSettingsMessage {
  type: 'UPDATE_SETTINGS';
  settings: Record<string, unknown>;
}

export interface GetSettingsMessage {
  type: 'GET_SETTINGS';
}

// --- Monitor Messages ---

export interface AddMonitorMessage {
  type: 'ADD_MONITOR';
  caseData: Case;
}

export interface RemoveMonitorMessage {
  type: 'REMOVE_MONITOR';
  monitorId: string;
}

export interface GetMonitorsMessage {
  type: 'GET_MONITORS';
  /** If true, return only active monitors */
  activeOnly?: boolean;
}

export interface ToggleMonitorMessage {
  type: 'TOGGLE_MONITOR';
  monitorId: string;
}

export interface IsMonitoredMessage {
  type: 'IS_MONITORED';
  portal: PortalId;
  caseNumber: string;
}

export interface GetAlertsMessage {
  type: 'GET_ALERTS';
  /** If provided, only return alerts for this monitor */
  monitorId?: string;
}

export interface MarkAlertReadMessage {
  type: 'MARK_ALERT_READ';
  alertId: string;
}

export interface MarkAllAlertsReadMessage {
  type: 'MARK_ALL_ALERTS_READ';
}

export interface MarkMonitorAlertsReadMessage {
  type: 'MARK_MONITOR_ALERTS_READ';
  monitorId: string;
}

export interface EnrichScbaMisCausasMessage {
  type: 'ENRICH_SCBA_MIS_CAUSAS';
}

export interface RunScanNowMessage {
  type: 'RUN_SCAN_NOW';
}

export interface RunScanSinceMessage {
  type: 'RUN_SCAN_SINCE';
  fromDate: string;
}

export interface PjnGetEventsDebugMessage {
  type: 'PJN_GET_EVENTS_DEBUG';
  page?: number;
  pageSize?: number;
  fechaHasta?: number;
}

export interface PjnDownloadPdfMessage {
  type: 'PJN_DOWNLOAD_PDF';
  href: string;
  suggestedName?: string;
  /** If true, the background will trigger chrome.downloads with the blob. */
  saveToDisk?: boolean;
}

export interface PjnGenerateZipMessage {
  type: 'PJN_GENERATE_ZIP';
  /** 'zip' (un PDF por actuación) o 'pdf' (todo unido en un solo PDF). */
  format?: 'zip' | 'pdf';
  /** Actuaciones seleccionadas (selección efectiva del modal). */
  actuaciones: Array<{
    fecha: string;
    tipo: string;
    descripcion: string;
    oficina: string;
    foja: string;
    hasDocument: boolean;
    documentos: Array<{ kind: 'download' | 'view'; href: string }>;
  }>;
  /** Datos generales del expediente (null si venimos de actuacionesHistoricas.seam). */
  datosGenerales: {
    cid: string;
    expediente: string;
    jurisdiccion: string;
    dependencia: string;
    situacionActual: string;
    caratula: string;
    isFavorito: boolean;
  } | null;
  /** URL de la pestaña scw desde la que se disparó la descarga. */
  portalUrl: string;
}

/** Cancel an in-progress PJN ZIP/PDF generation (cooperative). */
export interface PjnCancelZipMessage {
  type: 'PJN_CANCEL_ZIP';
}

/** Open a PJN case from the side panel. Because SCW deep links (cid) expire,
 * the background stores the target expediente and opens the listing; the PJN
 * content script then finds the row and clicks its fresh detail link. */
export interface OpenPjnCaseMessage {
  type: 'OPEN_PJN_CASE';
  caseNumber: string;
  /** Which SCW list to search in. Defaults to 'relacionados'. */
  list?: 'relacionados' | 'favoritos';
}

/** Content-script request to read & clear the pending PJN open target. */
export interface ConsumePjnOpenTargetMessage {
  type: 'CONSUME_PJN_OPEN_TARGET';
}

// --- Asistente "Importar todo" ---

/** Progreso de la corrida activa (chrome.storage.session, lee el panel). */
export const IMPORT_ALL_PROGRESS_STORAGE_KEY = 'tl_import_all_progress';
/** Flag de cancelación (chrome.storage.local: lo leen los content scripts
 *  entre páginas/organismos para cortar limpio). */
export const IMPORT_ALL_CANCEL_STORAGE_KEY = 'tl_import_all_cancel';

/** Qué fuentes eligió el usuario en el paso de selección del asistente. */
export interface ImportAllSelection {
  pjnRelacionados: boolean;
  pjnFavoritos: boolean;
  /** Sets de búsqueda MEV a recorrer completos (multi-departamento). */
  mevSets: Array<{ id: string; nombre: string }>;
}

/** Estimación de una fuente PJN detectada por el asistente. */
export interface ImportAllPjnSource {
  list: 'relacionados' | 'favoritos';
  /** Filas visibles + paginador (aproximado); null si no se pudo estimar. */
  estimatedCases: number | null;
  pages: number | null;
  error?: string;
}

/** Resultado de la fase de conteo/detección del asistente. */
export interface ImportAllDetectResult {
  pjn: {
    hasTab: boolean;
    hasSession: boolean;
    sources: ImportAllPjnSource[];
  };
  mev: {
    hasTab: boolean;
    hasSession: boolean;
    sets: Array<{ id: string; nombre: string }>;
    error?: string;
  };
}

/** Estado de una fuente durante la ejecución (persistido en storage.session). */
export interface ImportAllSourceProgress {
  key: string;
  label: string;
  state: 'pending' | 'running' | 'done' | 'error' | 'cancelled';
  imported: number;
  existing: number;
  failed: number;
  detail?: string;
}

/** Progreso completo de una corrida del asistente (storage.session). */
export interface ImportAllRunProgress {
  runId: string;
  running: boolean;
  cancelled: boolean;
  startedAt: string;
  finishedAt?: string;
  sources: ImportAllSourceProgress[];
  totalImported: number;
  totalExisting: number;
  totalFailed: number;
  /** Cuántos monitores nuevos quedaron pausados por superar el umbral. */
  monitorsPaused: number;
  pauseThreshold: number;
}

export interface ImportAllDetectMessage {
  type: 'IMPORT_ALL_DETECT';
}

export interface ImportAllRunMessage {
  type: 'IMPORT_ALL_RUN';
  selection: ImportAllSelection;
}

export interface ImportAllCancelMessage {
  type: 'IMPORT_ALL_CANCEL';
}

/** Content script PJN → background: recolección de un listado terminada. */
export interface ImportAllSourceDoneMessage {
  type: 'IMPORT_ALL_SOURCE_DONE';
  runId: string;
  sourceKey: string;
  ok: boolean;
  /** Casos ya mapeados al formato de BULK_IMPORT (con metadata.source). */
  cases?: Array<Partial<Case> & { caseNumber: string; title: string }>;
  pagesVisited?: number;
  truncated?: boolean;
  cancelled?: boolean;
  error?: string;
}

/** Content script → background: progreso de una fuente en curso. */
export interface ImportAllProgressMessage {
  type: 'IMPORT_ALL_PROGRESS';
  runId: string;
  sourceKey: string;
  detail: string;
}

/** Content script MEV → background: recorrido de un set terminado. */
export interface ImportAllMevSetDoneMessage {
  type: 'IMPORT_ALL_MEV_SET_DONE';
  runId: string;
  sourceKey: string;
  ok: boolean;
  imported?: number;
  existing?: number;
  monitored?: number;
  failed?: number;
  newMonitorIds?: string[];
  cancelled?: boolean;
  error?: string;
}

/** Response types for type safety */
export interface BookmarkListResponse {
  success: true;
  bookmarks: Bookmark[];
}

export interface BookmarkSingleResponse {
  success: true;
  bookmark: Bookmark;
  isNew: boolean;
}

export interface MonitorListResponse {
  success: true;
  monitors: Monitor[];
}

export interface AlertListResponse {
  success: true;
  alerts: MovementAlert[];
  unreadCount: number;
}
