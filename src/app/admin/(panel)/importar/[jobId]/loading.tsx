import { PageSkeleton, StatsSkeleton, TableSkeleton } from "@/components/ui/skeletons";

/* Detalle de importación: progreso + ítems detectados. */
export default function Loading() {
  return (
    <PageSkeleton breadcrumb actions={2}>
      <StatsSkeleton count={4} />
      <TableSkeleton className="mt-4" rows={10} cols={6} filters={2} thumb select />
    </PageSkeleton>
  );
}
