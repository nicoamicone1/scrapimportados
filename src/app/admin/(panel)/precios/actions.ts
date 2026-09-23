"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import {
  getCategoryOptions,
  getPriceBatchChanges,
  getScopeVariants,
  searchPickerProducts,
  type PickerProduct,
  type PriceChangeDetail,
  type ScopeVariant,
} from "@/lib/admin/pricing";
import { requirePermission } from "@/lib/admin/require";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { tagFor } from "@/lib/cache-tags";
import { formatMoney, formatNumber } from "@/lib/money";
import { assertFeature } from "@/lib/plans";
import { describeBulkRule, previewBulkUpdate, summarizeCategorySelection } from "@/lib/pricing";
import {
  APPLY_CHUNK_SIZE,
  applyPriceUpdateSchema,
  MAX_BULK_VARIANTS,
  priceScopeSchema,
  type PriceScope,
} from "@/lib/schemas/price-update";
import type { Json } from "@/lib/supabase/database.types";

/*
 * Precios masivos (agente C): alcance → vista previa → aplicar en lotes →
 * historial con deshacer. La vista previa se calcula en el cliente con
 * `previewBulkUpdate`; al aplicar, el server vuelve a leer las variantes y
 * recalcula con la MISMA función (no confía en los precios del cliente).
 * Plan: `pricing.bulk` (vista previa, aplicar y deshacer). Rol: `prices.bulk`.
 */

const uuid = z.string().uuid("Id inválido.");

/** Variantes que abarca un alcance (paso 1 del asistente). */
export async function loadScopeVariants(
  input: unknown,
): Promise<ActionResult<{ variants: ScopeVariant[]; tooMany: boolean }>> {
  return runAction<{ variants: ScopeVariant[]; tooMany: boolean }>(async () => {
    const ctx = await requirePermission("prices.bulk");
    assertFeature(ctx, "pricing.bulk");
    const parsed = priceScopeSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error, "Completá el alcance.");
    const variants = await getScopeVariants(parsed.data);
    if (variants.length > MAX_BULK_VARIANTS) {
      return ok({ variants: [], tooMany: true });
    }
    return ok({ variants, tooMany: false });
  });
}

/** Buscador del selector de productos (lo usan precios, promociones y cupones). */
export async function searchProducts(q: unknown): Promise<ActionResult<PickerProduct[]>> {
  return runAction(async () => {
    await requireAdmin();
    const term = typeof q === "string" ? q : "";
    return ok(await searchPickerProducts(term, 20));
  });
}

async function describeScope(scope: PriceScope): Promise<string> {
  let text: string;
  switch (scope.kind) {
    case "all":
      text = "Todo el catálogo";
      break;
    case "categories": {
      const cats = await getCategoryOptions();
      const names = summarizeCategorySelection(cats, scope.categoryIds);
      text = `${names.length === 1 ? "Categoría" : "Categorías"}: ${names.join(", ") || "—"}${scope.includeChildren ? " (con subcategorías)" : ""}`;
      break;
    }
    case "products":
      text = scope.productIds.length === 1 ? "1 producto elegido" : `${formatNumber(scope.productIds.length)} productos elegidos`;
      break;
    case "brand":
      text = `Marca: ${scope.brand}`;
      break;
    case "tag":
      text = `Etiqueta: ${scope.tag}`;
      break;
    case "price_range":
      text =
        scope.minPrice != null && scope.maxPrice != null
          ? `Precio entre ${formatMoney(scope.minPrice)} y ${formatMoney(scope.maxPrice)}`
          : scope.minPrice != null
            ? `Precio desde ${formatMoney(scope.minPrice)}`
            : `Precio hasta ${formatMoney(scope.maxPrice)}`;
      break;
  }
  return scope.inStockOnly ? `${text} · sólo con stock` : text;
}

interface ApplyResult {
  batchId: string | null;
  applied: number;
  skipped: number;
  /** El proceso se cortó en el medio (quedó aplicado parcialmente). */
  partial: boolean;
}

