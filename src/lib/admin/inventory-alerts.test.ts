import { describe, expect, it } from "vitest";

import {
  deliverNotices,
  isMissingSchema,
  MAX_ALERT_EMAILS_PER_RUN,
  pickAlertsToNotify,
  readStockAlertRpc,
  STOCK_ALERT_EMAIL_ERROR,
  STOCK_ALERT_UNAVAILABLE,
  stockAlertInputSchema,
  variantAvailable,
  variantLabel,
  type AlertNotice,
  type AlertVariant,
  type PendingAlert,
} from "./inventory-alerts-utils";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const V1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function variant(id: string, productId: string, patch: Partial<AlertVariant> = {}): AlertVariant {
  return {
    id,
    productId,
    title: `Talle ${id}`,
    price: 10_000,
    compareAtPrice: null,
    stock: 0,
    trackInventory: true,
    allowBackorder: false,
    isActive: true,
    position: 0,
    product: { id: productId, name: `Producto ${productId}`, slug: `p-${productId}`, status: "active" },
    ...patch,
  };
}

function alert(id: string, patch: Partial<PendingAlert> = {}): PendingAlert {
  return { id, email: `${id}@example.com`, productId: "p1", variantId: "m", createdAt: `2026-09-01T10:00:0${id.length}Z`, ...patch };
}

describe("stockAlertInputSchema", () => {
  it("normaliza el email y acepta aviso por producto (variantId null)", () => {
    const r = stockAlertInputSchema.safeParse({ productId: P1, variantId: null, email: "  Lucia@Example.COM " });
    expect(r.success && r.data).toEqual({ productId: P1, variantId: null, email: "lucia@example.com" });
  });

  it("rechaza emails inválidos con el copy de la ficha", () => {
    for (const email of ["", "lucia", "lucia@", "a b@x.com", "<x>@y.com", `${"a".repeat(250)}@x.com`]) {
      const r = stockAlertInputSchema.safeParse({ productId: P1, variantId: V1, email });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe(STOCK_ALERT_EMAIL_ERROR);
    }
  });

  it("acepta el honeypot `website` (la action lo descarta)", () => {
    const r = stockAlertInputSchema.safeParse({ productId: P1, variantId: null, email: "a@b.co", website: "http://spam.example" });
    expect(r.success && r.data.website).toBe("http://spam.example");
  });

  it("no acepta ids que no son uuid ni campos de más (la tienda sale del request)", () => {
    expect(stockAlertInputSchema.safeParse({ productId: "x", variantId: null, email: "a@b.co" }).success).toBe(false);
    expect(stockAlertInputSchema.safeParse({ productId: P1, variantId: null, email: "a@b.co", storeId: P2 }).success).toBe(false);
  });
});

describe("readStockAlertRpc (cupo y duplicado)", () => {
  it("alta nueva y ya anotado", () => {
    expect(readStockAlertRpc({ ok: true, duplicate: false }, null)).toEqual({ ok: true, duplicate: false });
    expect(readStockAlertRpc({ ok: true, duplicate: true }, null)).toEqual({ ok: true, duplicate: true });
  });

  it("los raise del RPC (cupo, ya hay stock) llegan tal cual al comprador", () => {
    const quota = "Ya pediste varios avisos con este email. Probá de nuevo en un rato.";
    expect(readStockAlertRpc(null, { code: "P0001", message: quota })).toEqual({ ok: false, error: quota });
    const store = "Hoy no podemos tomar más avisos. Probá mañana o escribinos.";
    expect(readStockAlertRpc(null, { code: "P0001", message: store })).toEqual({ ok: false, error: store });
  });

  it("sin la migración o con otro error: mensaje genérico (nunca el error crudo)", () => {
    expect(readStockAlertRpc(null, { code: "PGRST202", message: "Could not find the function public.create_stock_alert" })).toEqual({
      ok: false,
      error: STOCK_ALERT_UNAVAILABLE,
    });
    expect(readStockAlertRpc(null, { code: "42501", message: "permission denied" })).toEqual({ ok: false, error: STOCK_ALERT_UNAVAILABLE });
    expect(readStockAlertRpc({}, null)).toEqual({ ok: false, error: STOCK_ALERT_UNAVAILABLE });
    expect(readStockAlertRpc([], null)).toEqual({ ok: false, error: STOCK_ALERT_UNAVAILABLE });
  });

  it("detecta tabla o función inexistente", () => {
    expect(isMissingSchema({ code: "PGRST205" })).toBe(true);
    expect(isMissingSchema({ code: "PGRST202" })).toBe(true);
    expect(isMissingSchema({ code: "42P01" })).toBe(true);
    expect(isMissingSchema({ code: "P0001" })).toBe(false);
    expect(isMissingSchema(null)).toBe(false);
  });
});

