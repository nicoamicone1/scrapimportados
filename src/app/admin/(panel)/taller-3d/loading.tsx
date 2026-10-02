import { ListSkeleton, PageSkeleton, StatsSkeleton } from "@/components/ui/skeletons";

/* Resumen del Taller 3D: franja de métricas + ocupación y vencimientos (8) | cotizaciones, filamento y fallas (4). */
export default function Loading() {
  return (
    <PageSkeleton title="Resumen del taller" actions={2}>
      <div className="space-y-5">
        <StatsSkeleton />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <ListSkeleton rows={3} />
            <ListSkeleton rows={4} />
          </div>
          <div className="min-w-0 space-y-4">
            <ListSkeleton rows={3} />
            <ListSkeleton rows={3} />
          </div>
        </div>
      </div>
    </PageSkeleton>
  );
}
