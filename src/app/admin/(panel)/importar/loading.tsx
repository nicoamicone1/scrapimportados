import { CardsSkeleton, PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";

/* Importar: orígenes (web, CSV, plataforma) + historial de importaciones. */
export default function Loading() {
  return (
    <PageSkeleton title="Importar" actions={1}>
      <CardsSkeleton count={3} />
      <TableSkeleton className="mt-6" rows={5} cols={6} filters={false} />
    </PageSkeleton>
  );
}