describe("variantAvailable / variantLabel", () => {
  it("mismo criterio que el storefront", () => {
    expect(variantAvailable({ stock: 0, trackInventory: true, allowBackorder: false, isActive: true })).toBe(false);
    expect(variantAvailable({ stock: 2, trackInventory: true, allowBackorder: false, isActive: true })).toBe(true);
    expect(variantAvailable({ stock: 0, trackInventory: false, allowBackorder: false, isActive: true })).toBe(true);
    expect(variantAvailable({ stock: 0, trackInventory: true, allowBackorder: true, isActive: true })).toBe(true);
    expect(variantAvailable({ stock: 5, trackInventory: true, allowBackorder: false, isActive: false })).toBe(false);
  });

  it("la variante única no se nombra", () => {
    expect(variantLabel("Default")).toBeNull();
    expect(variantLabel("")).toBeNull();
    expect(variantLabel("M · Negro")).toBe("M · Negro");
  });
});

describe("pickAlertsToNotify", () => {
  it("avisa sólo las variantes que se pueden comprar", () => {
    const variants = [variant("m", "p1", { stock: 3 }), variant("l", "p1", { stock: 0 })];
    const out = pickAlertsToNotify([alert("a", { variantId: "m" }), alert("b", { variantId: "l" })], variants);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ email: "a@example.com", alertIds: ["a"] });
    expect(out[0].variants.map((v) => v.id)).toEqual(["m"]);
  });

  it("aviso por producto: sale si alguna variante volvió y lista las disponibles en orden", () => {
    const variants = [
      variant("l", "p1", { stock: 1, position: 2 }),
      variant("s", "p1", { stock: 0, position: 0 }),
      variant("m", "p1", { stock: 4, position: 1 }),
    ];
    const out = pickAlertsToNotify([alert("a", { variantId: null })], variants);
    expect(out).toHaveLength(1);
    expect(out[0].variants.map((v) => v.id)).toEqual(["m", "l"]);
  });

  it("aviso por producto sin ninguna variante disponible: queda pendiente", () => {
    expect(pickAlertsToNotify([alert("a", { variantId: null })], [variant("m", "p1")])).toEqual([]);
  });

  it("producto no publicado o variante desactivada: no avisa", () => {
    const draft = variant("m", "p1", { stock: 5, product: { id: "p1", name: "X", slug: "x", status: "draft" } });
    expect(pickAlertsToNotify([alert("a")], [draft])).toEqual([]);
    expect(pickAlertsToNotify([alert("a")], [variant("m", "p1", { stock: 5, isActive: false })])).toEqual([]);
  });

  it("variante de otro producto o que no está en la lista: no avisa", () => {
    expect(pickAlertsToNotify([alert("a", { variantId: "zz" })], [variant("m", "p1", { stock: 5 })])).toEqual([]);
    expect(pickAlertsToNotify([alert("a", { productId: "p2" })], [variant("m", "p1", { stock: 5 })])).toEqual([]);
  });

  it("una persona con varios avisos del mismo producto recibe UN mail (email sin mayúsculas)", () => {
    const variants = [variant("m", "p1", { stock: 2, position: 1 }), variant("s", "p1", { stock: 2, position: 0 })];
    const out = pickAlertsToNotify(
      [
        alert("a", { email: "Lu@Example.com", variantId: "m" }),
        alert("bb", { email: "lu@example.com", variantId: "s" }),
        alert("ccc", { email: "lu@example.com", variantId: null }),
      ],
      variants,
    );
    expect(out).toHaveLength(1);
    expect(out[0].email).toBe("lu@example.com");
    expect(out[0].alertIds.sort()).toEqual(["a", "bb", "ccc"]);
    expect(out[0].variants.map((v) => v.id)).toEqual(["s", "m"]);
  });

  it("la misma persona en dos productos recibe dos mails; respeta el tope, los más viejos primero", () => {
    const variants = [variant("m", "p1", { stock: 1 }), variant("x", "p2", { stock: 1 })];
    const alerts = [
      alert("new", { email: "a@x.com", productId: "p2", variantId: "x", createdAt: "2026-09-03T00:00:00Z" }),
      alert("old", { email: "a@x.com", productId: "p1", variantId: "m", createdAt: "2026-09-01T00:00:00Z" }),
    ];
    expect(pickAlertsToNotify(alerts, variants)).toHaveLength(2);
    const capped = pickAlertsToNotify(alerts, variants, 1);
    expect(capped.map((n) => n.alertIds)).toEqual([["old"]]);
  });
});

