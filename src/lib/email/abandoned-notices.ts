import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isMissingSchemaError, recoverPath } from "@/lib/store/checkout-sessions";
import { waLink } from "@/lib/store/whatsapp";
import type { Database, Json } from "@/lib/supabase/database.types";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { platformOrigin, storeUrl } from "@/lib/tenant/urls";
import { parseTheme } from "@/lib/theme";

import { emailEnabled, isEmail, maskEmails, sendEmail, storeFrom, wasSent, warnEmailDisabled } from "./send";
import { abandonedCartEmail, type AbandonedItem } from "./templates/abandoned";
import type { StoreEmailInfo } from "./templates/types";

/*
 * Avisos de carrito abandonado (migración 0020). Los corre el cron:
 * `/api/cron/daily` (09:00 UTC) y, si el plan de Vercel lo permite,
 * `/api/cron/abandoned` cada 6 horas. Con sólo el diario, el aviso sale
 * entre 3 y 27 horas después de dejar el checkout; con el de 6 h, entre 3 y 9.
 *
 * 0. Limpieza (`purge_checkout_sessions`): sesiones y eventos de más de 30
 *    días. Corre SIEMPRE que haya `SUPABASE_SERVICE_ROLE_KEY`, aunque los
 *    mails estén apagados (sin esa clave no se purga: ver docs/DEPLOY.md §4d).
 * 1. `abandoned_checkout_candidates()` (service_role) marca como recuperadas
 *    las sesiones cuyo email ya compró en la tienda (también las avisadas,
 *    hasta 7 días después del aviso) y devuelve las demás sesiones en la
 *    ventana (3 a 48 h sin tocar), de tiendas activas con la función prendida
 *    y el plan que la incluye, sin las de emails dados de baja.
 * 2. `pickAbandonedNotices()` (puro, testeado) decide: con consentimiento, sin
 *    pedido, sin aviso, sin baja, en la ventana, un mail por sesión y uno por
 *    email y tienda en la corrida (el carrito más reciente), nada si ese
 *    email ya recibió un aviso de la tienda en los últimos 7 días, hasta
 *    MAX_ABANDONED_PER_STORE por tienda (MAX_ABANDONED_PER_TRIAL_STORE si
 *    está en prueba) repartidos por turnos entre tiendas, tope
 *    MAX_ABANDONED_PER_RUN.
 * 3. Los ítems se releen al mandar (`refreshAbandonedItems`): nombre y precio
 *    de hoy; lo que ya no se vende o no tiene stock no aparece. Sin ítems, no
 *    hay mail.
 * 4. Cada envío reclama la sesión con `claim_checkout_reminder` (fija
 *    `reminded_at` si nadie la tomó, re-chequea baja y "7 días" con un lock por
 *    email y anota el aviso en el registro) y, si Resend lo rechaza, la libera
 *    (`release_checkout_reminder`). `Idempotency-Key` = `abandoned_cart/<id>`:
 *    Resend la recuerda 24 h; un reintento después de eso no puede duplicar
 *    el mail porque la sesión ya tiene `reminded_at` y no se vuelve a reclamar.
 * 5. El mail lleva `List-Unsubscribe` (URL de baja en un clic + mailto) y
 *    `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058).
 *
 * Usa `SUPABASE_SERVICE_ROLE_KEY` SÓLO acá y SÓLO desde el cron (como
 * trial-notices.ts y activation-notices.ts). Sin esa clave, sin
 * `RESEND_API_KEY` o sin la migración, no manda nada.
 */

const HOUR_MS = 3_600_000;
/** Horas sin tocar el carrito a partir de las que sale el aviso. */
export const REMIND_AFTER_HOURS = 3;
/** Después de estas horas ya no se avisa (el carrito quedó viejo). */
export const REMIND_WITHIN_HOURS = 48;
/** Tope de mails por corrida (el resto sale en la próxima, si sigue en la ventana). */
export const MAX_ABANDONED_PER_RUN = 300;
/** Tope por tienda y por corrida: una tienda no se lleva toda la corrida. */
export const MAX_ABANDONED_PER_STORE = 50;
/** Tope por tienda en prueba (`status = 'trialing'`): cuentas nuevas, menos historia. */
export const MAX_ABANDONED_PER_TRIAL_STORE = 10;
/** Candidatas que se piden a la base (antes de agrupar por email). */
const CANDIDATE_LIMIT = 1000;
/** Presupuesto de tiempo por defecto para mandar (Resend admite ~2 envíos por segundo). */
const DEFAULT_BUDGET_MS = 200_000;

