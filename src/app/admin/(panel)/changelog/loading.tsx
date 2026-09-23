import { ListSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Changelog" actions={0}>
      <ListSkeleton rows={6} />
    </PageSkeleton>
  );
}