describe("deliverNotices (M3: reclamar y mandar de a uno)", () => {
  const notice = (id: string, alertIds: string[]): AlertNotice => ({
    email: `${id}@example.com`,
    product: { id: "p1", name: "Remera", slug: "remera", status: "active" },
    variants: [variant("m", "p1", { stock: 3 })],
    alertIds,
  });

  it("marca, manda y libera sólo el mail que falló; sigue con el resto", async () => {
    const log: string[] = [];
    const claimed = new Set<string>();
    const res = await deliverNotices([notice("a", ["a1", "a2"]), notice("b", ["b1"]), notice("c", ["c1"])], {
      claim: async (ids) => {
        log.push(`claim ${ids.join(",")}`);
        const mine = ids.filter((id) => !claimed.has(id));
        mine.forEach((id) => claimed.add(id));
        return mine;
      },
      send: async (n) => {
        log.push(`send ${n.email}`);
        if (n.email.startsWith("b")) return false;
        if (n.email.startsWith("c")) throw new Error("Resend caído");
        return true;
      },
      release: async (ids) => {
        log.push(`release ${ids.join(",")}`);
        ids.forEach((id) => claimed.delete(id));
      },
    });
    expect(res).toEqual({ sent: 1, failed: 2, skipped: 0 });
    // De a uno: nunca hay dos avisos marcados sin mail en vuelo.
    expect(log).toEqual([
      "claim a1,a2",
      "send a@example.com",
      "claim b1",
      "send b@example.com",
      "release b1",
      "claim c1",
      "send c@example.com",
      "release c1",
    ]);
    expect([...claimed]).toEqual(["a1", "a2"]);
  });

  it("no manda lo que otro proceso ya reclamó y manda sólo los avisos propios", async () => {
    const sent: AlertNotice[] = [];
    const res = await deliverNotices([notice("a", ["a1", "a2"]), notice("b", ["b1"])], {
      claim: async (ids) => ids.filter((id) => id !== "a2" && id !== "b1"),
      send: async (n) => {
        sent.push(n);
        return true;
      },
      release: async () => undefined,
    });
    expect(res).toEqual({ sent: 1, failed: 0, skipped: 1 });
    expect(sent[0].alertIds).toEqual(["a1"]);
  });

  it("tope por reposición: 20 mails", () => {
    expect(MAX_ALERT_EMAILS_PER_RUN).toBe(20);
  });
});
