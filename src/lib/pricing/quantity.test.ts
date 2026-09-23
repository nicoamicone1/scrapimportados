import { describe, expect, it } from "vitest";

import { applyPromotions, computeCart } from "./engine";
import { quantityBadge, quantityDescription, quantityHeadline, quantityLineNote } from "./labels";
import { promotionFromRow, type CartItemInput, type CartTotals, type Coupon, type Promotion, type PromotionRow } from "./types";

/*
 * Promos por cantidad: "Llevá X, pagá Y" (bxgy) y "N.ª unidad al Z %"
 * (nth_unit_percent). Moneda por defecto ARS (precios con promo sin centavos).
 */

const NOW = new Date("2026-09-22T12:00:00Z");

function promo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: "p1",
    name: "Promo",
    type: "percent",
    value: 10,
    scope: "all",
    categoryIds: [],
    productIds: [],
    startsAt: null,
    endsAt: null,
    isActive: true,
    priority: 0,
    badgeLabel: null,
    stackable: false,
    ...overrides,
  };
}

const x3x2 = (o: Partial<Promotion> = {}) => promo({ id: "q-3x2", name: "3x2", type: "bxgy", value: 0, buy: 3, pay: 2, ...o });
const x2x1 = (o: Partial<Promotion> = {}) => promo({ id: "q-2x1", name: "2x1", type: "bxgy", value: 0, buy: 2, pay: 1, ...o });
const second50 = (o: Partial<Promotion> = {}) =>
  promo({ id: "q-2da", name: "2.ª al 50", type: "nth_unit_percent", value: 50, nth: 2, ...o });

function item(overrides: Partial<CartItemInput> = {}): CartItemInput {
  return { variantId: "var-a", productId: "prod-a", categoryIds: ["cat-remeras"], qty: 1, listPrice: 1000, ...overrides };
}

/** `formatPercent` usa espacio irrompible antes del %. */
const nb = (text: string) => text.replace(/ %/g, "\u00a0%");

const lineOf = (t: CartTotals, variantId = "var-a") => t.lines.find((l) => l.variantId === variantId)!;
const cart = (items: CartItemInput[], promotions: Promotion[], extra: { coupon?: Coupon | null } = {}) =>
  computeCart({ items, promotions, now: NOW, ...extra });

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Invariante: lo que se muestra suma lo mismo que lo que recalcula
 * create_order (precio real por línea + bundle_discount a nivel pedido).
 */
function expectConsistent(t: CartTotals) {
  const net = t.lines.reduce((acc, l) => acc + l.netTotal, 0);
  expect(r2(t.subtotal - t.promoTotal)).toBe(r2(net));
  expect(r2(t.lines.reduce((acc, l) => acc + (l.offer?.amount ?? 0), 0))).toBe(t.bundleDiscount);
  expect(r2(t.offers.reduce((acc, o) => acc + o.amount, 0))).toBe(t.bundleDiscount);
  expect(r2(t.lines.reduce((acc, l) => acc + l.promoDiscount, 0) + t.bundleDiscount)).toBe(t.promoTotal);
  for (const l of t.lines) {
    expect(r2(l.unitPrice * l.qty)).toBe(l.lineTotal);
    expect(r2(l.listPrice * l.qty - l.lineTotal)).toBe(l.promoDiscount);
    expect(r2(l.lineTotal - (l.offer?.amount ?? 0))).toBe(l.netTotal);
  }
}

/** Con precios enteros (ARS), ningún total deja centavos. */
function expectWholePesos(t: CartTotals) {
  for (const n of [t.total, t.merchandiseTotal, t.promoTotal, t.bundleDiscount, ...t.lines.map((l) => l.netTotal)]) {
    expect(Number.isInteger(n)).toBe(true);
  }
}

