import { nanoid } from "nanoid";

import type { PageTemplateId } from "@/lib/schemas/page";

import { BLOCK_LABELS, type Block, type BlockOf, type BlockStyle, type BlockType } from "./schema";

/*
 * Defaults del builder (agente E): bloques nuevos con copy real de ejemplo en
 * rioplatense (nunca lorem ni reseñas inventadas, DESIGN.md §1.1), ritmo
 * vertical asimétrico (§2.2) y plantillas de página.
 */

export type BlockGroup = "campaign" | "products" | "content" | "structure";

export const BLOCK_GROUP_LABELS: Record<BlockGroup, string> = {
  campaign: "Portada y campañas",
  products: "Productos y categorías",
  content: "Contenido",
  structure: "Estructura",
};

export interface BlockMeta {
  type: BlockType;
  label: string;
  description: string;
  group: BlockGroup;
}

export const BLOCK_META: Record<BlockType, BlockMeta> = {
  hero: { type: "hero", label: BLOCK_LABELS.hero, description: "Imagen grande con título y un botón. Ideal para abrir la página.", group: "campaign" },
  banner_grid: { type: "banner_grid", label: BLOCK_LABELS.banner_grid, description: "De 1 a 4 imágenes con link: campañas o accesos a colecciones.", group: "campaign" },
  countdown: { type: "countdown", label: BLOCK_LABELS.countdown, description: "Cuenta regresiva hasta una fecha. Al terminar muestra un texto de cierre.", group: "campaign" },
  product_slider: { type: "product_slider", label: BLOCK_LABELS.product_slider, description: "Fila de productos que se desliza. Novedades, una categoría, ofertas.", group: "products" },
  product_grid: { type: "product_grid", label: BLOCK_LABELS.product_grid, description: "Grilla de productos con la cantidad de columnas que elijas.", group: "products" },
  category_list: { type: "category_list", label: BLOCK_LABELS.category_list, description: "Accesos a categorías como tarjetas, chips o círculos con foto.", group: "products" },
  heading: { type: "heading", label: BLOCK_LABELS.heading, description: "Título de sección con una línea chica arriba (opcional).", group: "content" },
  rich_text: { type: "rich_text", label: BLOCK_LABELS.rich_text, description: "Texto con títulos, listas y links. Para políticas o explicaciones.", group: "content" },
  image_text: { type: "image_text", label: BLOCK_LABELS.image_text, description: "Foto a un lado y texto al otro. Para contar la historia de la marca.", group: "content" },
  features: { type: "features", label: BLOCK_LABELS.features, description: "Hasta 4 datos operativos con ícono: envíos, retiro, formas de pago.", group: "content" },
  faq: { type: "faq", label: BLOCK_LABELS.faq, description: "Preguntas y respuestas desplegables.", group: "content" },
  testimonials: { type: "testimonials", label: BLOCK_LABELS.testimonials, description: "Reseñas reales de clientes. Nace vacío: no inventes reseñas.", group: "content" },
  video: { type: "video", label: BLOCK_LABELS.video, description: "Video de YouTube, Vimeo o un .mp4. Carga sólo al tocar play.", group: "content" },
  divider: { type: "divider", label: BLOCK_LABELS.divider, description: "Una línea o espacio para separar secciones.", group: "structure" },
};

/** Orden de la paleta. */
export const PALETTE_ORDER: BlockType[] = [
  "hero",
  "banner_grid",
  "countdown",
  "product_slider",
  "product_grid",
  "category_list",
  "heading",
  "rich_text",
  "image_text",
  "features",
  "faq",
  "testimonials",
  "video",
  "divider",
];

/** Padding vertical por defecto de cada tipo (ritmo asimétrico, DESIGN.md §2.2). */
const DEFAULT_PADDING: Record<BlockType, BlockStyle["paddingY"]> = {
  hero: "none",
  banner_grid: "sm",
  countdown: "md",
  product_slider: "md",
  product_grid: "md",
  category_list: "md",
  heading: "sm",
  rich_text: "lg",
  image_text: "lg",
  features: "md",
  faq: "lg",
  testimonials: "lg",
  video: "md",
  divider: "none",
};

