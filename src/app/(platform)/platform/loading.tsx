import { AccountPageSkeleton, StatsSkeleton, TableSkeleton } from "@/components/ui/skeletons";

/* Plataforma: franja de métricas globales + buscador + tabla de tiendas. */
export default function Loading() {
  return (
    <AccountPageSkeleton title="Plataforma">
      <StatsSkeleton count={6} />
      <TableSkeleton className="mt-6" rows={10} cols={7} filters={0} />
    </AccountPageSkeleton>
  );
}
