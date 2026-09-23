/*
 * Tipos de la API de MercadoPago Suscripciones que usa Ecommy (sólo los
 * campos que leemos; MP devuelve más). Ver docs/BILLING.md.
 */

/** Estado de un `preapproval` (suscripción) en MercadoPago. */
export type PreapprovalStatus = "pending" | "authorized" | "paused" | "cancelled" | (string & {});

export interface MpAutoRecurring {
  frequency?: number;
  frequency_type?: "days" | "months" | (string & {});
  transaction_amount?: number;
  currency_id?: string;
  start_date?: string;
  end_date?: string;
}

/** GET /preapproval/{id} */
export interface MpPreapproval {
  id: string;
  status: PreapprovalStatus;
  preapproval_plan_id?: string | null;
  external_reference?: string | null;
  payer_email?: string | null;
  reason?: string | null;
  init_point?: string | null;
  back_url?: string | null;
  date_created?: string | null;
  last_modified?: string | null;
  next_payment_date?: string | null;
  auto_recurring?: MpAutoRecurring | null;
  summarized?: {
    charged_quantity?: number | null;
    last_charged_date?: string | null;
    last_charged_amount?: number | null;
    semaphore?: string | null;
  } | null;
}

/** GET /preapproval_plan/{id} */
export interface MpPreapprovalPlan {
  id: string;
  status?: string;
  reason?: string | null;
  auto_recurring?: MpAutoRecurring | null;
  back_url?: string | null;
}

/**
 * GET /authorized_payments/{id}: cada cobro recurrente de un preapproval.
 * `status`: scheduled | processed | recycling (reintentando) | cancelled.
 * `payment.status`: approved | rejected | in_process | …
 */
export interface MpAuthorizedPayment {
  id: number | string;
  preapproval_id: string;
  status?: string | null;
  date_created?: string | null;
  debit_date?: string | null;
  last_modified?: string | null;
  transaction_amount?: number | null;
  currency_id?: string | null;
  retry_attempt?: number | null;
  next_retry_date?: string | null;
  payment?: { id?: number | string | null; status?: string | null; status_detail?: string | null } | null;
}

/** Cuerpo de una notificación Webhook de MercadoPago. */
export interface MpNotification {
  id?: number | string;
  type?: string;
  action?: string;
  live_mode?: boolean;
  date_created?: string;
  user_id?: number | string;
  api_version?: string;
  data?: { id?: string | number };
}

/** Tipos de notificación que procesamos. */
export const SUBSCRIPTION_EVENT_TYPES = ["subscription_preapproval", "subscription_authorized_payment"] as const;
export type SubscriptionEventType = (typeof SUBSCRIPTION_EVENT_TYPES)[number];

export function isSubscriptionEvent(type: unknown): type is SubscriptionEventType {
  return typeof type === "string" && (SUBSCRIPTION_EVENT_TYPES as readonly string[]).includes(type);
}

/** Fila de `subscriptions` que mira la sincronización (0015). */
export interface BillingSubscriptionRow {
  store_id: string;
  plan_code: string;
  status: string;
  provider: string | null;
  provider_ref: string | null;
  provider_status: string | null;
  provider_plan_code: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  last_payment_at: string | null;
}

export const BILLING_SUBSCRIPTION_COLUMNS =
  "store_id, plan_code, status, provider, provider_ref, provider_status, provider_plan_code, current_period_start, current_period_end, cancel_at_period_end, last_payment_at";
