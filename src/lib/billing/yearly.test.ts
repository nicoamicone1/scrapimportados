import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { billingStartCheckoutArgs, startCheckout, type CheckoutDeps, type CheckoutSubscription } from "./checkout";
import type { BillingDb } from "./service";
import { AUTHORIZED_UNPAID, decideSubscription, mpPlanIdConflict, mpPlanProblem, type DecideInput } from "./state";
import { supabaseBillingRepo } from "./sync";
import type { MpPreapproval } from "./types";
import { payableYearly } from "./view";

/*
 * Pago anual (0019): huecos de la revisión de 515347d. Fin del período sin
 * next_payment_date, ramas del anual, RPC que mandan el período sólo si es
 * anual, clave de idempotencia, cambio mensual → anual y controles de
 * /platform/planes.
 */

const STORE = "3f1c2a9e-8b7d-4c6e-9a5f-1b2c3d4e5f60";
const NOW = new Date("2026-09-23T12:00:00Z");

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

/** Pro anual cobrado el 1/9/2026, vigente hasta el 1/9/2027. */
const paidYearly = (patch: Partial<DecideInput["current"]> = {}) =>
  current({
    status: "active",
    provider_status: "authorized",
    current_period_start: "2026-09-01T00:00:00.000Z",
    current_period_end: "2027-09-01T00:00:00.000Z",
    last_payment_at: "2026-09-01T00:00:00.000Z",
    ...patch,
  });

function pre(status: string, patch: Partial<MpPreapproval> = {}): DecideInput["preapproval"] {
  return { id: "pre_y", status, next_payment_date: null, date_created: "2026-09-23T11:50:00.000Z", summarized: null, ...patch };
}

const approved = (debit: string) => ({ status: "processed", payment: { status: "approved" }, debit_date: debit });

describe("anual: fin del período sin next_payment_date (M1)", () => {
  it("con un cobro nuevo, 12 meses desde el cobro aunque el current_period_end guardado sea viejo", () => {
    const d = decideSubscription({
      preapproval: pre("authorized"),
      payment: approved("2026-09-23T11:58:00Z"),
      current: paidYearly({ current_period_end: "2026-05-01T00:00:00.000Z", last_payment_at: "2025-05-01T00:00:00.000Z" }),
      planCode: "pro",
      period: "yearly",
      now: NOW,
    });
    expect(d).toMatchObject({ status: "active", billingPeriod: "yearly", periodStart: "2026-09-23T11:58:00.000Z", periodEnd: "2027-09-23T11:58:00.000Z" });
  });

  it("mensual con la renovación cancelada que pasa al anual: el anual no hereda el fin del mes pago", () => {
    const cancellingMonthly = current({
      status: "active",
      provider_status: "cancelled",
      cancel_at_period_end: true,
      current_period_start: "2026-09-20T00:00:00.000Z",
      current_period_end: "2026-10-20T00:00:00.000Z",
      last_payment_at: "2026-09-20T00:00:00.000Z",
    });
    const d = decideSubscription({
      preapproval: pre("authorized"),
      payment: approved("2026-09-23T11:58:00Z"),
      current: cancellingMonthly,
      planCode: "pro",
      period: "yearly",
      now: NOW,
    });
    expect(d).toMatchObject({ status: "active", billingPeriod: "yearly", cancelAtPeriodEnd: false, periodEnd: "2027-09-23T11:58:00.000Z" });
    // El mismo cobro por summarized.last_charged_date (sin authorized_payment) da lo mismo.
    const bySummary = decideSubscription({
      preapproval: pre("authorized", { summarized: { charged_quantity: 1, last_charged_date: "2026-09-23T11:58:00Z" } }),
      current: cancellingMonthly,
      planCode: "pro",
      period: "yearly",
      now: NOW,
    });
    expect(bySummary.periodEnd).toBe("2027-09-23T11:58:00.000Z");
  });

  it("sin cobro nuevo, el current_period_end guardado sólo si termina después del inicio", () => {
    const sameCharge = { charged_quantity: 1, last_charged_date: "2026-09-01T00:00:00Z" };
    const keeps = decideSubscription({ preapproval: pre("authorized", { summarized: sameCharge }), current: paidYearly(), planCode: "pro", period: "yearly", now: NOW });
    expect(keeps).toMatchObject({ status: "active", periodEnd: "2027-09-01T00:00:00.000Z", email: null });
    const stale = decideSubscription({
      preapproval: pre("authorized", { summarized: sameCharge }),
      current: paidYearly({ current_period_end: "2026-08-01T00:00:00.000Z" }),
      planCode: "pro",
      period: "yearly",
      now: NOW,
    });
    expect(stale.periodEnd).toBe("2027-09-01T00:00:00.000Z");
  });

  it("con next_payment_date manda MercadoPago", () => {
    const d = decideSubscription({
      preapproval: pre("authorized", { next_payment_date: "2027-09-20T10:00:00Z" }),
      payment: approved("2026-09-20T10:00:00Z"),
      current: current(),
      planCode: "pro",
      period: "yearly",
      now: NOW,
    });
    expect(d.periodEnd).toBe("2027-09-20T10:00:00.000Z");
  });
});

