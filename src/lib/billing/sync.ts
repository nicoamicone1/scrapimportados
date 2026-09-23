import type { Json } from "@/lib/supabase/database.types";

import { cancelPreapproval, getAuthorizedPayment, getPreapproval, MercadoPagoError } from "./mercadopago";
import type { BillingDb } from "./service";
import {
  decideSubscription,
  isChargingStatus,
  parseExternalReference,
  recurringMatchesPlan,
  resolvePlan,
  type BillingDecision,
  type BillingPlan,
} from "./state";
import {
  BILLING_SUBSCRIPTION_COLUMNS,
  isSubscriptionEvent,
  type BillingSubscriptionRow,
  type MpAuthorizedPayment,
  type MpPreapproval,
} from "./types";

/*
 * Sincronización con MercadoPago: lee el recurso en la API de MP (NUNCA se
 * confía en el cuerpo de la notificación), cruza `external_reference`
 * (`<store_id>:<plan_code>[:yearly]`) con `subscriptions.provider_ref` y aplica la
 * decisión de `state.ts` con `billing_apply_subscription` (service role).
 */

/** Error de la base con el código de Postgres / PostgREST (para decidir si se reintenta). */
export class BillingDbError extends Error {
  readonly code: string;
  constructor(what: string, error: { message: string; code?: string | null }) {
    super(`${what}: ${error.message}`);
    this.name = "BillingDbError";
    this.code = error.code ?? "";
  }
}

/**
 * ¿Conviene que MercadoPago reintente el aviso (webhook → 500)? Sólo ante
 * fallas transitorias: MP caído, sin conexión o con límite (status 0, 5xx,
 * 429) o la base sin responder. Un 4xx de MP, un `raise` de negocio (P0001) o
 * un dato inválido (22xxx / 23xxx) no se arreglan reintentando.
 */
export function isRetryableBillingError(err: unknown): boolean {
  if (err instanceof MercadoPagoError) return err.status === 0 || err.status === 429 || err.status >= 500;
  if (err instanceof BillingDbError) return !(err.code === "P0001" || /^2[23]/.test(err.code));
  return false;
}

export interface BillingRepo {
  listPlans(): Promise<BillingPlan[]>;
  getSubscription(storeId: string): Promise<BillingSubscriptionRow | null>;
  apply(args: { storeId: string; preapprovalId: string; decision: BillingDecision; adopt?: boolean }): Promise<void>;
  /** Registra el evento: `new` (primera vez), `retry` (quedó sin procesar) o `duplicate` (ya procesado). */
  claimEvent(ev: { eventId: string; type: string; resourceId: string; payload: Json }): Promise<"new" | "retry" | "duplicate">;
  finishEvent(eventId: string, args: { storeId: string | null; result: Json }): Promise<void>;
}

export interface MpReader {
  getPreapproval(id: string): Promise<MpPreapproval>;
  getAuthorizedPayment(id: string): Promise<MpAuthorizedPayment>;
  /** Para cancelar un preapproval duplicado de una tienda que ya paga con otro. */
  cancelPreapproval(id: string): Promise<unknown>;
}

export const defaultMpReader: MpReader = { getPreapproval, getAuthorizedPayment, cancelPreapproval };

export type IgnoreReason =
  | "type"
  | "external_reference"
  | "no_subscription"
  | "manual"
  | "provider_ref"
  | "plan"
  | "plan_mismatch"
  | "cancelled_duplicate"
  | "no_preapproval"
  | "mp_rejected"
  | "business_rule"
  | "error";

export type SyncResult =
  | { outcome: "ignored"; reason: IgnoreReason; storeId: string | null; preapprovalId: string | null; detail?: string }
  | { outcome: "duplicate" }
  | {
      outcome: "applied";
      storeId: string;
      preapprovalId: string;
      previous: BillingSubscriptionRow;
      decision: BillingDecision;
      /** Id del cobro (authorized_payment) que disparó el aviso, si hubo. */
      paymentId: string | null;
      /** Se adoptó un preapproval autorizado distinto del guardado (checkout reemplazado). */
      adopted?: boolean;
    };

const IGNORE_TEXT: Record<IgnoreReason, string> = {
  type: "tipo de aviso que no usamos",
  external_reference: "la suscripción de MP no tiene el id de una tienda",
  no_subscription: "la tienda no tiene suscripción",
  manual: "la tienda está en modo manual",
  provider_ref: "no es la suscripción que inició la tienda",
  plan: "el plan de MP no corresponde a ningún plan de Ecommy",
  plan_mismatch: "el monto, la moneda o la frecuencia no son los del plan",
  cancelled_duplicate: "la tienda ya paga con otra suscripción: cancelamos esta en MercadoPago (pago duplicado)",
  no_preapproval: "el cobro no trae el id de la suscripción",
  mp_rejected: "MercadoPago rechazó la consulta",
  business_rule: "la base rechazó el cambio",
  error: "error inesperado",
};

