import { HISTORIAS } from "./historias";
import { POSTS } from "./posts";
import type { RedFormat, RedPiece, Slide } from "./types";

export * from "./types";
export { HASHTAGS } from "./posts";

/** Todas las piezas del kit, en el orden del kit: posts y reels, después historias. */
export const RED_PIECES: RedPiece[] = [...POSTS, ...HISTORIAS];

/** Pieza por código ("P01" o "p01"). */
export function getRedPiece(id: string): RedPiece | undefined {
  const code = id.toUpperCase();
  return RED_PIECES.find((p) => p.id === code);
}

/** Valores escritos por el dueño, por `FillField.key`. */
export type FillValues = Record<string, string>;

const MAX_VALUE = 60;

/** Limpia un valor que llega por la URL: una línea, sin caracteres de control, 60 como máximo. */
export function cleanFillValue(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_VALUE);
}

/** Toma de `params` sólo los campos que declara la pieza, ya limpios. Los vacíos no cuentan. */
export function fillValuesFrom(piece: RedPiece, get: (key: string) => string | null | undefined): FillValues {
  const out: FillValues = {};
  for (const f of piece.fields ?? []) {
    const v = cleanFillValue(get(f.key));
    if (v) out[f.key] = v;
  }
  return out;
}

/** Reemplaza en `text` los tokens de la pieza que tengan valor. */
export function fillText(piece: RedPiece, text: string, values: FillValues): string {
  let out = text;
  for (const f of piece.fields ?? []) {
    const v = values[f.key];
    if (v) out = out.split(f.token).join(v);
  }
  return out;
}

function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === "string") return fn(value) as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)])) as T;
  }
  return value;
}

/** La placa con los valores del dueño aplicados. */
export function fillSlide(piece: RedPiece, slide: Slide, values: FillValues): Slide {
  return mapStrings(slide, (s) => fillText(piece, s, values));
}

/** Todos los textos de una placa, en orden (para buscar tokens y en los tests). */
export function slideTexts(slide: Slide): string[] {
  const out: string[] = [];
  mapStrings(slide, (s) => {
    out.push(s);
    return s;
  });
  return out;
}

/** Tokens "[…]" que siguen sin completar en estos textos (sin repetidos). */
export function pendingTokens(texts: string[]): string[] {
  const found = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(/\[[^\]\n]{1,40}\]/g)) found.add(m[0]);
  return [...found];
}

/**
 * Texto para copiar. Posts y reels: gancho, texto, CTA y hashtags, listo para
 * la publicación. Historias: el texto de cada pantalla, numerado, y el sticker.
 * Con los valores del dueño aplicados.
 */
export function captionFor(piece: RedPiece, values: FillValues = {}): string {
  const parts =
    piece.kind === "historias"
      ? [
          piece.slides
            .map((s, i) => {
              const t =
                s.template === "antes-despues"
                  ? [s.title]
                  : s.template === "dato"
                    ? [s.kicker, s.value, s.body]
                    : s.template === "lista"
                      ? [s.kicker, s.title, ...s.items]
                      : [s.kicker, s.title, s.body];
              return `${i + 1}) ${t.filter(Boolean).join(" · ")}`;
            })
            .join("\n"),
          piece.cta,
        ]
      : [piece.hook, piece.caption, piece.cta, piece.hashtags.join(" ")];
  return fillText(piece, parts.filter((p): p is string => Boolean(p && p.trim())).join("\n\n"), values);
}

/** Nombre del PNG descargado: "ecommy-p03-2-feed.png". */
export function redFileName(piece: RedPiece, slide: number, format: RedFormat): string {
  const n = piece.slides.length > 1 ? `-${slide}` : "";
  return `ecommy-${piece.id.toLowerCase()}${n}-${format}.png`;
}

/** URL de la imagen de una placa (relativa a la plataforma). */
export function redImageHref(
  piece: RedPiece,
  opts: { format: RedFormat; slide: number; values?: FillValues; download?: boolean },
): string {
  const q = new URLSearchParams({ format: opts.format });
  if (opts.slide > 1) q.set("placa", String(opts.slide));
  for (const [k, v] of Object.entries(opts.values ?? {})) if (v) q.set(k, v);
  if (opts.download) q.set("download", "1");
  return `/platform/redes/${piece.id.toLowerCase()}/image?${q.toString()}`;
}
