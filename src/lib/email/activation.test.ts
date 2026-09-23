import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Json } from "@/lib/supabase/database.types";

import {
  activationKind,
  activationSentAt,
  deliverActivationNotices,
  mayNeedActivation,
  pickActivationNotices,
  withActivationNotice,
  type ActivationNoticePlan,
  type ActivationStoreRow,
} from "./activation-notices";
import { resetEmailWarnings, setEmailTimingForTests } from "./send";
import { noProductsEmail, shareStoreEmail } from "./templates";

const NOW = new Date("2026-09-23T09:00:00Z");
const HOUR = 3_600_000;
const DAY = 86_400_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

function row(patch: Partial<ActivationStoreRow> = {}): ActivationStoreRow {
  return {
    id: "store-1",
    slug: "taller-luna",
    name: "Taller Luna",
    status: "active",
    createdAt: ago(3 * DAY),
    onboarding: { kind: "ropa" },
    customDomain: null,
    customDomainVerified: false,
    products: 0,
    activeProducts: null,
    orders: null,
    owner: { email: "ana@example.com", name: "Ana Gómez", suspended: false },
    trialEndsAt: null,
    ...patch,
  };
}

const withProducts = { products: 4, activeProducts: 3, orders: 0 };

describe("selección de avisos de activación", () => {
  it("día 2 sin productos: aviso 1; antes de 48 h, nada", () => {
    expect(activationKind(row({ createdAt: ago(48 * HOUR) }), NOW)).toBe("activation_no_products");
    expect(activationKind(row({ createdAt: ago(47 * HOUR) }), NOW)).toBeNull();
  });

  it("día 2 con productos (aunque sean borradores): nada", () => {
    expect(activationKind(row({ products: 1 }), NOW)).toBeNull();
  });

  it("día 7 con productos activos, sin compartir ni pedidos: aviso 2", () => {
    expect(activationKind(row({ createdAt: ago(8 * DAY), ...withProducts }), NOW)).toBe("activation_share");
  });

  it("día 7: compartida, con pedidos o sin activos no recibe el aviso 2", () => {
    const late = { createdAt: ago(8 * DAY) };
    expect(activationKind(row({ ...late, ...withProducts, onboarding: { shared: true } }), NOW)).toBeNull();
    expect(activationKind(row({ ...late, ...withProducts, orders: 1 }), NOW)).toBeNull();
    expect(activationKind(row({ ...late, ...withProducts, activeProducts: 0 }), NOW)).toBeNull();
    // Conteo que no se hizo: no se asume nada.
    expect(activationKind(row({ ...late, products: 4, activeProducts: null, orders: null }), NOW)).toBeNull();
  });

  it("día 7 sin productos: el aviso 1 si nunca salió, una sola vez en total", () => {
    const late = row({ createdAt: ago(9 * DAY) });
    expect(activationKind(late, NOW)).toBe("activation_no_products");
    const sent = withActivationNotice(late.onboarding, "activation_no_products", ago(5 * DAY));
    expect(activationKind({ ...late, onboarding: sent }, NOW)).toBeNull();
  });

  it("no manda los dos seguidos: el 2 espera dos días desde el 1", () => {
    const onboarding = withActivationNotice({}, "activation_no_products", ago(1 * DAY));
    const store = row({ createdAt: ago(8 * DAY), ...withProducts, onboarding });
    expect(activationKind(store, NOW)).toBeNull();
    expect(activationKind({ ...store, onboarding: withActivationNotice({}, "activation_no_products", ago(3 * DAY)) }, NOW)).toBe(
      "activation_share",
    );
  });

  it("fuera de ventana (30 días) o tienda no activa: nada", () => {
    expect(activationKind(row({ createdAt: ago(30 * DAY) }), NOW)).toBeNull();
    expect(activationKind(row({ status: "suspended" }), NOW)).toBeNull();
    expect(mayNeedActivation({ status: "deleted", createdAt: ago(3 * DAY), onboarding: {} }, NOW)).toBe(false);
  });

  it("mayNeedActivation descarta sin contar las que ya recibieron todo", () => {
    const both = withActivationNotice(withActivationNotice({}, "activation_no_products", ago(20 * DAY)), "activation_share", ago(10 * DAY));
    expect(mayNeedActivation({ status: "active", createdAt: ago(25 * DAY), onboarding: both }, NOW)).toBe(false);
    const early = withActivationNotice({}, "activation_no_products", ago(1 * DAY));
    expect(mayNeedActivation({ status: "active", createdAt: ago(4 * DAY), onboarding: early }, NOW)).toBe(false);
    expect(mayNeedActivation({ status: "active", createdAt: ago(10 * DAY), onboarding: early }, NOW)).toBe(true);
  });

  it("pickActivationNotices: a quién, y nunca a dueños suspendidos o sin email", () => {
    const picked = pickActivationNotices({
      now: NOW,
      stores: [
        row({ id: "a" }),
        row({ id: "b", owner: { email: "b@example.com", name: null, suspended: true } }),
        row({ id: "c", owner: { email: "no-es-un-email", name: null, suspended: false } }),
        row({ id: "d", owner: null }),
        row({ id: "e", createdAt: ago(12 * DAY), ...withProducts, owner: { email: "eva@example.com", name: "Eva", suspended: false } }),
        row({ id: "a" }),
      ],
    });
    expect(picked.map((n) => [n.store.id, n.kind, n.to])).toEqual([
      ["a", "activation_no_products", "ana@example.com"],
      ["e", "activation_share", "eva@example.com"],
    ]);
  });
});

