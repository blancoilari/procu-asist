import { useState, useEffect } from 'react';
import type { PortalId } from '@/modules/portals/types';
import { MEV_DEPARTAMENTOS } from '@/modules/portals/mev-selectors';

type Page = 'credentials' | 'monitoring' | 'appearance' | 'account';

export default function App() {
  const [activePage, setActivePage] = useState<Page>('credentials');
  const [lockStatus, setLockStatus] = useState<{
    pinConfigured: boolean;
    unlocked: boolean;
  } | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_LOCK_STATUS' }, setLockStatus);
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl bg-bg text-text">
      {/* Sidebar Navigation */}
      <nav className="w-56 border-r border-border p-4">
        <h1 className="mb-6 text-xl font-bold text-primary">🚀 ProcuAsist</h1>
        <ul className="flex flex-col gap-1">
          {(
            [
              ['credentials', 'Credenciales'],
              ['monitoring', 'Monitoreo'],
              ['appearance', 'Apariencia'],
              ['account', 'Cuenta'],
            ] as [Page, string][]
          ).map(([page, label]) => (
            <li key={page}>
              <button
                onClick={() => setActivePage(page)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  activePage === page
                    ? 'bg-primary-light font-medium text-primary'
                    : 'text-text-secondary hover:bg-bg-secondary'
                }`}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>

        {lockStatus && (
          <div className="mt-6 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${lockStatus.unlocked ? 'bg-success' : 'bg-danger'}`}
              />
              <span className="text-xs text-text-secondary">
                {lockStatus.unlocked ? 'Desbloqueado' : 'Bloqueado'}
              </span>
            </div>
          </div>
        )}
      </nav>

      {/* Content */}
      <main className="flex-1 p-8">
        {activePage === 'credentials' && (
          <CredentialsPage lockStatus={lockStatus} />
        )}
        {activePage === 'monitoring' && <MonitoringPage />}
        {activePage === 'appearance' && <AppearancePage />}
        {activePage === 'account' && <AccountPage />}
      </main>
    </div>
  );
}

function CredentialsPage({
  lockStatus,
}: {
  lockStatus: { pinConfigured: boolean; unlocked: boolean } | null;
}) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [pinError, setPinError] = useState('');

  const handleSetupPin = () => {
    setPinError('');
    setPinMessage('');
    if (pin.length < 4) {
      setPinError('El PIN debe tener al menos 4 dígitos');
      return;
    }
    if (!lockStatus?.pinConfigured && pin !== confirmPin) {
      setPinError('Los PINs no coinciden');
      return;
    }

    const msgType = lockStatus?.pinConfigured ? 'UNLOCK_PIN' : 'SETUP_PIN';
    chrome.runtime.sendMessage({ type: msgType, pin }, (response) => {
      if (response?.success) {
        setPinMessage(
          lockStatus?.pinConfigured
            ? 'Desbloqueado correctamente'
            : 'PIN configurado correctamente'
        );
        setPin('');
        setConfirmPin('');
        // Refresh status
        window.location.reload();
      } else {
        setPinError(
          lockStatus?.pinConfigured
            ? 'PIN incorrecto'
            : 'Error al configurar PIN'
        );
      }
    });
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Credenciales</h2>
      <p className="mb-6 text-sm text-text-secondary">
        Tus credenciales se encriptan localmente con AES-256-GCM y nunca salen
        de tu dispositivo.
      </p>

      {/* PIN Section */}
      <section className="mb-8">
        <h3 className="mb-3 text-lg font-semibold">PIN Maestro</h3>
        {pinError && (
          <p className="mb-2 text-sm text-danger">{pinError}</p>
        )}
        {pinMessage && (
          <p className="mb-2 text-sm text-success">{pinMessage}</p>
        )}

        {!lockStatus?.unlocked && (
          <div className="flex flex-col gap-3">
            <input
              type="password"
              placeholder={
                lockStatus?.pinConfigured
                  ? 'Ingresá tu PIN'
                  : 'Nuevo PIN (4-8 dígitos)'
              }
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && handleSetupPin()}
              className="w-64 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {!lockStatus?.pinConfigured && (
              <input
                type="password"
                placeholder="Confirmar PIN"
                maxLength={8}
                value={confirmPin}
                onChange={(e) =>
                  setConfirmPin(e.target.value.replace(/\D/g, ''))
                }
                onKeyDown={(e) => e.key === 'Enter' && handleSetupPin()}
                className="w-64 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
              />
            )}
            <button
              onClick={handleSetupPin}
              disabled={pin.length < 4}
              className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {lockStatus?.pinConfigured ? 'Desbloquear' : 'Configurar PIN'}
            </button>
          </div>
        )}

        {lockStatus?.unlocked && (
          <p className="flex items-center gap-2 text-sm text-success">
            <span className="h-2 w-2 rounded-full bg-success" />
            PIN configurado y desbloqueado
          </p>
        )}
      </section>

      {/* Portal Credentials - Only show when unlocked */}
      {lockStatus?.unlocked ? (
        <>
          <PortalCredentials
            portal="mev"
            label="MEV"
            description="MEV - Mesa de Entradas Virtual - Provincia de Buenos Aires"
          />
          <MevDepartmentSelector />
          <PortalCredentials
            portal="eje"
            label="JUSCABA"
            description="JUSCABA - Poder Judicial de CABA"
          />
          <PortalCredentials
            portal="pjn"
            label="PJN"
            description="PJN - Poder Judicial de la Nación (portal nacional + sistema de consultas web)"
          />
        </>
      ) : (
        <div className="rounded-lg border border-border bg-bg-secondary p-6 text-center">
          <p className="text-sm text-text-secondary">
            {lockStatus?.pinConfigured
              ? 'Desbloqueá con tu PIN para ver y editar las credenciales.'
              : 'Configurá un PIN maestro primero para guardar credenciales.'}
          </p>
        </div>
      )}
    </div>
  );
}

