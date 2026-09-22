import type { Metadata } from "next";

import { PriceBatchHistory } from "@/components/admin/pricing/PriceBatchHistory";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { Pagination } from "@/components/ui/Pagination";
import { BATCHES_PER_PAGE, listPriceBatches } from "@/lib/admin/pricing";
import { formatNumber } from "@/lib/money";

export const metadata: Metadata = { title: "Historial de precios" };

export default async function HistorialPreciosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawPage = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const { rows, total } = await listPriceBatches(page);

  return (
    <>
      <PageHeader
        title="Historial de cambios de precios"
        description={
          total
            ? `${formatNumber(total)} ${total === 1 ? "cambio masivo" : "cambios masivos"}. Deshacer restaura sólo las variantes que no se tocaron después.`
            : undefined
        }
        breadcrumb={[{ label: "Precios", href: "/admin/precios" }, { label: "Historial" }]}
        actions={
          <ButtonLink href="/admin/precios" variant="primary">
            Nuevo cambio masivo
          </ButtonLink>
        }
      />
      {total === 0 ? (
        <EmptyState
          title="Todavía no hiciste cambios masivos"
          description="Cuando apliques un aumento o una oferta desde Precios, lo vas a ver acá con la opción de deshacerlo."
          actions={
            <ButtonLink href="/admin/precios" variant="primary">
              Hacer un cambio masivo
            </ButtonLink>
          }
        />
      ) : (
        <>
          <PriceBatchHistory rows={rows} />
          <Pagination page={page} perPage={BATCHES_PER_PAGE} total={total} />
        </>
      )}
    </>
  );
}
