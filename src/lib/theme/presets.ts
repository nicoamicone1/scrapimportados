import type { PresetId, Theme } from "./schema";

/**
 * Presets del tema (docs/DESIGN.md §4). Cada uno define TODOS los campos:
 * elegirlo copia el objeto completo; cualquier edición posterior pasa
 * `preset` a "custom". Contrastes verificados en `presets.test.ts`
 * (texto, muted, acento, éxito y peligro ≥ 4.5:1 sobre fondo y superficie;
 * texto del primario ≥ 4.5:1; primario ≥ 3:1 sobre el fondo).
 *
 * Ojo: `create_store()` guarda sólo `{ preset }` y `parseTheme` completa con
 * estos valores, así que cambiar un preset cambia las tiendas que nunca
 * guardaron su apariencia. Curar con razones, no por gusto.
 */

/*
 * Personalidad estructural (2026-10): además de color y tipografía, cada preset
 * elige header (`header.layout`), pie (`footer.style`) y `style` (portada,
 * títulos, forma, tarjeta, movimiento, grilla, filtros y galería). El test de
 * presets exige que dos presets difieran en al menos 4 de esos 10 ejes.
 */

export interface PresetMeta {
  id: Exclude<PresetId, "custom">;
  name: string;
  /** Una línea: para quién es y qué lo distingue. */
  description: string;
  /** Rubros de ejemplo, en orden (máx. 4). Se muestran como chips en el selector. */
  industries: string[];
  /** Tono en dos o tres palabras ("Silencioso y aireado"). */
  mood: string;
}

/**
 * Moda, joyería, marroquinería, lencería.
 * Se distingue por el silencio: Cormorant grande sobre blanco roto, cero radios,
 * cero sombras y el aire como único separador (sin reglas entre celdas).
 * Disposición: logo al centro y transparente sobre la portada; catálogo sin
 * columna de filtros (panel) con un destacado a doble tamaño cada diez; títulos
 * centrados entre dos rayas; ficha con todas las fotos en grilla de a dos y el
 * buy box fijo; pie simple con el nombre en Cormorant.
 */
const atelier: Theme = {
  preset: "atelier",
  colors: {
    background: "#FAF8F4",
    surface: "#F1EDE6",
    text: "#1B1A18",
    textMuted: "#6A655D",
    primary: "#1B1A18",
    primaryText: "#FAF8F4",
    secondary: "#EBE4D8",
    accent: "#8B5A34",
    border: "#DDD6CA",
    success: "#3F6B45",
    danger: "#A3332B",
  },
  fonts: {
    heading: "cormorant-garamond",
    body: "jost",
    headingWeight: 500,
    bodyWeight: 400,
    headingTransform: "none",
    headingTracking: "normal",
    baseSize: 16,
  },
  radius: "none",
  buttons: { style: "solid", shape: "square", uppercase: true },
  cards: { style: "flat", imageRatio: "4:5", hover: "zoom", showSku: false, showBrand: false, showTransferPrice: true, showNetPrice: true },
  header: { layout: "logo-center", sticky: true, transparentOnHome: true, showSearch: true },
  layout: { density: "airy", containerWidth: "wide", gridColumns: { mobile: 2, desktop: 3 } },
  footer: { style: "simple", showSocial: true, showPayments: false, showCredit: true },
  style: { hero: "cover", titles: "centered", shape: "rect", card: "stack", motion: "soft", grid: "feature", filters: "drawer", gallery: "grid" },
  effects: { shadows: "none", dividers: false, imageFilter: "none" },
};

/**
 * Artesanías, deco, dietética, mates y textiles.
 * Se distingue por la calidez de feria: papel crema, mostaza en la banda de
 * anuncio, Fraunces 700 y el verde bosque del botón pill, como un sello.
 * Disposición: logo grande arriba y el menú debajo (toldo); tarjetas en caja
 * con la foto en arco y el botón siempre visible; categorías en pastillas
 * arriba del catálogo; ficha con carrusel a sangre; pie en banda verde que
 * entra con un arco.
 */
