"use server";

import { refresh } from "next/cache";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { revalidateProducts } from "@/lib/admin/catalog-server";
import { afterStockIncrease } from "@/lib/admin/inventory-alerts";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { adjustStockSchema, bulkAdjustStockSchema, MOVEMENT_REASON_LABELS } from "@/lib/schemas/inventory";

/*
 * Ajustes de stock (agente A). SIEMPRE por `adjust_stock` (queda el
 * movimiento con usuario, motivo y nota); nunca `update stock` directo.
 */

export async function adjustStock(input: unknown): Promise<ActionResult<{ stock: number }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = adjustStockSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error, parsed.error.issues[0]?.message);
    const d = parsed.data;
    const { data: v } = await ctx.supabase
      .from("product_variants")
      .select("id, stock, title, products(name, slug)")
      .eq("store_id", ctx.store.id)
      .eq("id", d.variantId)
      .maybeSingle();
    if (!v) return fail("La variante ya no existe.");
    const delta = d.mode === "set" ? d.value - v.stock : d.value;
    if (!delta) return ok({ stock: v.stock });

    const { data: after, error } = await ctx.supabase.rpc("adjust_stock", {
      p_variant_id: v.id,
      p_delta: delta,
      p_reason: d.reason,
      p_note: d.note ?? undefined,
    });
    if (error) throw new Error(error.message);

    const name = v.title === "Default" ? (v.products?.name ?? "") : `${v.products?.name ?? ""} · ${v.title}`;
    await logAudit(ctx, {
      action: "inventory.adjust",
      entity: "variant",
      entityId: v.id,
      summary: `${MOVEMENT_REASON_LABELS[d.reason]}: ${delta > 0 ? "+" : ""}${delta} en ${name}`,
      diff: { stock: [v.stock, after] },
    });
    revalidateProducts(ctx.store.id, [v.products?.slug]);
    if (delta > 0) afterStockIncrease(ctx, [v.id]);
    refresh();
    return ok({ stock: after });
  });
}

export async function bulkAdjustStock(input: unknown): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = bulkAdjustStockSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error, parsed.error.issues[0]?.message);
    const d = parsed.data;
    const { data: variants } = await ctx.supabase
      .from("product_variants")
      .select("id, stock, products(slug)")
      .eq("store_id", ctx.store.id)
      .in("id", d.variantIds);
    if (!variants?.length) return fail("Las variantes ya no existen.");

    let count = 0;
    // Variantes a las que YA se les subió stock: si una tanda falla, las anteriores igual avisan.
    const increased: string[] = [];
    try {
      for (let i = 0; i < variants.length; i += 10) {
        const chunk = variants.slice(i, i + 10);
        const results = await Promise.all(
          chunk.map(async (v) => {
            const delta = d.mode === "set" ? d.value - v.stock : d.value;
            if (!delta) return { error: null };
            count++;
            const res = await ctx.supabase.rpc("adjust_stock", {
              p_variant_id: v.id,
              p_delta: delta,
              p_reason: d.reason,
              p_note: d.note ?? undefined,
            });
            if (!res.error && delta > 0) increased.push(v.id);
            return res;
          }),
        );
        const failed = results.find((r) => r.error);
        if (failed?.error) throw new Error(failed.error.message);
      }
    } finally {
      afterStockIncrease(ctx, increased);
    }

    await logAudit(ctx, {
      action: "inventory.bulk_adjust",
      entity: "variant",
      summary: `${MOVEMENT_REASON_LABELS[d.reason]} masivo: ${d.mode === "set" ? `fijó ${d.value}` : `${d.value > 0 ? "+" : ""}${d.value}`} en ${count} variantes`,
      diff: { variantIds: d.variantIds, mode: d.mode, value: d.value },
    });
    revalidateProducts(
      ctx.store.id,
      variants.map((v) => v.products?.slug),
    );
    refresh();
    return ok({ count });
  });
}
