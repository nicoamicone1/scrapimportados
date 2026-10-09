import { describe, expect, it } from "vitest";

import { storeTransferOfferEmail, storeTransferredEmail } from "@/lib/email/templates";

import {
  debitBlocksTransfer,
  parseTransferResult,
  transferError,
  transferPreview,
  trialAfterTransfer,
  type TransferPreviewInput,
  type TransferSubscription,
} from "./transfer";

const NOW = new Date("2026-10-08T12:00:00Z");
const IN_14 = "2026-10-22T12:00:00.000Z";

function sub(over: Partial<TransferSubscription> = {}): TransferSubscription {
  return {
    plan_code: "pro",
    status: "trialing",
    trial_ends_at: "2026-10-10T12:00:00Z",
    provider: "manual",
    provider_ref: null,
    provider_status: null,
    last_payment_at: null,
    ...over,
  };
}

describe("trialAfterTransfer (espejo de private.apply_store_transfer)", () => {
  it("tienda de muestra en prueba: 14 días de Pro desde hoy", () => {
    expect(trialAfterTransfer(sub(), { alreadyTransferred: false, now: NOW })).toBe(IN_14);
  });

  it("prueba vencida que ya pasó a Free: también arranca", () => {
    expect(trialAfterTransfer(sub({ plan_code: "free", status: "active" }), { alreadyTransferred: false, now: NOW })).toBe(IN_14);
  });

  it("nunca acorta una prueba vigente más larga", () => {
    const long = "2026-11-01T00:00:00.000Z";
    expect(trialAfterTransfer(sub({ trial_ends_at: long }), { alreadyTransferred: false, now: NOW })).toBe(long);
  });

  it("una sola vez por tienda: si ya cambió de titular, no", () => {
    expect(trialAfterTransfer(sub(), { alreadyTransferred: true, now: NOW })).toBeNull();
  });

  it("si alguna vez se pagó un plan o lo cobra Mercado Pago, no", () => {
    expect(trialAfterTransfer(sub({ last_payment_at: "2026-09-01T00:00:00Z" }), { alreadyTransferred: false, now: NOW })).toBeNull();
    expect(
      trialAfterTransfer(sub({ provider: "mercadopago", status: "active", plan_code: "starter" }), { alreadyTransferred: false, now: NOW }),
    ).toBeNull();
  });

  it("plan pago asignado a mano (no prueba ni Free): no se toca", () => {
    expect(trialAfterTransfer(sub({ plan_code: "business", status: "active" }), { alreadyTransferred: false, now: NOW })).toBeNull();
  });

  it("sin suscripción: no", () => {
    expect(trialAfterTransfer(null, { alreadyTransferred: false, now: NOW })).toBeNull();
  });
});

describe("debitBlocksTransfer", () => {
  it("bloquea con un débito de Mercado Pago que puede cobrar", () => {
    for (const provider_status of ["authorized", "authorized_unpaid", "paused"]) {
      expect(debitBlocksTransfer(sub({ provider: "mercadopago", provider_ref: "pre_1", provider_status }))).toBe(true);
    }
  });

  it("no bloquea si se canceló, si quedó a medias o si el plan es manual", () => {
    expect(debitBlocksTransfer(sub({ provider: "mercadopago", provider_ref: "pre_1", provider_status: "cancelled" }))).toBe(false);
    expect(debitBlocksTransfer(sub({ provider: "mercadopago", provider_ref: "pre_1", provider_status: "pending" }))).toBe(false);
    expect(debitBlocksTransfer(sub({ provider: "mercadopago", provider_ref: null, provider_status: "authorized" }))).toBe(false);
    expect(debitBlocksTransfer(sub())).toBe(false);
    expect(debitBlocksTransfer(null)).toBe(false);
  });
});

describe("parseTransferResult", () => {
  it("traspaso inmediato", () => {
    expect(parseTransferResult({ status: "transferred", id: "t1", user_id: "u2", trial_ends_at: IN_14 })).toEqual({
      status: "transferred",
      id: "t1",
      userId: "u2",
      trialEndsAt: IN_14,
    });
    expect(parseTransferResult({ status: "transferred", id: "t1", user_id: "u2", trial_ends_at: null })).toMatchObject({ trialEndsAt: null });
  });

  it("link pendiente", () => {
    expect(parseTransferResult({ status: "pending", id: "t1", token: "abc", expires_at: IN_14, has_account: true })).toEqual({
      status: "pending",
      id: "t1",
      token: "abc",
      expiresAt: IN_14,
      hasAccount: true,
    });
  });

  it("forma inesperada → null", () => {
    expect(parseTransferResult(null)).toBeNull();
    expect(parseTransferResult("pending")).toBeNull();
    expect(parseTransferResult({ status: "pending", id: "t1" })).toBeNull();
    expect(parseTransferResult({ status: "transferred", user_id: "u2" })).toBeNull();
    expect(parseTransferResult({ status: "otro", id: "t1" })).toBeNull();
  });
});

