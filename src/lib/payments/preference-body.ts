/*
 * Cuerpo de POST /checkout/preferences (puro, sin red: se testea).
 *
 * - Un solo ítem por el total del pedido: el total ya trae descuentos,
 *   cupón, promos y envío calculados por Ecommy; mandar las líneas sueltas
 *   haría que MP sume distinto por redondeos.
 * - `external_reference` = id del pedido: el webhook lo busca con eso.
 * - `marketplace_fee`: comisión de Ecommy según el plan (0 = no se manda).
 */

export interface PreferenceInput {
  order: { id: string; number: number; total: number; currency: string; expiresAt: string | null };
  storeId: string;
  storeName: string;
  payer: { name: string; email: string };
  /** URL absoluta de la página del pedido en la tienda (sin query). */
  orderUrl: string;
  notificationUrl: string;
  maxInstallments: number;
  binaryMode: boolean;
  statementDescriptor: string;
  feePercent: number;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function marketplaceFee(total: number, percent: number): number {
  if (!(percent > 0) || !(total > 0)) return 0;
  return round2((total * Math.min(percent, 10)) / 100);
}

/** Nombre en el resumen de la tarjeta: hasta 13, letras, números y espacios. */
export function cleanDescriptor(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 13)
    .trim();
}

function splitName(full: string): { name: string; surname: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { name: full.trim(), surname: "" };
  return { name: parts.slice(0, -1).join(" "), surname: parts[parts.length - 1] };
}

const isHttps = (url: string) => /^https:\/\//i.test(url);

export function buildPreferenceBody(input: PreferenceInput): Record<string, unknown> {
  const { order } = input;
  const back = (state: string) => `${input.orderUrl}?pago=${state}`;
  const fee = marketplaceFee(order.total, input.feePercent);
  const descriptor = cleanDescriptor(input.statementDescriptor || input.storeName);
  const { name, surname } = splitName(input.payer.name);
  const body: Record<string, unknown> = {
    items: [
      {
        id: order.id,
        title: `Pedido #${order.number} · ${input.storeName}`.slice(0, 250),
        quantity: 1,
        unit_price: round2(order.total),
        currency_id: order.currency || "ARS",
      },
    ],
    payer: { name, surname, email: input.payer.email },
    external_reference: order.id,
    back_urls: { success: back("ok"), pending: back("pendiente"), failure: back("error") },
    binary_mode: input.binaryMode,
    payment_methods: { installments: Math.min(Math.max(Math.trunc(input.maxInstallments) || 1, 1), 24) },
    metadata: { store_id: input.storeId, order_id: order.id, order_number: order.number },
  };
  // MP rechaza auto_return y notification_url que no sean https (dev local).
  if (isHttps(input.orderUrl)) body.auto_return = "approved";
  if (isHttps(input.notificationUrl)) body.notification_url = input.notificationUrl;
  if (descriptor) body.statement_descriptor = descriptor;
  if (fee > 0) body.marketplace_fee = fee;
  if (order.expiresAt && Date.parse(order.expiresAt) > Date.now()) {
    body.expires = true;
    body.expiration_date_to = new Date(order.expiresAt).toISOString();
  }
  return body;
}

/** Sólo se redirige a un checkout https de Mercado Pago. */
export function isMercadoPagoCheckoutUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)mercadopago\.com(\.[a-z]{2})?$/i.test(u.hostname);
  } catch {
    return false;
  }
}
