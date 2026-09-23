import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { brandColors, renderEmail, safeHref } from "./layout";
import { resetEmailWarnings, sendEmail, setEmailTimingForTests, storeFrom } from "./send";
import {
  customerCancelReason,
  newOrderSellerEmail,
  orderCancelledEmail,
  orderPaidEmail,
  orderReceivedEmail,
  orderShippedEmail,
  planRequestEmail,
  trialEndedEmail,
  trialEndingEmail,
  welcomeEmail,
  withdrawalSellerEmail,
  type OrderEmailData,
  type StoreEmailInfo,
} from "./templates";
import { plainInstructions } from "./templates/shared";
import { alreadyNotified, withNotice } from "./trial-notices";

const store: StoreEmailInfo = {
  name: 'Taller <b>Luna</b> & "Cía"',
  url: "https://taller-luna.ecommy.app",
  logoUrl: null,
  primary: "#8a3b12",
  primaryText: "#ffffff",
  contactEmail: "hola@tallerluna.com",
  whatsappUrl: "https://wa.me/5491155551234?text=Hola",
};

function order(patch: Partial<OrderEmailData> = {}): OrderEmailData {
  return {
    id: "0b6c5a3e-1111-4c2b-9a51-6f1b2c3d4e5f",
    number: 1043,
    createdAt: "2026-09-22T18:30:00Z",
    currency: "ARS",
    locale: "es-AR",
    timezone: "America/Argentina/Buenos_Aires",
    status: "pending",
    paymentStatus: "pending",
    customer: { name: "Lucía <script>alert(1)</script> Fernández", email: "lucia@example.com", phone: "11 5555 1234" },
    items: [
      { name: "Mesa de lapacho 120 cm", variantTitle: "Natural", qty: 1, unitPrice: 289000, total: 289000 },
      { name: "Banqueta", variantTitle: null, qty: 2, unitPrice: 45000, total: 90000 },
    ],
    subtotal: 379000,
    promoTotal: 0,
    couponCode: null,
    couponDiscount: 0,
    paymentDiscount: 37900,
    paymentDiscountPercent: 10,
    shippingCost: 12000,
    shippingZoneName: "CABA",
    total: 353100,
    fulfillment: "delivery",
    deliveryText: "Envío a Av. Santa Fe 3253 2B, Palermo, CABA",
    pickup: null,
    payment: { name: "Transferencia", type: "transfer", instructions: "" },
    transfer: {
      bankName: "Banco Nación",
      holder: "Taller Luna SRL",
      cbu: "0110599520000001234567",
      alias: "TALLER.LUNA.MP",
      cuit: "30-71234567-8",
      instructions: "Mandá el comprobante por WhatsApp.",
    },
    expiresAt: "2026-09-24T21:00:00Z",
    notes: "Tocar timbre 2B",
    tracking: null,
    cancelReason: null,
    statusUrl: "https://taller-luna.ecommy.app/pedido/0123456789abcdef0123456789abcdef",
    ...patch,
  };
}

const NBSP_MONEY = /\$\s?353\.100/;

