import { History } from "lucide-react";
import type { Metadata } from "next";

import { PlanGate } from "@/components/admin/PlanGate";
import { BulkPriceWizard, type BulkPriceWizardProps } from "@/components/admin/pricing/BulkPriceWizard";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/display";
import { getCategoryOptions, getPickerProductsByIds, getScopeFacets } from "@/lib/admin/pricing";

export const metadata: Metadata = { title: "Precios" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PreciosPage({ searchParams }: PageProps<"/admin/precios">) {
  const sp = await searchParams;
  // Atajos desde la lista de productos (?productos=id,id) y desde categorías (?categoria=id).
  const productIds = first(sp.productos)
    .split(",")
    .filter((id) => UUID.test(id))
    .slice(0, 100);
  const categoryId = UUID.test(first(sp.categoria)) ? first(sp.categoria) : null;
  const [categories, facets, pickedProducts] = await Promise.all([
    getCategoryOptions(),
    getScopeFacets(),
    getPickerProductsByIds(productIds),
  ]);
  let initialScope: BulkPriceWizardProps["initialScope"];
  if (pickedProducts.length) initialScope = { kind: "products", products: pickedProducts };
  else if (categoryId && categories.some((c) => c.id === categoryId)) initialScope = { kind: "categories", categoryIds: [categoryId] };
  return (
    <>
      <PageHeader
        title="Precios"
        description="Subí o bajá precios de todo el catálogo o de una parte, mirá cómo quedan y aplicá. Cada cambio queda en el historial y se deshace."
        actions={
          <ButtonLink href="/admin/precios/historial" icon={<History aria-hidden />}>
            Historial de cambios
          </ButtonLink>
        }
      />
      <PlanGate
        feature="pricing.bulk"
        description="Aumentos por porcentaje, redondeos y ofertas sobre todo el catálogo o una parte, con vista previa y deshacer."
      >
        <BulkPriceWizard categories={categories} brands={facets.brands} tags={facets.tags} initialScope={initialScope} />
      </PlanGate>
    </>
  );
}
