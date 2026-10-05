/**
 * "Qué pasó esta semana": lógica PURA y determinista (sin IA) que compara los
 * últimos 7 días con los 7 anteriores y explica el cambio con lo que ya hay:
 * productos que vendieron más o menos, cambios de precio y faltantes de stock.
 * La lectura de datos está en `insights.ts`; esto sólo arma el texto.
 * Testeada en `insights-utils.test.ts`.
 *
 * Criterios (documentados para que el resultado sea predecible):
 * - Los productos se comparan por UNIDADES (diferencia absoluta de `qty`),
 *   no por ingresos: una suba de precio infla los ingresos sin vender más, y
 *   las unidades son lo que el comerciante cuenta en el mostrador.
 * - Un producto entra como driver si cambió al menos `MIN_UNIT_DELTA`
 *   unidades. "Se quedó sin stock" pesa lo que vendió la semana anterior
 *   (es lo que se deja de vender) y reemplaza a la bajada de ese producto.
 * - Orden: primero el movimiento de producto más grande en la dirección de la
 *   semana (si bajaste, la bajada más grande); después los cambios de precio
 *   que hiciste (hasta `MAX_PRICE_DRIVERS`, el más reciente primero, porque
 *   son la causa que controlás); después el resto por unidades. Máximo 4.
 * - Con menos de `MIN_ORDERS` pedidos en ambas semanas no hay base: `empty`.
 * - Variación de ventas dentro de ±`FLAT_PERCENT` % (redondeada): `flat`.
 */

import { zonedParts } from "@/lib/admin/dashboard-utils";
import { DEFAULT_CURRENCY, DEFAULT_LOCALE, formatMoney, formatNumber } from "@/lib/money";

// ---------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------

export type InsightTone = "up" | "down" | "flat" | "empty";
export type InsightDriverKind = "product_down" | "product_up" | "price_change" | "stock_out" | "no_sales_product";

export interface InsightDriver {
  kind: InsightDriverKind;
  text: string;
  href: string | null;
}

export interface WeekInsights {
  /** "Vendiste 18 % menos que la semana pasada." */
  headline: string;
  /** "$ 384.200 contra $ 468.500, en 14 pedidos contra 19." */
  detail?: string;
  tone: InsightTone;
  /** Máximo 4, ordenados por impacto. */
  drivers: InsightDriver[];
  /** Cuando no hay base para comparar (o no se pudo leer). */
  emptyReason?: string;
}

export interface PeriodTotals {
  sales: number;
  orders: number;
}

export interface TopProductRow {
  productId: string | null;
  name: string;
  qty: number;
  revenue: number;
}

export interface PriceBatchRow {
  created_at: string;
  rule_summary: string;
  scope_summary: string;
  variant_count: number;
  undone_at: string | null;
}

export interface OutOfStockVariant {
  product_id: string;
  product_name: string | null;
  variant_title: string | null;
}

export interface WeekInput {
  current: PeriodTotals;
  previous: PeriodTotals;
  /** Más vendidos de esta semana (`admin_top_products`). */
  topCurrent: readonly TopProductRow[];
  /** Más vendidos de la semana anterior. */
  topPrevious: readonly TopProductRow[];
  /**
   * `p_limit` con el que se pidió el top. Si una lista llega llena, un
   * producto que no aparece no vendió "cero": no se sabe, y no se compara.
   */
  topLimit?: number;
  /** Lotes de cambios de precio creados esta semana. */
  priceBatches: readonly PriceBatchRow[];
  /** Variantes activas, con seguimiento de stock, en 0 o menos. */
  outOfStock: readonly OutOfStockVariant[];
  /**
   * Productos que todavía tienen alguna variante activa disponible (stock > 0
   * o sin seguimiento). Un producto sólo "se quedó sin stock" si no está acá.
   */
  productsWithStock: readonly string[];
  currency?: string;
  locale?: string;
  /** Zona de la tienda, para el día de los cambios de precio. */
  timeZone?: string;
}

// ---------------------------------------------------------------------
// Umbrales
// ---------------------------------------------------------------------

export const MIN_ORDERS = 3;
export const MIN_UNIT_DELTA = 2;
export const FLAT_PERCENT = 2;
export const MAX_DRIVERS = 4;
export const MAX_PRICE_DRIVERS = 2;
/** Puesto en el top de la semana anterior hasta el que es "de los más vendidos". */
export const BEST_SELLER_RANK = 5;

