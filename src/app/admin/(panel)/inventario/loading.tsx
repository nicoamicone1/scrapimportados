import { PageSkeleton, StatsSkeleton, TableSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Inventario" tabs={4} actions={1}>
      <StatsSkeleton count={4} />
      <TableSkeleton className="mt-4" rows={12} cols={6} filters={2} thumb />
    </PageSkeleton>
  );
}
