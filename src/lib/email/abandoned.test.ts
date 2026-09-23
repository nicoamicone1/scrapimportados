import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/** Cliente service_role falso: registra las RPC que se llaman. */
const serviceRpc = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("@/lib/supabase/env", () => ({ SUPABASE_URL: "https://proyecto.supabase.co", SUPABASE_ANON_KEY: "anon" }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: async (name: string) => {
      serviceRpc.calls.push(name);
      return { data: name === "purge_checkout_sessions" ? 3 : [], error: null };
    },
  }),
}));

import { formatMoney } from "@/lib/money";

import {
  abandonedUnsubscribeHeaders,
  deliverAbandonedNotices,
  runAbandonedNotices,
  isAbandonedDue,
  MAX_ABANDONED_PER_RUN,
  MAX_ABANDONED_PER_STORE,
  MAX_ABANDONED_PER_TRIAL_STORE,
  parseAbandonedCandidates,
  pickAbandonedNotices,
  refreshAbandonedItems,
  type AbandonedNoticePlan,
  type AbandonedSessionRow,
  type MailVariant,
} from "./abandoned-notices";
import { resetEmailWarnings, setEmailTimingForTests } from "./send";
import { abandonedCartEmail, abandonedTotal } from "./templates/abandoned";
import type { StoreEmailInfo } from "./templates/types";

const NOW = new Date("2026-09-23T09:00:00Z");
const HOUR = 3_600_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const TOKEN = "a".repeat(48);
const $ = (v: number) => formatMoney(v, { currency: "ARS", locale: "es-AR" });

function session(patch: Partial<AbandonedSessionRow> = {}): AbandonedSessionRow {
  return {
    id: "s-1",
    storeId: "store-1",
    token: TOKEN,
    email: "lucia@example.com",
    name: "Lucía Fernández",
    items: [{ variantId: "v-1", qty: 2, name: "Remera básica · Negro / M", price: 15500 }],
    consent: true,
    createdAt: ago(6 * HOUR),
    updatedAt: ago(5 * HOUR),
    recoveredOrderId: null,
    remindedAt: null,
    unsubscribedAt: null,
    storeActive: true,
    storeTrialing: false,
    enabled: true,
    recentlyReminded: false,
    ...patch,
  };
}

const STORE: StoreEmailInfo = {
  name: "Taller Luna",
  url: "https://taller-luna.ecommy.app",
  logoUrl: null,
  primary: "#2e4a3f",
  primaryText: "#ffffff",
  contactEmail: "hola@tallerluna.com",
  whatsappUrl: "https://wa.me/5491155551234",
};

