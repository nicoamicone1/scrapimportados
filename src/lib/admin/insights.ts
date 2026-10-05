import "server-only";

import type { AdminContext } from "@/lib/auth";
import { resolvePeriod, sumSeries } from "@/lib/admin/dashboard-utils";
import {
  explainWeek,
  unavailableInsights,
  type OutOfStockVariant,
  type PeriodTotals,
  type PriceBatchRow,
  type TopProductRow,
  type WeekInsights,
} from "@/lib/admin/insights-utils";
import type { StoreInfo } from "@/lib/admin/orders";

/**
 * Lectura de "Qué pasó esta semana" (PRODUCT-THESIS §4.3): últimos 7 días
 * contra los 7 anteriores, con los mismos períodos y criterios que las
 * métricas del inicio (`resolvePeriod("7d")`, pedidos no cancelados por fecha
 * de creación). Toda consulta filtra por `store.storeId`. Si falta lo
 * esencial (ventas o más vendidos) la tarjeta queda en `empty` con un motivo;
 * si falla lo secundario (precios o stock) se omiten esos drivers.
 */

type Supa = AdminContext["supabase"];

export type { WeekInsights } from "@/lib/admin/insights-utils";

const TOP_LIMIT = 50;

export async function getWeekInsights(supabase: Supa, store: StoreInfo, now: Date = new Date()): Promise<WeekInsights> {
  try {
    const sid = store.storeId;
    const tz = store.timezone;
    const period = resolvePeriod("7d", now, tz);
    const range = (from: Date, to: Date) => ({ p_store_id: sid, p_from: from.toISOString(), p_to: to.toISOString() });

    const [curSeries, prevSeries, curTop, prevTop, batches] = await Promise.all([
      supabase.rpc("admin_sales_series", { ...range(period.from, period.to), p_bucket: "day", p_tz: tz }),
      supabase.rpc("admin_sales_series", { ...range(period.prevFrom, period.prevTo), p_bucket: "day", p_tz: tz }),
      supabase.rpc("admin_top_products", { ...range(period.from, period.to), p_limit: TOP_LIMIT }),
      supabase.rpc("admin_top_products", { ...range(period.prevFrom, period.prevTo), p_limit: TOP_LIMIT }),
      supabase
        .from("price_batches")
        .select("created_at, rule_summary, scope_summary, variant_count, undone_at")
        .eq("store_id", sid)
        .gte("created_at", period.from.toISOString())
        .lt("created_at", period.to.toISOString())
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const essential = [
      ["ventas actuales", curSeries.error],
      ["ventas anteriores", prevSeries.error],
      ["más vendidos actuales", curTop.error],
      ["más vendidos anteriores", prevTop.error],
    ] as const;
    let failed = false;
    for (const [what, error] of essential) {
      if (error) {
        console.error(`[insights] ${what}:`, error.message);
        failed = true;
      }
    }
    if (failed) return unavailableInsights();

    if (batches.error) console.error("[insights] lotes de precios:", batches.error.message);

    const totals = (rows: { orders: number; sales: number }[] | null): PeriodTotals => sumSeries(rows ?? []);
    const top = (rows: { product_id: string | null; name: string; qty: number; revenue: number }[] | null): TopProductRow[] =>
      (rows ?? []).map((r) => ({ productId: r.product_id, name: r.name, qty: Number(r.qty), revenue: Number(r.revenue) }));

    const topCurrent = top(curTop.data);
    const topPrevious = top(prevTop.data);
    const stock = await readStock(supabase, sid, topPrevious);

    return explainWeek({
      current: totals(curSeries.data),
      previous: totals(prevSeries.data),
      topCurrent,
      topPrevious,
      topLimit: TOP_LIMIT,
      priceBatches: (batches.data ?? []) as PriceBatchRow[],
      outOfStock: stock.outOfStock,
      productsWithStock: stock.productsWithStock,
      currency: store.currency,
      locale: store.locale,
      timeZone: tz,
    });
  } catch (err) {
    console.error("[insights] inesperado:", err instanceof Error ? err.message : err);
    return unavailableInsights();
  }
}

/**
 * Stock actual de los productos que vendieron la semana anterior (los únicos
 * que pueden "quedarse sin stock" en la explicación). Variantes activas de
 * productos no archivados; una variante sin seguimiento cuenta como disponible.
 */
async function readStock(
  supabase: Supa,
  sid: string,
  topPrevious: TopProductRow[],
): Promise<{ outOfStock: OutOfStockVariant[]; productsWithStock: string[] }> {
  const ids = [...new Set(topPrevious.map((r) => r.productId).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return { outOfStock: [], productsWithStock: [] };

  const [variants, products] = await Promise.all([
    supabase
      .from("product_variants")
      .select("product_id, title, stock, track_inventory")
      .eq("store_id", sid)
      .eq("is_active", true)
      .in("product_id", ids)
      .limit(2000),
    supabase.from("products").select("id, name, status").eq("store_id", sid).in("id", ids),
  ]);
  if (variants.error || products.error) {
    console.error("[insights] stock:", variants.error?.message ?? products.error?.message);
    return { outOfStock: [], productsWithStock: [] };
  }

  const live = new Map((products.data ?? []).filter((p) => p.status !== "archived").map((p) => [p.id, p.name]));
  const outOfStock: OutOfStockVariant[] = [];
  const withStock = new Set<string>();
  for (const v of variants.data ?? []) {
    if (!live.has(v.product_id)) continue;
    if (!v.track_inventory || Number(v.stock) > 0) withStock.add(v.product_id);
    else outOfStock.push({ product_id: v.product_id, product_name: live.get(v.product_id) ?? null, variant_title: v.title });
  }
  return { outOfStock, productsWithStock: [...withStock] };
}
