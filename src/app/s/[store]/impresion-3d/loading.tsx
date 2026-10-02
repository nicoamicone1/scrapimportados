/* Skeleton del cotizador (spec §14.5): encabezado + la cama donde se sueltan los archivos. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="store-container py-[var(--space-section-sm)]">
      <span className="sr-only">Cargando el cotizador…</span>
      <div aria-hidden>
        <div className="sk h-3 w-24 rounded-sm" />
        <div className="sk mt-6 h-3 w-36 rounded-sm" />
        <div className="sk mt-3 h-8 w-64 max-w-full rounded-sm" />
        <div className="sk mt-3 h-4 w-full max-w-xl rounded-sm" />
        <div className="sk mt-8 h-[280px] w-full rounded-lg sm:h-[340px]" />
      </div>
    </div>
  );
}