export const EMPTY_REASON = "Todavía no hay suficientes ventas para comparar semanas.";
export const ERROR_REASON = "No pudimos leer las ventas de esta semana. Probá recargar la página en un rato.";

const PRICE_HISTORY_HREF = "/admin/precios/historial";
const OUT_OF_STOCK_HREF = "/admin/inventario?estado=agotado";
const DEFAULT_TZ = "America/Argentina/Buenos_Aires";
const MINUS = "−";
const WEEKDAY_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// ---------------------------------------------------------------------
// Helpers de texto
// ---------------------------------------------------------------------

/** Variación porcentual redondeada, igual que `compare()` del dashboard. null sin base. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** 31 → "+31 %", −8 → "−8 %". */
export function signedPercent(pct: number, locale = DEFAULT_LOCALE): string {
  const sign = pct > 0 ? "+" : pct < 0 ? MINUS : "";
  return `${sign}${formatNumber(Math.abs(pct), locale)} %`;
}

function units(n: number, locale: string): string {
  return `${formatNumber(n, locale)} ${n === 1 ? "unidad" : "unidades"}`;
}

function ordersText(n: number, locale: string): string {
  return `${formatNumber(n, locale)} ${n === 1 ? "pedido" : "pedidos"}`;
}

function productHref(productId: string | null): string | null {
  return productId ? `/admin/productos/${productId}` : null;
}

/** "el martes 30" en la zona de la tienda. */
export function dayPhrase(iso: string, timeZone = DEFAULT_TZ): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "esta semana";
  const p = zonedParts(date, timeZone);
  return `el ${WEEKDAY_LONG[p.weekday]} ${p.day}`;
}

function quoteList(names: string[]): string {
  const quoted = names.map((n) => `"${n}"`);
  if (quoted.length <= 1) return quoted.join("");
  return `${quoted.slice(0, -1).join(", ")} y ${quoted[quoted.length - 1]}`;
}

/** "Categoría: Remeras" → `de "Remeras"`. Ver `describeScope` en precios/actions. */
export function scopePhrase(scopeSummary: string, variantCount: number, locale = DEFAULT_LOCALE): string {
  const scope = scopeSummary
    .replace(/ · sólo con stock$/, "")
    .replace(/ \(con subcategorías\)$/, "")
    .trim();
  const variants = variantCount > 0 ? `de ${formatNumber(variantCount, locale)} ${variantCount === 1 ? "variante" : "variantes"}` : "";
  if (!scope || scope === "—") return variants;
  if (scope === "Todo el catálogo") return "de todo el catálogo";
  let m = /^Categorías?: (.+)$/.exec(scope);
  if (m) return `de ${quoteList(m[1].split(", ").filter(Boolean))}`;
  m = /^Marca: (.+)$/.exec(scope);
  if (m) return `de la marca "${m[1]}"`;
  m = /^Etiqueta: (.+)$/.exec(scope);
  if (m) return `con la etiqueta "${m[1]}"`;
  m = /^(\S+) productos? elegidos?$/.exec(scope);
  if (m) return `de ${m[1]} ${m[1] === "1" ? "producto" : "productos"}`;
  if (/^Precio /.test(scope)) return `de los productos con ${scope.charAt(0).toLowerCase()}${scope.slice(1)}`;
  return variants;
}

/** Texto de un lote de precios: "Subiste 12 % los precios de "Remeras" el martes 30." */
export function priceBatchText(batch: PriceBatchRow, timeZone = DEFAULT_TZ, locale = DEFAULT_LOCALE): string {
  const rule = (batch.rule_summary.split(" · ")[0] ?? "").replace(/ \(también el tachado\)$/, "").trim();
  const where = scopePhrase(batch.scope_summary, batch.variant_count, locale);
  const when = dayPhrase(batch.created_at, timeZone);
  const target = where ? `los precios ${where}` : "los precios";
  const up = /^Aumentar (.+)$/.exec(rule);
  if (up) return `Subiste ${up[1]} ${target} ${when}.`;
  const down = /^Bajar (.+)$/.exec(rule);
  if (down) return `Bajaste ${down[1]} ${target} ${when}.`;
  const how = rule ? ` (${rule.charAt(0).toLowerCase()}${rule.slice(1)})` : "";
  return `Cambiaste ${target} ${when}${how}.`;
}

