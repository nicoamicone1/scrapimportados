import { PageSkeleton } from "@/components/ui/skeletons";

/* Dashboard: saludo + franja de números + gráfico + listas. */
export default function Loading() {
  return (
    <PageSkeleton variant="dashboard" tabs={3} actions={2} />
  );
}
