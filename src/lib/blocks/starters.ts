import { nanoid } from "nanoid";

import type { PresetId } from "@/lib/theme/schema";

import type { Block, BlockOf, BlockStyle, BlockType } from "./schema";

/*
 * Inicio de fábrica por preset (DESIGN.md §6.5 y §6.12). Cada estilo arranca
 * con una composición propia, coherente con su rubro: no hay dos portadas
 * iguales. Se usa en tres lugares:
 *   1. la home de una tienda nueva (`starterHomeBlocks`, después de create_store);
 *   2. "Empezar desde una plantilla" en el constructor (`STARTER_TEMPLATES`);
 *   3. la vista previa por estilo de la tienda demo (`?estilo=<preset>`).
 *
 * El copy es VERDADERO para cualquier tienda recién creada: no promete plazos
 * de envío, años de trayectoria ni descuentos que no configuró. Lo que depende
 * de la tienda (nombre, % por transferencia, WhatsApp) llega por `StarterOptions`.
 * Los bloques sin datos (sin productos, sin categorías) no se muestran: la
 * portada se va completando sola a medida que el dueño carga el catálogo.
 */

export type StarterPresetId = Exclude<PresetId, "custom">;

export interface StarterOptions {
  storeName: string;
  /** % de descuento por transferencia (0 = sin transferencia o sin descuento). */
  transferDiscount?: number;
  /** ¿La tienda atiende por WhatsApp? */
  whatsapp?: boolean;
  /** Foto para la portada (vista previa de la demo: la de su portada guardada). */
  heroImageUrl?: string;
  heroImageAlt?: string;
  /** Ids deterministas (`home-…`). Sin esto, ids nuevos (nanoid) para insertar en el constructor. */
  stableIds?: boolean;
}

type Settings<T extends BlockType> = BlockOf<T>["settings"];

interface Ctx {
  name: string;
  discount: number;
  whatsapp: boolean;
  heroImage: string;
  heroAlt?: string;
  id: (type: BlockType) => string;
}

