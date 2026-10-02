import { describe, expect, it } from "vitest";

import { quickActionFor } from "./quick-action";

const base = { status: "pending", paymentStatus: "pending", fulfillment: "delivery", paymentMethodCode: "transfer" };

describe("quickActionFor", () => {
  it("pendiente sin pagar por transferencia: confirmar pago", () => {
    expect(quickActionFor(base)).toEqual({ kind: "confirm_payment", label: "Confirmar pago" });
  });

  it("pendiente en otro método: confirmar el pedido", () => {
    expect(quickActionFor({ ...base, paymentMethodCode: "cash" })).toMatchObject({ kind: "status", to: "confirmed", label: "Confirmar" });
  });

  it("pendiente y pagado: confirmar el pedido", () => {
    expect(quickActionFor({ ...base, paymentStatus: "paid" })).toMatchObject({ kind: "status", to: "confirmed" });
  });

  it("sigue el flujo y pide seguimiento sólo al despachar un envío", () => {
    expect(quickActionFor({ ...base, status: "confirmed" })).toMatchObject({ to: "preparing", needsTracking: false });
    expect(quickActionFor({ ...base, status: "preparing" })).toMatchObject({ to: "shipped", needsTracking: true, label: "Marcar enviado" });
    expect(quickActionFor({ ...base, status: "preparing", fulfillment: "pickup" })).toMatchObject({
      to: "shipped",
      needsTracking: false,
      label: "Listo para retirar",
    });
    expect(quickActionFor({ ...base, status: "shipped" })).toMatchObject({ to: "delivered", label: "Marcar entregado" });
  });

  it("sin acción para entregados y cancelados", () => {
    expect(quickActionFor({ ...base, status: "delivered" })).toBeNull();
    expect(quickActionFor({ ...base, status: "cancelled" })).toBeNull();
  });
});
