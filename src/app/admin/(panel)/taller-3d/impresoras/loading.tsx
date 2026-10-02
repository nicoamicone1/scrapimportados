import { CardsSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Impresoras del Taller 3D: tarjetas con la cama dibujada. */
export default function Loading() {
  return (
    <PageSkeleton title="Impresoras" actions={0}>
      <CardsSkeleton count={3} gridClassName="sm:grid-cols-2 xl:grid-cols-3" />
    </PageSkeleton>
  );
}
