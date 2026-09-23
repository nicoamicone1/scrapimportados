import { CardsSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Envíos: zonas (lista con mapa) y puntos de retiro. */
export default function Loading() {
  return (
    <PageSkeleton title="Envíos" tabs={2} actions={2}>
      <CardsSkeleton count={6} gridClassName="sm:grid-cols-2 xl:grid-cols-2" />
    </PageSkeleton>
  );
}
