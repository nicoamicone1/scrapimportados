import { randomBytes } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { openToken, sealToken } from "./crypto";
import { installmentAmount, installmentLabel, normalizeFreeInstallments, normalizeMaxInstallments } from "./installments";
import { buildPreferenceBody, cleanDescriptor, isMercadoPagoCheckoutUrl, marketplaceFee, type PreferenceInput } from "./preference-body";
import { paymentSummary, processPaymentNotification, type ApplyArgs, type MpPayment, type PaymentsRepo } from "./webhook";

const STORE = "11111111-1111-4111-8111-111111111111";
const ORDER = "22222222-2222-4222-8222-222222222222";

describe("crypto", () => {
  const key = randomBytes(32);

  it("cifra y descifra", () => {
    const sealed = sealToken("APP_USR-123-abc", key);
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("APP_USR");
    expect(openToken(sealed, key)).toBe("APP_USR-123-abc");
  });

  it("no abre con otra clave ni alterado", () => {
    const sealed = sealToken("secreto", key);
    expect(openToken(sealed, randomBytes(32))).toBeNull();
    const parts = sealed.split(".");
    parts[3] = Buffer.from("otra cosa").toString("base64url");
    expect(openToken(parts.join("."), key)).toBeNull();
    expect(openToken("basura", key)).toBeNull();
    expect(openToken(null, key)).toBeNull();
  });

  it("cada cifrado es distinto (IV aleatorio)", () => {
    expect(sealToken("x", key)).not.toBe(sealToken("x", key));
  });
});

