import { useState, useEffect } from 'react';
import { Scale, Coffee } from 'lucide-react';
import { useDarkMode } from '@/modules/ui/use-dark-mode';
import { DONATE_URL } from '@/modules/tier/limits';

export default function App() {
  // Apply dark mode
  useDarkMode();

  return (
    <div className="w-72 bg-bg p-4 text-text">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Scale size={20} className="text-primary" strokeWidth={2.25} />
        <h1 className="text-lg font-bold text-primary">ProcuAsist</h1>
      </div>

      <div className="flex flex-col gap-3">
        <CredentialsStatus />

        <hr className="border-border" />

        <button
          onClick={async () => {
            // Open directly from the popup: sidePanel.open() requires a
            // user gesture, and messages from the popup have no sender.tab
            // for the background to resolve a window from.
            try {
              const win = await chrome.windows.getCurrent();
              if (win.id !== undefined) {
                await chrome.sidePanel.open({ windowId: win.id });
              }
            } catch {
              chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
            }
            window.close();
          }}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Abrir Panel Lateral
        </button>

        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="rounded-lg bg-bg-secondary px-4 py-2 text-sm text-text-secondary hover:bg-border"
        >
          Credenciales y configuración
        </button>

        <hr className="border-border" />

        <button
          onClick={() => chrome.tabs.create({ url: DONATE_URL })}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30 transition-colors"
        >
          <Coffee size={14} /> Invitame un cafecito
        </button>

        <p className="text-center text-[10px] leading-relaxed text-text-secondary/70">
          Hecho por un abogado, para colegas.
          <br />
          <a
            href="mailto:blancoilariasistente@gmail.com?subject=ProcuAsist%20-%20feedback"
            className="text-primary hover:underline"
          >
            Reportar error o sugerencia
          </a>
        </p>
      </div>
    </div>
  );
}

function CredentialsStatus() {
  const [mevStatus, setMevStatus] = useState<'checking' | 'active' | 'none'>(
    'checking'
  );
  const [pjnStatus, setPjnStatus] = useState<'checking' | 'active' | 'none'>(
    'checking'
  );

  useEffect(() => {
    // GET_CREDENTIALS descifra de verdad: un blob del esquema PIN viejo que
    // ya no abre se reporta como "sin credenciales" (no un verde engañoso).
    chrome.runtime
      .sendMessage({ type: 'GET_CREDENTIALS', portal: 'mev' })
      .then((r) => setMevStatus(r?.success ? 'active' : 'none'))
      .catch(() => setMevStatus('none'));

    chrome.runtime
      .sendMessage({ type: 'GET_CREDENTIALS', portal: 'pjn' })
      .then((r) => setPjnStatus(r?.success ? 'active' : 'none'))
      .catch(() => setPjnStatus('none'));
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <PortalRow label="MEV" status={mevStatus} />
      <PortalRow label="PJN" status={pjnStatus} />
    </div>
  );
}

function PortalRow({
  label,
  status,
}: {
  label: string;
  status: 'checking' | 'active' | 'none';
}) {
  const config = {
    checking: { color: 'bg-warning', text: 'Verificando...' },
    active: { color: 'bg-success', text: 'Credenciales guardadas' },
    none: { color: 'bg-secondary', text: 'Sin credenciales' },
  };
  const { color, text } = config[status];

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-xs text-text-secondary">{text}</span>
      </div>
    </div>
  );
}