describe("Llevá 3, pagá 2", () => {
  it("con 3 unidades bonifica 1 (la línea conserva el precio real)", () => {
    const t = cart([item({ qty: 3, listPrice: 900 })], [x3x2()]);
    const l = lineOf(t);
    expect(l.netTotal).toBe(1800);
    expect(l.unitPrice).toBe(900);
    expect(l.lineTotal).toBe(2700);
    expect(t.bundleDiscount).toBe(900);
    expect(l.offer).toMatchObject({ id: "q-3x2", label: "Promo 3x2", note: "1 unidad gratis", units: 1, baseUnitPrice: 900, amount: 900 });
    expect(l.promotion).toBeNull();
    expect(t.offers).toEqual([{ id: "q-3x2", name: "3x2", type: "bxgy", label: "Promo 3x2", amount: 900 }]);
    expect(t.promoTotal).toBe(900);
    expect(t.merchandiseTotal).toBe(1800);
    expectConsistent(t);
  });

  it("3 × $ 100 → $ 200 justos (sin centavos)", () => {
    const t = cart([item({ qty: 3, listPrice: 100 })], [x3x2()]);
    const l = lineOf(t);
    expect(l.unitPrice).toBe(100);
    expect(l.lineTotal).toBe(300);
    expect(l.offer).toMatchObject({ units: 1, amount: 100 });
    expect(l.netTotal).toBe(200);
    expect(t.offers[0].amount).toBe(100);
    expect(t.bundleDiscount).toBe(100);
    expect(t.total).toBe(200);
    expectWholePesos(t);
    expectConsistent(t);
  });

  it("5 × $ 999: la línea muestra 5 × $ 999 y el descuento va aparte", () => {
    const t = cart([item({ qty: 5, listPrice: 999 })], [x3x2()]);
    const l = lineOf(t);
    expect(l.unitPrice).toBe(999);
    expect(l.lineTotal).toBe(4995);
    expect(l.offer).toMatchObject({ units: 1, note: "1 unidad gratis", amount: 999 });
    expect(t.bundleDiscount).toBe(999);
    expect(t.total).toBe(3996);
    expectWholePesos(t);
    expectConsistent(t);
  });

  it("con 4 unidades bonifica 1", () => {
    const t = cart([item({ qty: 4, listPrice: 1000 })], [x3x2()]);
    expect(lineOf(t).netTotal).toBe(3000);
    expect(lineOf(t).unitPrice).toBe(1000);
    expect(lineOf(t).offer?.units).toBe(1);
    expectConsistent(t);
  });

  it("con 6 unidades bonifica 2", () => {
    const t = cart([item({ qty: 6, listPrice: 300 })], [x3x2()]);
    expect(lineOf(t).netTotal).toBe(1200);
    expect(lineOf(t).offer?.note).toBe("2 unidades gratis");
    expect(t.offers[0].amount).toBe(600);
    expectConsistent(t);
  });

  it("con 7 unidades bonifica 2 (la 7.ª se paga)", () => {
    const t = cart([item({ qty: 7, listPrice: 700 })], [x3x2()]);
    expect(lineOf(t).netTotal).toBe(3500);
    expect(lineOf(t).offer?.units).toBe(2);
    expectConsistent(t);
  });

  it("con 2 unidades no aplica ni aparece en el resumen", () => {
    const t = cart([item({ qty: 2 })], [x3x2()]);
    expect(lineOf(t).netTotal).toBe(2000);
    expect(lineOf(t).offer).toBeNull();
    expect(t.offers).toEqual([]);
    expect(t.promoTotal).toBe(0);
  });

  it("mezcla de productos del alcance: cuentan juntos y sale gratis el más barato", () => {
    const t = cart(
      [
        item({ variantId: "a", productId: "pa", qty: 2, listPrice: 1000 }),
        item({ variantId: "b", productId: "pb", qty: 1, listPrice: 400 }),
      ],
      [x3x2()],
    );
    expect(lineOf(t, "a").netTotal).toBe(2000);
    expect(lineOf(t, "a").offer).toMatchObject({ units: 0, note: "Suma para la Promo 3x2", amount: 0 });
    expect(lineOf(t, "b").netTotal).toBe(0);
    expect(lineOf(t, "b").offer).toMatchObject({ units: 1, note: "1 unidad gratis", amount: 400 });
    expect(t.offers[0].amount).toBe(400);
    expectConsistent(t);
  });

  it("mezcla de precios con 6 unidades: bonifica la más barata de cada grupo de 3", () => {
    const t = cart(
      [
        item({ variantId: "a", productId: "pa", qty: 3, listPrice: 1000 }),
        item({ variantId: "b", productId: "pb", qty: 2, listPrice: 500 }),
        item({ variantId: "c", productId: "pc", qty: 1, listPrice: 200 }),
      ],
      [x3x2()],
    );
    // Grupos: [1000, 1000, 1000] → sale gratis un 1000; [500, 500, 200] → sale gratis el 200.
    expect(lineOf(t, "a").netTotal).toBe(2000);
    expect(lineOf(t, "a").offer).toMatchObject({ units: 1, amount: 1000 });
    expect(lineOf(t, "b").netTotal).toBe(1000);
    expect(lineOf(t, "b").unitPrice).toBe(500);
    expect(lineOf(t, "b").offer).toMatchObject({ units: 0, amount: 0 });
    expect(lineOf(t, "c").netTotal).toBe(0);
    expect(t.offers[0].amount).toBe(1200);
    expectConsistent(t);
  });

  it("es monótona: sumar un producto barato no encarece el pedido", () => {
    const three = cart([item({ variantId: "a", productId: "pa", qty: 3, listPrice: 100 })], [x3x2()]);
    expect(three.total).toBe(200);
    const plusCheap = cart(
      [item({ variantId: "a", productId: "pa", qty: 3, listPrice: 100 }), item({ variantId: "b", productId: "pb", qty: 1, listPrice: 50 })],
      [x3x2()],
    );
    // [100, 100, 100] es un grupo completo (un 100 gratis); el de $ 50 queda solo y se paga.
    expect(plusCheap.bundleDiscount).toBe(100);
    expect(plusCheap.total).toBe(250);
    expectConsistent(plusCheap);
  });

  it("respeta el alcance por categoría (otras categorías no suman)", () => {
    const promo3x2 = x3x2({ scope: "categories", categoryIds: ["cat-remeras"] });
    const t = cart(
      [
        item({ variantId: "remera-s", qty: 1, listPrice: 1000 }),
        item({ variantId: "remera-m", qty: 1, listPrice: 1000 }),
        item({ variantId: "taza", productId: "taza", categoryIds: ["cat-cocina"], qty: 1, listPrice: 300 }),
      ],
      [promo3x2],
    );
    expect(t.promoTotal).toBe(0);
    const t2 = cart(
      [
        item({ variantId: "remera-s", qty: 2, listPrice: 1000 }),
        item({ variantId: "remera-m", qty: 1, listPrice: 1000 }),
        item({ variantId: "taza", productId: "taza", categoryIds: ["cat-cocina"], qty: 1, listPrice: 300 }),
      ],
      [promo3x2],
    );
    // Dos variantes del mismo producto cuentan juntas; a igual precio se bonifica la última del carrito.
    expect(t2.offers[0].amount).toBe(1000);
    expect(lineOf(t2, "remera-m").netTotal).toBe(0);
    expect(lineOf(t2, "taza").offer).toBeNull();
    expectConsistent(t2);
  });

  it("fuera de vigencia o pausada no aplica", () => {
    expect(cart([item({ qty: 3 })], [x3x2({ endsAt: "2026-09-01T00:00:00Z" })]).promoTotal).toBe(0);
    expect(cart([item({ qty: 3 })], [x3x2({ isActive: false })]).promoTotal).toBe(0);
  });
});