const mercado: Theme = {
  preset: "mercado",
  colors: {
    background: "#FBF4E6",
    surface: "#FFFFFF",
    text: "#2A1F14",
    textMuted: "#5E4F3F",
    primary: "#2F5D46",
    primaryText: "#FFFBF3",
    secondary: "#F4CF6B",
    accent: "#A8431F",
    border: "#E6D7BC",
    success: "#3E6B2F",
    danger: "#8F2445",
  },
  fonts: {
    heading: "fraunces",
    body: "nunito-sans",
    headingWeight: 700,
    bodyWeight: 400,
    headingTransform: "none",
    headingTracking: "tight",
    baseSize: 17,
  },
  radius: "md",
  buttons: { style: "solid", shape: "pill", uppercase: false },
  cards: { style: "bordered", imageRatio: "1:1", hover: "lift", showSku: false, showBrand: false, showTransferPrice: true, showNetPrice: true },
  header: { layout: "stacked", sticky: true, transparentOnHome: false, showSearch: true },
  layout: { density: "comfortable", containerWidth: "normal", gridColumns: { mobile: 2, desktop: 4 } },
  footer: { style: "band", showSocial: true, showPayments: true, showCredit: true },
  style: { hero: "framed", titles: "plain", shape: "arch", card: "boxed", motion: "soft", grid: "uniform", filters: "bar", gallery: "carousel" },
  effects: { shadows: "none", dividers: false, imageFilter: "grain" },
};

/**
 * Electro, hogar, ferretería, importadoras. Default de una tienda nueva.
 * Se distingue por la precisión de vidriera técnica: 5 columnas de tarjetas
 * blancas con borde fino sobre gris claro (cada foto de fábrica queda en su
 * caja), SKU y marca a la vista y un solo rojo para precio promo y errores.
 * Sin reglas entre celdas: la grilla-tabla es de `galpon`.
 * Disposición: logo, menú y buscador en una fila; tarjetas en caja con el
 * botón "Agregar" siempre visible; filtros al costado; ficha clásica con
 * miniaturas y zoom; títulos con regla; nada se mueve (catálogo para comprar rápido).
 */
const nordico: Theme = {
  preset: "nordico",
  colors: {
    background: "#F4F5F6",
    surface: "#FFFFFF",
    text: "#16181C",
    textMuted: "#5B616B",
    primary: "#1E3A5F",
    primaryText: "#FFFFFF",
    secondary: "#E6E9ED",
    accent: "#B42318",
    border: "#DADDE2",
    success: "#1A6E45",
    danger: "#B42318",
  },
  fonts: {
    heading: "sora",
    body: "manrope",
    headingWeight: 600,
    bodyWeight: 400,
    headingTransform: "none",
    headingTracking: "tight",
    baseSize: 15,
  },
  radius: "sm",
  buttons: { style: "solid", shape: "radius", uppercase: false },
  cards: { style: "bordered", imageRatio: "1:1", hover: "zoom", showSku: true, showBrand: true, showTransferPrice: true, showNetPrice: true },
  header: { layout: "logo-left", sticky: true, transparentOnHome: false, showSearch: true },
  layout: { density: "compact", containerWidth: "wide", gridColumns: { mobile: 2, desktop: 5 } },
  footer: { style: "columns", showSocial: true, showPayments: true, showCredit: true },
  style: { hero: "split", titles: "rule", shape: "soft", card: "boxed", motion: "none", grid: "uniform", filters: "sidebar", gallery: "thumbs" },
  effects: { shadows: "none", dividers: false, imageFilter: "none" },
};

/**
 * Streetwear local, editoriales independientes, bicicletas, skate.
 * Se distingue por la tipografía: Barlow Condensed 800 en mayúsculas, reglas
 * negras que arman la grilla y tres tintas (negro, amarillo y un solo rojo señal).
 * Disposición: header mínimo en texto; anuncio en marquesina; tarjetas con
 * nombre y precio sobre la foto; destacados a doble tamaño; títulos con la
 * cantidad volada como índice; ficha con fotos apiladas a ancho completo; el
 * nombre de la tienda gigante como cierre del pie.
 */
