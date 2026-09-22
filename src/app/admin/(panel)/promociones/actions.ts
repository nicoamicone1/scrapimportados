"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { getStoreTimezone } from "@/lib/admin/pricing";
import { listAllPromotions } from "@/lib/admin/promotions";
import { logAudit, shallowDiff } from "@/lib/audit";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { applyPromotions, zonedLocalToIso, type AppliedPromotion, type Promotion } from "@/lib/pricing";
import { promotionSchema, type PromotionValues } from "@/lib/schemas/promotion";
import type { Json } from "@/lib/supabase/database.types";

/*
 * Promociones (agente C). Se aplican AL LEER con el motor
 * (`applyPromotions`); acá sólo se guardan. Toda mutación revalida
 * `promotions` y `products` (cards y fichas muestran el precio con promo).
 */

const uuid = z.string().uuid();

function revalidate() {
  revalidateTag("promotions", "max");
  revalidateTag("products", "max");
}

function toRow(values: PromotionValues, timeZone: string) {
  return {
    name: values.name,
    type: values.type,
    value: values.value,
    scope: values.scope,
    category_ids: values.scope === "categories" ? values.categoryIds : [],
    product_ids: values.scope === "products" ? values.productIds : [],
    starts_at: zonedLocalToIso(values.startsAt, timeZone),
    ends_at: zonedLocalToIso(values.endsAt, timeZone),
    priority: values.priority,
    stackable: values.stackable,
    badge_label: values.badgeLabel || null,
    is_active: values.isActive,
  };
}

export async function savePromotion(id: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = promotionSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const row = toRow(parsed.data, await getStoreTimezone());

    if (id === null || id === undefined) {
      const { data, error } = await ctx.supabase.from("promotions").insert(row).select("id").single();
      if (error || !data) {
        console.error("[promociones] insert", error?.message);
        return fail("No se pudo crear la promoción. Probá de nuevo.");
      }
      await logAudit(ctx, {
        action: "promotion.create",
        entity: "promotion",
        entityId: data.id,
        summary: `Creó la promoción "${row.name}"`,
        diff: row as unknown as Json,
      });
      revalidate();
      return ok({ id: data.id });
    }

    const pid = uuid.safeParse(id);
    if (!pid.success) return fail("Promoción inválida.");
    const { data: before } = await ctx.supabase.from("promotions").select("*").eq("id", pid.data).maybeSingle();
    if (!before) return fail("La promoción ya no existe.");
    const { error } = await ctx.supabase.from("promotions").update(row).eq("id", pid.data);
    if (error) {
      console.error("[promociones] update", error.message);
      return fail("No se pudo guardar la promoción. Probá de nuevo.");
    }
    const beforeSubset = Object.fromEntries(Object.keys(row).map((k) => [k, before[k as keyof typeof before] as Json]));
    await logAudit(ctx, {
      action: "promotion.update",
      entity: "promotion",
      entityId: pid.data,
      summary: `Editó la promoción "${row.name}"`,
      diff: shallowDiff(beforeSubset, row as unknown as Record<string, Json>),
    });
    revalidate();
    return ok({ id: pid.data });
  });
}

async function loadOr404(ctx: AdminContext, id: unknown) {
  const pid = uuid.safeParse(id);
  if (!pid.success) return null;
  const { data } = await ctx.supabase.from("promotions").select("*").eq("id", pid.data).maybeSingle();
  return data;
}

export async function setPromotionActive(id: unknown, isActive: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const promo = await loadOr404(ctx, id);
    if (!promo) return fail("La promoción ya no existe.");
    const next = isActive === true;
    const { error } = await ctx.supabase.from("promotions").update({ is_active: next }).eq("id", promo.id);
    if (error) return fail("No se pudo actualizar. Probá de nuevo.");
    await logAudit(ctx, {
      action: next ? "promotion.activate" : "promotion.pause",
      entity: "promotion",
      entityId: promo.id,
      summary: `${next ? "Activó" : "Pausó"} la promoción "${promo.name}"`,
    });
    revalidate();
    return ok();
  });
}

export async function duplicatePromotion(id: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const promo = await loadOr404(ctx, id);
    if (!promo) return fail("La promoción ya no existe.");
    const copy = {
      name: `${promo.name} (copia)`.slice(0, 80),
      type: promo.type,
      value: promo.value,
      scope: promo.scope,
      category_ids: promo.category_ids,
      product_ids: promo.product_ids,
      starts_at: promo.starts_at,
      ends_at: promo.ends_at,
      priority: promo.priority,
      stackable: promo.stackable,
      badge_label: promo.badge_label,
      // La copia nace pausada para no pisar precios sin querer.
      is_active: false,
    };
    const { data, error } = await ctx.supabase.from("promotions").insert(copy).select("id").single();
    if (error || !data) return fail("No se pudo duplicar. Probá de nuevo.");
    await logAudit(ctx, {
      action: "promotion.duplicate",
      entity: "promotion",
      entityId: data.id,
      summary: `Duplicó la promoción "${promo.name}"`,
    });
    revalidate();
    return ok({ id: data.id });
  });
}

