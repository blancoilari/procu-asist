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
  | ParseCaseHtmlMessage
  | SetupPinMessage
  | UnlockPinMessage
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
  | RunScanNowMessage;

export interface SetupPinMessage {
  type: 'SETUP_PIN';
  pin: string;
}

export interface UnlockPinMessage {
  type: 'UNLOCK_PIN';
  pin: string;
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
  cases: Array<{ caseNumber: string; title: string }>;
  source: string;
}

export interface ParseCaseHtmlMessage {
  type: 'PARSE_CASE_HTML';
  html: string;
  portal: PortalId;
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

export interface RunScanNowMessage {
  type: 'RUN_SCAN_NOW';
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
