import { formatMoney } from "@/lib/money";

/**
 * Mensajes y links de WhatsApp (puro: server y client).
 *
 * `wa.me` trunca las URLs largas: los mensajes de pedido se acotan a
 * ~1.000 caracteres resumiendo los ítems y SIEMPRE llevan el link al pedido
 * (FEATURES-AUDIT §5.2.7).
 */

export const WA_MAX_MESSAGE = 1000;

/** Sólo dígitos (E.164 sin +). */
export function waPhone(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

/** `https://wa.me/<tel>?text=<mensaje>` (sin tel: el usuario elige el contacto). */
export function waLink(phone: string | null | undefined, text?: string): string {
  const digits = waPhone(phone);
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Reemplaza `{clave}` por su valor. Las claves desconocidas quedan vacías. */
export function fillTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === null || v === undefined ? "" : String(v);
  });
}

export interface WaOrderItem {
  name: string;
  variantTitle?: string | null;
  qty: number;
  total: number;
}

export interface WaOrderInput {
  template?: string | null;
  number: number | string;
  storeName: string;
  customerName: string;
  items: WaOrderItem[];
  total: number;
  /** "Envío a Av. Santa Fe 3253, CABA" / "Retiro en Local Palermo". */
  delivery: string;
  /** Método de pago ("Transferencia bancaria"). */
  payment?: string | null;
  /** URL absoluta de /pedido/[token]. */
  url: string;
  currency?: string;
  locale?: string;
}

export const DEFAULT_ORDER_TEMPLATE =
  "Hola. Hice el pedido #{number} en {store}.\n\n{items}\n\nTotal: {total}\n{delivery}\n\nNombre: {name}";

function itemLine(item: WaOrderItem, money: (v: number) => string): string {
  const variant = item.variantTitle ? ` (${item.variantTitle})` : "";
  return `- ${item.qty} x ${item.name}${variant}: ${money(item.total)}`;
}

/**
 * Mensaje del pedido para el vendedor. Variables de la plantilla:
 * `{number} {store} {items} {total} {delivery} {name} {payment} {url}`.
 * Si la plantilla no incluye `{url}`, el link se agrega al final.
 */
export function buildOrderMessage(input: WaOrderInput): string {
  const money = (v: number) => formatMoney(v, { currency: input.currency, locale: input.locale });
  const template = input.template?.trim() || DEFAULT_ORDER_TEMPLATE;
  const render = (items: string) => {
    let text = fillTemplate(template, {
      number: input.number,
      store: input.storeName,
      items,
      total: money(input.total),
      delivery: input.delivery,
      name: input.customerName,
      payment: input.payment ?? "",
      url: input.url,
    });
    if (!template.includes("{url}")) text += `\n\nVer pedido: ${input.url}`;
    return text.replace(/\n{3,}/g, "\n\n").trim();
  };

  const lines = input.items.map((i) => itemLine(i, money));
  let message = render(lines.join("\n"));
  // Demasiado largo: se muestran los primeros ítems y un resumen del resto.
  for (let keep = lines.length - 1; message.length > WA_MAX_MESSAGE && keep >= 1; keep--) {
    const rest = input.items.slice(keep).reduce((acc, i) => acc + i.qty, 0);
    message = render(`${lines.slice(0, keep).join("\n")}\n- y ${rest} unidad${rest === 1 ? "" : "es"} más (ver el pedido)`);
  }
  if (message.length > WA_MAX_MESSAGE) {
    const units = input.items.reduce((acc, i) => acc + i.qty, 0);
    message = render(`${units} producto${units === 1 ? "" : "s"} (detalle en el link)`);
  }
  return message;
}

/** Comprobante de transferencia: número, total y nombre. */
export function buildReceiptMessage(input: { number: number | string; total: number; customerName: string; storeName: string; currency?: string; locale?: string }): string {
  return `Hola. Te envío el comprobante de la transferencia del pedido #${input.number} en ${input.storeName} por ${formatMoney(input.total, {
    currency: input.currency,
    locale: input.locale,
  })}. Nombre: ${input.customerName}.`;
}

/** Consulta desde la ficha: "Hola, consulto por *Producto* https://…". */
export function buildProductMessage(template: string | null | undefined, product: { name: string; url: string }): string {
  const base = template?.trim() || "Hola. Tengo una consulta.";
  if (base.includes("{product}") || base.includes("{url}")) return fillTemplate(base, { product: product.name, url: product.url });
  return `Hola, consulto por *${product.name}* ${product.url}`;
}
