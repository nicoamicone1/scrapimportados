import type { Metadata } from "next";

import { PromotionForm } from "@/components/admin/promotions/PromotionForm";
import { PageHeader } from "@/components/ui/display";
import { getCategoryOptions, getStoreTimezone } from "@/lib/admin/pricing";
import { EMPTY_PROMOTION } from "@/lib/schemas/promotion";

export const metadata: Metadata = { title: "Nueva promoción" };

export default async function NuevaPromocionPage() {
  const [categories, timezone] = await Promise.all([getCategoryOptions(), getStoreTimezone()]);
  return (
    <>
      <PageHeader
        title="Nueva promoción"
        breadcrumb={[{ label: "Promociones", href: "/admin/promociones" }, { label: "Nueva" }]}
      />
      <PromotionForm id={null} initial={EMPTY_PROMOTION} initialProducts={[]} categories={categories} timezone={timezone} />
    </>
  );
}
