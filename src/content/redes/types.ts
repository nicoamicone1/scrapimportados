/*
 * Kit de imágenes para redes (/platform/redes). Cada pieza es un post, reel
 * o secuencia de historias de `docs/SOCIAL-KIT.md` (§2 y §3) con el copy tal
 * cual y sus placas como datos; las plantillas que las dibujan están en
 * `src/app/_brand/social-templates.tsx` (Satori, vía `ImageResponse`).
 *
 * Lo que depende de una grabación real ("cronometrado", "[tiempo real]") o
 * de una respuesta del público va entre corchetes y se declara en `campos`:
 * la pieza queda marcada "Completar antes de publicar" hasta que el dueño
 * escribe el valor en la galería.
 */

/** feed: 1080×1080 (post, placa de carrusel). story: 1080×1920 (historia o portada de reel). */
export type RedFormat = "feed" | "story";

export const RED_FORMATS: readonly RedFormat[] = ["feed", "story"];

export const FORMAT_SIZE: Record<RedFormat, { width: number; height: number }> = {
  feed: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

export const FORMAT_LABEL: Record<RedFormat, string> = {
  feed: "Feed 1080 × 1080",
  story: "Vertical 1080 × 1920",
};

export type RedChannel = "instagram" | "tiktok";

export const CHANNEL_LABEL: Record<RedChannel, string> = { instagram: "Instagram", tiktok: "TikTok" };

export type RedKind = "reel" | "carrusel" | "historias";

export const KIND_LABEL: Record<RedKind, string> = { reel: "Reel", carrusel: "Carrusel", historias: "Historias" };

/** Fondo de la placa: crema (default) o verde-tinta, para cerrar un carrusel. */
export type Tone = "crema" | "tinta";

/** (a) Titular grande. `acento` sigue al titular en pino (ámbar sobre tinta). */
export interface HookSlide {
  template: "gancho";
  kicker?: string;
  title: string;
  accent?: string;
  body?: string;
  tone?: Tone;
}

/** (b) Número o valor grande + explicación. */
export interface FactSlide {
  template: "dato";
  kicker: string;
  value: string;
  body: string;
}

/** (c) De 2 a 4 ítems separados por reglas finas. */
export interface ListSlide {
  template: "lista";
  kicker?: string;
  title: string;
  items: string[];
}

/** (d) Dos columnas: izquierda (antes / no) y derecha (después / sí). */
export interface CompareSlide {
  template: "antes-despues";
  title: string;
  before: { label: string; items: string[] };
  after: { label: string; items: string[] };
  note?: string;
}

/** (e) Marco verde-tinta con un rectángulo crema vacío para pegar una captura real. */
export interface ScreenshotSlide {
  template: "captura";
  kicker?: string;
  title: string;
  body?: string;
  /** Leyenda dentro del rectángulo. Default: "Pegá acá la captura del panel". */
  placeholder?: string;
}

/** Sticker nativo de Instagram que se agrega al publicar: la placa le deja lugar abajo. */
export type StickerKind = "link" | "encuesta" | "pregunta";

/** (f) Historia vertical: titular + texto + CTA. */
export interface StorySlide {
  template: "historia";
  kicker?: string;
  title: string;
  body?: string;
  /** CTA en ámbar al pie ("Link en la bio"). */
  cta?: string;
  sticker?: StickerKind;
}

export type Slide = HookSlide | FactSlide | ListSlide | CompareSlide | ScreenshotSlide | StorySlide;

export type TemplateId = Slide["template"];

export const TEMPLATE_LABEL: Record<TemplateId, string> = {
  gancho: "Gancho",
  dato: "Dato",
  lista: "Lista",
  "antes-despues": "Antes y después",
  captura: "Captura",
  historia: "Historia",
};

/** Valor que el dueño completa antes de publicar (aparece como `token` en el copy y en las placas). */
export interface FillField {
  /** Nombre del parámetro en la URL de la imagen: minúsculas y guiones. */
  key: string;
  /** Texto literal entre corchetes: "[tiempo real]". */
  token: string;
  label: string;
  /** Ejemplo para el campo (placeholder del input). */
  example?: string;
}

export interface RedPiece {
  /** Código del kit: P01…P15, H01…H10. */
  id: string;
  kind: RedKind;
  name: string;
  formats: RedFormat[];
  channels: RedChannel[];
  /** Días del calendario de `docs/LAUNCH-PLAN.md` §5. */
  days: number[];
  /** Gancho: lo primero que se lee (≤ 90 caracteres). */
  hook: string;
  /** Texto del post (caption). Las historias no tienen. */
  caption?: string;
  cta?: string;
  hashtags: string[];
  /** Condición de verdad o revisión que tiene que cumplirse antes de publicar. */
  check?: string;
  fields?: FillField[];
  slides: Slide[];
}
