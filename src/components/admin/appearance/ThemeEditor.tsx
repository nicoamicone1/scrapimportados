"use client";

import { ChevronDown, Loader2, Monitor, RotateCcw, Smartphone } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { previewTheme, saveTheme } from "@/app/admin/(panel)/apariencia/actions";
import { ColorField, Segmented, SelectField, ToggleField } from "@/components/admin/builder/fields";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Input";
import { toast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CUSTOM_CSS_MAX_BYTES, validateCustomCss } from "@/lib/schemas/appearance";
import {
  closestWeight,
  contrastRatio,
  fontStack,
  getFont,
  googleHref,
  PRESET_LIST,
  PRESETS,
  type PresetId,
  type Theme,
  type ThemeColors,
} from "@/lib/theme";

import { FontSelect } from "./FontSelect";
import { PreviewFrame } from "./PreviewFrame";
import type { PreviewDevice } from "./preview-css";

/*
 * Editor del tema (DESIGN.md §3–§5): formulario por secciones a la
 * izquierda y preview en vivo a la derecha. Los colores/fuentes/radios se
 * aplican al instante (CSS variables); lo que cambia la estructura (cards,
 * header, footer, botones) se vuelve a renderizar en el server con debounce.
 */

type Section = "preset" | "colors" | "type" | "shapes" | "cards" | "header" | "layout" | "footer" | "effects" | "css";

const COLOR_FIELDS: { key: keyof ThemeColors; label: string; hint: string }[] = [
  { key: "background", label: "Fondo", hint: "Fondo de toda la tienda." },
  { key: "surface", label: "Superficie", hint: "Cards, inputs, fondo de fotos, carrito." },
  { key: "text", label: "Texto", hint: "Texto principal y precios." },
  { key: "textMuted", label: "Texto secundario", hint: "Metadatos, precio tachado, ayudas." },
  { key: "primary", label: "Primario", hint: "Botón principal, links activos, foco." },
  { key: "primaryText", label: "Texto sobre primario", hint: "Texto de los botones principales." },
  { key: "secondary", label: "Secundario", hint: "Bandas planas y barra de anuncio." },
  { key: "accent", label: "Acento", hint: "Precio en oferta y etiqueta de promo." },
  { key: "border", label: "Bordes", hint: "Reglas y bordes de cards." },
  { key: "success", label: "Éxito", hint: "Confirmaciones, «Pagado»." },
  { key: "danger", label: "Error", hint: "Errores y «Sin stock»." },
];

/** Pares de contraste a controlar (DESIGN.md §3.1). */
const CONTRAST_CHECKS: { fg: keyof ThemeColors; bg: keyof ThemeColors; min: number; label: string }[] = [
  { fg: "text", bg: "background", min: 4.5, label: "Texto sobre fondo" },
  { fg: "textMuted", bg: "background", min: 4.5, label: "Texto secundario sobre fondo" },
  { fg: "textMuted", bg: "surface", min: 4.5, label: "Texto secundario sobre superficie" },
  { fg: "primaryText", bg: "primary", min: 4.5, label: "Texto sobre botón primario" },
  { fg: "primary", bg: "background", min: 3, label: "Primario sobre fondo" },
  { fg: "accent", bg: "background", min: 4.5, label: "Acento (precio promo) sobre fondo" },
  { fg: "text", bg: "secondary", min: 4.5, label: "Texto sobre secundario" },
  { fg: "danger", bg: "background", min: 4.5, label: "Error sobre fondo" },
];

/** Claves que cambian la estructura del preview (requieren render en el server). */
function structuralKey(t: Theme) {
  return JSON.stringify({ cards: t.cards, header: t.header, footer: t.footer, buttons: t.buttons, effects: t.effects, grid: t.layout.gridColumns, preset: t.preset === "editorial" });
}

