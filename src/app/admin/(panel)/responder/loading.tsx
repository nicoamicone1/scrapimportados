import { Skeleton } from "@/components/ui/display";
import { PageSkeleton } from "@/components/ui/skeletons";

/* Responder: buscador con resultados a la izquierda, respuestas fijas a la derecha. */
export default function Loading() {
  return (
    <PageSkeleton section="orders" title="Responder" actions={0}>
      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="rounded-adm-lg border border-adm-border bg-adm-surface lg:col-span-7">
          <div className="space-y-2 border-b border-adm-border px-4 py-3.5 sm:px-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <div className="space-y-2 p-4 sm:p-5">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-11 w-full" />
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 border-t border-adm-border px-4 py-2.5 sm:px-5">
              <Skeleton className="size-11 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-48 max-w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4 lg:col-span-5">
          <Skeleton className="h-4 w-48" />
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="space-y-3 rounded-adm-lg border border-adm-border bg-adm-surface p-4 sm:p-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageSkeleton>
  );
}
