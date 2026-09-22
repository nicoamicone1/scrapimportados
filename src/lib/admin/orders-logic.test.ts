import { describe, expect, it } from "vitest";

import {
  addZonedDays,
  compare,
  fillSeries,
  niceMax,
  parsePeriod,
  resolvePeriod,
  startOfZonedDay,
  sumSeries,
  ymdToZonedStart,
  zonedYmd,
} from "./dashboard-utils";
import {
  amountPaid,
  balanceDue,
  canTransition,
  computeManualTotals,
  expiryInfo,
  extendedExpiry,
  nextStatus,
  orderStatusLabel,
  otherDiscount,
  parseOrderNumber,
  sanitizeSearch,
  stockToRededuct,
  stockToRestore,
} from "./order-utils";
import { buildWhatsAppMessage, toWhatsAppNumber, waLink, whatsAppTemplateFor } from "./whatsapp";

const TZ = "America/Argentina/Buenos_Aires";

describe("estados de pedido", () => {
  it("transiciones: cancelado sólo se reabre", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("shipped", "preparing")).toBe(true);
    expect(canTransition("pending", "pending")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
    expect(canTransition("cancelled", "pending")).toBe(true);
  });
  it("siguiente paso del flujo", () => {
    expect(nextStatus("pending")).toBe("confirmed");
    expect(nextStatus("preparing")).toBe("shipped");
    expect(nextStatus("delivered")).toBeNull();
    expect(nextStatus("cancelled")).toBeNull();
  });
  it("etiquetas de retiro", () => {
    expect(orderStatusLabel("shipped", "pickup")).toBe("Listo para retirar");
    expect(orderStatusLabel("shipped", "delivery")).toBe("Enviado");
    expect(orderStatusLabel("delivered", "pickup")).toBe("Retirado");
  });
});

describe("pagos y totales", () => {
  it("saldo pendiente", () => {
    const paid = amountPaid([{ amount: 1000.1 }, { amount: "500.2" }]);
    expect(paid).toBe(1500.3);
    expect(balanceDue(2000, paid)).toBe(499.7);
    expect(balanceDue(1000, paid)).toBe(0);
  });
  it("descuento manual derivado de discount_total", () => {
    expect(
      otherDiscount({
        subtotal: 1000,
        promo_total: 100,
        coupon_discount: 0,
        payment_discount: 90,
        discount_total: 240,
        shipping_cost: 0,
        total: 760,
      }),
    ).toBe(50);
  });
  it("totales del pedido manual", () => {
    const t = computeManualTotals({
      lines: [
        { listPrice: 1000, unitPrice: 900, qty: 2 },
        { listPrice: 500, unitPrice: 600, qty: 1 },
      ],
      shippingCost: 300,
      manualDiscount: 100,
      paymentDiscountPercent: 10,
    });
    // subtotal = 1000*2 + 600 (sube el de lista) = 2600; promo = 200
    expect(t.subtotal).toBe(2600);
    expect(t.promoTotal).toBe(200);
    // base 2400 - manual 100 = 2300 → 10 % = 230
    expect(t.paymentDiscount).toBe(230);
    expect(t.discountTotal).toBe(530);
    expect(t.total).toBe(2600 - 530 + 300);
  });
  it("el descuento manual no supera la base", () => {
    const t = computeManualTotals({
      lines: [{ listPrice: 100, unitPrice: 100, qty: 1 }],
      shippingCost: 0,
      manualDiscount: 500,
      paymentDiscountPercent: 0,
    });
    expect(t.manualDiscount).toBe(100);
    expect(t.total).toBe(0);
  });
});

describe("reserva", () => {
  const now = new Date("2026-09-22T12:00:00Z");
  it("etiquetas de vencimiento", () => {
    expect(expiryInfo("2026-09-22T17:30:00Z", now)?.label).toBe("Vence en 5 h");
    expect(expiryInfo("2026-09-22T12:40:00Z", now)?.label).toBe("Vence en 40 min");
    expect(expiryInfo("2026-09-25T12:00:00Z", now)?.label).toBe("Vence en 3 d");
    expect(expiryInfo("2026-09-22T11:00:00Z", now)?.expired).toBe(true);
    expect(expiryInfo(null, now)).toBeNull();
  });
  it("extender suma desde el vencimiento o desde ahora", () => {
    expect(extendedExpiry("2026-09-22T20:00:00Z", 24, now).toISOString()).toBe("2026-09-23T20:00:00.000Z");
    expect(extendedExpiry("2026-09-20T20:00:00Z", 24, now).toISOString()).toBe("2026-09-23T12:00:00.000Z");
  });
});