// ---------------------------------------------------------------------
// Explicación
// ---------------------------------------------------------------------

interface ProductMove {
  key: string;
  productId: string | null;
  name: string;
  cur: number | null; // null = no se sabe (no entró en un top lleno)
  prev: number | null;
  revenueDelta: number;
  prevRank: number | null;
}

interface Candidate {
  driver: InsightDriver;
  score: number;
  tiebreak: number;
  name: string;
  direction: "up" | "down" | "none";
}

function rowKey(r: TopProductRow): string {
  return r.productId ?? `name:${r.name}`;
}

function collectMoves(input: WeekInput): ProductMove[] {
  const limit = input.topLimit ?? Number.POSITIVE_INFINITY;
  const curFull = input.topCurrent.length >= limit;
  const prevFull = input.topPrevious.length >= limit;
  const moves = new Map<string, ProductMove>();

  input.topPrevious.forEach((r, i) => {
    moves.set(rowKey(r), {
      key: rowKey(r),
      productId: r.productId,
      name: r.name,
      cur: curFull ? null : 0,
      prev: Number(r.qty) || 0,
      revenueDelta: -(Number(r.revenue) || 0),
      prevRank: i + 1,
    });
  });
  for (const r of input.topCurrent) {
    const key = rowKey(r);
    const m = moves.get(key);
    const qty = Number(r.qty) || 0;
    const revenue = Number(r.revenue) || 0;
    if (m) {
      m.cur = qty;
      m.name = r.name || m.name;
      m.revenueDelta += revenue;
    } else {
      moves.set(key, { key, productId: r.productId, name: r.name, cur: qty, prev: prevFull ? null : 0, revenueDelta: revenue, prevRank: null });
    }
  }
  return [...moves.values()];
}

function productCandidates(input: WeekInput, locale: string): Candidate[] {
  const withStock = new Set(input.productsWithStock);
  const outByProduct = new Map<string, OutOfStockVariant[]>();
  for (const v of input.outOfStock) {
    const list = outByProduct.get(v.product_id) ?? [];
    list.push(v);
    outByProduct.set(v.product_id, list);
  }

  const out: Candidate[] = [];
  for (const m of collectMoves(input)) {
    const prev = m.prev ?? 0;
    const href = productHref(m.productId);

    // Se quedó sin stock: vendió la semana anterior y hoy no le queda ninguna variante disponible.
    const outVariants = m.productId ? outByProduct.get(m.productId) : undefined;
    if (m.productId && prev > 0 && outVariants?.length && !withStock.has(m.productId)) {
      const only = outVariants.length === 1 ? outVariants[0].variant_title?.trim() : "";
      const label = only && only !== "Default" ? `${m.name} (${only})` : m.name;
      const why =
        m.prevRank !== null && m.prevRank <= BEST_SELLER_RANK
          ? "y estaba entre lo más vendido"
          : `y la semana pasada vendió ${units(prev, locale)}`;
      out.push({
        driver: { kind: "stock_out", text: `${label} se quedó sin stock ${why}.`, href: OUT_OF_STOCK_HREF },
        score: Math.max(prev, prev - (m.cur ?? 0)),
        tiebreak: Math.abs(m.revenueDelta),
        name: m.name,
        direction: "down",
      });
      continue;
    }

    if (m.cur === null || m.prev === null) continue; // fuera de un top lleno: no se compara
    const delta = m.cur - m.prev;
    if (Math.abs(delta) < MIN_UNIT_DELTA) continue;

    if (m.cur === 0) {
      out.push({
        driver: {
          kind: "no_sales_product",
          text: `${m.name} no se vendió esta semana; la pasada, ${units(m.prev, locale)}.`,
          href,
        },
        score: m.prev,
        tiebreak: Math.abs(m.revenueDelta),
        name: m.name,
        direction: "down",
      });
      continue;
    }

    const pct = percentChange(m.cur, m.prev);
    const text =
      delta < 0
        ? `${m.name}: ${units(-delta, locale)} menos (${signedPercent(pct ?? 0, locale)}).`
        : pct === null
          ? `${m.name}: ${units(m.cur, locale)}; la semana pasada no se vendió.`
          : `${m.name}: ${units(delta, locale)} más (${signedPercent(pct, locale)}).`;
    out.push({
      driver: { kind: delta < 0 ? "product_down" : "product_up", text, href },
      score: Math.abs(delta),
      tiebreak: Math.abs(m.revenueDelta),
      name: m.name,
      direction: delta < 0 ? "down" : "up",
    });
  }

  return out.sort((a, b) => b.score - a.score || b.tiebreak - a.tiebreak || a.name.localeCompare(b.name, "es"));
}

