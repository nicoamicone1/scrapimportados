import { roundMoney } from "@/lib/money";

import type { PriceTier } from "./types";

/*
 * Precios por cantidad (mayorista) POR PRODUCTO: "desde 6 unidades $ X c/u,
 * desde 12 $ Y". Puro (lo usan el motor, el admin y el storefront).
 *
 * Regla (la misma que `private.tier_price` de la migración 0021):
 *   - Cuenta la cantidad del PRODUCTO: se suman las unidades de todas sus
 *     variantes en el carrito (2 talles × 3 = 6 unidades → tramo de 6).
 *   - Gana el tramo de mayor `minQty` que la cantidad alcanza.
 *   - El precio del tramo REEMPLAZA al precio de la variante (nunca lo sube:
 *     con variantes de precios distintos, la que ya es más barata que el
 *     tramo queda con su precio) y es la base de las promos por unidad y por
 *     cantidad. El cupón y el medio de pago van después, como siempre.
 *   - `compare_at_price` no participa: el tramo sale de `price`.
 */

/** Tope de tramos que ofrece el panel. La base acepta hasta `MAX_PRICE_TIERS_DB`. */
export const MAX_PRICE_TIERS = 4;
export const MAX_PRICE_TIERS_DB = 10;
/** Unidades máximas de un tramo (el carrito acepta hasta 999 por línea). */
export const MAX_TIER_QTY = 999;

/** `app_meta.schema_version` desde la que existen `products.price_tiers` y el `create_order` que los valida (0021). */
export const PRICE_TIERS_SCHEMA_VERSION = 12;

/** ¿La base ya tiene 0021? (ausente o inválida → no). */
export function supportsPriceTiers(schemaVersion: unknown): boolean {
  return typeof schemaVersion === "number" && Number.isFinite(schemaVersion) && schemaVersion >= PRICE_TIERS_SCHEMA_VERSION;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return Number.NaN;
}

/**
 * jsonb de la DB (`[{min_qty, price}]`), o lo que venga del carrito en
 * localStorage (`[{minQty, price}]`), a tramos válidos: ordenados por
 * cantidad, cantidades enteras ≥ 2 y crecientes, precios > 0 y
 * decrecientes. Lo que no cumple se descarta (nunca tira).
 */
export function normalizePriceTiers(value: unknown): PriceTier[] {
  if (!Array.isArray(value)) return [];
  const raw: PriceTier[] = [];
  for (const entry of value.slice(0, MAX_PRICE_TIERS_DB)) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const minQty = toNumber(o.min_qty ?? o.minQty);
    const price = toNumber(o.price);
    if (!Number.isInteger(minQty) || minQty < 2 || minQty > MAX_TIER_QTY) continue;
    if (!Number.isFinite(price) || price <= 0) continue;
    raw.push({ minQty, price: roundMoney(price) });
  }
  raw.sort((a, b) => a.minQty - b.minQty);
  const out: PriceTier[] = [];
  for (const t of raw) {
    const prev = out[out.length - 1];
    if (prev && (t.minQty <= prev.minQty || t.price >= prev.price)) continue;
    out.push(t);
  }
  return out;
}

/** Tramos → jsonb de `products.price_tiers`. */
export function priceTiersToRows(tiers: PriceTier[]): { min_qty: number; price: number }[] {
  return tiers.map((t) => ({ min_qty: t.minQty, price: roundMoney(t.price) }));
}

/** Tramo que alcanza `qty` unidades del producto (el de mayor `minQty`), o null. */
export function tierFor(tiers: readonly PriceTier[] | null | undefined, qty: number): PriceTier | null {
  if (!tiers?.length || !(qty >= 2)) return null;
  let found: PriceTier | null = null;
  for (const t of tiers) if (t.minQty <= qty && (!found || t.minQty > found.minQty)) found = t;
  return found;
}

/**
 * Precio unitario base para `qty` unidades del producto: el del tramo si es
 * menor que `base` (precio de la variante); si no, `base`.
 */
export function tierPriceFor(tiers: readonly PriceTier[] | null | undefined, qty: number, base: number): number {
  const tier = tierFor(tiers, qty);
  return tier && tier.price < base ? roundMoney(tier.price) : base;
}

/** Tramo que de verdad baja el precio de una variante de precio `base` (o null). */
export function effectiveTier(tiers: readonly PriceTier[] | null | undefined, qty: number, base: number): PriceTier | null {
  const tier = tierFor(tiers, qty);
  return tier && tier.price < base ? tier : null;
}

/** "Ahorro 12 %" frente al precio base (entero, hacia abajo: nunca promete de más). */
export function tierSavingsPercent(base: number, price: number): number {
  if (!(base > 0) || !(price > 0) || price >= base) return 0;
  return Math.floor(((base - price) / base) * 100 + 1e-9);
}

/** "1–5", "6–11", "12 o más". */
export function tierRangeLabel(minQty: number, maxQty: number | null): string {
  if (maxQty === null) return `${minQty} o más`;
  if (maxQty === minQty) return String(minQty);
  return `${minQty}–${maxQty}`;
}
