import { FormSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="SEO e integraciones" section="system" breadcrumb actions={1}>
      <FormSkeleton split sections={3} fields={3} />
    </PageSkeleton>
  );
}
