import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { CSSProperties, ReactNode } from "react";

import type {
  CompareSlide,
  FactSlide,
  HookSlide,
  ListSlide,
  RedFormat,
  ScreenshotSlide,
  Slide,
  StorySlide,
  Tone,
} from "@/content/redes/types";

import {
  BRAND_BORDER,
  BRAND_BRUMA,
  BRAND_DURAZNO,
  BRAND_INK,
  BRAND_INK_2,
  BRAND_MIST,
  BRAND_MUTED,
  BRAND_NIEBLA,
  BRAND_PAPER,
  BRAND_POMELO,
  BRAND_POMELO_INK,
  BrandGlyph,
  bubbleRadii,
} from "./glyph";

/*
 * Plantillas de las piezas para redes (/platform/redes), dibujadas con
 * `ImageResponse` (Satori): sólo `div` con estilos inline, flexbox, sin grid
 * ni variables CSS. Identidad 2026-10 (BRAND.md §4, §5, §7): niebla y tinta
 * noche de base, pomelo como marca, la burbuja (logo, números de la lista,
 * recuadro de la captura), el arco (cuartos de círculo planos o anillos finos
 * saliendo de una esquina) y la pastilla (CTA de la historia). Sin
 * gradientes, sombras, íconos ni celulares flotando (guía de tono de
 * SOCIAL-KIT §0).
 *
 * Tipografía: Archivo expandida 800 para titulares, valores y wordmark;
 * Archivo 400/600 para el texto. Se baja de Google Fonts en tiempo de
 * ejecución (`loadBrandFonts`); sin red cae en Geist Regular, la única fuente
 * que trae `ImageResponse` (`next/dist/compiled/@vercel/og`).
 *
 * Márgenes: 96 px a los lados. En vertical (1080 × 1920) el contenido deja
 * libres ~220 px arriba y ~260 abajo, donde Instagram pone la barra de
 * progreso, el perfil y el campo de respuesta, y se centra en el alto para
 * que el recorte 3:4 de la portada de un reel en la grilla no lo corte. Los
 * arcos son decoración: pueden entrar en esas zonas, el texto no.
 */

// ---------------------------------------------------------------------------
// Fuentes
// ---------------------------------------------------------------------------

export const FONT_FAMILY = "Geist";
const FONT_PATH = join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf");

type FontWeight = 400 | 500 | 600 | 700 | 800;
export interface SocialFont {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight;
  style: "normal";
}

/**
 * Copia de un TTF sin la tabla GPOS. Satori mide cada palabra sin kerning
 * pero la dibuja con kerning, así que después de las palabras con pares
 * ajustados ("ro", "Tu", "Wh") quedaba un espacio de más ("Cronómetro  en").
 * Sin GPOS, medida y dibujo coinciden. Renombra la tabla a "XPOS" (ignorada).
 */
