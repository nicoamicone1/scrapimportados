import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Movimientos de stock" breadcrumb actions={0}>
      <TableSkeleton rows={14} cols={6} filters={3} />
    </PageSkeleton>
  );
}