describe("anual: ramas de la máquina de estados", () => {
  it("authorized_unpaid: 7 días de gracia anual; el primer cobro abre los 12 meses", () => {
    const grace = decideSubscription({ preapproval: pre("authorized"), current: current(), planCode: "pro", period: "yearly", now: NOW });
    expect(grace).toMatchObject({
      status: "active",
      billingPeriod: "yearly",
      providerStatus: AUTHORIZED_UNPAID,
      periodEnd: "2026-09-30T12:00:00.000Z",
      email: "activated",
    });
    const unpaid = current({ status: "active", provider_status: AUTHORIZED_UNPAID, current_period_start: grace.periodStart, current_period_end: grace.periodEnd });
    const paid = decideSubscription({ preapproval: pre("authorized"), payment: approved("2026-09-25T10:00:00Z"), current: unpaid, planCode: "pro", period: "yearly", now: NOW });
    expect(paid).toMatchObject({ status: "active", billingPeriod: "yearly", providerStatus: "authorized", periodEnd: "2027-09-25T10:00:00.000Z", email: null });
  });

  it("cancelled: sigue hasta el final del año pago; sin período, cancelled", () => {
    const cancelling = decideSubscription({ preapproval: pre("cancelled"), current: paidYearly(), planCode: "pro", period: "yearly", now: NOW });
    expect(cancelling).toMatchObject({ status: "active", cancelAtPeriodEnd: true, billingPeriod: "yearly", email: null });
    const over = decideSubscription({
      preapproval: pre("cancelled"),
      current: paidYearly({ current_period_end: "2026-09-01T00:00:00.000Z" }),
      planCode: "pro",
      period: "yearly",
      now: NOW,
    });
    expect(over).toMatchObject({ status: "cancelled", cancelAtPeriodEnd: false });
  });

  it("past_due: paused o cobro rechazado en un anual pagado; un aviso sin cobro no lo regulariza", () => {
    const paused = decideSubscription({ preapproval: pre("paused"), current: paidYearly(), planCode: "pro", period: "yearly", now: NOW });
    expect(paused).toMatchObject({ status: "past_due", billingPeriod: "yearly", email: "payment_failed" });
    const rejected = decideSubscription({
      preapproval: pre("authorized"),
      payment: { status: "recycling", payment: { status: "rejected" } },
      current: paidYearly(),
      planCode: "pro",
      period: "yearly",
      now: NOW,
    });
    expect(rejected).toMatchObject({ status: "past_due", billingPeriod: "yearly", email: "payment_failed" });
    const pastDue = paidYearly({ status: "past_due" });
    expect(decideSubscription({ preapproval: pre("authorized"), current: pastDue, planCode: "pro", period: "yearly", now: NOW }).status).toBeNull();
    const back = decideSubscription({ preapproval: pre("authorized"), payment: approved("2027-09-02T10:00:00Z"), current: pastDue, planCode: "pro", period: "yearly", now: NOW });
    expect(back).toMatchObject({ status: "active", periodEnd: "2028-09-02T10:00:00.000Z" });
  });
});

