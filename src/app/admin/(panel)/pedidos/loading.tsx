import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Pedidos" tabs={5} actions={2}>
      <TableSkeleton rows={12} cols={8} filters={6} select />
    </PageSkeleton>
  );
}
