import { formatMoney } from "@/lib/money";

import { renderEmail, type Block, type EmailContent, type Inline } from "../layout";
import { clipText, storeBrand } from "./shared";
import type { StoreEmailInfo } from "./types";

/*
 * "Volvió el stock" (aviso único al comprador que se anotó en la ficha).
 *
 * El alta es pública (cualquiera escribe cualquier email), así que el mail
 * sólo lleva contenido de la tienda: nombre del producto, variantes, precio
 * y el link a la ficha. Nada que haya tipeado el visitante.
 */

export interface StockBackVariant {
  /** "Talle M · Negro" o null (producto sin opciones). */
  label: string | null;
  /** Precio actual (con promociones aplicadas). */
  price: number;
  /** Precio anterior tachado, si es mayor al actual. */
  compareAt: number | null;
}

export interface StockBackEmailData {
  productName: string;
  /** Ficha absoluta (con `?variant=` si volvió una sola variante). */
  productUrl: string;
  variants: StockBackVariant[];
  currency: string;
  locale: string;
}

/** Variantes que se nombran en el mail; el resto se resume ("y 3 más"). */
const MAX_LISTED = 6;

function stockFooter(store: StoreEmailInfo): (Inline | Inline[])[] {
  const contact: Inline[] = [];
  if (store.contactEmail) contact.push("Respondé este mail para hablar con la tienda");
  if (store.whatsappUrl) {
    contact.push(store.contactEmail ? " o escribí por " : "Escribí a la tienda por ");
    contact.push({ href: store.whatsappUrl, label: "WhatsApp" });
  }
  if (contact.length) contact.push(".");
  return [
    `Recibís este mail porque pediste en ${store.name} que te avisemos cuando hubiera stock. Es un aviso único: no te vamos a volver a escribir por este producto.`,
    ...(contact.length ? [contact] : []),
    [{ href: store.url, label: store.url.replace(/^https?:\/\//, "") }, " · Tienda hecha con Ecommy"],
  ];
}

export function stockBackEmail(data: StockBackEmailData, store: StoreEmailInfo): EmailContent {
  const money = (v: number) => formatMoney(v, { currency: data.currency, locale: data.locale });
  const product = clipText(data.productName, 80);
  const variants = data.variants.length ? data.variants : [{ label: null, price: 0, compareAt: null }];
  const single = variants.length === 1 ? variants[0] : null;
  const label = single?.label ? clipText(single.label, 60) : null;
  const what = label ? `${product} ${label}` : product;

  const subject = `Volvió el stock de ${what}`;
  const lowest = Math.min(...variants.map((v) => v.price));
  const preheader = single
    ? `Ya se puede comprar a ${money(single.price)} en ${store.name}.`
    : `Volvieron ${variants.length} opciones desde ${money(lowest)} en ${store.name}.`;

  const priceBlocks: Block[] = single
    ? [
        {
          t: "rows",
          rows: [
            ...(label ? [{ label: "Opción", value: label }] : []),
            { label: "Precio", value: money(single.price) },
            ...(single.compareAt && single.compareAt > single.price ? [{ label: "Antes", value: money(single.compareAt) }] : []),
          ],
        },
      ]
    : [
        {
          t: "items",
          items: variants.slice(0, MAX_LISTED).map((v) => ({
            name: v.label ? clipText(v.label, 60) : product,
            detail: v.compareAt && v.compareAt > v.price ? `Antes ${money(v.compareAt)}` : null,
            amount: money(v.price),
          })),
        },
        variants.length > MAX_LISTED && {
          t: "p",
          muted: true,
          content: `Y ${variants.length - MAX_LISTED} ${variants.length - MAX_LISTED === 1 ? "opción más" : "opciones más"} en la tienda.`,
        },
      ].filter(Boolean) as Block[];

  return renderEmail({
    subject,
    preheader,
    brand: storeBrand(store),
    blocks: [
      { t: "heading", text: "Volvió el stock" },
      {
        t: "p",
        content: [
          "Te anotaste para que te avisemos cuando volviera ",
          { b: what },
          single ? ". Ya se puede comprar." : ". Ya se pueden comprar estas opciones:",
        ],
      },
      ...priceBlocks,
      { t: "button", href: data.productUrl, label: "Ver el producto" },
      {
        t: "p",
        muted: true,
        content: "El stock no se reserva con este aviso: lo compra quien llegue primero. El precio puede cambiar.",
      },
    ],
    footer: stockFooter(store),
  });
}
