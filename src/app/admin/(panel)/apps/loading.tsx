import { Skeleton } from "@/components/ui/display";
import { PageSkeleton } from "@/components/ui/skeletons";

/* Apps: una tarjeta grande por app (ilustración a la izquierda, detalle a la derecha). */
export default function Loading() {
  return (
    <PageSkeleton title="Apps" actions={0}>
      <div className="overflow-hidden rounded-adm border border-adm-border bg-adm-surface shadow-adm-card lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="h-56 bg-adm-sidebar-bg lg:h-auto" />
        <div className="p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-3 h-4 w-[70%]" />
          <Skeleton className="mt-2 h-3 w-[45%]" />
          <div className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="border-t border-adm-border pt-3">
                <Skeleton className="h-4 w-[60%]" />
                <Skeleton className="mt-2 h-3 w-[90%]" />
                <Skeleton className="mt-1.5 h-3 w-[70%]" />
              </div>
            ))}
          </div>
          <div className="mt-8 flex items-end justify-between border-t border-adm-border pt-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      </div>
    </PageSkeleton>
  );
}