type Admin = SupabaseClient<Database>;

export interface AbandonedSessionItem {
  variantId: string;
  qty: number;
  name: string;
  price: number;
}

/** Sesión candidata tal como la devuelve `abandoned_checkout_candidates`. */
export interface AbandonedSessionRow {
  id: string;
  storeId: string;
  token: string;
  email: string;
  name: string | null;
  items: AbandonedSessionItem[];
  consent: boolean;
  createdAt: string;
  updatedAt: string;
  recoveredOrderId: string | null;
  remindedAt: string | null;
  unsubscribedAt: string | null;
  storeActive: boolean;
  /** La tienda está en los días de prueba. */
  storeTrialing: boolean;
  /** Función prendida y plan que la incluye. */
  enabled: boolean;
  /** El mismo email recibió un aviso de esta tienda en los últimos 7 días. */
  recentlyReminded: boolean;
}

// ---------------------------------------------------------------------------
// Reglas (puras, testeables)
// ---------------------------------------------------------------------------

type Loose = Record<string, unknown>;

function asRecord(value: unknown): Loose {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function time(iso: string | null | undefined): number {
  const t = iso ? new Date(iso).getTime() : Number.NaN;
  return Number.isNaN(t) ? Number.NaN : t;
}

/** jsonb de la RPC → filas tipadas (lo que no tiene forma se descarta). */
export function parseAbandonedCandidates(data: Json | unknown): AbandonedSessionRow[] {
  if (!Array.isArray(data)) return [];
  const out: AbandonedSessionRow[] = [];
  for (const entry of data) {
    const r = asRecord(entry);
    const id = str(r.id);
    const storeId = str(r.store_id);
    const token = str(r.token);
    const email = str(r.email);
    const createdAt = str(r.created_at);
    const updatedAt = str(r.updated_at);
    if (!id || !storeId || !token || !email || !createdAt || !updatedAt) continue;
    const items: AbandonedSessionItem[] = [];
    for (const raw of Array.isArray(r.items) ? r.items : []) {
      const i = asRecord(raw);
      const variantId = str(i.variant_id);
      const qty = Number(i.qty);
      if (!variantId || !Number.isInteger(qty) || qty < 1) continue;
      items.push({ variantId, qty, name: str(i.name) ?? "", price: Number(i.price) || 0 });
    }
    out.push({
      id,
      storeId,
      token,
      email,
      name: str(r.name),
      items,
      consent: r.consent === true,
      createdAt,
      updatedAt,
      recoveredOrderId: str(r.recovered_order_id),
      remindedAt: str(r.reminded_at),
      unsubscribedAt: str(r.unsubscribed_at),
      storeActive: r.store_active === true,
      storeTrialing: r.store_trialing === true,
      enabled: r.enabled === true,
      recentlyReminded: r.recently_reminded === true,
    });
  }
  return out;
}

/** ¿La sesión está para avisar hoy (sin mirar al resto)? */
export function isAbandonedDue(s: AbandonedSessionRow, now: Date): boolean {
  if (!s.consent || s.recoveredOrderId || s.remindedAt || s.unsubscribedAt) return false;
  if (!s.storeActive || !s.enabled || s.recentlyReminded) return false;
  if (!isEmail(s.email) || !s.items.length) return false;
  const idle = now.getTime() - time(s.updatedAt);
  return idle >= REMIND_AFTER_HOURS * HOUR_MS && idle <= REMIND_WITHIN_HOURS * HOUR_MS;
}

/**
 * Qué sesiones avisar en esta corrida: las que están para avisar, una por
 * sesión y una por email y tienda (la del carrito más reciente), hasta
 * `perStore` por tienda (`perTrialStore` si está en prueba), las más viejas
 * primero dentro de cada tienda (son las que primero salen de la ventana) y
 * repartidas por turnos entre tiendas (la más vieja de cada una, después la
 * segunda…), hasta `limit`.
 */
export function pickAbandonedNotices({
  sessions,
  now,
  limit = MAX_ABANDONED_PER_RUN,
  perStore = MAX_ABANDONED_PER_STORE,
  perTrialStore = MAX_ABANDONED_PER_TRIAL_STORE,
}: {
  sessions: AbandonedSessionRow[];
  now: Date;
  limit?: number;
  perStore?: number;
  perTrialStore?: number;
}): AbandonedSessionRow[] {
  const byRecipient = new Map<string, AbandonedSessionRow>();
  const seen = new Set<string>();
  for (const s of sessions) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    if (!isAbandonedDue(s, now)) continue;
    const key = `${s.storeId}|${s.email.trim().toLowerCase()}`;
    const prev = byRecipient.get(key);
    if (!prev || time(s.updatedAt) > time(prev.updatedAt)) byRecipient.set(key, s);
  }
  const oldestFirst = (a: AbandonedSessionRow, b: AbandonedSessionRow) => time(a.updatedAt) - time(b.updatedAt) || a.id.localeCompare(b.id);
  const byStore = new Map<string, AbandonedSessionRow[]>();
  for (const s of [...byRecipient.values()].sort(oldestFirst)) {
    const list = byStore.get(s.storeId) ?? [];
    list.push(s);
    byStore.set(s.storeId, list);
  }
  // Cada tienda con su tope; las tiendas en el orden de su carrito más viejo.
  const queues = [...byStore.values()].map((list) => list.slice(0, Math.max(0, list[0].storeTrialing ? perTrialStore : perStore)));
  const out: AbandonedSessionRow[] = [];
  const max = Math.max(0, limit);
  for (let round = 0; out.length < max; round++) {
    let any = false;
    for (const q of queues) {
      if (round >= q.length) continue;
      any = true;
      out.push(q[round]);
      if (out.length >= max) break;
    }
    if (!any) break;
  }
  return out;
}

