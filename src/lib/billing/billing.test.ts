import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { planActivatedEmail, planPaymentFailedEmail } from "@/lib/email/templates/billing";

import { buildPreapprovalBody, checkoutReason, isMercadoPagoUrl, startCheckout, type CheckoutDeps } from "./checkout";
import { MercadoPagoError, redactTokens } from "./mercadopago";
import { buildManifest, parseSignatureHeader, verifyWebhookSignature } from "./signature";
import { decideSubscription, isUuid, resolvePlanCode, type DecideInput } from "./state";
import { processNotification, syncPreapproval, type BillingRepo, type MpReader } from "./sync";
import type { BillingSubscriptionRow, MpPreapproval } from "./types";
import { billingState } from "./view";

const SECRET = "whsec_test_123";
const STORE = "3f1c2a9e-8b7d-4c6e-9a5f-1b2c3d4e5f60";
const NOW = new Date("2026-09-23T12:00:00Z");

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
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-abc", dataId: "123456", secret: SECRET })).toBe(true);
  });

  it("acepta data.id alfanumérico en minúsculas (regla de la doc) o tal cual (SDK)", () => {
    const lower = sign("2c9380848f", "r", "1");
    expect(verifyWebhookSignature({ xSignature: lower, xRequestId: "r", dataId: "2C9380848F", secret: SECRET })).toBe(true);
    const asIs = sign("2C9380848F", "r", "1");
    expect(verifyWebhookSignature({ xSignature: asIs, xRequestId: "r", dataId: "2C9380848F", secret: SECRET })).toBe(true);
  });

  it("rechaza secreto equivocado, datos alterados y cabeceras rotas", () => {
    const xSignature = sign("123456", "req-abc", "1704908010");
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-abc", dataId: "123456", secret: "otro" })).toBe(false);
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-abc", dataId: "999999", secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-xyz", dataId: "123456", secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: null, xRequestId: "req-abc", dataId: "123456", secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: "v1=abc", xRequestId: "req-abc", dataId: "123456", secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: "ts=1,v1=zz", xRequestId: "req-abc", dataId: "123456", secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ xSignature, xRequestId: "req-abc", dataId: "123456", secret: "" })).toBe(false);
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

  it("resolvePlanCode: manda el preapproval_plan_id; si no, el plan elegido en el checkout", () => {
    const plans = [
      { code: "starter", mp_plan_id: "mp_s" },
      { code: "pro", mp_plan_id: "mp_p" },
    ];
    expect(resolvePlanCode({ preapproval_plan_id: "mp_p" }, plans, "starter")).toBe("pro");
    expect(resolvePlanCode({ preapproval_plan_id: null }, plans, "starter")).toBe("starter");
    expect(resolvePlanCode({ preapproval_plan_id: "otro" }, plans, "inexistente")).toBeNull();
  });

  it("isUuid y billingState", () => {
    expect(isUuid(STORE)).toBe(true);
    expect(isUuid("1234")).toBe(false);
    expect(isUuid(`${STORE}' or 1=1`)).toBe(false);
    expect(billingState({ provider: "mercadopago", provider_status: "authorized", status: "active", cancel_at_period_end: true })).toBe("cancelling");
    expect(billingState({ provider: "mercadopago", provider_status: "pending", status: "trialing", cancel_at_period_end: false })).toBe("pending");
    expect(billingState({ provider: "manual", provider_status: null, status: "active", cancel_at_period_end: false })).toBe("none");
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
    listPlans: async () => [
      { code: "starter", mp_plan_id: "mp_s" },
      { code: "pro", mp_plan_id: "mp_p" },
    ],
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
      return { id, status: "authorized", external_reference: STORE, preapproval_plan_id: "mp_p", next_payment_date: "2026-10-23T12:00:00Z", ...preapproval };
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
        return { id, status: "authorized", external_reference: STORE, preapproval_plan_id: "mp_p" };
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
      [{}, subRow({ provider_ref: "pre_otro" }), "provider_ref"],
      [{}, subRow({ provider: "manual" }), "manual"],
      [{ preapproval_plan_id: "desconocido" }, subRow({ provider_plan_code: null }), "plan"],
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
      loadSubscription: async () => ({ plan_code: "pro", status: "trialing", provider: null, provider_status: null, cancel_at_period_end: false }),
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
      external_reference: STORE,
      back_url: "https://www.ecommy.app/admin/plan?mp=ok",
      reason: "Ecommy Pro · Taller Luna",
    });
    // Sólo se registra el preapproval (billing_start_checkout): nada de billing_apply_subscription.
    expect(recorded).toEqual([{ planCode: "pro", preapprovalId: "pre_new" }]);
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
      external_reference: STORE,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 34999, currency_id: "ARS" },
    });
    expect(recorded).toEqual([{ planCode: "pro", preapprovalId: "pre_inline" }]);
  });

  it("no crea nada si el plan no tiene mp_plan_id o ya hay una suscripción cobrando", async () => {
    const noPlan = deps({ loadPlan: async (code) => ({ code, name: "Business", mp_plan_id: null }) });
    expect(await startCheckout(input, noPlan.d)).toMatchObject({ ok: false });
    const busy = deps({
      loadSubscription: async () => ({ plan_code: "starter", status: "active", provider: "mercadopago", provider_status: "authorized", cancel_at_period_end: false }),
    });
    expect(await startCheckout(input, busy.d)).toMatchObject({ ok: false, error: expect.stringMatching(/cancelá la renovación/) });
    expect(fetchMock).not.toHaveBeenCalled();
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
    expect(buildPreapprovalBody({ ...input, planName: "Pro", mpPlanId: "mp_pro" }).external_reference).toBe(STORE);
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
  it("no pudimos cobrar: pide revisar el medio de pago en MercadoPago", () => {
    const m = planPaymentFailedEmail({ ...base, planName: "Pro", graceUntil: "2026-10-30T15:00:00Z" });
    expect(m.subject).toBe("No pudimos cobrar tu plan Pro");
    expect(m.text).toMatch(/medio de pago/);
    expect(m.text).toContain("30/10/2026");
  });
});
