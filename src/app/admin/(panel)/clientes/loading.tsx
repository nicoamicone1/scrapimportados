import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Clientes" actions={1}>
      <TableSkeleton rows={12} cols={6} filters={1} />
    </PageSkeleton>
  );
}
