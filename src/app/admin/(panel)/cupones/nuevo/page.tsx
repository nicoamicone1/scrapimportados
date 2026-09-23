import type { Metadata } from "next";

import { CouponForm } from "@/components/admin/coupons/CouponForm";
import { PlanGate } from "@/components/admin/PlanGate";
import { PageHeader } from "@/components/ui/display";
import { getCategoryOptions, getStoreTimezone } from "@/lib/admin/pricing";
import { EMPTY_COUPON } from "@/lib/schemas/coupon";

export const metadata: Metadata = { title: "Nuevo cupón" };

export default async function NuevoCuponPage() {
  const [categories, timezone] = await Promise.all([getCategoryOptions(), getStoreTimezone()]);
  return (
    <>
      <PageHeader title="Nuevo cupón" breadcrumb={[{ label: "Cupones", href: "/admin/cupones" }, { label: "Nuevo" }]} />
      <div className="max-w-3xl">
        <PlanGate feature="marketing.coupons" description="Códigos de descuento con compra mínima, límite de usos y vigencia.">
          <CouponForm id={null} initial={EMPTY_COUPON} initialProducts={[]} categories={categories} timezone={timezone} />
        </PlanGate>
      </div>
    </>
  );
}
