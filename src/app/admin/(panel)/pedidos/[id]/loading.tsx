import { DetailSkeleton, PageSkeleton } from "@/components/ui/skeletons";

/* Detalle de pedido: productos, pagos, historial | cliente, entrega, notas. */
export default function Loading() {
  return (
    <PageSkeleton breadcrumb actions={3}>
      <DetailSkeleton main={3} aside={4} />
    </PageSkeleton>
  );
}
