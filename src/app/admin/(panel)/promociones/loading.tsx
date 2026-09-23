import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Promociones" tabs={4} actions={1}>
      <TableSkeleton rows={8} cols={6} filters={0} />
    </PageSkeleton>
  );
}
