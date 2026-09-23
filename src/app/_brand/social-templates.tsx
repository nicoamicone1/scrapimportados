import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ReactNode } from "react";

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

import { BRAND_AMBER, BRAND_CREAM, BRAND_FG, BRAND_INK, BRAND_MUTED, BRAND_PINE, BrandGlyph } from "./glyph";

/*
 * Plantillas de las piezas para redes (/platform/redes), dibujadas con
 * `ImageResponse` (Satori): sólo `div` con estilos inline, flexbox, sin grid
 * ni variables CSS. Mismo lenguaje que la imagen para compartir
 * (`(platform)/opengraph-image.tsx`): crema, verde-tinta, pino y ámbar,
 * titulares grandes con tracking negativo, reglas finas y nada más. Sin
 * gradientes, sombras, íconos ni celulares flotando (DESIGN.md §1, guía de
 * tono de SOCIAL-KIT §0).
 *
 * Tipografía: la única fuente disponible sin red es la que trae
 * `ImageResponse` (Geist Regular, `next/dist/compiled/@vercel/og`). No hay
 * negrita: la jerarquía sale del tamaño, el color y el tracking. La leemos
 * con `fs` y le apagamos el kerning (ver `loadSocialFonts`).
 *
 * Márgenes: 96 px a los lados. En vertical (1080 × 1920) el contenido deja
 * libres ~220 px arriba y ~260 abajo, donde Instagram pone la barra de
 * progreso, el perfil y el campo de respuesta, y se centra en el alto para
 * que el recorte 3:4 de la portada de un reel en la grilla no lo corte.
 */

export const FONT_FAMILY = "Geist";
const FONT_PATH = join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf");

let fontsPromise: Promise<{ name: string; data: ArrayBuffer; weight: 400; style: "normal" }[] | undefined> | null = null;

/**
 * Geist Regular sin la tabla GPOS. Satori mide cada palabra sin kerning pero
 * la dibuja con kerning, así que después de las palabras con pares ajustados
 * ("ro", "Tu", "Wh") quedaba un espacio de más ("Cronómetro  en"). Sin GPOS,
 * medida y dibujo coinciden. Se lee una vez por proceso; si el archivo no
 * está, `undefined` y `ImageResponse` usa su fuente por defecto (la misma
 * Geist, con los espacios desparejos).
 */
export function loadSocialFonts() {
  fontsPromise ??= readFile(FONT_PATH)
    .then((file) => {
      const buf = new Uint8Array(file);
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const tables = view.getUint16(4);
      for (let i = 0; i < tables; i++) {
        const at = 12 + i * 16;
        if (String.fromCharCode(...buf.subarray(at, at + 4)) === "GPOS") buf.set([88, 80, 79, 83], at); // "XPOS": tabla ignorada
      }
      const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      return [{ name: FONT_FAMILY, data, weight: 400 as const, style: "normal" as const }];
    })
    .catch(() => undefined);
  return fontsPromise;
}

/** Texto sobre crema y sobre verde-tinta. Contrastes AA verificados (ver `redes.test.ts`). */
export const SOCIAL_TONES = {
  crema: { bg: BRAND_CREAM, fg: BRAND_FG, accent: BRAND_PINE, muted: BRAND_MUTED, rule: "#d4ccbb", tile: BRAND_INK },
  tinta: { bg: BRAND_INK, fg: BRAND_CREAM, accent: BRAND_AMBER, muted: "#9fb1a8", rule: "#3a4843", tile: BRAND_PINE },
} as const;

type Palette = (typeof SOCIAL_TONES)[Tone];

const SIDE = 96;
const PAD: Record<RedFormat, { top: number; bottom: number }> = {
  feed: { top: 96, bottom: 88 },
  story: { top: 216, bottom: 256 },
};
const DOMAIN = "ecommy.app";

export interface RenderSlideOptions {
  format: RedFormat;
  /** 1-based. */
  index: number;
  /** Placas del carrusel; 1 si no es carrusel (sin contador "2 / 5" al pie). */
  total: number;
  /** Tokens "[…]" sin completar: la placa lleva una banda ámbar para que no se publique así. */
  pending: string[];
}