describe("cuotas", () => {
  it("redondea cada cuota hacia arriba al centavo", () => {
    expect(installmentAmount(1000, 3)).toBe(333.34);
    expect(installmentAmount(900, 3)).toBe(300);
    expect(installmentAmount(0, 3)).toBe(0);
  });

  it("arma la etiqueta sólo con más de una cuota", () => {
    expect(installmentLabel(60000, 6, { currency: "ARS", locale: "es-AR" })).toMatch(/^6 cuotas sin interés de \$\s?10\.000$/);
    expect(installmentLabel(60000, 1)).toBe("");
    expect(installmentLabel(0, 6)).toBe("");
  });

  it("normaliza valores", () => {
    expect(normalizeFreeInstallments(6)).toBe(6);
    expect(normalizeFreeInstallments("12")).toBe(12);
    expect(normalizeFreeInstallments(5)).toBe(0);
    expect(normalizeMaxInstallments(30)).toBe(12);
    expect(normalizeMaxInstallments(18)).toBe(18);
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- lectura de un JSON armado por el test
type Body = Record<string, any>;

describe("preferencia", () => {
  const input: PreferenceInput = {
    order: { id: ORDER, number: 1043, total: 48500.5, currency: "ARS", expiresAt: null },
    storeId: STORE,
    storeName: "Librería Ñandú",
    payer: { name: "Lucía Fernández", email: "lucia@example.com" },
    orderUrl: "https://nextbooks.ecommy.app/pedido/abc",
    notificationUrl: `https://www.ecommy.app/api/payments/mercadopago/webhook?store=${STORE}`,
    maxInstallments: 12,
    binaryMode: true,
    statementDescriptor: "",
    feePercent: 0,
  };

  it("un ítem por el total, referencia = pedido, vueltas a la página del pedido", () => {
    const body = buildPreferenceBody(input) as Body;
    expect(body.items).toEqual([
      { id: ORDER, title: "Pedido #1043 · Librería Ñandú", quantity: 1, unit_price: 48500.5, currency_id: "ARS" },
    ]);
    expect(body.external_reference).toBe(ORDER);
    expect(body.back_urls.success).toBe("https://nextbooks.ecommy.app/pedido/abc?pago=ok");
    expect(body.back_urls.failure).toBe("https://nextbooks.ecommy.app/pedido/abc?pago=error");
    expect(body.auto_return).toBe("approved");
    expect(body.notification_url).toContain("store=");
    expect(body.payment_methods).toEqual({ installments: 12 });
    expect(body.payer).toEqual({ name: "Lucía", surname: "Fernández", email: "lucia@example.com" });
    expect(body.statement_descriptor).toBe("Libreria Nand");
    expect(body.marketplace_fee).toBeUndefined();
    expect(body.expires).toBeUndefined();
  });

  it("comisión de Ecommy y vencimiento", () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const body = buildPreferenceBody({ ...input, feePercent: 1.5, order: { ...input.order, expiresAt: future } }) as Body;
    expect(body.marketplace_fee).toBe(727.51);
    expect(body.expires).toBe(true);
    expect(body.expiration_date_to).toBe(future);
  });

  it("sin https no manda auto_return ni notification_url (dev)", () => {
    const body = buildPreferenceBody({ ...input, orderUrl: "http://localhost:3000/s/demo/pedido/abc", notificationUrl: "http://localhost:3000/x" });
    expect(body.auto_return).toBeUndefined();
    expect(body.notification_url).toBeUndefined();
  });

  it("helpers", () => {
    expect(marketplaceFee(1000, 0)).toBe(0);
    expect(marketplaceFee(1000, 50)).toBe(100);
    expect(cleanDescriptor("Tienda de Café & Té!")).toBe("Tienda de Caf");
    expect(isMercadoPagoCheckoutUrl("https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1")).toBe(true);
    expect(isMercadoPagoCheckoutUrl("https://sandbox.mercadopago.com.ar/checkout")).toBe(true);
    expect(isMercadoPagoCheckoutUrl("http://www.mercadopago.com.ar/x")).toBe(false);
    expect(isMercadoPagoCheckoutUrl("https://mercadopago.com.ar.evil.com/x")).toBe(false);
  });
});

describe("webhook", () => {
  const approved: MpPayment = {
    id: 987654321,
    status: "approved",
    status_detail: "accredited",
    transaction_amount: 48500.5,
    currency_id: "ARS",
    external_reference: ORDER,
    collector_id: 555,
    installments: 6,
    payment_method_id: "visa",
    card: { last_four_digits: "4242" },
  };

  function repo(payment: MpPayment, opts: { seller?: number | null; order?: boolean } = {}) {
    const applied: ApplyArgs[] = [];
    const r: PaymentsRepo = {
      getSeller: vi.fn(async () => (opts.seller === null ? null : { mpUserId: opts.seller ?? 555 })),
      fetchPayment: vi.fn(async () => payment),
      getOrder: vi.fn(async () => (opts.order === false ? null : { id: ORDER, total: 48500.5, currency: "ARS" })),
      applyPayment: vi.fn(async (a: ApplyArgs) => {
        applied.push(a);
        return { applied: true, payment_status: "paid", notify: true, public_token: "t" };
      }),
    };
    return { r, applied };
  }

  it("aplica un pago aprobado de la cuenta y el pedido de la tienda", async () => {
    const { r, applied } = repo(approved);
    const res = await processPaymentNotification(STORE, "987654321", r);
    expect(res.outcome).toBe("applied");
    expect(applied[0]).toMatchObject({ storeId: STORE, orderId: ORDER, paymentId: "987654321", status: "approved", amount: 48500.5 });
    expect(applied[0].detail).toMatchObject({ installments: 6, last_four: "4242", summary: "6 cuotas · Visa ••4242" });
  });

  it("ignora pagos de otra cuenta, sin referencia o de otro pedido", async () => {
    expect(await processPaymentNotification(STORE, "1", repo(approved, { seller: 999 }).r)).toEqual({ outcome: "ignored", reason: "other_collector" });
    expect(await processPaymentNotification(STORE, "1", repo({ ...approved, external_reference: "x" }).r)).toEqual({
      outcome: "ignored",
      reason: "no_reference",
    });
    expect(await processPaymentNotification(STORE, "1", repo(approved, { order: false }).r)).toEqual({ outcome: "ignored", reason: "order_not_found" });
    expect(await processPaymentNotification(STORE, "1", repo(approved, { seller: null }).r)).toEqual({ outcome: "ignored", reason: "no_account" });
    expect(await processPaymentNotification("no-uuid", "1", repo(approved).r)).toEqual({ outcome: "ignored", reason: "store_invalid" });
    expect(await processPaymentNotification(STORE, "abc", repo(approved).r)).toEqual({ outcome: "ignored", reason: "payment_id_invalid" });
    expect(await processPaymentNotification(STORE, "1", repo({ ...approved, currency_id: "USD" }).r)).toEqual({
      outcome: "ignored",
      reason: "currency_mismatch",
    });
  });

  it("un aprobado por menos del total no marca pagado", async () => {
    const { r, applied } = repo({ ...approved, transaction_amount: 100 });
    const res = await processPaymentNotification(STORE, "1", r);
    expect(res.outcome === "applied" && res.status).toBe("amount_mismatch");
    expect(applied[0].status).toBe("amount_mismatch");
    expect(applied[0].detail.status).toBe("amount_mismatch");
  });

  it("pasa rechazos y devoluciones tal cual", async () => {
    for (const status of ["rejected", "refunded", "charged_back", "in_process"]) {
      const { r, applied } = repo({ ...approved, status });
      await processPaymentNotification(STORE, "1", r);
      expect(applied[0].status).toBe(status);
    }
  });

  it("resumen del pago", () => {
    expect(paymentSummary({ id: 1, payment_method_id: "account_money", installments: 1 })).toBe("dinero en Mercado Pago");
    expect(paymentSummary({ id: 1, payment_method_id: "master", installments: 3, card: { last_four_digits: "1111" } })).toBe("3 cuotas · Mastercard ••1111");
  });
});
