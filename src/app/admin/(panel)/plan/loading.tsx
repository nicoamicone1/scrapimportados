import { CardsSkeleton, FormSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Plan: plan actual + uso vs. límites (arriba) y comparación de planes. */
export default function Loading() {
  return (
    <PageSkeleton title="Plan" actions={0}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <FormSkeleton sections={1} fields={3} />
        <FormSkeleton sections={1} fields={4} />
      </div>
      <div className="mt-6">
        <CardsSkeleton count={4} gridClassName="sm:grid-cols-2 xl:grid-cols-4" />
      </div>
    </PageSkeleton>
  );
}
