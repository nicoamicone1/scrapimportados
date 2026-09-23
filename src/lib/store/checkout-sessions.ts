import { z } from "zod";

import type { CartItem } from "@/lib/cart";

import { stockLimit, type FreshVariant } from "./cart-validation";

/*
 * Carritos abandonados (migración 0020), parte PURA e isomórfica: la usan el
 * checkout (client), las server actions de `src/app/s/[store]/checkout-sessions.ts`
 * y los tests.
 *
 * Flujo: al salir de "Tus datos" con el tilde "Avisame por mail si dejo el
 * pedido sin terminar" marcado, se guarda la sesión (`upsert_checkout_session`)
 * y el token queda en localStorage (`ecommy:checkout:<storeId>`) para
 * reusarla; cada cambio del carrito la actualiza (con debounce). Al confirmar
 * el pedido se marca como recuperada. El mail lleva `/carrito?recuperar=<token>`
 * (repone el carrito) y `/carrito?baja=<token>` (baja de los avisos).
 */

/** Token de una sesión: 48 hex (lo genera la base). */
export const SESSION_TOKEN_RE = /^[0-9a-f]{48}$/;

export function isSessionToken(value: unknown): value is string {
  return typeof value === "string" && SESSION_TOKEN_RE.test(value);
}

/** Clave de localStorage del token de la sesión de checkout de una tienda. */
export function checkoutSessionKey(storeId: string): string {
  return `ecommy:checkout:${storeId}`;
}

/** Cupos de `upsert_checkout_session` al CREAR una sesión (espejo de 0020, para textos y tests). */
export const CHECKOUT_SESSION_LIMITS = { perEmailPerDay: 10, perIpPerDay: 30, perStorePerDay: 500 } as const;

/** ¿El error es "falta la migración" (tabla o función inexistente)? Entonces se degrada sin ruido. */
export function isMissingSchemaError(error: { code?: string | null } | null | undefined): boolean {
  const code = error?.code ?? "";
  return code === "PGRST205" || code === "PGRST202" || code === "42P01" || code === "42883";
}

/** Debounce de la actualización al cambiar el carrito (ms). */
export const SESSION_UPDATE_DEBOUNCE_MS = 1500;

/** Texto del tilde y de su ayuda (checkout). */
export const CONSENT_LABEL = "Avisame por mail si dejo el pedido sin terminar";
export const CONSENT_HELP = "Un solo aviso, sin ofertas inventadas. Podés darte de baja desde el mail.";

/** Aviso al reponer un carrito con productos que ya no se venden o no tienen stock. */
export const RESTORE_SKIPPED_MESSAGE = "Algunos productos ya no están disponibles.";

// ---------------------------------------------------------------------------
// Entrada de la action (validación)
// ---------------------------------------------------------------------------

export const sessionInputSchema = z.object({
  token: z
    .string()
    .nullish()
    .transform((v) => (isSessionToken(v) ? v : null)),
  email: z.string().trim().toLowerCase().max(254).email(),
  name: z
    .string()
    .trim()
    .max(120)
    .nullish()
    .transform((v) => v || null),
  items: z
    .array(z.object({ variantId: z.string().uuid(), qty: z.number().int().min(1).max(999) }))
    .max(100),
  consent: z.boolean(),
  /** Honeypot: un bot que lo completa recibe "listo" sin guardar nada. */
  website: z.string().max(200).optional(),
});

export type SessionInput = z.input<typeof sessionInputSchema>;

/** Payload de `p_items` (sólo variante y cantidad: nombre y precio los pone la base). */
export function sessionItemsPayload(items: readonly { variantId: string; qty: number }[]): { variant_id: string; qty: number }[] {
  const byVariant = new Map<string, number>();
  for (const i of items) byVariant.set(i.variantId, Math.min(999, (byVariant.get(i.variantId) ?? 0) + i.qty));
  return [...byVariant].map(([variant_id, qty]) => ({ variant_id, qty }));
}

/** Firma del contenido del carrito (para no reenviar lo mismo). */
export function cartSignature(items: readonly { variantId: string; qty: number }[]): string {
  return sessionItemsPayload(items)
    .map((i) => `${i.variant_id}x${i.qty}`)
    .sort()
    .join(",");
}