/** Texto corto del resultado (logs, `billing_events.result`, UI del superadmin). */
export function describeResult(r: SyncResult): string {
  if (r.outcome === "duplicate") return "Evento repetido: ya estaba procesado.";
  if (r.outcome === "ignored") return `Ignorado: ${IGNORE_TEXT[r.reason]}${r.detail ? ` (${r.detail})` : ""}.`;
  const d = r.decision;
  const adopted = r.adopted ? " Adoptada en reemplazo del checkout anterior." : "";
  if (d.status === null) return `MP: ${d.providerStatus}. Sin cambios en el plan.${adopted}`;
  return `MP: ${d.providerStatus} → ${d.planCode}${d.billingPeriod === "yearly" ? " anual" : ""} ${d.status}${d.cancelAtPeriodEnd ? " (no renueva)" : ""}.${adopted}`;
}

export function resultJson(r: SyncResult): Json {
  if (r.outcome !== "applied") return { ...r, summary: describeResult(r) } as Json;
  return {
    outcome: r.outcome,
    store_id: r.storeId,
    preapproval_id: r.preapprovalId,
    payment_id: r.paymentId,
    adopted: r.adopted ?? false,
    previous: { plan_code: r.previous.plan_code, status: r.previous.status, provider_status: r.previous.provider_status },
    decision: { ...r.decision },
    summary: describeResult(r),
  } as Json;
}

/** Estados del preapproval guardado que se pueden reemplazar por otro autorizado de la misma tienda. */
function replaceable(sub: BillingSubscriptionRow): boolean {
  return !sub.provider_ref || sub.provider_status === null || ["pending", "cancelled", "expired"].includes(sub.provider_status);
}

/** Relee el preapproval en MP y lo aplica a la tienda que corresponde. */
export async function syncPreapproval(
  preapprovalId: string,
  opts: { payment?: MpAuthorizedPayment | null; now?: Date; expectedStoreId?: string },
  deps: { repo: BillingRepo; mp?: MpReader },
): Promise<SyncResult> {
  const mp = deps.mp ?? defaultMpReader;
  const pre = await mp.getPreapproval(preapprovalId);
  const ref = parseExternalReference(pre.external_reference);
  if (!ref || (opts.expectedStoreId && opts.expectedStoreId !== ref.storeId)) {
    return { outcome: "ignored", reason: "external_reference", storeId: null, preapprovalId: pre.id ?? preapprovalId };
  }
  const { storeId } = ref;
  const sub = await deps.repo.getSubscription(storeId);
  if (!sub) return { outcome: "ignored", reason: "no_subscription", storeId: null, preapprovalId: pre.id };
  if (sub.provider !== "mercadopago") return { outcome: "ignored", reason: "manual", storeId, preapprovalId: pre.id };
  if (!pre.id) return { outcome: "ignored", reason: "provider_ref", storeId, preapprovalId: preapprovalId };

  // Otro preapproval de la misma tienda (checkout reemplazado o abierto en dos pestañas).
  let adopt = false;
  if (sub.provider_ref !== pre.id) {
    if (pre.status !== "authorized") return { outcome: "ignored", reason: "provider_ref", storeId, preapprovalId: pre.id };
    if (!replaceable(sub)) {
      // La tienda ya paga con otro: este cobraría dos veces.
      await mp.cancelPreapproval(pre.id);
      return { outcome: "ignored", reason: "cancelled_duplicate", storeId, preapprovalId: pre.id, detail: `vigente: ${sub.provider_ref}` };
    }
    adopt = true;
  }

  const resolved = resolvePlan(pre, await deps.repo.listPlans(), ref.planCode, ref.period);
  if (!resolved) return { outcome: "ignored", reason: "plan", storeId, preapprovalId: pre.id };
  const planCode = resolved.plan.code;
  const period = resolved.period;

  // Sin plan de MP asociado, el precio lo fijó el checkout: tiene que ser el del plan.
  // Una renovación del mismo preapproval ya verificado no se vuelve a chequear
  // (un cambio de precio en /platform/planes no corta las suscripciones vigentes).
  const verified = !adopt && sub.plan_code === planCode && isChargingStatus(sub.provider_status) && (sub.status === "active" || sub.status === "past_due");
  if (resolved.via === "reference" && !verified && !recurringMatchesPlan(pre.auto_recurring, resolved.plan, period)) {
    const ar = pre.auto_recurring;
    return {
      outcome: "ignored",
      reason: "plan_mismatch",
      storeId,
      preapprovalId: pre.id,
      detail: `${ar?.transaction_amount ?? "?"} ${ar?.currency_id ?? "?"} cada ${ar?.frequency ?? "?"} ${ar?.frequency_type ?? "?"} para ${planCode}${period === "yearly" ? " anual" : ""}`,
    };
  }

  const decision = decideSubscription({ preapproval: pre, payment: opts.payment, current: sub, planCode, period, now: opts.now });
  if (adopt && decision.status !== "active") return { outcome: "ignored", reason: "provider_ref", storeId, preapprovalId: pre.id };
  await deps.repo.apply({ storeId, preapprovalId: pre.id, decision, adopt });
  const paymentId = opts.payment?.payment?.id ?? opts.payment?.id ?? null;
  return {
    outcome: "applied",
    storeId,
    preapprovalId: pre.id,
    previous: sub,
    decision,
    paymentId: paymentId === null ? null : String(paymentId),
    ...(adopt ? { adopted: true } : {}),
  };
}

