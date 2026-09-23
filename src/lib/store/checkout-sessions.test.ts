import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { CartItem } from "@/lib/cart";

import type { FreshVariant } from "./cart-validation";
import {
  cartSignature,
  CHECKOUT_SESSION_LIMITS,
  checkoutSessionKey,
  isMissingSchemaError,
  isSessionToken,
  mergeRestoredItems,
  readSessionRpc,
  readUpsertRpc,
  restoreCartItems,
  sessionInputSchema,
  sessionItemsPayload,
} from "./checkout-sessions";

const TOKEN = "0123456789abcdef".repeat(3);
const V1 = "11111111-1111-4111-8111-111111111111";
const V2 = "22222222-2222-4222-8222-222222222222";
const V3 = "33333333-3333-4333-8333-333333333333";
const STORE = "99999999-9999-4999-8999-999999999999";

describe("validación de la sesión", () => {
  const base = { token: null, email: " Lucia@Example.com ", name: "  Lucía  ", items: [{ variantId: V1, qty: 2 }], consent: true };

  it("normaliza email, nombre y token", () => {
    const r = sessionInputSchema.parse({ ...base, token: TOKEN });
    expect(r.email).toBe("lucia@example.com");
    expect(r.name).toBe("Lucía");
    expect(r.token).toBe(TOKEN);
    expect(sessionInputSchema.parse({ ...base, token: "no-es-un-token" }).token).toBeNull();
    expect(sessionInputSchema.parse({ ...base, name: "" }).name).toBeNull();
  });

  it("rechaza email inválido, cantidades fuera de rango y más de 100 ítems", () => {
    expect(sessionInputSchema.safeParse({ ...base, email: "lucia@" }).success).toBe(false);
    expect(sessionInputSchema.safeParse({ ...base, items: [{ variantId: V1, qty: 0 }] }).success).toBe(false);
    expect(sessionInputSchema.safeParse({ ...base, items: [{ variantId: V1, qty: 1000 }] }).success).toBe(false);
    expect(sessionInputSchema.safeParse({ ...base, items: [{ variantId: "x", qty: 1 }] }).success).toBe(false);
    const many = Array.from({ length: 101 }, () => ({ variantId: V1, qty: 1 }));
    expect(sessionInputSchema.safeParse({ ...base, items: many }).success).toBe(false);
    expect(sessionInputSchema.safeParse({ ...base, consent: "sí" }).success).toBe(false);
  });

  it("el payload sólo lleva variante y cantidad, sin duplicados y con tope 999", () => {
    expect(sessionItemsPayload([{ variantId: V1, qty: 600 }, { variantId: V2, qty: 1 }, { variantId: V1, qty: 600 }])).toEqual([
      { variant_id: V1, qty: 999 },
      { variant_id: V2, qty: 1 },
    ]);
    expect(cartSignature([{ variantId: V2, qty: 1 }, { variantId: V1, qty: 2 }])).toBe(cartSignature([{ variantId: V1, qty: 2 }, { variantId: V2, qty: 1 }]));
    expect(cartSignature([{ variantId: V1, qty: 2 }])).not.toBe(cartSignature([{ variantId: V1, qty: 3 }]));
  });

  it("token y clave de localStorage", () => {
    expect(isSessionToken(TOKEN)).toBe(true);
    expect(isSessionToken(TOKEN.toUpperCase())).toBe(false);
    expect(isSessionToken(TOKEN.slice(1))).toBe(false);
    expect(checkoutSessionKey(STORE)).toBe(`ecommy:checkout:${STORE}`);
  });

  it("los cupos del código son los de la migración 0020", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/0020_abandoned_checkouts.sql", import.meta.url)), "utf8");
    expect(sql).toContain(`v_email_day >= ${CHECKOUT_SESSION_LIMITS.perEmailPerDay}`);
    expect(sql).toContain(`v_ip_day >= ${CHECKOUT_SESSION_LIMITS.perIpPerDay}`);
    expect(sql).toContain(`v_store_day >= ${CHECKOUT_SESSION_LIMITS.perStorePerDay}`);
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('checkout_sessions:'");
    // El token del link nunca es legible por el equipo ni por anon.
    expect(sql).not.toMatch(/grant select \([^)]*\btoken\b/);
  });
});