export function stripGpos(file: Uint8Array): ArrayBuffer {
  const buf = new Uint8Array(file);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tables = view.getUint16(4);
  for (let i = 0; i < tables; i++) {
    const at = 12 + i * 16;
    if (String.fromCharCode(...buf.subarray(at, at + 4)) === "GPOS") buf.set([88, 80, 79, 83], at);
  }
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

let fontsPromise: Promise<{ name: string; data: ArrayBuffer; weight: 400; style: "normal" }[] | undefined> | null = null;

/**
 * Geist Regular sin GPOS (ver `stripGpos`). Se lee una vez por proceso; si el
 * archivo no está, `undefined` y `ImageResponse` usa su fuente por defecto
 * (la misma Geist, con los espacios desparejos).
 */
export function loadSocialFonts() {
  fontsPromise ??= readFile(FONT_PATH)
    .then((file) => [{ name: FONT_FAMILY, data: stripGpos(file), weight: 400 as const, style: "normal" as const }])
    .catch(() => undefined);
  return fontsPromise;
}

export interface BrandFonts {
  fonts: SocialFont[];
  /** Familia para titulares, valores y wordmark. */
  display: string;
  /** Familia para el texto. */
  text: string;
}

const DISPLAY_CSS = "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@112.5,800";
const TEXT_CSS = "https://fonts.googleapis.com/css2?family=Archivo:wght@400;600";
const FETCH_TIMEOUT = 4000;

/**
 * Pesos → URL del TTF de una hoja de Google Fonts. Sin user-agent, la CSS API
 * devuelve TTF; si trae varios subsets (`/* latin *\/`), se queda con latin.
 */
function ttfUrls(css: string): Map<number, string> {
  const blocks = [...css.matchAll(/(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g)].map((m) => ({ subset: m[1], body: m[2] }));
  const hasSubsets = blocks.some((b) => b.subset);
  const out = new Map<number, string>();
  for (const b of blocks) {
    if (hasSubsets && b.subset !== "latin") continue;
    const weight = Number(/font-weight:\s*(\d+)/.exec(b.body)?.[1]);
    const url = /src:\s*url\(([^)]+)\)\s*format\(['"]truetype['"]\)/.exec(b.body)?.[1];
    if (weight && url && !out.has(weight)) out.set(weight, url.replace(/^['"]|['"]$/g, ""));
  }
  return out;
}

async function fetchArchivo(signal: AbortSignal): Promise<BrandFonts> {
  const get = async (url: string) => {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res;
  };
  const [displayCss, textCss] = await Promise.all([get(DISPLAY_CSS).then((r) => r.text()), get(TEXT_CSS).then((r) => r.text())]);
  const wanted: { name: string; weight: FontWeight; url: string | undefined }[] = [
    { name: "Archivo Display", weight: 800, url: ttfUrls(displayCss).get(800) },
    ...([400, 600] as const).map((weight) => ({ name: "Archivo", weight, url: ttfUrls(textCss).get(weight) })),
  ];
  const fonts = await Promise.all(
    wanted.map(async ({ name, weight, url }) => {
      if (!url) throw new Error(`Sin TTF para ${name} ${weight}`);
      const data = stripGpos(new Uint8Array(await (await get(url)).arrayBuffer()));
      return { name, data, weight, style: "normal" as const };
    }),
  );
  return { fonts, display: "Archivo Display", text: "Archivo" };
}

async function geistFallback(): Promise<BrandFonts> {
  return { fonts: (await loadSocialFonts()) ?? [], display: FONT_FAMILY, text: FONT_FAMILY };
}

let brandFontsPromise: Promise<BrandFonts> | null = null;

/**
 * Archivo (display expandida 800 + texto 400/600) bajada de Google Fonts una
 * vez por proceso, sin GPOS. Si no hay red, tarda más de 4 s o algo falla
 * (y siempre en vitest), Geist: `display` y `text` = "Geist". Nunca tira.
 * Si `fonts` viene vacío, pasale `undefined` a `ImageResponse`.
 */
export function loadBrandFonts(): Promise<BrandFonts> {
  if (process.env.VITEST) return geistFallback();
  brandFontsPromise ??= (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    try {
      return await fetchArchivo(ctrl.signal);
    } catch {
      // Sin cache del fallo: el próximo pedido vuelve a intentar con red.
      brandFontsPromise = null;
      return geistFallback();
    } finally {
      clearTimeout(timer);
    }
  })();
  return brandFontsPromise;
}

// ---------------------------------------------------------------------------
// Paleta
// ---------------------------------------------------------------------------

/**
 * Tonos de placa. `accent` es texto (contrastes AA verificados en
 * `redes.test.ts`); `shape` es sólo para formas grandes (arcos, burbujas,
 * pastilla). Pomelo como texto chico sobre claro va en pomelo-ink.
 */
export const SOCIAL_TONES = {
  niebla: {
    bg: BRAND_NIEBLA,
    fg: BRAND_INK,
    accent: BRAND_POMELO_INK,
    shape: BRAND_POMELO,
    muted: BRAND_MUTED,
    rule: BRAND_BORDER,
    arc: BRAND_DURAZNO,
    tile: BRAND_POMELO,
    tileGlyph: BRAND_INK,
    word: BRAND_INK,
  },
  tinta: {
    bg: BRAND_INK,
    fg: BRAND_PAPER,
    accent: BRAND_POMELO,
    shape: BRAND_POMELO,
    muted: BRAND_BRUMA,
    rule: "#2a3358", // --eco-ink-3
    arc: BRAND_INK_2,
    tile: BRAND_POMELO,
    tileGlyph: BRAND_INK,
    word: BRAND_PAPER,
  },
  pomelo: {
    bg: BRAND_POMELO,
    fg: BRAND_INK,
    accent: BRAND_INK,
    shape: BRAND_INK,
    muted: BRAND_INK_2,
    rule: "rgba(16,22,47,0.22)",
    arc: "#f2472a", // --eco-pomelo-dark
    tile: BRAND_INK,
    tileGlyph: BRAND_POMELO,
    word: BRAND_INK,
  },
} as const satisfies Record<Tone, Record<string, string>>;

type Palette = (typeof SOCIAL_TONES)[Tone];

const SIDE = 96;
const PAD: Record<RedFormat, { top: number; bottom: number }> = {
  feed: { top: 88, bottom: 80 },
  story: { top: 216, bottom: 256 },
};
const DOMAIN = "ecommy.app";
const TILE = 64;

export interface RenderSlideOptions {
  format: RedFormat;
  /** 1-based. */
  index: number;
  /** Placas del carrusel; 1 si no es carrusel (sin contador "2 / 5" al pie). */
  total: number;
  /** Tokens "[…]" sin completar: la placa lleva una banda pomelo para que no se publique así. */
  pending: string[];
  /** Familias registradas en `ImageResponse` (ver `loadBrandFonts`). Default: Geist para las dos. */
  fonts?: { display: string; text: string };
}

type Fonts = NonNullable<RenderSlideOptions["fonts"]>;
const GEIST: Fonts = { display: FONT_FAMILY, text: FONT_FAMILY };

/**
 * Tamaño del titular según el largo, con `max` por plantilla. Archivo
 * expandida es ancha: de 100 px (frases cortas) a 60 (largas). En vertical,
 * 12 px más: sobra alto y la historia se lee de lejos.
 */
function titleSize(text: string, format: RedFormat, max = 96): number {
  const n = text.length;
  const base = n <= 20 ? 100 : n <= 30 ? 88 : n <= 60 ? 76 : n <= 95 ? 66 : 60;
  const bump = format === "story" ? 12 : 0;
  return Math.min(max, base) + bump;
}

const display = (f: Fonts, size: number): CSSProperties => ({
  fontFamily: f.display,
  fontWeight: 800,
  fontSize: size,
  lineHeight: 1.04,
  letterSpacing: -size * 0.025,
});

// ---------------------------------------------------------------------------
// Formas
// ---------------------------------------------------------------------------

type Corner = "top-right" | "bottom-right" | "bottom-left";

/** Cuarto de círculo plano: un círculo de radio `r` centrado en la esquina. */
function Arc({ corner, r, color, inset = 0 }: { corner: Corner; r: number; color: string; inset?: number }) {
  const at: CSSProperties =
    corner === "top-right"
      ? { top: -r + inset, right: -r + inset }
      : corner === "bottom-right"
        ? { bottom: -r + inset, right: -r + inset }
        : { bottom: -r + inset, left: -r + inset };
  return <div style={{ position: "absolute", width: r * 2, height: r * 2, borderRadius: r, background: color, ...at }} />;
}

/** Anillos concéntricos de trazo fino saliendo de una esquina. */
function Rings({ corner, r, color, count = 4, step = 64 }: { corner: Corner; r: number; color: string; count?: number; step?: number }) {
  // Capa a sangre: los anillos se miden desde la esquina de la placa, no desde el padding.
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", overflow: "hidden" }}>
      {Array.from({ length: count }, (_, i) => {
        const radius = r - i * step;
        const at: CSSProperties =
          corner === "top-right"
            ? { top: -radius, right: -radius }
            : corner === "bottom-right"
              ? { bottom: -radius, right: -radius }
              : { bottom: -radius, left: -radius };
        return (
          <div
            key={radius}
            style={{ position: "absolute", width: radius * 2, height: radius * 2, borderRadius: radius, border: `2px solid ${color}`, ...at }}
          />
        );
      })}
    </div>
  );
}

/** Lockup horizontal: burbuja + "ecommy" en minúsculas (BRAND §4.1). */
function Lockup({ c, f }: { c: Palette; f: Fonts }) {
  const glyph = Math.round(TILE * 0.58);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: Math.round(TILE * 0.32) }}>
      <div
        style={{
          width: TILE,
          height: TILE,
          ...bubbleRadii(TILE),
          background: c.tile,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BrandGlyph size={glyph} color={c.tileGlyph} />
      </div>
      <div style={{ fontFamily: f.display, fontWeight: 800, fontSize: Math.round(TILE * 0.72), letterSpacing: -1.4, color: c.word, marginTop: -6 }}>
        ecommy
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marco
// ---------------------------------------------------------------------------

function Frame({
  format,
  tone,
  index,
  total,
  pending,
  fonts: f = GEIST,
  align,
  decor,
  children,
}: RenderSlideOptions & {
  tone: Tone;
  /** Dónde se apoya el contenido entre la marca y el pie. */
  align: "start" | "center" | "end";
  /** Arcos de fondo (se dibujan antes que el contenido: quedan detrás). */
  decor?: ReactNode;
  children: ReactNode;
}) {
  const c = SOCIAL_TONES[tone];
  const pad = PAD[format];
  const showCounter = format === "feed" && total > 1;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        fontFamily: f.text,
        fontWeight: 400,
        background: c.bg,
        color: c.fg,
        padding: `${pad.top}px ${SIDE}px ${pad.bottom}px`,
        overflow: "hidden",
      }}
    >
      {decor}

      <Lockup c={c} f={f} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          justifyContent: align === "start" ? "flex-start" : align === "center" ? "center" : "flex-end",
          paddingTop: 56,
          paddingBottom: 48,
        }}
      >
        {children}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 22,
          borderTop: `2px solid ${c.rule}`,
          fontSize: 26,
          fontWeight: 600,
        }}
      >
        <div style={{ color: c.accent }}>{DOMAIN}</div>
        {showCounter ? <div style={{ color: c.muted, fontWeight: 400 }}>{`${index} / ${total}`}</div> : null}
      </div>

      {pending.length ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 64,
            display: "flex",
            alignItems: "center",
            padding: `0 ${SIDE}px`,
            background: tone === "pomelo" ? BRAND_INK : BRAND_POMELO,
            color: tone === "pomelo" ? BRAND_PAPER : BRAND_INK,
            fontSize: 26,
            fontWeight: 600,
          }}
        >
          {`Completar antes de publicar: ${pending.join(", ")}`}
        </div>
      ) : null}
    </div>
  );
}

