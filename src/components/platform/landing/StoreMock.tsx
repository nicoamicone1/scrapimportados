import { Menu, MessageCircle, Search, ShoppingBag } from "lucide-react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { priceWithDiscount } from "@/lib/pricing";
import { PRESETS, themeFontsHref, themeVars } from "@/lib/theme";

import { SAMPLE_ORDER } from "./sample-order";

/*
 * La tienda de ejemplo de la landing, «Luna Indumentaria» (docs/DEMO-ROPA.md),
 * dibujada en HTML/CSS con el preset Atelier real (`themeVars`: colores,
 * Cormorant Garamond + Jost, sin radios, botones rectos en mayúsculas). Va
 * dentro de `BrowserFrame` (hero) o de `PhoneFrame` (registro) en lugar de
 * una captura: la tienda demo de ropa todavía no tiene fotos, así que cada
 * producto es un plano de color con su nombre, como lo resuelve la tienda
 * cuando no hay foto.
 *
 * Escala sin JS: el contenedor es un container query y todo se mide en "px
 * virtuales" (`--u`, como `PresetThumb`). Con el marco ancho se ve la tienda
 * de computadora (4 columnas, menú arriba); con el marco angosto (< 400 px,
 * el hero en el celular), menú hamburguesa y 3 columnas para que entren
 * precios y chips; con `phone` (el teléfono del registro), las 2 columnas
 * de la tienda real en el celular.
 *
 * Los productos salen de `data/demo-ropa.json` (nombre, precio, color y
 * stock de la remera básica Negro / M y del tapado agotado; lo verifica
 * `StoreMock.test.ts`) más los dos del pedido de ejemplo (#1042), para que
 * la tienda, el chat y el recibo cuenten la misma compra.
 */

const ATELIER = PRESETS.atelier;

/** Nombre y anuncio de la tienda demo de ropa (data/demo-ropa.json › store). */
export const LUNA = {
  name: "Luna Indumentaria",
  transferPercent: SAMPLE_ORDER.transferPercent,
} as const;

export interface MockProduct {
  name: string;
  price: number;
  compareAt?: number;
  /** Color del plano (las muestras de color del catálogo). */
  color: string;
  /** Texto sobre el plano: claro sobre colores oscuros. */
  dark?: boolean;
  /** Lo que se lee en el plano (la prenda). */
  label: string;
  /** Stock bajo de UNA variante: "Quedan 2" en Negro · M. */
  low?: { stock: number; variant: string };
  soldOut?: boolean;
}

const [remera, pantalon] = SAMPLE_ORDER.items;

/**
 * Orden pensado para el hero: lo que importa queda a la izquierda, porque a
 * la derecha se apoya el celular con el pedido.
 */
export const LUNA_PRODUCTS: readonly MockProduct[] = [
  { name: remera.name, price: remera.total, color: "#1B1A18", dark: true, label: "Remera" },
  { name: "Remera básica de algodón", price: 26000, color: "#F4F2EE", label: "Remera", low: { stock: 2, variant: "Negro · M" } },
  { name: "Tapado de paño largo", price: 158000, color: "#857B72", dark: true, label: "Tapado", soldOut: true },
  { name: pantalon.name, price: pantalon.total, color: "#D8C7A8", label: "Pantalón" },
  { name: "Vestido camisero de lino", price: 89000, color: "#EAE2D2", label: "Vestido" },
  { name: "Buzo cuello redondo de frisa", price: 59000, compareAt: 66000, color: "#1F2A44", dark: true, label: "Buzo" },
];

/** Largo en px virtuales → CSS que escala con el ancho del marco. */
const u = (n: number) => `calc(var(--u) * ${n})`;

const HEADING: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: "var(--heading-weight)" as CSSProperties["fontWeight"],
  lineHeight: 1.05,
};

const STRONG = { fontWeight: "var(--body-strong-weight)" as CSSProperties["fontWeight"] };