/**
 * Tamaño del titular según el largo: de 96 px (frases cortas) a 72 (largas),
 * con `max` por plantilla. En vertical, 16 px más: sobra alto y la historia
 * se lee de lejos; las historias de una línea corta llegan a 128.
 */
function titleSize(text: string, format: RedFormat, max = 96): number {
  const n = text.length;
  const base = n <= 20 ? 112 : n <= 30 ? 96 : n <= 60 ? 86 : n <= 95 ? 78 : 72;
  const bump = format === "story" ? 16 : 0;
  return Math.min(max, base) + bump;
}

const titleStyle = (size: number) => ({ fontSize: size, lineHeight: 1.04, letterSpacing: -size * 0.035 });

function Frame({
  format,
  tone,
  index,
  total,
  pending,
  align,
  children,
}: {
  format: RedFormat;
  tone: Tone;
  index: number;
  total: number;
  pending: string[];
  /** Dónde se apoya el contenido entre la marca y el pie. */
  align: "start" | "center" | "end";
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
        fontFamily: FONT_FAMILY,
        background: c.bg,
        color: c.fg,
        padding: `${pad.top}px ${SIDE}px ${pad.bottom}px`,
      }}
    >
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
            background: BRAND_AMBER,
            color: BRAND_INK,
            fontSize: 26,
          }}
        >
          {`Completar antes de publicar: ${pending.join(", ")}`}
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 9,
            background: c.tile,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BrandGlyph size={32} />
        </div>
        <div style={{ fontSize: 32, letterSpacing: -0.8 }}>Ecommy</div>
      </div>

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
        }}
      >
        <div style={{ color: c.accent }}>{DOMAIN}</div>
        {showCounter ? <div style={{ color: c.muted }}>{`${index} / ${total}`}</div> : null}
      </div>
    </div>
  );
}

function Kicker({ text, c, size = 32 }: { text?: string; c: Palette; size?: number }) {
  if (!text) return null;
  return <div style={{ fontSize: size, color: c.accent, marginBottom: 28, letterSpacing: -0.3 }}>{text}</div>;
}

function Body({ text, c, size = 40, top = 36 }: { text?: string; c: Palette; size?: number; top?: number }) {
  if (!text) return null;
  return <div style={{ fontSize: size, lineHeight: 1.3, color: c.muted, marginTop: top, maxWidth: 820 }}>{text}</div>;
}

/* (a) Gancho: titular grande; el remate en pino (ámbar sobre verde-tinta). */
function Hook({ s, o }: { s: HookSlide; o: RenderSlideOptions }) {
  const tone = s.tone ?? "crema";
  const c = SOCIAL_TONES[tone];
  const size = titleSize(`${s.title} ${s.accent ?? ""}`, o.format);
  return (
    <Frame {...o} tone={tone} align={o.format === "story" ? "center" : "end"}>
      <Kicker text={s.kicker} c={c} />
      <div style={{ display: "flex", flexDirection: "column", ...titleStyle(size) }}>
        <div>{s.title}</div>
        {s.accent ? <div style={{ color: c.accent }}>{s.accent}</div> : null}
      </div>
      <Body text={s.body} c={c} />
    </Frame>
  );
}

/* (b) Dato: un valor grande en pino y la explicación debajo. */
function Fact({ s, o }: { s: FactSlide; o: RenderSlideOptions }) {
  const c = SOCIAL_TONES.crema;
  const len = Math.max(s.value.length, 3);
  const valueSize = Math.min(o.format === "story" ? 260 : 240, Math.floor((1080 - SIDE * 2) / (len * 0.56)));
  return (
    <Frame {...o} tone="crema" align={o.format === "story" ? "center" : "end"}>
      <div style={{ fontSize: 40, lineHeight: 1.25, maxWidth: 820, letterSpacing: -0.6 }}>{s.kicker}</div>
      <div
        style={{
          fontSize: valueSize,
          lineHeight: 1,
          letterSpacing: -valueSize * 0.045,
          color: c.accent,
          marginTop: 40,
          marginLeft: -Math.round(valueSize * 0.04),
        }}
      >
        {s.value}
      </div>
      <Body text={s.body} c={c} top={40} />
    </Frame>
  );
}

