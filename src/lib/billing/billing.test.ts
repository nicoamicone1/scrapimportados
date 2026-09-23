import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { planActivatedEmail, planPaymentFailedEmail } from "@/lib/email/templates/billing";

import {
  buildInlinePreapprovalBody,
  buildPreapprovalBody,
  checkoutReason,
  externalReference,
  isMercadoPagoUrl,
  previousToCancel,
  startCheckout,
  type CheckoutDeps,
} from "./checkout";
import { MercadoPagoError, redactTokens } from "./mercadopago";
import { buildManifest, parseSignatureHeader, signatureTsMs, verifyWebhookSignature } from "./signature";
import {
  AUTHORIZED_UNPAID,
  decideSubscription,
  isUuid,
  mercadoPagoDebitActive,
  parseExternalReference,
  recurringMatchesPlan,
  resolvePlan,
  type BillingPlan,
  type DecideInput,
} from "./state";
import { BillingDbError, isRetryableBillingError, processNotification, syncPreapproval, type BillingRepo, type MpReader } from "./sync";
import type { BillingSubscriptionRow, MpPreapproval } from "./types";
import { billingState } from "./view";

const SECRET = "whsec_test_123";
const STORE = "3f1c2a9e-8b7d-4c6e-9a5f-1b2c3d4e5f60";
const NOW = new Date("2026-09-23T12:00:00Z");
const PLANS: BillingPlan[] = [
  { code: "starter", mp_plan_id: "mp_s", price_monthly: 14999, currency: "ARS" },
  { code: "pro", mp_plan_id: "mp_p", price_monthly: 34999, currency: "ARS" },
];

/** `now` que corresponde a un `ts` de la firma (para la ventana de 10 minutos). */
const at = (ts: string) => signatureTsMs(ts);

function sign(dataId: string, requestId: string, ts: string, secret = SECRET) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return `ts=${ts},v1=${createHmac("sha256", secret).update(manifest).digest("hex")}`;
}

// ---------------------------------------------------------------------------
// Firma
// ---------------------------------------------------------------------------