/** Hoja de Google Fonts del preset (la pide `LazyFontSheets` al acercarse). */
export const LUNA_FONTS_HREF = themeFontsHref(ATELIER);

const money = (v: number) => formatMoney(Math.round(v), { decimals: 0 });

function Card({ product }: { product: MockProduct }) {
  const transfer = product.soldOut ? null : priceWithDiscount(product.price, LUNA.transferPercent);
  const onSale = !product.soldOut && product.compareAt != null && product.compareAt > product.price;
  return (
    <li className="min-w-0">
      <div
        aria-hidden
        className="relative flex items-center justify-center"
        style={{
          aspectRatio: "4 / 5",
          background: product.color,
          boxShadow: product.dark ? undefined : "inset 0 0 0 1px var(--border)",
          opacity: product.soldOut ? 0.55 : undefined,
        }}
      >
        <span style={{ ...HEADING, fontStyle: "italic", fontSize: u(17), color: product.dark ? "rgb(250 248 244 / 0.82)" : "rgb(27 26 24 / 0.62)" }}>{product.label}</span>
      </div>
      {/* Chips sobre el plano (fuera del aria-hidden: se leen). */}
      <div className="relative" style={{ marginTop: `calc(${u(-25)})`, height: u(25), paddingLeft: u(7) }}>
        {product.low ? (
          <span className="inline-block tracking-[0.08em] whitespace-nowrap uppercase" style={{ ...STRONG, background: "var(--bg)", color: "var(--fg)", fontSize: u(7.5), padding: `${u(3)} ${u(6)}` }}>
            Quedan {product.low.stock}
            <span className="tracking-normal normal-case @max-[400px]:sr-only" style={{ fontWeight: "var(--body-weight)" as CSSProperties["fontWeight"] }}>
              {" "}
              · {product.low.variant}
            </span>
          </span>
        ) : product.soldOut ? (
          <span className="inline-block tracking-[0.08em] uppercase" style={{ ...STRONG, background: "var(--fg)", color: "var(--bg)", fontSize: u(7.5), padding: `${u(3)} ${u(6)}` }}>
            Agotado
          </span>
        ) : null}
      </div>
      <p className="line-clamp-2" style={{ marginTop: u(8), fontSize: u(10.5), lineHeight: 1.3, minHeight: "2.6em" }}>
        {product.name}
      </p>
      <p className="tnum flex flex-wrap items-baseline" style={{ marginTop: u(3), columnGap: u(5), fontSize: u(11.5), ...STRONG }}>
        <span style={{ color: product.soldOut ? "var(--fg-muted)" : onSale ? "var(--accent)" : "var(--fg)" }}>
          <span className="sr-only">Precio: </span>
          {money(product.price)}
        </span>
        {onSale ? (
          <s style={{ fontSize: u(9), color: "var(--fg-muted)", fontWeight: "var(--body-weight)" as CSSProperties["fontWeight"] }}>
            <span className="sr-only">Antes: </span>
            {money(product.compareAt!)}
          </s>
        ) : null}
      </p>
      {transfer != null ? (
        <p className="tnum" style={{ marginTop: u(2), fontSize: u(9), color: "var(--fg-muted)" }}>
          {money(transfer)} con transferencia
        </p>
      ) : (
        <p
          className="flex items-center justify-center text-center tracking-[0.08em] uppercase"
          style={{ ...STRONG, marginTop: u(6), minHeight: u(24), padding: `${u(4)} ${u(6)}`, gap: u(5), border: "1px solid var(--fg)", fontSize: u(7), lineHeight: 1.15 }}
        >
          <MessageCircle aria-hidden strokeWidth={1.5} className="shrink-0" style={{ width: u(10), height: u(10) }} />
          Consultar por WhatsApp
        </p>
      )}
    </li>
  );
}

/**
 * La tienda demo de ropa en HTML. `className` va al contenedor (el marco le
 * da el alto; lo que no entra se corta, como una captura).
 */