describe("marca de idempotencia", () => {
  it("conserva el resto de onboarding y las otras marcas", () => {
    const base: Json = { kind: "ropa", shared: false, notices: { trial_ending: "2026-10-07T12:00:00Z" } };
    const marked = withActivationNotice(base, "activation_share", "2026-09-23T09:00:00.000Z");
    expect(marked).toEqual({
      kind: "ropa",
      shared: false,
      notices: { trial_ending: "2026-10-07T12:00:00Z", activation_share: "2026-09-23T09:00:00.000Z" },
    });
    expect(activationSentAt(marked, "activation_share")).toBe("2026-09-23T09:00:00.000Z");
    expect(activationSentAt(marked, "activation_no_products")).toBeNull();
    expect(activationSentAt(null, "activation_share")).toBeNull();
  });
});

describe("plantillas de activación", () => {
  const base = {
    storeName: 'Taller <b>Luna</b> & "Cía"',
    storeUrl: "https://taller-luna.ecommy.app",
    platformUrl: "https://www.ecommy.app",
    ownerName: "Ana Gómez",
    supportEmail: "hola@ecommy.app",
  };

  it("día 2: dos caminos, plan de la importación y respuesta al mail", () => {
    const mail = noProductsEmail({ ...base, daysSinceCreated: 2, trialDaysLeft: 12 });
    expect(mail.subject).toBe('Taller <b>Luna</b> & "Cía": falta cargar el primer producto');
    expect(mail.html).not.toContain("<b>Luna</b>");
    expect(mail.html).toContain("Taller &lt;b&gt;Luna&lt;/b&gt; &amp;");
    expect(mail.html).toContain("https://www.ecommy.app/admin/productos/nuevo");
    expect(mail.html).toContain("https://www.ecommy.app/admin/importar");
    expect(mail.text).toContain("Tu tienda está creada. Falta lo más importante: el primer producto.");
    expect(mail.text).toContain("Hola, Ana.");
    expect(mail.text).toContain("hace 2 días");
    expect(mail.text).toContain("Planilla, desde el plan Starter");
    expect(mail.text).toContain("otra web, desde Pro");
    expect(mail.text).toContain("te quedan 12 días");
    expect(mail.text).toContain("Si preferís que lo hagamos juntos, respondé este mail");
    expect(mail.text).toContain("Recibís este mail porque tenés una cuenta en Ecommy.");
    expect(mail.text).not.toMatch(/!.*!/);
  });

  it("día 2 sin prueba ni email de soporte: sin esas frases", () => {
    const mail = noProductsEmail({ ...base, supportEmail: null, daysSinceCreated: 9, trialDaysLeft: 0 });
    expect(mail.text).toContain("hace 9 días");
    expect(mail.text).not.toContain("prueba de Pro");
    expect(mail.text).not.toContain("respondé este mail");
  });

  it("día 7: dirección de la tienda, compartir y prueba", () => {
    const mail = shareStoreEmail({ ...base, activeProducts: 3, trialEndsAt: "2026-09-30T12:00:00Z", trialDaysLeft: 7 });
    expect(mail.subject).toBe("Tu tienda ya tiene productos. Ahora, que la vean.");
    expect(mail.html).toContain("https://www.ecommy.app/admin/compartir");
    expect(mail.html).toContain("https://taller-luna.ecommy.app");
    expect(mail.text).toContain("3 productos activos");
    expect(mail.text).toContain("30/09/2026");
    expect(mail.text).toContain("quedan 7 días");
    expect(mail.html).toContain("Taller &lt;b&gt;Luna&lt;/b&gt;");
    const free = shareStoreEmail({ ...base, activeProducts: 1 });
    expect(free.text).toContain("1 producto activo");
    expect(free.text).not.toContain("prueba de Pro");
  });
});

