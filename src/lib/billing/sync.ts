import type { Json } from "@/lib/supabase/database.types";

import { getAuthorizedPayment, getPreapproval } from "./mercadopago";
import type { BillingDb } from "./service";
import { decideSubscription, isUuid, resolvePlanCode, type BillingDecision } from "./state";
import {
  BILLING_SUBSCRIPTION_COLUMNS,
  isSubscriptionEvent,
  type BillingSubscriptionRow,
  type MpAuthorizedPayment,
  type MpPreapproval,
} from "./types";

/*
 * Sincronización con MercadoPago: lee el recurso en la API de MP (NUNCA se
 * confía en el cuerpo de la notificación), cruza `external_reference` (uuid de
 * la tienda) con `subscriptions.provider_ref` y aplica la decisión de
 * `state.ts` con `billing_apply_subscription` (service role).
 */

export interface BillingRepo {
  listPlans(): Promise<{ code: string; mp_plan_id: string | null }[]>;
  getSubscription(storeId: string): Promise<BillingSubscriptionRow | null>;
  apply(args: { storeId: string; preapprovalId: string; decision: BillingDecision }): Promise<void>;
  /** Registra el evento: `new` (primera vez), `retry` (quedó sin procesar) o `duplicate` (ya procesado). */
  claimEvent(ev: { eventId: string; type: string; resourceId: string; payload: Json }): Promise<"new" | "retry" | "duplicate">;
  finishEvent(eventId: string, args: { storeId: string | null; result: Json }): Promise<void>;
}

export interface MpReader {
  getPreapproval(id: string): Promise<MpPreapproval>;
  getAuthorizedPayment(id: string): Promise<MpAuthorizedPayment>;
}

export const defaultMpReader: MpReader = { getPreapproval, getAuthorizedPayment };

export type IgnoreReason = "type" | "external_reference" | "no_subscription" | "manual" | "provider_ref" | "plan";

export type SyncResult =
  | { outcome: "ignored"; reason: IgnoreReason; storeId: string | null; preapprovalId: string | null }
  | { outcome: "duplicate" }
  | {
      outcome: "applied";
      storeId: string;
      preapprovalId: string;
      previous: BillingSubscriptionRow;
      decision: BillingDecision;
      /** Id del cobro (authorized_payment) que disparó el aviso, si hubo. */
      paymentId: string | null;
    };

/** Texto corto del resultado (logs, `billing_events.result`, UI del superadmin). */
export function describeResult(r: SyncResult): string {
  if (r.outcome === "duplicate") return "Evento repetido: ya estaba procesado.";
  if (r.outcome === "ignored") {
    const why: Record<IgnoreReason, string> = {
      type: "tipo de aviso que no usamos",
      external_reference: "la suscripción de MP no tiene el id de una tienda",
      no_subscription: "la tienda no tiene suscripción",
      manual: "la tienda está en modo manual",
      provider_ref: "no es la suscripción que inició la tienda",
      plan: "el plan de MP no corresponde a ningún plan de Ecommy",
    };
    return `Ignorado: ${why[r.reason]}.`;
  }
  const d = r.decision;
  if (d.status === null) return `MP: ${d.providerStatus}. Sin cambios en el plan.`;
  return `MP: ${d.providerStatus} → ${d.planCode} ${d.status}${d.cancelAtPeriodEnd ? " (no renueva)" : ""}.`;
}

export function resultJson(r: SyncResult): Json {
  if (r.outcome !== "applied") return { ...r, summary: describeResult(r) } as Json;
  return {
    outcome: r.outcome,
    store_id: r.storeId,
    preapproval_id: r.preapprovalId,
    payment_id: r.paymentId,
    previous: { plan_code: r.previous.plan_code, status: r.previous.status, provider_status: r.previous.provider_status },
    decision: { ...r.decision },
    summary: describeResult(r),
  } as Json;
}

