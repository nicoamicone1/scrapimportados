import { ImageResponse } from "next/og";

import {
  BRAND_BRUMA,
  BRAND_DURAZNO,
  BRAND_INK,
  BRAND_INK_2,
  BRAND_MIST,
  BRAND_MUTED,
  BRAND_NIEBLA,
  BRAND_POMELO,
  BRAND_POMELO_INK,
  BrandTile,
  bubbleRadii,
} from "../_brand/glyph";
import { loadBrandFonts } from "../_brand/social-templates";

/*
 * Imagen para compartir del sitio (1200 × 630), dibujada con Satori: sólo
 * flexbox y estilos inline, colores de `glyph.tsx` (no lee CSS). La
 * identidad entera en una placa: titular en Archivo expandida, una palabra
 * dentro de la burbuja pomelo, un arco durazno que entra por la esquina y el
 * lockup. `loadBrandFonts` baja Archivo una vez por proceso y, sin red, cae
 * en Geist sin romper la imagen.
 */

export const OG_SIZE = { width: 1200, height: 630 };

type Tone = "niebla" | "tinta";

const TONES: Record<Tone, { bg: string; fg: string; muted: string; eyebrow: string; arc: string; ring: string; word: string }> = {
  niebla: { bg: BRAND_NIEBLA, fg: BRAND_INK, muted: BRAND_MUTED, eyebrow: BRAND_POMELO_INK, arc: BRAND_DURAZNO, ring: "#f6c9b9", word: BRAND_INK },
  tinta: { bg: BRAND_INK, fg: "#ffffff", muted: BRAND_BRUMA, eyebrow: BRAND_POMELO, arc: BRAND_INK_2, ring: "#2a3358", word: "#ffffff" },
};

export interface OgCardProps {
  tone?: Tone;
  eyebrow: string;
  /** Titular. Si trae `highlight`, esa parte va dentro de la burbuja pomelo. */
  title: string;
  highlight?: string;
  /** Bajada corta (una o dos líneas). */
  line?: string;
  /** Pie a la derecha (el dominio va siempre a la izquierda). */
  foot?: string;
}

const DOMAIN = "ecommy.app";

/** Parte el titular en [antes, resaltado, después] (resaltado opcional). */
function splitTitle(title: string, highlight?: string): [string, string | null, string] {
  if (!highlight) return [title, null, ""];
  const at = title.indexOf(highlight);
  if (at < 0) return [title, null, ""];
  return [title.slice(0, at), highlight, title.slice(at + highlight.length)];
}

export async function renderOgCard({ tone = "niebla", eyebrow, title, highlight, line, foot }: OgCardProps): Promise<ImageResponse> {
  const { fonts, display, text } = await loadBrandFonts();
  const c = TONES[tone];
  const [before, hl, after] = splitTitle(title, highlight);
  const len = title.length;
  const size = len <= 34 ? 84 : len <= 56 ? 70 : len <= 80 ? 58 : 50;
  const words = (s: string) => s.split(/\s+/).filter(Boolean);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        background: c.bg,
        color: c.fg,
        fontFamily: text,
        padding: "60px 72px 52px",
      }}
    >
      {/* El arco: un círculo plano centrado en la esquina, y anillos finos. */}
      <div style={{ position: "absolute", right: -260, bottom: -300, width: 640, height: 640, borderRadius: 9999, background: c.arc, display: "flex" }} />
      {[820, 1000].map((d) => (
        <div
          key={d}
          style={{
            position: "absolute",
            right: -260 - (d - 640) / 2,
            bottom: -300 - (d - 640) / 2,
            width: d,
            height: d,
            borderRadius: 9999,
            border: `2px solid ${c.ring}`,
            display: "flex",
          }}
        />
      ))}

      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <BrandTile size={60} />
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 42, letterSpacing: -1.5, color: c.word }}>ecommy</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", maxWidth: 940 }}>
        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase", color: c.eyebrow }}>{eyebrow}</div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: 18,
            fontFamily: display,
            fontWeight: 800,
            fontSize: size,
            lineHeight: 1.04,
            letterSpacing: -size * 0.035,
            columnGap: size * 0.24,
            rowGap: size * 0.06,
          }}
        >
          {words(before).map((w, i) => (
            <span key={`b${i}`}>{w}</span>
          ))}
          {hl ? (
            <span
              style={{
                display: "flex",
                background: BRAND_POMELO,
                color: BRAND_INK,
                padding: `${size * 0.02}px ${size * 0.22}px ${size * 0.08}px`,
                ...bubbleRadii(size * 1.2),
              }}
            >
              {hl}
            </span>
          ) : null}
          {words(after).map((w, i) => (
            <span key={`a${i}`}>{w}</span>
          ))}
        </div>
        {line ? <div style={{ marginTop: 22, fontSize: 28, lineHeight: 1.32, color: c.muted, maxWidth: 820 }}>{line}</div> : null}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 38, fontSize: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: tone === "tinta" ? BRAND_MIST : BRAND_INK, fontWeight: 600 }}>
          <div style={{ width: 12, height: 12, borderRadius: 9999, background: BRAND_POMELO, display: "flex" }} />
          {DOMAIN}
        </div>
        {foot ? <div style={{ color: tone === "tinta" ? BRAND_MIST : BRAND_INK }}>{foot}</div> : null}
      </div>
    </div>,
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined },
  );
}