describe("plantillas del comprador", () => {
  it("Recibimos tu pedido: asunto, datos de transferencia, reserva y link", () => {
    const mail = orderReceivedEmail(order(), store);
    expect(mail.subject).toBe("Recibimos tu pedido #1043");
    expect(mail.html).toContain("TALLER.LUNA.MP");
    expect(mail.html).toContain("0110599520000001234567");
    expect(mail.html).toContain(order().statusUrl);
    expect(mail.html).toMatch(NBSP_MONEY);
    expect(mail.html).toContain("Te reservamos el stock hasta el");
    expect(mail.html).toContain('width="600"');
    expect(mail.html).toContain("#8a3b12");
    // Texto completo: mismos datos que el HTML.
    expect(mail.text).toContain("Alias: TALLER.LUNA.MP");
    expect(mail.text).toContain("CBU / CVU: 0110599520000001234567");
    expect(mail.text).toContain(order().statusUrl);
    expect(mail.text).toContain("Recibís este mail porque hiciste un pedido en");
    expect(mail.text).not.toContain("<table");
  });

  it("escapa HTML en nombres de tienda, cliente y productos", () => {
    const mail = orderReceivedEmail(
      order({
        customer: { name: "<script>alert(1)</script> Pérez", email: "x@example.com", phone: "" },
        items: [{ name: "<img src=x onerror=alert(1)>", variantTitle: null, qty: 1, unitPrice: 1, total: 1 }],
      }),
      store,
    );
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).not.toContain("<b>Luna</b>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("Taller &lt;b&gt;Luna&lt;/b&gt; &amp; &quot;Cía&quot;");
  });

  it("WhatsApp: botón para coordinar, sin datos bancarios", () => {
    const mail = orderReceivedEmail(order({ payment: { name: "WhatsApp", type: "whatsapp", instructions: "" }, transfer: null, expiresAt: null }), store);
    expect(mail.html).toContain("Abrir WhatsApp");
    expect(mail.html).not.toContain("CBU");
  });

  it("Pago confirmado", () => {
    const mail = orderPaidEmail(order({ paymentStatus: "paid" }), store);
    expect(mail.subject).toBe("Confirmamos el pago de tu pedido #1043");
    expect(mail.text).toContain("te avisamos por mail cuando lo despachemos");
    expect(mail.html).not.toContain("Transferí");
  });

  it("Enviado con seguimiento y listo para retirar", () => {
    const shipped = orderShippedEmail(
      order({ status: "shipped", tracking: { carrier: "Andreani", number: "AND123", url: "https://seguimiento.andreani.com/AND123" } }),
      store,
    );
    expect(shipped.subject).toBe("Despachamos tu pedido #1043");
    expect(shipped.html).toContain("AND123");
    expect(shipped.html).toContain("https://seguimiento.andreani.com/AND123");
    expect(shipped.text).toContain("Seguir el envío: https://seguimiento.andreani.com/AND123");

    const update = orderShippedEmail(order({ status: "shipped", tracking: { carrier: "", number: "X9", url: "" } }), store, { trackingUpdate: true });
    expect(update.subject).toBe("Número de seguimiento de tu pedido #1043");

    const pickup = orderShippedEmail(
      order({ status: "shipped", fulfillment: "pickup", pickup: { name: "Local Palermo", address: "Gorriti 4800", hoursText: "Lun a vie 10 a 19" } }),
      store,
    );
    expect(pickup.subject).toBe("Tu pedido #1043 está listo para retirar");
    expect(pickup.text).toContain("Gorriti 4800");
  });

  it("Cancelado: motivo genérico, nunca el texto libre del vendedor", () => {
    const secret = orderCancelledEmail(order({ status: "cancelled", cancelReason: "cliente moroso, no venderle más" }), store);
    expect(secret.html).not.toContain("moroso");
    expect(secret.text).not.toContain("moroso");
    const expired = orderCancelledEmail(order({ status: "cancelled", cancelReason: "expired" }), store);
    expect(expired.text).toContain("porque venció el plazo para registrar el pago");
    expect(customerCancelReason("Sin stock")).toBe("porque nos quedamos sin stock de un producto");
    expect(customerCancelReason("otra cosa")).toBeNull();
  });
});

const seller = { name: "Taller Luna", contactEmail: "hola@tallerluna.com", platformUrl: "https://www.ecommy.app" };