export function StoreMock({ className, address, phone }: { className?: string; address?: string; /** Pantalla de celular: 2 columnas, como la tienda real en el teléfono. */ phone?: boolean }) {
  const vars = themeVars({ ...ATELIER, custom_css: undefined }) as CSSProperties;
  return (
    <div className={cn("@container size-full overflow-hidden", className)} data-font-sheet={LUNA_FONTS_HREF ?? undefined}>
      <div
        role="group"
        aria-label={`Tienda de ejemplo ${LUNA.name}${address ? `, en ${address}` : ""}`}
        className={cn("relative size-full select-none", phone ? "[--u:calc(100cqw/300)]" : "[--u:calc(100cqw/540)] @max-[400px]:[--u:calc(100cqw/330)]")}
        style={{ ...vars, background: "var(--bg)", color: "var(--fg)", fontFamily: "var(--font-body)", fontWeight: "var(--body-weight)" as CSSProperties["fontWeight"], lineHeight: 1.3 }}
      >
        {/* Anuncio */}
        <p className="truncate text-center" style={{ height: u(22), lineHeight: u(22), background: "var(--secondary)", fontSize: u(9), paddingInline: u(10) }}>
          {LUNA.transferPercent} % de descuento pagando por transferencia
          <span className="@max-[400px]:hidden"> · Envíos en CABA y retiro en Palermo</span>
        </p>

        {/* Header: logo al centro (Atelier) */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center" style={{ height: u(52), paddingInline: u(22), borderBottom: "1px solid var(--border)" }}>
          <span aria-hidden className="flex min-w-0 items-center tracking-[0.14em] uppercase" style={{ gap: u(14), fontSize: u(8) }}>
            <Menu className="@min-[400px]:hidden" strokeWidth={1.5} style={{ width: u(16), height: u(16) }} />
            <span className="@max-[400px]:hidden">Remeras</span>
            <span className="@max-[400px]:hidden">Vestidos</span>
          </span>
          <p className="whitespace-nowrap" style={{ ...HEADING, fontSize: u(23) }}>
            {LUNA.name}
          </p>
          <span aria-hidden className="flex items-center justify-end" style={{ gap: u(12) }}>
            <Search strokeWidth={1.5} style={{ width: u(13), height: u(13) }} />
            <ShoppingBag strokeWidth={1.5} style={{ width: u(13), height: u(13) }} />
          </span>
        </div>

        {/* Título de sección centrado (Atelier) */}
        <p aria-hidden className="flex items-center justify-center" style={{ ...HEADING, gap: u(12), fontSize: u(18), paddingBlock: `${u(16)} ${u(12)}` }}>
          <span className="block h-px bg-[var(--border)]" style={{ width: u(44) }} />
          Novedades
          <span className="block h-px bg-[var(--border)]" style={{ width: u(44) }} />
        </p>

        <ul className={cn("grid", phone ? "grid-cols-2" : "grid-cols-4 @max-[400px]:grid-cols-3")} style={{ paddingInline: u(22), columnGap: u(12), rowGap: u(18) }}>
          {LUNA_PRODUCTS.map((p) => (
            <Card key={p.name} product={p} />
          ))}
        </ul>

        {/* Botón flotante de WhatsApp de la tienda (WhatsAppFab, a la izquierda). En el hero
            angosto no entra: ahí el WhatsApp es el celular con el pedido. */}
        <span
          className={cn("absolute flex items-center justify-center rounded-full", !phone && "@max-[400px]:hidden")}
          style={{ left: u(14), bottom: u(14), width: u(34), height: u(34), background: "var(--primary)", color: "var(--primary-fg)", boxShadow: "0 8px 20px -10px rgb(27 26 24 / 0.6)" }}
        >
          <MessageCircle aria-hidden strokeWidth={1.75} style={{ width: u(16), height: u(16) }} />
          <span className="sr-only">Escribinos por WhatsApp</span>
        </span>
      </div>
    </div>
  );
}