describe("Llevá 2, pagá 1", () => {
  it("2 unidades: una gratis; 5 unidades: dos gratis", () => {
    const two = cart([item({ qty: 2, listPrice: 1000 })], [x2x1()]);
    expect(lineOf(two).netTotal).toBe(1000);
    expect(two.offers[0].label).toBe("Promo 2x1");
    const five = cart([item({ qty: 5, listPrice: 600 })], [x2x1()]);
    expect(lineOf(five).netTotal).toBe(1800);
    expect(lineOf(five).offer?.units).toBe(2);
    expectConsistent(five);
  });
});

describe("2.ª unidad al 50 %", () => {
  it("1 unidad: sin descuento", () => {
    const t = cart([item({ qty: 1 })], [second50()]);
    expect(t.promoTotal).toBe(0);
    expect(lineOf(t).offer).toBeNull();
  });

  it("2 unidades: la 2.ª a mitad de precio", () => {
    const t = cart([item({ qty: 2, listPrice: 1000 })], [second50()]);
    expect(lineOf(t).netTotal).toBe(1500);
    expect(lineOf(t).offer).toMatchObject({ note: nb("2.ª unidad −50 %"), units: 1, amount: 500 });
    expect(t.offers[0].label).toBe(nb("Promo 2.ª al 50 %"));
    expectConsistent(t);
  });

  it("3 unidades: sólo una con descuento", () => {
    const t = cart([item({ qty: 3, listPrice: 900 })], [second50()]);
    expect(lineOf(t).netTotal).toBe(2250);
    expect(lineOf(t).offer?.units).toBe(1);
    expectConsistent(t);
  });

  it("5 unidades: dos con descuento", () => {
    const t = cart([item({ qty: 5, listPrice: 1000 })], [second50()]);
    expect(lineOf(t).netTotal).toBe(4000);
    expect(lineOf(t).offer?.note).toBe(nb("2 unidades −50 %"));
    expectConsistent(t);
  });

  it("la unidad con descuento es la más barata y su precio se redondea como el resto (hacia arriba al peso)", () => {
    const t = cart(
      [item({ variantId: "a", productId: "pa", qty: 1, listPrice: 1500 }), item({ variantId: "b", productId: "pb", qty: 1, listPrice: 999 })],
      [second50()],
    );
    // 999 × 50 % = 499,5 → 500 (roundPrice) → descuento 499.
    expect(lineOf(t, "b").unitPrice).toBe(999);
    expect(lineOf(t, "b").netTotal).toBe(500);
    expect(lineOf(t, "a").netTotal).toBe(1500);
    expect(t.offers[0].amount).toBe(499);
    expectConsistent(t);
  });

  it("2.ª al 33 % con precios enteros: el descuento es entero (roundPrice)", () => {
    const hundred = cart([item({ qty: 2, listPrice: 100 })], [second50({ value: 33 })]);
    // 100 × 67 % = 67 → descuento 33.
    expect(hundred.bundleDiscount).toBe(33);
    expect(hundred.total).toBe(167);
    expectWholePesos(hundred);
    const odd = cart([item({ qty: 2, listPrice: 999 })], [second50({ value: 33 })]);
    // 999 × 67 % = 669,33 → 670 (roundPrice) → descuento 329.
    expect(odd.bundleDiscount).toBe(329);
    expect(odd.total).toBe(1669);
    expectWholePesos(odd);
    expectConsistent(odd);
  });

  it("3.ª unidad al 100 %: equivale a un 3x2", () => {
    const t = cart([item({ qty: 3, listPrice: 900 })], [second50({ nth: 3, value: 100 })]);
    expect(lineOf(t).netTotal).toBe(1800);
    expect(lineOf(t).offer?.note).toBe("1 unidad gratis");
  });
});

