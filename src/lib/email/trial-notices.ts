import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/supabase/database.types";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { platformOrigin, storeUrl } from "@/lib/tenant/urls";

import { emailEnabled, isEmail, platformFrom, sendEmail, wasSent, warnEmailDisabled } from "./send";
import { trialEndedEmail, trialEndingEmail } from "./templates";

/*
 * Avisos de fin de la prueba de Pro (cron diario, /api/cron/daily).
 *
 * El cron corre sin sesión y la app sólo tiene la clave anon, que no puede
 * leer suscripciones ni emails de dueños (bien: no hay que abrir eso a anon).
 * Por eso estos avisos usan `SUPABASE_SERVICE_ROLE_KEY`, SÓLO en este módulo
 * y SÓLO desde el cron (protegido con CRON_SECRET). Sin esa clave o sin
 * `RESEND_API_KEY`, no se hace nada.
 *
 * Idempotencia: `stores.onboarding.notices[kind] = <trial_ends_at>` (jsonb
 * que ya existe; `markOnboarding` conserva las claves que no conoce). Se
 * guarda la FECHA de fin a la que se refiere el aviso, así si el superadmin
 * extiende la prueba, el aviso de la nueva fecha vuelve a salir una vez.
 */

const DAY_MS = 86_400_000;
/** "Tu prueba termina en N días": se avisa cuando faltan 3 días o menos. */
export const TRIAL_ENDING_WINDOW_DAYS = 3;

type Kind = "trial_ending" | "trial_ended";
type Admin = SupabaseClient<Database>;

interface Notice {
  kind: Kind;
  storeId: string;
  slug: string;
  name: string;
  customDomain: string | null;
  customDomainVerified: boolean;
  onboarding: Json;
  ownerEmail: string;
  ownerName: string | null;
  trialEndsAt: string;
}

export interface TrialNoticePlan {
  db: Admin;
  ending: Notice[];
  /** Pruebas ya vencidas que `run_daily_maintenance()` va a pasar a Free. */
  ended: Notice[];
}

export interface TrialNoticeReport {
  trial_ending: number;
  trial_ended: number;
}

let warnedNoServiceKey = false;

function serviceClient(): Admin | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || !SUPABASE_URL) {
    if (!warnedNoServiceKey) {
      warnedNoServiceKey = true;
      console.info("[email] SUPABASE_SERVICE_ROLE_KEY no está configurada: no se mandan los avisos de fin de prueba.");
    }
    return null;
  }
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function asRecord(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** ¿Ya se avisó `kind` para ESTA fecha de fin? (puro, testeable) */
export function alreadyNotified(onboarding: Json, kind: Kind, trialEndsAt: string): boolean {
  const sent = asRecord(asRecord(onboarding).notices)[kind];
  return typeof sent === "string" && new Date(sent).getTime() === new Date(trialEndsAt).getTime();
}

/** onboarding con la marca de `kind` (conserva el resto de las claves). */
export function withNotice(onboarding: Json, kind: Kind, trialEndsAt: string): Json {
  const current = asRecord(onboarding);
  return { ...current, notices: { ...asRecord(current.notices), [kind]: trialEndsAt } } as Json;
}

/**
 * Junta los avisos a mandar. Hay que llamarla ANTES de `run_daily_maintenance()`,
 * que borra `trial_ends_at` de las pruebas vencidas. `null` = emails apagados.
 */
export async function collectTrialNotices(now: Date = new Date()): Promise<TrialNoticePlan | null> {
  if (!emailEnabled()) {
    warnEmailDisabled();
    return null;
  }
  const db = serviceClient();
  if (!db) return null;
  try {
    const horizon = new Date(now.getTime() + TRIAL_ENDING_WINDOW_DAYS * DAY_MS).toISOString();
    const { data: subs, error } = await db
      .from("subscriptions")
      .select("store_id, trial_ends_at")
      .eq("status", "trialing")
      .not("trial_ends_at", "is", null)
      .lte("trial_ends_at", horizon);
    if (error) throw new Error(error.message);
    if (!subs?.length) return { db, ending: [], ended: [] };

    const { data: stores, error: storesError } = await db
      .from("stores")
      .select("id, slug, name, status, owner_id, onboarding, custom_domain, custom_domain_verified")
      .in("id", subs.map((s) => s.store_id))
      .neq("status", "deleted");
    if (storesError) throw new Error(storesError.message);
    const ownerIds = [...new Set((stores ?? []).map((s) => s.owner_id).filter((id): id is string => Boolean(id)))];
    const { data: owners, error: ownersError } = ownerIds.length
      ? await db.from("profiles").select("id, email, name").in("id", ownerIds)
      : { data: [], error: null };
    if (ownersError) throw new Error(ownersError.message);

    const storeById = new Map((stores ?? []).map((s) => [s.id, s]));
    const ownerById = new Map((owners ?? []).map((p) => [p.id, p]));
    const emailById = await authEmails(db, ownerIds);
    const plan: TrialNoticePlan = { db, ending: [], ended: [] };

    for (const sub of subs) {
      const store = storeById.get(sub.store_id);
      const owner = store?.owner_id ? ownerById.get(store.owner_id) : undefined;
      // El email de auth.users manda (profiles.email se copia sólo al registrarse
      // y no sigue un cambio de email); profiles queda de respaldo.
      const ownerEmail = store?.owner_id ? [emailById.get(store.owner_id), owner?.email].find(isEmail) : undefined;
      if (!store || !ownerEmail || !sub.trial_ends_at) continue;
      const kind: Kind = new Date(sub.trial_ends_at).getTime() <= now.getTime() ? "trial_ended" : "trial_ending";
      if (alreadyNotified(store.onboarding, kind, sub.trial_ends_at)) continue;
      const notice: Notice = {
        kind,
        storeId: store.id,
        slug: store.slug,
        name: store.name,
        customDomain: store.custom_domain,
        customDomainVerified: store.custom_domain_verified,
        onboarding: store.onboarding,
        ownerEmail,
        ownerName: owner?.name ?? null,
        trialEndsAt: sub.trial_ends_at,
      };
      (kind === "trial_ended" ? plan.ended : plan.ending).push(notice);
    }
    return plan;
  } catch (err) {
    console.error("[email] avisos de prueba:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Email actual de cada dueño en auth.users (si la Admin API falla, queda profiles). */
async function authEmails(db: Admin, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const { data } = await db.auth.admin.getUserById(id);
        const email = data.user?.email?.trim();
        if (isEmail(email)) out.set(id, email);
      } catch {
        // respaldo: profiles.email
      }
    }),
  );
  return out;
}

