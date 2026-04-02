/**
 * Onboarding flow for first-time users.
 * Shows a multi-step walkthrough explaining ProcuAsist features.
 */

import { useState } from 'react';

const ONBOARDING_KEY = 'tl_onboarding_done';

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  {
    icon: '🚀',
    title: 'Bienvenido a ProcuAsist',
    description:
      'Tu copiloto legal para los portales judiciales. Automatizamos las tareas repetitivas para que puedas enfocarte en lo importante.',
    features: [
      'Auto-login y mantenimiento de sesión',
      'Marcadores rápidos de expedientes',
      'Monitoreo automático de movimientos',
      'Descarga de expedientes en PDF',
    ],
  },
  {
    icon: '⭐',
    title: 'Marcadores rápidos',
    description:
      'Guardá tus expedientes favoritos con un click desde MEV o PJN. Accedelos desde el panel lateral sin buscar cada vez.',
    features: [
      'Click en el icono ⭐ dentro del expediente',
      'Buscar por número, carátula o juzgado',
      'Importar causas desde SCBA-Notificaciones',
    ],
  },
  {
    icon: '👁',
    title: 'Monitoreo de causas',
    description:
      'ProcuAsist revisa automáticamente tus causas cada 6 horas y te avisa cuando hay nuevos movimientos.',
    features: [
      'Activá el monitoreo con el icono 👁',
      'Recibí notificaciones de Chrome',
      'Escaneo manual cuando lo necesites',
    ],
  },
  {
    icon: '🔐',
    title: 'Seguridad',
    description:
      'Tus credenciales se encriptan con AES-256 protegidas por un PIN que solo vos conocés. Nada se envía a servidores externos.',
    features: [
      'Cifrado AES-256-GCM local',
      'PIN de acceso con bloqueo automático',
      'Opcional: sync cifrado en la nube',
    ],
  },
  {
    icon: '⚖',
    title: 'Términos de uso',
    description:
      'ProcuAsist es gratuito y se ofrece "tal cual" (as is), sin garantías de ningún tipo. Al continuar, aceptás estos términos:',
    features: [
      'No reemplaza el control manual de actuaciones judiciales',
      'El autor no es responsable por daños directos o indirectos derivados de su uso',
      'No se garantiza la descarga exitosa de archivos ni la detección de todos los movimientos',
      'Usalo como herramienta complementaria, no como único medio de seguimiento',
    ],
  },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      chrome.storage.local.set({ [ONBOARDING_KEY]: true });
      onComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    chrome.storage.local.set({ [ONBOARDING_KEY]: true });
    onComplete();
  };

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 px-4 pt-6">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step
                ? 'w-6 bg-primary'
                : i < step
                  ? 'w-1.5 bg-primary/50'
                  : 'w-1.5 bg-border'
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div
        key={step}
        className="animate-fade-in-up flex flex-1 flex-col items-center px-6 pt-8"
      >
        {/* Icon */}
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-light text-4xl animate-scale-in">
          {current.icon}
        </div>

        {/* Title */}
        <h2 className="mb-2 text-center text-xl font-bold">{current.title}</h2>

        {/* Description */}
        <p className="mb-6 text-center text-sm text-text-secondary leading-relaxed">
          {current.description}
        </p>

        {/* Features */}
        <div className="stagger-children w-full space-y-2">
          {current.features.map((feature, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg bg-bg-secondary px-3 py-2"
            >
              <span className="mt-0.5 text-primary text-sm">{'✓'}</span>
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 px-6 pb-6">
        {!isLast && (
          <button
            onClick={handleSkip}
            className="flex-1 rounded-lg py-2.5 text-sm text-text-secondary hover:text-text transition-colors"
          >
            Omitir
          </button>
        )}
        <button
          onClick={handleNext}
          className={`rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover transition-colors ${
            isLast ? 'flex-1' : 'flex-1'
          }`}
        >
          {isLast ? 'Acepto y comenzar' : 'Siguiente'}
        </button>
      </div>
    </div>
  );
}

/** Check if onboarding has been completed */
export async function isOnboardingDone(): Promise<boolean> {
  const result = await chrome.storage.local.get(ONBOARDING_KEY);
  return result[ONBOARDING_KEY] === true;
}
