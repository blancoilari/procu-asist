import { useState, useEffect, useCallback, useRef } from 'react';
import type { Bookmark, Case, Monitor, MovementAlert } from '@/modules/portals/types';
import type { ProcuAsistSettings } from '@/modules/storage/settings-store';
import type { UserProfile } from '@/modules/supabase/auth';
import { useDarkMode } from '@/modules/ui/use-dark-mode';
import Onboarding, { isOnboardingDone } from '@/modules/ui/Onboarding';

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
        <h1 className="text-lg font-bold text-primary">🚀 ProcuAsist</h1>
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
            {tab === 'bookmarks' && '⭐ Marcadores'}
            {tab === 'monitors' && (
              <>
                👁 Monitoreo
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </>
            )}
            {tab === 'settings' && '⚙ Ajustes'}
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
// Connection Badge
// ──────────────────────────────────────────────────────────

function ConnectionBadge() {
  const [tier, setTier] = useState('Free');

  useEffect(() => {
    // Read tier from local storage (synced from Supabase on login)
    const fetchTier = () => {
      chrome.storage.local.get(['tl_tier', 'tl_user'], (result) => {
        const tier = result.tl_tier as string | undefined;
        if (tier) {
          setTier(tier.charAt(0).toUpperCase() + tier.slice(1));
          return;
        }
        // Fallback: read from user profile
        const user = result.tl_user as Record<string, unknown> | undefined;
        if (user?.tier) setTier((user.tier as string).charAt(0).toUpperCase() + (user.tier as string).slice(1));
      });
    };
    fetchTier();

    // Update tier when storage changes (e.g., after payment webhook)
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && (changes.tl_tier || changes.tl_user)) fetchTier();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return (
    <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">
      {tier}
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
        {alreadyBookmarked
          ? '✓ Ya está en marcadores'
          : added
            ? '✓ Agregado'
            : '⭐ Guardar en marcadores'}
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

  const portalBadge =
    bookmark.portal === 'mev' ? (
      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
        MEV
      </span>
    ) : (
      <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900 dark:text-purple-300">
        PJN
      </span>
    );

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
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900 dark:text-violet-300" title="Monitoreando">
              👁
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
          <div className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            📋 {bookmark.lastMovementDate}
            {bookmark.lastMovementDesc && ` — ${bookmark.lastMovementDesc}`}
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
              🔗 Abrir en portal
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
              📋 Copiar carátula
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
              {monitored ? '👁 Ya monitoreada' : '👁 Monitorear causa'}
            </button>
            <button
              onClick={() => {
                // Open the case in MEV so user can generate PDF from there
                onOpen(bookmark);
                setShowActions(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-bg-secondary"
            >
              📄 Abrir para descargar PDF
            </button>
            <hr className="border-border" />
            <button
              onClick={() => {
                onRemove(bookmark);
                setShowActions(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              🗑 Eliminar
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
      <div className="text-4xl">{hasSearch ? '🔍' : '⭐'}</div>
      <p className="text-sm font-medium">
        {hasSearch
          ? 'No se encontraron marcadores'
          : 'No hay marcadores guardados'}
      </p>
      <p className="text-xs leading-relaxed">
        {hasSearch
          ? 'Intentá con otro término de búsqueda.'
          : 'Navegá a una causa en MEV o PJN y hacé clic en "Guardar" para agregarla acá.'}
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
  const [view, setView] = useState<'monitors' | 'alerts'>('monitors');

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
                className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {scanning ? '⏳ Escaneando...' : '🔄 Escanear ahora'}
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
              <div className="text-4xl">🔔</div>
              <p className="text-sm font-medium">No hay alertas</p>
              <p className="text-xs">
                Las alertas aparecen cuando se detectan nuevos movimientos en
                tus causas monitoreadas.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {alerts.map((alert) => (
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

  const portalBadge =
    monitor.portal === 'mev' ? (
      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
        MEV
      </span>
    ) : (
      <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900 dark:text-purple-300">
        PJN
      </span>
    );

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
            <span>📋 Último mov: {monitor.lastKnownMovementDate}</span>
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
              🔗 Abrir en portal
            </button>
            <button
              onClick={() => {
                onToggle(monitor.id);
                setShowActions(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-bg-secondary"
            >
              {monitor.isActive ? '⏸ Pausar monitoreo' : '▶ Reanudar monitoreo'}
            </button>
            <hr className="border-border" />
            <button
              onClick={() => {
                onRemove(monitor.id);
                setShowActions(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              🗑 Quitar del monitoreo
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
          <span className="text-xs">📋 {alert.movementDate}</span>
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
      <div className="text-4xl">{hasSearch ? '🔍' : '👁'}</div>
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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: 'GET_SETTINGS' })
      .then((r) => {
        const resp = r as { success: boolean; settings: ProcuAsistSettings };
        if (resp?.success) setSettings(resp.settings);
      });

    // Fetch user profile
    chrome.runtime
      .sendMessage({ type: 'GET_USER' })
      .then((r) => {
        const resp = r as { success: boolean; user: UserProfile | null };
        if (resp?.success && resp.user) setUser(resp.user);
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

  const handleSignIn = async () => {
    setAuthLoading(true);
    try {
      const resp = (await chrome.runtime.sendMessage({
        type: 'SIGN_IN',
        provider: 'google',
      })) as { success: boolean; user?: UserProfile };
      if (resp?.success && resp.user) {
        setUser(resp.user);
      }
    } catch {
      // OAuth cancelled or failed
    }
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    await chrome.runtime.sendMessage({ type: 'SIGN_OUT' });
    setUser(null);
  };

  const handleSync = async (direction: 'push' | 'pull') => {
    setSyncStatus(direction === 'push' ? 'Subiendo...' : 'Descargando...');
    const resp = (await chrome.runtime.sendMessage({
      type: 'SYNC_DATA',
      direction,
    })) as { success: boolean; error?: string };
    setSyncStatus(
      resp.success
        ? 'Sincronizado'
        : `Error: ${resp.error ?? 'desconocido'}`
    );
    setTimeout(() => setSyncStatus(null), 3000);
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
      {/* Account Section */}
      <div className="mb-3 rounded-lg border border-border bg-bg-secondary p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Cuenta
        </h3>
        {user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                  {user.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{user.displayName}</p>
                <p className="truncate text-[10px] text-text-secondary">
                  {user.email}
                </p>
              </div>
              <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary uppercase">
                {user.tier}
              </span>
            </div>
            {/* Sync buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleSync('push')}
                className="flex-1 rounded bg-bg px-2 py-1.5 text-[11px] text-text-secondary hover:bg-border transition-colors"
              >
                Subir datos
              </button>
              <button
                onClick={() => handleSync('pull')}
                className="flex-1 rounded bg-bg px-2 py-1.5 text-[11px] text-text-secondary hover:bg-border transition-colors"
              >
                Descargar datos
              </button>
            </div>
            {syncStatus && (
              <p className="text-center text-[10px] text-primary animate-fade-in-up">
                {syncStatus}
              </p>
            )}
            <button
              onClick={handleSignOut}
              className="w-full rounded py-1.5 text-[11px] text-danger hover:bg-danger/10 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        ) : (
          <button
            onClick={handleSignIn}
            disabled={authLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg px-4 py-2.5 text-sm font-medium hover:bg-bg-secondary transition-colors disabled:opacity-50"
          >
            {authLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Iniciar sesión con Google
              </>
            )}
          </button>
        )}
      </div>

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
        label="Keep-Alive PJN"
        description="Mantiene la sesión activa en PJN"
        checked={settings.keepAlivePjn}
        onChange={(v) => handleToggle('keepAlivePjn', v)}
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

      {/* Version info */}
      <p className="mt-3 text-center text-[10px] text-text-secondary/50">
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
