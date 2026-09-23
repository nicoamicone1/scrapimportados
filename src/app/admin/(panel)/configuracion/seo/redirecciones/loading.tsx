import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Redirecciones 301" section="system" breadcrumb actions={1}>
      <TableSkeleton rows={8} cols={4} filters={1} />
    </PageSkeleton>
  );
}