describe("RPC: p_billing_period sólo en el anual", () => {
  it("billing_start_checkout", () => {
    const base = { storeId: STORE, planCode: "pro", preapprovalId: "pre_1" };
    expect(billingStartCheckoutArgs({ ...base, period: "monthly" })).toEqual({ p_store_id: STORE, p_plan_code: "pro", p_provider_ref: "pre_1" });
    expect(billingStartCheckoutArgs({ ...base, period: "yearly" })).toEqual({
      p_store_id: STORE,
      p_plan_code: "pro",
      p_provider_ref: "pre_1",
      p_billing_period: "yearly",
    });
  });

  it("billing_apply_subscription (webhook y sincronización)", async () => {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const db = { rpc: async (fn: string, args: Record<string, unknown>) => (calls.push({ fn, args }), { error: null }) } as unknown as BillingDb;
    const repo = supabaseBillingRepo(db);
    for (const period of ["monthly", "yearly"] as const) {
      const decision = decideSubscription({ preapproval: pre("authorized"), payment: approved("2026-09-23T11:58:00Z"), current: current(), planCode: "pro", period, now: NOW });
      await repo.apply({ storeId: STORE, preapprovalId: "pre_y", decision });
    }
    expect(calls.map((c) => c.fn)).toEqual(["billing_apply_subscription", "billing_apply_subscription"]);
    expect(calls[0].args).not.toHaveProperty("p_billing_period");
    expect(calls[0].args).toMatchObject({ p_period_end: "2026-10-23T11:58:00.000Z" });
    expect(calls[1].args).toMatchObject({ p_billing_period: "yearly", p_period_end: "2027-09-23T11:58:00.000Z" });
  });
});

