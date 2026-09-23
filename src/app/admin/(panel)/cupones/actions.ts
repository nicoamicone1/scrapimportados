"use server";

import { z } from "zod";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { getStoreTimezone } from "@/lib/admin/pricing";
import { logAudit, shallowDiff } from "@/lib/audit";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { assertFeature } from "@/lib/plans";
import { assertUsage } from "@/lib/plans/server";
import { zonedLocalToIso } from "@/lib/pricing";
import { couponSchema, testCouponSchema, type CouponValues } from "@/lib/schemas/coupon";
import type { Json } from "@/lib/supabase/database.types";

/*
 * Cupones (agente C). Los cupones NO son de lectura pública (se validan con
 * la RPC `validate_coupon`), así que no hay tag de caché que revalidar: el
 * storefront siempre pregunta en vivo.
 * Plan: `marketing.coupons` para crear/editar/duplicar/activar y el límite
 * `coupons` al crear o duplicar. El código es único POR TIENDA.
 */

const uuid = z.string().uuid();

function toRow(values: CouponValues, timeZone: string) {
  return {
    code: values.code,
    type: values.type,
    value: values.value,
    min_subtotal: values.minSubtotal,
    max_uses: values.maxUses,
    max_uses_per_customer: values.maxUsesPerCustomer,
    first_order_only: values.firstOrderOnly,
    starts_at: zonedLocalToIso(values.startsAt, timeZone),
    ends_at: zonedLocalToIso(values.endsAt, timeZone),
    scope: values.scope,
    category_ids: values.scope === "categories" ? values.categoryIds : [],
    product_ids: values.scope === "products" ? values.productIds : [],
    is_active: values.isActive,
  };
}

const DUPLICATE_CODE = "Ya existe un cupón con ese código.";

export async function saveCoupon(id: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    assertFeature(ctx, "marketing.coupons");
    const parsed = couponSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const row = toRow(parsed.data, await getStoreTimezone());

    if (id === null || id === undefined) {
      await assertUsage(ctx, "coupons");
      const { data, error } = await ctx.supabase
        .from("coupons")
        .insert({ ...row, store_id: ctx.store.id })
        .select("id")
        .single();
      if (error?.code === "23505") return fail(DUPLICATE_CODE, { code: [DUPLICATE_CODE] });
      if (error || !data) {
        console.error("[cupones] insert", error?.message);
        return fail("No se pudo crear el cupón. Probá de nuevo.");
      }
      await logAudit(ctx, {
        action: "coupon.create",
        entity: "coupon",
        entityId: data.id,
        summary: `Creó el cupón ${row.code}`,
        diff: row as unknown as Json,
      });
      return ok({ id: data.id });
    }

    const cid = uuid.safeParse(id);
    if (!cid.success) return fail("Cupón inválido.");
    const { data: before } = await ctx.supabase
      .from("coupons")
      .select("*")
      .eq("store_id", ctx.store.id)
      .eq("id", cid.data)
      .maybeSingle();
    if (!before) return fail("El cupón ya no existe.");
    const { error } = await ctx.supabase.from("coupons").update(row).eq("store_id", ctx.store.id).eq("id", cid.data);
    if (error?.code === "23505") return fail(DUPLICATE_CODE, { code: [DUPLICATE_CODE] });
    if (error) {
      console.error("[cupones] update", error.message);
      return fail("No se pudo guardar el cupón. Probá de nuevo.");
    }
    const beforeSubset = Object.fromEntries(Object.keys(row).map((k) => [k, before[k as keyof typeof before] as Json]));
    await logAudit(ctx, {
      action: "coupon.update",
      entity: "coupon",
      entityId: cid.data,
      summary: `Editó el cupón ${row.code}`,
      diff: shallowDiff(beforeSubset, row as unknown as Record<string, Json>),
    });
    return ok({ id: cid.data });
  });
}

async function loadCoupon(ctx: AdminContext, id: unknown) {
  const cid = uuid.safeParse(id);
  if (!cid.success) return null;
  const { data } = await ctx.supabase.from("coupons").select("*").eq("store_id", ctx.store.id).eq("id", cid.data).maybeSingle();
  return data;
}

export async function setCouponActive(id: unknown, isActive: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const coupon = await loadCoupon(ctx, id);
    if (!coupon) return fail("El cupón ya no existe.");
    const next = isActive === true;
    if (next) assertFeature(ctx, "marketing.coupons");
    const { error } = await ctx.supabase
      .from("coupons")
      .update({ is_active: next })
      .eq("store_id", ctx.store.id)
      .eq("id", coupon.id);
    if (error) return fail("No se pudo actualizar. Probá de nuevo.");
    await logAudit(ctx, {
      action: next ? "coupon.activate" : "coupon.pause",
      entity: "coupon",
      entityId: coupon.id,
      summary: `${next ? "Activó" : "Pausó"} el cupón ${coupon.code}`,
    });
    return ok();
  });
}

