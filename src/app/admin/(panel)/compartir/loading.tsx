import { Skeleton } from "@/components/ui/display";
import { DetailSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Compartir: panel del link + QR arriba, mensajes y consejos debajo. */
export default function Loading() {
  return (
    <PageSkeleton section="marketing" title="Compartí tu tienda" actions={0}>
      <div className="rounded-adm border border-adm-border bg-adm-surface p-5 shadow-adm-card">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-72 max-w-full" />
            <Skeleton className="h-3 w-96 max-w-full" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-40" />
            </div>
          </div>
          <Skeleton className="size-[168px]" />
        </div>
      </div>
      <div className="mt-4">
        <DetailSkeleton main={2} aside={1} />
      </div>
    </PageSkeleton>
  );
}
