import { CardsSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Exportar" section="system" breadcrumb actions={0}>
      <CardsSkeleton count={4} gridClassName="sm:grid-cols-2 xl:grid-cols-2" />
    </PageSkeleton>
  );
}
