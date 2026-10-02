import { Skeleton } from "@/components/ui/display";
import { FieldsSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Configuración del Taller 3D: paneles de ajustes + simulador a la derecha. */
export default function Loading() {
  return (
    <PageSkeleton title="Configuración" actions={0}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-adm border border-adm-border bg-adm-surface p-4 shadow-adm-card">
              <FieldsSkeleton fields={i === 1 ? 3 : 4} />
            </div>
          ))}
        </div>
        <div className="rounded-adm border border-adm-border bg-adm-surface p-4 shadow-adm-card">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-8 w-32" />
          <Skeleton className="mt-2 h-3 w-40" />
          <Skeleton className="mt-6 h-24 w-full" />
        </div>
      </div>
    </PageSkeleton>
  );
}