describe("stock al cancelar y reabrir", () => {
  it("devuelve sólo lo descontado neto", () => {
    const r = stockToRestore([
      { variant_id: "a", delta: -2, reason: "sale" },
      { variant_id: "b", delta: -1, reason: "sale" },
      { variant_id: "b", delta: 1, reason: "cancel" },
    ]);
    expect([...r]).toEqual([["a", 2]]);
    expect(stockToRestore([]).size).toBe(0);
  });
  it("reabrir vuelve a descontar lo devuelto", () => {
    const items = [
      { variant_id: "a", qty: 2 },
      { variant_id: "b", qty: 1 },
      { variant_id: null, qty: 1 },
    ];
    const moves = [
      { variant_id: "a", delta: -2, reason: "sale" },
      { variant_id: "a", delta: 2, reason: "cancel" },
    ];
    expect([...stockToRededuct(items, moves)]).toEqual([["a", 2]]);
    // Sin ventas registradas (no descontó al crear) no toca stock.
    expect(stockToRededuct(items, []).size).toBe(0);
  });
});

describe("búsqueda", () => {
  it("limpia caracteres de PostgREST y detecta números", () => {
    expect(sanitizeSearch(" juan, (perez)* ")).toBe("juan perez");
    expect(parseOrderNumber("#1043")).toBe(1043);
    expect(parseOrderNumber("1043")).toBe(1043);
    expect(parseOrderNumber("juan")).toBeNull();
  });
});

describe("whatsapp", () => {
  it("normaliza teléfonos argentinos", () => {
    expect(toWhatsAppNumber("11 5555-1234")).toBe("5491155551234");
    expect(toWhatsAppNumber("011 15 5555 1234")).toBe("5491155551234");
    expect(toWhatsAppNumber("+54 9 381 617-3548")).toBe("5493816173548");
    expect(toWhatsAppNumber("+54 381 617 3548")).toBe("5493816173548");
    expect(toWhatsAppNumber("5493816173548")).toBe("5493816173548");
    expect(toWhatsAppNumber("+598 99 123 456")).toBe("59899123456");
    expect(toWhatsAppNumber("1234")).toBeNull();
    expect(toWhatsAppNumber("")).toBeNull();
  });
  it("elige la plantilla según el estado", () => {
    expect(whatsAppTemplateFor({ status: "pending", payment_status: "pending", fulfillment: "delivery" })).toBe(
      "payment_pending",
    );
    expect(whatsAppTemplateFor({ status: "shipped", payment_status: "paid", fulfillment: "delivery" })).toBe("shipped");
    expect(whatsAppTemplateFor({ status: "shipped", payment_status: "paid", fulfillment: "pickup" })).toBe(
      "pickup_ready",
    );
    expect(whatsAppTemplateFor({ status: "preparing", payment_status: "paid", fulfillment: "pickup" })).toBe("confirmed");
    expect(whatsAppTemplateFor({ status: "cancelled", payment_status: "pending", fulfillment: "pickup" })).toBe(
      "cancelled",
    );
  });
  it("arma mensajes con datos concretos", () => {
    const pay = buildWhatsAppMessage("payment_pending", {
      storeName: "Tienda Sur",
      customerName: "Ana María López",
      number: 1043,
      total: "$ 90.000",
      paymentMethodCode: "transfer",
      transfer: { alias: "tienda.sur.mp", cbu: "" },
      orderUrl: "https://t.com/pedido/abc",
    });
    expect(pay).toContain("Hola Ana, te escribimos de Tienda Sur.");
    expect(pay).toContain("$ 90.000");
    expect(pay).toContain("Alias: tienda.sur.mp");
    expect(pay).not.toContain("CBU:");
    expect(pay).toContain("https://t.com/pedido/abc");

    const ship = buildWhatsAppMessage("shipped", {
      storeName: "Tienda Sur",
      number: 1044,
      total: "$ 1",
      tracking: { carrier: "Andreani", number: "AND123", url: null },
    });
    expect(ship).toContain("con Andreani");
    expect(ship).toContain("Número de seguimiento: AND123");
    expect(ship.startsWith("Hola, te escribimos")).toBe(true);
  });
  it("link wa.me codificado", () => {
    expect(waLink("11 5555 1234", "Hola #1")).toBe("https://wa.me/5491155551234?text=Hola%20%231");
    expect(waLink(null, "x")).toBeNull();
  });
});

