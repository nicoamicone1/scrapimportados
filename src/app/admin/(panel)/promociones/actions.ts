"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { getStoreTimezone } from "@/lib/admin/pricing";
import { listAllPromotions } from "@/lib/admin/promotions";
import { getSchemaStatus } from "@/lib/admin/settings";
import { logAudit, shallowDiff } from "@/lib/audit";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { tagFor } from "@/lib/cache-tags";
import { assertFeature } from "@/lib/plans";
import { assertUsage } from "@/lib/plans/server";
import { applyPromotions, computeCart, isQuantityType, zonedLocalToIso, type AppliedPromotion, type Promotion } from "@/lib/pricing";
import { promotionSchema, type PromotionValues } from "@/lib/schemas/promotion";
import type { Json } from "@/lib/supabase/database.types";

import { isMissingQuantityMigration, type DbError } from "./quantity-migration";

/*
 * Promociones (agente C). Se aplican AL LEER con el motor
 * (`applyPromotions`); acá sólo se guardan. Toda mutación revalida
 * `promotions` y `products` (cards y fichas muestran el precio con promo).
 * Plan: `marketing.promotions` para crear/editar/duplicar/activar (pausar y
 * borrar siempre se puede) y el límite `promotions` al crear o duplicar.
 */

const uuid = z.string().uuid();

const MISSING_MIGRATION =
  "Este tipo de promoción todavía no está habilitado en la base de datos de la tienda (falta la actualización 0017). Mientras tanto podés usar porcentaje o monto fijo.";

/**
 * ¿El error al guardar es porque falta la migración 0017? Sólo se consulta la
 * versión del esquema cuando ya falló (y la promo es por cantidad).
 */
async function missingQuantityMigration(values: PromotionValues, error: DbError | null): Promise<boolean> {
  if (!error || !isQuantityType(values.type)) return false;
  const schema = await getSchemaStatus().catch(() => null);
  return isMissingQuantityMigration(schema?.current ?? null, error);
}

function revalidate(storeId: string) {
  revalidateTag(tagFor("promotions", storeId), "max");
  revalidateTag(tagFor("products", storeId), "max");
}

/** Parámetros de las promos por cantidad (columna `config`, migración 0017). */
function configFor(values: PromotionValues): { buy: number; pay: number } | { nth: number } | null {
  if (values.type === "bxgy") return { buy: values.buy ?? 0, pay: values.pay ?? 0 };
  if (values.type === "nth_unit_percent") return { nth: values.nth ?? 2 };
  return null;
}

function toRow(values: PromotionValues, timeZone: string) {
  const config = configFor(values);
  return {
    name: values.name,
    type: values.type,
    // "Llevá X, pagá Y" no usa `value`; la N.ª unidad guarda ahí el %.
    value: values.type === "bxgy" ? 0 : values.value,
    // Sólo las promos por cantidad mandan `config`: así las de % y monto se
    // siguen guardando aunque la migración 0017 no esté aplicada.
    ...(config ? { config } : {}),
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
    assertFeature(ctx, "marketing.promotions");
    const parsed = promotionSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const row = toRow(parsed.data, await getStoreTimezone());

    if (id === null || id === undefined) {
      await assertUsage(ctx, "promotions");
      const { data, error } = await ctx.supabase
        .from("promotions")
        .insert({ ...row, store_id: ctx.store.id })
        .select("id")
        .single();
      if (error || !data) {
        console.error("[promociones] insert", error?.message);
        if (await missingQuantityMigration(parsed.data, error)) return fail(MISSING_MIGRATION);
        return fail("No se pudo crear la promoción. Probá de nuevo.");
      }
      await logAudit(ctx, {
        action: "promotion.create",
        entity: "promotion",
        entityId: data.id,
        summary: `Creó la promoción "${row.name}"`,
        diff: row as unknown as Json,
      });
      revalidate(ctx.store.id);
      return ok({ id: data.id });
    }

    const pid = uuid.safeParse(id);
    if (!pid.success) return fail("Promoción inválida.");
    const { data: before } = await ctx.supabase
      .from("promotions")
      .select("*")
      .eq("store_id", ctx.store.id)
      .eq("id", pid.data)
      .maybeSingle();
    if (!before) return fail("La promoción ya no existe.");
    // De 3x2 / N.ª unidad a % o monto: se limpian los parámetros viejos (si no,
    // `config` queda con `buy`/`pay`/`nth` de una promo que ya no es por cantidad).
    const update = isQuantityType(before.type) && !isQuantityType(row.type) ? { ...row, config: {} } : row;
    const { error } = await ctx.supabase.from("promotions").update(update).eq("store_id", ctx.store.id).eq("id", pid.data);
    if (error) {
      console.error("[promociones] update", error.message);
      if (await missingQuantityMigration(parsed.data, error)) return fail(MISSING_MIGRATION);
      return fail("No se pudo guardar la promoción. Probá de nuevo.");
    }
    const beforeSubset = Object.fromEntries(Object.keys(row).map((k) => [k, (before[k as keyof typeof before] ?? null) as Json]));
    await logAudit(ctx, {
      action: "promotion.update",
      entity: "promotion",
      entityId: pid.data,
      summary: `Editó la promoción "${row.name}"`,
      diff: shallowDiff(beforeSubset, row as unknown as Record<string, Json>),
    });
    revalidate(ctx.store.id);
    return ok({ id: pid.data });
  });
}

