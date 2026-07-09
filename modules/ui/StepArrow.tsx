/**
 * Indicador de paso "a prueba de olvidos": círculo rojo numerado + flecha
 * apuntando al control que hay que usar. Se usa en el onboarding y en el
 * asistente Importar todo para guiar 1 → 2 → 3 sin ambigüedad.
 */

export default function StepArrow({ n }: { n: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[13px] font-extrabold text-white shadow">
        {n}
      </span>
      <span className="text-lg font-extrabold leading-none text-red-600">
        →
      </span>
    </span>
  );
}