/** Relee el preapproval en MP y lo aplica a la tienda que corresponde. */
export async function syncPreapproval(
  preapprovalId: string,
  opts: { payment?: MpAuthorizedPayment | null; now?: Date; expectedStoreId?: string },
  deps: { repo: BillingRepo; mp?: MpReader },
): Promise<SyncResult> {
  const mp = deps.mp ?? defaultMpReader;
  const pre = await mp.getPreapproval(preapprovalId);
  const storeId = pre.external_reference ?? null;
  if (!isUuid(storeId) || (opts.expectedStoreId && opts.expectedStoreId !== storeId)) {
    return { outcome: "ignored", reason: "external_reference", storeId: null, preapprovalId: pre.id ?? preapprovalId };
  }
  const sub = await deps.repo.getSubscription(storeId);
  if (!sub) return { outcome: "ignored", reason: "no_subscription", storeId: null, preapprovalId: pre.id };
  if (sub.provider !== "mercadopago") return { outcome: "ignored", reason: "manual", storeId, preapprovalId: pre.id };
  if (!pre.id || sub.provider_ref !== pre.id) return { outcome: "ignored", reason: "provider_ref", storeId, preapprovalId: pre.id };

  const planCode = resolvePlanCode(pre, await deps.repo.listPlans(), sub.provider_plan_code);
  if (!planCode) return { outcome: "ignored", reason: "plan", storeId, preapprovalId: pre.id };

  const decision = decideSubscription({ preapproval: pre, payment: opts.payment, current: sub, planCode, now: opts.now });
  await deps.repo.apply({ storeId, preapprovalId: pre.id, decision });
  const paymentId = opts.payment?.payment?.id ?? opts.payment?.id ?? null;
  return { outcome: "applied", storeId, preapprovalId: pre.id, previous: sub, decision, paymentId: paymentId === null ? null : String(paymentId) };
}

export interface NotificationInput {
  eventId: string;
  type: string;
  dataId: string;
  payload: Json;
}

/**
 * Procesa una notificación ya validada (firma OK). Idempotente por
 * `eventId`: si ya se procesó, no hace nada; si quedó a medias (error), se
 * reintenta. Lanza si MP o la base fallan (el webhook responde 500 y MP reintenta).
 */
export async function processNotification(input: NotificationInput, deps: { repo: BillingRepo; mp?: MpReader; now?: Date }): Promise<SyncResult> {
  if (!isSubscriptionEvent(input.type)) return { outcome: "ignored", reason: "type", storeId: null, preapprovalId: null };
  const claim = await deps.repo.claimEvent({ eventId: input.eventId, type: input.type, resourceId: input.dataId, payload: input.payload });
  if (claim === "duplicate") return { outcome: "duplicate" };

  const mp = deps.mp ?? defaultMpReader;
  let payment: MpAuthorizedPayment | null = null;
  let preapprovalId = input.dataId;
  if (input.type === "subscription_authorized_payment") {
    payment = await mp.getAuthorizedPayment(input.dataId);
    preapprovalId = payment.preapproval_id;
  }
  const result = await syncPreapproval(preapprovalId, { payment, now: deps.now }, { repo: deps.repo, mp });
  const storeId = result.outcome === "applied" || result.outcome === "ignored" ? result.storeId : null;
  await deps.repo.finishEvent(input.eventId, { storeId, result: resultJson(result) });
  return result;
}

/** Repo sobre Supabase (service role). */
export function supabaseBillingRepo(db: BillingDb): BillingRepo {
  return {
    async listPlans() {
      const { data, error } = await db.from("plans").select("code, mp_plan_id");
      if (error) throw new Error(`plans: ${error.message}`);
      return data ?? [];
    },
    async getSubscription(storeId) {
      const { data, error } = await db.from("subscriptions").select(BILLING_SUBSCRIPTION_COLUMNS).eq("store_id", storeId).maybeSingle();
      if (error) throw new Error(`subscriptions: ${error.message}`);
      return (data as BillingSubscriptionRow | null) ?? null;
    },
    async apply({ storeId, preapprovalId, decision }) {
      const { error } = await db.rpc("billing_apply_subscription", {
        p_store_id: storeId,
        p_plan_code: decision.planCode,
        p_status: decision.status,
        p_provider_ref: preapprovalId,
        p_period_start: decision.periodStart,
        p_period_end: decision.periodEnd,
        p_provider_status: decision.providerStatus,
        p_cancel_at_period_end: decision.cancelAtPeriodEnd,
        p_last_payment_at: decision.lastPaymentAt,
      });
      if (error) throw new Error(`billing_apply_subscription: ${error.message}`);
    },
    async claimEvent({ eventId, type, resourceId, payload }) {
      const { error } = await db
        .from("billing_events")
        .insert({ event_id: eventId, type, resource_id: resourceId, payload, provider: "mercadopago" });
      if (!error) return "new";
      if (error.code !== "23505") throw new Error(`billing_events: ${error.message}`);
      const { data, error: readError } = await db.from("billing_events").select("processed_at").eq("event_id", eventId).maybeSingle();
      if (readError) throw new Error(`billing_events: ${readError.message}`);
      return data?.processed_at ? "duplicate" : "retry";
    },
    async finishEvent(eventId, { storeId, result }) {
      const { error } = await db
        .from("billing_events")
        .update({ processed_at: new Date().toISOString(), store_id: storeId, result })
        .eq("event_id", eventId);
      if (error) console.error("[billing] no se pudo cerrar el evento:", error.message);
    },
  };
}
