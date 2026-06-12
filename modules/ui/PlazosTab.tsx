/**
 * Pestaña "Plazos" del sidepanel: calculadora de plazos procesales,
 * lista de vencimientos con alertas, export a calendario (.ics) y
 * administración de días inhábiles (ferias judiciales, asuetos).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  computePlazo,
  diffDays,
  formatDisplayDate,
  getPlazosConfig,
  savePlazosConfig,
  toIsoDate,
  type InhabilRange,
  type PlazoKind,
} from '@/modules/plazos/plazos';
import {
  addDeadline,
  getDeadlines,
  removeDeadline,
  updateDeadline,
  type Deadline,
} from '@/modules/storage/deadline-store';
import { buildDeadlinesIcs } from '@/modules/plazos/ics-export';

export default function PlazosTab() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [inhabiles, setInhabiles] = useState<InhabilRange[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [list, cfg] = await Promise.all([getDeadlines(), getPlazosConfig()]);
    setDeadlines(list);
    setInhabiles(cfg.customInhabiles);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visible = useMemo(
    () =>
      deadlines.filter((d) => (showCompleted ? true : !d.completedAt)),
    [deadlines, showCompleted]
  );
  const pendingCount = deadlines.filter((d) => !d.completedAt).length;

  const handleExportIcs = () => {
    const pending = deadlines.filter((d) => !d.completedAt);
    if (pending.length === 0) return;
    const ics = buildDeadlinesIcs(pending);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `procuasist-plazos-${toIsoDate(new Date())}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <NewDeadlineForm inhabiles={inhabiles} onAdded={reload} />

      {/* Lista */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Vencimientos ({pendingCount})
        </h3>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-text-secondary">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          Mostrar cumplidos
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg bg-bg-secondary px-3 py-4 text-center text-xs text-text-secondary">
          No hay plazos cargados. Calculá uno arriba: la extensión te avisa
          3 días antes, el día anterior y el día del vencimiento.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visible.map((d) => (
            <DeadlineRow key={d.id} deadline={d} onChanged={reload} />
          ))}
        </ul>
      )}

      {pendingCount > 0 && (
        <button
          onClick={handleExportIcs}
          className="flex items-center justify-center gap-2 rounded-lg bg-bg-secondary px-4 py-2.5 text-sm text-text-secondary hover:bg-border transition-colors"
        >
          <CalendarPlus size={15} /> Exportar a calendario (.ics)
        </button>
      )}

      <InhabilesEditor inhabiles={inhabiles} onChanged={reload} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────

