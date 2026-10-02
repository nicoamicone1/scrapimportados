import { PageSkeleton } from "@/components/ui/skeletons";

/* Inicio: título + resumen, "Para hacer", últimos pedidos, stock y números del período. */
export default function Loading() {
  return <PageSkeleton variant="dashboard" actions={2} />;
}