describe("interacción con promos por unidad", () => {
  const off20 = (o: Partial<Promotion> = {}) => promo({ id: "u-20", name: "20 off", value: 20, ...o });

  it("no acumulables, misma prioridad: gana la que más descuenta en este carrito", () => {
    // 2 unidades: el 3x2 no bonifica nada → queda el 20 %.
    const two = cart([item({ qty: 2, listPrice: 900 })], [off20(), x3x2()]);
    expect(lineOf(two).netTotal).toBe(1440);
    expect(lineOf(two).promotion?.id).toBe("u-20");
    expect(two.offers).toEqual([]);
    // 3 unidades: 3x2 ($ 900) > 20 % ($ 540) → gana el 3x2 a precio de lista.
    const three = cart([item({ qty: 3, listPrice: 900 })], [off20(), x3x2()]);
    expect(lineOf(three).netTotal).toBe(1800);
    expect(lineOf(three).promotion).toBeNull();
    expect(three.offers[0].amount).toBe(900);
    expectConsistent(three);
    // 5 unidades: empate ($ 1.000 contra $ 1.000) → se queda la promo por unidad.
    const five = cart([item({ qty: 5 })], [off20(), x3x2()]);
    expect(lineOf(five).netTotal).toBe(4000);
    expect(lineOf(five).promotion?.id).toBe("u-20");
    expect(five.offers).toEqual([]);
  });

  it("no acumulables: la de mayor prioridad gana aunque descuente menos", () => {
    const unitFirst = cart([item({ qty: 3 })], [off20({ priority: 5 }), x3x2()]);
    expect(lineOf(unitFirst).netTotal).toBe(2400);
    expect(unitFirst.offers).toEqual([]);
    const qtyFirst = cart([item({ qty: 5 })], [off20(), x3x2({ priority: 5 })]);
    expect(lineOf(qtyFirst).netTotal).toBe(4000);
    expect(lineOf(qtyFirst).promotion).toBeNull();
    expect(qtyFirst.offers[0].amount).toBe(1000);
  });

  it("la línea que sólo suma unidades para el grupo conserva su promo por unidad", () => {
    const tenOnA = promo({ id: "u-10", name: "10 off A", value: 10, scope: "products", productIds: ["pa"] });
    const t = cart(
      [
        item({ variantId: "b", productId: "pb", qty: 3, listPrice: 1000 }),
        item({ variantId: "a", productId: "pa", qty: 1, listPrice: 1000 }),
      ],
      [tenOnA, x3x2({ priority: 1 })],
    );
    // Grupo [B, B, B]: sale gratis un B. A queda fuera del grupo completo: sigue con su 10 %.
    expect(lineOf(t, "b").offer).toMatchObject({ units: 1, amount: 1000 });
    expect(lineOf(t, "a").promotion?.id).toBe("u-10");
    expect(lineOf(t, "a").unitPrice).toBe(900);
    expect(lineOf(t, "a").offer).toMatchObject({ units: 0, note: "Suma para la Promo 3x2" });
    expect(t.total).toBe(2900);
    expectConsistent(t);
  });

  it("promo por cantidad con más prioridad que no bonifica nada no le saca la promo por unidad", () => {
    const t = cart([item({ qty: 2 })], [off20(), x3x2({ priority: 5 })]);
    expect(lineOf(t).netTotal).toBe(1600);
    expect(lineOf(t).promotion?.id).toBe("u-20");
  });

  it("acumulables: el 3x2 se calcula sobre el precio ya rebajado", () => {
    const t = cart([item({ qty: 3 })], [promo({ id: "u-10", value: 10, stackable: true }), x3x2({ stackable: true })]);
    const l = lineOf(t);
    expect(l.promotion?.id).toBe("u-10");
    expect(l.unitPrice).toBe(900);
    expect(l.offer).toMatchObject({ baseUnitPrice: 900, amount: 900 });
    expect(l.netTotal).toBe(1800);
    expect(t.promoTotal).toBe(1200);
    expect(t.offers[0].amount).toBe(900);
    expectConsistent(t);
  });

  it("sólo una de las dos acumulable: no se suman", () => {
    const t = cart([item({ qty: 3, listPrice: 900 })], [promo({ id: "u-10", value: 10, stackable: true }), x3x2()]);
    expect(lineOf(t).netTotal).toBe(1800);
    expect(lineOf(t).promotion).toBeNull();
  });

  it("la promo por unidad sigue en los productos fuera del alcance", () => {
    const t = cart(
      [
        item({ variantId: "remera", qty: 3, listPrice: 900 }),
        item({ variantId: "taza", productId: "taza", categoryIds: ["cat-cocina"], qty: 1, listPrice: 500 }),
      ],
      [off20(), x3x2({ scope: "categories", categoryIds: ["cat-remeras"] })],
    );
    expect(lineOf(t, "remera").netTotal).toBe(1800);
    expect(lineOf(t, "taza").netTotal).toBe(400);
    expect(lineOf(t, "taza").promotion?.id).toBe("u-20");
    expectConsistent(t);
  });

  it("dos promos por cantidad sobre las mismas unidades: gana la que más ahorra, no se suman", () => {
    const t = cart([item({ qty: 4 })], [x3x2(), x2x1()]);
    expect(lineOf(t).netTotal).toBe(2000);
    expect(t.offers.map((o) => o.id)).toEqual(["q-2x1"]);
  });
});