describe("firma del webhook (x-signature)", () => {
  it("arma el manifest del formato oficial y omite lo que falta", () => {
    expect(buildManifest("123", "req-1", "1704908010")).toBe("id:123;request-id:req-1;ts:1704908010;");
    expect(buildManifest(null, "req-1", "1704908010")).toBe("request-id:req-1;ts:1704908010;");
    expect(buildManifest("123", undefined, "1704908010")).toBe("id:123;ts:1704908010;");
    expect(parseSignatureHeader("ts=1704908010, v1=abc")).toEqual({ ts: "1704908010", v1: "abc" });
  });

  it("acepta una firma válida", () => {
    const xSignature = sign("123456", "req-abc", "1704908010");
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-abc", dataId: "123456", secret: SECRET, now: at("1704908010") })).toBe(true);
  });

  it("exige que ts esté a menos de 10 minutos (en segundos o en milisegundos)", () => {
    const xSignature = sign("123456", "req-abc", "1704908010");
    const base = { xSignature, xRequestId: "req-abc", dataId: "123456", secret: SECRET };
    expect(verifyWebhookSignature({ ...base, now: at("1704908010") + 9 * 60_000 })).toBe(true);
    expect(verifyWebhookSignature({ ...base, now: at("1704908010") - 9 * 60_000 })).toBe(true);
    expect(verifyWebhookSignature({ ...base, now: at("1704908010") + 11 * 60_000 })).toBe(false);
    expect(verifyWebhookSignature({ ...base, now: at("1704908010") - 11 * 60_000 })).toBe(false);
    const ms = sign("123456", "req-abc", "1704908010123");
    expect(signatureTsMs("1704908010123")).toBe(1704908010123);
    expect(verifyWebhookSignature({ ...base, xSignature: ms, now: 1704908010123 + 60_000 })).toBe(true);
  });

  it("acepta data.id alfanumérico en minúsculas (regla de la doc) o tal cual (SDK)", () => {
    const lower = sign("2c9380848f", "r", "1");
    expect(verifyWebhookSignature({ xSignature: lower, xRequestId: "r", dataId: "2C9380848F", secret: SECRET, now: at("1") })).toBe(true);
    const asIs = sign("2C9380848F", "r", "1");
    expect(verifyWebhookSignature({ xSignature: asIs, xRequestId: "r", dataId: "2C9380848F", secret: SECRET, now: at("1") })).toBe(true);
  });

  it("rechaza secreto equivocado, datos alterados y cabeceras rotas", () => {
    const xSignature = sign("123456", "req-abc", "1704908010");
    // Con la hora correcta: lo que falla es la firma, no la ventana.
    vi.useFakeTimers({ now: at("1704908010") });
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-abc", dataId: "123456", secret: "otro" })).toBe(false);
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-abc", dataId: "999999", secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-xyz", dataId: "123456", secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: null, xRequestId: "req-abc", dataId: "123456", secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: "v1=abc", xRequestId: "req-abc", dataId: "123456", secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: "ts=1,v1=zz", xRequestId: "req-abc", dataId: "123456", secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-abc", dataId: "123456", secret: "" })).toBe(false);
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-abc", dataId: "123456", secret: SECRET })).toBe(true);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Máquina de estados
// ---------------------------------------------------------------------------

function current(patch: Partial<DecideInput["current"]> = {}): DecideInput["current"] {
  return {
    plan_code: "pro",
    status: "trialing",
    provider_status: "pending",
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    last_payment_at: null,
    ...patch,
  };
}

const paidPro = (patch: Partial<DecideInput["current"]> = {}) =>
  current({
    status: "active",
    provider_status: "authorized",
    current_period_start: "2026-09-01T00:00:00.000Z",
    current_period_end: "2026-10-01T00:00:00.000Z",
    last_payment_at: "2026-09-01T00:00:00.000Z",
    ...patch,
  });

function pre(status: string, patch: Partial<MpPreapproval> = {}): DecideInput["preapproval"] {
  return {
    id: "pre_1",
    status,
    next_payment_date: "2026-10-23T12:00:00.000Z",
    date_created: "2026-09-23T11:50:00.000Z",
    summarized: { last_charged_date: "2026-09-23T11:55:00.000Z" },
    ...patch,
  };
}

describe("mapeo preapproval → subscriptions", () => {
  it("authorized activa el plan con el período del próximo cobro y manda mail", () => {
    const d = decideSubscription({ preapproval: pre("authorized"), current: current(), planCode: "pro", now: NOW });
    expect(d).toMatchObject({
      status: "active",
      planCode: "pro",
      periodStart: "2026-09-23T11:55:00.000Z",
      periodEnd: "2026-10-23T12:00:00.000Z",
      providerStatus: "authorized",
      cancelAtPeriodEnd: false,
      email: "activated",
    });
  });

  it("authorized SIN cobro: activa con 7 días de gracia (authorized_unpaid) y el cobro aprobado lo pasa al período real", () => {
    const first = decideSubscription({ preapproval: pre("authorized", { summarized: { charged_quantity: 0 } }), current: current(), planCode: "pro", now: NOW });
    expect(first).toMatchObject({
      status: "active",
      planCode: "pro",
      providerStatus: AUTHORIZED_UNPAID,
      periodStart: NOW.toISOString(),
      periodEnd: "2026-09-30T12:00:00.000Z",
      lastPaymentAt: null,
      email: "activated",
    });
    const unpaid = current({
      status: "active",
      provider_status: AUTHORIZED_UNPAID,
      current_period_start: first.periodStart,
      current_period_end: first.periodEnd,
    });
    // Otro aviso sin cobro: no extiende la gracia ni repite el mail.
    const again = decideSubscription({ preapproval: pre("authorized", { summarized: null }), current: unpaid, planCode: "pro", now: new Date("2026-09-26T12:00:00Z") });
    expect(again).toMatchObject({ status: "active", providerStatus: AUTHORIZED_UNPAID, periodEnd: "2026-09-30T12:00:00.000Z", email: null });
    // Cobro rechazado en la gracia: sigue en gracia (no pasa a past_due) y avisa.
    const rejected = decideSubscription({
      preapproval: pre("authorized", { summarized: null }),
      payment: { status: "recycling", payment: { status: "rejected" } },
      current: unpaid,
      planCode: "pro",
      now: NOW,
    });
    expect(rejected).toMatchObject({ status: null, providerStatus: AUTHORIZED_UNPAID, email: "payment_failed" });
    // Primer cobro aprobado: período real, sin segundo mail.
    const paid = decideSubscription({
      preapproval: pre("authorized", { summarized: null }),
      payment: { status: "processed", payment: { status: "approved" }, debit_date: "2026-09-24T10:00:00Z" },
      current: unpaid,
      planCode: "pro",
      now: NOW,
    });
    expect(paid).toMatchObject({
      status: "active",
      providerStatus: "authorized",
      periodEnd: "2026-10-23T12:00:00.000Z",
      lastPaymentAt: "2026-09-24T10:00:00.000Z",
      email: null,
    });
  });

  it("una suscripción vencida sin cobro (expired) no recibe otra gracia: vuelve sólo con un cobro", () => {
    const expired = current({ plan_code: "free", status: "active", provider_status: "expired", current_period_end: "2026-09-01T00:00:00.000Z" });
    expect(decideSubscription({ preapproval: pre("authorized", { summarized: null }), current: expired, planCode: "pro", now: NOW }).status).toBeNull();
    const charged = decideSubscription({
      preapproval: pre("authorized", { summarized: null }),
      payment: { status: "processed", payment: { status: "approved" }, debit_date: "2026-09-23T11:58:00Z" },
      current: expired,
      planCode: "pro",
      now: NOW,
    });
    expect(charged).toMatchObject({ status: "active", planCode: "pro", providerStatus: "authorized" });
  });

  it("volver a suscribirse con la renovación cancelada no acorta el período pago", () => {
    const cancelling = paidPro({ provider_status: "cancelled", cancel_at_period_end: true, current_period_end: "2026-10-20T00:00:00.000Z" });
    const d = decideSubscription({ preapproval: pre("authorized", { summarized: null }), current: cancelling, planCode: "pro", now: NOW });
    expect(d).toMatchObject({ status: "active", providerStatus: AUTHORIZED_UNPAID, periodEnd: "2026-10-20T00:00:00.000Z", cancelAtPeriodEnd: false });
  });

  it("past_due sólo vuelve a active con un cobro nuevo", () => {
    const pastDue = paidPro({ status: "past_due", last_payment_at: "2026-09-01T00:00:00.000Z" });
    const noCharge = decideSubscription({ preapproval: pre("authorized", { summarized: { last_charged_date: "2026-09-01T00:00:00Z" } }), current: pastDue, planCode: "pro", now: NOW });
    expect(noCharge.status).toBeNull();
    const charged = decideSubscription({
      preapproval: pre("authorized", { summarized: null }),
      payment: { status: "processed", payment: { status: "approved" }, debit_date: "2026-09-23T11:58:00Z" },
      current: pastDue,
      planCode: "pro",
      now: NOW,
    });
    expect(charged).toMatchObject({ status: "active", email: "activated" });
  });

  it("una renovación del mismo plan no repite el mail de activación", () => {
    const d = decideSubscription({ preapproval: pre("authorized"), current: paidPro(), planCode: "pro", now: NOW });
    expect(d.status).toBe("active");
    expect(d.email).toBeNull();
  });

  it("pending o paused sin período pago NO activa nada (sólo registra el estado)", () => {
    for (const s of ["pending", "paused"]) {
      const d = decideSubscription({ preapproval: pre(s), current: current(), planCode: "pro", now: NOW });
      expect(d.status).toBeNull();
      expect(d.planCode).toBe("pro");
      expect(d.providerStatus).toBe(s);
      expect(d.email).toBeNull();
    }
    const free = decideSubscription({ preapproval: pre("pending"), current: current({ plan_code: "free", status: "active" }), planCode: "pro", now: NOW });
    expect(free.status).toBeNull();
    expect(free.planCode).toBe("free");
  });

  it("paused con período pago → past_due con aviso (una sola vez)", () => {
    const d = decideSubscription({ preapproval: pre("paused"), current: paidPro(), planCode: "pro", now: NOW });
    expect(d).toMatchObject({ status: "past_due", planCode: "pro", email: "payment_failed" });
    const again = decideSubscription({ preapproval: pre("paused"), current: paidPro({ status: "past_due", provider_status: "paused" }), planCode: "pro", now: NOW });
    expect(again.status).toBe("past_due");
    expect(again.email).toBeNull();
  });

  it("cobro rechazado con la suscripción autorizada → past_due", () => {
    const d = decideSubscription({
      preapproval: pre("authorized"),
      payment: { status: "recycling", payment: { status: "rejected" } },
      current: paidPro(),
      planCode: "pro",
      now: NOW,
    });
    expect(d).toMatchObject({ status: "past_due", email: "payment_failed" });
    const first = decideSubscription({
      preapproval: pre("authorized"),
      payment: { status: "recycling", payment: { status: "rejected" } },
      current: current(),
      planCode: "pro",
      now: NOW,
    });
    expect(first.status).toBeNull();
    expect(first.email).toBe("payment_failed");
  });

  it("cobro aprobado guarda la fecha del pago", () => {
    const d = decideSubscription({
      preapproval: pre("authorized", { summarized: null }),
      payment: { status: "processed", payment: { status: "approved" }, debit_date: "2026-09-23T11:58:00Z" },
      current: current(),
      planCode: "starter",
      now: NOW,
    });
    expect(d).toMatchObject({ status: "active", planCode: "starter", lastPaymentAt: "2026-09-23T11:58:00.000Z", periodStart: "2026-09-23T11:58:00.000Z" });
  });

  it("cancelled con período vigente: sigue activo hasta el final y no renueva", () => {
    const d = decideSubscription({ preapproval: pre("cancelled"), current: paidPro(), planCode: "pro", now: NOW });
    expect(d).toMatchObject({ status: "active", cancelAtPeriodEnd: true, email: null });
  });

  it("cancelled sin período vigente → cancelled; en prueba no toca nada", () => {
    const expired = decideSubscription({
      preapproval: pre("cancelled"),
      current: paidPro({ current_period_end: "2026-09-01T00:00:00.000Z" }),
      planCode: "pro",
      now: NOW,
    });
    expect(expired.status).toBe("cancelled");
    const trial = decideSubscription({ preapproval: pre("cancelled"), current: current(), planCode: "pro", now: NOW });
    expect(trial.status).toBeNull();
  });

  it("resolvePlan: manda el preapproval_plan_id; si no, el plan del external_reference (nunca lo guardado en la base)", () => {
    expect(resolvePlan({ preapproval_plan_id: "mp_p" }, PLANS, "starter")).toMatchObject({ plan: { code: "pro" }, via: "mp_plan" });
    expect(resolvePlan({ preapproval_plan_id: null }, PLANS, "starter")).toMatchObject({ plan: { code: "starter" }, via: "reference" });
    expect(resolvePlan({ preapproval_plan_id: "otro" }, PLANS, "inexistente")).toBeNull();
    expect(resolvePlan({ preapproval_plan_id: null }, PLANS, null)).toBeNull();
  });

  it("parseExternalReference: <tienda>:<plan>[:<período>] (sin período = mensual)", () => {
    expect(parseExternalReference(`${STORE}:pro`)).toEqual({ storeId: STORE, planCode: "pro", period: "monthly" });
    expect(parseExternalReference(STORE)).toEqual({ storeId: STORE, planCode: null, period: "monthly" });
    expect(parseExternalReference(`${STORE}:pro:yearly`)).toEqual({ storeId: STORE, planCode: "pro", period: "yearly" });
    expect(parseExternalReference(`${STORE}:starter:monthly`)).toEqual({ storeId: STORE, planCode: "starter", period: "monthly" });
    for (const bad of ["pro", `${STORE}:PRO`, `${STORE}:pro:x`, `${STORE}:pro:YEARLY`, `${STORE}:pro:yearly:1`, `${STORE}:pro:`, `x:${STORE}`, `${STORE}:`, null, 1]) {
      expect(parseExternalReference(bad)).toBeNull();
    }
    // Ida y vuelta con lo que arma el checkout.
    expect(externalReference(STORE, "pro")).toBe(`${STORE}:pro`);
    expect(parseExternalReference(externalReference(STORE, "pro", "yearly"))).toEqual({ storeId: STORE, planCode: "pro", period: "yearly" });
  });

  it("recurringMatchesPlan: monto, moneda y frecuencia mensual del plan", () => {
    const pro = PLANS[1];
    const ok = { transaction_amount: 34999, currency_id: "ARS", frequency: 1, frequency_type: "months" };
    expect(recurringMatchesPlan(ok, pro)).toBe(true);
    expect(recurringMatchesPlan({ ...ok, transaction_amount: 14999 }, pro)).toBe(false);
    expect(recurringMatchesPlan({ ...ok, currency_id: "USD" }, pro)).toBe(false);
    expect(recurringMatchesPlan({ ...ok, frequency: 12 }, pro)).toBe(false);
    expect(recurringMatchesPlan({ ...ok, frequency_type: "days" }, pro)).toBe(false);
    expect(recurringMatchesPlan(null, pro)).toBe(false);
    expect(recurringMatchesPlan(ok, { price_monthly: null, currency: "ARS" })).toBe(false);
    expect(recurringMatchesPlan(ok, { price_monthly: "34999.00", currency: "ARS" })).toBe(true);
  });

  it("recurringMatchesPlan anual: price_yearly cada 12 meses", () => {
    const pro = { ...PLANS[1], price_yearly: "349990.00" };
    const yearly = { transaction_amount: 349990, currency_id: "ARS", frequency: 12, frequency_type: "months" };
    expect(recurringMatchesPlan(yearly, pro, "yearly")).toBe(true);
    // El precio mensual cada 12 meses, o el anual cada mes, no.
    expect(recurringMatchesPlan({ ...yearly, transaction_amount: 34999 }, pro, "yearly")).toBe(false);
    expect(recurringMatchesPlan({ ...yearly, frequency: 1 }, pro, "yearly")).toBe(false);
    expect(recurringMatchesPlan(yearly, pro, "monthly")).toBe(false);
    expect(recurringMatchesPlan({ ...yearly, currency_id: "USD" }, pro, "yearly")).toBe(false);
    // Sin precio anual (o sin 0019) no hay anual que verificar.
    expect(recurringMatchesPlan(yearly, PLANS[1], "yearly")).toBe(false);
    expect(recurringMatchesPlan(yearly, { ...PLANS[1], price_yearly: null }, "yearly")).toBe(false);
  });

  it("resolvePlan anual: por mp_plan_id_yearly o por el período del external_reference", () => {
    const plans: BillingPlan[] = [...PLANS.slice(0, 1), { ...PLANS[1], mp_plan_id_yearly: "mp_p_y", price_yearly: 349990 }];
    expect(resolvePlan({ preapproval_plan_id: "mp_p_y" }, plans, "starter")).toMatchObject({ plan: { code: "pro" }, via: "mp_plan", period: "yearly" });
    expect(resolvePlan({ preapproval_plan_id: "mp_p" }, plans, "pro", "yearly")).toMatchObject({ plan: { code: "pro" }, via: "mp_plan", period: "monthly" });
    expect(resolvePlan({ preapproval_plan_id: null }, plans, "pro", "yearly")).toMatchObject({ plan: { code: "pro" }, via: "reference", period: "yearly" });
    expect(resolvePlan({ preapproval_plan_id: null }, plans, "pro")).toMatchObject({ period: "monthly" });
  });

  it("anual: guarda el período y, sin next_payment_date, estima 12 meses", () => {
    const d = decideSubscription({
      preapproval: { ...pre("authorized"), next_payment_date: null, summarized: { charged_quantity: 1, last_charged_date: "2026-09-23T10:00:00Z" } },
      current: current(),
      planCode: "pro",
      period: "yearly",
      now: NOW,
    });
    expect(d).toMatchObject({ status: "active", billingPeriod: "yearly", periodEnd: "2027-09-23T10:00:00.000Z" });
    const monthly = decideSubscription({
      preapproval: { ...pre("authorized"), next_payment_date: null, summarized: { charged_quantity: 1, last_charged_date: "2026-09-23T10:00:00Z" } },
      current: current(),
      planCode: "pro",
      now: NOW,
    });
    expect(monthly).toMatchObject({ billingPeriod: "monthly", periodEnd: "2026-10-23T10:00:00.000Z" });
    // Con next_payment_date manda MercadoPago.
    const fromMp = decideSubscription({
      preapproval: { ...pre("authorized"), next_payment_date: "2027-09-20T10:00:00Z" },
      payment: { status: "processed", payment: { status: "approved" }, debit_date: "2026-09-20T10:00:00Z" },
      current: current(),
      planCode: "pro",
      period: "yearly",
      now: NOW,
    });
    expect(fromMp).toMatchObject({ billingPeriod: "yearly", periodEnd: "2027-09-20T10:00:00.000Z" });
  });

  it("isUuid, billingState y débito vigente", () => {
    expect(isUuid(STORE)).toBe(true);
    expect(isUuid("1234")).toBe(false);
    expect(isUuid(`${STORE}' or 1=1`)).toBe(false);
    const st = (patch: Partial<Parameters<typeof billingState>[0]>) =>
      billingState({ plan_code: "pro", provider: "mercadopago", provider_status: "authorized", status: "active", cancel_at_period_end: false, ...patch });
    expect(st({ cancel_at_period_end: true })).toBe("cancelling");
    expect(st({ provider_status: "pending", status: "trialing" })).toBe("pending");
    expect(st({ provider_status: AUTHORIZED_UNPAID })).toBe("active");
    expect(st({ provider: "manual", provider_status: null })).toBe("none");
    // Ya en Free (vencida sin cobro): no se muestra como suscripción vigente; un checkout nuevo sí.
    expect(st({ plan_code: "free", provider_status: "expired" })).toBe("none");
    expect(st({ plan_code: "free", provider_status: "pending" })).toBe("pending");
    expect(mercadoPagoDebitActive({ provider: "mercadopago", provider_ref: "pre_1", provider_status: "authorized" })).toBe(true);
    expect(mercadoPagoDebitActive({ provider: "mercadopago", provider_ref: "pre_1", provider_status: "pending" })).toBe(true);
    expect(mercadoPagoDebitActive({ provider: "mercadopago", provider_ref: "pre_1", provider_status: "cancelled" })).toBe(false);
    expect(mercadoPagoDebitActive({ provider: "manual", provider_ref: "pre_1", provider_status: "authorized" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sincronización e idempotencia
// ---------------------------------------------------------------------------

function subRow(patch: Partial<BillingSubscriptionRow> = {}): BillingSubscriptionRow {
  return {
    store_id: STORE,
    plan_code: "pro",
    status: "trialing",
    provider: "mercadopago",
    provider_ref: "pre_1",
    provider_status: "pending",
    provider_plan_code: "pro",
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    last_payment_at: null,
    ...patch,
  };
}

function fakeRepo(sub: BillingSubscriptionRow | null) {
  const events = new Map<string, { processed: boolean }>();
  const applied: Parameters<BillingRepo["apply"]>[0][] = [];
  const repo: BillingRepo = {
    listPlans: async () => PLANS,
    getSubscription: async (id) => (sub && sub.store_id === id ? sub : null),
    apply: async (args) => {
      applied.push(args);
    },
    claimEvent: async ({ eventId }) => {
      const ev = events.get(eventId);
      if (!ev) {
        events.set(eventId, { processed: false });
        return "new";
      }
      return ev.processed ? "duplicate" : "retry";
    },
    finishEvent: async (eventId) => {
      events.set(eventId, { processed: true });
    },
  };
  return { repo, applied, events };
}

function fakeMp(preapproval: Partial<MpPreapproval> = {}): MpReader & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    getPreapproval: async (id) => {
      calls.push(`preapproval/${id}`);
      return {
        id,
        status: "authorized",
        external_reference: `${STORE}:pro`,
        preapproval_plan_id: "mp_p",
        next_payment_date: "2026-10-23T12:00:00Z",
        ...preapproval,
      };
    },
    cancelPreapproval: async (id) => {
      calls.push(`cancel/${id}`);
      return { id, status: "cancelled" };
    },
    getAuthorizedPayment: async (id) => {
      calls.push(`authorized_payments/${id}`);
      return { id, preapproval_id: "pre_1", status: "processed", payment: { id: 777, status: "approved" }, debit_date: "2026-09-23T11:58:00Z" };
    },
  };
}

describe("procesamiento de avisos", () => {
  it("es idempotente por event_id: el segundo aviso igual no relee MP ni aplica", async () => {
    const { repo, applied } = fakeRepo(subRow());
    const mp = fakeMp();
    const input = { eventId: "evt-1", type: "subscription_preapproval", dataId: "pre_1", payload: {} };
    const first = await processNotification(input, { repo, mp, now: NOW });
    expect(first.outcome).toBe("applied");
    expect(applied).toHaveLength(1);
    expect(applied[0].decision).toMatchObject({ status: "active", planCode: "pro" });

    const second = await processNotification(input, { repo, mp, now: NOW });
    expect(second.outcome).toBe("duplicate");
    expect(applied).toHaveLength(1);
    expect(mp.calls).toEqual(["preapproval/pre_1"]);
  });

  it("un evento que falló a medias se reintenta", async () => {
    const { repo, applied } = fakeRepo(subRow());
    let fail = true;
    const mp: MpReader = {
      ...fakeMp(),
      getPreapproval: async (id) => {
        if (fail) throw new MercadoPagoError("GET", `/preapproval/${id}`, 500, "boom");
        return { id, status: "authorized", external_reference: `${STORE}:pro`, preapproval_plan_id: "mp_p" };
      },
    };
    const input = { eventId: "evt-2", type: "subscription_preapproval", dataId: "pre_1", payload: {} };
    await expect(processNotification(input, { repo, mp, now: NOW })).rejects.toThrow(/HTTP 500/);
    fail = false;
    const retry = await processNotification(input, { repo, mp, now: NOW });
    expect(retry.outcome).toBe("applied");
    expect(applied).toHaveLength(1);
  });

  it("authorized_payment: lee el cobro, después el preapproval, y guarda el pago", async () => {
    const { repo, applied } = fakeRepo(subRow());
    const mp = fakeMp();
    const r = await processNotification({ eventId: "evt-3", type: "subscription_authorized_payment", dataId: "9001", payload: {} }, { repo, mp, now: NOW });
    expect(mp.calls).toEqual(["authorized_payments/9001", "preapproval/pre_1"]);
    expect(r.outcome === "applied" && r.paymentId).toBe("777");
    expect(applied[0].decision.lastPaymentAt).toBe("2026-09-23T11:58:00.000Z");
  });

  it("ignora tipos que no usamos sin registrarlos", async () => {
    const { repo, events } = fakeRepo(subRow());
    const r = await processNotification({ eventId: "evt-4", type: "payment", dataId: "1", payload: {} }, { repo, mp: fakeMp(), now: NOW });
    expect(r).toMatchObject({ outcome: "ignored", reason: "type" });
    expect(events.size).toBe(0);
  });

  it("valida external_reference y lo cruza con provider_ref antes de aplicar", async () => {
    const cases: [Partial<MpPreapproval>, BillingSubscriptionRow, string][] = [
      [{ external_reference: "no-es-uuid" }, subRow(), "external_reference"],
      [{ external_reference: "no-es-uuid:pro" }, subRow(), "external_reference"],
      // Otro preapproval NO autorizado de la tienda: no se toca nada.
      [{ status: "pending" }, subRow({ provider_ref: "pre_otro" }), "provider_ref"],
      [{}, subRow({ provider: "manual" }), "manual"],
      [{ preapproval_plan_id: "desconocido", external_reference: STORE }, subRow(), "plan"],
    ];
    for (const [patch, sub, reason] of cases) {
      const { repo, applied } = fakeRepo(sub);
      const r = await syncPreapproval("pre_1", { now: NOW }, { repo, mp: fakeMp(patch) });
      expect(r).toMatchObject({ outcome: "ignored", reason });
      expect(applied).toHaveLength(0);
    }
    const { repo } = fakeRepo(subRow());
    const other = await syncPreapproval("pre_1", { now: NOW, expectedStoreId: "11111111-2222-4333-8444-555555555555" }, { repo, mp: fakeMp() });
    expect(other).toMatchObject({ outcome: "ignored", reason: "external_reference" });
  });

  it("A1: sin plan de MP asociado, el plan sale del external_reference y el monto tiene que ser el del plan", async () => {
    // Guardado en la base: Pro. Pagado en MP: Starter. Se activa Starter, nunca Pro.
    const starterInline = {
      preapproval_plan_id: null,
      external_reference: `${STORE}:starter`,
      auto_recurring: { transaction_amount: 14999, currency_id: "ARS", frequency: 1, frequency_type: "months" },
    };
    const a = fakeRepo(subRow({ provider_plan_code: "pro" }));
    const r = await syncPreapproval("pre_1", { now: NOW }, { repo: a.repo, mp: fakeMp(starterInline) });
    expect(r).toMatchObject({ outcome: "applied" });
    expect(a.applied[0].decision.planCode).toBe("starter");

    // Monto de Starter con referencia a Pro → no se activa.
    const b = fakeRepo(subRow());
    const mismatch = await syncPreapproval("pre_1", { now: NOW }, { repo: b.repo, mp: fakeMp({ ...starterInline, external_reference: `${STORE}:pro` }) });
    expect(mismatch).toMatchObject({ outcome: "ignored", reason: "plan_mismatch" });
    expect(b.applied).toHaveLength(0);

    // Una renovación del mismo preapproval ya verificado no se vuelve a chequear (cambio de precio del plan).
    const c = fakeRepo(subRow({ status: "active", provider_status: "authorized", plan_code: "pro" }));
    const renewal = await syncPreapproval("pre_1", { now: NOW }, { repo: c.repo, mp: fakeMp({ ...starterInline, external_reference: `${STORE}:pro` }) });
    expect(renewal).toMatchObject({ outcome: "applied" });
  });

  it("anual sin plan de MP: el período sale del external_reference y el monto tiene que ser el precio anual cada 12 meses", async () => {
    const yearlyPlans: BillingPlan[] = PLANS.map((p) => ({ ...p, price_yearly: Number(p.price_monthly) * 10 }));
    const proYearly = {
      preapproval_plan_id: null,
      external_reference: `${STORE}:pro:yearly`,
      next_payment_date: "2027-09-23T12:00:00.000Z",
      summarized: { charged_quantity: 1, last_charged_date: "2026-09-23T11:55:00.000Z" },
      auto_recurring: { transaction_amount: 349990, currency_id: "ARS", frequency: 12, frequency_type: "months" },
    };
    const a = fakeRepo(subRow());
    a.repo.listPlans = async () => yearlyPlans;
    const r = await syncPreapproval("pre_1", { now: NOW }, { repo: a.repo, mp: fakeMp(proYearly) });
    expect(r).toMatchObject({ outcome: "applied" });
    expect(a.applied[0].decision).toMatchObject({ planCode: "pro", billingPeriod: "yearly", periodEnd: "2027-09-23T12:00:00.000Z" });

    // Precio mensual con referencia anual (o anual cada mes) → no se activa.
    for (const auto_recurring of [
      { transaction_amount: 34999, currency_id: "ARS", frequency: 12, frequency_type: "months" },
      { transaction_amount: 349990, currency_id: "ARS", frequency: 1, frequency_type: "months" },
    ]) {
      const b = fakeRepo(subRow());
      b.repo.listPlans = async () => yearlyPlans;
      const mismatch = await syncPreapproval("pre_1", { now: NOW }, { repo: b.repo, mp: fakeMp({ ...proYearly, auto_recurring }) });
      expect(mismatch).toMatchObject({ outcome: "ignored", reason: "plan_mismatch" });
      expect(b.applied).toHaveLength(0);
    }

    // Sin 0019 (planes sin price_yearly) un preapproval anual no activa nada.
    const c = fakeRepo(subRow());
    expect(await syncPreapproval("pre_1", { now: NOW }, { repo: c.repo, mp: fakeMp(proYearly) })).toMatchObject({ reason: "plan_mismatch" });
  });

  it("A2: adopta un preapproval autorizado de la tienda si el guardado quedó pendiente", async () => {
    const { repo, applied } = fakeRepo(subRow({ provider_ref: "pre_viejo", provider_status: "pending" }));
    const mp = fakeMp();
    const r = await syncPreapproval("pre_1", { now: NOW }, { repo, mp });
    expect(r).toMatchObject({ outcome: "applied", adopted: true, preapprovalId: "pre_1" });
    expect(applied[0]).toMatchObject({ preapprovalId: "pre_1", adopt: true, decision: { status: "active" } });
    expect(mp.calls).not.toContain("cancel/pre_1");
  });

  it("A2: si la tienda ya paga con otro preapproval, cancela el duplicado en MP y no aplica nada", async () => {
    const { repo, applied } = fakeRepo(subRow({ provider_ref: "pre_vigente", provider_status: "authorized", status: "active" }));
    const mp = fakeMp();
    const r = await syncPreapproval("pre_1", { now: NOW }, { repo, mp });
    expect(r).toMatchObject({ outcome: "ignored", reason: "cancelled_duplicate" });
    expect(mp.calls).toContain("cancel/pre_1");
    expect(applied).toHaveLength(0);
  });

  it("M1: 4xx de MP, cobro sin preapproval o regla de negocio cierran el evento como ignorado; lo transitorio se reintenta", async () => {
    const notFound: MpReader = { ...fakeMp(), getPreapproval: async (id) => Promise.reject(new MercadoPagoError("GET", `/preapproval/${id}`, 404, "not found")) };
    const a = fakeRepo(subRow());
    const r1 = await processNotification({ eventId: "e-404", type: "subscription_preapproval", dataId: "pre_1", payload: {} }, { repo: a.repo, mp: notFound, now: NOW });
    expect(r1).toMatchObject({ outcome: "ignored", reason: "mp_rejected" });
    expect(a.events.get("e-404")?.processed).toBe(true);

    const noPre: MpReader = { ...fakeMp(), getAuthorizedPayment: async (id) => ({ id, preapproval_id: "" }) };
    const b = fakeRepo(subRow());
    const r2 = await processNotification({ eventId: "e-np", type: "subscription_authorized_payment", dataId: "9", payload: {} }, { repo: b.repo, mp: noPre, now: NOW });
    expect(r2).toMatchObject({ outcome: "ignored", reason: "no_preapproval" });

    const c = fakeRepo(subRow());
    c.repo.apply = async () => Promise.reject(new BillingDbError("billing_apply_subscription", { message: "La suscripción no coincide", code: "P0001" }));
    const r3 = await processNotification({ eventId: "e-biz", type: "subscription_preapproval", dataId: "pre_1", payload: {} }, { repo: c.repo, mp: fakeMp(), now: NOW });
    expect(r3).toMatchObject({ outcome: "ignored", reason: "business_rule" });
    expect(c.events.get("e-biz")?.processed).toBe(true);

    const d = fakeRepo(subRow());
    d.repo.apply = async () => Promise.reject(new BillingDbError("billing_apply_subscription", { message: "fetch failed", code: "" }));
    await expect(
      processNotification({ eventId: "e-db", type: "subscription_preapproval", dataId: "pre_1", payload: {} }, { repo: d.repo, mp: fakeMp(), now: NOW }),
    ).rejects.toThrow(/fetch failed/);
    expect(d.events.get("e-db")?.processed).toBe(false);

    expect(isRetryableBillingError(new MercadoPagoError("GET", "/x", 0, "timeout"))).toBe(true);
    expect(isRetryableBillingError(new MercadoPagoError("GET", "/x", 429, ""))).toBe(true);
    expect(isRetryableBillingError(new MercadoPagoError("GET", "/x", 503, ""))).toBe(true);
    expect(isRetryableBillingError(new MercadoPagoError("GET", "/x", 400, ""))).toBe(false);
    expect(isRetryableBillingError(new BillingDbError("x", { message: "dup", code: "23505" }))).toBe(false);
    expect(isRetryableBillingError(new Error("otra cosa"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

describe("startCheckout", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("MP_ACCESS_TOKEN", "APP_USR-1234567890-abcdef-secret");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function deps(patch: Partial<CheckoutDeps> = {}) {
    const recorded: { planCode: string; preapprovalId: string }[] = [];
    const d: CheckoutDeps = {
      loadPlan: async (code) => ({ code, name: code === "pro" ? "Pro" : "Starter", mp_plan_id: `mp_${code}` }),
      loadSubscription: async () => ({
        plan_code: "pro",
        status: "trialing",
        provider: null,
        provider_ref: null,
        provider_status: null,
        cancel_at_period_end: false,
      }),
      recordCheckout: async (args) => {
        recorded.push(args);
        return null;
      },
      ...patch,
    };
    return { d, recorded };
  }

  const input = { storeId: STORE, storeName: "Taller Luna", planCode: "pro", origin: "https://www.ecommy.app/", payerEmail: "lucia@example.com" };

  it("arma el body del POST /preapproval y registra el checkout como pendiente, sin activar", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "pre_new", status: "pending", init_point: "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=pre_new" }), {
        status: 201,
      }),
    );
    const { d, recorded } = deps();
    const res = await startCheckout(input, d);
    expect(res).toMatchObject({ ok: true, preapprovalId: "pre_new", mode: "plan" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.mercadopago.com/preapproval");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer APP_USR-1234567890-abcdef-secret");
    expect(JSON.parse(String(init.body))).toEqual({
      preapproval_plan_id: "mp_pro",
      payer_email: "lucia@example.com",
      external_reference: `${STORE}:pro`,
      back_url: "https://www.ecommy.app/admin/plan?mp=ok",
      reason: "Ecommy Pro · Taller Luna",
    });
    // Sólo se registra el preapproval (billing_start_checkout): nada de billing_apply_subscription.
    expect(recorded).toEqual([{ planCode: "pro", preapprovalId: "pre_new", period: "monthly" }]);
  });

  it("si MP pide card_token_id, crea la suscripción sin plan con el mismo auto_recurring", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "card_token_id is required" }), { status: 400 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "mp_pro", auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 34999, currency_id: "ARS" } })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "pre_inline", init_point: "https://www.mercadopago.com.ar/subscriptions/checkout?x=1" })));
    const { d, recorded } = deps();
    const res = await startCheckout(input, d);
    expect(res).toMatchObject({ ok: true, mode: "inline", preapprovalId: "pre_inline" });
    const body = JSON.parse(String((fetchMock.mock.calls[2] as [string, RequestInit])[1].body));
    expect(body.preapproval_plan_id).toBeUndefined();
    expect(body).toMatchObject({
      status: "pending",
      external_reference: `${STORE}:pro`,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 34999, currency_id: "ARS" },
    });
    expect(recorded).toEqual([{ planCode: "pro", preapprovalId: "pre_inline", period: "monthly" }]);
  });

  it("anual sin plan de MP: suscripción sin plan asociado, precio anual cada 12 meses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "pre_year", init_point: "https://www.mercadopago.com.ar/subscriptions/checkout?x=2" }), { status: 201 }),
    );
    const { d, recorded } = deps({
      loadPlan: async (code) => ({ code, name: "Pro", mp_plan_id: "mp_pro", mp_plan_id_yearly: null, price_yearly: "349990.00", currency: "ARS" }),
    });
    const res = await startCheckout({ ...input, period: "yearly" }, d);
    expect(res).toMatchObject({ ok: true, mode: "inline", preapprovalId: "pre_year" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
      payer_email: "lucia@example.com",
      external_reference: `${STORE}:pro:yearly`,
      back_url: "https://www.ecommy.app/admin/plan?mp=ok",
      reason: "Ecommy Pro anual · Taller Luna",
      status: "pending",
      auto_recurring: { frequency: 12, frequency_type: "months", transaction_amount: 349990, currency_id: "ARS" },
    });
    expect(recorded).toEqual([{ planCode: "pro", preapprovalId: "pre_year", period: "yearly" }]);
  });

  it("anual con plan de MP: usa mp_plan_id_yearly", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "pre_year2", init_point: "https://www.mercadopago.com.ar/subscriptions/checkout?x=3" }), { status: 201 }),
    );
    const { d, recorded } = deps({
      loadPlan: async (code) => ({ code, name: "Pro", mp_plan_id: "mp_pro", mp_plan_id_yearly: "mp_pro_y", price_yearly: 349990, currency: "ARS" }),
    });
    const res = await startCheckout({ ...input, period: "yearly" }, d);
    expect(res).toMatchObject({ ok: true, mode: "plan" });
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toMatchObject({
      preapproval_plan_id: "mp_pro_y",
      external_reference: `${STORE}:pro:yearly`,
    });
    expect(recorded).toEqual([{ planCode: "pro", preapprovalId: "pre_year2", period: "yearly" }]);
  });

  it("anual sin precio anual (o sin 0019): no crea nada", async () => {
    const { d, recorded } = deps();
    expect(await startCheckout({ ...input, period: "yearly" }, d)).toMatchObject({ ok: false, error: expect.stringMatching(/pago anual/) });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(recorded).toEqual([]);
    // El anual no necesita el plan mensual de MP.
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: "pre_y3", init_point: "https://www.mercadopago.com.ar/x" }), { status: 201 }));
    const onlyYearly = deps({ loadPlan: async (code) => ({ code, name: "Pro", mp_plan_id: null, price_yearly: 349990 }) });
    expect(await startCheckout({ ...input, period: "yearly" }, onlyYearly.d)).toMatchObject({ ok: true });
    expect(await startCheckout(input, onlyYearly.d)).toMatchObject({ ok: false });
  });

  it("no crea nada si el plan no tiene mp_plan_id o ya hay una suscripción cobrando", async () => {
    const noPlan = deps({ loadPlan: async (code) => ({ code, name: "Business", mp_plan_id: null }) });
    expect(await startCheckout(input, noPlan.d)).toMatchObject({ ok: false });
    for (const provider_status of ["authorized", AUTHORIZED_UNPAID, "paused"]) {
      const busy = deps({
        loadSubscription: async () => ({
          plan_code: "starter",
          status: "active",
          provider: "mercadopago",
          provider_ref: "pre_old",
          provider_status,
          cancel_at_period_end: false,
        }),
      });
      expect(await startCheckout(input, busy.d)).toMatchObject({ ok: false, error: expect.stringMatching(/cancelá la renovación/) });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("A2: cancela en MP el preapproval anterior que todavía puede cobrar antes de crear el nuevo", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "pre_old", status: "cancelled" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "pre_new", init_point: "https://www.mercadopago.com.ar/subscriptions/checkout?x=2" }), { status: 201 }));
    const { d } = deps({
      loadSubscription: async () => ({
        plan_code: "pro",
        status: "trialing",
        provider: "mercadopago",
        provider_ref: "pre_old",
        provider_status: "pending",
        cancel_at_period_end: false,
      }),
    });
    const res = await startCheckout(input, d);
    expect(res).toMatchObject({ ok: true, preapprovalId: "pre_new", replaced: { id: "pre_old", cancelled: true } });
    const [cancelUrl, cancelInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(cancelUrl).toBe("https://api.mercadopago.com/preapproval/pre_old");
    expect(cancelInit.method).toBe("PUT");
    expect(JSON.parse(String(cancelInit.body))).toEqual({ status: "cancelled" });
  });

  it("A2: si MP no cancela el anterior, sigue igual (el webhook cancela el duplicado)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "boom" }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "pre_new", init_point: "https://www.mercadopago.com.ar/subscriptions/checkout?x=3" }), { status: 201 }));
    const { d } = deps({
      // Renovación cancelada que MP todavía ve autorizada (B7: volver a suscribirse).
      loadSubscription: async () => ({
        plan_code: "pro",
        status: "active",
        provider: "mercadopago",
        provider_ref: "pre_old",
        provider_status: "authorized",
        cancel_at_period_end: true,
      }),
    });
    expect(await startCheckout(input, d)).toMatchObject({ ok: true, replaced: { id: "pre_old", cancelled: false } });
  });

  it("previousToCancel", () => {
    const sub = (provider_status: string | null) => ({ provider: "mercadopago", provider_ref: "pre_x", provider_status });
    expect(previousToCancel(sub("pending"))).toBe("pre_x");
    expect(previousToCancel(sub("authorized"))).toBe("pre_x");
    expect(previousToCancel(sub("expired"))).toBe("pre_x");
    expect(previousToCancel(sub("cancelled"))).toBeNull();
    expect(previousToCancel({ provider: "manual", provider_ref: "pre_x", provider_status: "authorized" })).toBeNull();
    expect(previousToCancel(null)).toBeNull();
  });

  it("no redirige a un init_point que no sea de MercadoPago", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: "pre_x", init_point: "https://evil.example.com/pay" })));
    const { d, recorded } = deps();
    expect(await startCheckout(input, d)).toMatchObject({ ok: false });
    expect(recorded).toHaveLength(0);
    expect(isMercadoPagoUrl("https://www.mercadopago.com.ar/subscriptions/checkout")).toBe(true);
    expect(isMercadoPagoUrl("https://mercadopago.com.evil.io/")).toBe(false);
  });

  it("los errores de MP no filtran el token", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "invalid token APP_USR-1234567890-abcdef-secret" }), { status: 401 }));
    const { d } = deps();
    const err = await startCheckout(input, d).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MercadoPagoError);
    expect(String((err as Error).message)).not.toContain("APP_USR-1234567890");
    expect(redactTokens("Bearer abc.def")).toBe("Bearer [token]");
  });

  it("buildPreapprovalBody y checkoutReason", () => {
    expect(checkoutReason("Pro", "  Taller   Luna ")).toBe("Ecommy Pro · Taller Luna");
    expect(buildPreapprovalBody({ ...input, planName: "Pro", mpPlanId: "mp_pro" }).external_reference).toBe(`${STORE}:pro`);
    const yearly = buildInlinePreapprovalBody(
      { ...input, planName: "Starter", planCode: "starter", period: "yearly" },
      { frequency: 12, frequency_type: "months", transaction_amount: 149990, currency_id: "ARS" },
    );
    expect(yearly).toMatchObject({
      external_reference: `${STORE}:starter:yearly`,
      reason: "Ecommy Starter anual · Taller Luna",
      status: "pending",
      auto_recurring: { frequency: 12, transaction_amount: 149990 },
    });
    expect(yearly.preapproval_plan_id).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Mails
// ---------------------------------------------------------------------------

describe("mails de cobro", () => {
  const base = { storeName: "Taller Luna", storeUrl: "https://taller-luna.ecommy.app", platformUrl: "https://www.ecommy.app", ownerName: "Lucía Pérez" };
  it("activado: plan y fecha en el asunto", () => {
    const m = planActivatedEmail({ ...base, planName: "Pro", periodEnd: "2026-10-23T15:00:00Z" });
    expect(m.subject).toBe("Tu plan Pro está activo hasta el 23/10/2026");
    expect(m.text).toContain("Hola, Lucía.");
    expect(m.html).toContain("https://www.ecommy.app/admin/plan");
  });
  it("activado sin cobro todavía: no dice que cobramos", () => {
    const m = planActivatedEmail({ ...base, planName: "Pro", periodEnd: "2026-09-30T15:00:00Z", charged: false });
    expect(m.subject).toBe("Tu plan Pro está activo");
    expect(m.text).toContain("Tu plan está activo");
    expect(m.text).toContain("el primer cobro se acredita en los próximos días");
    expect(m.text).toContain("30/09/2026");
    expect(`${m.text} ${m.html}`).not.toMatch(/Cobramos/);
    expect(planActivatedEmail({ ...base, planName: "Pro", periodEnd: null }).html).toMatch(/Cobramos/);
  });
  it("activado anual: dice anual y que se renueva cada año", () => {
    const m = planActivatedEmail({ ...base, planName: "Pro", periodEnd: "2027-09-23T15:00:00Z", period: "yearly" });
    expect(m.subject).toBe("Tu plan Pro anual está activo hasta el 23/09/2027");
    expect(m.html).toContain("Se renueva solo cada año");
    expect(m.text).toContain("Plan: Pro anual");
    const unpaid = planActivatedEmail({ ...base, planName: "Pro", periodEnd: "2026-09-30T15:00:00Z", charged: false, period: "yearly" });
    expect(unpaid.text).toContain("el año completo");
    expect(planActivatedEmail({ ...base, planName: "Pro", periodEnd: null }).html).toContain("Se renueva solo cada mes");
  });
  it("no pudimos cobrar: pide revisar el medio de pago en MercadoPago", () => {
    const m = planPaymentFailedEmail({ ...base, planName: "Pro", graceUntil: "2026-10-30T15:00:00Z" });
    expect(m.subject).toBe("No pudimos cobrar tu plan Pro");
    expect(m.text).toMatch(/medio de pago/);
    expect(m.text).toContain("30/10/2026");
  });
});