async function loadOr404(ctx: AdminContext, id: unknown) {
  const pid = uuid.safeParse(id);
  if (!pid.success) return null;
  const { data } = await ctx.supabase.from("promotions").select("*").eq("store_id", ctx.store.id).eq("id", pid.data).maybeSingle();
  return data;
}

export async function setPromotionActive(id: unknown, isActive: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const promo = await loadOr404(ctx, id);
    if (!promo) return fail("La promoción ya no existe.");
    const next = isActive === true;
    if (next) assertFeature(ctx, "marketing.promotions");
    const { error } = await ctx.supabase
      .from("promotions")
      .update({ is_active: next })
      .eq("store_id", ctx.store.id)
      .eq("id", promo.id);
    if (error) return fail("No se pudo actualizar. Probá de nuevo.");
    await logAudit(ctx, {
      action: next ? "promotion.activate" : "promotion.pause",
      entity: "promotion",
      entityId: promo.id,
      summary: `${next ? "Activó" : "Pausó"} la promoción "${promo.name}"`,
    });
    revalidate(ctx.store.id);
    return ok();
  });
}

export async function duplicatePromotion(id: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    assertFeature(ctx, "marketing.promotions");
    const promo = await loadOr404(ctx, id);
    if (!promo) return fail("La promoción ya no existe.");
    await assertUsage(ctx, "promotions");
    const copy = {
      store_id: ctx.store.id,
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
      // Parámetros de 3x2 / N.ª unidad (sólo existe con la migración 0017).
      ...(promo.config != null ? { config: promo.config } : {}),
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
    revalidate(ctx.store.id);
    return ok({ id: data.id });
  });
}

export async function deletePromotion(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const promo = await loadOr404(ctx, id);
    if (!promo) return fail("La promoción ya no existe.");
    const { error } = await ctx.supabase.from("promotions").delete().eq("store_id", ctx.store.id).eq("id", promo.id);
    if (error) return fail("No se pudo borrar. Probá de nuevo.");
    await logAudit(ctx, {
      action: "promotion.delete",
      entity: "promotion",
      entityId: promo.id,
      summary: `Borró la promoción "${promo.name}"`,
      diff: promo as unknown as Json,
    });
    revalidate(ctx.store.id);
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
  /**
   * Promos por cantidad: ejemplo con X unidades de este producto solo (3x2 →
   * 3; 2.ª al 50 % → 2), con todas las promos vigentes.
   */
  example: {
    qty: number;
    before: number;
    after: number;
    /** Esta promo bonificó unidades en el ejemplo. */
    applies: boolean;
    /** Promo que le gana (otra por cantidad o una por unidad no acumulable). */
    blockedBy: string | null;
  } | null;
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
        .eq("store_id", ctx.store.id)
        .in("pc_filter.category_id", values.categoryIds);
    } else {
      query = ctx.supabase.from("products").select(baseSelect, { count: "exact" }).eq("store_id", ctx.store.id);
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
      buy: values.buy,
      pay: values.pay,
      nth: values.nth,
    };
    const promotions = [...others, draft];
    const exampleQty = values.type === "bxgy" ? (values.buy ?? 0) : values.type === "nth_unit_percent" ? (values.nth ?? 0) : 0;

    const rows: PromotionPreviewRow[] = ((data ?? []) as unknown as PreviewProductRow[]).map((p) => {
      const variant = [...(p.product_variants ?? [])].filter((v) => v.is_active).sort((a, b) => a.position - b.position)[0] ??
        [...(p.product_variants ?? [])][0];
      const image = [...(p.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
      const price = variant ? Number(variant.price) : 0;
      const compareAt = variant?.compare_at_price == null ? null : Number(variant.compare_at_price);
      const categoryIds = (p.product_categories ?? []).map((c) => c.category_id);
      const result = applyPromotions({ id: p.id, price, compareAtPrice: compareAt }, { id: p.id, categoryIds }, promotions, at);
      let example: PromotionPreviewRow["example"] = null;
      if (exampleQty > 0) {
        const line = computeCart({
          items: [{ variantId: p.id, productId: p.id, categoryIds, qty: exampleQty, listPrice: price, compareAtPrice: compareAt }],
          promotions,
          now: at,
        }).lines[0];
        const applies = line?.offer?.id === DRAFT_ID && line.offer.units > 0;
        example = {
          qty: exampleQty,
          before: line?.lineList ?? price * exampleQty,
          after: line?.lineTotal ?? price * exampleQty,
          applies,
          blockedBy: applies ? null : line?.offer && line.offer.id !== DRAFT_ID ? line.offer.name : (line?.promotion?.name ?? null),
        };
      }
      return {
        productId: p.id,
        name: p.name,
        imageUrl: image?.url ?? null,
        listPrice: price,
        compareAtPrice: compareAt,
        finalPrice: result.price,
        applied: result.promotions.map((a) => ({ ...a, isThis: a.id === DRAFT_ID })),
        example,
      };
    });

    return ok({ affectedCount: count ?? rows.length, evaluatedAt: at.toISOString(), scheduled: at !== now, rows });
  });
}
