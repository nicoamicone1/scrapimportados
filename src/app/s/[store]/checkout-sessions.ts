"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";

import { fail, GENERIC_ERROR, ok, type ActionResult } from "@/lib/actions";
import type { CartItem } from "@/lib/cart";
import { checkoutIpHash, clientIp, recoverCookiePath } from "@/lib/store/checkout-reminders";
import {
  isMissingSchemaError,
  isSessionToken,
  readSessionRpc,
  readUpsertRpc,
  RECOVER_COOKIE,
  restoreCartItems,
  sessionInputSchema,
  sessionItemsPayload,
  UNSUBSCRIBE_COOKIE,
} from "@/lib/store/checkout-sessions";
import { getFreshVariants } from "@/lib/store/products";
import type { Json } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant/resolve";

/*
 * Carritos abandonados: acciones PÚBLICAS del storefront (migración 0020).
 * La tienda sale del request, nunca del cliente. Las RPC son security
 * definer: validan tienda, consentimiento, función habilitada y cupos, y
 * ponen nombre y precio de cada ítem desde la base.
 *
 * Todo degrada sin romper: sin la migración (o con la función apagada) guardar
 * no hace nada, restaurar responde "este link ya no sirve" y el checkout sigue
 * igual. Guardar y marcar nunca muestran errores al comprador (son accesorios
 * al pedido). Borrar (destildó) sí devuelve error, para que el checkout
 * conserve el token y reintente: destildar tiene que borrar siempre.
 */

const STORE_UNAVAILABLE = "Esta tienda no está disponible en este momento.";
const LINK_EXPIRED = "Este link ya no sirve. Podés armar el carrito de nuevo desde la tienda.";

async function requestIpHash(storeId: string): Promise<string> {
  try {
    return checkoutIpHash(clientIp(await headers()), storeId);
  } catch {
    return checkoutIpHash(null, storeId);
  }
}

/** Borra la cookie del link del mail (ya se usó): reabrir `/carrito` no repite la acción. */
async function clearCookie(name: string, basePath: string): Promise<void> {
  try {
    (await cookies()).delete({ name, path: recoverCookiePath(basePath) });
  } catch {
    // fuera de una action no se puede: vence sola a los 10 minutos
  }
}

/**
 * Guarda o actualiza la sesión de checkout. Con `consent: false` borra la que
 * hubiera (el comprador destildó el aviso; el email es opcional). Devuelve el
 * token vigente; al borrar, un error de la base vuelve como `fail` para que
 * el checkout reintente con el mismo token.
 */
export async function saveCheckoutSession(input: unknown): Promise<ActionResult<{ token: string | null }>> {
  const parsed = sessionInputSchema.safeParse(input);
  if (!parsed.success) return ok({ token: null });
  const { token, email, name, items, consent, website } = parsed.data;
  // Honeypot: la misma respuesta que para una persona, sin guardar nada.
  if (website?.trim()) return ok({ token: null });
  // Sin consentimiento y sin sesión previa: no hay nada que tocar en la base.
  if (!consent && !token) return ok({ token: null });
  try {
    const store = (await getTenant()).store;
    if (!store) return consent ? ok({ token: null }) : fail(STORE_UNAVAILABLE);
    const { data, error } = await createPublicClient().rpc("upsert_checkout_session", {
      p_store_id: store.id,
      p_token: token,
      p_email: email,
      p_name: consent ? name : null,
      p_items: (consent ? sessionItemsPayload(items) : []) as unknown as Json,
      p_consent: consent,
      p_ip_hash: await requestIpHash(store.id),
    });
    if (error) {
      // P0001 = cupo o datos inválidos (mensaje para el comprador, pero no se muestra: es accesorio).
      if (error.code !== "P0001" && !isMissingSchemaError(error)) console.error("[carritos] guardar:", error.code, error.message);
      // Sin la migración no hay nada que borrar.
      if (!consent) return isMissingSchemaError(error) ? ok({ token: null }) : fail(GENERIC_ERROR);
      return ok({ token });
    }
    return ok({ token: readUpsertRpc(data).token });
  } catch (err) {
    console.error("[carritos] guardar:", err instanceof Error ? err.message : err);
    return consent ? ok({ token }) : fail(GENERIC_ERROR);
  }
}