const editorial: Theme = {
  preset: "editorial",
  colors: {
    background: "#FFFFFF",
    surface: "#F2F2F0",
    text: "#0A0A0A",
    textMuted: "#595959",
    primary: "#0A0A0A",
    primaryText: "#FFFFFF",
    secondary: "#FFE14D",
    accent: "#CF0A0A",
    border: "#0A0A0A",
    success: "#0B7A3B",
    danger: "#CF0A0A",
  },
  fonts: {
    heading: "barlow-condensed",
    body: "schibsted-grotesk",
    headingWeight: 800,
    bodyWeight: 400,
    headingTransform: "uppercase",
    headingTracking: "tight",
    baseSize: 16,
  },
  radius: "none",
  buttons: { style: "solid", shape: "square", uppercase: true },
  cards: { style: "flat", imageRatio: "3:4", hover: "none", showSku: false, showBrand: false, showTransferPrice: true, showNetPrice: true },
  header: { layout: "minimal", sticky: true, transparentOnHome: true, showSearch: true },
  layout: { density: "comfortable", containerWidth: "wide", gridColumns: { mobile: 2, desktop: 4 } },
  footer: { style: "statement", showSocial: true, showPayments: false, showCredit: true },
  style: { hero: "poster", titles: "index", shape: "rect", card: "overlay", motion: "lively", grid: "feature", filters: "drawer", gallery: "stack" },
  effects: { shadows: "none", dividers: true, imageFilter: "none" },
};

/**
 * Gaming, periféricos, audio, vinilos y sintetizadores.
 * Se distingue por el ámbar de fósforo (el de los vúmetros y los monitores CRT)
 * sobre grafito neutro, títulos en Chivo Mono como una ficha técnica y un solo
 * color vivo, que es CTA y precio promo a la vez: nada más brilla.
 * Disposición: doble barra con el buscador grande y los rubros en una banda
 * ámbar; anuncio en marquesina; baldosas grafito con un "+" ámbar que gira;
 * títulos con etiqueta mono; filtros al costado como una ficha de specs.
 */
const neon: Theme = {
  preset: "neon",
  colors: {
    background: "#0D0D0C",
    surface: "#171716",
    text: "#ECEAE4",
    textMuted: "#A19D94",
    primary: "#FFB21E",
    primaryText: "#14110A",
    secondary: "#24231F",
    accent: "#FFB21E",
    border: "#2E2D29",
    success: "#8FCB7E",
    danger: "#FF5147",
  },
  fonts: {
    heading: "chivo-mono",
    body: "archivo",
    headingWeight: 600,
    bodyWeight: 400,
    headingTransform: "uppercase",
    headingTracking: "normal",
    baseSize: 16,
  },
  radius: "sm",
  buttons: { style: "solid", shape: "radius", uppercase: false },
  cards: { style: "elevated", imageRatio: "1:1", hover: "lift", showSku: false, showBrand: true, showTransferPrice: true, showNetPrice: true },
  header: { layout: "double", sticky: true, transparentOnHome: false, showSearch: true },
  layout: { density: "comfortable", containerWidth: "normal", gridColumns: { mobile: 2, desktop: 4 } },
  footer: { style: "columns", showSocial: true, showPayments: true, showCredit: true },
  style: { hero: "split", titles: "tag", shape: "soft", card: "tile", motion: "lively", grid: "uniform", filters: "sidebar", gallery: "thumbs" },
  effects: { shadows: "soft", dividers: false, imageFilter: "none" },
};

/**
 * Farmacia, perfumería, dermocosmética, herboristería.
 * Se distingue por la legibilidad: Atkinson Hyperlegible (distingue 1/l/I y 0/O,
 * clave en "10 ml" o "FPS 50") a 17px para un público que incluye gente mayor,
 * títulos en IBM Plex Mono como etiqueta de frasco y packshots sobre baldosa verde agua.
 * Disposición: header de una fila con buscador; categorías en pastillas arriba
 * del catálogo; fotos con esquinas suaves; títulos con etiqueta oscura.
 */
