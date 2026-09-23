import { FormSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton breadcrumb actions={2}>
      <FormSkeleton sections={3} fields={4} aside />
    </PageSkeleton>
  );
}
