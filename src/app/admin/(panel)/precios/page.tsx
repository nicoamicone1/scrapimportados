import { History } from "lucide-react";
import type { Metadata } from "next";

import { PlanGate } from "@/components/admin/PlanGate";
import { BulkPriceWizard } from "@/components/admin/pricing/BulkPriceWizard";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/display";
import { getCategoryOptions, getScopeFacets } from "@/lib/admin/pricing";

export const metadata: Metadata = { title: "Precios" };

export default async function PreciosPage() {
  const [categories, facets] = await Promise.all([getCategoryOptions(), getScopeFacets()]);
  return (
    <>
      <PageHeader
        title="Precios"
        description="Cambiá precios en masa con vista previa. Cada cambio queda en el historial y se puede deshacer."
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
        <BulkPriceWizard categories={categories} brands={facets.brands} tags={facets.tags} />
      </PlanGate>
    </>
  );
}