describe("transferError", () => {
  it("traduce las excepciones de la base", () => {
    expect(transferError("Esa cuenta ya tiene 3 tiendas a su nombre, el máximo por cuenta")).toMatch(/3 tiendas a su nombre/);
    expect(transferError("La tienda tiene un débito automático del plan con Mercado Pago. Cancelá…")).toMatch(/Cancelá la renovación en Plan/);
    expect(transferError("Sólo quien tiene la tienda a su nombre puede pasarla")).toBe("Sólo quien tiene la tienda a su nombre puede pasarla.");
    expect(transferError("La tienda cambió de dueño después de este link. Pedí uno nuevo")).toMatch(/cambió de dueño/);
    expect(transferError("El link es para ana@taller.com")).toBe("El link es para ana@taller.com.");
    expect(
      transferError("Esa persona tiene la tienda a su nombre. Para cambiarle el rol, primero pasale la tienda a otra persona"),
    ).toMatch(/primero tiene que pasar la tienda/);
  });

  it("lo desconocido → null (lo maneja quien llama)", () => {
    expect(transferError("duplicate key value")).toBeNull();
  });
});

describe("transferPreview (confirmación: verbo exacto y consecuencia)", () => {
  const base: TransferPreviewInput = {
    storeName: "Taller Luna",
    email: "ana@taller.com",
    isMember: false,
    keepPrevious: true,
    actorIsTitular: true,
    titularEmail: "nico@ecommy.app",
    trialEndsAt: IN_14,
    mpSalesConnected: false,
    others: [],
  };
  const fmt = (iso: string) => iso.slice(0, 10);

  it("fuera del equipo: crea un link y la tienda sigue a tu nombre hasta que acepte", () => {
    const p = transferPreview(base, fmt);
    expect(p.confirmLabel).toBe("Crear link para pasar la tienda");
    expect(p.consequences[0]).toMatch(/link .*vence en 7 días.*sigue a tu nombre/);
    expect(p.consequences.join(" ")).toMatch(/Cuando la reciba arrancan 14 días de prueba de Pro/);
  });

  it("del equipo: pasa ya, con la fecha de la prueba", () => {
    const p = transferPreview({ ...base, isMember: true }, fmt);
    expect(p.confirmLabel).toBe("Pasar la tienda");
    expect(p.consequences[0]).toMatch(/Pasa ya, sin link/);
    expect(p.consequences.join(" ")).toMatch(/Pro gratis hasta el 2026-10-22/);
  });

  it("qué pasa con quien la pasa", () => {
    expect(transferPreview(base, fmt).consequences[1]).toMatch(/^Vos seguís en el equipo como administrador/);
    expect(transferPreview({ ...base, keepPrevious: false }, fmt).consequences[1]).toMatch(/^Vos salís del equipo y dejás de ver/);
    expect(transferPreview({ ...base, actorIsTitular: false, keepPrevious: false }, fmt).consequences[1]).toMatch(
      /^nico@ecommy\.app sale del equipo y deja de ver/,
    );
  });

  it("avisa lo que no viaja solo: Mercado Pago, datos de cobro y el resto del equipo", () => {
    const text = transferPreview({ ...base, mpSalesConnected: true, others: ["lu@taller.com (Staff)"], trialEndsAt: null }, fmt).consequences.join(" ");
    expect(text).toMatch(/Se desconecta el cobro con tarjeta de Mercado Pago/);
    expect(text).toMatch(/CBU o alias/);
    expect(text).toMatch(/Siguen en el equipo: lu@taller\.com \(Staff\)/);
    expect(text).not.toMatch(/prueba de Pro/);
  });

  it("termina diciendo cómo se vuelve atrás", () => {
    const p = transferPreview(base, fmt);
    expect(p.consequences.at(-1)).toBe("Para volver atrás, ana@taller.com te la tiene que pasar de nuevo.");
  });
});

describe("mails del traspaso", () => {
  const common = { storeName: "Taller Luna", storeUrl: "https://taller-luna.ecommy.app", platformUrl: "https://www.ecommy.app", fromName: "Nico" };

  it("al nuevo dueño del equipo: a su nombre, con la prueba y qué revisar", () => {
    const mail = storeTransferredEmail({ ...common, ownerName: "Ana Paz", trialEndsAt: IN_14 });
    expect(mail.subject).toBe("Taller Luna ya está a tu nombre");
    expect(mail.text).toMatch(/Hola, Ana\./);
    expect(mail.text).toMatch(/Nico te pasó/);
    expect(mail.text).toMatch(/Pro gratis/);
    expect(mail.html).toContain("https://www.ecommy.app/admin/configuracion/pagos");
  });

  it("a quien no está en el equipo: el link para recibirla", () => {
    const mail = storeTransferOfferEmail({
      ...common,
      acceptUrl: "https://www.ecommy.app/invitacion/tienda/abc",
      expiresAt: "2026-10-15T12:00:00Z",
      trial: false,
    });
    expect(mail.subject).toBe("Nico te pasa Taller Luna");
    expect(mail.html).toContain("https://www.ecommy.app/invitacion/tienda/abc");
    expect(mail.text).not.toMatch(/Pro gratis/);
    expect(mail.text).toMatch(/sin aceptar el link no pasa nada/);
  });
});
