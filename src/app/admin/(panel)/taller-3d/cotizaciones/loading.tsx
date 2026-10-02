import { PageSkeleton } from "@/components/ui/skeletons";

/* Cotizaciones: pestañas por estado + tabla. */
export default function Loading() {
  return <PageSkeleton title="Cotizaciones" tabs={6} actions={1} variant="table" cols={6} />;
}