function Kicker({ text, c, size = 30 }: { text?: string; c: Palette; size?: number }) {
  if (!text) return null;
  return <div style={{ fontSize: size, fontWeight: 600, color: c.accent, marginBottom: 28, letterSpacing: -0.2 }}>{text}</div>;
}

function Body({ text, c, size = 38, top = 36 }: { text?: string; c: Palette; size?: number; top?: number }) {
  if (!text) return null;
  return <div style={{ fontSize: size, lineHeight: 1.32, color: c.muted, marginTop: top, maxWidth: 820 }}>{text}</div>;
}

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------

/* (a) Gancho: titular grande; el remate en pomelo. Arco o anillos arriba a la derecha. */
function Hook({ s, o }: { s: HookSlide; o: RenderSlideOptions }) {
  const tone = s.tone ?? "niebla";
  const c = SOCIAL_TONES[tone];
  const f = o.fonts ?? GEIST;
  const size = titleSize(`${s.title} ${s.accent ?? ""}`, o.format);
  const story = o.format === "story";
  const decor =
    tone === "niebla" ? (
      <Arc corner="top-right" r={story ? 380 : 300} color={c.arc} />
    ) : (
      <Rings corner="top-right" r={story ? 520 : 420} color={tone === "tinta" ? "#2a3358" : c.arc} />
    );
  return (
    <Frame {...o} tone={tone} align={story ? "center" : "end"} decor={decor}>
      <Kicker text={s.kicker} c={c} />
      <div style={{ display: "flex", flexDirection: "column", ...display(f, size) }}>
        <div>{s.title}</div>
        {s.accent ? <div style={{ color: c.accent }}>{s.accent}</div> : null}
      </div>
      <Body text={s.body} c={c} />
    </Frame>
  );
}

