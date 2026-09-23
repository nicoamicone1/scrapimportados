import "server-only";

import { requireAdmin } from "@/lib/auth";
import { couponStatus, type CouponStatus } from "@/lib/pricing";
import type { CouponType } from "@/lib/schemas/coupon";
import type { PromoScope } from "@/lib/schemas/promotion";

/*
 * Lecturas de cupones del admin (agente C).
 */

export const COUPONS_PER_PAGE = 50;

export const COUPON_STATUS_PARAM: Record<string, CouponStatus> = {
  activos: "active",
  programados: "scheduled",
  vencidos: "expired",
  pausados: "paused",
  agotados: "exhausted",
};

export interface AdminCoupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minSubtotal: number | null;
  maxUses: number | null;
  usesCount: number;
  maxUsesPerCustomer: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  scope: PromoScope;
  categoryIds: string[];
  productIds: string[];
  firstOrderOnly: boolean;
  status: CouponStatus;
  createdAt: string;
}

const SELECT =
  "id, code, type, value, min_subtotal, max_uses, uses_count, max_uses_per_customer, starts_at, ends_at, is_active, scope, category_ids, product_ids, first_order_only, created_at";

interface CouponRowDb {
  id: string;
  code: string;
  type: string;
  value: number;
  min_subtotal: number | null;
  max_uses: number | null;
  uses_count: number;
  max_uses_per_customer: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  scope: string;
  category_ids: string[];
  product_ids: string[];
  first_order_only: boolean;
  created_at: string;
}

function toCoupon(r: CouponRowDb, now: Date): AdminCoupon {
  const base = {
    id: r.id,
    code: r.code,
    type: (r.type === "fixed" || r.type === "free_shipping" ? r.type : "percent") as CouponType,
    value: Number(r.value),
    minSubtotal: r.min_subtotal === null ? null : Number(r.min_subtotal),
    maxUses: r.max_uses,
    usesCount: r.uses_count,
    maxUsesPerCustomer: r.max_uses_per_customer,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    isActive: r.is_active,
    scope: (r.scope === "categories" || r.scope === "products" ? r.scope : "all") as PromoScope,
    categoryIds: r.category_ids ?? [],
    productIds: r.product_ids ?? [],
    firstOrderOnly: r.first_order_only,
    createdAt: r.created_at,
  };
  return { ...base, status: couponStatus(base, now) };
}

export interface CouponListResult {
  rows: AdminCoupon[];
  total: number;
  counts: Record<CouponStatus | "all", number>;
}

export async function listCoupons(filters: { q: string; status: CouponStatus | null; page: number }): Promise<CouponListResult> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase
    .from("coupons")
    .select(SELECT)
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const now = new Date();
  const all = (data ?? []).map((r) => toCoupon(r, now));
  const counts: CouponListResult["counts"] = { all: all.length, active: 0, scheduled: 0, expired: 0, paused: 0, exhausted: 0 };
  for (const c of all) counts[c.status]++;
  const q = filters.q.trim().toUpperCase();
  const filtered = all.filter((c) => (!filters.status || c.status === filters.status) && (!q || c.code.includes(q)));
  const from = (filters.page - 1) * COUPONS_PER_PAGE;
  return { rows: filtered.slice(from, from + COUPONS_PER_PAGE), total: filtered.length, counts };
}

export async function getCoupon(id: string): Promise<AdminCoupon | null> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase.from("coupons").select(SELECT).eq("store_id", store.id).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCoupon(data, new Date()) : null;
}

export interface CouponRedemption {
  id: string;
  createdAt: string;
  customerEmail: string;
  orderId: string | null;
  orderNumber: number | null;
  orderTotal: number | null;
}

export async function getCouponRedemptions(couponId: string): Promise<CouponRedemption[]> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase
    .from("coupon_redemptions")
    .select("id, created_at, customer_email, order_id, orders(number, total)")
    .eq("store_id", store.id)
    .eq("coupon_id", couponId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    customerEmail: r.customer_email,
    orderId: r.order_id,
    orderNumber: r.orders?.number ?? null,
    orderTotal: r.orders ? Number(r.orders.total) : null,
  }));
}