export function defaultStyle(type: BlockType): BlockStyle {
  return {
    background: "default",
    paddingY: DEFAULT_PADDING[type],
    container: type === "hero" ? "full" : type === "rich_text" || type === "faq" ? "narrow" : "normal",
  };
}

/** Fecha por defecto de la cuenta regresiva: dentro de 7 días a las 23:59 (hora de Buenos Aires, UTC−3). */
function defaultEndsAt(now = new Date()): string {
  const d = new Date(now.getTime() + 7 * 86_400_000);
  const ymd = d.toISOString().slice(0, 10);
  return new Date(`${ymd}T23:59:00-03:00`).toISOString();
}

type Settings<T extends BlockType> = BlockOf<T>["settings"];

const DEFAULT_SETTINGS: { [K in BlockType]: () => Settings<K> } = {
  hero: () => ({
    eyebrow: "Temporada primavera",
    title: "Llegaron las novedades para la casa",
    subtitle: "Más de 80 productos nuevos en cocina, audio y deco. 10 % off pagando con transferencia.",
    imageUrl: "",
    overlay: 40,
    align: "left",
    height: "md",
    cta: { label: "Ver novedades", href: "/productos" },
  }),
  product_slider: () => ({
    title: "Novedades",
    subtitle: "Lo último que sumamos al catálogo.",
    source: { kind: "newest", limit: 12 },
    viewAllHref: "/productos",
    cardsPerView: 4,
  }),
  product_grid: () => ({
    title: "Ofertas",
    source: { kind: "on_sale", limit: 8 },
    viewAllHref: "/productos",
    columns: 4,
  }),
  banner_grid: () => ({
    columns: 2,
    ratio: "4:5",
    gap: "md",
    items: [
      { imageUrl: "", title: "Cocina", subtitle: "Pequeños electros y bazar", cta: { label: "Ver cocina", href: "/productos" }, align: "left", overlay: 35, textColor: "light" },
      { imageUrl: "", title: "Audio", subtitle: "Auriculares y parlantes", cta: { label: "Ver audio", href: "/productos" }, align: "left", overlay: 35, textColor: "light" },
    ],
  }),
  rich_text: () => ({
    html: "<h2>Cómo comprar</h2><ol><li><strong>Armá tu carrito</strong> con los productos que quieras.</li><li><strong>Elegí cómo pagar</strong>: transferencia bancaria con descuento o acordás con nosotros por WhatsApp.</li><li><strong>Confirmá el pedido</strong> y te mostramos los pasos para completar el pago.</li></ol>",
    align: "left",
    maxWidth: "normal",
  }),
  heading: () => ({ text: "Elegidos de la semana", level: 2, align: "left", eyebrow: "" }),
  image_text: () => ({
    imageUrl: "",
    imagePosition: "left",
    title: "Una tienda de barrio, ahora online",
    html: "<p>Empezamos en 2012 con un local chico en Morón. Hoy seguimos eligiendo y probando cada producto antes de publicarlo, y te atendemos las mismas personas de siempre.</p>",
    cta: { label: "Ver productos", href: "/productos" },
  }),
  category_list: () => ({ title: "Comprá por categoría", categoryIds: "all", style: "cards", columns: 4 }),
  features: () => ({
    columns: 3,
    items: [
      { icon: "Truck", title: "Envíos a todo el país", text: "Despachamos en 24 a 48 hs hábiles." },
      { icon: "Store", title: "Retirás en el local", text: "Sin costo. Te avisamos por WhatsApp cuando está listo." },
      { icon: "Landmark", title: "10 % off con transferencia", text: "El descuento se aplica solo en el checkout." },
    ],
  }),
  faq: () => ({
    title: "Preguntas frecuentes",
    items: [
      { q: "¿Cuánto tarda el envío?", a: "Despachamos en 24 a 48 hs hábiles. Según la zona, llega en 2 a 5 días hábiles." },
      { q: "¿Puedo retirar en persona?", a: "Sí. Elegí «Retirás en el local» en el checkout y te avisamos cuando esté listo." },
      { q: "¿Cómo pago con transferencia?", a: "Al confirmar el pedido te mostramos los datos bancarios. Enviás el comprobante por WhatsApp y lo despachamos." },
    ],
  }),
  countdown: () => ({
    title: "La promo termina en",
    endsAt: defaultEndsAt(),
    text: "Hasta 30 % off en tecnología y hogar.",
    expiredText: "La promo terminó. Mirá lo que sigue con descuento.",
    cta: { label: "Ver ofertas", href: "/productos" },
  }),
  testimonials: () => ({ items: [] }),
  video: () => ({ url: "", ratio: "16:9" }),
  divider: () => ({ style: "line", size: "md" }),
};