/* (b) Dato: sobre tinta, el valor enorme en display pomelo y la explicación debajo. */
function Fact({ s, o }: { s: FactSlide; o: RenderSlideOptions }) {
  const c = SOCIAL_TONES.tinta;
  const f = o.fonts ?? GEIST;
  const len = Math.max(s.value.length, 3);
  // Archivo expandida 800: ~0,7 em por carácter.
  const valueSize = Math.min(o.format === "story" ? 240 : 220, Math.floor((1080 - SIDE * 2) / (len * 0.7)));
  const story = o.format === "story";
  return (
    <Frame
      {...o}
      tone="tinta"
      align={story ? "center" : "end"}
      decor={<Arc corner="top-right" r={story ? 420 : 340} color={c.arc} />}
    >
      <div style={{ fontSize: 38, fontWeight: 600, lineHeight: 1.25, maxWidth: 820, letterSpacing: -0.4, color: BRAND_MIST }}>{s.kicker}</div>
      <div
        style={{
          ...display(f, valueSize),
          lineHeight: 1,
          letterSpacing: -valueSize * 0.03,
          color: c.shape,
          marginTop: 36,
          marginLeft: -Math.round(valueSize * 0.03),
        }}
      >
        {s.value}
      </div>
      <Body text={s.body} c={c} top={36} />
    </Frame>
  );
}

