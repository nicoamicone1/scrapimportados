import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/supabase/database.types";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { platformOrigin, storeUrl } from "@/lib/tenant/urls";

import { emailEnabled, isEmail, platformFrom, sendEmail, wasSent, warnEmailDisabled } from "./send";
import { firstOrderEmail, isApparelKind, noProductsEmail, shareStoreEmail } from "./templates";

/*
 * Avisos de activación para tiendas nuevas (cron diario, /api/cron/daily).
 * Siguen el embudo de docs/LAUNCH-PLAN.md §2 y docs/gtm/PLAN-GTM.md §10:
 * 48 h sin productos → día 3 prueba de fuego → día 7 compartir.
 *
 *  1. `activation_no_products` (día 2): la tienda tiene ≥ 48 h y 0 productos
 *     no archivados. Si llega al día 7 (hasta el 30) sin productos y este
 *     aviso nunca salió, sale igual (una sola vez en total).
 *  2. `activation_first_order` (día 3 a 30, "la prueba de fuego"): en prueba
 *     vigente, ≥ 1 producto activo y sin pedido real. Pedido real = pedido
 *     web no cancelado cuyo email de comprador no es el del dueño (la misma
 *     definición que las consultas de docs/LAUNCH-PLAN.md §2.2, con
 *     `profiles.email`). Si a la vez le toca el 3, sale primero este.
 *  3. `activation_share` (día 7 a 30): ≥ 1 producto activo, el dueño no marcó
 *     `onboarding.shared` y la tienda no tiene pedidos.
 *
 * Una tienda recibe como máximo UN aviso por corrida y nunca dos con menos de
 * `MIN_GAP_DAYS` entre sí. Sólo tiendas `active` y dueños no suspendidos
 * (auth `banned_until` en el futuro).
 *
 * Igual que trial-notices.ts: usa `SUPABASE_SERVICE_ROLE_KEY` SÓLO acá y
 * SÓLO desde el cron. Sin esa clave o sin `RESEND_API_KEY`, no hace nada.
 *
 * Idempotencia: `stores.onboarding.notices[kind] = <ISO del envío>`, escrito
 * sólo si Resend aceptó el mail y releyendo `onboarding` antes de escribir.
 * Además, `Idempotency-Key` = `<kind>/<store_id>` (24 h en Resend).
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Horas desde el alta a partir de las que sale el aviso de "sin productos". */
export const NO_PRODUCTS_AFTER_HOURS = 48;
/** Día a partir del que sale "la prueba de fuego" (primer pedido real). */
export const FIRST_ORDER_AFTER_DAYS = 3;
/** Día a partir del que sale el aviso de "compartí la tienda". */
export const SHARE_AFTER_DAYS = 7;
/** Después de este día ya no se manda ningún aviso de activación. */
export const ACTIVATION_WINDOW_DAYS = 30;
/** Días mínimos entre dos avisos de activación a la misma tienda. */
export const MIN_GAP_DAYS = 2;
/** Tiendas candidatas por corrida (las más nuevas primero). */
export const ACTIVATION_STORE_LIMIT = 200;
/** Consultas de conteo en paralelo (una tienda = 1 a 4 consultas `head`). */
const COUNT_CONCURRENCY = 8;
/** Presupuesto de tiempo para mandar (Resend admite ~2 envíos por segundo). */
const DELIVERY_BUDGET_MS = 180_000;

export type ActivationKind = "activation_no_products" | "activation_first_order" | "activation_share";
export const ACTIVATION_KINDS: readonly ActivationKind[] = ["activation_no_products", "activation_first_order", "activation_share"];

type Admin = SupabaseClient<Database>;

/** Tienda candidata con todo lo que hace falta para decidir (filas ya cargadas). */
export interface ActivationStoreRow {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: string;
  onboarding: Json;
  customDomain: string | null;
  customDomainVerified: boolean;
  /** Productos no archivados (borradores incluidos). */
  products: number;
  /** Productos activos; `null` = no se contaron (no hacía falta). */
  activeProducts: number | null;
  /** Pedidos de la tienda (cualquier estado); `null` = no se contaron. */
  orders: number | null;
  /**
   * Pedidos reales: web, no cancelados, de un comprador que no es el dueño;
   * `null` = no se contaron (o no se sabe el email del dueño).
   */
  realOrders: number | null;
  owner: { email: string | null; name: string | null; suspended: boolean } | null;
  /** Fin de la prueba de Pro si la tienda sigue en prueba. */
  trialEndsAt: string | null;
}

