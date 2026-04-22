import { useState, useEffect } from 'react';
import { Scale, Coffee } from 'lucide-react';
import { useDarkMode } from '@/modules/ui/use-dark-mode';
import { DONATE_URL } from '@/modules/tier/limits';

type LockStatus = {
  pinConfigured: boolean;
  unlocked: boolean;
};

export default function App() {
  // Apply dark mode
  useDarkMode();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [status, setStatus] = useState<LockStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Check lock status on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_LOCK_STATUS' }, (response) => {
      if (response?.error) {
        setError(response.error);
      } else {
        setStatus(response);
      }
      setLoading(false);
    });
  }, []);

  const handleSetupPin = async () => {
    setError('');
    if (pin.length < 4) {
      setError('El PIN debe tener al menos 4 dígitos');
      return;
    }
    if (pin !== confirmPin) {
      setError('Los PINs no coinciden');
      return;
    }
    setLoading(true);
    chrome.runtime.sendMessage(
      { type: 'SETUP_PIN', pin },
      (response) => {
        if (response?.success) {
          setStatus({ pinConfigured: true, unlocked: true });
          setPin('');
          setConfirmPin('');
        } else {
          setError(response?.error ?? 'Error al configurar PIN');
        }
        setLoading(false);
      }
    );
  };

  const handleUnlock = async () => {
    setError('');
    if (pin.length < 4) {
      setError('El PIN debe tener al menos 4 dígitos');
      return;
    }
    setLoading(true);
    chrome.runtime.sendMessage(
      { type: 'UNLOCK_PIN', pin },
      (response) => {
        if (response?.success) {
          setStatus({ pinConfigured: true, unlocked: true });
          setPin('');
        } else {
          setError('PIN incorrecto');
        }
        setLoading(false);
      }
    );
  };

  const handleLock = () => {
    chrome.runtime.sendMessage({ type: 'LOCK' }, () => {
      setStatus({ pinConfigured: true, unlocked: false });
    });
  };

  if (loading) {
    return (
      <div className="flex w-72 items-center justify-center bg-bg p-6 text-text">
        <span className="text-sm text-text-secondary">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="w-72 bg-bg p-4 text-text">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Scale size={20} className="text-primary" strokeWidth={2.25} />
        <h1 className="text-lg font-bold text-primary">ProcuAsist</h1>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {/* PIN Not Configured */}
      {status && !status.pinConfigured && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            Configurá un PIN maestro para proteger tus credenciales:
          </p>
          <PinInput
            value={pin}
            onChange={setPin}
            placeholder="PIN (4-8 dígitos)"
            onSubmit={handleSetupPin}
          />
          <PinInput
            value={confirmPin}
            onChange={setConfirmPin}
            placeholder="Confirmar PIN"
            onSubmit={handleSetupPin}
          />
          <button
            onClick={handleSetupPin}
            disabled={pin.length < 4 || confirmPin.length < 4}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            Configurar PIN
          </button>
        </div>
      )}

      {/* Locked */}
      {status && status.pinConfigured && !status.unlocked && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            Ingresá tu PIN para desbloquear:
          </p>
          <PinInput
            value={pin}
            onChange={setPin}
            placeholder="PIN"
            onSubmit={handleUnlock}
          />
          <button
            onClick={handleUnlock}
            disabled={pin.length < 4}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            Desbloquear
          </button>
        </div>
      )}

      {/* Unlocked */}
      {status && status.unlocked && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-sm font-medium text-success">
              Desbloqueado
            </span>
          </div>

          <SessionStatus />

          <hr className="border-border" />

          <button
            onClick={() => {
              chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
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
            Configuración
          </button>

          <button
            onClick={handleLock}
            className="text-sm text-text-secondary hover:text-danger"
          >
            Bloquear
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
      )}
    </div>
  );
}

function PinInput({
  value,
  onChange,
  placeholder,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onSubmit: () => void;
}) {
  return (
    <input
      type="password"
      maxLength={8}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
      className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-primary"
    />
  );
}

function SessionStatus() {
  const [mevStatus, setMevStatus] = useState<'checking' | 'active' | 'none'>(
    'checking'
  );
  const [ejeStatus, setEjeStatus] = useState<'checking' | 'active' | 'none'>(
    'checking'
  );

  useEffect(() => {
    // Check if there are credentials saved for each portal
    chrome.runtime
      .sendMessage({ type: 'GET_CREDENTIALS', portal: 'mev' })
      .then((r) => setMevStatus(r?.success ? 'active' : 'none'))
      .catch(() => setMevStatus('none'));

    chrome.runtime
      .sendMessage({ type: 'GET_CREDENTIALS', portal: 'eje' })
      .then((r) => setEjeStatus(r?.success ? 'active' : 'none'))
      .catch(() => setEjeStatus('none'));
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <PortalRow label="MEV" status={mevStatus} />
      <PortalRow label="JUSCABA" status={ejeStatus} />
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
