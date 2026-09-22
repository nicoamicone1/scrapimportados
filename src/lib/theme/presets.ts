import type { PresetId, Theme } from "./schema";

/**
 * Presets del tema (docs/DESIGN.md §4). Cada uno define TODOS los campos:
 * elegirlo copia el objeto completo; cualquier edición posterior pasa
 * `preset` a "custom". Contrastes verificados en DESIGN.md.
 */

export interface PresetMeta {
  id: Exclude<PresetId, "custom">;
  name: string;
  description: string;
}

/** Moda, joyería, marroquinería. Silencio: mucho aire, poca UI. */
const atelier: Theme = {
  preset: "atelier",
  colors: {
    background: "#FAF8F4",
    surface: "#F1EDE6",
    text: "#1B1A18",
    textMuted: "#6A655D",
    primary: "#1B1A18",
    primaryText: "#FAF8F4",
    secondary: "#E8E1D5",
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
  footer: { style: "columns", showSocial: true, showPayments: false },
  effects: { shadows: "none", dividers: true, imageFilter: "none" },
};

/** Artesanías, deco, dietética, feria. Un puesto cuidado, no un marketplace. */
const mercado: Theme = {
  preset: "mercado",
  colors: {
    background: "#F6F0E4",
    surface: "#FFFBF3",
    text: "#2B2118",
    textMuted: "#6B5C4B",
    primary: "#2F5D46",
    primaryText: "#FFFBF3",
    secondary: "#EADFC9",
    accent: "#A8431F",
    border: "#DCCFB8",
    success: "#3E6B2F",
    danger: "#A8321F",
  },
  fonts: {
    heading: "fraunces",
    body: "nunito-sans",
    headingWeight: 600,
    bodyWeight: 400,
    headingTransform: "none",
    headingTracking: "tight",
    baseSize: 17,
  },
  radius: "lg",
  buttons: { style: "soft", shape: "pill", uppercase: false },
  cards: { style: "bordered", imageRatio: "1:1", hover: "lift", showSku: false, showBrand: false, showTransferPrice: true, showNetPrice: true },
  header: { layout: "logo-left", sticky: true, transparentOnHome: false, showSearch: true },
  layout: { density: "comfortable", containerWidth: "normal", gridColumns: { mobile: 2, desktop: 4 } },
  footer: { style: "columns", showSocial: true, showPayments: true },
  effects: { shadows: "soft", dividers: false, imageFilter: "grain" },
};

/** Electro, hogar, ferretería, importadoras. Precisión: se escanea como una planilla. Default. */
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
    success: "#1F7A4D",
    danger: "#9F1D1D",
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
  footer: { style: "columns", showSocial: true, showPayments: true },
  effects: { shadows: "none", dividers: true, imageFilter: "none" },
};

/** Marcas con actitud. Los títulos son la imagen. */
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
    accent: "#D90B0B",
    border: "#0A0A0A",
    success: "#0B7A3B",
    danger: "#C20000",
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
  footer: { style: "simple", showSocial: true, showPayments: false },
  effects: { shadows: "none", dividers: true, imageFilter: "none" },
};

/** Gaming, periféricos, streetwear nocturno. Un solo color vivo. */
const neon: Theme = {
  preset: "neon",
  colors: {
    background: "#0B0B0F",
    surface: "#15151C",
    text: "#EDEDF2",
    textMuted: "#9D9DAB",
    primary: "#C6FF3D",
    primaryText: "#0B0B0F",
    secondary: "#22222C",
    accent: "#C6FF3D",
    border: "#2A2A35",
    success: "#4ADE80",
    danger: "#FF6B6B",
  },
  fonts: {
    heading: "unbounded",
    body: "space-grotesk",
    headingWeight: 600,
    bodyWeight: 400,
    headingTransform: "none",
    headingTracking: "tight",
    baseSize: 16,
  },
  radius: "md",
  buttons: { style: "solid", shape: "radius", uppercase: false },
  cards: { style: "elevated", imageRatio: "1:1", hover: "lift", showSku: false, showBrand: true, showTransferPrice: true, showNetPrice: true },
  header: { layout: "logo-left", sticky: true, transparentOnHome: false, showSearch: true },
  layout: { density: "comfortable", containerWidth: "normal", gridColumns: { mobile: 2, desktop: 4 } },
  footer: { style: "columns", showSocial: true, showPayments: true },
  effects: { shadows: "soft", dividers: false, imageFilter: "none" },
};

export const PRESETS: Record<Exclude<PresetId, "custom">, Theme> = {
  atelier,
  mercado,
  nordico,
  editorial,
  neon,
};

export const PRESET_LIST: PresetMeta[] = [
  { id: "nordico", name: "Nórdico", description: "Electro, hogar, ferretería. Preciso y denso, se escanea como una planilla." },
  { id: "atelier", name: "Atelier", description: "Moda y joyería. Serif alta, blanco roto, sin radios, mucho aire." },
  { id: "mercado", name: "Mercado", description: "Artesanías y deco. Crema, verde bosque, formas redondeadas." },
  { id: "editorial", name: "Editorial", description: "Marcas con actitud. Titulares condensados, reglas negras." },
  { id: "neon", name: "Neón", description: "Gaming y streetwear. Fondo oscuro con un único acento lima." },
];

export const DEFAULT_THEME: Theme = nordico;
