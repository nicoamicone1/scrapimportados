import type { Block, BlockOf, BlockStyle, BlockType } from "@/lib/blocks/schema";

/*
 * Portada a medida de la demo «Luna Indumentaria» (ropa por fases). Son
 * bloques comunes del constructor (los mismos que puede armar cualquier dueño
 * desde el panel): la usa el seed (`scripts/seed-demo-ropa.mts`, con los ids
 * reales de las categorías) y la vista previa local (`isLunaDevPreview`, sin
 * ids). Todo lo que depende de la fecha (fase de hoy, próxima luna nueva) sale
 * de `opts.now`; lo que depende de la tienda (descuento, envío gratis,
 * WhatsApp), de `opts`.
 */

// ---------------------------------------------------------------------------
// Luna nueva
// ---------------------------------------------------------------------------

/** Mes sinódico medio, en días. */
export const SYNODIC_MONTH_DAYS = 29.530588853;
/** Luna nueva de referencia (k = 0 en Meeus): 2000-01-06 18:14 UTC. */
export const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

const DAY_MS = 86_400_000;
const RAD = Math.PI / 180;

/**
 * Instante (ms UTC) de la luna nueva número `k` contada desde la de
 * referencia: el mes sinódico medio más los términos periódicos principales
 * de Meeus («Astronomical Algorithms», cap. 49). Error de un par de minutos
 * en este siglo; sin ellos, la media se corre hasta ±17 h.
 */
export function newMoonAt(k: number): number {
  const T = k / 1236.85;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const M = (2.5534 + 29.1053567 * k) * RAD;
  const Mp = (201.5643 + 385.81693528 * k) * RAD;
  const F = (160.7108 + 390.67050284 * k) * RAD;
  const O = (124.7746 - 1.56375588 * k) * RAD;
  const jde =
    2451550.09766 +
    29.530588861 * k +
    0.00015437 * T * T -
    0.4072 * Math.sin(Mp) +
    0.17241 * E * Math.sin(M) +
    0.01608 * Math.sin(2 * Mp) +
    0.01039 * Math.sin(2 * F) +
    0.00739 * E * Math.sin(Mp - M) -
    0.00514 * E * Math.sin(Mp + M) +
    0.00208 * E * E * Math.sin(2 * M) -
    0.00111 * Math.sin(Mp - 2 * F) -
    0.00057 * Math.sin(Mp + 2 * F) +
    0.00056 * E * Math.sin(2 * Mp + M) -
    0.00042 * Math.sin(3 * Mp) +
    0.00042 * E * Math.sin(M + 2 * F) +
    0.00038 * E * Math.sin(M - 2 * F) -
    0.00024 * E * Math.sin(2 * Mp - M) -
    0.00017 * Math.sin(O);
  // JDE (tiempo terrestre) → Unix ms, menos ΔT (~69 s).
  return (jde - 2440587.5) * DAY_MS - 69_000;
}

/** Índice de la última luna nueva anterior (o igual) a `now`. */
function lunationIndex(now: Date): number {
  let k = Math.floor((now.getTime() - REFERENCE_NEW_MOON) / (SYNODIC_MONTH_DAYS * DAY_MS));
  while (newMoonAt(k + 1) <= now.getTime()) k++;
  while (newMoonAt(k) > now.getTime()) k--;
  return k;
}

/** La próxima luna nueva estrictamente después de `now`. */
export function nextNewMoon(now: Date): Date {
  return new Date(newMoonAt(lunationIndex(now) + 1));
}

export type MoonPhase = "nueva" | "creciente" | "llena" | "menguante";

/** Fase de la luna en `now`, en cuatro tramos (± 1 día alrededor de nueva y llena). */
export function moonPhase(now: Date): MoonPhase {
  const k = lunationIndex(now);
  const age = (now.getTime() - newMoonAt(k)) / DAY_MS;
  const toNext = (newMoonAt(k + 1) - now.getTime()) / DAY_MS;
  const half = SYNODIC_MONTH_DAYS / 2;
  if (age < 1 || toNext < 1) return "nueva";
  if (age < half - 1) return "creciente";
  if (age < half + 1) return "llena";
  return "menguante";
}

const PHASE_LABEL: Record<MoonPhase, string> = {
  nueva: "luna nueva",
  creciente: "luna creciente",
  llena: "luna llena",
  menguante: "luna menguante",
};

// ---------------------------------------------------------------------------
// Portada
// ---------------------------------------------------------------------------

