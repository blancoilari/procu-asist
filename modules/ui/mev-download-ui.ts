/**
 * Pantalla de la descarga de un expediente en la pestaña de la MEV: barra
 * de progreso con tiempo estimado y botón Detener, aviso de pausa cuando la
 * MEV bloquea, aviso de sesión cerrada y resumen final con "Bajar los que
 * faltan". Habla con el fondo por el canal de modules/messages/mev-download.ts.
 * Todo texto que viene del portal se inserta con textContent, nunca como HTML.
 */

import {
  MEV_DOWNLOAD_PORT,
  type MevDownloadCaseData,
  type MevDownloadClientMessage,
  type MevDownloadServerMessage,
} from '@/modules/messages/mev-download';
import { reasonLabel, type MevDownloadStats } from '@/modules/pdf/download-report';
import type { BlockChoice } from '@/modules/pdf/mev-download-runner';
import { createPortalModalButton, setPortalActionButtonState } from '@/modules/ui/portal-action-bar';
import { ICON_CHECK, ICON_LOADER, ICON_PACKAGE, ICON_X } from '@/modules/ui/icon-strings';
import { PORTAL_COLORS } from '@/modules/ui/portal-colors';

const MEV_PRIMARY = PORTAL_COLORS.mev.primary;
const DANGER = '#dc2626';
const WARNING = '#b45309';
const MEV_LOGIN_URL = 'https://mev.scba.gov.ar/loguin.asp';

let running = false;

/** true mientras esta pestaña tenga una descarga en curso. */
export function isMevDownloadRunning(): boolean {
  return running;
}

export interface StartMevDownloadOptions {
  caseData: MevDownloadCaseData;
  format: 'zip' | 'pdf';
  /** Botón "Descargar" de la botonera, para mostrar el estado. */
  button: HTMLButtonElement;
}