describe("selección de avisos de carrito abandonado", () => {
  it("sale entre 3 y 48 h sin tocar el carrito", () => {
    expect(isAbandonedDue(session({ updatedAt: ago(3 * HOUR) }), NOW)).toBe(true);
    expect(isAbandonedDue(session({ updatedAt: ago(48 * HOUR) }), NOW)).toBe(true);
    expect(isAbandonedDue(session({ updatedAt: ago(3 * HOUR - 60_000) }), NOW)).toBe(false);
    expect(isAbandonedDue(session({ updatedAt: ago(48 * HOUR + 60_000) }), NOW)).toBe(false);
  });

  it("sin consentimiento, recuperado, ya avisado o dado de baja: nada", () => {
    expect(isAbandonedDue(session({ consent: false }), NOW)).toBe(false);
    expect(isAbandonedDue(session({ recoveredOrderId: "o-1" }), NOW)).toBe(false);
    expect(isAbandonedDue(session({ remindedAt: ago(HOUR) }), NOW)).toBe(false);
    expect(isAbandonedDue(session({ unsubscribedAt: ago(HOUR) }), NOW)).toBe(false);
  });

  it("tienda inactiva, función apagada, aviso reciente al mismo email, sin ítems o email inválido: nada", () => {
    expect(isAbandonedDue(session({ storeActive: false }), NOW)).toBe(false);
    expect(isAbandonedDue(session({ enabled: false }), NOW)).toBe(false);
    expect(isAbandonedDue(session({ recentlyReminded: true }), NOW)).toBe(false);
    expect(isAbandonedDue(session({ items: [] }), NOW)).toBe(false);
    expect(isAbandonedDue(session({ email: "no-es-un-email" }), NOW)).toBe(false);
  });

  it("un mail por sesión y uno por email y tienda: el carrito más reciente", () => {
    const older = session({ id: "s-old", updatedAt: ago(20 * HOUR) });
    const newer = session({ id: "s-new", updatedAt: ago(4 * HOUR), email: "LUCIA@example.com" });
    const otherStore = session({ id: "s-other", storeId: "store-2", updatedAt: ago(10 * HOUR) });
    const picked = pickAbandonedNotices({ sessions: [older, newer, newer, otherStore], now: NOW });
    expect(picked.map((s) => s.id)).toEqual(["s-other", "s-new"]);
  });

  it("respeta el tope por corrida y manda primero los más viejos", () => {
    // Una sesión por tienda: el tope por tienda no interviene.
    const many = Array.from({ length: MAX_ABANDONED_PER_RUN + 20 }, (_, i) =>
      session({ id: `s-${i}`, storeId: `store-${i}`, email: `c${i}@example.com`, updatedAt: ago(4 * HOUR + i * 60_000) }),
    );
    const picked = pickAbandonedNotices({ sessions: many, now: NOW });
    expect(picked).toHaveLength(MAX_ABANDONED_PER_RUN);
    expect(picked[0].id).toBe(`s-${MAX_ABANDONED_PER_RUN + 19}`);
    expect(pickAbandonedNotices({ sessions: many, now: NOW, limit: 2 })).toHaveLength(2);
  });

  it("tope por tienda (menor si está en prueba) y turnos entre tiendas", () => {
    const big = Array.from({ length: MAX_ABANDONED_PER_STORE + 30 }, (_, i) =>
      session({ id: `big-${i}`, storeId: "grande", email: `g${i}@example.com`, updatedAt: ago(40 * HOUR - i * 60_000) }),
    );
    const trial = Array.from({ length: 30 }, (_, i) =>
      session({ id: `trial-${i}`, storeId: "prueba", storeTrialing: true, email: `t${i}@example.com`, updatedAt: ago(10 * HOUR - i * 60_000) }),
    );
    const small = [session({ id: "small-0", storeId: "chica", email: "s@example.com", updatedAt: ago(4 * HOUR) })];
    const picked = pickAbandonedNotices({ sessions: [...big, ...trial, ...small], now: NOW });
    const count = (prefix: string) => picked.filter((s) => s.id.startsWith(prefix)).length;
    expect(count("big-")).toBe(MAX_ABANDONED_PER_STORE);
    expect(count("trial-")).toBe(MAX_ABANDONED_PER_TRIAL_STORE);
    expect(count("small-")).toBe(1);
    // Por turnos: la primera de cada tienda (la tienda con el carrito más viejo, primero).
    expect(picked.slice(0, 3).map((s) => s.id)).toEqual(["big-0", "trial-0", "small-0"]);
    // Con un tope chico, ninguna tienda se queda afuera por culpa de la grande.
    expect(new Set(pickAbandonedNotices({ sessions: [...big, ...trial, ...small], now: NOW, limit: 3 }).map((s) => s.storeId))).toEqual(
      new Set(["grande", "prueba", "chica"]),
    );
  });

  it("lee el jsonb de la RPC y descarta lo que no tiene forma", () => {
    const rows = parseAbandonedCandidates([
      {
        id: "s-1",
        store_id: "store-1",
        token: TOKEN,
        email: "lucia@example.com",
        name: null,
        items: [{ variant_id: "v-1", qty: 2, name: "Remera", price: "15500.00" }, { variant_id: "v-2", qty: 0 }, "basura"],
        consent: true,
        created_at: ago(6 * HOUR),
        updated_at: ago(5 * HOUR),
        recovered_order_id: null,
        reminded_at: null,
        unsubscribed_at: null,
        store_active: true,
        store_trialing: true,
        enabled: true,
        recently_reminded: false,
      },
      { id: "sin-tienda" },
      null,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].items).toEqual([{ variantId: "v-1", qty: 2, name: "Remera", price: 15500 }]);
    expect(rows[0].storeTrialing).toBe(true);
    expect(isAbandonedDue(rows[0], NOW)).toBe(true);
    expect(parseAbandonedCandidates({ no: "array" })).toEqual([]);
  });
});