describe("dashboard: períodos", () => {
  // 22/09/2026 15:30 en Buenos Aires (UTC−3)
  const now = new Date("2026-09-22T18:30:00Z");

  it("inicio del día en la zona de la tienda", () => {
    expect(startOfZonedDay(now, TZ).toISOString()).toBe("2026-09-22T03:00:00.000Z");
    // 01:00 UTC del 23 = 22:00 del 22 en Buenos Aires
    expect(zonedYmd(new Date("2026-09-23T01:00:00Z"), TZ)).toBe("2026-09-22");
    expect(ymdToZonedStart("2026-09-01", TZ)?.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(ymdToZonedStart("no", TZ)).toBeNull();
    expect(addZonedDays(startOfZonedDay(now, TZ), -1, TZ).toISOString()).toBe("2026-09-21T03:00:00.000Z");
  });

  it("hoy vs. ayer a la misma hora", () => {
    const p = resolvePeriod("hoy", now, TZ);
    expect(p.from.toISOString()).toBe("2026-09-22T03:00:00.000Z");
    expect(p.prevFrom.toISOString()).toBe("2026-09-21T03:00:00.000Z");
    expect(p.prevTo.toISOString()).toBe("2026-09-21T18:30:00.000Z");
    expect(p.bucket).toBe("hour");
    expect(p.buckets).toHaveLength(24);
    expect(p.buckets.find((b) => b.current)?.key).toBe("15");
  });

  it("7 y 30 días incluyen hoy", () => {
    const p7 = resolvePeriod("7d", now, TZ);
    expect(p7.from.toISOString()).toBe("2026-09-16T03:00:00.000Z");
    expect(p7.prevFrom.toISOString()).toBe("2026-09-09T03:00:00.000Z");
    expect(p7.buckets.map((b) => b.key)[0]).toBe("2026-09-16");
    expect(p7.buckets.at(-1)?.key).toBe("2026-09-22");
    expect(p7.buckets.at(-1)?.current).toBe(true);
    expect(p7.buckets[0].label).toBe("mié 16");
    const p30 = resolvePeriod("30d", now, TZ);
    expect(p30.buckets).toHaveLength(30);
    expect(p30.buckets[0].key).toBe("2026-08-24");
    expect(parsePeriod("x")).toBe("7d");
  });

  it("completa la serie con ceros y suma", () => {
    const p = resolvePeriod("7d", now, TZ);
    const s = fillSeries(p.buckets, [{ bucket: "2026-09-22T00:00:00", orders: 2, sales: 1500 }], "day");
    expect(s.at(-1)?.sales).toBe(1500);
    expect(s[0].sales).toBe(0);
    expect(sumSeries(s)).toEqual({ orders: 2, sales: 1500 });
    const h = fillSeries(resolvePeriod("hoy", now, TZ).buckets, [{ bucket: "2026-09-22 09:00:00", orders: 1, sales: 10 }], "hour");
    expect(h[9].orders).toBe(1);
  });

  it("comparación con el período anterior", () => {
    expect(compare(112, 100, "ayer").text).toBe("+12 % vs. ayer");
    expect(compare(92, 100, "ayer").text).toBe("−8 % vs. ayer");
    expect(compare(100, 100, "ayer").text).toBe("Igual que ayer");
    expect(compare(5, 0, "ayer").text).toBe("Nada para comparar con ayer");
    expect(compare(0, 0, "ayer").direction).toBe("flat");
  });

  it("máximo redondo del eje", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(87)).toBe(100);
    expect(niceMax(1234)).toBe(1500);
    expect(niceMax(41000)).toBe(50000);
  });
});
