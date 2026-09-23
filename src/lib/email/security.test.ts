import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Fuera de un request `after()` de Next lanza: en los tests corre en el acto.
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));
vi.mock("@/lib/supabase/server", () => ({ createPublicClient: vi.fn() }));
vi.mock("@/lib/store/orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store/orders")>()),
  getOrderByToken: vi.fn(),
}));

import { getOrderByToken, type PublicOrder } from "@/lib/store/orders";
import type { StoreSettings } from "@/lib/store/settings";

import { notifyOrderCreated } from "./notify";
import { maskEmails, resetEmailWarnings, sendEmail, setEmailTimingForTests } from "./send";
import { newOrderSellerEmail, orderReceivedEmail, withdrawalSellerEmail, type OrderEmailData, type StoreEmailInfo } from "./templates";
import { greeting, plainPersonName } from "./templates/shared";
import { trialNoticeKind } from "./trial-notices";

/*
 * Revisión de seguridad 2026-09-23: el checkout y el arrepentimiento son
 * públicos, así que todo lo que el comprador tipea (nombre, nota, motivo)
 * puede ser un intento de phishing que sale firmado por la tienda o por Ecommy.
 */

const store: StoreEmailInfo = {
  name: "Taller Luna",
  url: "https://taller-luna.ecommy.app",
  logoUrl: null,
  primary: "#8a3b12",
  primaryText: "#ffffff",
  contactEmail: "hola@tallerluna.com",
  whatsappUrl: null,
};
const seller = { name: "Taller Luna", contactEmail: "hola@tallerluna.com", platformUrl: "https://www.ecommy.app" };

function order(patch: Partial<OrderEmailData> = {}): OrderEmailData {
  return {
    id: "o1",
    number: 1043,
    createdAt: "2026-09-22T18:30:00Z",
    currency: "ARS",
    locale: "es-AR",
    timezone: "America/Argentina/Buenos_Aires",
    status: "pending",
    paymentStatus: "pending",
    customer: { name: "Lucía Fernández", email: "lucia@example.com", phone: "" },
    items: [{ name: "Banqueta", variantTitle: null, qty: 1, unitPrice: 1000, total: 1000 }],
    subtotal: 1000,
    promoTotal: 0,
    couponCode: null,
    couponDiscount: 0,
    paymentDiscount: 0,
    paymentDiscountPercent: 0,
    shippingCost: 0,
    shippingZoneName: null,
    total: 1000,
    fulfillment: "pickup",
    deliveryText: "Retiro en el local",
    pickup: { name: "Local", address: "", hoursText: "" },
    payment: { name: "Transferencia", type: "transfer", instructions: "Más info en https://pagos-falsos.example" },
    transfer: null,
    expiresAt: null,
    notes: "Hacé clic en https://phishing.example para confirmar tu cuenta",
    tracking: null,
    cancelReason: null,
    statusUrl: "https://taller-luna.ecommy.app/pedido/0123456789abcdef",
    ...patch,
  };
}

describe("saludo del comprador", () => {
  it("usa el primer nombre sólo si son letras (hasta 30)", () => {
    expect(greeting("Lucía Fernández")).toBe("Hola, Lucía.");
    expect(greeting("María-José O’Neill")).toBe("Hola, María-José.");
    expect(greeting("www.ofertas-ya.com Pérez")).toBe("Hola.");
    expect(greeting("Ganaste! Pérez")).toBe("Hola.");
    expect(greeting("<b>Ana</b>")).toBe("Hola.");
    expect(greeting("a".repeat(31))).toBe("Hola.");
    expect(greeting("")).toBe("Hola.");
  });

  it("Recibimos tu pedido: nombre inválido → 'Hola.', sin eco de la nota", () => {
    const mail = orderReceivedEmail(order({ customer: { name: "https://phishing.example", email: "x@example.com", phone: "" } }), store);
    expect(mail.text).toContain("Hola. Gracias por comprar en Taller Luna");
    expect(mail.text).not.toContain("phishing.example");
    expect(mail.html).not.toContain("phishing.example");
    expect(mail.text).not.toContain("Tu nota");
  });

  it("las instrucciones de pago del vendedor quedan como texto, sin link", () => {
    const { html } = orderReceivedEmail(order(), store);
    expect(html).toContain("https://pagos-falsos.example");
    expect(html).not.toContain('href="https://pagos-falsos.example');
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    for (const href of hrefs) expect(href.startsWith("https://taller-luna.ecommy.app")).toBe(true);
  });
});