describe("startCheckout anual", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("MP_ACCESS_TOKEN", "APP_USR-1234567890-abcdef-secret");
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const input = { storeId: STORE, storeName: "Taller Luna", planCode: "pro", origin: "https://www.ecommy.app", payerEmail: "lucia@example.com" };
  const plan = { code: "pro", name: "Pro", mp_plan_id: "mp_pro", mp_plan_id_yearly: "mp_pro_y", price_monthly: 34999, price_yearly: 349990, currency: "ARS" };

  function deps(sub: CheckoutSubscription | null = null, patch: Partial<CheckoutDeps> = {}): CheckoutDeps {
    return { loadPlan: async () => plan, loadSubscription: async () => sub, recordCheckout: async () => null, ...patch };
  }

  const created = (id: string) =>
    new Response(JSON.stringify({ id, init_point: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=${id}` }), { status: 201 });
  const keyOf = (call: unknown) => ((call as [string, RequestInit])[1].headers as Record<string, string>)["X-Idempotency-Key"];

  it("la clave de idempotencia del mensual y la del anual son distintas (mismo minuto, mismo plan)", async () => {
    fetchMock.mockResolvedValueOnce(created("pre_m")).mockResolvedValueOnce(created("pre_y")).mockResolvedValueOnce(created("pre_m2"));
    expect(await startCheckout(input, deps())).toMatchObject({ ok: true });
    expect(await startCheckout({ ...input, period: "yearly" }, deps())).toMatchObject({ ok: true });
    expect(await startCheckout(input, deps())).toMatchObject({ ok: true });
    const [monthly, yearly, again] = fetchMock.mock.calls.map(keyOf);
    expect(monthly).toMatch(/^ecommy-[0-9a-f]{48}$/);
    expect(yearly).not.toBe(monthly);
    // Doble clic del mismo intento: misma clave.
    expect(again).toBe(monthly);
  });

  it("mensual cobrando → anual del mismo plan: primero cancelar la renovación mensual", async () => {
    const charging: CheckoutSubscription = {
      plan_code: "pro",
      status: "active",
      provider: "mercadopago",
      provider_ref: "pre_old",
      provider_status: "authorized",
      cancel_at_period_end: false,
      billing_period: "monthly",
    };
    expect(await startCheckout({ ...input, period: "yearly" }, deps(charging))).toEqual({
      ok: false,
      error: "Cancelá la renovación mensual para pasar al anual.",
    });
    // Sin 0019 (sin billing_period) cuenta como mensual.
    const legacy: CheckoutSubscription = { ...charging };
    delete legacy.billing_period;
    expect(await startCheckout({ ...input, period: "yearly" }, deps(legacy))).toMatchObject({ ok: false, error: expect.stringMatching(/renovación mensual/) });
    expect(await startCheckout(input, deps(charging))).toEqual({ ok: false, error: "Ya estás pagando este plan con MercadoPago." });
    expect(await startCheckout({ ...input, period: "yearly" }, deps({ ...charging, billing_period: "yearly" }))).toEqual({
      ok: false,
      error: "Ya estás pagando este plan con MercadoPago.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un anual que no se puede ofrecer contra el mensual no crea nada", async () => {
    for (const price_yearly of [34999 * 12, 34999, 100000]) {
      const res = await startCheckout({ ...input, period: "yearly" }, deps(null, { loadPlan: async () => ({ ...plan, price_yearly }) }));
      expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/pago anual/) });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("/platform/planes: controles del plan de MercadoPago", () => {
  it("mpPlanProblem: cobro recurrente, frecuencia, moneda y (anual) monto", () => {
    const monthly = { auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 34999, currency_id: "ARS" } };
    expect(mpPlanProblem(monthly, { period: "monthly", currency: "ARS" })).toBeNull();
    expect(mpPlanProblem({ auto_recurring: null }, { period: "monthly", currency: "ARS" })).toMatch(/cobro recurrente/);
    expect(mpPlanProblem({}, { period: "yearly", currency: "ARS" })).toMatch(/cobro recurrente/);
    expect(mpPlanProblem(monthly, { period: "yearly", currency: "ARS", amount: 34999 })).toMatch(/cada 12 meses/);
    expect(mpPlanProblem({ auto_recurring: { ...monthly.auto_recurring, frequency: 12 } }, { period: "monthly", currency: "ARS" })).toMatch(/cada mes/);
    expect(mpPlanProblem({ auto_recurring: { ...monthly.auto_recurring, frequency_type: "days" } }, { period: "monthly", currency: "ARS" })).toMatch(/cada mes/);
    expect(mpPlanProblem({ auto_recurring: { ...monthly.auto_recurring, currency_id: "USD" } }, { period: "monthly", currency: "ARS" })).toMatch(/USD/);
    const yearly = { auto_recurring: { frequency: 12, frequency_type: "months", transaction_amount: 349990, currency_id: "ars" } };
    expect(mpPlanProblem(yearly, { period: "yearly", currency: "ARS", amount: 349990 })).toBeNull();
    expect(mpPlanProblem(yearly, { period: "yearly", currency: "ARS", amount: 299990 })).toMatch(/igualalos/);
  });

  it("mpPlanIdConflict: un mismo id no puede ser mensual y anual, ni de dos planes", () => {
    const plans = [
      { code: "starter", mp_plan_id: "mp_s", mp_plan_id_yearly: "mp_s_y" },
      { code: "pro", mp_plan_id: "mp_p", mp_plan_id_yearly: null },
    ];
    // El mismo campo del mismo plan (volver a guardar): sin conflicto.
    expect(mpPlanIdConflict("mp_p", { code: "pro", period: "monthly" }, plans)).toBeNull();
    expect(mpPlanIdConflict("", { code: "pro", period: "yearly" }, plans)).toBeNull();
    expect(mpPlanIdConflict("mp_p_y", { code: "pro", period: "yearly" }, plans)).toBeNull();
    // El mensual de este plan como anual, y al revés.
    expect(mpPlanIdConflict("mp_p", { code: "pro", period: "yearly" }, plans)).toMatch(/mensual .* de este plan/);
    expect(mpPlanIdConflict("mp_s_y", { code: "starter", period: "monthly" }, plans)).toMatch(/anual .* de este plan/);
    // El de otro plan.
    expect(mpPlanIdConflict("mp_s", { code: "pro", period: "monthly" }, plans)).toMatch(/plan starter/);
    expect(mpPlanIdConflict("mp_s_y", { code: "pro", period: "yearly" }, plans)).toMatch(/plan starter/);
  });

  it("payableYearly: sólo un anual que se puede ofrecer contra el mensual", () => {
    expect(payableYearly({ price_monthly: "34999.00", price_yearly: "349990.00" })).toBe(true);
    expect(payableYearly({ price_monthly: 34999, price_yearly: 34999 * 12 })).toBe(false);
    expect(payableYearly({ price_monthly: 34999, price_yearly: 100000 })).toBe(false);
    expect(payableYearly({ price_monthly: null, price_yearly: 349990 })).toBe(false);
    expect(payableYearly({ price_monthly: 34999, price_yearly: null })).toBe(false);
    expect(payableYearly({ price_yearly: 349990 })).toBe(false);
  });
});