/* (c) Lista: 2 a 4 ítems, cada número en una burbuja pomelo, separados por reglas finas. */
function List({ s, o }: { s: ListSlide; o: RenderSlideOptions }) {
  const c = SOCIAL_TONES.niebla;
  const f = o.fonts ?? GEIST;
  const story = o.format === "story";
  const itemSize = story ? 42 : s.items.length > 3 ? 34 : 38;
  const bubble = Math.round(itemSize * 1.55);
  return (
    <Frame {...o} tone="niebla" align={story ? "center" : "start"} decor={<Rings corner="top-right" r={story ? 380 : 250} color={BRAND_BORDER} count={3} step={52} />}>
      <Kicker text={s.kicker} c={c} />
      <div style={display(f, titleSize(s.title, o.format, 76))}>{s.title}</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 48, borderBottom: `2px solid ${c.rule}` }}>
        {s.items.map((item, i) => (
          <div
            key={item}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 32,
              borderTop: `2px solid ${c.rule}`,
              padding: story ? "30px 0" : "20px 0",
            }}
          >
            <div
              style={{
                width: bubble,
                height: bubble,
                flexShrink: 0,
                ...bubbleRadii(bubble),
                background: c.shape,
                color: BRAND_INK,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: f.display,
                fontWeight: 800,
                fontSize: Math.round(bubble * 0.5),
                paddingBottom: Math.round(bubble * 0.04),
              }}
            >
              {String(i + 1)}
            </div>
            <div style={{ fontSize: itemSize, lineHeight: 1.25, maxWidth: 760 }}>{item}</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* (d) Antes y después: dos columnas con una regla vertical; la de la derecha, en tinta con su etiqueta pomelo. */
function Compare({ s, o }: { s: CompareSlide; o: RenderSlideOptions }) {
  const c = SOCIAL_TONES.niebla;
  const f = o.fonts ?? GEIST;
  const longest = Math.max(...[...s.before.items, ...s.after.items].map((t) => t.length));
  const itemSize = longest > 36 ? 32 : longest > 18 ? 36 : 46;
  const column = (side: "before" | "after") => {
    const col = s[side];
    const first = side === "before";
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "50%",
          paddingRight: first ? 36 : 0,
          paddingLeft: first ? 0 : 36,
          borderLeft: first ? "none" : `2px solid ${c.rule}`,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 600, color: first ? c.muted : c.accent, marginBottom: 20 }}>{col.label}</div>
        {col.items.map((item) => (
          <div
            key={item}
            style={{
              borderTop: `2px solid ${c.rule}`,
              padding: o.format === "story" ? "30px 0" : "20px 0",
              fontSize: itemSize,
              lineHeight: 1.22,
              fontWeight: first ? 400 : 600,
              color: first ? c.muted : c.fg,
              letterSpacing: itemSize > 40 ? -0.8 : 0,
            }}
          >
            {item}
          </div>
        ))}
      </div>
    );
  };
  return (
    <Frame {...o} tone="niebla" align={o.format === "story" ? "center" : "start"} decor={<Arc corner="top-right" r={o.format === "story" ? 320 : 200} color={c.arc} />}>
      <div style={display(f, titleSize(s.title, o.format, 72))}>{s.title}</div>
      <div style={{ display: "flex", marginTop: 48 }}>
        {column("before")}
        {column("after")}
      </div>
      {s.note ? <div style={{ fontSize: 28, lineHeight: 1.3, color: c.muted, marginTop: 36, maxWidth: 820 }}>{s.note}</div> : null}
    </Frame>
  );
}

