import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Scale,
  Star,
  Eye,
  Settings as SettingsIcon,
  RefreshCw,
  Hourglass,
  Link as LinkIcon,
  Clipboard,
  FileText,
  Trash2,
  Pause,
  Play,
  Bell,
  Search,
  Coffee,
  Mail,
  Bug,
} from 'lucide-react';
import type { Bookmark, Case, Monitor, MovementAlert } from '@/modules/portals/types';
import type { ProcuAsistSettings } from '@/modules/storage/settings-store';
import { DONATE_URL } from '@/modules/tier/limits';
import { useDarkMode } from '@/modules/ui/use-dark-mode';
import Onboarding, { isOnboardingDone } from '@/modules/ui/Onboarding';
import { isDateOnOrAfter, parseDateOnly } from '@/modules/utils/date';

type Tab = 'bookmarks' | 'monitors' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('bookmarks');
  const [search, setSearch] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  // Apply dark mode
  useDarkMode();

  // Check onboarding status
  useEffect(() => {
    isOnboardingDone().then((done) => setShowOnboarding(!done));
  }, []);

  // Fetch unread alert count
  useEffect(() => {
    const fetchUnread = () => {
      chrome.runtime
        .sendMessage({ type: 'GET_ALERTS' })
        .then((r) => {
          const resp = r as { success: boolean; unreadCount: number };
          if (resp?.success) setUnreadCount(resp.unreadCount);
        });
    };
    fetchUnread();

    // Refresh when alerts storage changes
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === 'local' && changes.tl_alerts) fetchUnread();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Show loading while checking onboarding
  if (showOnboarding === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Show onboarding for first-time users
  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="flex items-center gap-2 text-lg font-bold text-primary">
          <Scale size={20} strokeWidth={2.25} />
          ProcuAsist
        </h1>
        <ConnectionBadge />
      </header>

      {/* Search */}
      <div className="px-4 py-2">
        <input
          type="text"
          placeholder="Buscar por número, carátula o juzgado..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      {/* Tab Navigation */}
      <nav className="flex border-b border-border">
        {(['bookmarks', 'monitors', 'settings'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative flex-1 py-2 text-center text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-primary text-primary'
                : 'text-text-secondary hover:text-text'
            }`}
          >
            {tab === 'bookmarks' && (
              <span className="inline-flex items-center gap-1.5">
                <Star size={14} /> Marcadores
              </span>
            )}
            {tab === 'monitors' && (
              <span className="inline-flex items-center gap-1.5">
                <Eye size={14} /> Monitoreo
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>
            )}
            {tab === 'settings' && (
              <span className="inline-flex items-center gap-1.5">
                <SettingsIcon size={14} /> Ajustes
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'bookmarks' && <BookmarksTab search={search} />}
        {activeTab === 'monitors' && <MonitorsTab search={search} />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Version Badge
// ──────────────────────────────────────────────────────────

function ConnectionBadge() {
  return (
    <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">
      v{chrome.runtime.getManifest().version}
    </span>
  );
}

// ──────────────────────────────────────────────────────────
// Portal Badge
// ──────────────────────────────────────────────────────────

type PortalId = import('@/modules/portals/types').PortalId;

const PORTAL_LABELS: Record<PortalId, string> = {
  mev: 'MEV',
  eje: 'JUSCABA',
  pjn: 'PJN',
};

const PORTAL_BADGE_CLASS: Record<PortalId, string> = {
  mev: 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-200',
  eje: 'bg-cyan-100 text-cyan-900 dark:bg-cyan-900 dark:text-cyan-200',
  pjn: 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-200',
};

function PortalBadge({ portal }: { portal: PortalId }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PORTAL_BADGE_CLASS[portal]}`}
    >
      {PORTAL_LABELS[portal]}
    </span>
  );
}

// ──────────────────────────────────────────────────────────
// Bookmarks Tab
// ──────────────────────────────────────────────────────────

function BookmarksTab({ search }: { search: string }) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastDetected, setLastDetected] = useState<Case | null>(null);
  const [enrichingScba, setEnrichingScba] = useState(false);
  const [enrichMessage, setEnrichMessage] = useState('');

  const loadBookmarks = useCallback(async () => {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'GET_BOOKMARKS',
        query: search || undefined,
      })) as { success: boolean; bookmarks: Bookmark[] };

      if (response?.success) {
        setBookmarks(response.bookmarks);
      }
    } catch (err) {
      console.error('[ProcuAsist] Failed to load bookmarks:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Load bookmarks on mount and when search changes
  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  // Listen for storage changes (bookmarks updated from content script)
  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === 'local' && changes.tl_bookmarks) {
        loadBookmarks();
      }
      if (area === 'session' && changes.lastDetectedCase) {
        setLastDetected(changes.lastDetectedCase.newValue as Case);
      }
    };
    chrome.storage.onChanged.addListener(listener);

    // Also check for last detected case on mount
    chrome.storage.session.get('lastDetectedCase', (result) => {
      if (result.lastDetectedCase) {
        setLastDetected(result.lastDetectedCase as Case);
      }
    });

    return () => chrome.storage.onChanged.removeListener(listener);
  }, [loadBookmarks]);

  const handleAddCurrent = async () => {
    if (!lastDetected) return;
    const response = (await chrome.runtime.sendMessage({
      type: 'ADD_BOOKMARK',
      caseData: lastDetected,
    })) as { success: boolean; isNew: boolean };

    if (response?.success) {
      loadBookmarks();
      if (response.isNew) {
        // Clear last detected so the banner goes away
        await chrome.storage.session.remove('lastDetectedCase');
        setLastDetected(null);
      }
    }
  };

  const handleRemove = async (bookmark: Bookmark) => {
    await chrome.runtime.sendMessage({
      type: 'REMOVE_BOOKMARK',
      portal: bookmark.portal,
      caseNumber: bookmark.caseNumber,
    });
    loadBookmarks();
  };

  const handleOpen = (bookmark: Bookmark) => {
    if (bookmark.portalUrl) {
      chrome.tabs.create({ url: bookmark.portalUrl });
    }
  };

  const scbaPending = bookmarks.filter(
    (b) =>
      b.metadata?.set === 'scba-mis-causas' &&
      (!b.metadata.nidCausa || !b.metadata.pidJuzgado)
  ).length;

  const handleEnrichScba = async () => {
    if (enrichingScba) return;
    setEnrichingScba(true);
    setEnrichMessage('Cruzando con causas MEV ya conocidas...');
    try {
      const resp = (await chrome.runtime.sendMessage({
        type: 'ENRICH_SCBA_MIS_CAUSAS',
      })) as {
        success?: boolean;
        totalPending?: number;
        candidates?: number;
        enriched?: number;
        monitored?: number;
        unmatched?: number;
        searched?: number;
        searchMatches?: number;
        searchErrors?: number;
        needsMevTab?: boolean;
        searchLimitReached?: boolean;
      };

      if (!resp?.success) {
        setEnrichMessage('No se pudo completar el cruce.');
        return;
      }

      const details = [
        `Cruce listo: ${resp.enriched ?? 0} enriquecidas`,
        `${resp.monitored ?? 0} monitoreadas`,
        `${resp.unmatched ?? 0} pendientes`,
      ];
      if (resp.searched) {
        details.push(`${resp.searchMatches ?? 0}/${resp.searched} encontradas en MEV`);
      }
      if (resp.searchErrors) details.push(`${resp.searchErrors} con error`);
      if (resp.needsMevTab) details.push('abrí MEV para buscar pendientes');
      if (resp.searchLimitReached) details.push('podés repetir para otra tanda');
      setEnrichMessage(`${details.join(', ')}.`);
      await loadBookmarks();
    } catch {
      setEnrichMessage('Error al cruzar causas con MEV.');
    } finally {
      setEnrichingScba(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Quick-add banner when on a case page */}
      {lastDetected && (
        <QuickAddBanner caseData={lastDetected} onAdd={handleAddCurrent} />
      )}

      {scbaPending > 0 && (
        <div className="border-b border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/40">
          <div className="mb-2 flex items-start gap-2 text-xs text-blue-900 dark:text-blue-100">
            <LinkIcon size={14} className="mt-0.5 shrink-0" />
            <span>
              Hay {scbaPending} causa{scbaPending !== 1 ? 's' : ''} importada
              {scbaPending !== 1 ? 's' : ''} desde Notificaciones sin datos internos MEV.
            </span>
          </div>
          <button
            onClick={handleEnrichScba}
            disabled={enrichingScba}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <RefreshCw size={14} className={enrichingScba ? 'animate-spin' : ''} />
            {enrichingScba ? 'Cruzando datos...' : 'Completar datos MEV'}
          </button>
          {enrichMessage && (
            <p className="mt-2 text-[11px] leading-snug text-blue-800 dark:text-blue-200">
              {enrichMessage}
            </p>
          )}
        </div>
      )}

      {/* Bookmarks list */}
      {bookmarks.length === 0 ? (
        <EmptyBookmarks hasSearch={!!search} />
      ) : (
        <ul className="divide-y divide-border">
          {bookmarks.map((b) => (
            <BookmarkCard
              key={`${b.portal}-${b.caseNumber}`}
              bookmark={b}
              onOpen={handleOpen}
              onRemove={handleRemove}
            />
          ))}
        </ul>
      )}

      {/* Count footer */}
      {bookmarks.length > 0 && (
        <div className="border-t border-border px-4 py-2 text-center text-xs text-text-secondary">
          {bookmarks.length} marcador{bookmarks.length !== 1 ? 'es' : ''}
          {search ? ' encontrados' : ''}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Quick-Add Banner (appears when a case is detected)
// ──────────────────────────────────────────────────────────

function QuickAddBanner({
  caseData,
  onAdd,
}: {
  caseData: Case;
  onAdd: () => void;
}) {
  const [added, setAdded] = useState(false);
  const [alreadyBookmarked, setAlreadyBookmarked] = useState(false);

  useEffect(() => {
    chrome.runtime
      .sendMessage({
        type: 'IS_BOOKMARKED',
        portal: caseData.portal,
        caseNumber: caseData.caseNumber,
      })
      .then((r) => {
        const resp = r as { success: boolean; isBookmarked: boolean };
        if (resp?.success && resp.isBookmarked) {
          setAlreadyBookmarked(true);
        }
      });
  }, [caseData]);

  const handleClick = () => {
    if (alreadyBookmarked) return;
    onAdd();
    setAdded(true);
  };

  return (
    <div className="border-b border-primary/20 bg-primary/5 px-4 py-3">
      <div className="mb-1 text-xs font-medium text-primary">
        Causa detectada en {caseData.portal.toUpperCase()}
      </div>
      <div className="mb-2 text-sm font-semibold leading-tight">
        {caseData.caseNumber}
      </div>
      <div className="mb-2 truncate text-xs text-text-secondary">
        {caseData.title}
      </div>
      <button
        onClick={handleClick}
        disabled={added || alreadyBookmarked}
        className={`w-full rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          added || alreadyBookmarked
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            : 'bg-primary text-white hover:bg-primary/90'
        }`}
      >
        <span className="inline-flex items-center justify-center gap-1.5">
          {alreadyBookmarked ? (
            <>
              <Star size={14} fill="currentColor" /> Ya está en marcadores
            </>
          ) : added ? (
            <>
              <Star size={14} fill="currentColor" /> Agregado
            </>
          ) : (
            <>
              <Star size={14} /> Guardar en marcadores
            </>
          )}
        </span>
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Bookmark Card
// ──────────────────────────────────────────────────────────

function BookmarkCard({
  bookmark,
  onOpen,
  onRemove,
}: {
  bookmark: Bookmark;
  onOpen: (b: Bookmark) => void;
  onRemove: (b: Bookmark) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [monitored, setMonitored] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Check if this bookmark is monitored
  useEffect(() => {
    chrome.runtime
      .sendMessage({
        type: 'IS_MONITORED',
        portal: bookmark.portal,
        caseNumber: bookmark.caseNumber,
      })
      .then((r) => {
        const resp = r as { success: boolean; isMonitored: boolean };
        if (resp?.success) setMonitored(resp.isMonitored);
      });
  }, [bookmark.portal, bookmark.caseNumber]);

  // Close actions dropdown on outside click
  useEffect(() => {
    if (!showActions) return;
    const handler = (e: MouseEvent) => {
      if (
        actionsRef.current &&
        !actionsRef.current.contains(e.target as Node)
      ) {
        setShowActions(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showActions]);

  const portalBadge = <PortalBadge portal={bookmark.portal} />;

  const timeAgo = getRelativeTime(bookmark.createdAt);

  return (
    <li className="group relative px-4 py-3 hover:bg-bg-secondary/50 transition-colors">
      {/* Main content - clickable to open */}
      <button
        onClick={() => onOpen(bookmark)}
        className="w-full text-left"
        title="Abrir en MEV"
      >
        {/* Top row: portal badge + case number */}
        <div className="mb-1 flex items-center gap-2">
          {portalBadge}
          <span className="text-sm font-semibold">{bookmark.caseNumber}</span>
          {monitored && (
            <span
              className="inline-flex items-center rounded bg-violet-100 px-1.5 py-0.5 text-violet-700 dark:bg-violet-900 dark:text-violet-300"
              title="Monitoreando"
            >
              <Eye size={11} />
            </span>
          )}
        </div>

        {/* Title (carátula) */}
        <p className="mb-1 text-xs leading-snug text-text-secondary line-clamp-2">
          {bookmark.title}
        </p>

        {/* Bottom row: court + time */}
        <div className="flex items-center justify-between text-[10px] text-text-secondary/70">
          <span className="truncate max-w-[65%]">{bookmark.court}</span>
          <span>{timeAgo}</span>
        </div>

        {/* Last movement if available */}
        {bookmark.lastMovementDate && (
          <div className="mt-1.5 flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <FileText size={11} />
            <span>
              {bookmark.lastMovementDate}
              {bookmark.lastMovementDesc && ` — ${bookmark.lastMovementDesc}`}
            </span>
          </div>
        )}
      </button>

      {/* Actions button (appears on hover) */}
      <div ref={actionsRef} className="absolute right-2 top-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowActions(!showActions);
          }}
          className="rounded p-1 text-text-secondary opacity-0 hover:bg-border group-hover:opacity-100 transition-opacity"
          title="Opciones"
        >
          <MoreIcon />
        </button>

        {/* Dropdown */}
        {showActions && (
          <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-border bg-bg shadow-lg">
            <button
              onClick={() => {
                onOpen(bookmark);
                setShowActions(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-bg-secondary"
            >
              <LinkIcon size={13} /> Abrir en portal
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${bookmark.caseNumber} — ${bookmark.title}`
                );
                setShowActions(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-bg-secondary"
            >
              <Clipboard size={13} /> Copiar carátula
            </button>
            <button
              onClick={async () => {
                if (monitored) {
                  // Already monitored — no action from here, go to monitors tab
                  setShowActions(false);
                  return;
                }
                await chrome.runtime.sendMessage({
                  type: 'ADD_MONITOR',
                  caseData: bookmark,
                });
                setMonitored(true);
                setShowActions(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-bg-secondary"
            >
              <Eye size={13} /> {monitored ? 'Ya monitoreada' : 'Monitorear causa'}
            </button>
            <button
              onClick={() => {
                // Open the case in MEV so user can generate PDF from there
                onOpen(bookmark);
                setShowActions(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-bg-secondary"
            >
              <FileText size={13} /> Abrir para descargar PDF
            </button>
            <hr className="border-border" />
            <button
              onClick={() => {
                onRemove(bookmark);
                setShowActions(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 size={13} /> Eliminar
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

// ──────────────────────────────────────────────────────────
// Empty State
// ──────────────────────────────────────────────────────────

function EmptyBookmarks({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center text-text-secondary">
      <div className="text-text-secondary/50">
        {hasSearch ? <Search size={40} /> : <Star size={40} />}
      </div>
      <p className="text-sm font-medium">
        {hasSearch
          ? 'No se encontraron marcadores'
          : 'No hay marcadores guardados'}
      </p>
      <p className="text-xs leading-relaxed">
        {hasSearch
          ? 'Intentá con otro término de búsqueda.'
          : 'Navegá a una causa en MEV o JUSCABA y hacé clic en "Guardar" para agregarla acá.'}
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Monitors Tab
// ──────────────────────────────────────────────────────────

function MonitorsTab({ search }: { search: string }) {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [alerts, setAlerts] = useState<MovementAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanningSince, setScanningSince] = useState(false);
  const [sinceScanMessage, setSinceScanMessage] = useState('');
  const [view, setView] = useState<'monitors' | 'alerts'>('monitors');
  const [alertsFromDate, setAlertsFromDate] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [monResp, alertResp] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_MONITORS' }) as Promise<{
          success: boolean;
          monitors: Monitor[];
        }>,
        chrome.runtime.sendMessage({ type: 'GET_ALERTS' }) as Promise<{
          success: boolean;
          alerts: MovementAlert[];
        }>,
      ]);

      if (monResp?.success) {
        let filtered = monResp.monitors;
        if (search) {
          const lower = search.toLowerCase();
          filtered = filtered.filter(
            (m) =>
              m.caseNumber.toLowerCase().includes(lower) ||
              m.title.toLowerCase().includes(lower) ||
              m.court.toLowerCase().includes(lower)
          );
        }
        setMonitors(filtered);
      }
      if (alertResp?.success) setAlerts(alertResp.alerts);
    } catch (err) {
      console.error('[ProcuAsist] Failed to load monitors:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for storage changes
  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (
        area === 'local' &&
        (changes.tl_monitors || changes.tl_alerts)
      ) {
        loadData();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [loadData]);

  const handleToggle = async (monitorId: string) => {
    await chrome.runtime.sendMessage({
      type: 'TOGGLE_MONITOR',
      monitorId,
    });
    loadData();
  };

  const handleRemove = async (monitorId: string) => {
    await chrome.runtime.sendMessage({
      type: 'REMOVE_MONITOR',
      monitorId,
    });
    loadData();
  };

  const handleScanNow = async () => {
    setScanning(true);
    await chrome.runtime.sendMessage({ type: 'RUN_SCAN_NOW' });
    // The scan runs async, give it a moment then refresh
    setTimeout(() => {
      loadData();
      setScanning(false);
    }, 5000);
  };

  const handleScanSince = async () => {
    if (!alertsFromDate || scanningSince) return;

    setScanningSince(true);
    setSinceScanMessage('Buscando movimientos en causas monitoreadas...');
    const startedAt = Date.now();

    const resp = (await chrome.runtime.sendMessage({
      type: 'RUN_SCAN_SINCE',
      fromDate: alertsFromDate,
    })) as { success?: boolean };

    if (!resp?.success) {
      setSinceScanMessage('No se pudo iniciar el barrido.');
      setScanningSince(false);
      return;
    }

    const timeoutMs = Math.min(120_000, Math.max(15_000, monitors.length * 3500 + 5000));
    const report = await waitForSinceScanReport(alertsFromDate, startedAt, timeoutMs);
    await loadData();
    setScanningSince(false);

    if (!report) {
      setSinceScanMessage('El barrido sigue en curso. Volvé a abrir Alertas en unos segundos.');
      return;
    }

    if (report.skippedReason === 'no_tab') {
      setSinceScanMessage('Abrí MEV con sesión activa y probá nuevamente.');
      return;
    }

    setSinceScanMessage(
      `Barrido listo: ${report.matchedMovements} movimiento(s). ` +
        `Leídos: ${report.parsedMovements ?? 0}. ` +
        `Sin datos internos: ${report.missingIds ?? 0}.`
    );
  };

  const handleMarkAllRead = async () => {
    await chrome.runtime.sendMessage({ type: 'MARK_ALL_ALERTS_READ' });
    loadData();
  };

  const handleOpenCase = (monitor: Monitor) => {
    if (monitor.portalUrl) {
      chrome.tabs.create({ url: monitor.portalUrl });
    }
  };

  const unreadAlerts = alerts.filter((a) => !a.isRead);
  const filteredAlerts = alertsFromDate
    ? alerts
        .filter((a) => isDateOnOrAfter(a.movementDate, alertsFromDate))
        .sort(compareAlertsByMovementDateDesc)
    : alerts;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Sub-navigation: Monitors vs Alerts */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setView('monitors')}
          className={`flex-1 py-2 text-center text-xs font-medium transition-colors ${
            view === 'monitors'
              ? 'border-b-2 border-primary text-primary'
              : 'text-text-secondary hover:text-text'
          }`}
        >
          Causas ({monitors.length})
        </button>
        <button
          onClick={() => setView('alerts')}
          className={`relative flex-1 py-2 text-center text-xs font-medium transition-colors ${
            view === 'alerts'
              ? 'border-b-2 border-primary text-primary'
              : 'text-text-secondary hover:text-text'
          }`}
        >
          Alertas
          {unreadAlerts.length > 0 && (
            <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadAlerts.length}
            </span>
          )}
        </button>
      </div>

      {view === 'monitors' ? (
        <>
          {/* Scan button */}
          {monitors.length > 0 && (
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <LastScanInfo />
              <button
                onClick={handleScanNow}
                disabled={scanning}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {scanning ? (
                  <>
                    <Hourglass size={12} /> Escaneando...
                  </>
                ) : (
                  <>
                    <RefreshCw size={12} /> Escanear ahora
                  </>
                )}
              </button>
            </div>
          )}

          {/* Monitors list */}
          {monitors.length === 0 ? (
            <EmptyMonitors hasSearch={!!search} />
          ) : (
            <ul className="divide-y divide-border">
              {monitors.map((m) => (
                <MonitorCard
                  key={m.id}
                  monitor={m}
                  alerts={alerts.filter((a) => a.monitorId === m.id)}
                  onToggle={handleToggle}
                  onRemove={handleRemove}
                  onOpen={handleOpenCase}
                />
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          {/* Alerts view */}
          <div className="space-y-2 border-b border-border px-4 py-2">
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="shrink-0 font-medium text-text">Desde</span>
              <input
                type="date"
                value={alertsFromDate}
                onChange={(e) => setAlertsFromDate(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-border bg-bg-secondary px-2 py-1 text-xs text-text outline-none focus:border-primary"
              />
              {alertsFromDate && (
                <button
                  type="button"
                  onClick={() => setAlertsFromDate('')}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Limpiar
                </button>
              )}
            </label>
            <button
              type="button"
              onClick={handleScanSince}
              disabled={!alertsFromDate || scanningSince}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {scanningSince ? (
                <>
                  <Hourglass size={12} /> Buscando movimientos...
                </>
              ) : (
                <>
                  <RefreshCw size={12} /> Buscar movimientos desde esa fecha
                </>
              )}
            </button>
            <p className="text-[10px] leading-snug text-text-secondary">
              Filtra alertas existentes o actualiza el listado recorriendo tus
              causas MEV monitoreadas.
            </p>
            {sinceScanMessage && (
              <p className="rounded-md bg-bg-secondary px-2 py-1 text-[10px] leading-snug text-text-secondary">
                {sinceScanMessage}
              </p>
            )}
          </div>

          {unreadAlerts.length > 0 && (
            <div className="flex justify-end border-b border-border px-4 py-2">
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline"
              >
                Marcar todas como leídas
              </button>
            </div>
          )}

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center text-text-secondary">
              <div className="text-text-secondary/50">
                <Bell size={40} />
              </div>
              <p className="text-sm font-medium">No hay alertas</p>
              <p className="text-xs">
                Las alertas aparecen cuando se detectan nuevos movimientos en
                tus causas monitoreadas.
              </p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center text-text-secondary">
              <div className="text-text-secondary/50">
                <Search size={40} />
              </div>
              <p className="text-sm font-medium">Sin movimientos desde esa fecha</p>
              <p className="text-xs">
                Probá con una fecha anterior o ejecutá un escaneo para actualizar
                las causas monitoreadas.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filteredAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  monitors={monitors}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Monitor Card
// ──────────────────────────────────────────────────────────

function MonitorCard({
  monitor,
  alerts,
  onToggle,
  onRemove,
  onOpen,
}: {
  monitor: Monitor;
  alerts: MovementAlert[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onOpen: (m: Monitor) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const unread = alerts.filter((a) => !a.isRead).length;

  useEffect(() => {
    if (!showActions) return;
    const handler = (e: MouseEvent) => {
      if (
        actionsRef.current &&
        !actionsRef.current.contains(e.target as Node)
      ) {
        setShowActions(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showActions]);

  const portalBadge = <PortalBadge portal={monitor.portal} />;

  return (
    <li className="group relative px-4 py-3 hover:bg-bg-secondary/50 transition-colors">
      <button
        onClick={() => onOpen(monitor)}
        className="w-full text-left"
      >
        {/* Top row */}
        <div className="mb-1 flex items-center gap-2">
          {portalBadge}
          <span className="text-sm font-semibold">{monitor.caseNumber}</span>
          {!monitor.isActive && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              Pausado
            </span>
          )}
          {unread > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </div>

        {/* Title */}
        <p className="mb-1 text-xs leading-snug text-text-secondary line-clamp-2">
          {monitor.title}
        </p>

        {/* Bottom row: court + last scan */}
        <div className="flex items-center justify-between text-[10px] text-text-secondary/70">
          <span className="truncate max-w-[60%]">{monitor.court}</span>
          <span>
            {monitor.lastScanAt
              ? `Esc. ${getRelativeTime(monitor.lastScanAt)}`
              : 'Sin escanear'}
          </span>
        </div>

        {/* Last known movement */}
        {monitor.lastKnownMovementDate && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-text-secondary">
            <FileText size={11} />
            <span>Último mov: {monitor.lastKnownMovementDate}</span>
            <span>({monitor.lastKnownMovementCount} totales)</span>
          </div>
        )}
      </button>

      {/* Actions */}
      <div ref={actionsRef} className="absolute right-2 top-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowActions(!showActions);
          }}
          className="rounded p-1 text-text-secondary opacity-0 hover:bg-border group-hover:opacity-100 transition-opacity"
        >
          <MoreIcon />
        </button>

        {showActions && (
          <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-border bg-bg shadow-lg">
            <button
              onClick={() => {
                onOpen(monitor);
                setShowActions(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-bg-secondary"
            >
              <LinkIcon size={13} /> Abrir en portal
            </button>
            <button
              onClick={() => {
                onToggle(monitor.id);
                setShowActions(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-bg-secondary"
            >
              {monitor.isActive ? (
                <>
                  <Pause size={13} /> Pausar monitoreo
                </>
              ) : (
                <>
                  <Play size={13} /> Reanudar monitoreo
                </>
              )}
            </button>
            <hr className="border-border" />
            <button
              onClick={() => {
                onRemove(monitor.id);
                setShowActions(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 size={13} /> Quitar del monitoreo
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

// ──────────────────────────────────────────────────────────
// Alert Card
// ──────────────────────────────────────────────────────────

function AlertCard({
  alert,
  monitors,
}: {
  alert: MovementAlert;
  monitors: Monitor[];
}) {
  const monitor = monitors.find((m) => m.id === alert.monitorId);

  const handleMarkRead = async () => {
    await chrome.runtime.sendMessage({
      type: 'MARK_ALERT_READ',
      alertId: alert.id,
    });
  };

  const handleOpenCase = () => {
    if (monitor?.portalUrl) {
      chrome.tabs.create({ url: monitor.portalUrl });
    }
  };

  return (
    <li
      className={`px-4 py-3 transition-colors ${
        alert.isRead ? 'opacity-60' : 'bg-amber-50/50 dark:bg-amber-900/10'
      }`}
    >
      <button onClick={handleOpenCase} className="w-full text-left">
        {/* Header: case number + time */}
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold">
            {monitor?.caseNumber ?? 'Causa eliminada'}
          </span>
          <span className="text-[10px] text-text-secondary">
            {getRelativeTime(alert.createdAt)}
          </span>
        </div>

        {/* Movement info */}
        <div className="mb-1 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs">
            <FileText size={12} /> {alert.movementDate}
          </span>
          {alert.movementType && (
            <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {alert.movementType}
            </span>
          )}
        </div>
        <p className="text-xs leading-snug text-text-secondary line-clamp-2">
          {alert.movementDescription}
        </p>
      </button>

      {!alert.isRead && (
        <button
          onClick={handleMarkRead}
          className="mt-1.5 text-[10px] text-primary hover:underline"
        >
          Marcar como leída
        </button>
      )}
    </li>
  );
}

// ──────────────────────────────────────────────────────────
// Last Scan Info
// ──────────────────────────────────────────────────────────

function LastScanInfo() {
  const [lastScan, setLastScan] = useState<{
    scanned: number;
    newMovements: number;
    timestamp: string;
  } | null>(null);

  useEffect(() => {
    chrome.storage.session.get('lastScanResult', (result) => {
      if (result.lastScanResult) {
        setLastScan(
          result.lastScanResult as {
            scanned: number;
            newMovements: number;
            timestamp: string;
          }
        );
      }
    });
  }, []);

  if (!lastScan) {
    return <span className="text-[10px] text-text-secondary">Sin escaneos previos</span>;
  }

  return (
    <span className="text-[10px] text-text-secondary">
      Último: {getRelativeTime(lastScan.timestamp)} ({lastScan.scanned} causas)
    </span>
  );
}

// ──────────────────────────────────────────────────────────
// Empty Monitors State
// ──────────────────────────────────────────────────────────

function EmptyMonitors({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center text-text-secondary">
      <div className="text-text-secondary/50">
        {hasSearch ? <Search size={40} /> : <Eye size={40} />}
      </div>
      <p className="text-sm font-medium">
        {hasSearch
          ? 'No se encontraron causas monitoreadas'
          : 'No hay causas en monitoreo'}
      </p>
      <p className="text-xs leading-relaxed">
        {hasSearch
          ? 'Intentá con otro término de búsqueda.'
          : 'Navegá a una causa en MEV, guardala como marcador, y activá el monitoreo para recibir alertas de nuevos movimientos.'}
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Settings Tab
// ──────────────────────────────────────────────────────────

function SettingsTab() {
  const [settings, setSettings] = useState<ProcuAsistSettings | null>(null);

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: 'GET_SETTINGS' })
      .then((r) => {
        const resp = r as { success: boolean; settings: ProcuAsistSettings };
        if (resp?.success) setSettings(resp.settings);
      });
  }, []);

  const handleToggle = async (
    key: keyof ProcuAsistSettings,
    value: boolean
  ) => {
    const response = (await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: { [key]: value },
    })) as { success: boolean; settings: ProcuAsistSettings };

    if (response?.success) {
      setSettings(response.settings);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-4">
      {/* Appearance */}
      <SettingToggle
        label="Modo oscuro"
        description="Interfaz con colores oscuros"
        checked={settings.darkMode}
        onChange={(v) => handleToggle('darkMode', v)}
      />

      <hr className="my-2 border-border" />

      {/* Portal settings */}
      <h3 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Portales
      </h3>
      <SettingToggle
        label="Keep-Alive MEV"
        description="Mantiene la sesión activa en MEV"
        checked={settings.keepAliveMev}
        onChange={(v) => handleToggle('keepAliveMev', v)}
      />
      <SettingToggle
        label="Keep-Alive JUSCABA"
        description="Mantiene la sesión activa en JUSCABA"
        checked={settings.keepAliveEje}
        onChange={(v) => handleToggle('keepAliveEje', v)}
      />
      <SettingToggle
        label="Auto-reconexión"
        description="Re-logueo automático cuando expira la sesión"
        checked={settings.autoReconnect}
        onChange={(v) => handleToggle('autoReconnect', v)}
      />

      <hr className="my-2 border-border" />

      <button
        onClick={() => chrome.runtime.openOptionsPage()}
        className="rounded-lg bg-bg-secondary px-4 py-2.5 text-sm text-text-secondary hover:bg-border transition-colors"
      >
        Configuración avanzada
      </button>

      {/* Authoring + community block */}
      <div className="mt-3 rounded-lg bg-bg-secondary/50 px-3 py-3">
        <p className="text-[11px] leading-relaxed text-text-secondary">
          Hecha por un abogado de la matrícula, para colegas. Es gratuita y sin
          fines de lucro. Si te resulta útil podés invitarme un cafecito. Si
          encontrás errores o tenés ideas, escribime — esta herramienta crece
          con el feedback de quienes la usan.
        </p>
      </div>

      {/* Donate */}
      <button
        onClick={() => chrome.tabs.create({ url: DONATE_URL })}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30 transition-colors"
      >
        <Coffee size={16} /> Invitame un cafecito
      </button>

      {/* Feedback channels */}
      <button
        onClick={() =>
          chrome.tabs.create({
            url: 'mailto:blancoilariasistente@gmail.com?subject=ProcuAsist%20-%20feedback',
          })
        }
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-bg-secondary px-4 py-2.5 text-sm text-text-secondary hover:bg-border transition-colors"
      >
        <Mail size={16} /> Reportar error o sugerencia
      </button>
      <button
        onClick={() =>
          chrome.tabs.create({
            url: 'https://github.com/blancoilari/procu-asist/issues',
          })
        }
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-bg-secondary px-4 py-2.5 text-sm text-text-secondary hover:bg-border transition-colors"
      >
        <Bug size={16} /> Issues en GitHub
      </button>

      {/* Disclaimer */}
      <p className="mt-3 text-center text-[9px] text-text-secondary/50 leading-relaxed">
        ProcuAsist se ofrece &quot;tal cual&quot;, sin garantías. No reemplaza el control
        manual de actuaciones judiciales. El autor no es responsable por daños
        derivados de su uso.
      </p>

      {/* Version info */}
      <p className="mt-1 text-center text-[10px] text-text-secondary/50">
        ProcuAsist v{chrome.runtime.getManifest().version}
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Reusable Components
// ──────────────────────────────────────────────────────────

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-lg px-1 py-2.5 hover:bg-bg-secondary/50 transition-colors cursor-pointer">
      <div>
        <span className="text-sm">{label}</span>
        {description && (
          <p className="text-[10px] text-text-secondary">{description}</p>
        )}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-border'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
    </label>
  );
}

function MoreIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <circle cx="8" cy="3" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="13" r="1.5" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function getRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;

  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `hace ${weeks}sem`;
  }

  // Fallback: short date
  return new Date(isoDate).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function compareAlertsByMovementDateDesc(
  a: MovementAlert,
  b: MovementAlert
): number {
  const dateA = parseDateOnly(a.movementDate) ?? 0;
  const dateB = parseDateOnly(b.movementDate) ?? 0;
  if (dateA !== dateB) return dateB - dateA;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

interface SinceScanReport {
  fromDate: string;
  timestamp: string;
  scanned: number;
  matchedMovements: number;
  parsedMovements?: number;
  missingIds?: number;
  errors: number;
  skippedReason?: string;
}

async function waitForSinceScanReport(
  fromDate: string,
  startedAt: number,
  timeoutMs: number
): Promise<SinceScanReport | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const stored = await chrome.storage.session.get('lastSinceScanReport');
    const report = stored.lastSinceScanReport as SinceScanReport | undefined;
    const reportTime = report ? new Date(report.timestamp).getTime() : 0;

    if (report?.fromDate === fromDate && reportTime >= startedAt) {
      return report;
    }

    await delay(1000);
  }

  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