/** Estado actual de una variante para el mail. */
export interface MailVariant {
  storeId: string;
  productName: string;
  title: string;
  price: number;
  /** Variante activa de un producto publicado. */
  active: boolean;
  stock: number;
  trackInventory: boolean;
  allowBackorder: boolean;
}

/** Ítems del mail con nombre y precio de hoy; se omite lo que no se vende o no tiene stock. */
export function refreshAbandonedItems(
  items: readonly AbandonedSessionItem[],
  variants: ReadonlyMap<string, MailVariant>,
  storeId: string,
): AbandonedItem[] {
  const out: AbandonedItem[] = [];
  for (const i of items) {
    const v = variants.get(i.variantId);
    if (!v || v.storeId !== storeId || !v.active) continue;
    if (v.trackInventory && !v.allowBackorder && v.stock <= 0) continue;
    const qty = v.trackInventory && !v.allowBackorder ? Math.min(i.qty, v.stock) : i.qty;
    const name = v.title && v.title !== "Default" ? `${v.productName} · ${v.title}` : v.productName;
    out.push({ name, qty, unitPrice: v.price });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Carga (service role)
// ---------------------------------------------------------------------------

let warnedNoServiceKey = false;
let warnedMissing = false;

function serviceClient(): Admin | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || !SUPABASE_URL) {
    if (!warnedNoServiceKey) {
      warnedNoServiceKey = true;
      console.info("[email] SUPABASE_SERVICE_ROLE_KEY no está configurada: no se mandan los avisos de carrito abandonado ni se purgan las sesiones viejas.");
    }
    return null;
  }
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

interface StoreMailInfo {
  slug: string;
  store: StoreEmailInfo;
  legal: { razonSocial: string | null; cuit: string | null };
  currency: string;
  locale: string;
  target: { slug: string; custom_domain: string | null; custom_domain_verified: boolean };
}

export interface AbandonedNotice {
  session: AbandonedSessionRow;
  items: AbandonedItem[];
  info: StoreMailInfo;
}

export interface AbandonedNoticePlan {
  db: Admin;
  notices: AbandonedNotice[];
}

export interface AbandonedNoticeReport {
  abandoned_cart: number;
}

async function loadStores(db: Admin, ids: string[]): Promise<Map<string, StoreMailInfo>> {
  const [storesRes, settingsRes] = await Promise.all([
    db.from("stores").select("id, slug, custom_domain, custom_domain_verified").in("id", ids),
    db
      .from("store_settings")
      .select("store_id, name, logo_url, theme, contact_email, whatsapp_phone, currency, locale, legal")
      .in("store_id", ids),
  ]);
  if (storesRes.error) throw new Error(storesRes.error.message);
  if (settingsRes.error) throw new Error(settingsRes.error.message);
  const settingsById = new Map((settingsRes.data ?? []).map((s) => [s.store_id, s]));
  const out = new Map<string, StoreMailInfo>();
  for (const s of storesRes.data ?? []) {
    const settings = settingsById.get(s.id);
    if (!settings) continue;
    const target = { slug: s.slug, custom_domain: s.custom_domain, custom_domain_verified: s.custom_domain_verified };
    const theme = parseTheme(settings.theme);
    const contact = settings.contact_email?.trim();
    const legal = asRecord(settings.legal);
    out.set(s.id, {
      slug: s.slug,
      target,
      currency: settings.currency || "ARS",
      locale: settings.locale || "es-AR",
      legal: { razonSocial: str(legal.razon_social), cuit: str(legal.cuit) },
      store: {
        name: settings.name,
        url: storeUrl(target),
        logoUrl: settings.logo_url,
        primary: theme.colors.primary,
        primaryText: theme.colors.primaryText,
        contactEmail: isEmail(contact) ? contact : null,
        whatsappUrl: settings.whatsapp_phone ? waLink(settings.whatsapp_phone) : null,
      },
    });
  }
  return out;
}

interface VariantRow {
  id: string;
  store_id: string;
  title: string;
  price: number | string;
  stock: number;
  track_inventory: boolean;
  allow_backorder: boolean;
  is_active: boolean;
  products: { name: string; status: string } | null;
}

async function loadVariants(db: Admin, ids: string[]): Promise<Map<string, MailVariant>> {
  const out = new Map<string, MailVariant>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await db
      .from("product_variants")
      .select("id, store_id, title, price, stock, track_inventory, allow_backorder, is_active, products(name, status)")
      .in("id", chunk);
    if (error) throw new Error(error.message);
    for (const v of (data ?? []) as unknown as VariantRow[]) {
      if (!v.products) continue;
      out.set(v.id, {
        storeId: v.store_id,
        productName: v.products.name,
        title: v.title,
        price: Number(v.price),
        active: v.is_active && v.products.status === "active",
        stock: v.stock,
        trackInventory: v.track_inventory,
        allowBackorder: v.allow_backorder,
      });
    }
  }
  return out;
}