describe("totales en pesos enteros", () => {
  it("carritos variados con precios enteros no dejan centavos", () => {
    const prices = [100, 999, 1500, 37, 2499];
    const promos = [x3x2(), second50({ value: 33 }), x2x1({ scope: "products", productIds: ["p2"] })];
    for (let seed = 1; seed <= 40; seed++) {
      const items = prices.map((price, i) =>
        item({ variantId: `v${i}`, productId: `p${i}`, qty: ((seed * (i + 3)) % 5) + 1, listPrice: price }),
      );
      for (const promosSet of [[promos[0]], [promos[1]], promos]) {
        const t = cart(items, promosSet);
        expectWholePesos(t);
        expectConsistent(t);
      }
    }
  });
});

describe("cupón y medio de pago después de la promo por cantidad", () => {
  it("el cupón % se calcula sobre el total con 3x2 y el medio de pago sobre lo que queda", () => {
    const coupon: Coupon = { code: "HOLA", type: "percent", value: 10, scope: "all", categoryIds: [], productIds: [], isActive: true };
    const t = computeCart({
      items: [item({ qty: 3, listPrice: 900 })],
      promotions: [x3x2()],
      coupon,
      paymentMethod: { code: "transfer", discountPercent: 10 },
      now: NOW,
    });
    expect(t.promoTotal).toBe(900);
    expect(t.couponDiscount).toBe(180);
    expect(t.merchandiseTotal).toBe(1620);
    expect(t.paymentDiscount).toBe(162);
    expect(t.total).toBe(1458);
    expect(t.discountTotal).toBe(1242);
  });

  it("la compra mínima del cupón mira el total ya con la promo", () => {
    const coupon: Coupon = { code: "MIN", type: "fixed", value: 100, minSubtotal: 2500, scope: "all", categoryIds: [], productIds: [], isActive: true };
    const t = cart([item({ qty: 3, listPrice: 900 })], [x3x2()], { coupon });
    expect(t.coupon?.applied).toBe(false);
  });
});

