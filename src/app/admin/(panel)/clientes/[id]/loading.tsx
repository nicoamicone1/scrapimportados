import { DetailSkeleton, PageSkeleton, StatsSkeleton } from "@/components/ui/skeletons";

/* Ficha de cliente: métricas + pedidos + datos. */
export default function Loading() {
  return (
    <PageSkeleton breadcrumb actions={2}>
      <StatsSkeleton count={4} />
      <div className="mt-4">
        <DetailSkeleton main={1} aside={2} />
      </div>
    </PageSkeleton>
  );
}
