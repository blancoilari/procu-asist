/**
 * Onboarding flow for first-time users.
 *
 * Además de presentar la extensión, deja al usuario OPERATIVO:
 * 1. Carga de credenciales MEV/PJN ahí mismo (paso destacado, con
 *    confirmación explícita para no pasarlo sin leer).
 * 2. Apertura de los portales en pestañas para verificar el auto-login.
 * 3. Oferta de "Importar todo" al cerrar (el panel abre el asistente).
 */

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  KeyRound,
  Scale,
} from 'lucide-react';
import type { PortalId } from '@/modules/portals/types';

const ONBOARDING_KEY = 'tl_onboarding_done';

const MEV_LOGIN_URL = 'https://mev.scba.gov.ar/loguin.asp';
const PJN_HOME_URL = 'https://scw.pjn.gov.ar/scw/homePrivado.seam';

interface OnboardingProps {
  /** action 'import-all' = el usuario pidió abrir el asistente Importar todo. */
  onComplete: (action?: 'import-all') => void;
}

type StepId = 'welcome' | 'credentials' | 'portals' | 'monitoring' | 'terms';

const STEP_ORDER: StepId[] = [
  'welcome',
  'credentials',
  'portals',
  'monitoring',
  'terms',
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [mevSaved, setMevSaved] = useState(false);
  const [pjnSaved, setPjnSaved] = useState(false);
  const [skipCredentials, setSkipCredentials] = useState(false);
  const [openedMev, setOpenedMev] = useState(false);
  const [openedPjn, setOpenedPjn] = useState(false);

  const step = STEP_ORDER[stepIndex];
  const isLast = stepIndex === STEP_ORDER.length - 1;

  // El paso de credenciales no se puede saltear sin decidir: o guardaste al
  // menos una, o tildás explícitamente que preferís cargarlas después.
  const credentialsGate = mevSaved || pjnSaved || skipCredentials;
  const nextDisabled = step === 'credentials' && !credentialsGate;

  const finish = (action?: 'import-all') => {
    chrome.storage.local.set({ [ONBOARDING_KEY]: true });
    onComplete(action);
  };

  const handleNext = () => {
    if (isLast) {
      finish();
    } else {
      setStepIndex((s) => s + 1);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 px-4 pt-6">
          {STEP_ORDER.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === stepIndex
                  ? 'w-6 bg-primary'
                  : i < stepIndex
                    ? 'w-1.5 bg-primary/50'
                    : 'w-1.5 bg-border'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div
          key={step}
          className="animate-fade-in-up flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 pt-6"
        >
          {step === 'welcome' && <WelcomeStep />}
          {step === 'credentials' && (
            <CredentialsStep
              mevSaved={mevSaved}
              pjnSaved={pjnSaved}
              onMevSaved={() => setMevSaved(true)}
              onPjnSaved={() => setPjnSaved(true)}
              skipChecked={skipCredentials}
              onSkipChange={setSkipCredentials}
            />
          )}
          {step === 'portals' && (
            <PortalsStep
              openedMev={openedMev}
              openedPjn={openedPjn}
              onOpenMev={() => {
                setOpenedMev(true);
                void chrome.tabs.create({ url: MEV_LOGIN_URL, active: false });
              }}
              onOpenPjn={() => {
                setOpenedPjn(true);
                void chrome.tabs.create({ url: PJN_HOME_URL, active: false });
              }}
            />
          )}
          {step === 'monitoring' && <MonitoringStep />}
          {step === 'terms' && <TermsStep />}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 px-6 pb-6 pt-3">
          {isLast && (
            <button
              onClick={() => finish('import-all')}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
            >
              <Download size={15} /> Acepto y quiero importar mis causas ahora
            </button>
          )}
          <div className="flex items-center gap-3">
            {!isLast && (
              <button
                onClick={() => finish()}
                className="flex-1 rounded-lg py-2.5 text-sm text-text-secondary hover:text-text transition-colors"
              >
                Omitir
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={nextDisabled}
              title={
                nextDisabled
                  ? 'Guardá al menos una credencial o tildá que preferís cargarlas después'
                  : undefined
              }
              className="flex-1 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLast ? 'Acepto y comenzar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Pasos
// ──────────────────────────────────────────────────────────

function StepHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <>
      <div className="mb-3 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-3xl animate-scale-in">
        {icon}
      </div>
      <h2 className="mb-2 text-center text-xl font-bold">{title}</h2>
      <p className="mb-4 text-center text-sm text-text-secondary leading-relaxed">
        {description}
      </p>
    </>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <div className="stagger-children w-full space-y-2">
      {items.map((feature, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-lg bg-bg-secondary px-3 py-2"
        >
          <span className="mt-0.5 text-primary text-sm">{'✓'}</span>
          <span className="text-sm">{feature}</span>
        </div>
      ))}
    </div>
  );
}

function WelcomeStep() {
  return (
    <>
      <StepHeader
        icon={<Scale size={36} strokeWidth={2.25} className="text-primary" />}
        title="Bienvenido a ProcuAsist"
        description="Tu copiloto legal para los portales judiciales. Hecho por un abogado de la matrícula, para colegas. Gratis y sin fines de lucro."
      />
      <FeatureList
        items={[
          'Auto-login y mantenimiento de sesión',
          'Guardado y monitoreo automático de causas',
          'Alertas de movimientos nuevos',
          'Descarga de expedientes en PDF/ZIP',
        ]}
      />
    </>
  );
}

function CredentialsStep({
  mevSaved,
  pjnSaved,
  onMevSaved,
  onPjnSaved,
  skipChecked,
  onSkipChange,
}: {
  mevSaved: boolean;
  pjnSaved: boolean;
  onMevSaved: () => void;
  onPjnSaved: () => void;
  skipChecked: boolean;
  onSkipChange: (value: boolean) => void;
}) {
  return (
    <>
      <StepHeader
        icon={<KeyRound size={32} className="text-primary" />}
        title="Tus claves de los portales"
        description="Este es el paso clave: con tus credenciales, ProcuAsist te loguea solo en MEV y PJN y te reconecta cuando la sesión se cae. Se guardan encriptadas en tu navegador y nunca salen de tu computadora."
      />
      <div className="w-full space-y-3">
        <InlineCredentialForm
          portal="mev"
          label="MEV (Provincia de Buenos Aires)"
          placeholderUser="Usuario MEV (ej. 20123456789)"
          saved={mevSaved}
          onSaved={onMevSaved}
        />
        <InlineCredentialForm
          portal="pjn"
          label="PJN (Poder Judicial de la Nación)"
          placeholderUser="Usuario PJN (CUIL/CUIT)"
          saved={pjnSaved}
          onSaved={onPjnSaved}
        />

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={skipChecked}
            onChange={(e) => onSkipChange(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>
            Prefiero cargar mis credenciales más tarde (después se puede desde
            Ajustes). Entiendo que sin ellas no funciona el auto-login ni la
            reconexión automática.
          </span>
        </label>
      </div>
    </>
  );
}

function InlineCredentialForm({
  portal,
  label,
  placeholderUser,
  saved,
  onSaved,
}: {
  portal: PortalId;
  label: string;
  placeholderUser: string;
  saved: boolean;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Si ya había credenciales (p. ej. reinstalación), mostrarlas como listas.
  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: 'GET_CREDENTIALS', portal })
      .then((r) => {
        if (r?.success && r.credentials) {
          setUsername(r.credentials.username as string);
          setPassword(r.credentials.password as string);
          onSaved();
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal]);

  const handleSave = async () => {
    if (!username || !password) {
      setError('Completá usuario y contraseña');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const resp = (await chrome.runtime.sendMessage({
        type: 'SAVE_CREDENTIALS',
        portal,
        username,
        password,
      })) as { success?: boolean; error?: string };
      if (resp?.success) {
        onSaved();
      } else {
        setError(resp?.error ?? 'No se pudo guardar');
      }
    } catch {
      setError('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`rounded-lg border p-3 ${
        saved ? 'border-success/60 bg-success/5' : 'border-primary/50'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold">{label}</span>
        {saved && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-success">
            <CheckCircle2 size={13} /> Guardadas
          </span>
        )}
      </div>
      {error && <p className="mb-2 text-xs text-danger">{error}</p>}
      <div className="flex flex-col gap-2">
        <input
          type="text"
          placeholder={placeholderUser}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => void handleSave()}
          disabled={saving || !username || !password}
          className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando...' : saved ? 'Actualizar' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

function PortalsStep({
  openedMev,
  openedPjn,
  onOpenMev,
  onOpenPjn,
}: {
  openedMev: boolean;
  openedPjn: boolean;
  onOpenMev: () => void;
  onOpenPjn: () => void;
}) {
  return (
    <>
      <StepHeader
        icon={<ExternalLink size={30} className="text-primary" />}
        title="Abrí tus portales"
        description="Para importar tus causas y monitorearlas, ProcuAsist necesita una pestaña abierta de cada portal con la sesión iniciada. Abrilos ahora y verificá que el auto-login funcione."
      />
      <div className="w-full space-y-2">
        <button
          onClick={onOpenMev}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
            openedMev
              ? 'border-success/60 bg-success/5 text-success'
              : 'border-primary/50 hover:bg-primary/5'
          }`}
        >
          <span>Abrir MEV (mev.scba.gov.ar)</span>
          {openedMev ? <CheckCircle2 size={15} /> : <ExternalLink size={15} />}
        </button>
        <button
          onClick={onOpenPjn}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
            openedPjn
              ? 'border-success/60 bg-success/5 text-success'
              : 'border-primary/50 hover:bg-primary/5'
          }`}
        >
          <span>Abrir PJN (scw.pjn.gov.ar)</span>
          {openedPjn ? <CheckCircle2 size={15} /> : <ExternalLink size={15} />}
        </button>
        <p className="pt-1 text-xs leading-relaxed text-text-secondary">
          Con las credenciales guardadas, cada portal se debería loguear solo
          (en MEV, la primera vez tenés que elegir tu Departamento Judicial;
          ProcuAsist lo recuerda para la próxima). Dejá las pestañas abiertas:
          el siguiente paso las usa para importar todo.
        </p>
      </div>
    </>
  );
}

function MonitoringStep() {
  return (
    <>
      <StepHeader
        icon={<Eye size={30} className="text-primary" />}
        title="Guardar = monitorear"
        description="Toda causa guardada se monitorea sola: ProcuAsist la revisa periódicamente y te avisa cuando hay movimientos nuevos, con los avisos activos desde el primer momento."
      />
      <FeatureList
        items={[
          '"Importar todo" trae tus causas de MEV (sets de búsqueda, todos los departamentos) y PJN (relacionados y favoritos)',
          'Sin pasos extra: guardar = monitorear, con avisos activos',
          'Recibís notificaciones de Chrome con cada novedad',
          'Podés pausar los avisos por causa cuando quieras',
        ]}
      />
    </>
  );
}

function TermsStep() {
  return (
    <>
      <StepHeader
        icon={'⚖'}
        title="Términos de uso"
        description='ProcuAsist es gratuito y se ofrece "tal cual" (as is), sin garantías de ningún tipo. Al continuar, aceptás estos términos:'
      />
      <FeatureList
        items={[
          'No reemplaza el control manual de actuaciones judiciales',
          'El autor no es responsable por daños directos o indirectos derivados de su uso',
          'No se garantiza la descarga exitosa de archivos ni la detección de todos los movimientos',
          'Usalo como herramienta complementaria, no como único medio de seguimiento',
        ]}
      />
    </>
  );
}

/** Check if onboarding has been completed */
export async function isOnboardingDone(): Promise<boolean> {
  const result = await chrome.storage.local.get(ONBOARDING_KEY);
  return result[ONBOARDING_KEY] === true;
}
