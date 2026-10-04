"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { PresetThumb } from "@/components/admin/appearance/PresetThumb";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { PRESETS, themeFontsHref, themeVars } from "@/lib/theme";

import { CTA_ARROW, CTA_PRIMARY, DISPLAY } from "../brand";
import { injectFontSheet } from "../LazyFontSheets";
import type { PresetKey } from "../specimens";

/** Clave que lee el alta de tienda (`/app/nueva`, contrato L1 → L2). */
export const STORE_DRAFT_KEY = "ecommy_store_draft";

export interface DemoKind {
  kind: string;
  label: string;
  hint: string;
  presetId: PresetKey;
  presetName: string;
  mood: string;
  description: string;
  /** "Incluido en Free" / "Desde Starter" (o null sin planes cargados). */
  planLabel: string | null;
  product: { name: string; price: number; compareAt: number };
  /** Titular de la portada de ejemplo y productos de la grilla. */
  headline: string;
  catalog: readonly string[];
}

const FALLBACK_NAME = "Tu tienda";

/**
 * "Probá tu tienda ahora": el visitante escribe el nombre de su negocio y
 * elige el rubro, y ve la tienda re-estilizarse en vivo con el preset real
 * (`PresetThumb` + `themeVars`, lo mismo que muestra el editor de Apariencia).
 * Efecto de posesión: antes de registrarse ya es "su" tienda. "Crear esta
 * tienda" guarda `{ name, preset }` en `localStorage[STORE_DRAFT_KEY]` y
 * lleva al registro; el alta la precarga.
 *
 * Fuentes: la hoja del preset se pide al acercarse la sección y la de cada
 * rubro al pasar el puntero o enfocar su chip, así el cambio llega con la
 * tipografía ya cargada.
 */