export async function deletePromotion(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const promo = await loadOr404(ctx, id);
    if (!promo) return fail("La promoción ya no existe.");
    const { error } = await ctx.supabase.from("promotions").delete().eq("id", promo.id);
    if (error) return fail("No se pudo borrar. Probá de nuevo.");
    await logAudit(ctx, {
      action: "promotion.delete",
      entity: "promotion",
      entityId: promo.id,
      summary: `Borró la promoción "${promo.name}"`,
      diff: promo as unknown as Json,
    });
    revalidate();
    return ok();
  });
}

// ---------------------------------------------------------------------------
// Vista previa: 5 productos afectados con precio antes/después
// ---------------------------------------------------------------------------

export interface PromotionPreviewRow {
  productId: string;
  name: string;
  imageUrl: string | null;
  listPrice: number;
  /** Tachado actual de la variante (sin promo). */
  compareAtPrice: number | null;
  /** Precio final con TODAS las promos vigentes en ese momento (incluida esta). */
  finalPrice: number;
  /** Promos aplicadas (la primera es la ganadora). */
  applied: (AppliedPromotion & { isThis: boolean })[];
}

export interface PromotionPreview {
  affectedCount: number;
  /** Instante evaluado (ISO): ahora, o el inicio si la promo es programada. */
  evaluatedAt: string;
  /** La promo empieza en el futuro (los precios se evaluaron a su inicio). */
  scheduled: boolean;
  rows: PromotionPreviewRow[];
}

const DRAFT_ID = "__draft__";

interface PreviewProductRow {
  id: string;
  name: string;
  product_images: { url: string; position: number }[] | null;
  product_variants: { price: number; compare_at_price: number | null; position: number; is_active: boolean }[] | null;
  product_categories: { category_id: string }[] | null;
}

export async function previewPromotion(input: unknown, currentId: unknown): Promise<ActionResult<PromotionPreview>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = promotionSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error, "Completá los datos para ver la vista previa.");
    const values = parsed.data;
    const tz = await getStoreTimezone();
    const row = toRow(values, tz);

    // Momento a evaluar: ahora, o el inicio si todavía no empezó.
    const now = new Date();
    const start = row.starts_at ? new Date(row.starts_at) : null;
    const at = start && start > now ? start : now;

    const baseSelect =
      "id, name, product_images(url, position), product_variants(price, compare_at_price, position, is_active), product_categories(category_id)";
    let query;
    if (values.scope === "categories") {
      query = ctx.supabase
        .from("products")
        .select(`${baseSelect}, pc_filter:product_categories!inner(category_id)`, { count: "exact" })
        .in("pc_filter.category_id", values.categoryIds);
    } else {
      query = ctx.supabase.from("products").select(baseSelect, { count: "exact" });
      if (values.scope === "products") query = query.in("id", values.productIds.slice(0, 300));
    }
    const { data, count, error } = await query.eq("status", "active").order("name").limit(5);
    if (error) {
      console.error("[promociones] preview", error.message);
      return fail("No se pudo calcular la vista previa.");
    }

    const others = (await listAllPromotions()).filter((p) => p.id !== currentId && p.isActive);
    const draft: Promotion = {
      id: DRAFT_ID,
      name: values.name || "Esta promoción",
      type: values.type,
      value: values.value,
      scope: values.scope,
      categoryIds: row.category_ids,
      productIds: row.product_ids,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      // En la vista previa se evalúa como activa aunque esté pausada.
      isActive: true,
      priority: values.priority,
      badgeLabel: values.badgeLabel || null,
      stackable: values.stackable,
    };
    const promotions = [...others, draft];

    const rows: PromotionPreviewRow[] = ((data ?? []) as unknown as PreviewProductRow[]).map((p) => {
      const variant = [...(p.product_variants ?? [])].filter((v) => v.is_active).sort((a, b) => a.position - b.position)[0] ??
        [...(p.product_variants ?? [])][0];
      const image = [...(p.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
      const price = variant ? Number(variant.price) : 0;
      const compareAt = variant?.compare_at_price == null ? null : Number(variant.compare_at_price);
      const result = applyPromotions(
        { id: p.id, price, compareAtPrice: compareAt },
        { id: p.id, categoryIds: (p.product_categories ?? []).map((c) => c.category_id) },
        promotions,
        at,
      );
      return {
        productId: p.id,
        name: p.name,
        imageUrl: image?.url ?? null,
        listPrice: price,
        compareAtPrice: compareAt,
        finalPrice: result.price,
        applied: result.promotions.map((a) => ({ ...a, isThis: a.id === DRAFT_ID })),
      };
    });

    return ok({ affectedCount: count ?? rows.length, evaluatedAt: at.toISOString(), scheduled: at !== now, rows });
  });
}
