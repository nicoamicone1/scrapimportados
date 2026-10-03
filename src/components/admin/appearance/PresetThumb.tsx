import { Plus, Search, ShoppingBag } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { googleHref, isDarkTheme, themeVars, type Theme } from "@/lib/theme";

/*
 * Miniatura fiel de un tema (selector de presets del admin, alta de tienda,
 * tarjeta de la tienda en el inicio del panel y la demo de la landing).
 *
 * No es una aproximación con colores sueltos: el contenedor recibe
 * `themeVars(theme)` y todo adentro usa `var(--bg)`, `var(--font-heading)`,
 * `var(--btn-radius)`… Se dibuja un storefront chico de 560 × 448 "px
 * virtuales" que escala con el ancho de la tarjeta (unidades de container
 * query: `--u` = 1/560 del ancho), así que se ve igual a 120 px o a 320 px,
 * sin JS ni medir nada.
 *
 * Desde 2026-10 dibuja la DISPOSICIÓN de cada preset, que es lo que lo vende:
 * - header según `header.layout` (los seis: una fila, al centro, mínimo,
 *   apilado, pastilla flotante, doble barra con banda de color);
 * - portada según `style.hero` (foto a sangre, mitad y mitad, enmarcada,
 *   afiche tipográfico, apilada) con la forma de `style.shape`;
 * - título de sección según `style.titles`;
 * - tarjetas según `style.card` (apilada, sobre la foto, en caja, baldosa,
 *   fila de lista de precios) con `cards.*`, radios y densidad.
 */

const W = 560;
const H = 448;

/** Largo en px virtuales → CSS que escala con el ancho de la miniatura. */
const u = (n: number) => `calc(var(--u) * ${Math.round(n * 100) / 100})`;