const botica: Theme = {
  preset: "botica",
  colors: {
    background: "#F7F9F8",
    surface: "#EAF1EE",
    text: "#10201C",
    textMuted: "#4B5C57",
    primary: "#0D5C55",
    primaryText: "#FFFFFF",
    secondary: "#DCEBE5",
    accent: "#A3195B",
    border: "#D3DEDA",
    success: "#2F6B1A",
    danger: "#B02A1E",
  },
  fonts: {
    heading: "ibm-plex-mono",
    body: "atkinson-hyperlegible-next",
    headingWeight: 500,
    bodyWeight: 400,
    headingTransform: "none",
    headingTracking: "normal",
    baseSize: 17,
  },
  radius: "md",
  buttons: { style: "solid", shape: "radius", uppercase: false },
  cards: { style: "flat", imageRatio: "1:1", hover: "zoom", showSku: false, showBrand: true, showTransferPrice: true, showNetPrice: true },
  header: { layout: "logo-left", sticky: true, transparentOnHome: false, showSearch: true },
  layout: { density: "comfortable", containerWidth: "normal", gridColumns: { mobile: 2, desktop: 4 } },
  footer: { style: "columns", showSocial: true, showPayments: true, showCredit: true },
  style: { hero: "framed", titles: "tag", shape: "soft", card: "stack", motion: "soft", grid: "uniform", filters: "bar", gallery: "thumbs" },
  effects: { shadows: "none", dividers: false, imageFilter: "none" },
};

/**
 * Librería, papelería, juguetería, ropa infantil.
 * Se distingue por el color sin infantilizar: página celeste guardapolvo,
 * tarjetas blancas sin borde (papel sobre la mesa), un único mandarina para
 * CTA y promo, y Bricolage Grotesque con carácter en los títulos.
 * Disposición: header en una pastilla-burbuja flotante; baldosas blancas con un
 * "+" mandarina; todo con forma de burbuja; productos que entran escalonados;
 * ficha con carrusel; pie en banda mandarina.
 */
const recreo: Theme = {
  preset: "recreo",
  colors: {
    background: "#F1F6FB",
    surface: "#FFFFFF",
    text: "#14202E",
    textMuted: "#4F5D6C",
    primary: "#B03C0B",
    primaryText: "#FFFFFF",
    secondary: "#FFE3B8",
    accent: "#B03C0B",
    border: "#D3DEEA",
    success: "#1D6B45",
    danger: "#A61C44",
  },
  fonts: {
    heading: "bricolage-grotesque",
    body: "figtree",
    headingWeight: 700,
    bodyWeight: 400,
    headingTransform: "none",
    headingTracking: "tight",
    baseSize: 16,
  },
  radius: "md",
  buttons: { style: "solid", shape: "radius", uppercase: false },
  cards: { style: "elevated", imageRatio: "1:1", hover: "zoom", showSku: false, showBrand: true, showTransferPrice: true, showNetPrice: true },
  header: { layout: "pill", sticky: true, transparentOnHome: false, showSearch: true },
  layout: { density: "comfortable", containerWidth: "normal", gridColumns: { mobile: 2, desktop: 4 } },
  footer: { style: "band", showSocial: true, showPayments: true, showCredit: true },
  style: { hero: "stack", titles: "plain", shape: "bubble", card: "tile", motion: "lively", grid: "uniform", filters: "bar", gallery: "carousel" },
  effects: { shadows: "none", dividers: false, imageFilter: "none" },
};

/**
 * Mueblería, iluminación, objetos de diseño, carpintería a medida.
 * Se distingue por el formato apaisado: fotos 16:9 (mesas, sillones y aparadores
 * son horizontales) en 1 columna mobile y 3 en desktop, Newsreader de revista de
 * interiores, madera de lapacho en el botón outline y el rosa de su flor para promos.
 * Curado 2026-10: fondo piedra (antes greige crema) y Syne en títulos (antes
 * Newsreader), para separarlo de atelier y mercado.
 * Disposición: header transparente sobre la portada; destacados a doble tamaño;
 * ficha con carrusel a todo el ancho y la compra debajo; pie mínimo.
 */