function make<T extends BlockType>(ctx: Ctx, type: T, settings: Settings<T>, style: Partial<BlockStyle> = {}): BlockOf<T> {
  const base: BlockStyle = {
    background: "default",
    paddingY: "md",
    container: type === "hero" || type === "marquee" ? "full" : "normal",
  };
  return { id: ctx.id(type), type, style: { ...base, ...style }, settings } as BlockOf<T>;
}

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} %`;

/** Bajada de la portada: lo único que sabemos que es cierto de una tienda nueva. */
function payLine(ctx: Ctx): string {
  return ctx.discount > 0
    ? `Pagando con transferencia tenés ${pct(ctx.discount)} de descuento.`
    : ctx.whatsapp
      ? "Armás el pedido acá y coordinamos el pago por WhatsApp."
      : "Armás el pedido acá y te mostramos cómo pagarlo.";
}

function hero(ctx: Ctx, s: Partial<Settings<"hero">> & Pick<Settings<"hero">, "title">, style?: Partial<BlockStyle>) {
  return make(
    ctx,
    "hero",
    {
      layout: "auto",
      eyebrow: undefined,
      subtitle: payLine(ctx),
      imageUrl: ctx.heroImage,
      imageAlt: ctx.heroAlt,
      overlay: ctx.heroImage ? 35 : 0,
      align: "left",
      height: "md",
      cta: { label: "Ver productos", href: "/productos" },
      cta2: { label: "Cómo comprar", href: "#como-comprar" },
      products: { kind: "newest", limit: 4 },
      ...s,
    },
    { paddingY: "none", container: "full", ...style },
  );
}

function marqueeItems(ctx: Ctx, lead: string[] = []): string[] {
  return [
    ...lead,
    "Comprá online cuando quieras",
    ...(ctx.discount > 0 ? [`${pct(ctx.discount)} off pagando con transferencia`] : []),
    ...(ctx.whatsapp ? ["Consultas por WhatsApp"] : []),
    "Botón de arrepentimiento al pie",
  ];
}

function featureItems(ctx: Ctx, count = 3): Settings<"features">["items"] {
  const items: Settings<"features">["items"] = [
    { icon: "Truck", title: "Coordinamos la entrega", text: "Elegís cómo recibir el pedido al confirmar la compra." },
    ctx.discount > 0
      ? { icon: "Landmark", title: `${pct(ctx.discount)} off con transferencia`, text: "Se descuenta solo al elegir transferencia en el checkout." }
      : { icon: "Wallet", title: "Pagás como te quede cómodo", text: "Al confirmar te mostramos las formas de pago." },
    ctx.whatsapp
      ? { icon: "MessageCircle", title: "Atención directa", text: "Te respondemos por WhatsApp." }
      : { icon: "PackageCheck", title: "Seguís tu pedido", text: "Con el link del pedido ves en qué estado está." },
    { icon: "Undo2", title: "Botón de arrepentimiento", text: "Tenés 10 días corridos para arrepentirte de la compra." },
  ];
  return items.slice(0, count);
}

/** FAQ "Cómo comprar": el menú de una tienda nueva apunta a `/#como-comprar` (el título del bloque es el ancla). */
function howToBuy(ctx: Ctx, layout: Settings<"faq">["layout"], style?: Partial<BlockStyle>) {
  return make(
    ctx,
    "faq",
    {
      title: "Cómo comprar",
      layout,
      items: [
        { q: "¿Cómo hago un pedido?", a: "Sumá los productos al carrito, completá tus datos y elegí cómo recibirlo. Al confirmar, el pedido queda registrado y te mostramos cómo pagarlo." },
        {
          q: "¿Cómo pago?",
          a:
            ctx.discount > 0
              ? `Podés pagar por transferencia bancaria con ${pct(ctx.discount)} de descuento: al confirmar te mostramos los datos de la cuenta.${ctx.whatsapp ? " Si preferís otra forma, la acordamos por WhatsApp." : ""}`
              : ctx.whatsapp
                ? "Al confirmar el pedido te escribimos por WhatsApp para coordinar el pago y la entrega."
                : "Al confirmar el pedido te mostramos las formas de pago disponibles.",
        },
        { q: "¿Puedo ver cómo va mi pedido?", a: "Sí. Al confirmar te damos un link con el estado del pedido. Guardalo para consultarlo cuando quieras." },
        { q: "¿Me puedo arrepentir de la compra?", a: "Sí. Tenés 10 días corridos desde que recibís el producto (Ley 24.240). Usá el Botón de arrepentimiento que está al pie de la tienda." },
      ],
    },
    { paddingY: "lg", container: layout === "split" ? "normal" : "narrow", ...style },
  );
}

type Composer = (ctx: Ctx) => Block[];