export interface NotificationInput {
  eventId: string;
  type: string;
  dataId: string;
  payload: Json;
}

/**
 * Procesa una notificación ya validada (firma OK). Idempotente por
 * `eventId`: si ya se procesó, no hace nada; si quedó a medias, se reintenta.
 * Lanza SÓLO ante fallas transitorias (`isRetryableBillingError`: el webhook
 * responde 500 y MP reintenta); cualquier otra falla cierra el evento como
 * ignorado, con el motivo.
 */
export async function processNotification(input: NotificationInput, deps: { repo: BillingRepo; mp?: MpReader; now?: Date }): Promise<SyncResult> {
  if (!isSubscriptionEvent(input.type)) return { outcome: "ignored", reason: "type", storeId: null, preapprovalId: null };
  const claim = await deps.repo.claimEvent({ eventId: input.eventId, type: input.type, resourceId: input.dataId, payload: input.payload });
  if (claim === "duplicate") return { outcome: "duplicate" };

  const mp = deps.mp ?? defaultMpReader;
  let result: SyncResult;
  try {
    let payment: MpAuthorizedPayment | null = null;
    let preapprovalId: string | null = input.dataId;
    if (input.type === "subscription_authorized_payment") {
      payment = await mp.getAuthorizedPayment(input.dataId);
      preapprovalId = typeof payment.preapproval_id === "string" && payment.preapproval_id ? payment.preapproval_id : null;
    }
    result = preapprovalId
      ? await syncPreapproval(preapprovalId, { payment, now: deps.now }, { repo: deps.repo, mp })
      : { outcome: "ignored", reason: "no_preapproval", storeId: null, preapprovalId: null };
  } catch (err) {
    if (isRetryableBillingError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[billing] ${input.type} ${input.dataId} (sin reintento):`, message);
    const reason: IgnoreReason =
      err instanceof MercadoPagoError ? "mp_rejected" : err instanceof BillingDbError ? "business_rule" : "error";
    const detail = err instanceof MercadoPagoError ? `HTTP ${err.status}` : err instanceof BillingDbError ? message.slice(0, 200) : undefined;
    result = { outcome: "ignored", reason, storeId: null, preapprovalId: null, ...(detail ? { detail } : {}) };
  }
  const storeId = result.outcome === "applied" || result.outcome === "ignored" ? result.storeId : null;
  await deps.repo.finishEvent(input.eventId, { storeId, result: resultJson(result) });
  return result;
}

/** Repo sobre Supabase (service role). */
export function supabaseBillingRepo(db: BillingDb): BillingRepo {
  return {
    async listPlans() {
      // Columnas del anual (0019): si faltan, los planes se leen sin anual.
      const withYearly = await db.from("plans").select("code, mp_plan_id, price_monthly, currency, mp_plan_id_yearly, price_yearly");
      if (!withYearly.error) return withYearly.data ?? [];
      const { data, error } = await db.from("plans").select("code, mp_plan_id, price_monthly, currency");
      if (error) throw new BillingDbError("plans", error);
      return data ?? [];
    },
    async getSubscription(storeId) {
      const { data, error } = await db.from("subscriptions").select(BILLING_SUBSCRIPTION_COLUMNS).eq("store_id", storeId).maybeSingle();
      if (error) throw new BillingDbError("subscriptions", error);
      return (data as BillingSubscriptionRow | null) ?? null;
    },
    async apply({ storeId, preapprovalId, decision, adopt }) {
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
        p_adopt: adopt ?? false,
        // Sólo el anual manda el período: el mensual es el default de 0019 y así
        // la llamada sigue funcionando sin la migración.
        ...(decision.billingPeriod === "yearly" ? { p_billing_period: "yearly" } : {}),
      });
      if (error) throw new BillingDbError("billing_apply_subscription", error);
    },
    async claimEvent({ eventId, type, resourceId, payload }) {
      const { error } = await db
        .from("billing_events")
        .insert({ event_id: eventId, type, resource_id: resourceId, payload, provider: "mercadopago" });
      if (!error) return "new";
      if (error.code !== "23505") throw new BillingDbError("billing_events", error);
      const { data, error: readError } = await db.from("billing_events").select("processed_at").eq("event_id", eventId).maybeSingle();
      if (readError) throw new BillingDbError("billing_events", readError);
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