const lapacho: Theme = {
  preset: "lapacho",
  colors: {
    background: "#EEECE7",
    surface: "#FFFFFF",
    text: "#1F1A17",
    textMuted: "#5C554F",
    primary: "#4E3426",
    primaryText: "#F7F3EE",
    secondary: "#E0DBD2",
    accent: "#B0306A",
    border: "#D4CEC4",
    success: "#3C6B3F",
    danger: "#A8281E",
  },
  fonts: {
    heading: "syne",
    body: "karla",
    headingWeight: 600,
    bodyWeight: 400,
    headingTransform: "none",
    headingTracking: "tight",
    baseSize: 16,
  },
  radius: "sm",
  buttons: { style: "outline", shape: "radius", uppercase: false },
  cards: { style: "flat", imageRatio: "16:9", hover: "zoom", showSku: false, showBrand: false, showTransferPrice: true, showNetPrice: true },
  header: { layout: "logo-left", sticky: true, transparentOnHome: true, showSearch: true },
  layout: { density: "airy", containerWidth: "wide", gridColumns: { mobile: 1, desktop: 3 } },
  footer: { style: "minimal", showSocial: true, showPayments: true, showCredit: true },
  style: { hero: "cover", titles: "plain", shape: "rect", card: "stack", motion: "soft", grid: "feature", filters: "bar", gallery: "carousel" },
  effects: { shadows: "none", dividers: false, imageFilter: "none" },
};

/**
 * Mayoristas, distribuidoras, corralones, repuestos.
 * Se distingue por la nota de pedido: birome azul para el CTA, birome roja para
 * precio promo y errores, resaltador amarillo en las bandas; Archivo Narrow en
 * mayúsculas para rubros largos, IBM Plex Sans a 15px con cifras tabulares y
 * celdas planas separadas por reglas, sin radios ni hover decorativo.
 * Disposición: buscador protagonista y banda azul de rubros; el catálogo es
 * una lista de precios (una fila por producto: foto chica, SKU, precio y
 * "Agregar"); filtros al costado; nada se mueve.
 */
const galpon: Theme = {
  preset: "galpon",
  colors: {
    background: "#FFFFFF",
    surface: "#F3F3F0",
    text: "#161616",
    textMuted: "#565656",
    primary: "#1F3FB0",
    primaryText: "#FFFFFF",
    secondary: "#FFF1A8",
    accent: "#C0161C",
    border: "#D9D9D4",
    success: "#1E6B35",
    danger: "#C0161C",
  },
  fonts: {
    heading: "archivo-narrow",
    body: "ibm-plex-sans",
    headingWeight: 600,
    bodyWeight: 400,
    headingTransform: "uppercase",
    headingTracking: "normal",
    baseSize: 15,
  },
  radius: "none",
  buttons: { style: "solid", shape: "square", uppercase: false },
  cards: { style: "flat", imageRatio: "1:1", hover: "none", showSku: true, showBrand: true, showTransferPrice: true, showNetPrice: true },
  header: { layout: "double", sticky: true, transparentOnHome: false, showSearch: true },
  layout: { density: "compact", containerWidth: "wide", gridColumns: { mobile: 2, desktop: 5 } },
  footer: { style: "simple", showSocial: true, showPayments: true, showCredit: true },
  style: { hero: "split", titles: "rule", shape: "rect", card: "row", motion: "none", grid: "list", filters: "sidebar", gallery: "thumbs" },
  effects: { shadows: "none", dividers: true, imageFilter: "none" },
};

/**
 * Vinoteca, almacén gourmet, café de especialidad, destilados.
 * Se distingue por la cava: fondo vino casi negro, texto crema, CTA color papel
 * de etiqueta y rosado para promos. Es el único preset con serif en el cuerpo
 * (Literata a 17px) para las notas de cata largas; Libre Caslon en títulos.
 * Disposición: logo grande arriba y el menú debajo; botellas en arco;
 * títulos centrados; ficha con fotos en grilla; el nombre gigante al pie.
 */
const bodega: Theme = {
  preset: "bodega",
  colors: {
    background: "#1A1214",
    surface: "#241A1C",
    text: "#EFE6DA",
    textMuted: "#B3A597",
    primary: "#E9DCC3",
    primaryText: "#1A1214",
    secondary: "#2E2224",
    accent: "#F0A58F",
    border: "#3A2C2E",
    success: "#A9C98F",
    danger: "#FF6B81",
  },
  fonts: {
    heading: "libre-caslon-text",
    body: "literata",
    headingWeight: 400,
    bodyWeight: 400,
    headingTransform: "none",
    headingTracking: "normal",
    baseSize: 17,
  },
  radius: "sm",
  buttons: { style: "solid", shape: "radius", uppercase: false },
  cards: { style: "flat", imageRatio: "3:4", hover: "zoom", showSku: false, showBrand: true, showTransferPrice: true, showNetPrice: true },
  header: { layout: "stacked", sticky: true, transparentOnHome: false, showSearch: true },
  layout: { density: "comfortable", containerWidth: "normal", gridColumns: { mobile: 2, desktop: 4 } },
  footer: { style: "statement", showSocial: true, showPayments: true, showCredit: true },
  style: { hero: "cover", titles: "centered", shape: "arch", card: "stack", motion: "soft", grid: "uniform", filters: "sidebar", gallery: "grid" },
  effects: { shadows: "none", dividers: false, imageFilter: "none" },
};

