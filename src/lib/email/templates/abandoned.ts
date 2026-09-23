import { formatMoney } from "@/lib/money";

import { renderEmail, type Block, type EmailContent, type Inline } from "../layout";
import { clipText, greeting, plural, storeBrand } from "./shared";
import type { StoreEmailInfo } from "./types";

/*
 * "Dejaste tu pedido a mitad de camino" (carritos abandonados, migración 0020).
 *
 * Aviso ÚNICO a quien tildó "Avisame por mail si dejo el pedido sin terminar"
 * en el checkout. Lo firma la tienda. Como el checkout es público, el mail
 * sólo lleva contenido de la tienda (nombres y precios de sus productos, que
 * salen de la base) y el nombre de pila si parece un nombre (`greeting`). Sin
 * urgencia inventada ("¡últimas unidades!"), sin descuentos que la tienda no
 * ofreció y con la baja a un clic en el pie (y en `List-Unsubscribe`, ver
 * abandoned-notices.ts).
 */

export interface AbandonedItem {
  /** "Remera básica · Negro / M" (producto + variante, desde la base). */
  name: string;
  qty: number;
  /** Precio de lista de HOY por unidad. */
  unitPrice: number;
}

export interface AbandonedEmailData {
  /** Nombre que escribió en el checkout (sólo se usa si parece un nombre de pila). */
  customerName: string | null;
  items: AbandonedItem[];
  currency: string;
  locale: string;
  /** `/carrito/recuperar/<token>` absoluto (la ruta pasa el token a una cookie y redirige a `/carrito`). */
  recoverUrl: string;
  /** `/carrito/recuperar/<token>?baja=1` absoluto (confirma la baja con un botón). */
  unsubscribeUrl: string;
}

/** Datos legales de la tienda para el pie (Configuración › Impuestos y legales). */
export interface StoreLegalInfo {
  razonSocial?: string | null;
  cuit?: string | null;
}

/** Ítems que se nombran en el mail; el resto se resume ("y 3 productos más"). */
const MAX_LISTED = 8;

export function abandonedTotal(items: readonly AbandonedItem[]): number {
  return items.reduce((acc, i) => acc + i.unitPrice * i.qty, 0);
}

export function abandonedFooter(store: StoreEmailInfo, unsubscribeUrl: string, legal: StoreLegalInfo = {}): (Inline | Inline[])[] {
  const contact: Inline[] = [];
  if (store.contactEmail) contact.push("Respondé este mail para hablar con la tienda");
  if (store.whatsappUrl) {
    contact.push(store.contactEmail ? " o escribí por " : "Escribí a la tienda por ");
    contact.push({ href: store.whatsappUrl, label: "WhatsApp" });
  }
  if (contact.length) contact.push(".");
  const legalLine = [clipText(legal.razonSocial, 120), legal.cuit ? `CUIT ${clipText(legal.cuit, 20)}` : ""].filter(Boolean).join(" · ");
  return [
    `Recibís este mail porque dejaste tu email en el checkout de ${store.name} y pediste que te avisemos si el pedido quedaba sin terminar. Es un aviso único por este carrito.`,
    [{ href: unsubscribeUrl, label: "No quiero recibir estos avisos" }],
    ...(contact.length ? [contact] : []),
    ...(legalLine ? [legalLine] : []),
    [{ href: store.url, label: store.url.replace(/^https?:\/\//, "") }, " · Tienda hecha con Ecommy"],
  ];
}

export function abandonedCartEmail(data: AbandonedEmailData, store: StoreEmailInfo, legal: StoreLegalInfo = {}): EmailContent {
  const money = (v: number) => formatMoney(v, { currency: data.currency, locale: data.locale });
  const items = data.items.filter((i) => i.qty > 0);
  const units = items.reduce((acc, i) => acc + i.qty, 0);
  const total = abandonedTotal(items);
  const listed = items.slice(0, MAX_LISTED);
  const rest = items.length - listed.length;

  const blocks: Block[] = [
    { t: "heading", text: "Dejaste tu pedido a mitad de camino" },
    { t: "p", content: greeting(data.customerName) },
    {
      t: "p",
      content: [
        "Guardamos lo que tenías en el carrito de ",
        { b: store.name },
        ". Si todavía lo querés, lo terminás en un par de pasos: el carrito se arma solo con lo que ves acá.",
      ],
    },
    {
      t: "items",
      items: listed.map((i) => ({
        name: clipText(i.name, 90),
        detail: `${i.qty} × ${money(i.unitPrice)}`,
        amount: money(i.unitPrice * i.qty),
      })),
    },
  ];
  if (rest > 0) blocks.push({ t: "p", muted: true, content: `Y ${plural(rest, "producto más", "productos más")} en el carrito.` });
  blocks.push(
    { t: "totals", rows: [{ label: `Total (${plural(units, "unidad", "unidades")})`, value: money(total), strong: true }] },
    { t: "button", href: data.recoverUrl, label: "Terminar mi pedido" },
    {
      t: "p",
      muted: true,
      content:
        "Son los precios de hoy. Las promociones, el envío y el descuento por medio de pago se calculan al terminar el pedido. El stock no se reserva hasta que lo confirmes.",
    },
  );

  return renderEmail({
    subject: `Dejaste tu pedido a mitad de camino en ${store.name}`,
    preheader: `Tu carrito: ${plural(units, "producto", "productos")} por ${money(total)}.`,
    brand: storeBrand(store),
    blocks,
    footer: abandonedFooter(store, data.unsubscribeUrl, legal),
  });
}