describe("card y ficha (applyPromotions)", () => {
  it("no cambia el precio unitario y devuelve el badge y la línea de la ficha", () => {
    const r = applyPromotions({ id: "v", price: 1000 }, { id: "prod-a", categoryIds: [] }, [x3x2()], NOW);
    expect(r.price).toBe(1000);
    expect(r.compareAt).toBeNull();
    expect(r.offer).toMatchObject({ badge: "3x2", headline: "Llevá 3 y pagá 2", combinesWithPrice: true });
  });

  it("usa badge_label si lo hay", () => {
    const r = applyPromotions({ id: "v", price: 1000 }, { id: "prod-a", categoryIds: [] }, [second50({ badgeLabel: "Llevá 2" })], NOW);
    expect(r.offer?.badge).toBe("Llevá 2");
    expect(r.offer?.headline).toBe(nb("2.ª unidad con 50 % off"));
  });

  it("con una promo por unidad no acumulable: se muestra si su mejor caso ahorra más", () => {
    const product = { id: "prod-a", categoryIds: [] };
    const with20 = applyPromotions({ id: "v", price: 1000 }, product, [promo({ value: 20 }), x3x2()], NOW);
    expect(with20.price).toBe(800);
    expect(with20.offer).toMatchObject({ badge: "3x2", combinesWithPrice: false });
    const with50 = applyPromotions({ id: "v", price: 1000 }, product, [promo({ value: 50 }), x3x2()], NOW);
    expect(with50.offer).toBeNull();
    const stacked = applyPromotions({ id: "v", price: 1000 }, product, [promo({ value: 50, stackable: true }), x3x2({ stackable: true })], NOW);
    expect(stacked.offer?.combinesWithPrice).toBe(true);
  });

  it("fuera del alcance no hay oferta", () => {
    const r = applyPromotions({ id: "v", price: 1000 }, { id: "otro", categoryIds: [] }, [x3x2({ scope: "products", productIds: ["prod-a"] })], NOW);
    expect(r.offer).toBeNull();
  });
});