export function startMevDownload(options: StartMevDownloadOptions): void {
  if (running) return;
  running = true;
  const { button } = options;
  button.disabled = true;
  setPortalActionButtonState(button, ICON_LOADER, 'Descargando', 'muted');

  const panel = createProgressPanel();
  let finished = false;
  let pauseOverlay: HTMLElement | null = null;

  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = '';
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  const port = chrome.runtime.connect({ name: MEV_DOWNLOAD_PORT });
  const send = (message: MevDownloadClientMessage) => {
    try {
      port.postMessage(message);
    } catch {
      // canal cerrado: lo informa onDisconnect
    }
  };

  const closePause = () => {
    pauseOverlay?.remove();
    pauseOverlay = null;
  };

  const end = (variant: 'success' | 'warning' | 'danger', label: string) => {
    finished = true;
    running = false;
    window.removeEventListener('beforeunload', onBeforeUnload);
    closePause();
    panel.remove();
    setPortalActionButtonState(button, variant === 'danger' ? ICON_X : ICON_CHECK, label, variant);
    button.disabled = false;
    window.setTimeout(() => setPortalActionButtonState(button, ICON_PACKAGE, 'Descargar', 'primary'), 8000);
    try {
      port.disconnect();
    } catch {
      // ya estaba cerrado
    }
  };

  panel.stopButton.addEventListener('click', () => {
    if (finished) return;
    showStopDialog({
      onSave: () => send({ type: 'stop', save: true }),
      onCancel: () => send({ type: 'stop', save: false }),
    });
  });

  port.onMessage.addListener((message: MevDownloadServerMessage) => {
    switch (message.type) {
      case 'progress':
        closePause();
        panel.update(
          message.done,
          message.total,
          `Documento ${Math.min(message.done + 1, message.total)} de ${message.total}, ${formatEta(message.etaSeconds)}`
        );
        break;
      case 'waiting':
        panel.update(
          message.done,
          message.total,
          `Pausa pedida por la MEV: sigo en ${message.secondsLeft} s (${message.done} de ${message.total})`
        );
        break;
      case 'paused':
        closePause();
        pauseOverlay = showPauseDialog(message, (choice) => {
          pauseOverlay = null;
          send({ type: 'answer', choice });
        });
        panel.update(
          message.done,
          message.total,
          message.reason === 'desafio' ? 'En pausa: la MEV pidió una pausa' : 'En pausa: se cerró la sesión de la MEV'
        );
        break;
      case 'keepalive':
        break;
      case 'building':
        panel.update(1, 1, 'Armando el archivo...');
        break;
      case 'result': {
        const stats = message.stats;
        if (stats.failedItems.length === 0) {
          end('success', 'Listo');
          break;
        }
        end('warning', 'Con faltantes');
        showResultDialog(message.outcome, stats, () => {
          const again = options.caseData.movements.filter((m) => stats.missingFileBases.includes(m.fileBase));
          if (again.length > 0) {
            startMevDownload({ ...options, caseData: { ...options.caseData, movements: again } });
          }
        });
        break;
      }
      case 'cancelled':
        end('danger', 'Cancelada');
        break;
      case 'error':
        end('danger', 'Error');
        showMessageDialog('La descarga falló', message.message);
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    if (finished) return;
    end('danger', 'Cortada');
    showMessageDialog(
      'Se cortó la descarga',
      'Se perdió la conexión con la extensión (se reinició o se actualizó). No se guardó ningún archivo: volvé a intentar la descarga.'
    );
  });

  send({ type: 'start', caseData: options.caseData, format: options.format });
  panel.update(0, 1, 'Preparando la descarga...');
}

// --- Piezas de interfaz --------------------------------------------------

function formatEta(seconds: number): string {
  if (seconds < 60) return 'falta menos de un minuto';
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? 'queda un minuto' : `quedan unos ${minutes} min`;
}

function createProgressPanel(): {
  update: (done: number, total: number, label: string) => void;
  remove: () => void;
  stopButton: HTMLButtonElement;
} {
  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed', bottom: '20px', right: '188px', width: '300px', backgroundColor: 'white',
    borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', padding: '10px 12px',
    fontSize: '12px', zIndex: '999999', display: 'flex', flexDirection: 'column', gap: '6px',
  });
  const label = document.createElement('span');
  label.style.color = '#374151';
  const track = document.createElement('div');
  Object.assign(track.style, { height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' });
  const fill = document.createElement('div');
  Object.assign(fill.style, {
    height: '100%', width: '0%', backgroundColor: MEV_PRIMARY, borderRadius: '3px', transition: 'width 0.3s',
  });
  track.appendChild(fill);
  const note = document.createElement('span');
  note.textContent = 'No cierres ni cambies de página en esta pestaña; para seguir usando la MEV, abrí otra.';
  Object.assign(note.style, { color: '#6b7280', fontSize: '11px', lineHeight: '1.4' });
  const stopButton = createPortalModalButton({ label: 'Detener', variant: 'secondary' });
  stopButton.style.alignSelf = 'flex-end';
  box.append(label, track, note, stopButton);
  document.body.appendChild(box);
  return {
    update: (done, total, text) => {
      label.textContent = text;
      fill.style.width = `${total > 0 ? Math.max(3, Math.round((done / total) * 100)) : 3}%`;
    },
    remove: () => box.remove(),
    stopButton,
  };
}

function createDialog(): { overlay: HTMLDivElement; modal: HTMLDivElement } {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: '9999999',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  const modal = document.createElement('div');
  Object.assign(modal.style, {
    backgroundColor: 'white', borderRadius: '12px', padding: '24px', maxWidth: '560px', width: '90%',
    maxHeight: '75vh', display: 'flex', flexDirection: 'column', gap: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  });
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  return { overlay, modal };
}

function heading(text: string, color: string): HTMLHeadingElement {
  const h = document.createElement('h3');
  h.textContent = text;
  Object.assign(h.style, { margin: '0', color, fontSize: '16px' });
  return h;
}

function paragraph(text: string, muted = false): HTMLParagraphElement {
  const p = document.createElement('p');
  p.textContent = text;
  Object.assign(p.style, { margin: '0', color: muted ? '#6b7280' : '#374151', fontSize: '13px', lineHeight: '1.5' });
  return p;
}

function buttonRow(buttons: HTMLButtonElement[]): HTMLDivElement {
  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '8px' });
  row.append(...buttons);
  return row;
}