export interface ActivationNotice {
  kind: ActivationKind;
  store: ActivationStoreRow;
  /** Email del dueño. */
  to: string;
}

export interface ActivationNoticePlan {
  db: Admin;
  notices: ActivationNotice[];
}

export interface ActivationNoticeReport {
  activation_no_products: number;
  activation_first_order: number;
  activation_share: number;
}

// ---------------------------------------------------------------------------
// Reglas (puras, testeables)
// ---------------------------------------------------------------------------

function asRecord(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function time(iso: string | null | undefined): number {
  const t = iso ? new Date(iso).getTime() : Number.NaN;
  return Number.isNaN(t) ? Number.NaN : t;
}

/** Fecha (ISO) en que salió el aviso `kind`, o null. */
export function activationSentAt(onboarding: Json, kind: ActivationKind): string | null {
  const sent = asRecord(asRecord(onboarding).notices)[kind];
  return typeof sent === "string" && sent ? sent : null;
}

/** onboarding con la marca de `kind` (conserva el resto de las claves). */
export function withActivationNotice(onboarding: Json, kind: ActivationKind, sentAt: string): Json {
  const current = asRecord(onboarding);
  return { ...current, notices: { ...asRecord(current.notices), [kind]: sentAt } } as Json;
}

/** "early" = día 2 a 7, "late" = día 7 a 30, null = fuera de la ventana. */
export function activationWindow(createdAt: string, now: Date): "early" | "late" | null {
  const age = now.getTime() - time(createdAt);
  if (!(age >= NO_PRODUCTS_AFTER_HOURS * HOUR_MS) || age >= ACTIVATION_WINDOW_DAYS * DAY_MS) return null;
  return age >= SHARE_AFTER_DAYS * DAY_MS ? "late" : "early";
}

/** ¿Ya pasaron los 3 días de la prueba de fuego? (dentro de la ventana de 30). */
function firstOrderAge(createdAt: string, now: Date): boolean {
  return activationWindow(createdAt, now) !== null && now.getTime() - time(createdAt) >= FIRST_ORDER_AFTER_DAYS * DAY_MS;
}

/** ¿La prueba de Pro sigue vigente? */
function inTrial(trialEndsAt: string | null, now: Date): boolean {
  return time(trialEndsAt) > now.getTime();
}

type StoreBasics = Pick<ActivationStoreRow, "status" | "createdAt" | "onboarding">;

/**
 * ¿Vale la pena contar productos/pedidos de esta tienda? Descarta sin
 * consultar las que no están activas, están fuera de ventana o ya recibieron
 * lo que podían recibir.
 */
export function mayNeedActivation(store: StoreBasics, now: Date): boolean {
  if (store.status !== "active") return false;
  const win = activationWindow(store.createdAt, now);
  if (!win) return false;
  if (!activationSentAt(store.onboarding, "activation_no_products")) return true;
  if (canFirstOrder(store, now)) return true;
  return win === "late" && canShare(store.onboarding);
}

function canShare(onboarding: Json): boolean {
  return asRecord(onboarding).shared !== true && !activationSentAt(onboarding, "activation_share");
}

/** Edad y marca de la prueba de fuego (lo demás se cuenta). */
function canFirstOrder(store: Pick<StoreBasics, "createdAt" | "onboarding">, now: Date): boolean {
  return firstOrderAge(store.createdAt, now) && !activationSentAt(store.onboarding, "activation_first_order");
}

/**
 * ¿Hay que contar pedidos reales? Con productos, en prueba vigente, día 3 o
 * más y sin la prueba de fuego enviada (pura: la usa la carga y los tests).
 */
export function needsRealOrderCount(
  store: Pick<ActivationStoreRow, "createdAt" | "onboarding" | "products" | "trialEndsAt">,
  now: Date,
): boolean {
  return store.products > 0 && inTrial(store.trialEndsAt, now) && canFirstOrder(store, now);
}

/** Qué aviso le corresponde a la tienda hoy (sin mirar al dueño), o null. */
export function activationKind(store: Omit<ActivationStoreRow, "owner">, now: Date): ActivationKind | null {
  if (!mayNeedActivation(store, now)) return null;
  const win = activationWindow(store.createdAt, now);
  // Nunca dos avisos seguidos: el siguiente espera MIN_GAP_DAYS desde el último.
  const last = Math.max(
    ...ACTIVATION_KINDS.map((k) => time(activationSentAt(store.onboarding, k))).filter((t) => !Number.isNaN(t)),
    Number.NEGATIVE_INFINITY,
  );
  if (now.getTime() - last < MIN_GAP_DAYS * DAY_MS) return null;

  if (store.products === 0) {
    return activationSentAt(store.onboarding, "activation_no_products") ? null : "activation_no_products";
  }
  // Conteos que no se hicieron (null): no se asume nada.
  if (needsRealOrderCount(store, now) && (store.activeProducts ?? 0) >= 1 && store.realOrders === 0) {
    return "activation_first_order";
  }
  if (win === "late" && canShare(store.onboarding) && (store.activeProducts ?? 0) >= 1 && store.orders === 0) {
    return "activation_share";
  }
  return null;
}

/** Qué mandar a quién: un aviso por tienda como máximo, sólo a dueños con email y no suspendidos. */
export function pickActivationNotices({ stores, now }: { stores: ActivationStoreRow[]; now: Date }): ActivationNotice[] {
  const out: ActivationNotice[] = [];
  const seen = new Set<string>();
  for (const store of stores) {
    if (seen.has(store.id)) continue;
    const kind = activationKind(store, now);
    const to = store.owner?.email?.trim();
    if (!kind || !store.owner || store.owner.suspended || !isEmail(to)) continue;
    seen.add(store.id);
    out.push({ kind, store, to });
  }
  return out;
}

/** Días enteros desde el alta (para el texto del mail). */
export function daysSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - time(iso)) / DAY_MS));
}

