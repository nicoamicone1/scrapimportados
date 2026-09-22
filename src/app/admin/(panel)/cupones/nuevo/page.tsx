import type { Metadata } from "next";

import { CouponForm } from "@/components/admin/coupons/CouponForm";
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
        <CouponForm id={null} initial={EMPTY_COUPON} initialProducts={[]} categories={categories} timezone={timezone} />
      </div>
    </>
  );
}
