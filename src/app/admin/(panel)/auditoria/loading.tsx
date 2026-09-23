import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Auditoría" actions={1}>
      <TableSkeleton rows={14} cols={5} filters={5} />
    </PageSkeleton>
  );
}