/** Marca el aviso releyendo `onboarding` (el dueño pudo tildar un paso mientras tanto). */
async function markNotice(db: Admin, n: Notice): Promise<void> {
  const { data, error: readError } = await db.from("stores").select("onboarding").eq("id", n.storeId).maybeSingle();
  if (readError) console.error(`[email] no se pudo leer onboarding de ${n.slug}:`, readError.message);
  const current = data ? data.onboarding : n.onboarding;
  const { error } = await db.from("stores").update({ onboarding: withNotice(current, n.kind, n.trialEndsAt) }).eq("id", n.storeId);
  if (error) console.error(`[email] no se pudo marcar ${n.kind} en ${n.slug}:`, error.message);
}

/**
 * Manda los avisos juntados por `collectTrialNotices` (los de "terminó" sólo
 * si el mantenimiento corrió bien) y marca cada tienda. Nunca lanza.
 */
/**
 * Manda los avisos de prueba y marca cada tienda. `sent`, si se pasa, recibe
 * los `store_id` a los que les salió algo: el cron se lo pasa a los avisos
 * de activación para que una dueña no reciba dos mails el mismo día.
 */
export async function deliverTrialNotices(
  plan: TrialNoticePlan | null,
  now: Date = new Date(),
  sent?: Set<string>,
): Promise<TrialNoticeReport> {
  const report: TrialNoticeReport = { trial_ending: 0, trial_ended: 0 };
  if (!plan) return report;
  const platformUrl = platformOrigin();
  const support = process.env.PLATFORM_EMAIL?.trim();
  const supportEmail = isEmail(support) ? support : null;

  for (const n of [...plan.ending, ...plan.ended]) {
    try {
      const base = {
        storeName: n.name,
        storeUrl: storeUrl({ slug: n.slug, custom_domain: n.customDomain, custom_domain_verified: n.customDomainVerified }),
        platformUrl,
        ownerName: n.ownerName,
        supportEmail,
      };
      const content =
        n.kind === "trial_ending"
          ? trialEndingEmail({
              ...base,
              trialEndsAt: n.trialEndsAt,
              daysLeft: Math.max(1, Math.ceil((new Date(n.trialEndsAt).getTime() - now.getTime()) / DAY_MS)),
            })
          : trialEndedEmail({ ...base, endedAt: n.trialEndsAt });
      const result = await sendEmail({
        to: n.ownerEmail,
        from: platformFrom(),
        replyTo: supportEmail,
        ...content,
        tags: [
          { name: "kind", value: n.kind },
          { name: "store", value: n.slug },
        ],
        idempotencyKey: `${n.kind}/${n.storeId}/${n.trialEndsAt}`,
      });
      // Sólo se marca si Resend lo aceptó: si falló, mañana se reintenta.
      if (!wasSent(result)) continue;
      report[n.kind]++;
      sent?.add(n.storeId);
      await markNotice(plan.db, n);
    } catch (err) {
      console.error(`[email] ${n.kind} ${n.slug}:`, err instanceof Error ? err.message : err);
    }
  }
  return report;
}
