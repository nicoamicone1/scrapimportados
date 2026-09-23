import { Skeleton } from "@/components/ui/display";
import { SkeletonRegion } from "@/components/ui/skeletons";

/* Editor de páginas (pantalla completa): barra superior + bloques | preview | ajustes. */
export default function Loading() {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-adm-bg">
      <SkeletonRegion label="Cargando el editor…" className="flex min-h-0 flex-1 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
        <div className="flex h-12 items-center gap-3 border-b border-adm-border bg-adm-surface px-4">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-20" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <div className="hidden space-y-2 border-r border-adm-border bg-adm-surface p-3 md:block">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
          <div className="p-6">
            <Skeleton className="mx-auto h-full max-w-[1100px]" />
          </div>
          <div className="hidden space-y-4 border-l border-adm-border bg-adm-surface p-4 xl:block">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      </SkeletonRegion>
    </div>
  );
}