describe("datos faltantes: la plantilla degrada", () => {
  it("sin datos bancarios, sin reserva, sin nombre ni dirección: nada de undefined/null/NaN", () => {
    const o = order({
      customer: { name: "", email: "lucia@example.com", phone: "" },
      transfer: { bankName: "", holder: "", cbu: "", alias: "", cuit: "", instructions: "" },
      expiresAt: null,
      notes: null,
      deliveryText: "Envío a domicilio",
      items: [],
    });
    for (const content of [orderReceivedEmail(o, { ...store, whatsappUrl: null, contactEmail: null, logoUrl: null }), newOrderSellerEmail(o, seller)]) {
      for (const part of [content.subject, content.html, content.text]) {
        expect(part).not.toMatch(/undefined|null|NaN|\[object Object\]/);
      }
    }
    const received = orderReceivedEmail(o, store);
    expect(received.text).toContain("Te pasamos los datos bancarios");
    expect(received.text).not.toContain("Te reservamos el stock");
    expect(received.text).toContain("Hola.");
  });

  it("reserva con fecha inválida o zona horaria rota: se omite o cae en Buenos Aires", () => {
    expect(orderReceivedEmail(order({ expiresAt: "no-es-fecha" }), store).text).not.toContain("Te reservamos el stock");
    expect(orderReceivedEmail(order({ timezone: "Marte/Olympus" }), store).text).toContain("Te reservamos el stock hasta el");
  });

  it("método de pago borrado pero con datos de transferencia: igual muestra cómo transferir", () => {
    const { text } = orderReceivedEmail(order({ payment: null }), store);
    expect(text).toContain("TALLER.LUNA.MP");
  });

  it("retiro sin dirección ni horarios: sólo el lugar", () => {
    const { html, text } = orderShippedEmail(
      order({ fulfillment: "pickup", pickup: { name: "Local Palermo", address: "", hoursText: "" }, status: "shipped" }),
      store,
    );
    expect(text).toContain("Local Palermo");
    expect(text).not.toContain("Dirección:");
    expect(html).not.toContain(">Horarios<");
  });

  it("escapa también el preheader, el title y los links armados con datos del usuario", () => {
    const evil = '"><img src=x onerror=alert(1)>';
    const { html } = orderReceivedEmail(order({ items: [{ name: evil, variantTitle: evil, qty: 1, unitPrice: 1, total: 1 }], notes: evil }), {
      ...store,
      name: evil,
    });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toMatch(/onerror=alert\(1\)>/);
  });
});

