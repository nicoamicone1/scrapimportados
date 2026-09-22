import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CouponActions } from "@/components/admin/coupons/CouponActions";
import { CouponForm } from "@/components/admin/coupons/CouponForm";
import { CouponTester } from "@/components/admin/coupons/CouponTester";
import { CouponStatusBadge, discountLabel } from "@/components/admin/pricing/shared";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/display";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { getCoupon, getCouponRedemptions } from "@/lib/admin/coupons";
import { getCategoryOptions, getPickerProductsByIds, getStoreTimezone } from "@/lib/admin/pricing";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/money";
import { isoToZonedLocal } from "@/lib/pricing";
import type { CouponValues } from "@/lib/schemas/coupon";

export const metadata: Metadata = { title: "Cupón" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CuponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const coupon = await getCoupon(id);
  if (!coupon) notFound();

  const [categories, timezone, products, redemptions] = await Promise.all([
    getCategoryOptions(),
    getStoreTimezone(),
    getPickerProductsByIds(coupon.scope === "products" ? coupon.productIds : []),
    getCouponRedemptions(coupon.id),
  ]);

  const initial: CouponValues = {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minSubtotal: coupon.minSubtotal,
    maxUses: coupon.maxUses,
    maxUsesPerCustomer: coupon.maxUsesPerCustomer,
    firstOrderOnly: coupon.firstOrderOnly,
    startsAt: isoToZonedLocal(coupon.startsAt, timezone),
    endsAt: isoToZonedLocal(coupon.endsAt, timezone),
    scope: coupon.scope,
    categoryIds: coupon.categoryIds,
    productIds: coupon.productIds,
    isActive: coupon.isActive,
  };

  const uses = `${formatNumber(coupon.usesCount)} ${coupon.usesCount === 1 ? "uso" : "usos"}${
    coupon.maxUses != null ? ` de ${formatNumber(coupon.maxUses)}` : ""
  }`;

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono">{coupon.code}</span>
            <CouponStatusBadge status={coupon.status} />
          </span>
        }
        description={`${discountLabel(coupon.type, coupon.value)} · ${uses}`}
        breadcrumb={[{ label: "Cupones", href: "/admin/cupones" }, { label: coupon.code }]}
        actions={<CouponActions id={coupon.id} code={coupon.code} isActive={coupon.isActive} usesCount={coupon.usesCount} variant="header" />}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <CouponForm
            key={JSON.stringify(initial)}
            id={coupon.id}
            initial={initial}
            initialProducts={products}
            categories={categories}
            timezone={timezone}
          />
        </div>
        <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <CouponTester code={coupon.code} />
          <Card>
            <CardHeader title="Usos" description={redemptions.length ? `${formatNumber(redemptions.length)} registrados` : undefined} />
            <Table containerClassName="rounded-none border-0 max-h-[420px]">
              <THead>
                <tr>
                  <TH>Fecha</TH>
                  <TH>Cliente</TH>
                  <TH numeric>Pedido</TH>
                </tr>
              </THead>
              <TBody>
                {redemptions.length === 0 ? (
                  <TableEmpty colSpan={3} title="Todavía no se usó" description="Cuando un cliente compre con este cupón, el pedido aparece acá." />
                ) : (
                  redemptions.map((r) => (
                    <TR key={r.id}>
                      <TD className="whitespace-nowrap">
                        <time suppressHydrationWarning dateTime={r.createdAt} title={formatDateTime(r.createdAt, timezone)}>
                          {formatRelative(r.createdAt)}
                        </time>
                      </TD>
                      <TD className="max-w-[140px] truncate" title={r.customerEmail}>
                        {r.customerEmail}
                      </TD>
                      <TD numeric>
                        {r.orderId ? (
                          <Link href={`/admin/pedidos/${r.orderId}`} className="text-adm-accent hover:underline">
                            {r.orderNumber != null ? `#${r.orderNumber}` : "Ver"}
                          </Link>
                        ) : (
                          <span className="text-adm-fg-muted">—</span>
                        )}
                        {r.orderTotal != null ? <span className="block text-xs text-adm-fg-muted">{formatMoney(r.orderTotal)}</span> : null}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </Card>
        </div>
      </div>
    </>
  );
}