describe("avisos al vendedor", () => {
  it("el asunto lleva el nombre sólo si parece un nombre, recortado a 40", () => {
    const long = newOrderSellerEmail(order({ customer: { name: "Ana María de los Ángeles Fernández Etchegaray", email: "", phone: "" } }), seller);
    const name = long.subject.split(" · ").at(-1) ?? "";
    expect(name.length).toBeLessThanOrEqual(40);
    expect(name.endsWith("…")).toBe(true);
    expect(long.subject).toMatch(/^Nuevo pedido #1043 · \$\s?1\.000 · Ana María de los Ángeles/);

    const phishing = newOrderSellerEmail(
      order({ customer: { name: "Verificá tu cuenta en ecommy-soporte.com", email: "", phone: "" } }),
      seller,
    );
    expect(phishing.subject).toMatch(/^Nuevo pedido #1043 · \$\s?1\.000$/);
    expect(phishing.html).not.toMatch(/<title>[^<]*ecommy-soporte/);
    // El nombre completo queda en la fila "Cliente", rotulado.
    expect(phishing.text).toContain("Cliente: Verificá tu cuenta en ecommy-soporte.com");

    const multiline = newOrderSellerEmail(order({ customer: { name: "Ana\r\nBcc: x@y.com", email: "", phone: "" } }), seller);
    expect(multiline.subject).not.toMatch(/[\r\n]/);
    expect(plainPersonName("Ana\n  Pérez")).toBe("Ana Pérez");
  });

  it("la nota del comprador va rotulada y recortada a 300", () => {
    const mail = newOrderSellerEmail(order({ notes: `Llamame ${"x".repeat(500)}` }), seller);
    const line = mail.text.split("\n").find((l) => l.startsWith("Nota escrita por el comprador: ")) ?? "";
    expect(line).not.toBe("");
    expect(line.length).toBeLessThanOrEqual("Nota escrita por el comprador: ".length + 300);
    expect(line.endsWith("…")).toBe(true);
  });

  it("arrepentimiento: motivo rotulado y recortado, nombre fuera del texto destacado", () => {
    const mail = withdrawalSellerEmail(
      {
        code: "ARR-1",
        name: "Soporte Ecommy: www.ecommy-login.com",
        contact: "x@example.com",
        orderNumber: null,
        orderFound: false,
        reason: "y".repeat(1000),
        createdAt: "2026-09-22T18:30:00Z",
        timezone: "America/Argentina/Buenos_Aires",
      },
      seller,
    );
    expect(mail.text).toContain("Alguien usó el botón de arrepentimiento de Taller Luna");
    expect(mail.text).toContain("Motivo escrito por quien pidió: ");
    expect(mail.text).not.toContain("y".repeat(301));
    expect(mail.html).toMatch(/Alguien pidió revocar una compra/);
  });
});

describe("logs sin datos personales", () => {
  it("maskEmails deja la inicial y el dominio", () => {
    expect(maskEmails("Invalid `to` field: lucia.fernandez@example.com")).toBe("Invalid `to` field: l***@example.com");
    expect(maskEmails("sin emails")).toBe("sin emails");
  });

  it("el rechazo de Resend loguea name y message, nunca el email completo ni el cuerpo crudo", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    setEmailTimingForTests({ gap: 0, retry: 0 });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ name: "validation_error", message: "Invalid to: lucia@example.com", extra: "secreto-interno" }), { status: 422 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await sendEmail({ to: "lucia@example.com", subject: "x", html: "x", text: "x" });
    const line = String(error.mock.calls[0][0]);
    expect(line).toContain("validation_error");
    expect(line).toContain("l***@example.com");
    expect(line).not.toContain("lucia@example.com");
    expect(line).not.toContain("secreto-interno");
    expect(result).toEqual({ ok: false, error: "Invalid to: l***@example.com" });
    error.mockRestore();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    setEmailTimingForTests(null);
  });
});