/**
 * Limpieza: sesiones y eventos de más de 30 días (la lista de bajas no se
 * purga). Corre aunque los mails estén apagados; sin la clave de servicio,
 * no. Nunca lanza. Devuelve cuántas sesiones borró (o null si no corrió).
 */
export async function purgeAbandonedSessions(db: Admin | null = serviceClient()): Promise<number | null> {
  if (!db) return null;
  try {
    const { data, error } = await db.rpc("purge_checkout_sessions");
    if (error) {
      if (!isMissingSchemaError(error)) console.error("[email] carritos, limpieza:", error.message);
      return null;
    }
    return typeof data === "number" ? data : 0;
  } catch (err) {
    console.error("[email] carritos, limpieza:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Junta los avisos de esta corrida. `null` = emails apagados, sin clave, sin
 * la migración o error de lectura (el cron sigue igual). Nunca lanza.
 */
export async function collectAbandonedNotices(now: Date = new Date()): Promise<AbandonedNoticePlan | null> {
  if (!emailEnabled()) {
    warnEmailDisabled();
    return null;
  }
  const db = serviceClient();
  if (!db) return null;
  try {
    const { data, error } = await db.rpc("abandoned_checkout_candidates", { p_limit: CANDIDATE_LIMIT });
    if (error) {
      if (isMissingSchemaError(error)) {
        if (!warnedMissing) {
          warnedMissing = true;
          console.info("[email] Falta aplicar la migración 0020: no se mandan avisos de carrito abandonado.");
        }
        return null;
      }
      throw new Error(error.message);
    }
    const picked = pickAbandonedNotices({ sessions: parseAbandonedCandidates(data), now });
    if (!picked.length) return { db, notices: [] };

    const storeIds = [...new Set(picked.map((s) => s.storeId))];
    const variantIds = [...new Set(picked.flatMap((s) => s.items.map((i) => i.variantId)))];
    const [stores, variants] = await Promise.all([loadStores(db, storeIds), loadVariants(db, variantIds)]);

    const notices: AbandonedNotice[] = [];
    for (const session of picked) {
      const info = stores.get(session.storeId);
      if (!info) continue;
      const items = refreshAbandonedItems(session.items, variants, session.storeId);
      if (!items.length) continue;
      notices.push({ session, items, info });
    }
    return { db, notices };
  } catch (err) {
    console.error("[email] avisos de carrito abandonado:", err instanceof Error ? maskEmails(err.message) : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Envío
// ---------------------------------------------------------------------------

/**
 * Reclama la sesión (`claim_checkout_reminder`): `false` si otra corrida ya
 * la tomó, cambió de estado, el email se dio de baja o ya recibió un aviso de
 * la tienda en los últimos 7 días.
 */
async function claim(db: Admin, id: string, at: string): Promise<boolean> {
  const { data, error } = await db.rpc("claim_checkout_reminder", { p_id: id, p_at: at });
  if (error) {
    console.error("[email] carritos, reclamar sesión:", error.message);
    return false;
  }
  return data === true;
}

async function release(db: Admin, id: string, at: string): Promise<void> {
  const { error } = await db.rpc("release_checkout_reminder", { p_id: id, p_at: at });
  if (error) console.error("[email] carritos, liberar sesión:", error.message);
}

/** Casilla para el `mailto:` de `List-Unsubscribe`: `EMAIL_UNSUBSCRIBE_MAILTO` o, si falta, la de la tienda. */
function unsubscribeMailbox(storeContact: string | null | undefined): string | null {
  const env = process.env.EMAIL_UNSUBSCRIBE_MAILTO?.trim();
  if (isEmail(env)) return env;
  return storeContact && isEmail(storeContact) ? storeContact : null;
}

/** `List-Unsubscribe` (URL de baja en un clic y mailto) + `List-Unsubscribe-Post` (RFC 8058). */
export function abandonedUnsubscribeHeaders(token: string, storeContact: string | null | undefined): Record<string, string> {
  const url = `${platformOrigin()}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
  const mailbox = unsubscribeMailbox(storeContact);
  const mailto = mailbox ? `<mailto:${mailbox}?subject=${encodeURIComponent("Baja de avisos de carrito")}>` : null;
  return {
    "List-Unsubscribe": [`<${url}>`, mailto].filter(Boolean).join(", "),
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Manda los avisos juntados por `collectAbandonedNotices`. Nunca lanza. */
export async function deliverAbandonedNotices(
  plan: AbandonedNoticePlan | null,
  now: Date = new Date(),
  budgetMs: number = DEFAULT_BUDGET_MS,
): Promise<AbandonedNoticeReport> {
  const report: AbandonedNoticeReport = { abandoned_cart: 0 };
  if (!plan) return report;
  const deadline = Date.now() + budgetMs;
  const at = now.toISOString();

  for (const n of plan.notices) {
    if (Date.now() > deadline) {
      console.info("[email] carritos: se acabó el tiempo de la corrida; el resto sale en la próxima.");
      break;
    }
    const s = n.session;
    try {
      if (!(await claim(plan.db, s.id, at))) continue;
      const content = abandonedCartEmail(
        {
          customerName: s.name,
          items: n.items,
          currency: n.info.currency,
          locale: n.info.locale,
          recoverUrl: storeUrl(n.info.target, recoverPath(s.token)),
          unsubscribeUrl: storeUrl(n.info.target, recoverPath(s.token, true)),
        },
        n.info.store,
        n.info.legal,
      );
      const result = await sendEmail({
        to: s.email,
        from: storeFrom(n.info.store.name),
        replyTo: n.info.store.contactEmail,
        ...content,
        tags: [
          { name: "kind", value: "abandoned_cart" },
          { name: "store", value: n.info.slug },
        ],
        headers: abandonedUnsubscribeHeaders(s.token, n.info.store.contactEmail),
        // 24 h en Resend; después, `reminded_at` ya impide reclamar la sesión otra vez.
        idempotencyKey: `abandoned_cart/${s.id}`,
      });
      // Si Resend no lo aceptó, la sesión vuelve a quedar pendiente (la próxima corrida reintenta).
      if (!wasSent(result)) {
        await release(plan.db, s.id, at);
        continue;
      }
      report.abandoned_cart++;
    } catch (err) {
      console.error(`[email] carrito abandonado ${n.info.slug}:`, err instanceof Error ? maskEmails(err.message) : err);
      await release(plan.db, s.id, at).catch(() => undefined);
    }
  }
  return report;
}

/**
 * Purga, junta y manda en un paso (lo usan las dos rutas de cron). La purga
 * corre aunque no haya `RESEND_API_KEY`.
 */
export async function runAbandonedNotices(now: Date = new Date(), budgetMs?: number): Promise<AbandonedNoticeReport> {
  await purgeAbandonedSessions();
  return deliverAbandonedNotices(await collectAbandonedNotices(now), now, budgetMs);
}