function Accordion({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: Section;
  title: string;
  summary?: ReactNode;
  open: boolean;
  onToggle: (id: Section) => void;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-adm-border">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`sec-${id}`}
          onClick={() => onToggle(id)}
          className="flex h-12 w-full items-center gap-2 px-4 text-left hover:bg-adm-hover"
        >
          <span className="text-sm font-semibold text-adm-fg">{title}</span>
          {summary ? <span className="min-w-0 flex-1 truncate text-right text-xs text-adm-fg-muted">{summary}</span> : <span className="flex-1" />}
          <ChevronDown className={cn("size-4 shrink-0 text-adm-fg-muted transition-transform", !open && "-rotate-90")} aria-hidden />
        </button>
      </h2>
      {open ? (
        <div id={`sec-${id}`} className="space-y-4 px-4 pt-1 pb-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function PresetCard({ id, name, description, active, onApply }: { id: Exclude<PresetId, "custom">; name: string; description: string; active: boolean; onApply: () => void }) {
  const t = PRESETS[id];
  const c = t.colors;
  const radius = { none: 0, sm: 4, md: 8, lg: 12, full: 16 }[t.radius];
  const btnRadius = t.buttons.shape === "pill" ? 999 : t.buttons.shape === "square" ? 0 : radius;
  const btn =
    t.buttons.style === "solid"
      ? { background: c.primary, color: c.primaryText, border: `1px solid ${c.primary}` }
      : t.buttons.style === "outline"
        ? { background: "transparent", color: c.text, border: `1px solid ${c.text}` }
        : { background: `color-mix(in oklab, ${c.primary} 14%, ${c.background})`, color: c.primary, border: "1px solid transparent" };
  return (
    <button
      type="button"
      onClick={onApply}
      aria-pressed={active}
      className={cn(
        "group w-full overflow-hidden rounded-adm border text-left transition-colors",
        active ? "border-adm-accent ring-1 ring-adm-accent" : "border-adm-border hover:border-adm-input-border",
      )}
    >
      <div className="p-3" style={{ background: c.background, color: c.text }}>
        <p
          style={{
            fontFamily: fontStack(t.fonts.heading),
            fontWeight: t.fonts.headingWeight,
            textTransform: t.fonts.headingTransform,
            letterSpacing: t.fonts.headingTracking === "tight" ? "-0.02em" : t.fonts.headingTracking === "wide" ? "0.08em" : 0,
            fontSize: 22,
            lineHeight: 1.05,
          }}
        >
          Nueva temporada
        </p>
        <div className="mt-2 flex items-end gap-2">
          <div className="size-10 shrink-0" style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: radius }} />
          <div className="min-w-0 flex-1" style={{ fontFamily: fontStack(t.fonts.body), fontSize: 12 }}>
            <p className="truncate" style={{ color: c.textMuted }}>
              Mesa de lapacho
            </p>
            <p>
              <span style={{ color: c.accent, fontWeight: 600 }}>$ 36.720</span>{" "}
              <s style={{ color: c.textMuted }}>$ 45.900</s>
            </p>
          </div>
          <span
            className="shrink-0 px-2.5 py-1.5 text-[11px]"
            style={{
              ...btn,
              borderRadius: btnRadius,
              fontFamily: fontStack(t.fonts.body),
              fontWeight: 600,
              textTransform: t.buttons.uppercase ? "uppercase" : "none",
              letterSpacing: t.buttons.uppercase ? "0.08em" : 0,
            }}
          >
            Comprar
          </span>
        </div>
      </div>
      <div className="border-t border-adm-border bg-adm-surface px-3 py-2">
        <p className="text-[13px] font-medium text-adm-fg">
          {name}
          {active ? <span className="ml-1.5 text-xs font-normal text-adm-accent">· En uso</span> : null}
        </p>
        <p className="line-clamp-2 text-xs text-adm-fg-muted">{description}</p>
      </div>
    </button>
  );
}

function ContrastList({ colors }: { colors: ThemeColors }) {
  return (
    <ul className="space-y-1 rounded-adm border border-adm-border bg-adm-surface-2/50 p-2.5 text-xs">
      {CONTRAST_CHECKS.map((ck) => {
        const ratio = contrastRatio(colors[ck.fg], colors[ck.bg]);
        const okay = ratio >= ck.min;
        return (
          <li key={`${ck.fg}-${ck.bg}`} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-5 w-8 shrink-0 items-center justify-center rounded-[3px] border border-adm-border text-[11px] font-semibold"
              style={{ background: colors[ck.bg], color: colors[ck.fg] }}
            >
              Aa
            </span>
            <span className="min-w-0 flex-1 truncate text-adm-fg">{ck.label}</span>
            <span className={cn("tnum shrink-0 font-medium", okay ? "text-adm-success" : "text-adm-danger")}>
              {ratio.toFixed(1)}:1 {okay ? "AA" : `· mínimo ${ck.min}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ThemeEditor({ initialTheme, initialNode }: { initialTheme: Theme; initialNode: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialTheme));
  const [basePreset, setBasePreset] = useState<PresetId | null>(initialTheme.preset === "custom" ? null : initialTheme.preset);
  const [open, setOpen] = useState<Section | null>("preset");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [node, setNode] = useState<ReactNode>(initialNode);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmPreset, setConfirmPreset] = useState<Exclude<PresetId, "custom"> | null>(null);
  const [liveTheme, setLiveTheme] = useState<Theme>(initialTheme);
  const seq = useRef(0);
  const first = useRef(true);

  const dirty = JSON.stringify(theme) !== savedJson;
  const cssIssues = useMemo(() => validateCustomCss(theme.custom_css ?? ""), [theme.custom_css]);
  const key = structuralKey(liveTheme);

  // Preview: CSS al toque (debounce corto), estructura en el server.
  useEffect(() => {
    const t = window.setTimeout(() => setLiveTheme(theme), 150);
    return () => window.clearTimeout(t);
  }, [theme]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const current = ++seq.current;
    setLoading(true);
    void previewTheme(liveTheme, device).then((r) => {
      if (current !== seq.current) return;
      setLoading(false);
      if (r.ok) setNode(r.data.node);
      else toast.error(r.error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo cambios estructurales o de dispositivo
  }, [key, device]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Fuentes de los presets para las miniaturas.
  const presetFontsHref = useMemo(
    () => googleHref(PRESET_LIST.flatMap((p) => [{ id: PRESETS[p.id].fonts.heading, weights: [PRESETS[p.id].fonts.headingWeight] }, { id: PRESETS[p.id].fonts.body, weights: [400, 600] }])),
    [],
  );

  /** Cualquier edición manual pasa el tema a "custom". */
  const edit = (fn: (t: Theme) => Theme) => setTheme((t) => ({ ...fn(t), preset: "custom" }));
  const set = <K extends keyof Theme>(section: K, patch: Partial<Theme[K]>) =>
    edit((t) => ({ ...t, [section]: { ...(t[section] as object), ...(patch as object) } }) as Theme);

  const applyPreset = (id: Exclude<PresetId, "custom">) => {
    setTheme({ ...PRESETS[id], cards: { ...PRESETS[id].cards }, custom_css: theme.custom_css });
    setBasePreset(id);
    toast.success(`Preset «${PRESET_LIST.find((p) => p.id === id)?.name}» aplicado. Guardá para publicarlo.`);
  };

  const setFont = (role: "heading" | "body", id: string) => {
    edit((t) => {
      const weightKey = role === "heading" ? "headingWeight" : "bodyWeight";
      const w = closestWeight(id, t.fonts[weightKey]);
      if (w !== t.fonts[weightKey]) toast.info(`${getFont(id).family} no tiene peso ${t.fonts[weightKey]}: lo ajustamos a ${w}.`);
      return { ...t, fonts: { ...t.fonts, [role]: id, [weightKey]: w } as Theme["fonts"] };
    });
  };

  const save = async () => {
    if (cssIssues.length) {
      setOpen("css");
      toast.error("Corregí el CSS personalizado antes de guardar.");
      return;
    }
    setSaving(true);
    const r = await saveTheme(theme);
    setSaving(false);
    if (!r.ok) return void toast.error(r.error);
    setSavedJson(JSON.stringify(theme));
    toast.success("Tema guardado. Ya se ve en la tienda.");
  };

  const toggle = (id: Section) => setOpen((o) => (o === id ? null : id));
  const presetName = theme.preset === "custom" ? "Personalizado" : PRESET_LIST.find((p) => p.id === theme.preset)?.name;
  const headingFont = getFont(theme.fonts.heading);
  const bodyFont = getFont(theme.fonts.body);

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      {presetFontsHref ? <link rel="stylesheet" href={presetFontsHref} /> : null}
      {/* Formulario */}
      <div className="w-full shrink-0 overflow-hidden rounded-adm border border-adm-border bg-adm-surface xl:sticky xl:top-4 xl:max-h-[calc(100dvh-96px)] xl:w-[400px] xl:overflow-y-auto adm-scroll">
        <Accordion id="preset" title="Preset" summary={presetName} open={open === "preset"} onToggle={toggle}>
          <p className="text-xs text-adm-fg-muted">Un punto de partida completo. Aplicarlo reemplaza todo el tema (menos el CSS personalizado).</p>
          <div className="grid gap-3">
            {PRESET_LIST.map((p) => (
              <PresetCard
                key={p.id}
                id={p.id}
                name={p.name}
                description={p.description}
                active={theme.preset === p.id}
                onApply={() => (dirty || theme.preset === "custom" ? setConfirmPreset(p.id) : applyPreset(p.id))}
              />
            ))}
          </div>
        </Accordion>

        <Accordion id="colors" title="Colores" summary={<ColorDots colors={theme.colors} />} open={open === "colors"} onToggle={toggle}>
          <ContrastList colors={theme.colors} />
          <div className="grid gap-3.5">
            {COLOR_FIELDS.map((f) => (
              <ColorField
                key={f.key}
                label={f.label}
                hint={f.hint}
                value={theme.colors[f.key]}
                onChange={(v) => {
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) set("colors", { [f.key]: v.toUpperCase() } as Partial<ThemeColors>);
                }}
              />
            ))}
          </div>
        </Accordion>

        <Accordion id="type" title="Tipografía" summary={`${headingFont.family} + ${bodyFont.family}`} open={open === "type"} onToggle={toggle}>
          <FontSelect label="Títulos" role="heading" value={theme.fonts.heading} onChange={(id) => setFont("heading", id)} />
          <SelectField
            label="Peso de los títulos"
            value={String(theme.fonts.headingWeight)}
            onChange={(v) => set("fonts", { headingWeight: Number(v) })}
            options={headingFont.weights.map((w) => ({ value: String(w), label: String(w) }))}
          />
          <FontSelect label="Texto" role="body" value={theme.fonts.body} onChange={(id) => setFont("body", id)} hint="La de los nombres de producto, precios y botones." />
          <SelectField
            label="Peso del texto"
            value={String(theme.fonts.bodyWeight)}
            onChange={(v) => set("fonts", { bodyWeight: Number(v) })}
            options={bodyFont.weights.filter((w) => w <= 600).map((w) => ({ value: String(w), label: String(w) }))}
          />
          <Segmented
            label="Títulos en mayúsculas"
            value={theme.fonts.headingTransform}
            onChange={(headingTransform) => set("fonts", { headingTransform })}
            options={[
              { value: "none", label: "No" },
              { value: "uppercase", label: "Sí" },
            ]}
          />
          <Segmented
            label="Espaciado de letras en títulos"
            value={theme.fonts.headingTracking}
            onChange={(headingTracking) => set("fonts", { headingTracking })}
            options={[
              { value: "tight", label: "Justo" },
              { value: "normal", label: "Normal" },
              { value: "wide", label: "Amplio" },
            ]}
          />
          <Segmented
            label="Tamaño base"
            value={theme.fonts.baseSize}
            onChange={(baseSize) => set("fonts", { baseSize })}
            options={[
              { value: 15, label: "15 px" },
              { value: 16, label: "16 px" },
              { value: 17, label: "17 px" },
            ]}
          />
        </Accordion>

        <Accordion id="shapes" title="Formas y botones" open={open === "shapes"} onToggle={toggle}>
          <Segmented
            label="Redondeo"
            value={theme.radius}
            onChange={(radius) => edit((t) => ({ ...t, radius }))}
            options={[
              { value: "none", label: "Recto" },
              { value: "sm", label: "Leve" },
              { value: "md", label: "Medio" },
              { value: "lg", label: "Grande" },
              { value: "full", label: "Máx." },
            ]}
          />
          <Segmented
            label="Estilo del botón principal"
            value={theme.buttons.style}
            onChange={(style) => set("buttons", { style })}
            options={[
              { value: "solid", label: "Sólido" },
              { value: "outline", label: "Contorno" },
              { value: "soft", label: "Suave" },
            ]}
            hint="El botón de compra final («Confirmar pedido») es siempre sólido."
          />
          <Segmented
            label="Forma del botón"
            value={theme.buttons.shape}
            onChange={(shape) => set("buttons", { shape })}
            options={[
              { value: "radius", label: "Redondeo del tema" },
              { value: "square", label: "Recto" },
              { value: "pill", label: "Píldora" },
            ]}
          />
          <ToggleField label="Botones en mayúsculas" checked={theme.buttons.uppercase} onChange={(uppercase) => set("buttons", { uppercase })} />
        </Accordion>

        <Accordion id="cards" title="Tarjetas de producto" open={open === "cards"} onToggle={toggle}>
          <Segmented
            label="Estilo"
            value={theme.cards.style}
            onChange={(style) => set("cards", { style })}
            options={[
              { value: "flat", label: "Plana" },
              { value: "bordered", label: "Con borde" },
              { value: "elevated", label: "Con sombra" },
            ]}
          />
          <Segmented
            label="Proporción de la foto"
            value={theme.cards.imageRatio}
            onChange={(imageRatio) => set("cards", { imageRatio })}
            options={[
              { value: "1:1", label: "1:1" },
              { value: "4:5", label: "4:5" },
              { value: "3:4", label: "3:4" },
              { value: "16:9", label: "16:9" },
            ]}
            hint={theme.cards.imageRatio === "1:1" || theme.cards.imageRatio === "16:9" ? "La foto se muestra entera sobre la superficie: ideal para productos recortados." : "La foto llena el recuadro: ideal para fotos ambientadas."}
          />
          <Segmented
            label="Al pasar el mouse"
            value={theme.cards.hover}
            onChange={(hover) => set("cards", { hover })}
            options={[
              { value: "none", label: "Nada" },
              { value: "zoom", label: "Zoom / 2.ª foto" },
              { value: "lift", label: "Elevar" },
            ]}
          />
          <ToggleField label="Mostrar marca" checked={theme.cards.showBrand} onChange={(showBrand) => set("cards", { showBrand })} />
          <ToggleField label="Mostrar SKU" checked={theme.cards.showSku} onChange={(showSku) => set("cards", { showSku })} />
          <ToggleField
            label="Precio con transferencia"
            description="«$ 33.048 con transferencia» debajo del precio."
            checked={theme.cards.showTransferPrice}
            onChange={(showTransferPrice) => set("cards", { showTransferPrice })}
          />
          <ToggleField
            label="Precio sin impuestos nacionales"
            description="Además tiene que estar activado en Configuración › Impuestos."
            checked={theme.cards.showNetPrice}
            onChange={(showNetPrice) => set("cards", { showNetPrice })}
          />
        </Accordion>

        <Accordion id="header" title="Encabezado" open={open === "header"} onToggle={toggle}>
          <Segmented
            label="Diseño"
            value={theme.header.layout}
            onChange={(layout) => set("header", { layout })}
            options={[
              { value: "logo-left", label: "Logo a la izq." },
              { value: "logo-center", label: "Logo al centro" },
              { value: "minimal", label: "Mínimo" },
            ]}
          />
          <ToggleField label="Fijo al scrollear" checked={theme.header.sticky} onChange={(sticky) => set("header", { sticky })} />
          <ToggleField
            label="Transparente sobre la portada"
            description="Sólo si la portada empieza con una imagen."
            checked={theme.header.transparentOnHome}
            onChange={(transparentOnHome) => set("header", { transparentOnHome })}
          />
          <ToggleField label="Buscador" checked={theme.header.showSearch} onChange={(showSearch) => set("header", { showSearch })} />
        </Accordion>

        <Accordion id="layout" title="Diseño y espacios" open={open === "layout"} onToggle={toggle}>
          <Segmented
            label="Densidad"
            value={theme.layout.density}
            onChange={(density) => set("layout", { density })}
            options={[
              { value: "compact", label: "Compacta" },
              { value: "comfortable", label: "Cómoda" },
              { value: "airy", label: "Aireada" },
            ]}
          />
          <Segmented
            label="Ancho máximo"
            value={theme.layout.containerWidth}
            onChange={(containerWidth) => set("layout", { containerWidth })}
            options={[
              { value: "narrow", label: "1080 px" },
              { value: "normal", label: "1280 px" },
              { value: "wide", label: "1520 px" },
            ]}
          />
          <Segmented
            label="Columnas en celulares"
            value={theme.layout.gridColumns.mobile}
            onChange={(mobile) => set("layout", { gridColumns: { ...theme.layout.gridColumns, mobile } })}
            options={[
              { value: 1, label: "1" },
              { value: 2, label: "2" },
            ]}
          />
          <Segmented
            label="Columnas en computadora"
            value={theme.layout.gridColumns.desktop}
            onChange={(desktop) => set("layout", { gridColumns: { ...theme.layout.gridColumns, desktop } })}
            options={[
              { value: 3, label: "3" },
              { value: 4, label: "4" },
              { value: 5, label: "5" },
            ]}
          />
        </Accordion>

        <Accordion id="footer" title="Pie de página" open={open === "footer"} onToggle={toggle}>
          <Segmented
            label="Estilo"
            value={theme.footer.style}
            onChange={(style) => set("footer", { style })}
            options={[
              { value: "simple", label: "Simple" },
              { value: "columns", label: "Columnas" },
              { value: "minimal", label: "Mínimo" },
            ]}
          />
          <ToggleField label="Redes sociales" checked={theme.footer.showSocial} onChange={(showSocial) => set("footer", { showSocial })} />
          <ToggleField label="Medios de pago (en texto)" checked={theme.footer.showPayments} onChange={(showPayments) => set("footer", { showPayments })} />
        </Accordion>

        <Accordion id="effects" title="Efectos" open={open === "effects"} onToggle={toggle}>
          <Segmented
            label="Sombras"
            value={theme.effects.shadows}
            onChange={(shadows) => set("effects", { shadows })}
            options={[
              { value: "none", label: "Sin" },
              { value: "soft", label: "Suaves" },
              { value: "strong", label: "Marcadas" },
            ]}
          />
          <ToggleField label="Reglas entre secciones" description="Líneas finas que ordenan sin agregar cajas." checked={theme.effects.dividers} onChange={(dividers) => set("effects", { dividers })} />
          <Segmented
            label="Filtro en portadas y banners"
            value={theme.effects.imageFilter}
            onChange={(imageFilter) => set("effects", { imageFilter })}
            options={[
              { value: "none", label: "Ninguno" },
              { value: "grain", label: "Grano" },
              { value: "mono", label: "Blanco y negro" },
            ]}
            hint="Nunca se aplica a las fotos de producto."
          />
        </Accordion>

        <Accordion id="css" title="CSS personalizado" summary={theme.custom_css?.trim() ? `${(new TextEncoder().encode(theme.custom_css).length / 1024).toFixed(1)} KB` : "Sin CSS"} open={open === "css"} onToggle={toggle}>
          <p className="text-xs text-adm-fg-muted">
            Para ajustes finos. Se aplica después del tema. Sin <code>@import</code>, <code>url(javascript:…)</code> ni <code>expression()</code>; máximo {CUSTOM_CSS_MAX_BYTES / 1024} KB.
          </p>
          <Textarea
            rows={10}
            value={theme.custom_css ?? ""}
            onChange={(e) => edit((t) => ({ ...t, custom_css: e.target.value || undefined }))}
            spellCheck={false}
            aria-label="CSS personalizado"
            aria-invalid={cssIssues.length > 0 || undefined}
            className="font-mono text-xs"
            placeholder={".store-root h1 {\n  letter-spacing: -0.03em;\n}"}
          />
          {cssIssues.length ? (
            <ul className="space-y-1 text-xs text-adm-danger">
              {cssIssues.map((i) => (
                <li key={i.message}>
                  {i.line ? `Línea ${i.line}: ` : ""}
                  {i.message}
                </li>
              ))}
            </ul>
          ) : null}
        </Accordion>
      </div>

      {/* Preview */}
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-adm border border-adm-border bg-adm-surface px-3 py-2">
          <div role="radiogroup" aria-label="Dispositivo" className="flex rounded-adm border border-adm-input-border p-0.5">
            {(
              [
                { value: "desktop", label: "Computadora", icon: Monitor },
                { value: "mobile", label: "Celular", icon: Smartphone },
              ] as const
            ).map((d) => (
              <button
                key={d.value}
                type="button"
                role="radio"
                aria-checked={device === d.value}
                title={d.label}
                aria-label={d.label}
                onClick={() => setDevice(d.value)}
                className={cn("flex size-7 items-center justify-center rounded-[4px]", device === d.value ? "bg-adm-accent text-adm-accent-fg" : "text-adm-fg-muted hover:bg-adm-surface-2")}
              >
                <d.icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
          {loading ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-adm-fg-muted">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Actualizando
            </span>
          ) : null}
          {dirty ? <span className="text-xs font-medium text-adm-warning">Cambios sin guardar</span> : <span className="text-xs text-adm-fg-muted">Todo guardado</span>}
          <div className="ml-auto flex items-center gap-2">
            {basePreset ? (
              <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => setConfirmPreset(basePreset as Exclude<PresetId, "custom">)}>
                Restablecer preset
              </Button>
            ) : null}
            <Button size="sm" disabled={!dirty || saving} onClick={() => setTheme(JSON.parse(savedJson) as Theme)}>
              Descartar
            </Button>
            <Button size="sm" variant="primary" disabled={!dirty} loading={saving} onClick={() => void save()}>
              Guardar
            </Button>
          </div>
        </div>
        <PreviewFrame
          theme={liveTheme}
          device={device}
          onClickCapture={(e) => {
            if ((e.target as HTMLElement).closest("a")) e.preventDefault();
          }}
        >
          {node}
        </PreviewFrame>
      </div>

      <ConfirmDialog
        open={Boolean(confirmPreset)}
        onOpenChange={(o) => !o && setConfirmPreset(null)}
        title={`¿Aplicar el preset «${PRESET_LIST.find((p) => p.id === confirmPreset)?.name ?? ""}»?`}
        description="Reemplaza colores, tipografías, botones, tarjetas y el resto del tema. Tus cambios sin guardar se pierden."
        confirmLabel="Aplicar preset"
        onConfirm={() => {
          if (confirmPreset) applyPreset(confirmPreset);
        }}
      />
    </div>
  );
}

function ColorDots({ colors }: { colors: ThemeColors }) {
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {(["background", "text", "primary", "accent", "secondary"] as const).map((k) => (
        <span key={k} className="inline-block size-3 rounded-full border border-adm-border" style={{ background: colors[k] }} />
      ))}
    </span>
  );
}
