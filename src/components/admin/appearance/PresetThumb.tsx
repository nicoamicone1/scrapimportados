import { Search, ShoppingBag } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { googleHref, isDarkTheme, themeVars, type Theme } from "@/lib/theme";

/*
 * Miniatura fiel de un tema (selector de presets del admin y alta de tienda).
 *
 * No es una aproximación con colores sueltos: el contenedor recibe
 * `themeVars(theme)` y todo adentro usa `var(--bg)`, `var(--font-heading)`,
 * `var(--btn-radius)`… Se dibuja un storefront chico de 560 × 448 "px
 * virtuales" que escala con el ancho de la tarjeta (unidades de container
 * query: `--u` = 1/560 del ancho), así que se ve igual a 120 px o a 320 px,
 * sin JS ni medir nada.
 *
 * Lo que cambia entre presets es lo que cambia en la tienda real:
 * - header según `header.layout` (logo a la izq. con buscador / logo al centro /
 *   mínimo con texto), superpuesto a la portada si `transparentOnHome`;
 * - portada: foto a sangre con botón claro (`transparentOnHome`) o banda
 *   `--secondary` con el botón primario del tema (`buttons.style/shape/uppercase`);
 * - grilla con `gridColumns.desktop` columnas, `cards.style`, `imageRatio`
 *   (foto recortada sobre superficie vs. foto ambientada), radios y densidad;
 * - precio de oferta en `--accent` y etiqueta de promo.
 */

const W = 560;
const H = 448;

/** Largo en px virtuales → CSS que escala con el ancho de la miniatura. */
const u = (n: number) => `calc(var(--u) * ${Math.round(n * 100) / 100})`;

const DENSITY = {
  compact: { header: 38, gutter: 18, gap: 8, hero: 100, section: 14, pad: 6, control: 22 },
  comfortable: { header: 44, gutter: 22, gap: 12, hero: 110, section: 18, pad: 8, control: 24 },
  airy: { header: 52, gutter: 28, gap: 18, hero: 118, section: 24, pad: 10, control: 26 },
} as const;

const RATIO: Record<Theme["cards"]["imageRatio"], number> = { "1:1": 1, "4:5": 5 / 4, "3:4": 4 / 3, "16:9": 9 / 16 };
const PRICES = ["$ 36.720", "$ 18.900", "$ 52.400", "$ 9.850", "$ 27.300"];
const TONES = [12, 18, 24, 15, 21];
const ON_PHOTO = "#ffffff";

type Weight = CSSProperties["fontWeight"];

/** Fuentes de Google de uno o varios temas, para las miniaturas (máx. 3 pesos por tema). */
export function presetFontsHref(themes: readonly Theme[]): string | null {
  return googleHref(
    themes.flatMap((t) => [
      { id: t.fonts.heading, weights: [t.fonts.headingWeight] },
      { id: t.fonts.body, weights: [t.fonts.bodyWeight, Math.min(t.fonts.bodyWeight + 200, 700)] },
    ]),
  );
}

export interface PresetThumbProps {
  theme: Theme;
  /** Nombre en el lugar del logo (el de la tienda si se conoce). */
  brand: string;
  /** Titular de la portada: el tono del preset ("Silencioso y aireado"). */
  headline: string;
  /** Nombres de los productos de ejemplo (los rubros del preset). */
  labels?: readonly string[];
  className?: string;
}