/* (e) Captura: sobre tinta, un recuadro niebla en forma de burbuja donde el dueño pega la captura real. */
function Screenshot({ s, o }: { s: ScreenshotSlide; o: RenderSlideOptions }) {
  const c = SOCIAL_TONES.tinta;
  const f = o.fonts ?? GEIST;
  const story = o.format === "story";
  return (
    <Frame {...o} tone="tinta" align="start" decor={<Arc corner="top-right" r={story ? 360 : 230} color={c.arc} />}>
      <Kicker text={s.kicker} c={c} size={28} />
      <div style={display(f, titleSize(s.title, o.format, s.body ? 64 : 72))}>{s.title}</div>
      <Body text={s.body} c={c} size={30} top={20} />
      <div
        style={{
          display: "flex",
          flexGrow: 1,
          marginTop: 44,
          ...bubbleRadii(140),
          background: BRAND_NIEBLA,
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
        }}
      >
        <div style={{ fontSize: 28, color: BRAND_MUTED, maxWidth: 680, textAlign: "center", lineHeight: 1.3 }}>
          {s.placeholder ?? "Pegá acá la captura del panel"}
        </div>
      </div>
    </Frame>
  );
}

/** Flecha del CTA (BRAND §10): círculo tinta con la flecha clara. */
function CtaArrow({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size / 2, background: BRAND_INK, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size * 0.46} height={size * 0.46} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 12h15M13 5.5l6.5 6.5-6.5 6.5" fill="none" stroke={BRAND_PAPER} strokeWidth={2.4} />
      </svg>
    </div>
  );
}

/* (f) Historia: titular + texto + CTA en pastilla pomelo. Con sticker, el contenido sube y deja lugar abajo. */
function Story({ s, o }: { s: StorySlide; o: RenderSlideOptions }) {
  const c = SOCIAL_TONES.niebla;
  const f = o.fonts ?? GEIST;
  const size = titleSize(s.title, o.format, 104);
  return (
    <Frame {...o} tone="niebla" align={s.sticker ? "start" : "center"} decor={<Arc corner="top-right" r={420} color={c.arc} />}>
      <div style={{ display: "flex", flexDirection: "column", marginTop: s.sticker ? 80 : 0 }}>
        <Kicker text={s.kicker} c={c} size={34} />
        <div style={display(f, size)}>{s.title}</div>
        <Body text={s.body} c={c} size={46} />
        {s.cta ? (
          <div style={{ display: "flex", marginTop: 64 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                background: c.shape,
                color: BRAND_INK,
                borderRadius: 999,
                padding: "14px 14px 14px 44px",
                fontSize: 38,
                fontWeight: 600,
                letterSpacing: -0.3,
              }}
            >
              <div>{s.cta}</div>
              <CtaArrow size={68} />
            </div>
          </div>
        ) : null}
      </div>
    </Frame>
  );
}

/** Elemento para `new ImageResponse(...)` de una placa. */
export function renderRedSlide(slide: Slide, o: RenderSlideOptions) {
  switch (slide.template) {
    case "gancho":
      return <Hook s={slide} o={o} />;
    case "dato":
      return <Fact s={slide} o={o} />;
    case "lista":
      return <List s={slide} o={o} />;
    case "antes-despues":
      return <Compare s={slide} o={o} />;
    case "captura":
      return <Screenshot s={slide} o={o} />;
    case "historia":
      return <Story s={slide} o={o} />;
  }
}