const COMPOSITIONS: Record<StarterPresetId, Composer> = {
  /** Moda: portada silenciosa, una colección con foto grande y las categorías como vidriera. */
  atelier: (ctx) => [
    hero(ctx, { eyebrow: ctx.name, title: "Prendas elegidas una por una", height: "lg", cta: { label: "Ver la colección", href: "/productos" }, products: { kind: "newest", limit: 3 } }),
    make(ctx, "lookbook", { eyebrow: "Recién llegado", title: "Lo nuevo, para mirar con tiempo", text: "", imageUrl: "", imagePosition: "right", source: { kind: "newest", limit: 4 }, cta: { label: "Ver todo lo nuevo", href: "/productos" } }, { paddingY: "md" }),
    make(ctx, "category_list", { title: "Por categoría", categoryIds: "all", style: "cards", columns: 4 }, { paddingY: "lg" }),
    make(ctx, "product_grid", { title: "Con descuento", source: { kind: "on_sale", limit: 6 }, viewAllHref: "/productos", columns: 3, highlight: "none" }, { paddingY: "lg" }),
    make(ctx, "features", { columns: 3, layout: "strip", items: featureItems(ctx) }, { paddingY: "sm" }),
    howToBuy(ctx, "list"),
  ],

  /** Feria cuidada: la foto enmarcada, beneficios en tarjetas y rubros en arco. */
  mercado: (ctx) => [
    hero(ctx, { eyebrow: ctx.name, title: "Elegí con calma, nosotros lo preparamos", height: "md" }),
    make(ctx, "features", { columns: 3, layout: "cards", items: featureItems(ctx) }, { paddingY: "md" }),
    make(ctx, "category_list", { title: "Recorré el puesto", categoryIds: "all", style: "cards", columns: 4 }),
    make(ctx, "product_grid", { title: "Recién llegados", source: { kind: "newest", limit: 7 }, viewAllHref: "/productos", columns: 4, highlight: "first" }, { paddingY: "lg" }),
    howToBuy(ctx, "split", { background: "surface" }),
  ],

  /** Vidriera técnica: portada partida y baja, datos operativos arriba, mucho producto. */
  nordico: (ctx) => [
    hero(ctx, { title: "Buscá por marca, código o rubro", eyebrow: ctx.name, height: "sm", products: { kind: "newest", limit: 4 } }),
    make(ctx, "features", { columns: 4, layout: "row", items: featureItems(ctx, 4) }, { background: "surface", paddingY: "sm" }),
    make(ctx, "category_list", { title: "Rubros", categoryIds: "all", style: "chips", columns: 6 }, { paddingY: "sm" }),
    make(ctx, "product_slider", { title: "Recién ingresados", source: { kind: "newest", limit: 15 }, viewAllHref: "/productos", cardsPerView: 5, highlight: "none" }),
    make(ctx, "product_grid", { title: "Con descuento", source: { kind: "on_sale", limit: 10 }, viewAllHref: "/productos", columns: 5, highlight: "none" }),
    howToBuy(ctx, "list"),
  ],

  /** Tapa de revista: el nombre gigante, una marquesina que corre y la grilla con protagonista. */
  editorial: (ctx) => [
    hero(ctx, { title: ctx.name, eyebrow: "Lo nuevo ya está online", height: "md", cta: { label: "Ver lo nuevo", href: "/productos" }, products: null }),
    make(ctx, "marquee", { items: marqueeItems(ctx, ["Lo nuevo ya está online"]), size: "lg", speed: "normal" }, { background: "primary", paddingY: "none", container: "full" }),
    make(ctx, "product_grid", { title: "Lo nuevo", source: { kind: "newest", limit: 7 }, viewAllHref: "/productos", columns: 4, highlight: "first" }, { paddingY: "lg" }),
    make(ctx, "category_list", { title: "Secciones", categoryIds: "all", style: "list", columns: 4 }),
    make(ctx, "product_slider", { title: "Con descuento", source: { kind: "on_sale", limit: 12 }, viewAllHref: "/productos", cardsPerView: 4, highlight: "none" }),
    howToBuy(ctx, "split"),
  ],

  /** Hardware: portada partida oscura, una tira ámbar con los datos y un producto protagonista. */
  neon: (ctx) => [
    hero(ctx, { eyebrow: ctx.name, title: "Armá tu setup pieza por pieza", height: "md", products: { kind: "newest", limit: 4 } }),
    make(ctx, "marquee", { items: marqueeItems(ctx), size: "sm", speed: "normal" }, { background: "primary", paddingY: "none", container: "full" }),
    make(ctx, "product_slider", { title: "Recién llegados", source: { kind: "newest", limit: 12 }, viewAllHref: "/productos", cardsPerView: 4, highlight: "first" }, { paddingY: "lg" }),
    make(ctx, "category_list", { title: "Categorías", categoryIds: "all", style: "chips", columns: 6 }, { paddingY: "sm" }),
    make(ctx, "product_grid", { title: "Con descuento", source: { kind: "on_sale", limit: 8 }, viewAllHref: "/productos", columns: 4, highlight: "none" }),
    make(ctx, "features", { columns: 3, layout: "strip", items: featureItems(ctx) }, { background: "surface", paddingY: "sm" }),
    howToBuy(ctx, "list"),
  ],

  /** Mostrador claro: foto enmarcada con la tarjeta a la derecha, categorías como etiquetas y las dudas bien visibles. */
  botica: (ctx) => [
    hero(ctx, { eyebrow: ctx.name, title: "Lo de todos los días, sin hacer fila", height: "md", align: "center" }),
    make(ctx, "category_list", { title: "Buscá por categoría", categoryIds: "all", style: "chips", columns: 6 }, { paddingY: "sm" }),
    make(ctx, "product_grid", { title: "Recién llegados", source: { kind: "newest", limit: 8 }, viewAllHref: "/productos", columns: 4, highlight: "none" }, { paddingY: "lg" }),
    make(ctx, "features", { columns: 3, layout: "cards", items: featureItems(ctx) }, { background: "surface" }),
    howToBuy(ctx, "split"),
  ],

  /** Recreo: título centrado con los productos debajo, categorías en burbujas y una tira que corre. */
  recreo: (ctx) => [
    hero(ctx, { eyebrow: ctx.name, title: "Para elegir de a uno o de a muchos", height: "md", products: { kind: "newest", limit: 4 } }),
    make(ctx, "category_list", { title: "¿Qué estás buscando?", categoryIds: "all", style: "circles", columns: 6 }),
    make(ctx, "marquee", { items: marqueeItems(ctx), size: "sm", speed: "slow" }, { background: "surface", paddingY: "none", container: "full" }),
    make(ctx, "product_slider", { title: "Lo más nuevo", source: { kind: "newest", limit: 12 }, viewAllHref: "/productos", cardsPerView: 4, highlight: "first" }, { paddingY: "lg" }),
    make(ctx, "features", { columns: 3, layout: "cards", items: featureItems(ctx) }),
    howToBuy(ctx, "list"),
  ],

  /** Mueblería: portada de pantalla completa y un ambiente con sus piezas al lado. */
  lapacho: (ctx) => [
    hero(ctx, { eyebrow: ctx.name, title: "Piezas para mirar de cerca", height: "screen", products: { kind: "newest", limit: 3 } }),
    make(ctx, "lookbook", { eyebrow: "Ambientes", title: "Todo lo de la foto, a un clic", text: "", imageUrl: "", imagePosition: "left", source: { kind: "newest", limit: 3 }, cta: { label: "Ver todos los productos", href: "/productos" } }, { paddingY: "lg" }),
    make(ctx, "category_list", { title: "Por ambiente", categoryIds: "all", style: "cards", columns: 3 }),
    make(ctx, "product_grid", { title: "Con descuento", source: { kind: "on_sale", limit: 6 }, viewAllHref: "/productos", columns: 3, highlight: "none" }, { paddingY: "lg" }),
    howToBuy(ctx, "split"),
  ],

  /** Lista de precios: portada partida compacta, rubros en lista y grilla densa. */
  galpon: (ctx) => [
    hero(ctx, { eyebrow: ctx.name, title: "Lista de precios online", subtitle: `Buscá por código, marca o rubro y armá el pedido. ${payLine(ctx)}`, height: "sm", cta: { label: "Ver la lista", href: "/productos" }, products: { kind: "on_sale", limit: 6 } }),
    make(ctx, "features", { columns: 4, layout: "row", items: featureItems(ctx, 4) }, { background: "surface", paddingY: "sm" }),
    make(ctx, "category_list", { title: "Rubros", categoryIds: "all", style: "list", columns: 4 }),
    make(ctx, "product_grid", { title: "Últimos ingresos", source: { kind: "newest", limit: 20 }, viewAllHref: "/productos", columns: 5, rows: 4, highlight: "none" }),
    howToBuy(ctx, "list"),
  ],

  /** Cava: portada centrada y pausada, una selección con foto y la carta en lista. */
  bodega: (ctx) => [
    hero(ctx, { eyebrow: ctx.name, title: "Una carta para recorrer sin apuro", align: "center", height: "lg", overlay: ctx.heroImage ? 45 : 0, products: { kind: "newest", limit: 3 } }),
    make(ctx, "lookbook", { eyebrow: "Selección", title: "Para abrir esta semana", text: "", imageUrl: "", imagePosition: "right", source: { kind: "newest", limit: 2 } }, { paddingY: "lg" }),
    make(ctx, "category_list", { title: "La carta", categoryIds: "all", style: "list", columns: 4 }, { background: "surface", paddingY: "lg" }),
    make(ctx, "product_slider", { title: "Recién llegados", source: { kind: "newest", limit: 12 }, viewAllHref: "/productos", cardsPerView: 4, highlight: "none" }, { paddingY: "lg" }),
    howToBuy(ctx, "split"),
  ],
};

