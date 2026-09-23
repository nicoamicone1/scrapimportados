import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Carritos abandonados" breadcrumb tabs={5} actions={0}>
      <TableSkeleton rows={10} cols={5} filters={false} />
    </PageSkeleton>
  );
}