export interface LunaHomeOptions {
  now: Date;
  /** % de descuento por transferencia (0 = no se menciona). */
  transferDiscount: number;
  /** ¿La tienda atiende por WhatsApp? */
  whatsapp: boolean;
  /**
   * Ids de categoría por slug (`remeras` → uuid). Con ellos, «Elegí por
   * prenda» muestra las 6 en el orden de la marca; sin ellos, `all` (las
   * raíz con productos, en su orden).
   */
  categoryIds?: Record<string, string>;
  /** Envío gratis desde (null, undefined o Infinity = no se menciona). */
  freeShippingFrom?: number | null;
  /** Zona horaria para las fechas del copy. */
  timeZone?: string;
}

/** Categorías de «Elegí por prenda», en el orden de data/demo-ropa.json (el mismo que `all` en la vista previa). */
export const LUNA_CATEGORY_ORDER = ["remeras", "buzos-y-camperas", "pantalones", "vestidos", "camisas", "accesorios"] as const;

const ASSET = (file: string) => `/demo/luna/${file}`;

type Settings<T extends BlockType> = BlockOf<T>["settings"];

function block<T extends BlockType>(id: string, type: T, settings: Settings<T>, style: Partial<BlockStyle> = {}): BlockOf<T> {
  const base: BlockStyle = { background: "default", paddingY: "md", container: "normal" };
  return { id: `luna-${id}`, type, style: { ...base, ...style }, settings } as BlockOf<T>;
}

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} %`;
const money = (n: number) => `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n)}`;

/** «lunes 9/11» en la zona horaria de la tienda. */
function shortDate(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "numeric", timeZone }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")}/${get("month")}`;
}

/**
 * Portada editorial de Luna: 13 bloques que cuentan «ropa por fases» y usan
 * casi todo el repertorio. Bandas noche (`primary`) alternadas con el fondo
 * claro y `surface`. Siempre válida para `blockSchema`; sin `categoryIds` no
 * necesita ningún UUID.
 */