/** Aplica el cambio masivo en lotes de 200 y lo registra para poder deshacerlo. */
export async function applyPriceUpdate(input: unknown): Promise<ActionResult<ApplyResult>> {
  return runAction(async () => {
    const ctx = await requirePermission("prices.bulk");
    assertFeature(ctx, "pricing.bulk");
    const parsed = applyPriceUpdateSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { scope, rule, excludedIds, expectedCount } = parsed.data;

    const variants = await getScopeVariants(scope);
    if (variants.length > MAX_BULK_VARIANTS) {
      return fail(`El alcance supera las ${formatNumber(MAX_BULK_VARIANTS)} variantes. Achicalo y probá de nuevo.`);
    }
    const excluded = new Set(excludedIds);
    const { rows } = previewBulkUpdate(variants, rule);
    const changes = rows
      .filter((r) => r.changed && !excluded.has(r.variant.id))
      .map((r) => ({
        variant_id: r.variant.id,
        old_price: r.oldPrice,
        old_compare_at: r.oldCompareAt,
        new_price: r.newPrice,
        new_compare_at: r.newCompareAt,
      }));

    if (changes.length === 0) return fail("No hay cambios para aplicar.");
    if (changes.length !== expectedCount) {
      return fail("Los precios cambiaron desde la vista previa. Recalculala y revisala antes de aplicar.");
    }

    const ruleSummary = describeBulkRule(rule);
    const scopeSummary = await describeScope(scope);
    const batchId = crypto.randomUUID();

    const { error: batchError } = await ctx.supabase.from("price_batches").insert({
      id: batchId,
      store_id: ctx.store.id,
      source: "bulk",
      rule: rule as unknown as Json,
      rule_summary: ruleSummary,
      scope: scope as unknown as Json,
      scope_summary: scopeSummary,
      variant_count: changes.length,
      created_by: ctx.user.id,
      created_by_email: ctx.user.email ?? null,
    });
    if (batchError) {
      console.error("[precios] batch", batchError.message);
      return fail("No se pudo registrar el cambio. Probá de nuevo.");
    }

    let applied = 0;
    let skipped = 0;
    let partial = false;
    for (let i = 0; i < changes.length; i += APPLY_CHUNK_SIZE) {
      const chunk = changes.slice(i, i + APPLY_CHUNK_SIZE);
      const { data, error } = await ctx.supabase.rpc("apply_price_changes", {
        p_store_id: ctx.store.id,
        p_batch_id: batchId,
        p_changes: chunk as unknown as Json,
      });
      if (error) {
        console.error("[precios] apply chunk", error.message);
        partial = true;
        break;
      }
      const res = data && typeof data === "object" && !Array.isArray(data) ? data : {};
      applied += Number(res.applied) || 0;
      skipped += Number(res.skipped) || 0;
    }
    if (partial) skipped = changes.length - applied;

    if (applied === 0) {
      await ctx.supabase.from("price_batches").delete().eq("store_id", ctx.store.id).eq("id", batchId);
      return partial
        ? fail("No se pudo aplicar el cambio. Probá de nuevo.")
        : fail("Ninguna variante se actualizó: sus precios cambiaron mientras tanto. Recalculá la vista previa.");
    }
    if (applied !== changes.length) {
      await ctx.supabase.from("price_batches").update({ variant_count: applied }).eq("store_id", ctx.store.id).eq("id", batchId);
    }

    await logAudit(ctx, {
      action: "price.bulk_update",
      entity: "price_batch",
      entityId: batchId,
      summary: `Cambio masivo de precios: ${ruleSummary} en ${formatNumber(applied)} variantes (${scopeSummary})`,
      diff: { rule: rule as unknown as Json, scope: scope as unknown as Json, applied, skipped, partial },
    });
    revalidateTag(tagFor("products", ctx.store.id), "max");

    return ok({ batchId, applied, skipped, partial });
  });
}

/** Deshace un batch: restaura las variantes cuyo precio sigue siendo el del batch. */
export async function undoPriceBatch(
  batchId: unknown,
): Promise<ActionResult<{ total: number; restored: number; skipped: number }>> {
  return runAction(async () => {
    const ctx = await requirePermission("prices.bulk");
    assertFeature(ctx, "pricing.bulk");
    const id = uuid.safeParse(batchId);
    if (!id.success) return fail("Cambio inválido.");

    const { data, error } = await ctx.supabase.rpc("undo_price_batch", { p_store_id: ctx.store.id, p_batch_id: id.data });
    if (error) {
      console.error("[precios] undo", error.message);
      return fail("No se pudo deshacer. Probá de nuevo.");
    }
    const res = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    if (res.ok !== true) {
      return fail(res.reason === "already_undone" ? "Este cambio ya se deshizo." : "No encontramos ese cambio.");
    }
    const total = Number(res.total) || 0;
    const restored = Number(res.restored) || 0;
    const skipped = Number(res.skipped) || 0;

    await logAudit(ctx, {
      action: "price.bulk_undo",
      entity: "price_batch",
      entityId: id.data,
      summary: `Deshizo un cambio masivo de precios: ${formatNumber(restored)} de ${formatNumber(total)} variantes restauradas`,
      diff: { total, restored, skipped },
    });
    revalidateTag(tagFor("products", ctx.store.id), "max");
    return ok({ total, restored, skipped });
  });
}

/** Detalle por variante (se carga al expandir una fila del historial). */
export async function loadBatchChanges(batchId: unknown): Promise<ActionResult<PriceChangeDetail[]>> {
  return runAction(async () => {
    await requireAdmin();
    const id = uuid.safeParse(batchId);
    if (!id.success) return fail("Cambio inválido.");
    return ok(await getPriceBatchChanges(id.data));
  });
}
