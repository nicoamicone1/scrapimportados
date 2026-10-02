import { Skeleton } from "@/components/ui/display";
import { PageSkeleton } from "@/components/ui/skeletons";

/* Cola: filtros + columnas por impresora con tarjetas. */
export default function Loading() {
  return (
    <PageSkeleton title="Cola de impresión" actions={0}>
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((c) => (
          <div key={c} className="w-[300px] shrink-0 space-y-2 rounded-adm border border-adm-border p-2">
            <Skeleton className="h-12" />
            {[0, 1, 2].slice(0, 3 - (c % 2)).map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ))}
      </div>
    </PageSkeleton>
  );
}
