import { PageSkeleton } from "@/components/ui/skeletons";

/* Productos que se imprimen: tabla con costo y margen por unidad. */
export default function Loading() {
  return <PageSkeleton title="Productos que se imprimen" actions={1} variant="table" cols={6} rows={6} />;
}