function context(opts: StarterOptions): Ctx {
  const counts = new Map<string, number>();
  return {
    name: opts.storeName.trim() || "Tu tienda",
    discount: Math.max(0, Math.min(opts.transferDiscount ?? 0, 50)),
    whatsapp: opts.whatsapp ?? true,
    heroImage: opts.heroImageUrl ?? "",
    heroAlt: opts.heroImageAlt,
    id: (type) => {
      if (!opts.stableIds) return nanoid(10);
      const n = (counts.get(type) ?? 0) + 1;
      counts.set(type, n);
      return `home-${type.replace(/_/g, "-")}${n > 1 ? `-${n}` : ""}`;
    },
  };
}

export function isStarterPreset(value: unknown): value is StarterPresetId {
  return typeof value === "string" && value in COMPOSITIONS;
}

/**
 * Portada de fábrica del preset. Preset desconocido o `custom` → la de `nordico`
 * (el default del tema). Siempre devuelve bloques válidos para `blockSchema`.
 */
export function defaultHomeFor(preset: PresetId | string, opts: StarterOptions): Block[] {
  const compose = isStarterPreset(preset) ? COMPOSITIONS[preset] : COMPOSITIONS.nordico;
  return compose(context(opts));
}

/** Para la home de una tienda nueva (ids `home-…`, estables). */
export function starterHomeBlocks(preset: PresetId | string, opts: Omit<StarterOptions, "stableIds">): Block[] {
  return defaultHomeFor(preset, { ...opts, stableIds: true });
}