describe("respuestas de las RPC", () => {
  it("upsert: token vigente o null", () => {
    expect(readUpsertRpc({ ok: true, token: TOKEN, saved: true })).toEqual({ token: TOKEN, saved: true });
    expect(readUpsertRpc({ ok: true, token: null, saved: false })).toEqual({ token: null, saved: false });
    expect(readUpsertRpc(null)).toEqual({ token: null, saved: false });
  });

  it("get_checkout_session: tolerante con lo que no tiene forma", () => {
    const s = readSessionRpc({
      store_id: STORE,
      name: "Lucía",
      recovered: false,
      items: [{ variant_id: V1, qty: 2 }, { variant_id: "x", qty: 1 }, { variant_id: V2, qty: 0 }, { variant_id: V3, qty: 5000 }],
    });
    expect(s).toEqual({ storeId: STORE, name: "Lucía", recovered: false, items: [{ variantId: V1, qty: 2 }, { variantId: V3, qty: 999 }] });
    expect(readSessionRpc(null)).toBeNull();
    expect(readSessionRpc({ store_id: "otra-cosa" })).toBeNull();
  });

  it("sin la migración se reconoce el error y se degrada", () => {
    expect(isMissingSchemaError({ code: "PGRST202" })).toBe(true);
    expect(isMissingSchemaError({ code: "42P01" })).toBe(true);
    expect(isMissingSchemaError({ code: "P0001" })).toBe(false);
    expect(isMissingSchemaError(null)).toBe(false);
  });
});

function fresh(variantId: string, patch: Partial<FreshVariant> = {}): FreshVariant {
  return {
    variantId,
    productId: `p-${variantId.slice(0, 4)}`,
    slug: "remera-basica",
    name: "Remera básica",
    variantTitle: "Negro / M",
    sku: "REM-N-M",
    image: "https://cdn.example.com/remera.jpg",
    price: 16000,
    compareAtPrice: null,
    categoryIds: ["c-1"],
    vatPercent: null,
    stock: 10,
    trackInventory: true,
    allowBackorder: false,
    active: true,
    ...patch,
  };
}

describe("reponer el carrito desde el link", () => {
  it("usa precio y datos de hoy, recorta al stock y omite lo que no está disponible", () => {
    const r = restoreCartItems(
      [
        { variantId: V1, qty: 2 },
        { variantId: V2, qty: 8 },
        { variantId: V3, qty: 1 },
        { variantId: "44444444-4444-4444-8444-444444444444", qty: 1 },
      ],
      new Map([
        [V1, fresh(V1, { price: 17000 })],
        [V2, fresh(V2, { stock: 3 })],
        [V3, fresh(V3, { stock: 0 })],
      ]),
    );
    expect(r.skipped).toBe(2);
    expect(r.reduced).toBe(1);
    expect(r.items.map((i) => [i.variantId, i.qty, i.unitPrice, i.maxQty])).toEqual([
      [V1, 2, 17000, 10],
      [V2, 3, 16000, 3],
    ]);
    expect(r.items[0]).toMatchObject({ name: "Remera básica", slug: "remera-basica", image: "https://cdn.example.com/remera.jpg", categoryIds: ["c-1"] });
  });

  it("inactiva se omite; sin control de stock o con backorder no hay tope", () => {
    const r = restoreCartItems(
      [
        { variantId: V1, qty: 5 },
        { variantId: V2, qty: 5 },
        { variantId: V3, qty: 5 },
      ],
      new Map([
        [V1, fresh(V1, { active: false })],
        [V2, fresh(V2, { trackInventory: false, stock: 0 })],
        [V3, fresh(V3, { allowBackorder: true, stock: 0 })],
      ]),
    );
    expect(r.skipped).toBe(1);
    expect(r.items.map((i) => [i.variantId, i.qty, i.maxQty])).toEqual([
      [V2, 5, null],
      [V3, 5, null],
    ]);
  });

  it("sumarlo al carrito del navegador no duplica cantidades (abrir el link dos veces)", () => {
    const restored = restoreCartItems([{ variantId: V1, qty: 2 }, { variantId: V2, qty: 1 }], new Map([[V1, fresh(V1)], [V2, fresh(V2)]])).items;
    const current: CartItem[] = [{ ...restored[0], qty: 1, unitPrice: 15000 }, { ...fresh(V3), unitPrice: 900, qty: 4 } as unknown as CartItem];
    const once = mergeRestoredItems(current, restored);
    const twice = mergeRestoredItems(once, restored);
    expect(twice).toEqual(once);
    expect(once.map((i) => [i.variantId, i.qty, i.unitPrice])).toEqual([
      [V1, 2, 16000],
      [V3, 4, 900],
      [V2, 1, 16000],
    ]);
  });
});
