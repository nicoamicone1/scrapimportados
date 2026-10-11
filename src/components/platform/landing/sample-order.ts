/**
 * El pedido de ejemplo de toda la landing (#1042): mismos números en el chat,
 * el recibo, el antes/después, las respuestas listas, el checkout y la tienda
 * de ejemplo del hero (`StoreMock`). Es de ropa (docs/gtm/PLAN-GTM.md §3):
 * cada ítem con su talle, como lo arma la tienda (`variantTitle` entre
 * paréntesis en el mensaje de WhatsApp). La tienda es la demo de ropa,
 * «Luna Indumentaria» (docs/DEMO-ROPA.md).
 */
export const SAMPLE_ORDER = {
  number: 1042,
  store: "Luna Indumentaria",
  customer: "Rosa Quiroga",
  items: [
    { name: "Remera oversize negra", variantTitle: "M", qty: 1, total: 18900 },
    { name: "Pantalón wide beige", variantTitle: "38", qty: 1, total: 26500 },
  ],
  transferPercent: 10,
  shipping: { label: "Envío CABA", price: 3200, line: "Envío a Av. Corrientes 4120, CABA" },
};

/** "Remera oversize negra · M" (nombre y talle, como en el recibo). */
export function sampleItemLabel(item: { name: string; variantTitle?: string | null }): string {
  return item.variantTitle ? `${item.name} · ${item.variantTitle}` : item.name;
}

export function sampleTotals() {
  const subtotal = SAMPLE_ORDER.items.reduce((a, i) => a + i.total, 0);
  const discount = Math.round((subtotal * SAMPLE_ORDER.transferPercent) / 100);
  return { subtotal, discount, total: subtotal - discount + SAMPLE_ORDER.shipping.price };
}