export async function duplicateCoupon(id: unknown): Promise<ActionResult<{ id: string; code: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    assertFeature(ctx, "marketing.coupons");
    const coupon = await loadCoupon(ctx, id);
    if (!coupon) return fail("El cupón ya no existe.");
    await assertUsage(ctx, "coupons");

    // Código libre: CODIGO-COPIA, CODIGO-COPIA2, …
    const base = `${coupon.code.slice(0, 33)}-COPIA`;
    const { data: taken } = await ctx.supabase
      .from("coupons")
      .select("code")
      .eq("store_id", ctx.store.id)
      .like("code", `${base}%`);
    const used = new Set((taken ?? []).map((c) => c.code));
    let code = base;
    for (let n = 2; used.has(code); n++) code = `${base}${n}`;

    const copy = {
      store_id: ctx.store.id,
      code,
      type: coupon.type,
      value: coupon.value,
      min_subtotal: coupon.min_subtotal,
      max_uses: coupon.max_uses,
      max_uses_per_customer: coupon.max_uses_per_customer,
      first_order_only: coupon.first_order_only,
      starts_at: coupon.starts_at,
      ends_at: coupon.ends_at,
      scope: coupon.scope,
      category_ids: coupon.category_ids,
      product_ids: coupon.product_ids,
      is_active: false,
    };
    const { data, error } = await ctx.supabase.from("coupons").insert(copy).select("id").single();
    if (error || !data) return fail("No se pudo duplicar. Probá de nuevo.");
    await logAudit(ctx, {
      action: "coupon.duplicate",
      entity: "coupon",
      entityId: data.id,
      summary: `Duplicó el cupón ${coupon.code} como ${code}`,
    });
    return ok({ id: data.id, code });
  });
}

export async function deleteCoupon(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const coupon = await loadCoupon(ctx, id);
    if (!coupon) return fail("El cupón ya no existe.");
    const { count } = await ctx.supabase
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("store_id", ctx.store.id)
      .eq("coupon_id", coupon.id);
    if (coupon.uses_count > 0 || (count ?? 0) > 0) {
      return fail("Este cupón ya se usó: desactivalo en lugar de borrarlo (así se conserva el historial).");
    }
    const { error } = await ctx.supabase.from("coupons").delete().eq("store_id", ctx.store.id).eq("id", coupon.id);
    if (error) return fail("No se pudo borrar. Probá de nuevo.");
    await logAudit(ctx, {
      action: "coupon.delete",
      entity: "coupon",
      entityId: coupon.id,
      summary: `Borró el cupón ${coupon.code}`,
      diff: coupon as unknown as Json,
    });
    return ok();
  });
}

export interface CouponTestResult {
  valid: boolean;
  reason: string | null;
  discount: number;
  freeShipping: boolean;
  eligibleSubtotal: number;
  /** Si el cupón tiene alcance, con qué producto se probó. */
  testedWith: string | null;
  totalAfter: number;
}

/** "Probar cupón": llama a la RPC pública `validate_coupon` (la misma que usa el checkout). */
export async function testCoupon(input: unknown): Promise<ActionResult<CouponTestResult>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = testCouponSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { code, subtotal, email } = parsed.data;

    // Con alcance acotado, se prueba con un producto que esté dentro.
    const { data: coupon } = await ctx.supabase
      .from("coupons")
      .select("scope, category_ids, product_ids")
      .eq("store_id", ctx.store.id)
      .eq("code", code)
      .maybeSingle();
    let items: { product_id: string; qty: number; unit_price: number }[] = [];
    let testedWith: string | null = null;
    if (coupon && coupon.scope !== "all") {
      let product: { id: string; name: string } | null = null;
      if (coupon.scope === "products" && coupon.product_ids.length) {
        const { data } = await ctx.supabase
          .from("products")
          .select("id, name")
          .eq("store_id", ctx.store.id)
          .in("id", coupon.product_ids.slice(0, 50))
          .limit(1);
        product = data?.[0] ?? null;
      } else if (coupon.scope === "categories" && coupon.category_ids.length) {
        const { data } = await ctx.supabase
          .from("products")
          .select("id, name, product_categories!inner(category_id)")
          .eq("store_id", ctx.store.id)
          .in("product_categories.category_id", coupon.category_ids)
          .limit(1);
        product = data?.[0] ? { id: data[0].id, name: data[0].name } : null;
      }
      if (product) {
        items = [{ product_id: product.id, qty: 1, unit_price: subtotal }];
        testedWith = product.name;
      }
    }

    const { data, error } = await ctx.supabase.rpc("validate_coupon", {
      p_store_id: ctx.store.id,
      p_code: code,
      p_subtotal: subtotal,
      p_items: items as unknown as Json,
      p_email: email || undefined,
    });
    if (error) {
      console.error("[cupones] test", error.message);
      return fail("No se pudo probar el cupón.");
    }
    const r = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    const valid = r.valid === true;
    const discount = valid ? Number(r.discount) || 0 : 0;
    return ok({
      valid,
      reason: valid ? null : typeof r.reason === "string" ? r.reason : "El cupón no es válido.",
      discount,
      freeShipping: valid && r.free_shipping === true,
      eligibleSubtotal: valid ? Number(r.eligible_subtotal) || 0 : 0,
      testedWith,
      totalAfter: Math.max(subtotal - discount, 0),
    });
  });
}
