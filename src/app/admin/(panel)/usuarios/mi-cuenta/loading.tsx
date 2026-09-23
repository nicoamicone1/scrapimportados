import { FormSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Mi cuenta" breadcrumb actions={0}>
      <FormSkeleton split sections={2} fields={2} />
    </PageSkeleton>
  );
}