const markSchema = z.object({ token: z.string(), orderToken: z.string().min(8).max(100) });

/** Marca la sesión como recuperada por el pedido recién creado (mismo email y tienda). */
export async function markCheckoutRecovered(input: unknown): Promise<ActionResult> {
  const parsed = markSchema.safeParse(input);
  if (!parsed.success || !isSessionToken(parsed.data.token)) return ok();
  try {
    const { error } = await createPublicClient().rpc("mark_checkout_recovered", {
      p_token: parsed.data.token,
      p_order_token: parsed.data.orderToken,
    });
    if (error && !isMissingSchemaError(error)) console.error("[carritos] marcar recuperado:", error.code, error.message);
  } catch (err) {
    console.error("[carritos] marcar recuperado:", err instanceof Error ? err.message : err);
  }
  return ok();
}

export interface RestoreResult {
  items: CartItem[];
  skipped: number;
  reduced: number;
  /** La sesión ya terminó en un pedido. */
  recovered: boolean;
}

/**
 * Lee la sesión del link del mail (el token llega por la cookie httpOnly que
 * fija `/carrito/recuperar/<token>`) y arma el carrito con precios y stock de hoy.
 */
export async function restoreCheckoutSession(input: unknown): Promise<ActionResult<RestoreResult>> {
  const token = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (!isSessionToken(token)) return fail(LINK_EXPIRED);
  try {
    const tenant = await getTenant();
    const store = tenant.store;
    if (!store) return fail(STORE_UNAVAILABLE);
    await clearCookie(RECOVER_COOKIE, tenant.basePath);
    const { data, error } = await createPublicClient().rpc("get_checkout_session", { p_token: token });
    if (error) {
      if (!isMissingSchemaError(error)) console.error("[carritos] restaurar:", error.code, error.message);
      return fail(LINK_EXPIRED);
    }
    const session = readSessionRpc(data);
    if (!session || session.storeId !== store.id) return fail(LINK_EXPIRED);
    if (session.recovered) return ok({ items: [], skipped: 0, reduced: 0, recovered: true });
    if (!session.items.length) return fail(LINK_EXPIRED);
    const fresh = await getFreshVariants(store.id, session.items.map((i) => i.variantId));
    return ok({ ...restoreCartItems(session.items, fresh), recovered: false });
  } catch (err) {
    console.error("[carritos] restaurar:", err instanceof Error ? err.message : err);
    return fail(GENERIC_ERROR);
  }
}

/** Baja de los avisos de carrito de esta tienda para el email de la sesión (sólo si el token es de esta tienda). */
export async function unsubscribeCheckoutSession(input: unknown): Promise<ActionResult> {
  const token = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (!isSessionToken(token)) return fail(LINK_EXPIRED);
  try {
    const tenant = await getTenant();
    const store = tenant.store;
    if (!store) return fail(STORE_UNAVAILABLE);
    const db = createPublicClient();
    const { data, error } = await db.rpc("checkout_session_unsubscribe", { p_token: token, p_store_id: store.id });
    if (error) {
      if (!isMissingSchemaError(error)) console.error("[carritos] baja:", error.code, error.message);
      return fail("No pudimos darte de baja. Probá de nuevo en un rato o respondé el mail.");
    }
    await clearCookie(UNSUBSCRIBE_COOKIE, tenant.basePath);
    if (data && typeof data === "object" && !Array.isArray(data) && data.ok === true) return ok();
    // `ok: false`: el token es de otra tienda (no se toca nada) o ya no existe
    // (sesión purgada: tampoco recibe avisos, para el comprador es una baja).
    const { data: other } = await db.rpc("get_checkout_session", { p_token: token });
    return readSessionRpc(other) ? fail(LINK_EXPIRED) : ok();
  } catch (err) {
    console.error("[carritos] baja:", err instanceof Error ? err.message : err);
    return fail(GENERIC_ERROR);
  }
}