function NewDeadlineForm({
  inhabiles,
  onAdded,
}: {
  inhabiles: InhabilRange[];
  onAdded: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [notifDate, setNotifDate] = useState(toIsoDate(new Date()));
  const [days, setDays] = useState('5');
  const [kind, setKind] = useState<PlazoKind>('habiles');
  const [error, setError] = useState('');

  const preview = useMemo(() => {
    const n = Number(days);
    if (!notifDate || !Number.isInteger(n) || n <= 0) return null;
    try {
      return computePlazo(notifDate, n, kind, inhabiles);
    } catch {
      return null;
    }
  }, [notifDate, days, kind, inhabiles]);

  const handleAdd = async () => {
    setError('');
    if (!title.trim()) {
      setError('Poné una descripción (qué vence).');
      return;
    }
    if (!preview) {
      setError('Revisá la fecha y la cantidad de días.');
      return;
    }
    await addDeadline({
      title: title.trim(),
      caseNumber: caseNumber.trim() || undefined,
      notifDate,
      days: Number(days),
      kind,
      dueDate: preview.dueDate,
      graceDate: preview.graceDate,
    });
    setTitle('');
    setCaseNumber('');
    await onAdded();
  };

  const inputCls =
    'rounded-lg border border-border bg-bg-secondary px-2.5 py-1.5 text-xs outline-none focus:border-primary';

  return (
    <div className="rounded-lg border border-border p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <CalendarClock size={15} className="text-primary" /> Calcular plazo
      </h3>

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      <div className="flex flex-col gap-2">
        <input
          type="text"
          placeholder="Qué vence (ej: Contestar demanda)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputCls}
        />
        <input
          type="text"
          placeholder="Expediente (opcional)"
          value={caseNumber}
          onChange={(e) => setCaseNumber(e.target.value)}
          className={inputCls}
        />
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-0.5 text-[10px] text-text-secondary">
            Notificación
            <input
              type="date"
              value={notifDate}
              onChange={(e) => setNotifDate(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="flex w-16 flex-col gap-0.5 text-[10px] text-text-secondary">
            Días
            <input
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="flex flex-1 flex-col gap-0.5 text-[10px] text-text-secondary">
            Tipo
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as PlazoKind)}
              className={inputCls}
            >
              <option value="habiles">Hábiles</option>
              <option value="corridos">Corridos</option>
            </select>
          </label>
        </div>

        {preview && (
          <div className="rounded-lg bg-primary-light/60 px-3 py-2 text-xs">
            <p>
              Vence el{' '}
              <strong>{formatDisplayDate(preview.dueDate)}</strong>
            </p>
            <p className="text-[10px] text-text-secondary">
              Plazo de gracia: primeras horas del{' '}
              {formatDisplayDate(preview.graceDate)}
            </p>
          </div>
        )}

        <button
          onClick={() => void handleAdd()}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
        >
          <Plus size={14} /> Agregar plazo
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────

function DeadlineRow({
  deadline,
  onChanged,
}: {
  deadline: Deadline;
  onChanged: () => Promise<void>;
}) {
  const todayIso = toIsoDate(new Date());
  const daysLeft = diffDays(todayIso, deadline.dueDate);
  const done = !!deadline.completedAt;

  const badge = done
    ? { text: 'Cumplido', cls: 'bg-bg-secondary text-text-secondary' }
    : daysLeft < 0
      ? { text: 'VENCIDO', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' }
      : daysLeft === 0
        ? { text: 'HOY', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' }
        : daysLeft <= 3
          ? { text: `${daysLeft} día${daysLeft === 1 ? '' : 's'}`, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' }
          : { text: `${daysLeft} días`, cls: 'bg-bg-secondary text-text-secondary' };

  const toggleDone = async () => {
    await updateDeadline(deadline.id, {
      completedAt: done ? undefined : new Date().toISOString(),
    });
    await onChanged();
  };

  const handleDelete = async () => {
    await removeDeadline(deadline.id);
    await onChanged();
  };

  return (
    <li
      className={`flex items-center gap-2 rounded-lg border border-border px-3 py-2 ${done ? 'opacity-60' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${done ? 'line-through' : ''}`}>
          {deadline.title}
        </p>
        <p className="text-[10px] text-text-secondary">
          {deadline.caseNumber ? `${deadline.caseNumber} · ` : ''}
          Vence {formatDisplayDate(deadline.dueDate)}
          {deadline.graceDate
            ? ` · gracia ${formatDisplayDate(deadline.graceDate)}`
            : ''}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}
      >
        {badge.text}
      </span>
      <button
        onClick={() => void toggleDone()}
        title={done ? 'Marcar como pendiente' : 'Marcar como cumplido'}
        className="shrink-0 rounded p-1 text-text-secondary hover:text-success transition-colors"
      >
        {done ? <RotateCcw size={14} /> : <Check size={14} />}
      </button>
      <button
        onClick={() => void handleDelete()}
        title="Eliminar plazo"
        className="shrink-0 rounded p-1 text-text-secondary hover:text-danger transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}

// ──────────────────────────────────────────────────────────

function InhabilesEditor({
  inhabiles,
  onChanged,
}: {
  inhabiles: InhabilRange[];
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  const inputCls =
    'rounded-lg border border-border bg-bg-secondary px-2.5 py-1.5 text-xs outline-none focus:border-primary';

  const handleAdd = async () => {
    setError('');
    if (!from || !to || !label.trim()) {
      setError('Completá desde, hasta y una etiqueta.');
      return;
    }
    if (to < from) {
      setError('"Hasta" no puede ser anterior a "Desde".');
      return;
    }
    const cfg = await getPlazosConfig();
    cfg.customInhabiles.push({ from, to, label: label.trim() });
    cfg.customInhabiles.sort((a, b) => a.from.localeCompare(b.from));
    await savePlazosConfig(cfg);
    setFrom('');
    setTo('');
    setLabel('');
    await onChanged();
  };

  const handleRemove = async (range: InhabilRange) => {
    const cfg = await getPlazosConfig();
    cfg.customInhabiles = cfg.customInhabiles.filter(
      (r) => !(r.from === range.from && r.to === range.to && r.label === range.label)
    );
    await savePlazosConfig(cfg);
    await onChanged();
  };

  return (
    <div className="rounded-lg border border-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-3 py-2.5 text-sm text-text-secondary hover:text-text transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Ferias y días inhábiles ({inhabiles.length})
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          <p className="text-[10px] leading-relaxed text-text-secondary">
            Los feriados nacionales 2026–2027 y la feria de enero ya están
            cargados. Agregá acá la feria de julio, feriados puente por
            decreto y asuetos de tu jurisdicción — varían cada año.
          </p>

          {inhabiles.length > 0 && (
            <ul className="flex flex-col gap-1">
              {inhabiles.map((r) => (
                <li
                  key={`${r.from}-${r.to}-${r.label}`}
                  className="flex items-center justify-between gap-2 rounded bg-bg-secondary px-2 py-1.5 text-[11px]"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {r.label}{' '}
                    <span className="text-text-secondary">
                      ({formatDisplayDate(r.from)}
                      {r.from !== r.to ? ` – ${formatDisplayDate(r.to)}` : ''})
                    </span>
                  </span>
                  <button
                    onClick={() => void handleRemove(r)}
                    title="Quitar"
                    className="shrink-0 rounded p-0.5 text-text-secondary hover:text-danger transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-0.5 text-[10px] text-text-secondary">
              Desde
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-1 flex-col gap-0.5 text-[10px] text-text-secondary">
              Hasta
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          <input
            type="text"
            placeholder="Etiqueta (ej: Feria de julio 2026)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputCls}
          />
          <button
            onClick={() => void handleAdd()}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-bg-secondary px-3 py-1.5 text-xs text-text-secondary hover:bg-border transition-colors"
          >
            <Plus size={12} /> Agregar período inhábil
          </button>

          <p className="text-[9px] leading-relaxed text-text-secondary/70">
            El cálculo es orientativo y no reemplaza el cómputo manual del
            plazo ni la verificación de feriados de tu jurisdicción.
          </p>
        </div>
      )}
    </div>
  );
}
