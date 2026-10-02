import { DetailSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Detalle de cotización: piezas con visor | precio y cliente. */
export default function Loading() {
  return (
    <PageSkeleton breadcrumb actions={0}>
      <DetailSkeleton main={2} aside={2} />
    </PageSkeleton>
  );
}