function priceDrivers(input: WeekInput, timeZone: string, locale: string): InsightDriver[] {
  return input.priceBatches
    .filter((b) => !b.undone_at)
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, MAX_PRICE_DRIVERS)
    .map((b) => ({ kind: "price_change" as const, text: priceBatchText(b, timeZone, locale), href: PRICE_HISTORY_HREF }));
}

/** Arma la explicación de la semana. Pura: mismos datos, mismo texto. */
export function explainWeek(input: WeekInput): WeekInsights {
  const currency = input.currency ?? DEFAULT_CURRENCY;
  const locale = input.locale ?? DEFAULT_LOCALE;
  const timeZone = input.timeZone ?? DEFAULT_TZ;
  const money = (v: number) => formatMoney(v, { currency, locale });
  const cur = { sales: Number(input.current.sales) || 0, orders: Number(input.current.orders) || 0 };
  const prev = { sales: Number(input.previous.sales) || 0, orders: Number(input.previous.orders) || 0 };

  if (cur.orders < MIN_ORDERS && prev.orders < MIN_ORDERS) {
    return {
      headline: cur.orders
        ? `Esta semana vendiste ${money(cur.sales)} en ${ordersText(cur.orders, locale)}.`
        : "Esta semana todavía no hubo ventas.",
      tone: "empty",
      drivers: [],
      emptyReason: EMPTY_REASON,
    };
  }

  let headline: string;
  let detail: string | undefined;
  let tone: InsightTone;
  const pct = percentChange(cur.sales, prev.sales);

  if (pct === null) {
    tone = "up";
    headline = `No hubo ventas la semana pasada. Esta vendiste ${money(cur.sales)}.`;
    detail = `En ${ordersText(cur.orders, locale)}.`;
  } else if (cur.sales === 0) {
    tone = "down";
    headline = "Esta semana no hubo ventas.";
    detail = `La semana pasada vendiste ${money(prev.sales)} en ${ordersText(prev.orders, locale)}.`;
  } else {
    tone = Math.abs(pct) <= FLAT_PERCENT ? "flat" : pct > 0 ? "up" : "down";
    headline =
      tone === "up"
        ? `Vendiste ${formatNumber(pct, locale)} % más que la semana pasada.`
        : tone === "down"
          ? `Vendiste ${formatNumber(-pct, locale)} % menos que la semana pasada.`
          : pct === 0
            ? "Vendiste lo mismo que la semana pasada."
            : `Vendiste casi lo mismo que la semana pasada (${signedPercent(pct, locale)}).`;
    detail = `${money(cur.sales)} contra ${money(prev.sales)}, en ${ordersText(cur.orders, locale)} contra ${formatNumber(prev.orders, locale)}.`;
  }

  const products = productCandidates(input, locale);
  const prices = priceDrivers(input, timeZone, locale);

  // Primer lugar: el movimiento más grande en la dirección de la semana.
  const leadIdx = tone === "up" || tone === "down" ? products.findIndex((c) => c.direction === tone) : 0;
  const lead = leadIdx >= 0 ? products.splice(leadIdx, 1)[0] : undefined;

  const drivers = [...(lead ? [lead.driver] : []), ...prices, ...products.map((c) => c.driver)].slice(0, MAX_DRIVERS);
  return { headline, detail, tone, drivers };
}

/** Resultado cuando una lectura falla: la tarjeta se ve igual, sin romper la página. */
export function unavailableInsights(): WeekInsights {
  return {
    headline: "No pudimos armar el resumen de la semana.",
    tone: "empty",
    drivers: [],
    emptyReason: ERROR_REASON,
  };
}