/** Bloque nuevo con id único, settings de ejemplo y estilo por defecto. */
export function createBlock<T extends BlockType>(type: T, overrides?: { settings?: Partial<Settings<T>>; style?: Partial<BlockStyle> }): BlockOf<T> {
  const settings = (DEFAULT_SETTINGS[type] as () => Settings<T>)();
  return {
    id: nanoid(10),
    type,
    style: { ...defaultStyle(type), ...overrides?.style },
    settings: { ...settings, ...overrides?.settings },
  } as BlockOf<T>;
}

/** Copia profunda con id nuevo (duplicar bloque). */
export function cloneBlock<T extends Block>(block: T): T {
  return { ...(JSON.parse(JSON.stringify(block)) as T), id: nanoid(10) };
}

export interface PageTemplate {
  id: PageTemplateId;
  label: string;
  description: string;
  /** Tipo de página sugerido al elegir la plantilla. */
  type: "landing" | "legal" | "custom";
  build: () => Block[];
}

export const PAGE_TEMPLATES_META: PageTemplate[] = [
  { id: "blank", label: "Vacía", description: "Arrancás de cero y agregás los bloques que quieras.", type: "custom", build: () => [] },
  {
    id: "campaign",
    label: "Landing de campaña",
    description: "Portada, cuenta regresiva, ofertas, banners y preguntas frecuentes.",
    type: "landing",
    build: () => [
      createBlock("hero", {
        settings: {
          eyebrow: "Ciber Lunes",
          title: "Hasta 30 % off en tecnología y hogar",
          subtitle: "Del lunes a las 00:00 al miércoles a las 23:59. Con transferencia sumás 10 % más.",
          height: "md",
          cta: { label: "Ver ofertas", href: "/productos" },
        },
      }),
      createBlock("countdown", { style: { background: "surface", paddingY: "sm" } }),
      createBlock("product_grid", { settings: { title: "Ofertas", source: { kind: "on_sale", limit: 12 }, columns: 4 } }),
      createBlock("banner_grid", { style: { paddingY: "none" } }),
      createBlock("faq"),
    ],
  },
  {
    id: "about",
    label: "Sobre nosotros",
    description: "Título, historia con foto, beneficios y un espacio para reseñas reales.",
    type: "custom",
    build: () => [
      createBlock("heading", { settings: { text: "Quiénes somos", level: 1, eyebrow: "Nuestra historia" }, style: { paddingY: "md" } }),
      createBlock("image_text", { style: { paddingY: "sm" } }),
      createBlock("features", { style: { background: "surface" } }),
      createBlock("testimonials"),
    ],
  },
  {
    id: "legal",
    label: "Página legal",
    description: "Título y un texto largo: términos, privacidad, cambios y devoluciones.",
    type: "legal",
    build: () => [
      createBlock("heading", { settings: { text: "Términos y condiciones", level: 1 }, style: { container: "narrow", paddingY: "md" } }),
      createBlock("rich_text", {
        settings: {
          maxWidth: "narrow",
          html: "<p><em>Última actualización: completá la fecha.</em></p><h2>1. Quiénes somos</h2><p>Completá la razón social, el CUIT y el domicilio de la tienda.</p><h2>2. Precios y medios de pago</h2><p>Los precios están expresados en pesos argentinos e incluyen IVA.</p><h2>3. Envíos y retiro</h2><p>Contá los plazos y zonas de entrega.</p><h2>4. Cambios, devoluciones y arrepentimiento</h2><p>Tenés 10 días corridos desde que recibís el producto para arrepentirte de la compra (Ley 24.240, art. 34).</p>",
        },
        style: { paddingY: "none" },
      }),
    ],
  },
];

export function templateById(id: PageTemplateId): PageTemplate {
  return PAGE_TEMPLATES_META.find((t) => t.id === id) ?? PAGE_TEMPLATES_META[0];
}