const DENSITY = {
  compact: { header: 38, gutter: 18, gap: 8, hero: 112, section: 14, pad: 6, control: 22 },
  comfortable: { header: 44, gutter: 22, gap: 12, hero: 118, section: 16, pad: 8, control: 24 },
  airy: { header: 52, gutter: 28, gap: 16, hero: 126, section: 20, pad: 10, control: 26 },
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

/** Radio de `style.shape` en px virtuales (grande: portada; chico: fotos de tarjeta). */
function shapeRadius(shape: Theme["style"]["shape"], big: boolean, fallback: number): string {
  if (shape === "soft") return u(big ? 18 : 10);
  if (shape === "arch") return `${u(999)} ${u(999)} ${u(2)} ${u(2)}`;
  if (shape === "bubble") return big ? `${u(24)} ${u(24)} ${u(24)} ${u(4)}` : `${u(14)} ${u(14)} ${u(14)} ${u(3)}`;
  return u(fallback);
}

export function PresetThumb({ theme, brand, headline, labels = [], className }: PresetThumbProps) {
  const vars = themeVars({ ...theme, custom_css: undefined });
  const px = (key: string) => parseFloat(vars[key] ?? "0") || 0;
  const d = DENSITY[theme.layout.density];
  const B = theme.fonts.baseSize / 16;
  const dark = isDarkTheme(theme);
  const layout = theme.header.layout;
  const style = theme.style;
  const overlay = theme.header.transparentOnHome && style.hero === "cover" && (layout === "logo-left" || layout === "logo-center" || layout === "minimal");
  const row = style.card === "row";
  const cols = row ? 2 : theme.layout.gridColumns.desktop;
  const gutter = d.gutter + (theme.layout.containerWidth === "narrow" ? 36 : 0);
  const cover = theme.cards.imageRatio === "4:5" || theme.cards.imageRatio === "3:4";
  const upperNav = theme.buttons.uppercase && (layout === "logo-center" || layout === "minimal");
  const glow = dark && theme.effects.shadows !== "none";
  const names = labels.length ? labels : ["Producto"];
  const lively = style.motion === "lively";

  const heading: CSSProperties = {
    fontFamily: "var(--font-heading)",
    fontWeight: "var(--heading-weight)" as Weight,
    textTransform: "var(--heading-transform)" as CSSProperties["textTransform"],
    letterSpacing: "var(--heading-tracking)",
    lineHeight: 1.05,
  };
  // "Foto": un tono plano de la tinta del tema (sin gradientes ni imágenes externas).
  const photo = dark ? "color-mix(in oklab, var(--surface) 72%, var(--fg))" : "color-mix(in oklab, var(--fg) 62%, var(--bg))";
  const photoLight = `color-mix(in oklab, ${photo} 80%, #ffffff)`;
  const filter = theme.effects.imageFilter === "mono" ? "grayscale(1)" : undefined;

  const icon = (Icon: typeof Search, size = 12) => <Icon aria-hidden strokeWidth={1.5} style={{ width: u(size), height: u(size), flexShrink: 0 }} />;
  const navText: CSSProperties = upperNav ? { fontSize: u(7.5 * B), letterSpacing: "0.12em", textTransform: "uppercase" } : { fontSize: u(9 * B) };
  const nav = (
    <span style={{ display: "flex", gap: u(12), whiteSpace: "nowrap", ...navText }}>
      <span>Productos</span>
      <span>Ofertas</span>
      <span>Contacto</span>
    </span>
  );
  const logo = (size: number) => (
    <span style={{ ...heading, fontSize: u(size * B), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: u(220), flexShrink: 0 }}>{brand}</span>
  );
  const searchField = (w: number | "flex", strong = false) => (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: u(5),
        width: w === "flex" ? undefined : u(w),
        flex: w === "flex" ? 1 : undefined,
        height: u(d.control - (strong ? 0 : 4)),
        paddingInline: u(7),
        border: `${strong ? 1.5 : 1}px solid ${overlay ? "rgb(255 255 255 / .55)" : strong ? "var(--fg)" : "var(--border)"}`,
        borderRadius: strong ? u(px("--btn-radius")) : u(px("--radius-md")),
        background: overlay ? "transparent" : strong ? "var(--bg)" : "var(--surface)",
        color: overlay ? ON_PHOTO : "var(--fg-muted)",
        fontSize: u(8 * B),
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {icon(Search, 9)}
      Buscar productos
    </span>
  );

  /* ------------------------------------------------------------ Header */
  const rowStyle = (h: number, extra?: CSSProperties): CSSProperties => ({
    height: u(h),
    display: "flex",
    alignItems: "center",
    gap: u(16),
    paddingInline: u(gutter),
    ...extra,
  });
  let header: ReactNode;
  let headerH = d.header;
  if (layout === "stacked") {
    headerH = d.header + 10 + 20;
    header = (
      <>
        <div style={{ ...rowStyle(d.header + 10), justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: u(4), fontSize: u(8.5 * B), flex: 1 }}>
            {theme.header.showSearch ? (
              <>
                {icon(Search, 10)} Buscar
              </>
            ) : null}
          </span>
          {logo(24)}
          <span style={{ fontSize: u(8.5 * B), flex: 1, textAlign: "right" }}>Carrito (2)</span>
        </div>
        <div style={{ ...rowStyle(20), justifyContent: "center", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>{nav}</div>
      </>
    );
  } else if (layout === "double") {
    headerH = d.header + 20;
    header = (
      <>
        <div style={rowStyle(d.header)}>
          {logo(15)}
          {theme.header.showSearch ? searchField("flex", true) : <span style={{ flex: 1 }} />}
          {icon(ShoppingBag)}
        </div>
        <div style={{ ...rowStyle(20), background: "var(--primary)", color: "var(--primary-fg)" }}>{nav}</div>
      </>
    );
  } else if (layout === "pill") {
    headerH = d.header + 12;
    header = (
      <div style={{ paddingInline: u(gutter - 6), paddingTop: u(6) }}>
        <div
          style={{
            ...rowStyle(d.header, { paddingInline: u(14) }),
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: style.shape === "bubble" ? `${u(20)} ${u(20)} ${u(20)} ${u(5)}` : style.shape === "soft" ? u(12) : u(999),
            boxShadow: dark ? undefined : "0 4px 12px -6px rgb(0 0 0 / .18)",
          }}
        >
          {logo(14)}
          <span style={{ flex: 1, display: "flex", justifyContent: "center" }}>{nav}</span>
          {theme.header.showSearch ? icon(Search) : null}
          {icon(ShoppingBag)}
        </div>
      </div>
    );
  } else if (layout === "logo-center") {
    header = (
      <div style={{ ...rowStyle(d.header), color: overlay ? ON_PHOTO : undefined }}>
        <span style={{ flex: 1, display: "flex", minWidth: 0 }}>{nav}</span>
        {logo(17)}
        <span style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: u(10) }}>
          {theme.header.showSearch ? icon(Search) : null}
          {icon(ShoppingBag)}
        </span>
      </div>
    );
  } else if (layout === "minimal") {
    header = (
      <div style={{ ...rowStyle(d.header), color: overlay ? ON_PHOTO : undefined }}>
        {logo(16)}
        <span style={{ marginLeft: "auto", display: "flex", gap: u(12), whiteSpace: "nowrap", ...navText }}>
          <span>Menú</span>
          {theme.header.showSearch ? <span>Buscar</span> : null}
          <span>Carrito (2)</span>
        </span>
      </div>
    );
  } else {
    header = (
      <div style={{ ...rowStyle(d.header), color: overlay ? ON_PHOTO : undefined }}>
        {logo(15)}
        {nav}
        <span style={{ flex: 1 }} />
        {theme.header.showSearch ? searchField(140) : null}
        {icon(ShoppingBag)}
      </div>
    );
  }
  const announceH = lively ? 14 : 0;

  /** Botón primario del tema; sobre foto, la variante clara del storefront. */
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

  /* ------------------------------------------------------------ Portada */
  const heroTop = overlay ? 0 : announceH + headerH;
  const heroH = d.hero + (overlay ? announceH + d.header : 0);
  const heroR = shapeRadius(style.shape, true, 0);
  const title = (size: number, color?: string, lines = 2, extra?: CSSProperties) => (
    <p
      style={{
        ...heading,
        margin: 0,
        fontSize: u(size * B),
        color,
        display: "-webkit-box",
        WebkitLineClamp: lines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        ...extra,
      }}
    >
      {headline}
    </p>
  );
  let hero: ReactNode;
  const box = (extra: CSSProperties): CSSProperties => ({ position: "absolute", ...extra });
  if (style.hero === "split") {
    hero = (
      <div style={box({ left: 0, right: 0, top: u(heroTop), height: u(heroH) })}>
        <div style={box({ left: 0, top: 0, bottom: 0, width: "50%", background: "var(--primary)" })} />
        <div style={box({ left: "52%", right: u(gutter), top: u(8), bottom: u(8), background: photo, filter, borderRadius: heroR })} />
        <div style={box({ left: u(gutter), top: 0, bottom: 0, width: "40%", display: "flex", flexDirection: "column", justifyContent: "center", gap: u(10) })}>
          {title(22, "var(--primary-fg)", 3)}
          <span style={{ display: "inline-flex", alignSelf: "flex-start", padding: `${u(5)} ${u(12)}`, background: "var(--bg)", color: "var(--fg)", borderRadius: u(px("--btn-radius")), fontSize: u(8.5 * B), fontWeight: 600 }}>
            Ver productos
          </span>
        </div>
      </div>
    );
  } else if (style.hero === "framed") {
    hero = (
      <div style={box({ left: u(gutter), right: u(gutter), top: u(heroTop + 6), height: u(heroH - 6) })}>
        <div style={box({ inset: 0, background: photo, filter, borderRadius: heroR })} />
        <div style={box({ left: "6%", bottom: u(10), width: "46%", padding: u(12), display: "flex", flexDirection: "column", gap: u(8), background: "var(--bg)", borderRadius: u(Math.max(px("--radius-lg"), 6)) })}>
          {title(17)}
          {button("Ver productos", false)}
        </div>
      </div>
    );
  } else if (style.hero === "poster") {
    hero = (
      <div style={box({ left: 0, right: 0, top: u(heroTop), height: u(heroH), background: "var(--secondary)" })}>
        <div style={box({ left: u(gutter), right: u(gutter), top: u(10) })}>{title(34, "var(--fg)", 2, { lineHeight: 0.92 })}</div>
        <div style={box({ left: u(gutter), right: u(gutter), bottom: 0, height: "34%", background: photo, filter })} />
      </div>
    );
  } else if (style.hero === "stack") {
    hero = (
      <div style={box({ left: 0, right: 0, top: u(heroTop), height: u(heroH) })}>
        <div style={box({ left: "14%", right: "14%", top: u(6), display: "flex", flexDirection: "column", alignItems: "center", gap: u(7), textAlign: "center" })}>
          {title(20, undefined, 1)}
          {button("Ver productos", false)}
        </div>
        <div style={box({ left: u(gutter), right: u(gutter), top: "56%", bottom: 0, background: photo, filter, borderRadius: heroR })} />
      </div>
    );
  } else {
    hero = (
      <div style={box({ left: 0, right: 0, top: u(heroTop), height: u(heroH) })}>
        <div style={box({ inset: 0, background: photo, filter, borderRadius: overlay ? 0 : undefined })}>
          <div style={box({ right: u(gutter), top: u(overlay ? d.header + 8 : 8), bottom: 0, width: "30%", background: photoLight })} />
        </div>
        <div
          style={box({
            left: u(gutter),
            top: overlay ? u(announceH + d.header) : 0,
            bottom: 0,
            width: "58%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: u(10),
          })}
        >
          {title(26, ON_PHOTO)}
          {button("Ver productos", true)}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------ Título de sección */
  const gridTop = heroTop + heroH + d.section;
  const titleH = 26;
  const t = style.titles;
  const sectionTitle = (
    <div style={{ display: "flex", alignItems: "center", gap: u(10), height: u(titleH), justifyContent: t === "centered" ? "center" : undefined }}>
      {t === "tag" ? (
        <span style={{ padding: `${u(2)} ${u(6)}`, background: "var(--fg)", color: "var(--bg)", fontSize: u(6.5 * B), borderRadius: u(px("--btn-radius")), letterSpacing: "0.08em", fontWeight: 600 }}>NUEVO</span>
      ) : null}
      {t === "index" ? <span style={{ fontSize: u(9 * B), fontWeight: 700 }}>01</span> : null}
      {t === "centered" ? <span style={{ width: u(16), borderTop: "1px solid currentColor", opacity: 0.6 }} /> : null}
      <span style={{ ...heading, fontSize: u(14 * B) }}>Novedades</span>
      {t === "centered" ? <span style={{ width: u(16), borderTop: "1px solid currentColor", opacity: 0.6 }} /> : null}
      {t === "rule" ? <span style={{ flex: 1, borderTop: "1px solid var(--border-strong)" }} /> : null}
      {t !== "centered" ? <span style={{ marginLeft: t === "rule" ? 0 : "auto", fontSize: u(8 * B), color: "var(--fg-muted)", textDecoration: "underline" }}>Ver todo</span> : null}
    </div>
  );

  /* ------------------------------------------------------------ Tarjetas */
  const cardW = (W - 2 * gutter - (cols - 1) * d.gap) / cols;
  const mediaR = shapeRadius(style.shape, false, px("--radius-lg"));
  const card = style.card;
  const centered = card === "stack" && t === "centered";

  const media = (i: number, extra?: CSSProperties) => {
    const tone = `color-mix(in oklab, var(--fg) ${TONES[i % TONES.length]}%, var(--surface))`;
    return (
      <div style={{ position: "relative", aspectRatio: row ? "1 / 1" : vars["--card-ratio"], background: "var(--surface)", overflow: "hidden", borderRadius: mediaR, ...extra }}>
        {cover ? (
          <div style={{ position: "absolute", inset: 0, background: tone }} />
        ) : (
          <div style={{ position: "absolute", inset: "20% 28%", borderRadius: u(px("--radius-sm")), background: tone }} />
        )}
        {i === 0 && !row ? (
          <span
            style={{
              position: "absolute",
              ...(style.shape === "arch" ? { bottom: u(5) } : { top: u(5) }),
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
        {card === "tile" ? (
          <span
            style={{
              position: "absolute",
              right: u(5),
              bottom: u(5),
              width: u(16),
              height: u(16),
              borderRadius: "9999px",
              background: "var(--primary)",
              color: "var(--primary-fg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus aria-hidden strokeWidth={2} style={{ width: u(10), height: u(10) }} />
          </span>
        ) : null}
      </div>
    );
  };
  const price = (i: number, color?: string) => (
    <span style={{ fontSize: u(9.5 * B), fontWeight: "var(--body-strong-weight)" as Weight, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color }}>
      {i === 0 ? (
        <>
          <span style={{ color: color ?? "var(--accent)" }}>{PRICES[0]}</span>{" "}
          <s style={{ color: color ?? "var(--fg-muted)", opacity: color ? 0.8 : 1, fontWeight: "var(--body-weight)" as Weight, fontSize: u(8 * B) }}>$ 45.900</s>
        </>
      ) : (
        PRICES[i % PRICES.length]
      )}
    </span>
  );
  const meta = (i: number) => (
    <>
      {theme.cards.showBrand ? <span style={{ fontSize: u(6.5 * B), letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-muted)" }}>Marca</span> : null}
      {theme.cards.showSku ? <span style={{ fontSize: u(6.5 * B), fontFamily: "ui-monospace, monospace", color: "var(--fg-muted)" }}>SKU-{1040 + i}</span> : null}
    </>
  );
  const nameEl = (i: number, extra?: CSSProperties) => (
    <span style={{ fontSize: u(9 * B), fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...extra }}>{names[i % names.length]}</span>
  );
  const smallBtn = (label: string) => (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: u(d.control - 6),
        paddingInline: u(8),
        marginTop: u(4),
        background: "var(--primary)",
        color: "var(--primary-fg)",
        borderRadius: u(px("--btn-radius")),
        fontSize: u(7.5 * B),
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );

  const renderCard = (i: number) => {
    if (row) {
      return (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: u(8), paddingBlock: u(5), borderBottom: "1px solid var(--border)", minWidth: 0 }}>
          {media(i, { width: u(30), flexShrink: 0, borderRadius: u(px("--radius-sm")) })}
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
            {theme.cards.showSku ? <span style={{ fontSize: u(6 * B), fontFamily: "ui-monospace, monospace", color: "var(--fg-muted)" }}>SKU-{1040 + i}</span> : null}
            {nameEl(i)}
          </div>
          {price(i)}
          <span style={{ padding: `${u(3)} ${u(7)}`, background: "var(--primary)", color: "var(--primary-fg)", borderRadius: u(px("--btn-radius")), fontSize: u(7 * B), fontWeight: 600 }}>Agregar</span>
        </div>
      );
    }
    if (card === "overlay") {
      return (
        <div key={i} style={{ position: "relative", minWidth: 0 }}>
          {media(i)}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: `${u(18)} ${u(d.pad)} ${u(d.pad)}`,
              background: "linear-gradient(to top, rgb(0 0 0 / .72), transparent)",
              color: ON_PHOTO,
              display: "flex",
              flexDirection: "column",
              gap: u(2),
              borderRadius: `0 0 ${mediaR} ${mediaR}`,
            }}
          >
            <span style={{ ...heading, fontSize: u(10 * B), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{names[i % names.length]}</span>
            {price(i, ON_PHOTO)}
          </div>
        </div>
      );
    }
    const boxed = card === "boxed";
    const tile = card === "tile";
    const panel = boxed || tile || theme.cards.style !== "flat";
    return (
      <div
        key={i}
        style={{
          background: panel ? "var(--surface)" : undefined,
          border: boxed || (!tile && theme.cards.style === "bordered") ? "1px solid var(--border)" : tile && dark ? "1px solid var(--border)" : undefined,
          boxShadow: !boxed && !tile && theme.cards.style === "elevated" ? "var(--shadow-card)" : undefined,
          borderRadius: panel ? (tile && style.shape === "bubble" ? `${u(18)} ${u(18)} ${u(18)} ${u(4)}` : u(Math.max(px("--radius-lg"), tile ? 8 : 0))) : 0,
          padding: boxed || tile ? u(4) : 0,
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        {media(i, panel && !boxed && !tile ? { borderRadius: 0 } : undefined)}
        <div
          style={{
            padding: panel ? `${u(d.pad)} ${u(boxed || tile ? 2 : d.pad)} ${u(boxed || tile ? 2 : d.pad)}` : `${u(d.pad)} 0 0`,
            display: "flex",
            flexDirection: "column",
            alignItems: centered ? "center" : undefined,
            gap: u(2),
          }}
        >
          {meta(i)}
          {nameEl(i, centered ? { maxWidth: "100%" } : undefined)}
          {price(i)}
          {boxed ? smallBtn("Agregar al carrito") : null}
        </div>
      </div>
    );
  };

  const count = row ? 8 : cols * 2;
  const showTitle = gridTop + titleH + (row ? 0 : cardW * RATIO[theme.cards.imageRatio]) <= H - 30;

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
      {hero}

      {/* Anuncio (marquesina en `lively`) + header */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, color: overlay ? ON_PHOTO : "var(--fg)", background: overlay || layout === "pill" ? "transparent" : "var(--bg)" }}>
        {lively ? (
          <div style={{ height: u(announceH), background: "var(--secondary)", color: "var(--fg)", fontSize: u(6.5 * B), display: "flex", alignItems: "center", gap: u(24), whiteSpace: "nowrap", overflow: "hidden", paddingLeft: u(8) }}>
            <span>Envíos a todo el país</span>
            <span>10 % off con transferencia</span>
            <span>Envíos a todo el país</span>
            <span>10 % off con transferencia</span>
          </div>
        ) : null}
        <div style={{ borderBottom: !overlay && theme.effects.dividers && layout !== "double" ? "1px solid var(--border)" : undefined }}>{header}</div>
      </div>

      {/* Grilla de productos */}
      <div style={{ position: "absolute", left: u(gutter), right: u(gutter), top: u(gridTop) }}>
        {showTitle ? sectionTitle : null}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            columnGap: u(row ? 18 : d.gap),
            rowGap: u(row ? 0 : d.gap * 1.6),
            borderTop: row ? "1px solid var(--border-strong)" : undefined,
          }}
        >
          {Array.from({ length: count }, (_, i) => renderCard(i))}
        </div>
      </div>
    </div>
  );
}