export const PRESETS: Record<Exclude<PresetId, "custom">, Theme> = {
  atelier,
  mercado,
  nordico,
  editorial,
  neon,
  botica,
  recreo,
  lapacho,
  galpon,
  bodega,
};

/** Orden del selector: los de Free primero, después los claros y los oscuros al final. */
export const PRESET_LIST: PresetMeta[] = [
  {
    id: "nordico",
    name: "Nórdico",
    description: "Vidriera de electro: buscador y menú arriba, tarjetas en caja con el botón a la vista y filtros al costado.",
    industries: ["Electro", "Hogar", "Ferretería", "Importadoras"],
    mood: "Preciso y denso",
  },
  {
    id: "mercado",
    name: "Mercado",
    description: "Puesto de feria: logo grande arriba, fotos en arco dentro de cajas crema y un pie verde que entra curvo.",
    industries: ["Artesanías", "Deco", "Dietética", "Mates"],
    mood: "Cálido y cercano",
  },
  {
    id: "atelier",
    name: "Atelier",
    description: "La ropa habla: logo al centro, Cormorant, un destacado a doble tamaño cada diez y todas las fotos de la ficha a la vista.",
    industries: ["Moda", "Joyería", "Marroquinería", "Lencería"],
    mood: "Silencioso y aireado",
  },
  {
    id: "editorial",
    name: "Editorial",
    description: "Tapa de revista: titulares condensados, nombre y precio sobre la foto, marquesina y el nombre gigante al pie.",
    industries: ["Streetwear", "Editoriales", "Bicicletas", "Skate"],
    mood: "Tipográfico y directo",
  },
  {
    id: "botica",
    name: "Botica",
    description: "Se lee sin anteojos: Atkinson a 17px, etiquetas de frasco en mono y categorías en pastillas arriba del catálogo.",
    industries: ["Farmacia", "Perfumería", "Dermocosmética", "Herboristería"],
    mood: "Clínico y legible",
  },
  {
    id: "recreo",
    name: "Recreo",
    description: "Celeste guardapolvo: header en burbuja flotante, baldosas con un + mandarina y un pie de color que entra curvo.",
    industries: ["Librería", "Papelería", "Juguetería", "Ropa infantil"],
    mood: "Vivo y ordenado",
  },
  {
    id: "lapacho",
    name: "Lapacho",
    description: "Fotos apaisadas, Syne de galería y la ficha con un carrusel a todo el ancho: para sillones, mesas y lámparas.",
    industries: ["Mueblería", "Iluminación", "Objetos de diseño", "Carpintería"],
    mood: "Amplio y material",
  },
  {
    id: "galpon",
    name: "Galpón",
    description: "Lista de precios: buscador protagonista, banda azul de rubros y una fila por producto con el botón a mano.",
    industries: ["Mayoristas", "Distribuidoras", "Corralones", "Repuestos"],
    mood: "Denso y sin vueltas",
  },
  {
    id: "bodega",
    name: "Bodega",
    description: "Carta de vinos: logo grande arriba, botellas en arco, serif en el cuerpo y el nombre gigante al pie.",
    industries: ["Vinoteca", "Almacén gourmet", "Café de especialidad", "Destilados"],
    mood: "Nocturno y pausado",
  },
  {
    id: "neon",
    name: "Neón",
    description: "Grafito y un solo ámbar: banda de rubros ámbar, baldosas con un + que gira y títulos mono de ficha técnica.",
    industries: ["Gaming", "Periféricos", "Audio", "Vinilos"],
    mood: "Oscuro y disciplinado",
  },
];

export const DEFAULT_THEME: Theme = nordico;