export function PresetThumb({ theme, brand, headline, labels = [], className }: PresetThumbProps) {
  const vars = themeVars({ ...theme, custom_css: undefined });
  const px = (key: string) => parseFloat(vars[key] ?? "0") || 0;
  const d = DENSITY[theme.layout.density];
  const B = theme.fonts.baseSize / 16;
  const dark = isDarkTheme(theme);
  const overlay = theme.header.transparentOnHome;
  const cols = theme.layout.gridColumns.desktop;
  const gutter = d.gutter + (theme.layout.containerWidth === "narrow" ? 36 : 0);
  const panel = theme.cards.style !== "flat";
  const cover = theme.cards.imageRatio === "4:5" || theme.cards.imageRatio === "3:4";
  const upperNav = theme.buttons.uppercase && theme.header.layout === "logo-center";
  const glow = dark && theme.effects.shadows !== "none";
  const names = labels.length ? labels : ["Producto"];

  // Geometría: portada debajo del header (o detrás, si es transparente).
  const heroTop = overlay ? 0 : d.header;
  const heroH = d.hero + (overlay ? d.header : 0);
  const gridTop = heroTop + heroH + d.section;
  const cardW = (W - 2 * gutter - (cols - 1) * d.gap) / cols;
  const textH = d.pad * (panel ? 2 : 1) + (theme.cards.showBrand ? 9 : 0) + (theme.cards.showSku ? 9 : 0) + 26;
  const titleH = 24;
  // El título de sección entra sólo si no tapa el precio de la primera fila.
  const showTitle = gridTop + titleH + cardW * RATIO[theme.cards.imageRatio] + textH <= H - 4;

  const heading: CSSProperties = {
    fontFamily: "var(--font-heading)",
    fontWeight: "var(--heading-weight)" as Weight,
    textTransform: "var(--heading-transform)" as CSSProperties["textTransform"],
    letterSpacing: "var(--heading-tracking)",
    lineHeight: 1.05,
  };
  // "Foto": un tono plano de la tinta del tema (sin gradientes ni imágenes externas).
  const photo = dark ? "color-mix(in oklab, var(--surface) 72%, var(--fg))" : "color-mix(in oklab, var(--fg) 68%, var(--bg))";
  const photoLight = `color-mix(in oklab, ${photo} 86%, #ffffff)`;
  const filter = theme.effects.imageFilter === "mono" ? "grayscale(1)" : undefined;
  const headerFg = overlay ? ON_PHOTO : "var(--fg)";

  const icon = (Icon: typeof Search, size = 12) => (
    <Icon aria-hidden strokeWidth={1.5} style={{ width: u(size), height: u(size), flexShrink: 0 }} />
  );
  const navText: CSSProperties = upperNav
    ? { fontSize: u(7.5 * B), letterSpacing: "0.12em", textTransform: "uppercase" }
    : { fontSize: u(9 * B) };
  const nav = (
    <span style={{ display: "flex", gap: u(12), whiteSpace: "nowrap", ...navText }}>
      <span>Productos</span>
      <span>Ofertas</span>
      <span>Contacto</span>
    </span>
  );
  const logo = (size: number) => (
    <span style={{ ...heading, fontSize: u(size * B), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: u(190), flexShrink: 0 }}>
      {brand}
    </span>
  );

  let headerInner: ReactNode;
  if (theme.header.layout === "logo-center") {
    headerInner = (
      <>
        <span style={{ flex: 1, display: "flex", minWidth: 0 }}>{nav}</span>
        {logo(17)}
        <span style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: u(10) }}>
          {theme.header.showSearch ? icon(Search) : null}
          {icon(ShoppingBag)}
        </span>
      </>
    );
  } else if (theme.header.layout === "minimal") {
    headerInner = (
      <>
        {logo(16)}
        <span style={{ marginLeft: "auto", display: "flex", gap: u(12), fontSize: u(9 * B), whiteSpace: "nowrap" }}>
          <span>Menú</span>
          {theme.header.showSearch ? <span>Buscar</span> : null}
          <span>Carrito (2)</span>
        </span>
      </>
    );
  } else {
    headerInner = (
      <>
        {logo(15)}
        {nav}
        <span style={{ flex: 1 }} />
        {theme.header.showSearch ? (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: u(5),
              width: u(140),
              height: u(d.control - 4),
              paddingInline: u(7),
              border: `1px solid ${overlay ? "rgb(255 255 255 / .55)" : "var(--border)"}`,
              borderRadius: u(px("--radius-md")),
              background: overlay ? "transparent" : "var(--surface)",
              color: overlay ? ON_PHOTO : "var(--fg-muted)",
              fontSize: u(8 * B),
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {icon(Search, 9)}
            Buscar productos
          </span>
        ) : null}
        {icon(ShoppingBag)}
      </>
    );
  }

  /** Botón primario del tema; sobre foto, la variante `onImage` del storefront. */
  const button = (label: string, onPhoto: boolean) => {
    const kind = onPhoto ? (dark ? "solid" : "inverse") : theme.buttons.style;
    const look: CSSProperties =
      kind === "inverse"
        ? { background: "#ffffff", color: "#141414", borderColor: "#ffffff" }
        : kind === "outline"
          ? { background: "transparent", color: "var(--fg)", borderColor: "var(--fg)" }
          : kind === "soft"
            ? { background: "var(--primary-soft)", color: "var(--primary)", borderColor: "transparent" }
            : {
                background: "var(--primary)",
                color: "var(--primary-fg)",
                borderColor: "var(--primary)",
                boxShadow: glow
                  ? `0 0 0 1px color-mix(in oklab, var(--primary) 55%, transparent), 0 0 ${u(16)} ${u(-5)} color-mix(in oklab, var(--primary) 50%, transparent)`
                  : undefined,
              };
    return (
      <span
        style={{
          ...look,
          display: "inline-flex",
          alignItems: "center",
          height: u(d.control),
          paddingInline: u(14),
          borderWidth: 1,
          borderStyle: "solid",
          borderRadius: u(px("--btn-radius")),
          fontSize: u((theme.buttons.uppercase ? 8.2 : 9) * B),
          fontWeight: "var(--body-strong-weight)" as Weight,
          textTransform: theme.buttons.uppercase ? "uppercase" : "none",
          letterSpacing: theme.buttons.uppercase ? "0.1em" : 0,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    );
  };

  return (
    <div
      aria-hidden
      className={cn("select-none", className)}
      style={
        {
          ...vars,
          position: "relative",
          width: "100%",
          overflow: "hidden",
          "--u": `calc(100cqw / ${W})`,
          containerType: "inline-size",
          aspectRatio: `${W} / ${H}`,
          background: "var(--bg)",
          color: "var(--fg)",
          fontFamily: "var(--font-body)",
          fontWeight: "var(--body-weight)",
          lineHeight: 1.3,
        } as CSSProperties
      }
    >
      {/* Portada */}
      {overlay ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: u(heroH), background: photo, filter }}>
          <div style={{ position: "absolute", right: u(gutter), top: u(d.header + 8), bottom: 0, width: "30%", background: photoLight }} />
        </div>
      ) : (
        <div style={{ position: "absolute", left: 0, right: 0, top: u(heroTop), height: u(heroH), background: "var(--secondary)" }}>
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "40%", background: photo, filter }} />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: u(gutter),
          top: u(heroTop + (overlay ? d.header : 0)),
          height: u(d.hero),
          width: overlay ? "60%" : "52%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: u(10),
          color: overlay ? ON_PHOTO : "var(--fg)",
        }}
      >
        <p style={{ ...heading, margin: 0, fontSize: u(26 * B), display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {headline}
        </p>
        {button("Ver productos", overlay)}
      </div>

      {/* Header */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: u(d.header),
          display: "flex",
          alignItems: "center",
          gap: u(16),
          paddingInline: u(gutter),
          color: headerFg,
          background: overlay ? "transparent" : "var(--bg)",
          borderBottom: !overlay && theme.effects.dividers ? "1px solid var(--border)" : undefined,
        }}
      >
        {headerInner}
      </div>

      {/* Grilla de productos */}
      <div style={{ position: "absolute", left: u(gutter), right: u(gutter), top: u(gridTop) }}>
        {showTitle ? (
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", height: u(titleH) }}>
            <span style={{ ...heading, fontSize: u(14 * B) }}>Novedades</span>
            <span style={{ fontSize: u(8 * B), color: "var(--fg-muted)", textDecoration: "underline" }}>Ver todo</span>
          </div>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, columnGap: u(d.gap), rowGap: u(d.gap * 1.6) }}>
          {Array.from({ length: cols * 2 }, (_, i) => {
            const tone = `color-mix(in oklab, var(--fg) ${TONES[i % TONES.length]}%, var(--surface))`;
            const promo = i === 0;
            return (
              <div
                key={i}
                style={{
                  background: panel ? "var(--surface)" : undefined,
                  border: theme.cards.style === "bordered" ? "1px solid var(--border)" : undefined,
                  boxShadow: theme.cards.style === "elevated" ? "var(--shadow-card)" : undefined,
                  borderRadius: panel ? u(px("--radius-lg")) : 0,
                  overflow: "hidden",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    aspectRatio: vars["--card-ratio"],
                    background: "var(--surface)",
                    borderRadius: panel ? 0 : u(px("--radius-lg")),
                    overflow: "hidden",
                  }}
                >
                  {cover ? (
                    <div style={{ position: "absolute", inset: 0, background: tone }} />
                  ) : (
                    <div style={{ position: "absolute", inset: "20% 28%", borderRadius: u(px("--radius-sm")), background: tone }} />
                  )}
                  {promo ? (
                    <span
                      style={{
                        position: "absolute",
                        top: u(5),
                        left: u(5),
                        padding: `${u(1.5)} ${u(4)}`,
                        borderRadius: u(px("--radius-sm")),
                        background: "var(--bg)",
                        color: "var(--accent)",
                        fontSize: u(7 * B),
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      20 % OFF
                    </span>
                  ) : null}
                </div>
                <div style={{ padding: panel ? u(d.pad) : `${u(d.pad)} 0 0`, display: "flex", flexDirection: "column", gap: u(2) }}>
                  {theme.cards.showBrand ? (
                    <span style={{ fontSize: u(6.5 * B), letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-muted)" }}>Marca</span>
                  ) : null}
                  {theme.cards.showSku ? (
                    <span style={{ fontSize: u(6.5 * B), fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>SKU-{1040 + i}</span>
                  ) : null}
                  <span style={{ fontSize: u(9 * B), fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {names[i % names.length]}
                  </span>
                  <span style={{ fontSize: u(9.5 * B), fontWeight: "var(--body-strong-weight)" as Weight, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {promo ? (
                      <>
                        <span style={{ color: "var(--accent)" }}>{PRICES[0]}</span>{" "}
                        <s style={{ color: "var(--fg-muted)", fontWeight: "var(--body-weight)" as Weight, fontSize: u(8 * B) }}>$ 45.900</s>
                      </>
                    ) : (
                      PRICES[i % PRICES.length]
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