export function lunaHomeBlocks(opts: LunaHomeOptions): Block[] {
  const tz = opts.timeZone || "America/Argentina/Buenos_Aires";
  const discount = Math.max(0, Math.min(opts.transferDiscount, 50));
  const freeFrom = opts.freeShippingFrom && Number.isFinite(opts.freeShippingFrom) && opts.freeShippingFrom > 0 ? opts.freeShippingFrom : null;
  const next = nextNewMoon(opts.now);
  const nextLabel = shortDate(next, tz);
  const phase = PHASE_LABEL[moonPhase(opts.now)];

  const ids = opts.categoryIds ?? {};
  const orderedCats = LUNA_CATEGORY_ORDER.map((slug) => ids[slug]).filter((id): id is string => Boolean(id));
  const categoryIds: Settings<"category_list">["categoryIds"] = orderedCats.length ? orderedCats : "all";

  const shippingLine = freeFrom ? `Envío gratis en CABA desde ${money(freeFrom)}` : "Envíos en moto por CABA";

  return [
    // 1 · Tira chica con los datos de compra (banda noche).
    block(
      "datos",
      "marquee",
      {
        items: [
          ...(discount > 0 ? [`${pct(discount)} off pagando por transferencia`] : []),
          shippingLine,
          "Cambios dentro de los 30 días",
          `Próxima tirada: luna nueva del ${nextLabel}`,
        ],
        size: "sm",
        speed: "normal",
      },
      { background: "primary", paddingY: "none", container: "full" },
    ),

    // 2 · Portada a sangre: el texto a la izquierda, sobre la zona oscura de la ilustración.
    block(
      "portada",
      "hero",
      {
        layout: "cover",
        products: null,
        eyebrow: `Ropa por fases · hoy, ${phase}`,
        title: "Una tirada por luna",
        subtitle: "Cosemos series cortas en Palermo, una por ciclo lunar. Cuando se termina una fase, esa prenda no vuelve.",
        imageUrl: ASSET("hero.svg"),
        imageUrlMobile: ASSET("hero-mobile.svg"),
        imageAlt: "Noche sobre Palermo con la luna creciente",
        // Leve: la ilustración ya deja la izquierda oscura; esto sólo asegura el contraste del texto.
        overlay: 20,
        align: "left",
        height: "lg",
        cta: { label: "Ver la colección", href: "/productos" },
        cta2: { label: "Cómo funciona", href: "#como-comprar" },
      },
      { paddingY: "none", container: "full" },
    ),

    // 3 · Categorías en arco (la forma la pone el tema / CSS de Luna).
    block("prendas", "category_list", { title: "Elegí por prenda", categoryIds, style: "cards", columns: 6 }, { paddingY: "lg" }),

    // 4 · Llena: los más vendidos, con protagonista.
    block(
      "llena",
      "product_grid",
      {
        title: "Llena · lo que más sale",
        subtitle: "Las que se agotan primero en cada tirada. Si ves tu talle, no lo pienses mucho.",
        source: { kind: "featured", limit: 5 },
        viewAllHref: "/productos",
        columns: 4,
        highlight: "first",
      },
      { paddingY: "md" },
    ),

    // 5 · Creciente: la colección de esta luna.
    block(
      "creciente",
      "lookbook",
      {
        eyebrow: "Fase 02 · Creciente",
        title: "La colección de esta luna",
        text: "Lino, fibrana y algodón peinado en tonos de noche clara. Hay pocas unidades por talle y no repetimos telas.",
        imageUrl: ASSET("lookbook-creciente.svg"),
        imageAlt: "Ilustración de la colección creciente: vestido de lino y camisa holgada",
        imagePosition: "left",
        source: { kind: "newest", limit: 4 },
        cta: { label: "Ver toda la tirada", href: "/productos" },
      },
      { background: "surface", paddingY: "lg" },
    ),

    // 6 · Las fases, gigantes (banda noche que sigue en la cuenta regresiva).
    block(
      "fases",
      "marquee",
      { items: ["Luna nueva", "Creciente", "Luna llena", "Menguante"], size: "lg", speed: "slow" },
      { background: "primary", paddingY: "none", container: "full" },
    ),

    // 7 · Luna nueva: cuánto falta para la próxima tirada.
    block(
      "luna-nueva",
      "countdown",
      {
        title: "Luna nueva: próxima tirada",
        endsAt: next.toISOString(),
        text: `El ${nextLabel} sube la serie nueva. Son pocas unidades por talle y la primera noche se va la mitad.`,
        expiredText: "La tirada de luna nueva ya está online.",
        cta: { label: "Ver lo nuevo", href: "/productos" },
        layout: "banner",
      },
      { background: "primary", paddingY: "lg" },
    ),

    // 8 · El taller.
    block(
      "taller",
      "image_text",
      {
        imageUrl: ASSET("taller.svg"),
        imagePosition: "right",
        layout: "overlap",
        eyebrow: "El taller",
        title: "Hecho en Palermo, de a poco",
        html:
          "<p>Cortamos y cosemos en un taller de Palermo, a dos cuadras del local donde retirás tu pedido.</p>" +
          "<p>Trabajamos con rollos de fin de serie de fábricas textiles argentinas: cuando se termina una tela, esa prenda no se repite. Por eso las tiradas son cortas y cada luna trae algo distinto.</p>",
      },
      { paddingY: "lg" },
    ),

    // 9 · Menguante: lo que queda, con precio de fin de ciclo.
    block(
      "menguante",
      "product_slider",
      {
        title: "Menguante · últimas unidades",
        subtitle: "Lo que queda de tiradas anteriores, con precio de fin de ciclo. Cuando se termina, se termina.",
        source: { kind: "on_sale", limit: 12 },
        viewAllHref: "/productos",
        cardsPerView: 4,
        highlight: "none",
      },
      { background: "surface", paddingY: "lg" },
    ),

    // 10 · Tres banners de categoría.
    block(
      "vidriera",
      "banner_grid",
      {
        columns: 3,
        ratio: "1:1",
        gap: "md",
        items: [
          {
            imageUrl: ASSET("banner-remeras.svg"),
            title: "Remeras",
            subtitle: "Algodón peinado y modal, de la básica a la oversize.",
            href: "/categoria/remeras",
            align: "left",
            overlay: 0,
            textColor: "light",
          },
          {
            imageUrl: ASSET("banner-vestidos.svg"),
            title: "Vestidos",
            subtitle: "Lino y fibrana para el calor que viene.",
            href: "/categoria/vestidos",
            align: "left",
            overlay: 0,
            textColor: "light",
          },
          {
            imageUrl: ASSET("banner-accesorios.svg"),
            title: "Accesorios",
            subtitle: "Pañuelos de seda, bufandas tejidas y medias de algodón.",
            href: "/categoria/accesorios",
            align: "left",
            overlay: 0,
            textColor: "light",
          },
        ],
      },
      { paddingY: "md" },
    ),

    // 11 · Reseñas (banda noche, una cita grande).
    block(
      "resenas",
      "testimonials",
      {
        layout: "quote",
        items: [
          {
            quote: "Compré el vestido camisero en la tirada de luna llena y cuando quise otro color ya no había. Ahora me agendo la luna nueva.",
            author: "Carla",
            meta: "Villa Crespo",
          },
          {
            quote: "Me cambiaron el talle del pantalón sin vueltas: lo llevé al local un sábado y salí con el L.",
            author: "Mica",
            meta: "Almagro",
          },
          {
            quote: "El buzo canguro aguantó todo el invierno y sigue igual. Se nota que lo cosió alguien.",
            author: "Juli",
            meta: "Caballito",
          },
          {
            quote: "Pedí a la mañana y a la tarde me lo trajo la moto, con una nota escrita a mano.",
            author: "Flor",
            meta: "Palermo",
          },
        ],
      },
      { background: "primary", paddingY: "lg" },
    ),

    // 12 · Datos de compra.
    block(
      "datos-compra",
      "features",
      {
        columns: 4,
        layout: "cards",
        items: [
          {
            icon: "Truck",
            title: "Envío en moto por CABA",
            text: freeFrom ? `Llega en 24 a 48 hs hábiles. Gratis desde ${money(freeFrom)}.` : "Llega en 24 a 48 hs hábiles.",
          },
          { icon: "Store", title: "Retiro en Palermo", text: "Sin cargo, de lunes a sábado. Te avisamos cuando está listo." },
          discount > 0
            ? { icon: "Landmark", title: `${pct(discount)} off con transferencia`, text: "Se descuenta solo al elegir transferencia en el checkout." }
            : { icon: "Wallet", title: "Pagás como te quede cómodo", text: "Al confirmar te mostramos las formas de pago." },
          { icon: "RefreshCcw", title: "Cambios en 30 días", text: "Por talle o color, con la etiqueta puesta. En el local, en el momento." },
        ],
      },
      { background: "surface", paddingY: "md" },
    ),

    // 13 · Dudas. El título «Cómo comprar» es el ancla del menú (`/#como-comprar`).
    block(
      "dudas",
      "faq",
      {
        title: "Cómo comprar",
        layout: "split",
        items: [
          {
            q: "¿Qué es eso de las fases?",
            a: "Sacamos una tirada corta por cada ciclo lunar, más o menos cada 29 días. En luna nueva sube la serie nueva; en creciente está la colección del momento; en llena, lo que más sale; y en menguante liquidamos lo que queda antes de la próxima.",
          },
          {
            q: "¿Cómo sé mi talle?",
            a: `Remeras, buzos, camisas y vestidos van de S a XL (algunos modelos, de S a L) y los pantalones del 36 al 44, todos de calce regular. Si estás entre dos, llevá el más grande.${opts.whatsapp ? " Si dudás, escribinos por WhatsApp con tu altura y el talle que usás y te decimos." : ""}`,
          },
          {
            q: "¿Puedo cambiar una prenda?",
            a: "Sí, dentro de los 30 días, por otro talle o color, con la etiqueta puesta. En el local de Palermo lo hacés en el momento; si no podés acercarte, coordinamos el retiro con la moto.",
          },
          {
            q: "¿Cuánto tarda el envío?",
            a: `En CABA te lo lleva una moto en 24 a 48 hs hábiles${freeFrom ? ` (gratis desde ${money(freeFrom)})` : ""}. También podés retirarlo sin cargo en el local de Palermo.`,
          },
          {
            q: "¿Cómo pago?",
            a:
              discount > 0
                ? `Por transferencia bancaria, con ${pct(discount)} de descuento: al confirmar te mostramos los datos de la cuenta.${opts.whatsapp ? " Si preferís otra forma, la acordamos por WhatsApp." : ""}`
                : opts.whatsapp
                  ? "Al confirmar el pedido te escribimos por WhatsApp para coordinar el pago y la entrega."
                  : "Al confirmar el pedido te mostramos las formas de pago disponibles.",
          },
          {
            q: "¿Me puedo arrepentir de la compra?",
            a: "Sí. Tenés 10 días corridos desde que recibís el producto (Ley 24.240). Usá el Botón de arrepentimiento que está al pie de la tienda.",
          },
        ],
      },
      { paddingY: "lg" },
    ),
  ];
}