function showPauseDialog(
  message: Extract<MevDownloadServerMessage, { type: 'paused' }>,
  onChoice: (choice: BlockChoice) => void
): HTMLElement {
  const { overlay, modal } = createDialog();
  const choose = (choice: BlockChoice) => () => {
    overlay.remove();
    onChoice(choice);
  };
  const progress = `Bajados: ${message.done} de ${message.total}.`;
  if (message.reason === 'desafio') {
    modal.append(
      heading('La MEV pidió una pausa', WARNING),
      paragraph(
        'La MEV limita cuántos documentos se pueden pedir por minuto y ahora respondió con su pantalla de verificación. ' +
          `${progress} Si esperás, la descarga sigue sola en ${message.waitSeconds} segundos y reintenta el mismo documento: no se saltea nada.`
      ),
      buttonRow([
        createPortalModalButton({ label: 'Cancelar sin guardar', variant: 'secondary', onClick: choose('cancel') }),
        createPortalModalButton({ label: 'Detener y guardar lo bajado', variant: 'secondary', onClick: choose('stop-save') }),
        createPortalModalButton({ label: 'Esperar y seguir', variant: 'primary', onClick: choose('wait') }),
      ])
    );
  } else {
    const link = document.createElement('a');
    link.textContent = 'Abrir la MEV en otra pestaña';
    link.href = MEV_LOGIN_URL;
    link.target = '_blank';
    link.rel = 'noopener';
    Object.assign(link.style, { fontSize: '13px', color: MEV_PRIMARY });
    modal.append(
      heading('Se cerró la sesión de la MEV', WARNING),
      paragraph(
        `${progress} Para seguir, iniciá sesión en OTRA pestaña de la MEV (en esta no: cambiar de página cancela la descarga) y después tocá Seguir.`
      ),
      link,
      buttonRow([
        createPortalModalButton({ label: 'Cancelar sin guardar', variant: 'secondary', onClick: choose('cancel') }),
        createPortalModalButton({ label: 'Detener y guardar lo bajado', variant: 'secondary', onClick: choose('stop-save') }),
        createPortalModalButton({ label: 'Seguir', variant: 'primary', onClick: choose('continue') }),
      ])
    );
  }
  return overlay;
}

function showStopDialog(actions: { onSave: () => void; onCancel: () => void }): void {
  const { overlay, modal } = createDialog();
  const close = () => overlay.remove();
  modal.append(
    heading('¿Detener la descarga?', WARNING),
    paragraph('Podés guardar lo que ya se bajó, con el informe de lo que falta, o cancelar sin guardar nada.'),
    buttonRow([
      createPortalModalButton({ label: 'Seguir descargando', variant: 'secondary', onClick: close }),
      createPortalModalButton({
        label: 'Cancelar sin guardar',
        variant: 'secondary',
        onClick: () => {
          close();
          actions.onCancel();
        },
      }),
      createPortalModalButton({
        label: 'Detener y guardar lo bajado',
        variant: 'primary',
        onClick: () => {
          close();
          actions.onSave();
        },
      }),
    ])
  );
}

function showResultDialog(
  outcome: 'complete' | 'partial',
  stats: MevDownloadStats,
  onRetryMissing: () => void
): void {
  const { overlay, modal } = createDialog();
  const count = stats.failedItems.length;
  modal.append(
    heading(
      outcome === 'partial' ? `Descarga detenida: faltan ${count}` : `Descarga con ${count} faltante${count === 1 ? '' : 's'}`,
      DANGER
    ),
    paragraph(
      'El archivo se guardó con lo que se pudo bajar. El detalle está en el informe _verificacion dentro del ZIP (o en la última página del PDF único).',
      true
    )
  );
  const list = document.createElement('div');
  Object.assign(list.style, { overflowY: 'auto', flex: '1', borderTop: '1px solid #e5e7eb' });
  for (const item of stats.failedItems.slice(0, 300)) {
    const row = document.createElement('div');
    Object.assign(row.style, { padding: '8px 4px', borderBottom: '1px solid #e5e7eb', fontSize: '12px' });
    const name = document.createElement('strong');
    name.textContent = `${item.kind === 'proveido' ? '[PROVEÍDO]' : '[ADJUNTO]'} ${item.fileName}`;
    name.style.color = '#1f2937';
    const step = document.createElement('div');
    step.textContent = `${item.date}${item.fojas ? `, fs. ${item.fojas}` : ''}, ${item.description}`;
    step.style.color = '#374151';
    const why = document.createElement('div');
    why.textContent = `Motivo: ${reasonLabel(item.reason)}${item.detail ? ` (${item.detail})` : ''}`;
    Object.assign(why.style, { color: '#6b7280', fontSize: '11px' });
    row.append(name, step, why);
    list.appendChild(row);
  }
  const missing = stats.missingFileBases.length;
  const retry = createPortalModalButton({
    label: `Bajar los que faltan (${missing} paso${missing === 1 ? '' : 's'})`,
    variant: 'primary',
    onClick: () => {
      overlay.remove();
      onRetryMissing();
    },
  });
  retry.disabled = missing === 0;
  modal.append(
    list,
    buttonRow([
      createPortalModalButton({ label: 'Cerrar', variant: 'secondary', onClick: () => overlay.remove() }),
      retry,
    ])
  );
}

function showMessageDialog(title: string, text: string): void {
  const { overlay, modal } = createDialog();
  modal.append(
    heading(title, DANGER),
    paragraph(text),
    buttonRow([createPortalModalButton({ label: 'Cerrar', variant: 'primary', onClick: () => overlay.remove() })])
  );
}