export interface StarterTemplate {
  preset: StarterPresetId;
  label: string;
  /** Una línea: qué la distingue. */
  description: string;
}

/** Plantillas de portada para "Empezar desde una plantilla" (mismo orden que el selector de estilos). */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  { preset: "nordico", label: "Vidriera técnica", description: "Portada partida y baja, datos de compra arriba, carrusel de 5 y ofertas." },
  { preset: "mercado", label: "Puesto de feria", description: "Foto enmarcada, beneficios en tarjetas, categorías y grilla con protagonista." },
  { preset: "atelier", label: "Colección", description: "Portada silenciosa, una colección con foto grande y las categorías en vidriera." },
  { preset: "editorial", label: "Tapa de revista", description: "El nombre gigante, una marquesina que corre y la grilla con un producto destacado." },
  { preset: "botica", label: "Mostrador", description: "Foto enmarcada, categorías como etiquetas y las dudas resueltas a la vista." },
  { preset: "recreo", label: "Recreo", description: "Título centrado con productos debajo, categorías en círculos y una tira que corre." },
  { preset: "lapacho", label: "Ambientes", description: "Portada a pantalla completa y un ambiente con sus piezas al lado." },
  { preset: "galpon", label: "Lista de precios", description: "Portada compacta, rubros en lista y una grilla densa de 5 columnas." },
  { preset: "bodega", label: "Carta", description: "Portada centrada y pausada, una selección con foto y la carta en lista." },
  { preset: "neon", label: "Setup", description: "Portada partida, una tira de datos que corre y un carrusel con protagonista." },
];