describe("ítems del mail con datos de hoy", () => {
  const variant = (patch: Partial<MailVariant> = {}): MailVariant => ({
    storeId: "store-1",
    productName: "Remera básica",
    title: "Negro / M",
    price: 16000,
    active: true,
    stock: 10,
    trackInventory: true,
    allowBackorder: false,
    ...patch,
  });

  it("usa el nombre y el precio actuales y recorta la cantidad al stock", () => {
    const items = refreshAbandonedItems(
      [
        { variantId: "v-1", qty: 2, name: "viejo", price: 1 },
        { variantId: "v-2", qty: 5, name: "", price: 0 },
      ],
      new Map([
        ["v-1", variant()],
        ["v-2", variant({ title: "Default", productName: "Gorra lisa", price: 17500, stock: 3 })],
      ]),
      "store-1",
    );
    expect(items).toEqual([
      { name: "Remera básica · Negro / M", qty: 2, unitPrice: 16000 },
      { name: "Gorra lisa", qty: 3, unitPrice: 17500 },
    ]);
  });

  it("omite lo borrado, inactivo, sin stock o de otra tienda; con backorder no hay tope", () => {
    const saved = ["v-1", "v-2", "v-3", "v-4", "v-5"].map((variantId) => ({ variantId, qty: 4, name: "", price: 0 }));
    const items = refreshAbandonedItems(
      saved,
      new Map([
        ["v-1", variant({ active: false })],
        ["v-2", variant({ stock: 0 })],
        ["v-3", variant({ storeId: "store-2" })],
        ["v-4", variant({ stock: 0, allowBackorder: true, productName: "Encargo" })],
      ]),
      "store-1",
    );
    expect(items).toEqual([{ name: "Encargo · Negro / M", qty: 4, unitPrice: 16000 }]);
  });
});

describe("plantilla «Dejaste tu pedido a mitad de camino»", () => {
  const data = {
    customerName: "Lucía Fernández",
    items: [
      { name: "Remera básica · Negro / M", qty: 2, unitPrice: 15500 },
      { name: "Gorra lisa", qty: 1, unitPrice: 17500 },
    ],
    currency: "ARS",
    locale: "es-AR",
    recoverUrl: `https://taller-luna.ecommy.app/carrito/recuperar/${TOKEN}`,
    unsubscribeUrl: `https://taller-luna.ecommy.app/carrito/recuperar/${TOKEN}?baja=1`,
  };

  it("lista ítems, total, botón para terminar y baja en el pie", () => {
    const mail = abandonedCartEmail(data, STORE, { razonSocial: "Taller Luna SRL", cuit: "30-71234567-8" });
    expect(abandonedTotal(data.items)).toBe(48500);
    expect(mail.subject).toBe("Dejaste tu pedido a mitad de camino en Taller Luna");
    for (const out of [mail.html, mail.text]) {
      expect(out).toContain("Hola, Lucía.");
      expect(out).toContain("Remera básica · Negro / M");
      expect(out).toContain(`2 × ${$(15500)}`);
      expect(out).toContain($(48500));
      expect(out).toContain("Terminar mi pedido");
      expect(out).toContain(`/carrito/recuperar/${TOKEN}`);
      expect(out).toContain("No quiero recibir estos avisos");
      expect(out).toContain(`/carrito/recuperar/${TOKEN}?baja=1`);
      expect(out).toContain("Taller Luna SRL · CUIT 30-71234567-8");
    }
  });

  it("sin urgencia ni descuentos inventados", () => {
    const mail = abandonedCartEmail(data, STORE);
    const text = `${mail.subject} ${mail.text}`.toLowerCase();
    for (const word of ["!", "últimas", "apurate", "descuento exclusivo", "% off", "cupón", "se agota"]) {
      expect(text).not.toContain(word);
    }
  });

  it("el nombre tipeado por un tercero no entra si no parece un nombre, y el HTML se escapa", () => {
    const mail = abandonedCartEmail(
      { ...data, customerName: "verificá-tu-cuenta.com <b>ya</b>", items: [{ name: "Taza <script>", qty: 1, unitPrice: 5000 }] },
      STORE,
    );
    expect(mail.text).toContain("Hola.");
    expect(mail.text).not.toContain("verificá");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("Taza &lt;script&gt;");
  });

  it("resume los ítems que no entran", () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ name: `Producto ${i + 1}`, qty: 1, unitPrice: 1000 }));
    const mail = abandonedCartEmail({ ...data, items }, STORE);
    expect(mail.text).toContain("Y 3 productos más en el carrito.");
    expect(mail.text).toContain($(11000));
  });
});