function PortalCredentials({
  portal,
  label,
  description,
}: {
  portal: PortalId;
  label: string;
  description: string;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Check if credentials exist
    chrome.runtime.sendMessage(
      { type: 'GET_CREDENTIALS', portal },
      (response) => {
        if (response?.success && response.credentials) {
          setUsername(response.credentials.username);
          setPassword(response.credentials.password);
          setHasExisting(true);
          setSaved(true);
        }
      }
    );
  }, [portal]);

  const handleSave = () => {
    if (!username || !password) {
      setMessage('Completá usuario y contraseña');
      return;
    }

    chrome.runtime.sendMessage(
      { type: 'SAVE_CREDENTIALS', portal, username, password },
      (response) => {
        if (response?.success) {
          setSaved(true);
          setHasExisting(true);
          setMessage('Credenciales guardadas y encriptadas');
          setTimeout(() => setMessage(''), 3000);
        } else {
          setMessage(response?.error ?? 'Error al guardar');
        }
      }
    );
  };

  return (
    <section className="mb-6 rounded-lg border border-border p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{label}</h3>
        {hasExisting && (
          <span className="flex items-center gap-1 text-xs text-success">
            <span className="h-2 w-2 rounded-full bg-success" />
            Guardadas
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-text-secondary">{description}</p>

      {message && (
        <p
          className={`mb-3 text-sm ${message.includes('Error') || message.includes('Completá') ? 'text-danger' : 'text-success'}`}
        >
          {message}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setSaved(false);
          }}
          className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setSaved(false);
            }}
            className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 pr-16 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-text-secondary hover:text-text"
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={saved}
          className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {saved ? 'Guardado' : 'Guardar Credenciales'}
        </button>
      </div>
    </section>
  );
}

function MevDepartmentSelector() {
  const [depto, setDepto] = useState('aa');

  useEffect(() => {
    chrome.storage.local.get('tl_settings', (result) => {
      const settings = result.tl_settings as Record<string, unknown> | undefined;
      if (settings?.mevDepartamento) {
        setDepto(settings.mevDepartamento as string);
      }
    });
  }, []);

  const handleChange = (value: string) => {
    setDepto(value);
    chrome.storage.local.get('tl_settings', (result) => {
      const settings = (result.tl_settings ?? {}) as Record<string, unknown>;
      chrome.storage.local.set({
        tl_settings: { ...settings, mevDepartamento: value },
      });
    });
  };

  return (
    <section className="mb-6 rounded-lg border border-border p-4">
      <h3 className="mb-1 text-lg font-semibold">Departamento Judicial</h3>
      <p className="mb-3 text-xs text-text-secondary">
        Departamento por defecto para el auto-login en MEV
      </p>
      <select
        value={depto}
        onChange={(e) => handleChange(e.target.value)}
        className="w-64 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
      >
        {Object.entries(MEV_DEPARTAMENTOS).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
    </section>
  );
}

function MonitoringPage() {
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Monitoreo</h2>
      <p className="text-sm text-text-secondary">
        Configurá la frecuencia de escaneo y las notificaciones para la
        procuración automática.
      </p>
      <div className="mt-6 rounded-lg border border-border bg-bg-secondary p-6 text-center">
        <p className="text-sm text-text-secondary">
          El monitoreo se activa desde los marcadores en el panel lateral.
        </p>
      </div>
    </div>
  );
}

function AppearancePage() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    chrome.storage.local.get('tl_settings', (result) => {
      const settings = result.tl_settings as Record<string, unknown> | undefined;
      if (settings?.darkMode) {
        setDarkMode(true);
      }
    });
  }, []);

  const toggleDarkMode = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    chrome.storage.local.get('tl_settings', (result) => {
      const settings = (result.tl_settings ?? {}) as Record<string, unknown>;
      chrome.storage.local.set({
        tl_settings: { ...settings, darkMode: newValue },
      });
    });
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Apariencia</h2>
      <label className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium">Dark Mode</p>
          <p className="text-xs text-text-secondary">
            Tema oscuro para los portales judiciales (MEV, JUSCABA)
          </p>
        </div>
        <button
          role="switch"
          aria-checked={darkMode}
          onClick={toggleDarkMode}
          className={`relative h-6 w-10 rounded-full transition-colors ${
            darkMode ? 'bg-primary' : 'bg-border'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              darkMode ? 'translate-x-4' : ''
            }`}
          />
        </button>
      </label>
    </div>
  );
}

function AccountPage() {
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Cuenta</h2>

      {/* Plan Info */}
      <section className="mb-6 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Plan actual</p>
            <p className="text-xs text-text-secondary">
              Gratuito — todas las funciones habilitadas, sin límites
            </p>
          </div>
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            Gratis
          </span>
        </div>
      </section>

      {/* Auth */}
      <section className="rounded-lg border border-border p-4">
        <p className="mb-4 text-sm text-text-secondary">
          Iniciá sesión para sincronizar tus marcadores y monitoreos entre
          dispositivos.
        </p>
        <div className="flex flex-col gap-2">
          <button className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-bg-secondary">
            Iniciar sesión con Google
          </button>
          <button className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-bg-secondary">
            Iniciar sesión con Outlook
          </button>
        </div>
      </section>
    </div>
  );
}