describe("aviso de prueba terminada (por fecha)", () => {
  const now = new Date("2026-09-23T12:00:00Z");
  const sub = (patch: Partial<{ trial_ends_at: string | null; status: string; plan_code: string }>) => ({
    store_id: "s1",
    trial_ends_at: "2026-09-22T12:00:00Z",
    status: "trialing",
    plan_code: "pro",
    ...patch,
  });

  it("vencida hace poco: aviso aunque el mantenimiento ya la haya pasado a Free", () => {
    expect(trialNoticeKind(sub({}), now)).toBe("trial_ended");
    expect(trialNoticeKind(sub({ status: "active", plan_code: "free" }), now)).toBe("trial_ended");
  });

  it("con plan pago, vencida hace más de 7 días o sin fecha: nada", () => {
    expect(trialNoticeKind(sub({ status: "active", plan_code: "pro" }), now)).toBeNull();
    expect(trialNoticeKind(sub({ trial_ends_at: "2026-09-15T12:00:00Z" }), now)).toBeNull();
    expect(trialNoticeKind(sub({ trial_ends_at: null }), now)).toBeNull();
  });

  it("por terminar: sólo en prueba y dentro de los 3 días", () => {
    expect(trialNoticeKind(sub({ trial_ends_at: "2026-09-25T12:00:00Z" }), now)).toBe("trial_ending");
    expect(trialNoticeKind(sub({ trial_ends_at: "2026-09-30T12:00:00Z" }), now)).toBeNull();
    expect(trialNoticeKind(sub({ trial_ends_at: "2026-09-25T12:00:00Z", status: "active" }), now)).toBeNull();
  });
});

describe("notifyOrderCreated y el cupo de create_order", () => {
  const fetchMock = vi.fn();
  const publicOrder = {
    id: "o1",
    number: 1043,
    token: "tok123",
    createdAt: "2026-09-22T18:30:00Z",
    status: "pending",
    paymentStatus: "pending",
    paymentMethodCode: "whatsapp",
    paymentDiscountPercent: 0,
    paymentDiscount: 0,
    fulfillment: "pickup",
    shippingZoneName: null,
    shippingCost: 0,
    shippingAddress: null,
    subtotal: 1000,
    promoTotal: 0,
    couponCode: null,
    couponDiscount: 0,
    discountTotal: 0,
    total: 1000,
    currency: "ARS",
    notes: null,
    customer: { name: "Lucía", email: "victima@example.com", phone: "", doc: "" },
    expiresAt: null,
    cancelReason: null,
    tracking: null,
    items: [],
    events: [],
    paymentMethod: { code: "whatsapp", name: "WhatsApp", type: "whatsapp", discountPercent: 0, instructionsMd: "" },
    pickupLocation: null,
    transfer: { enabled: false, bankName: "", holder: "", cbu: "", alias: "", cuit: "", instructionsMd: "" },
    whatsappTemplate: "",
    store: {
      id: "s1",
      slug: "taller-luna",
      name: "Taller Luna",
      whatsappPhone: "",
      contactEmail: "hola@tallerluna.com",
      currency: "ARS",
      locale: "es-AR",
      timezone: "America/Argentina/Buenos_Aires",
    },
  } satisfies PublicOrder;
  const settings = { logo_url: null, theme: { colors: { primary: "#8a3b12", primaryText: "#ffffff" } } } as unknown as StoreSettings;
  const target = { id: "s1", slug: "taller-luna" };

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: "em" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.mocked(getOrderByToken).mockResolvedValue(publicOrder);
    resetEmailWarnings();
    setEmailTimingForTests({ gap: 0, retry: 0 });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    setEmailTimingForTests(null);
  });

  const recipients = () => fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string).to[0] as string);

  it("notifyCustomer: false → sólo el aviso al vendedor", async () => {
    notifyOrderCreated({ store: target, settings, token: "tok123", notifyCustomer: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 10));
    expect(recipients()).toEqual(["hola@tallerluna.com"]);
  });

  it("sin el campo (migración 0014 sin aplicar) → comprador y vendedor, como antes", async () => {
    notifyOrderCreated({ store: target, settings, token: "tok123" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(recipients().sort()).toEqual(["hola@tallerluna.com", "victima@example.com"]);
  });
});
