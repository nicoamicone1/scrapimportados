import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Productos" tabs={4} actions={2}>
      <TableSkeleton rows={12} cols={6} filters={4} thumb select />
    </PageSkeleton>
  );
}