describe("tipos desconocidos y filas de la base", () => {
  const row = (o: Partial<PromotionRow>): PromotionRow => ({
    id: "r1",
    name: "Fila",
    type: "percent",
    value: 10,
    scope: "all",
    category_ids: [],
    product_ids: [],
    starts_at: null,
    ends_at: null,
    is_active: true,
    priority: 0,
    badge_label: null,
    stackable: false,
    ...o,
  });

  it("lee bxgy y nth_unit_percent desde config", () => {
    expect(promotionFromRow(row({ type: "bxgy", value: 0, config: { buy: 3, pay: 2 } }))).toMatchObject({ type: "bxgy", buy: 3, pay: 2 });
    expect(promotionFromRow(row({ type: "nth_unit_percent", value: 50, config: { nth: 2 } }))).toMatchObject({
      type: "nth_unit_percent",
      nth: 2,
      value: 50,
    });
  });

  it("un tipo desconocido o parámetros inválidos quedan 'unsupported' y el motor los ignora", () => {
    const unknown = promotionFromRow(row({ type: "combo", value: 50 }));
    const badBxgy = promotionFromRow(row({ id: "r2", type: "bxgy", value: 0, config: { buy: 2, pay: 2 } }));
    const noConfig = promotionFromRow(row({ id: "r3", type: "nth_unit_percent", value: 50 }));
    expect([unknown.type, badBxgy.type, noConfig.type]).toEqual(["unsupported", "unsupported", "unsupported"]);
    const t = cart([item({ qty: 4 })], [unknown, badBxgy, noConfig]);
    expect(t.promoTotal).toBe(0);
    expect(t.total).toBe(4000);
    expect(applyPromotions({ id: "v", price: 1000 }, { id: "prod-a", categoryIds: [] }, [unknown], NOW).price).toBe(1000);
  });

  it("parámetros inválidos armados a mano tampoco rompen", () => {
    const t = cart([item({ qty: 4 })], [x3x2({ buy: 2, pay: 3 }), second50({ nth: 1 }), second50({ id: "z", value: 0 })]);
    expect(t.promoTotal).toBe(0);
  });
});

describe("textos", () => {
  it("badge, ficha, carrito y admin", () => {
    expect(quantityBadge({ type: "bxgy", value: 0, buy: 4, pay: 3 })).toBe("4x3");
    expect(quantityBadge({ type: "nth_unit_percent", value: 50, nth: 2 })).toBe(nb("2.ª al 50 %"));
    expect(quantityHeadline({ type: "bxgy", value: 0, buy: 3, pay: 2 })).toBe("Llevá 3 y pagá 2");
    expect(quantityHeadline({ type: "nth_unit_percent", value: 100, nth: 2 })).toBe("La 2.ª unidad, gratis");
    expect(quantityLineNote({ type: "bxgy", value: 0, buy: 3, pay: 2 }, 2)).toBe("2 unidades gratis");
    expect(quantityDescription({ type: "bxgy", value: 0, buy: 3, pay: 2 })).toBe("Los clientes que lleven 3 pagan 2");
    expect(quantityDescription({ type: "nth_unit_percent", value: 50, nth: 2 })).toBe(
      nb("Los clientes que lleven 2 tienen 50 % de descuento en la 2.ª unidad"),
    );
  });
});
