import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PromoStatusBadge, windowSummary } from "@/components/admin/pricing/shared";
import { PromotionActions } from "@/components/admin/promotions/PromotionActions";
import { PromotionForm } from "@/components/admin/promotions/PromotionForm";
import { PageHeader } from "@/components/ui/display";
import { getCategoryOptions, getPickerProductsByIds, getStoreTimezone } from "@/lib/admin/pricing";
import { getPromotion } from "@/lib/admin/promotions";
import { isoToZonedLocal } from "@/lib/pricing";
import type { PromotionValues } from "@/lib/schemas/promotion";

export const metadata: Metadata = { title: "Promoción" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PromocionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const promo = await getPromotion(id);
  if (!promo) notFound();

  const [categories, timezone, products] = await Promise.all([
    getCategoryOptions(),
    getStoreTimezone(),
    getPickerProductsByIds(promo.scope === "products" ? promo.productIds : []),
  ]);

  const initial: PromotionValues = {
    name: promo.name,
    type: promo.type,
    value: promo.value,
    scope: promo.scope,
    categoryIds: promo.categoryIds,
    productIds: promo.productIds,
    startsAt: isoToZonedLocal(promo.startsAt, timezone),
    endsAt: isoToZonedLocal(promo.endsAt, timezone),
    priority: promo.priority,
    stackable: promo.stackable,
    badgeLabel: promo.badgeLabel ?? "",
    isActive: promo.isActive,
  };

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {promo.name}
            <PromoStatusBadge status={promo.status} />
          </span>
        }
        description={windowSummary(promo.startsAt, promo.endsAt, timezone)}
        breadcrumb={[{ label: "Promociones", href: "/admin/promociones" }, { label: promo.name }]}
        actions={<PromotionActions id={promo.id} name={promo.name} isActive={promo.isActive} variant="header" />}
      />
      {/* key: al guardar (router.refresh) el form arranca de los datos nuevos. */}
      <PromotionForm
        key={promo.updatedAt}
        id={promo.id}
        initial={initial}
        initialProducts={products}
        categories={categories}
        timezone={timezone}
      />
    </>
  );
}
