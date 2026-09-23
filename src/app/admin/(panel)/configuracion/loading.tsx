import { CardsSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Skeleton de carga (spec §14.5): imita la página real. */
export default function Loading() {
  return (
    <PageSkeleton title="Configuración" actions={0}>
      <CardsSkeleton count={6} />
    </PageSkeleton>
  );
}
