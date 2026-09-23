import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Avisos de stock" breadcrumb tabs={3} actions={0}>
      <TableSkeleton rows={10} cols={6} filters={false} />
    </PageSkeleton>
  );
}