type Loose = Record<string, unknown>;

function asRecord(value: unknown): Loose {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : {};
}

/** Respuesta de `upsert_checkout_session` → token vigente (o null si no se guardó). */
export function readUpsertRpc(data: unknown): { token: string | null; saved: boolean } {
  const r = asRecord(data);
  const token = isSessionToken(r.token) ? r.token : null;
  return { token, saved: r.saved === true && token !== null };
}

// ---------------------------------------------------------------------------
// Restaurar el carrito desde el link del mail
// ---------------------------------------------------------------------------

export interface SavedSessionItem {
  variantId: string;
  qty: number;
}

export interface SavedSession {
  storeId: string;
  name: string | null;
  recovered: boolean;
  items: SavedSessionItem[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Respuesta de `get_checkout_session` (tolerante: lo que no tiene forma se descarta). */
export function readSessionRpc(data: unknown): SavedSession | null {
  const r = asRecord(data);
  if (typeof r.store_id !== "string" || !UUID_RE.test(r.store_id)) return null;
  const raw = Array.isArray(r.items) ? r.items : [];
  const items: SavedSessionItem[] = [];
  for (const entry of raw) {
    const e = asRecord(entry);
    const qty = Number(e.qty);
    if (typeof e.variant_id !== "string" || !UUID_RE.test(e.variant_id) || !Number.isInteger(qty) || qty < 1) continue;
    items.push({ variantId: e.variant_id, qty: Math.min(qty, 999) });
    if (items.length >= 100) break;
  }
  return {
    storeId: r.store_id,
    name: typeof r.name === "string" && r.name ? r.name : null,
    recovered: r.recovered === true,
    items,
  };
}

export interface RestoredCart {
  items: CartItem[];
  /** Ítems guardados que no se pudieron reponer (no existen, no se venden o sin stock). */
  skipped: number;
  /** Ítems que entraron con menos unidades por el stock actual. */
  reduced: number;
}

/**
 * Arma los ítems del carrito con los datos ACTUALES de cada variante: precio
 * de hoy, nombre, foto, tope por stock. Se omiten las variantes que ya no
 * existen, no se venden o no tienen stock; la cantidad se recorta al stock.
 */
export function restoreCartItems(saved: readonly SavedSessionItem[], fresh: ReadonlyMap<string, FreshVariant>): RestoredCart {
  const qtyByVariant = new Map<string, number>();
  for (const s of saved) qtyByVariant.set(s.variantId, Math.min(999, (qtyByVariant.get(s.variantId) ?? 0) + s.qty));

  const items: CartItem[] = [];
  let skipped = 0;
  let reduced = 0;
  for (const [variantId, wanted] of qtyByVariant) {
    const v = fresh.get(variantId);
    const limit = v ? stockLimit(v) : null;
    if (!v || !v.active || (limit !== null && limit <= 0)) {
      skipped++;
      continue;
    }
    const qty = limit !== null ? Math.min(wanted, limit) : wanted;
    if (qty < wanted) reduced++;
    items.push({
      variantId,
      productId: v.productId,
      slug: v.slug,
      name: v.name,
      variantTitle: v.variantTitle,
      sku: v.sku,
      image: v.image,
      unitPrice: v.price,
      qty,
      categoryIds: v.categoryIds,
      maxQty: limit,
      compareAtPrice: v.compareAtPrice,
      vatPercent: v.vatPercent,
    });
  }
  return { items, skipped, reduced };
}

/**
 * Suma lo repuesto al carrito que ya había en este navegador: si la variante
 * ya está, queda la cantidad mayor (no se duplica al abrir el link dos veces).
 */
export function mergeRestoredItems(current: readonly CartItem[], restored: readonly CartItem[]): CartItem[] {
  const byId = new Map(restored.map((r) => [r.variantId, r]));
  const merged = current.map((c) => {
    const r = byId.get(c.variantId);
    if (!r) return c;
    byId.delete(c.variantId);
    const cap = r.maxQty != null ? r.maxQty : null;
    const qty = Math.max(c.qty, r.qty);
    return { ...c, ...r, qty: cap !== null ? Math.min(qty, cap) : qty };
  });
  return [...merged, ...byId.values()];
}
