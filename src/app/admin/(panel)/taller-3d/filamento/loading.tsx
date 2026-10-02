import { Skeleton } from "@/components/ui/display";
import { PageSkeleton } from "@/components/ui/skeletons";

/* Filamento del Taller 3D: estante de bobinas por material. */
export default function Loading() {
  return (
    <PageSkeleton title="Filamento" actions={2}>
      <div className="space-y-4">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="rounded-adm border border-adm-border bg-adm-surface shadow-adm-card">
            <div className="flex items-center gap-3 border-b border-adm-border px-4 py-3">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-4 w-32" />
            </div>
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j} className="flex items-center gap-4 border-b border-adm-border px-4 py-3 last:border-0">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-4 w-28" />
                <div className="flex gap-2">
                  {Array.from({ length: 3 - (j % 2) }, (_, k) => (
                    <Skeleton key={k} className="h-[104px] w-[104px]" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </PageSkeleton>
  );
}
