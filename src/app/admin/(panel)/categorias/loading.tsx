import { ListSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Categorías" actions={1}>
      <ListSkeleton rows={10} title={false} />
    </PageSkeleton>
  );
}