/** Días que le quedan a la prueba (para arriba; 0 si no hay o venció). */
export function daysUntil(iso: string | null, now: Date): number {
  const ms = time(iso) - now.getTime();
  return ms > 0 ? Math.ceil(ms / DAY_MS) : 0;
}

// ---------------------------------------------------------------------------
// Carga (service role)
// ---------------------------------------------------------------------------

let warnedNoServiceKey = false;

function serviceClient(): Admin | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || !SUPABASE_URL) {
    if (!warnedNoServiceKey) {
      warnedNoServiceKey = true;
      console.info("[email] SUPABASE_SERVICE_ROLE_KEY no está configurada: no se mandan los avisos de activación.");
    }
    return null;
  }
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** `map` con a lo sumo `limit` promesas en vuelo. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function countOf(query: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number | null> {
  const { count, error } = await query;
  if (error) {
    console.error("[email] activación, conteo:", error.message);
    return null;
  }
  return count ?? 0;
}

interface OwnerInfo {
  email: string | null;
  suspended: boolean;
}

/** Email actual y suspensión de cada dueño (auth.users); si la Admin API falla, queda profiles. */
async function authOwners(db: Admin, ids: string[], now: Date): Promise<Map<string, OwnerInfo>> {
  const out = new Map<string, OwnerInfo>();
  await mapLimit(ids, COUNT_CONCURRENCY, async (id) => {
    try {
      const { data } = await db.auth.admin.getUserById(id);
      const user = data.user;
      if (!user) return;
      const email = user.email?.trim();
      const bannedUntil = time(user.banned_until ?? null);
      out.set(id, {
        email: isEmail(email) ? email : null,
        suspended: !Number.isNaN(bannedUntil) && bannedUntil > now.getTime(),
      });
    } catch {
      // respaldo: profiles.email
    }
  });
  return out;
}

/**
 * Junta los avisos de activación de hoy. `null` = emails apagados o error de
 * lectura (el cron sigue igual). Nunca lanza.
 */
export async function collectActivationNotices(now: Date = new Date()): Promise<ActivationNoticePlan | null> {
  if (!emailEnabled()) {
    warnEmailDisabled();
    return null;
  }
  const db = serviceClient();
  if (!db) return null;
  try {
    const newest = new Date(now.getTime() - NO_PRODUCTS_AFTER_HOURS * HOUR_MS).toISOString();
    const oldest = new Date(now.getTime() - ACTIVATION_WINDOW_DAYS * DAY_MS).toISOString();
    const { data: stores, error } = await db
      .from("stores")
      .select("id, slug, name, status, owner_id, onboarding, custom_domain, custom_domain_verified, created_at")
      .eq("status", "active")
      .neq("slug", "demo")
      .lte("created_at", newest)
      .gt("created_at", oldest)
      // Descarta en la base las que ya recibieron los tres avisos.
      .or(
        "onboarding->notices->>activation_no_products.is.null,onboarding->notices->>activation_first_order.is.null,onboarding->notices->>activation_share.is.null",
      )
      .order("created_at", { ascending: false })
      .limit(ACTIVATION_STORE_LIMIT);
    if (error) throw new Error(error.message);

    const candidates = (stores ?? []).filter(
      (s) => s.owner_id && mayNeedActivation({ status: s.status, createdAt: s.created_at, onboarding: s.onboarding }, now),
    );
    if (!candidates.length) return { db, notices: [] };

    // Dueños (profiles) y pruebas de las candidatas: la prueba de fuego
    // necesita saber si sigue en prueba y el email del dueño antes de contar.
    const ownerIds = [...new Set(candidates.map((s) => s.owner_id as string))];
    const [profilesRes, subsRes] = await Promise.all([
      db.from("profiles").select("id, email, name").in("id", ownerIds),
      db.from("subscriptions").select("store_id, status, trial_ends_at").in("store_id", candidates.map((s) => s.id)),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    // Sin suscripciones sólo se pierden la prueba de fuego y el recordatorio de la prueba.
    if (subsRes.error) console.error("[email] activación, suscripciones:", subsRes.error.message);
    const profileById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
    const trialByStore = new Map(
      (subsRes.data ?? [])
        .filter((s) => s.status === "trialing" && s.trial_ends_at && daysUntil(s.trial_ends_at, now) > 0)
        .map((s) => [s.store_id, s.trial_ends_at as string]),
    );

    // Conteos por tienda (head: sin traer filas). Activos, pedidos y pedidos
    // reales sólo si puede tocar "compartir" o "la prueba de fuego".
    const counted = await mapLimit(candidates, COUNT_CONCURRENCY, async (s) => {
      const head = { count: "exact" as const, head: true };
      const products = await countOf(db.from("products").select("id", head).eq("store_id", s.id).neq("status", "archived"));
      if (products === null) return null;
      const ownerId = s.owner_id as string;
      const trialEndsAt = trialByStore.get(s.id) ?? null;
      const lateShare = products > 0 && activationWindow(s.created_at, now) === "late" && canShare(s.onboarding);
      const ownerEmail = profileById.get(ownerId)?.email?.trim().toLowerCase();
      const firstOrder =
        isEmail(ownerEmail) && needsRealOrderCount({ createdAt: s.created_at, onboarding: s.onboarding, products, trialEndsAt }, now);
      const [activeProducts, orders, realOrders] = await Promise.all([
        lateShare || firstOrder
          ? countOf(db.from("products").select("id", head).eq("store_id", s.id).eq("status", "active"))
          : Promise.resolve(null),
        lateShare ? countOf(db.from("orders").select("id", head).eq("store_id", s.id)) : Promise.resolve(null),
        firstOrder && ownerEmail
          ? countOf(
              db
                .from("orders")
                .select("id", head)
                .eq("store_id", s.id)
                .eq("source", "web")
                .neq("status", "cancelled")
                // El checkout guarda el email en minúsculas; sin email cuenta como de un tercero (como en §2.2).
                .or(`customer->>email.is.null,customer->>email.neq."${ownerEmail}"`),
            )
          : Promise.resolve(null),
      ]);
      const row: Omit<ActivationStoreRow, "owner"> & { ownerId: string } = {
        id: s.id,
        slug: s.slug,
        name: s.name,
        status: s.status,
        createdAt: s.created_at,
        onboarding: s.onboarding,
        customDomain: s.custom_domain,
        customDomainVerified: s.custom_domain_verified,
        products,
        activeProducts,
        orders,
        realOrders,
        trialEndsAt,
        ownerId,
      };
      return activationKind(row, now) ? row : null;
    });
    const due = counted.filter((r): r is NonNullable<typeof r> => r !== null);
    if (!due.length) return { db, notices: [] };

    const authById = await authOwners(db, [...new Set(due.map((r) => r.ownerId))], now);
    const rows: ActivationStoreRow[] = due.map(({ ownerId, ...row }) => {
      const profile = profileById.get(ownerId);
      const auth = authById.get(ownerId);
      // El email de auth.users manda (profiles.email no sigue un cambio de email).
      const email = [auth?.email, profile?.email].find(isEmail) ?? null;
      return {
        ...row,
        owner: profile || auth ? { email, name: profile?.name ?? null, suspended: auth?.suspended ?? false } : null,
      };
    });
    return { db, notices: pickActivationNotices({ stores: rows, now }) };
  } catch (err) {
    console.error("[email] avisos de activación:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Envío
// ---------------------------------------------------------------------------

/** Marca el aviso releyendo `onboarding` (el dueño pudo tildar un paso mientras tanto). */
async function markActivation(db: Admin, n: ActivationNotice, sentAt: string): Promise<void> {
  const { data, error: readError } = await db.from("stores").select("onboarding").eq("id", n.store.id).maybeSingle();
  if (readError) console.error(`[email] no se pudo leer onboarding de ${n.store.slug}:`, readError.message);
  const current = data ? data.onboarding : n.store.onboarding;
  const { error } = await db
    .from("stores")
    .update({ onboarding: withActivationNotice(current, n.kind, sentAt) })
    .eq("id", n.store.id);
  if (error) console.error(`[email] no se pudo marcar ${n.kind} en ${n.store.slug}:`, error.message);
}

/**
 * Manda los avisos juntados por `collectActivationNotices` y marca cada
 * tienda. Nunca lanza. Las tiendas en `skip` (a las que hoy ya les salió un
 * aviso de prueba) esperan a la próxima corrida.
 */
export async function deliverActivationNotices(
  plan: ActivationNoticePlan | null,
  now: Date = new Date(),
  skip?: ReadonlySet<string>,
): Promise<ActivationNoticeReport> {
  const report: ActivationNoticeReport = { activation_no_products: 0, activation_first_order: 0, activation_share: 0 };
  if (!plan) return report;
  const platformUrl = platformOrigin();
  const support = process.env.PLATFORM_EMAIL?.trim();
  const supportEmail = isEmail(support) ? support : null;
  const deadline = Date.now() + DELIVERY_BUDGET_MS;

  for (const n of plan.notices) {
    if (Date.now() > deadline) {
      console.info("[email] avisos de activación: se acabó el tiempo de la corrida; el resto sale mañana.");
      break;
    }
    const s = n.store;
    if (skip?.has(s.id)) continue;
    try {
      const base = {
        storeName: s.name,
        storeUrl: storeUrl({ slug: s.slug, custom_domain: s.customDomain, custom_domain_verified: s.customDomainVerified }),
        platformUrl,
        ownerName: s.owner?.name ?? null,
        supportEmail,
      };
      const trialDaysLeft = daysUntil(s.trialEndsAt, now);
      const content =
        n.kind === "activation_no_products"
          ? noProductsEmail({ ...base, daysSinceCreated: daysSince(s.createdAt, now), trialDaysLeft })
          : n.kind === "activation_first_order"
            ? firstOrderEmail({ ...base, activeProducts: s.activeProducts ?? 1, apparel: isApparelKind(asRecord(s.onboarding).kind) })
            : shareStoreEmail({ ...base, activeProducts: s.activeProducts ?? 1, trialEndsAt: s.trialEndsAt, trialDaysLeft });
      const result = await sendEmail({
        to: n.to,
        from: platformFrom(),
        replyTo: supportEmail,
        ...content,
        tags: [
          { name: "kind", value: n.kind },
          { name: "store", value: s.slug },
        ],
        idempotencyKey: `${n.kind}/${s.id}`,
      });
      // Sólo se marca si Resend lo aceptó: si falló, mañana se reintenta.
      if (!wasSent(result)) continue;
      report[n.kind]++;
      await markActivation(plan.db, n, now.toISOString());
    } catch (err) {
      console.error(`[email] ${n.kind} ${s.slug}:`, err instanceof Error ? err.message : err);
    }
  }
  return report;
}