export function StoreDemo({
  kinds,
  initialKind,
  addressTemplate,
  startHref,
}: {
  kinds: readonly DemoKind[];
  initialKind: string;
  /** Dirección de ejemplo con `__slug__` en el lugar del slug (`__slug__.ecommy.app`). */
  addressTemplate: string;
  startHref: string;
}) {
  const [name, setName] = useState("");
  const [kindId, setKindId] = useState(initialKind);
  const root = useRef<HTMLDivElement>(null);
  const current = kinds.find((k) => k.kind === kindId) ?? kinds[0];
  const theme = PRESETS[current.presetId];
  const brand = name.trim() || FALLBACK_NAME;
  const slug = slugify(name, 40) || "tu-tienda";

  // La primera hoja de fuentes, cuando la demo se acerca al viewport.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        injectFontSheet(themeFontsHref(PRESETS[current.presetId]));
        io.disconnect();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [current.presetId]);

  const prefetch = (presetId: PresetKey) => injectFontSheet(themeFontsHref(PRESETS[presetId]));

  const saveDraft = () => {
    try {
      localStorage.setItem(STORE_DRAFT_KEY, JSON.stringify({ name: name.trim(), preset: current.presetId }));
    } catch {
      // Modo privado o almacenamiento bloqueado: el alta arranca vacía, nada más.
    }
  };

  const vars = themeVars(theme) as CSSProperties;
  const btn = theme.buttons.style;

  return (
    <div ref={root} className="grid gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr]">
      {/* Nombre (en el celular, la vista queda justo abajo) ------------------ */}
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <label htmlFor="lp-store-name" className="text-[14px] font-semibold text-eco-ink">
          Cómo se llama tu negocio
        </label>
        <input
          id="lp-store-name"
          type="text"
          value={name}
          maxLength={40}
          autoComplete="organization"
          placeholder="Ej.: Taller Luna"
          onChange={(e) => setName(e.target.value)}
          className={cn(
            DISPLAY,
            "mt-2 h-16 w-full rounded-[14px] border-2 border-eco-ink bg-eco-paper px-5 text-[22px] text-eco-ink placeholder:text-eco-text-muted/70 focus:outline-none focus-visible:ring-4 focus-visible:ring-eco-azul/30 focus-visible:border-eco-azul sm:text-[26px]",
          )}
        />
        <p className="mt-2 text-[13px] text-eco-text-muted">
          Tu dirección: <span className="tnum font-medium break-all text-eco-ink">{addressTemplate.replace("__slug__", slug)}</span>
        </p>
      </div>

      {/* Vista de la tienda ---------------------------------------------- */}
      <div className="relative min-w-0 sm:pb-10 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-2">
        <div aria-hidden className="absolute -top-6 -right-6 hidden size-56 rounded-full bg-eco-durazno sm:block lg:-right-10 lg:size-72" />
        <figure className="relative">
          <div className="overflow-hidden rounded-[26px] bg-eco-paper shadow-[0_0_0_1px_var(--eco-line),0_40px_80px_-40px_rgb(16_22_47/0.45)]">
            <div className="flex h-10 items-center gap-2 border-b border-eco-line bg-eco-niebla px-4">
              <span className="size-2.5 rounded-full bg-eco-line" />
              <span className="size-2.5 rounded-full bg-eco-line" />
              <span className="tnum ml-2 min-w-0 truncate rounded-full bg-eco-paper px-3 py-0.5 text-[12px] text-eco-text-muted">
                {addressTemplate.replace("__slug__", slug)}
              </span>
            </div>
            <div key={current.presetId} className="lp-restyle">
              <PresetThumb theme={theme} brand={brand} headline={current.headline} labels={current.catalog} />
            </div>
          </div>
          <figcaption className="sr-only">
            Vista de tu tienda con el estilo {current.presetName}, con el nombre {brand}.
          </figcaption>

          {/* Producto de ejemplo del rubro, con el tema real: tarjeta que flota. */}
          <div
            key={`card-${current.presetId}`}
            aria-hidden
            style={vars}
            className="eco-pop absolute -bottom-14 -left-8 hidden w-[min(36%,220px)] sm:block"
          >
            <div className="eco-float">
              <div className="-rotate-2 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface text-fg shadow-[0_24px_48px_-20px_rgb(16_22_47/0.5)] [font-family:var(--font-body)]">
                <div className="aspect-[5/3] bg-[color-mix(in_oklab,var(--fg)_14%,var(--surface))]" />
                <div className="space-y-1 p-3">
                  <p className="truncate text-[13px] leading-tight">{current.product.name}</p>
                  <p className="tnum text-[14px] [font-weight:var(--body-strong-weight)]">
                    <span className="text-accent">{formatMoney(current.product.price)}</span>
                    <s className="ml-1.5 text-[11px] text-fg-muted [font-weight:var(--body-weight)]">{formatMoney(current.product.compareAt)}</s>
                  </p>
                  <span
                    className={cn(
                      "mt-1 flex h-8 items-center justify-center rounded-[var(--btn-radius)] text-[11px] [font-weight:var(--body-strong-weight)] [letter-spacing:var(--btn-tracking)] [text-transform:var(--btn-transform)]",
                      btn === "outline" ? "border border-fg text-fg" : btn === "soft" ? "bg-primary-soft text-primary" : "bg-primary text-primary-fg",
                    )}
                  >
                    Agregar al carrito
                  </span>
                </div>
              </div>
            </div>
          </div>
        </figure>
      </div>
      {/* Rubro, estilo y CTA ------------------------------------------------ */}
      <div className="min-w-0 lg:col-start-1 lg:row-start-2">
        <fieldset>
          <legend className="text-[14px] font-semibold text-eco-ink">Qué vendés</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {kinds.map((k) => {
              const on = k.kind === current.kind;
              return (
                <label
                  key={k.kind}
                  onPointerEnter={() => prefetch(k.presetId)}
                  className={cn(
                    "relative inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full whitespace-nowrap border-2 px-4 text-[14px] font-medium transition-[background-color,border-color,color] duration-[240ms] ease-eco-out has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-eco-azul/35",
                    on ? "border-eco-ink bg-eco-ink text-white" : "border-eco-line bg-eco-paper text-eco-ink hover:border-eco-ink",
                  )}
                >
                  <input
                    type="radio"
                    name="lp-store-kind"
                    value={k.kind}
                    checked={on}
                    onFocus={() => prefetch(k.presetId)}
                    onChange={() => {
                      prefetch(k.presetId);
                      setKindId(k.kind);
                    }}
                    className="sr-only"
                  />
                  {on ? <Check className="size-4 text-eco-pomelo" strokeWidth={2.25} aria-hidden /> : null}
                  {k.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div key={current.presetId} className="eco-pop mt-8 rounded-[22px] bg-eco-niebla p-5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-eco-text-muted">
            <span className={cn(DISPLAY, "text-[18px] text-eco-ink")}>{current.presetName}</span>
            <span aria-hidden>·</span>
            <span>{current.mood}</span>
            {current.planLabel ? (
              <span className="ml-auto rounded-full bg-eco-paper px-2.5 py-1 text-[12px] font-medium text-eco-ink shadow-[0_0_0_1px_var(--eco-line)]">
                {current.planLabel}
              </span>
            ) : null}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-eco-ink">{current.description}</p>
        </div>

        <div className="mt-8 flex flex-col items-start gap-3">
          <Link href={startHref} onClick={saveDraft} className={CTA_PRIMARY}>
            Crear esta tienda
            <span className={CTA_ARROW}>
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </span>
          </Link>
          <p className="text-[13px] text-eco-text-muted">Queda cargada con el nombre y el estilo. 14 días de Pro, sin tarjeta.</p>
        </div>
      </div>

    </div>
  );
}
