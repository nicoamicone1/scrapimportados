import { netPrice, normalizePriceTiers, resolveVatPercent, type CartItemInput, type CartLine } from "@/lib/pricing";
import { roundMoney } from "@/lib/money";

/** Ítems del carrito (localStorage) → entrada del motor de precios. Puro. */
export function toPricingItems(
  items: {
    variantId: string;
    productId: string;
    categoryIds?: string[];
    qty: number;
    unitPrice: number;
    compareAtPrice?: number | null;
    priceTiers?: unknown;
  }[],
): CartItemInput[] {
  return items.map((i) => ({
    variantId: i.variantId,
    productId: i.productId,
    categoryIds: i.categoryIds ?? [],
    qty: i.qty,
    listPrice: i.unitPrice,
    compareAtPrice: i.compareAtPrice ?? null,
    // localStorage: se normaliza (un valor viejo o manipulado queda sin tramos).
    priceTiers: normalizePriceTiers(i.priceTiers ?? []),
  }));
}

/**
 * Total "sin impuestos nacionales" (Ley 27.743) de la mercadería: cada línea
 * con su alícuota (la del producto o la default). Proporcional a los
 * descuentos: se aplica sobre el importe final de la mercadería.
 */
export function netMerchandiseTotal(
  lines: Pick<CartLine, "variantId" | "lineTotal">[],
  items: { variantId: string; vatPercent?: number | null }[],
  defaultVat: number,
  merchandiseTotal: number,
): number {
  const gross = lines.reduce((acc, l) => acc + l.lineTotal, 0);
  if (gross <= 0) return 0;
  const vatBy = new Map(items.map((i) => [i.variantId, resolveVatPercent(i.vatPercent ?? null, defaultVat)]));
  const net = lines.reduce((acc, l) => acc + netPrice(l.lineTotal, vatBy.get(l.variantId) ?? defaultVat), 0);
  // Cupones: se reparten en proporción al importe de cada línea.
  return roundMoney(net * (merchandiseTotal / gross));
}