/** Base falsa en memoria: sólo lo que usa `markActivation`. */
function fakeDb(onboarding: Json) {
  const state = { onboarding, updates: 0 };
  const db = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { onboarding: state.onboarding }, error: null }) }) }),
      update: (patch: { onboarding: Json }) => ({
        eq: async () => {
          state.onboarding = patch.onboarding;
          state.updates++;
          return { error: null };
        },
      }),
    }),
  };
  return { state, db: db as unknown as ActivationNoticePlan["db"] };
}

describe("envío y re-envío", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("PLATFORM_EMAIL", "hola@ecommy.app");
    resetEmailWarnings();
    setEmailTimingForTests({ gap: 0, retry: 0 });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    setEmailTimingForTests(null);
  });

  it("marca sólo si salió, releyendo onboarding, y la segunda corrida no re-envía", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "em_1" }), { status: 200 }));
    const store = row();
    // El dueño tildó "shared" entre la carga y el envío: la marca no lo pisa.
    const { state, db } = fakeDb({ kind: "ropa", shared: true });
    const notices = pickActivationNotices({ stores: [store], now: NOW });
    const report = await deliverActivationNotices({ db, notices }, NOW);

    expect(report).toEqual({ activation_no_products: 1, activation_share: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.to).toEqual(["ana@example.com"]);
    expect(body.reply_to).toEqual(["hola@ecommy.app"]);
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("activation_no_products/store-1");
    expect(state.onboarding).toEqual({ kind: "ropa", shared: true, notices: { activation_no_products: NOW.toISOString() } });

    const again = pickActivationNotices({ stores: [{ ...store, onboarding: state.onboarding }], now: new Date(NOW.getTime() + DAY) });
    expect(again).toEqual([]);
  });

  it("si Resend falla no marca (mañana se reintenta)", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ name: "validation_error", message: "bad" }), { status: 422 }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { state, db } = fakeDb({ kind: "ropa" });
    const notices = pickActivationNotices({ stores: [row()], now: NOW });
    const report = await deliverActivationNotices({ db, notices }, NOW);
    expect(report).toEqual({ activation_no_products: 0, activation_share: 0 });
    expect(state.updates).toBe(0);
    error.mockRestore();
  });

  it("sin plan (emails apagados) no hace nada", async () => {
    expect(await deliverActivationNotices(null, NOW)).toEqual({ activation_no_products: 0, activation_share: 0 });
  });

  it("saltea las tiendas que hoy ya recibieron un aviso de prueba (skip) sin marcarlas", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "em_1" }), { status: 200 }));
    const { state, db } = fakeDb({ kind: "ropa" });
    const notices = pickActivationNotices({ stores: [row()], now: NOW });
    expect(notices).toHaveLength(1);
    const report = await deliverActivationNotices({ db, notices }, NOW, new Set([notices[0].store.id]));
    expect(report).toEqual({ activation_no_products: 0, activation_share: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.updates).toBe(0);
  });
});