describe("HTML bien formado", () => {
  it("ningún atributo style se corta (p. ej. por comillas dobles en la fuente)", () => {
    const mails = [
      orderReceivedEmail(order(), store),
      orderShippedEmail(order({ status: "shipped", tracking: { carrier: "Andreani", number: "AN1", url: "https://andreani.com/x" } }), store),
      newOrderSellerEmail(order(), seller),
      welcomeEmail({ storeName: "Taller Luna", storeUrl: "https://taller-luna.ecommy.app", platformUrl: "https://www.ecommy.app" }),
    ];
    for (const { html } of mails) {
      const styles = [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
      expect(styles.length).toBeGreaterThan(10);
      for (const style of styles) expect(style.trim().endsWith(";")).toBe(true);
      expect(html).not.toMatch(/gradient|box-shadow/i);
    }
  });
});

describe("vista previa (EMAIL_PREVIEW_DIR)", () => {
  it.runIf(Boolean(process.env.EMAIL_PREVIEW_DIR))("guarda el HTML de Recibimos tu pedido", async () => {
    const { writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = process.env.EMAIL_PREVIEW_DIR as string;
    const sample = order({ customer: { name: "Lucía Fernández", email: "lucia@example.com", phone: "11 5555 1234" } });
    const sampleStore = { ...store, name: "Taller Luna" };
    writeFileSync(join(dir, "email-preview.html"), orderReceivedEmail(sample, sampleStore).html);
    writeFileSync(join(dir, "email-preview.txt"), orderReceivedEmail(sample, sampleStore).text);
  });
});

describe("plantillas del vendedor y la plataforma", () => {
  it("Nuevo pedido con link al admin, cliente y método", () => {
    const mail = newOrderSellerEmail(order(), { name: "Taller Luna", contactEmail: "hola@tallerluna.com", platformUrl: "https://www.ecommy.app" });
    expect(mail.subject).toMatch(/^Nuevo pedido #1043 · \$\s?353\.100 · Lucía/);
    expect(mail.html).toContain("https://www.ecommy.app/admin/pedidos/0b6c5a3e-1111-4c2b-9a51-6f1b2c3d4e5f");
    expect(mail.text).toContain("Pago: Transferencia");
    expect(mail.text).toContain("Nota del cliente: Tocar timbre 2B");
    expect(mail.text).toContain("es el email de contacto de Taller Luna");
  });

  it("Solicitud de arrepentimiento", () => {
    const mail = withdrawalSellerEmail(
      { code: "ARR-7K2Q", name: "Juan <Pérez>", contact: "juan@example.com", orderNumber: "1043", orderFound: true, reason: null, createdAt: "2026-09-22T18:30:00Z", timezone: "America/Argentina/Buenos_Aires" },
      { name: "Taller Luna", contactEmail: "hola@tallerluna.com", platformUrl: "https://www.ecommy.app" },
    );
    expect(mail.subject).toBe("Solicitud de arrepentimiento ARR-7K2Q · Taller Luna");
    expect(mail.html).toContain("Juan &lt;Pérez&gt;");
    expect(mail.text).toContain("https://www.ecommy.app/admin/pedidos/arrepentimientos");
  });

  it("Pedido de cambio de plan", () => {
    const mail = planRequestEmail({
      storeId: "s1",
      storeName: "Taller Luna",
      storeUrl: "https://taller-luna.ecommy.app",
      currentPlan: "Pro",
      currentTrial: true,
      requestedPlan: "Starter",
      requestedBy: "duenia@example.com",
      requestedAt: "2026-09-22T18:30:00Z",
      platformUrl: "https://www.ecommy.app",
    });
    expect(mail.subject).toBe("Pedido de plan: Taller Luna → Starter");
    expect(mail.text).toContain("Plan actual: Pro (prueba)");
    expect(mail.text).toContain("https://www.ecommy.app/platform/tiendas/s1");
  });
});

describe("plantillas de cuenta", () => {
  const base = { storeName: "Taller Luna", storeUrl: "https://taller-luna.ecommy.app", platformUrl: "https://www.ecommy.app", ownerName: "Ana Gómez" };

  it("Bienvenida con pasos, panel y tienda", () => {
    const mail = welcomeEmail({ ...base, trialEndsAt: "2026-10-07T12:00:00Z" });
    expect(mail.subject).toBe("Taller Luna ya está creada");
    expect(mail.html).toContain("https://www.ecommy.app/admin");
    expect(mail.html).toContain("https://taller-luna.ecommy.app");
    expect(mail.text).toContain("Hola, Ana.");
    expect(mail.text).toContain("07/10/2026");
    expect(mail.text).toMatch(/1\. Cargá tus productos/);
    expect(mail.text).toContain("Recibís este mail porque tenés una cuenta en Ecommy.");
  });

  it("Prueba por vencer y vencida", () => {
    expect(trialEndingEmail({ ...base, trialEndsAt: "2026-09-26T12:00:00Z", daysLeft: 3 }).subject).toBe("Tu prueba de Pro termina en 3 días");
    expect(trialEndingEmail({ ...base, trialEndsAt: "2026-09-24T12:00:00Z", daysLeft: 1 }).subject).toBe("Tu prueba de Pro termina mañana");
    const ended = trialEndedEmail({ ...base, endedAt: "2026-09-23T12:00:00Z" });
    expect(ended.subject).toBe("Tu prueba terminó: Taller Luna pasó a Free");
    expect(ended.text).toContain("Hasta 50 productos");
    expect(ended.html).toContain("https://www.ecommy.app/admin/plan");
  });
});

describe("layout", () => {
  it("acento: sólo hex válido; si no, tinta neutra", () => {
    expect(brandColors("#123abc", "#fff").accent).toBe("#123abc");
    expect(brandColors("red;background:url(x)", null).accent).toBe("#1c1917");
  });

  it("links: sólo http(s)/mailto/tel; logo sólo https", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    const withLogo = renderEmail({
      subject: "x",
      preheader: "",
      brand: { name: "T", url: null, logoUrl: "http://inseguro.com/logo.png", accent: "#000000", accentText: "#ffffff" },
      blocks: [{ t: "button", href: "javascript:alert(1)", label: "Mal" }],
      footer: [],
    });
    expect(withLogo.html).not.toContain("<img");
    expect(withLogo.html).not.toContain("javascript:");
  });

  it("instrucciones en markdown → texto", () => {
    expect(plainInstructions("**Importante**: mandá el [comprobante](https://wa.me/1)")).toBe("Importante: mandá el comprobante (https://wa.me/1)");
  });
});

describe("sendEmail", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    resetEmailWarnings();
    setEmailTimingForTests({ gap: 0, retry: 0 });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    setEmailTimingForTests(null);
  });

  const msg = { to: "lucia@example.com", subject: "Hola", html: "<p>Hola</p>", text: "Hola" };

  it("sin RESEND_API_KEY no llama a fetch y avisa una sola vez", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await sendEmail(msg)).toEqual({ skipped: true });
    expect(await sendEmail(msg)).toEqual({ skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    info.mockRestore();
  });

  it("con API key manda a Resend con from, reply_to, tags e idempotencia", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "em_1" }), { status: 200 }));
    const result = await sendEmail({
      ...msg,
      from: storeFrom("Taller Luna"),
      replyTo: "hola@tallerluna.com",
      tags: [{ name: "kind", value: "order received" }],
      idempotencyKey: "order-received/1",
    });
    expect(result).toEqual({ ok: true, id: "em_1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    expect(init.headers["Idempotency-Key"]).toBe("order-received/1");
    const body = JSON.parse(init.body);
    expect(body.from).toBe('"Taller Luna vía Ecommy" <no-reply@ecommy.app>');
    expect(body.reply_to).toEqual(["hola@tallerluna.com"]);
    expect(body.tags).toEqual([{ name: "kind", value: "order_received" }]);
  });

  it("nunca lanza: error de red o rechazo → ok:false", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    expect(await sendEmail(msg)).toEqual({ ok: false, error: "ECONNRESET" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Domain not verified" }), { status: 403 }));
    expect(await sendEmail(msg)).toEqual({ ok: false, error: "Domain not verified" });
    error.mockRestore();
  });

  it("429: reintenta; 5xx y red sólo con idempotency key", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "rate_limit_exceeded" }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "em_2" }), { status: 200 }));
    expect(await sendEmail(msg)).toEqual({ ok: true, id: "em_2" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("upstream error", { status: 502 }));
    expect(await sendEmail(msg)).toEqual({ ok: false, error: "HTTP 502" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset();
    fetchMock
      .mockRejectedValueOnce(new Error("The operation was aborted due to timeout"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "em_3" }), { status: 200 }));
    expect(await sendEmail({ ...msg, idempotencyKey: "k/1" })).toEqual({ ok: true, id: "em_3" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it("clave de idempotencia ya usada: se da por enviado, sin error", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ name: "invalid_idempotent_request", message: "already used" }), { status: 409 }),
    );
    expect(await sendEmail({ ...msg, idempotencyKey: "order-paid/1" })).toEqual({ ok: true, id: null });
    info.mockRestore();
  });

  it("el log de un rechazo trae status y cuerpo recortado, nunca la API key", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_supersecreta");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ name: "validation_error", message: "x".repeat(1000) }), { status: 422 }));
    await sendEmail({ ...msg, tags: [{ name: "kind", value: "order_received" }] });
    const line = String(error.mock.calls[0][0]);
    expect(line).toContain("HTTP 422");
    expect(line).toContain("order_received");
    expect(line).not.toContain("re_supersecreta");
    expect(line.length).toBeLessThan(420);
    error.mockRestore();
  });

  it("espacia los envíos para no chocar el límite de Resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    setEmailTimingForTests({ gap: 40, retry: 0 });
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: "em" }), { status: 200 }));
    const start = Date.now();
    await Promise.all([sendEmail(msg), sendEmail(msg), sendEmail(msg)]);
    expect(Date.now() - start).toBeGreaterThanOrEqual(75);
  });

  it("sin destinatario válido no llama a fetch", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    expect(await sendEmail({ ...msg, to: "no-es-un-mail" })).toEqual({ ok: false, error: "Sin destinatario válido" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("storeFrom limpia el nombre visible", () => {
    vi.stubEnv("EMAIL_FROM", "Ecommy <avisos@mail.ecommy.app>");
    expect(storeFrom('Tienda "Pepe" <x@y>\r\nBcc: z')).toBe('"Tienda Pepe x@y Bcc: z vía Ecommy" <avisos@mail.ecommy.app>');
  });
});

describe("idempotencia de avisos de prueba", () => {
  it("marca por fecha de fin y conserva el resto del onboarding", () => {
    const ends = "2026-09-26T12:00:00+00:00";
    const onboarding = withNotice({ kind: "ropa", appearance: true }, "trial_ending", ends);
    expect(onboarding).toMatchObject({ kind: "ropa", appearance: true, notices: { trial_ending: ends } });
    expect(alreadyNotified(onboarding, "trial_ending", "2026-09-26T12:00:00Z")).toBe(true);
    expect(alreadyNotified(onboarding, "trial_ended", ends)).toBe(false);
    // Prueba extendida: nueva fecha → se vuelve a avisar.
    expect(alreadyNotified(onboarding, "trial_ending", "2026-10-03T12:00:00Z")).toBe(false);
  });
});
