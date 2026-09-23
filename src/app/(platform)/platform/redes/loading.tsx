import { Skeleton } from "@/components/ui/display";
import { AccountPageSkeleton } from "@/components/ui/skeletons";

/* Redes: pestañas de formato + tarjetas de pieza (placas a la izquierda, copy a la derecha). */
export default function Loading() {
  return (
    <AccountPageSkeleton title="Redes">
      <div className="flex gap-5 border-b border-adm-border pb-2">
        <Skeleton className="h-3.5 w-10" />
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3.5 w-32" />
      </div>
      <Skeleton className="mt-8 h-4 w-32" />
      <div className="mt-3 space-y-4">
        {[2, 1, 3].map((slides, i) => (
          <div key={i} className="rounded-adm border border-adm-border bg-adm-surface">
            <div className="flex gap-3 border-b border-adm-border px-4 py-3">
              <Skeleton className="h-3.5 w-8" />
              <Skeleton className="h-3.5 w-56" />
            </div>
            <div className="flex flex-col gap-5 p-4 lg:flex-row">
              <div className="flex min-w-0 gap-3 overflow-hidden lg:flex-1">
                {Array.from({ length: slides }, (_, s) => (
                  <Skeleton key={s} className="size-[270px] shrink-0" />
                ))}
              </div>
              <div className="space-y-2 lg:w-[360px]">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="mt-3 h-3 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-[80%]" />
                <Skeleton className="mt-3 h-7 w-28" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </AccountPageSkeleton>
  );
}
