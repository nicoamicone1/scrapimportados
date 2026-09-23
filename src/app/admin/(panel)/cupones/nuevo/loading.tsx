import { FormSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Nuevo cupón" breadcrumb actions={0}>
      <FormSkeleton sections={3} fields={4} />
    </PageSkeleton>
  );
}