/** Base falsa: reclamar (`claim_checkout_reminder`) y liberar (`release_checkout_reminder`). */
function fakeDb(claimable: boolean) {
  const state = { claims: 0, releases: 0 };
  const db = {
    rpc: async (name: string) => {
      if (name === "claim_checkout_reminder") {
        state.claims++;
        return { data: claimable, error: null };
      }
      if (name === "release_checkout_reminder") state.releases++;
      return { data: null, error: null };
    },
  };
  return { state, db: db as unknown as AbandonedNoticePlan["db"] };
}

describe("envío", () => {
  const fetchMock = vi.fn();
  const info = {
    slug: "taller-luna",
    store: STORE,
    legal: { razonSocial: null, cuit: null },
    currency: "ARS",
    locale: "es-AR",
    target: { slug: "taller-luna", custom_domain: "tallerluna.com.ar", custom_domain_verified: true },
  };
  const notice = { session: session(), items: [{ name: "Remera", qty: 1, unitPrice: 1000 }], info };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    resetEmailWarnings();
    setEmailTimingForTests({ gap: 0, retry: 0 });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    setEmailTimingForTests(null);
  });

  it("reclama la sesión, manda desde la tienda con Idempotency-Key y links de la tienda", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "em_1" }), { status: 200 }));
    const { state, db } = fakeDb(true);
    const report = await deliverAbandonedNotices({ db, notices: [notice] }, NOW);
    expect(report).toEqual({ abandoned_cart: 1 });
    expect(state).toEqual({ claims: 1, releases: 0 });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.to).toEqual(["lucia@example.com"]);
    expect(body.from).toContain("Taller Luna vía Ecommy");
    expect(body.reply_to).toEqual(["hola@tallerluna.com"]);
    expect(body.html).toContain(`https://tallerluna.com.ar/carrito/recuperar/${TOKEN}`);
    expect(body.html).toContain(`https://tallerluna.com.ar/carrito/recuperar/${TOKEN}?baja=1`);
    expect(body.html).not.toContain("?recuperar=");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("abandoned_cart/s-1");
    // Baja en un clic (RFC 8058): URL con POST y mailto.
    expect(body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(body.headers["List-Unsubscribe"]).toMatch(new RegExp(`^<https?://[^>]+/api/email/unsubscribe\\?token=${TOKEN}>, <mailto:hola@tallerluna\\.com\\?subject=`));
  });

  it("List-Unsubscribe: la casilla de la plataforma manda; sin casillas, sólo la URL", () => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_MAILTO", "bajas@ecommy.app");
    expect(abandonedUnsubscribeHeaders(TOKEN, "hola@tallerluna.com")["List-Unsubscribe"]).toContain("<mailto:bajas@ecommy.app?subject=");
    vi.stubEnv("EMAIL_UNSUBSCRIBE_MAILTO", "");
    const onlyUrl = abandonedUnsubscribeHeaders(TOKEN, null)["List-Unsubscribe"];
    expect(onlyUrl).not.toContain("mailto:");
    expect(onlyUrl).toContain(`/api/email/unsubscribe?token=${TOKEN}`);
  });

  it("si otra corrida ya la tomó, no manda", async () => {
    const { db } = fakeDb(false);
    expect(await deliverAbandonedNotices({ db, notices: [notice] }, NOW)).toEqual({ abandoned_cart: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("si Resend falla, libera la sesión para reintentar", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ name: "validation_error", message: "bad" }), { status: 422 }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { state, db } = fakeDb(true);
    expect(await deliverAbandonedNotices({ db, notices: [notice] }, NOW)).toEqual({ abandoned_cart: 0 });
    expect(state.releases).toBe(1);
    error.mockRestore();
  });

  it("la purga de 30 días corre aunque los mails estén apagados (con la clave de servicio)", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    serviceRpc.calls.length = 0;
    expect(await runAbandonedNotices(NOW)).toEqual({ abandoned_cart: 0 });
    expect(serviceRpc.calls).toEqual(["purge_checkout_sessions"]);
    expect(fetchMock).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it("sin plan (emails apagados o sin migración) no hace nada", async () => {
    expect(await deliverAbandonedNotices(null, NOW)).toEqual({ abandoned_cart: 0 });
  });
});
