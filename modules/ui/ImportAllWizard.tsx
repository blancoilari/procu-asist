/**
 * Asistente "Importar todo": trae todas las causas de un colega recién
 * instalado, con acompañamiento y sin generar ruido de alertas.
 *
 * Tres fases:
 * 1. Conteo: detecta pestañas MEV/SCW con sesión, estima los listados PJN
 *    por paginador y enumera los sets MEV (sin contarlos: se cuentan al
 *    importar, caminar páginas solo para contar castiga al portal).
 * 2. Selección: checkboxes por fuente, con la consecuencia anti-ruido
 *    explicada ANTES de ejecutar (umbral de avisos pausados).
 * 3. Ejecución: progreso por fuente leído de storage.session, cancelar que
 *    corta limpio y resumen final. La corrida vive en el background: cerrar
 *    el panel no la interrumpe.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Hourglass,
  RefreshCw,
  X,
  XCircle,
} from 'lucide-react';
import {
  IMPORT_ALL_PROGRESS_STORAGE_KEY,
  type ImportAllDetectResult,
  type ImportAllRunProgress,
  type ImportAllSelection,
} from '@/modules/messages/types';

type Step = 'detect' | 'select' | 'run';

export default function ImportAllWizard({
  pauseThreshold,
  onClose,
}: {
  pauseThreshold: number;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('detect');
  const [detection, setDetection] = useState<ImportAllDetectResult | null>(
    null
  );
  const [detectError, setDetectError] = useState('');
  const [progress, setProgress] = useState<ImportAllRunProgress | null>(null);
  const [cancelRequested, setCancelRequested] = useState(false);

  // Selección
  const [pjnRelacionados, setPjnRelacionados] = useState(true);
  const [pjnFavoritos, setPjnFavoritos] = useState(false);
  const [selectedSets, setSelectedSets] = useState<Set<string>>(new Set());

  const runDetection = useCallback(async () => {
    setStep('detect');
    setDetectError('');
    try {
      const resp = (await chrome.runtime.sendMessage({
        type: 'IMPORT_ALL_DETECT',
      })) as
        | { success: boolean; detection: ImportAllDetectResult }
        | undefined;
      if (!resp?.success) {
        setDetectError('No se pudo detectar el estado de los portales.');
        setStep('select');
        return;
      }
      setDetection(resp.detection);
      // Defaults razonables: PJN relacionados si está disponible; los sets
      // MEV se eligen a mano (pueden ser enormes).
      setPjnRelacionados(
        resp.detection.pjn.hasTab && resp.detection.pjn.hasSession
      );
      setPjnFavoritos(false);
      setSelectedSets(new Set());
      setStep('select');
    } catch (err) {
      console.warn('[ProcuAsist] Importar todo: detección falló:', err);
      setDetectError('No se pudo detectar el estado de los portales.');
      setStep('select');
    }
  }, []);

  // Al abrir: si ya hay una corrida en curso, retomarla; si no, detectar.
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const stored = await chrome.storage.session.get(
        IMPORT_ALL_PROGRESS_STORAGE_KEY
      );
      const existing = stored[IMPORT_ALL_PROGRESS_STORAGE_KEY] as
        | ImportAllRunProgress
        | undefined;
      if (!mounted) return;
      if (existing?.running) {
        setProgress(existing);
        setStep('run');
        return;
      }
      void runDetection();
    })();
    return () => {
      mounted = false;
    };
  }, [runDetection]);

  // Progreso en vivo desde storage.session.
  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === 'session' && changes[IMPORT_ALL_PROGRESS_STORAGE_KEY]) {
        setProgress(
          changes[IMPORT_ALL_PROGRESS_STORAGE_KEY]
            .newValue as ImportAllRunProgress
        );
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const pjnOk = !!detection?.pjn.hasTab && !!detection?.pjn.hasSession;
  const mevOk = !!detection?.mev.hasTab && !!detection?.mev.hasSession;

  const sourceEstimate = (list: 'relacionados' | 'favoritos'): number | null =>
    detection?.pjn.sources.find((s) => s.list === list)?.estimatedCases ?? null;

  const knownTotal =
    (pjnRelacionados ? (sourceEstimate('relacionados') ?? 0) : 0) +
    (pjnFavoritos ? (sourceEstimate('favoritos') ?? 0) : 0);
  const hasUncountedSets = selectedSets.size > 0;
  const nothingSelected =
    !pjnRelacionados && !pjnFavoritos && selectedSets.size === 0;

  const handleRun = async () => {
    if (!detection) return;
    const selection: ImportAllSelection = {
      pjnRelacionados: pjnRelacionados && pjnOk,
      pjnFavoritos: pjnFavoritos && pjnOk,
      mevSets: detection.mev.sets.filter((s) => selectedSets.has(s.id)),
    };
    setCancelRequested(false);
    const resp = (await chrome.runtime.sendMessage({
      type: 'IMPORT_ALL_RUN',
      selection,
    })) as { success: boolean; error?: string } | undefined;
    if (!resp?.success) {
      setDetectError(resp?.error ?? 'No se pudo iniciar la importación.');
      return;
    }
    setStep('run');
  };

  const handleCancel = async () => {
    setCancelRequested(true);
    await chrome.runtime.sendMessage({ type: 'IMPORT_ALL_CANCEL' });
  };

  const toggleSet = (id: string) => {
    const next = new Set(selectedSets);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSets(next);
  };

  const finished = !!progress && !progress.running;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
      <div className="flex max-h-[92vh] w-full max-w-sm flex-col rounded-xl bg-bg text-text shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Download size={16} /> Importar todo
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-secondary hover:bg-bg-secondary"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {step === 'detect' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-xs text-text-secondary">
                Detectando portales con sesión activa...
              </p>
              <p className="text-[10px] leading-snug text-text-secondary/70">
                ProcuAsist navega tu pestaña de PJN/SCW entre los listados para
                estimar cuántas causas hay. No cierres las pestañas de los
                portales.
              </p>
            </div>
          )}

          {step === 'select' && (
            <div className="flex flex-col gap-3">
              {detectError && (
                <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  {detectError}
                </p>
              )}

              {/* PJN */}
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  PJN (scw.pjn.gov.ar)
                </h3>
                {!detection?.pjn.hasTab ? (
                  <p className="text-[11px] leading-snug text-text-secondary">
                    No hay una pestaña de SCW abierta. Abrí
                    scw.pjn.gov.ar, iniciá sesión y reintentá la detección.
                  </p>
                ) : !detection.pjn.hasSession ? (
                  <p className="text-[11px] leading-snug text-text-secondary">
                    La sesión de PJN no está iniciada. Ingresá al portal y
                    reintentá la detección.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    <WizardCheckbox
                      checked={pjnRelacionados}
                      onChange={setPjnRelacionados}
                      label="Relacionados"
                      detail={estimateLabel(
                        detection.pjn.sources.find(
                          (s) => s.list === 'relacionados'
                        )
                      )}
                    />
                    <WizardCheckbox
                      checked={pjnFavoritos}
                      onChange={setPjnFavoritos}
                      label="Favoritos"
                      detail={estimateLabel(
                        detection.pjn.sources.find(
                          (s) => s.list === 'favoritos'
                        )
                      )}
                    />
                    <p className="text-[10px] leading-snug text-text-secondary/70">
                      Los números son aproximados (paginador × filas por
                      página). En Relacionados se recorre la solapa visible
                      (letrado o parte).
                    </p>
                  </div>
                )}
              </div>

              {/* MEV */}
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  MEV (mev.scba.gov.ar)
                </h3>
                {!detection?.mev.hasTab ? (
                  <p className="text-[11px] leading-snug text-text-secondary">
                    No hay una pestaña de MEV abierta. Abrí mev.scba.gov.ar,
                    iniciá sesión y reintentá la detección.
                  </p>
                ) : !mevOk ? (
                  <p className="text-[11px] leading-snug text-text-secondary">
                    La sesión de MEV no está iniciada o expiró. Ingresá al
                    portal y reintentá la detección.
                  </p>
                ) : detection.mev.sets.length === 0 ? (
                  <p className="text-[11px] leading-snug text-text-secondary">
                    No se encontraron sets de búsqueda guardados en tu cuenta
                    MEV. Las causas MEV también se pueden importar desde una
                    página de resultados con el botón Importar.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {detection.mev.sets.map((set) => (
                      <WizardCheckbox
                        key={set.id}
                        checked={selectedSets.has(set.id)}
                        onChange={() => toggleSet(set.id)}
                        label={`Set "${set.nombre}"`}
                        detail="se cuenta al importar"
                      />
                    ))}
                    <p className="text-[10px] leading-snug text-text-secondary/70">
                      Cada set se recorre completo, departamento por
                      departamento. Puede tardar varios minutos.
                    </p>
                  </div>
                )}
              </div>

              {/* Consecuencia anti-ruido, clara ANTES de ejecutar */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-900/15">
                <p className="flex items-start gap-1.5 text-[11px] leading-snug text-amber-800 dark:text-amber-200">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    {knownTotal > pauseThreshold ? (
                      <>
                        Vas a importar aproximadamente {knownTotal} causas,
                        más que el umbral de {pauseThreshold}: las causas
                        nuevas van a entrar con los{' '}
                        <strong>avisos pausados</strong>. Después activás el
                        monitoreo solo de las que te interesan.
                      </>
                    ) : hasUncountedSets ? (
                      <>
                        Si el total importado supera el umbral de{' '}
                        {pauseThreshold} causas (los sets MEV se cuentan al
                        importar), las causas nuevas van a entrar con los{' '}
                        <strong>avisos pausados</strong> y activás el
                        monitoreo solo de las que te interesan.
                      </>
                    ) : (
                      <>
                        Por debajo del umbral de {pauseThreshold} causas, las
                        importadas quedan con monitoreo activo normal. El
                        umbral se cambia en Ajustes.
                      </>
                    )}
                  </span>
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => void runDetection()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-bg-secondary px-3 py-2 text-xs text-text-secondary hover:bg-border"
                >
                  <RefreshCw size={13} /> Reintentar detección
                </button>
                <button
                  onClick={() => void handleRun()}
                  disabled={nothingSelected}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  <Download size={13} /> Importar
                </button>
              </div>
            </div>
          )}

          {step === 'run' && (
            <div className="flex flex-col gap-3">
              {!progress ? (
                <div className="flex items-center justify-center py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : (
                <>
                  <ul className="flex flex-col gap-2">
                    {progress.sources.map((source) => (
                      <li
                        key={source.key}
                        className="rounded-lg border border-border px-3 py-2"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <SourceStateIcon state={source.state} />
                          <span className="min-w-0 flex-1 truncate">
                            {source.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] leading-snug text-text-secondary">
                          {source.state === 'done' ||
                          source.state === 'cancelled'
                            ? `${source.imported} nuevas, ${source.existing} ya existentes` +
                              (source.failed ? `, ${source.failed} errores` : '') +
                              (source.state === 'cancelled'
                                ? ' (cancelada)'
                                : '')
                            : source.state === 'error'
                              ? (source.detail ?? 'Error')
                              : (source.detail ??
                                (source.state === 'pending'
                                  ? 'En espera'
                                  : 'En curso...'))}
                        </p>
                      </li>
                    ))}
                  </ul>

                  {finished ? (
                    <div className="rounded-lg bg-bg-secondary px-3 py-2 text-[11px] leading-snug text-text-secondary">
                      <p className="font-medium text-text">
                        Resumen: {progress.totalImported} importadas,{' '}
                        {progress.totalExisting} duplicadas salteadas,{' '}
                        {progress.totalFailed} errores.
                        {progress.cancelled ? ' Corrida cancelada.' : ''}
                      </p>
                      {progress.monitorsPaused > 0 && (
                        <p className="mt-1">
                          Se superó el umbral de {progress.pauseThreshold}{' '}
                          causas: {progress.monitorsPaused} causas nuevas
                          quedaron con avisos pausados. Activá el monitoreo de
                          las que te interesan desde la lista de Causas.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] leading-snug text-text-secondary/70">
                      La importación corre en segundo plano: podés cerrar este
                      panel y seguirá avanzando. No cierres las pestañas de
                      los portales.
                    </p>
                  )}

                  <div className="flex gap-2">
                    {!finished && (
                      <button
                        onClick={() => void handleCancel()}
                        disabled={cancelRequested}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20"
                      >
                        {cancelRequested ? 'Cancelando...' : 'Cancelar'}
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="flex flex-1 items-center justify-center rounded-lg bg-bg-secondary px-3 py-2 text-xs text-text-secondary hover:bg-border"
                    >
                      {finished ? 'Cerrar' : 'Seguir en segundo plano'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function estimateLabel(
  source:
    | { estimatedCases: number | null; pages: number | null; error?: string }
    | undefined
): string {
  if (!source) return 'sin datos';
  if (source.error || source.estimatedCases === null) {
    return 'no se pudo estimar';
  }
  const pages =
    source.pages && source.pages > 1 ? `, ${source.pages} páginas` : '';
  return `≈ ${source.estimatedCases} causas${pages}`;
}

function WizardCheckbox({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  detail: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 hover:bg-bg-secondary/50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="shrink-0"
      />
      <span className="min-w-0 flex-1 truncate text-xs">{label}</span>
      <span className="shrink-0 text-[10px] text-text-secondary">{detail}</span>
    </label>
  );
}

function SourceStateIcon({
  state,
}: {
  state: 'pending' | 'running' | 'done' | 'error' | 'cancelled';
}) {
  if (state === 'done')
    return <CheckCircle2 size={13} className="shrink-0 text-success" />;
  if (state === 'error')
    return <XCircle size={13} className="shrink-0 text-danger" />;
  if (state === 'cancelled')
    return <XCircle size={13} className="shrink-0 text-text-secondary" />;
  if (state === 'running')
    return (
      <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    );
  return <Hourglass size={13} className="shrink-0 text-text-secondary" />;
}