/* (c) Lista: 2 a 4 ítems numerados, separados por reglas finas. */
function List({ s, o }: { s: ListSlide; o: RenderSlideOptions }) {
  const c = SOCIAL_TONES.crema;
  const itemSize = o.format === "story" ? 44 : s.items.length > 3 ? 36 : 40;
  return (
    <Frame {...o} tone="crema" align={o.format === "story" ? "center" : "start"}>
      <Kicker text={s.kicker} c={c} />
      <div style={titleStyle(titleSize(s.title, o.format, 80))}>{s.title}</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 52, borderBottom: `2px solid ${c.rule}` }}>
        {s.items.map((item, i) => (
          <div
            key={item}
            style={{
              display: "flex",
              borderTop: `2px solid ${c.rule}`,
              padding: o.format === "story" ? "34px 0" : "24px 0",
            }}
          >
            <div style={{ width: itemSize * 2.2, flexShrink: 0, fontSize: itemSize, lineHeight: 1.25, color: c.accent }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div style={{ fontSize: itemSize, lineHeight: 1.25, maxWidth: 780 }}>{item}</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* (d) Antes y después: dos columnas con una regla vertical; la de la derecha, en tinta. */
function Compare({ s, o }: { s: CompareSlide; o: RenderSlideOptions }) {
  const c = SOCIAL_TONES.crema;
  const longest = Math.max(...[...s.before.items, ...s.after.items].map((t) => t.length));
  const itemSize = longest > 36 ? 34 : longest > 18 ? 38 : 48;
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
        <div style={{ fontSize: 30, color: first ? c.muted : c.accent, marginBottom: 20 }}>{col.label}</div>
        {col.items.map((item) => (
          <div
            key={item}
            style={{
              borderTop: `2px solid ${c.rule}`,
              padding: o.format === "story" ? "30px 0" : "20px 0",
              fontSize: itemSize,
              lineHeight: 1.22,
              color: first ? c.muted : c.fg,
              letterSpacing: itemSize > 40 ? -1 : 0,
            }}
          >
            {item}
          </div>
        ))}
      </div>
    );
  };
  return (
    <Frame {...o} tone="crema" align={o.format === "story" ? "center" : "start"}>
      <div style={titleStyle(titleSize(s.title, o.format, 76))}>{s.title}</div>
      <div style={{ display: "flex", marginTop: 52 }}>
        {column("before")}
        {column("after")}
      </div>
      {s.note ? <div style={{ fontSize: 28, lineHeight: 1.3, color: c.muted, marginTop: 36, maxWidth: 820 }}>{s.note}</div> : null}
    </Frame>
  );
}

/* (e) Captura: marco verde-tinta con un rectángulo crema vacío donde el dueño pega la captura real. */
function Screenshot({ s, o }: { s: ScreenshotSlide; o: RenderSlideOptions }) {
  const c = SOCIAL_TONES.tinta;
  return (
    <Frame {...o} tone="tinta" align="start">
      <Kicker text={s.kicker} c={c} size={30} />
      <div style={titleStyle(titleSize(s.title, o.format, s.body ? 72 : 80))}>{s.title}</div>
      <Body text={s.body} c={c} size={32} top={20} />
      <div
        style={{
          display: "flex",
          flexGrow: 1,
          marginTop: 44,
          borderRadius: 12,
          background: BRAND_CREAM,
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

/* (f) Historia: titular + texto + CTA ámbar. Con sticker, el contenido sube y deja lugar abajo. */
function Story({ s, o }: { s: StorySlide; o: RenderSlideOptions }) {
  const c = SOCIAL_TONES.crema;
  const size = titleSize(s.title, o.format, 112);
  return (
    <Frame {...o} tone="crema" align={s.sticker ? "start" : "center"}>
      <div style={{ display: "flex", flexDirection: "column", marginTop: s.sticker ? 80 : 0 }}>
        <Kicker text={s.kicker} c={c} size={34} />
        <div style={titleStyle(size)}>{s.title}</div>
        <Body text={s.body} c={c} size={48} />
        {s.cta ? (
          <div style={{ display: "flex", marginTop: 64 }}>
            <div
              style={{
                display: "flex",
                background: BRAND_AMBER,
                color: BRAND_INK,
                borderRadius: 8,
                padding: "22px 34px",
                fontSize: 38,
                letterSpacing: -0.4,
              }}
            >
              {s.cta}
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
