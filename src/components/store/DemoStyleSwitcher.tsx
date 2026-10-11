"use client";

import { ArrowUpRight, Check, Minus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";

import { platformUrl } from "@/lib/tenant/urls";

import s from "./DemoStyleSwitcher.module.css";

/*
 * Selector de estilos de la tienda demo (la única pieza de Ecommy dentro de un
 * storefront, y sólo en `demo`). Muestra que el diseño es a medida y deja ver la
 * misma tienda con cualquiera de los presets de fábrica: cada opción es un
 * `<a href="?estilo=<id>">` común (navegación completa) porque el tema vive en el
 * layout y lo resuelve el proxy (`src/proxy.ts`: header `x-store-preview-style`
 * + cookie `ecommy_estilo`; `?estilo=original` la borra). Un `router.push` no
 * re-renderiza el layout al cambiar sólo la query.
 *
 * Estilos propios en un CSS module con valores fijos (BRAND §5): el tema de la
 * tienda define variables y CSS personalizado global, y esto se tiene que ver
 * igual con cualquiera. z-index 45: arriba del contenido, del header (30) y del
 * botón de WhatsApp (40); abajo de drawers y modales (50).
 */

export type DemoStyleColors = readonly [background: string, text: string, primary: string, accent: string];

export interface DemoStylePreset {
  id: string;
  name: string;
  /** Tono en dos o tres palabras (`PRESET_LIST[].mood`). */
  mood: string;
  colors: DemoStyleColors;
}

export interface DemoStyleSwitcherProps {
  /** Preset en vista previa (header `x-store-preview-style`, ya validado) o `null` = diseño original. */
  current: string | null;
  /** Presets de fábrica en el orden del selector. */
  presets: readonly DemoStylePreset[];
  /** El diseño propio de la tienda (primera opción). */
  original?: { name?: string; mood?: string; colors?: DemoStyleColors };
  /** Lado del botón de WhatsApp de la tienda: si está a la izquierda, la pastilla sube para no taparlo. */
  fabSide?: "left" | "right" | null;
  /** Destino de «Crear mi tienda» (por defecto el registro de la plataforma). */
  signupHref?: string;
}

/** Parámetro que lee el proxy. `original` vuelve al diseño de la tienda. */
export const STYLE_PARAM = "estilo";
export const ORIGINAL_STYLE = "original";
const STORAGE_KEY = "ecommy_demo_selector";
/** Globito «Probá otro estilo» de mobile: una sola vez por sesión. */
const HINT_KEY = "ecommy_demo_selector_hint";
const HINT_MS = 5000;
/** Alto (px) del final del pie donde viven los links legales y el crédito: con eso a la vista, la pastilla se va. */
export const FOOTER_LEGAL_BAND = 160;

/**
 * URL de la página actual con otro estilo: conserva la ruta y el resto de la
 * query (filtros, orden, búsqueda), pisa `estilo` y saca la página del listado
 * (la grilla cambia de densidad con el estilo). Sin hash.
 */
export function styleHref(pathname: string, search: string, id: string | null): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("pagina");
  params.delete("page");
  params.set(STYLE_PARAM, id ?? ORIGINAL_STYLE);
  return `${pathname || "/"}?${params.toString()}`;
}

/** En el checkout y la página del pedido no se muestra (igual que el botón de WhatsApp). */
export function isHiddenPath(pathname: string): boolean {
  return /\/(?:checkout|pedido)(?:\/|$)/.test(pathname);
}

/**
 * ¿Ya se ve el final del pie (links legales, «Botón de arrepentimiento», crédito)?
 * `footerBottom` = `getBoundingClientRect().bottom` del pie.
 */
export function isFooterEndVisible(footerBottom: number, viewportHeight: number, band = FOOTER_LEGAL_BAND): boolean {
  return footerBottom < viewportHeight + band;
}

/* ---------- «Achicado» recordado en la sesión (sessionStorage puede tirar) ---------- */

const listeners = new Set<() => void>();
/** Respaldo cuando no hay sessionStorage: vale para esta carga de página nomás. */
let memoryMinimized = false;

function readMinimized(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "min";
  } catch {
    return false;
  }
}

function writeMinimized(value: boolean) {
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, "min");
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    memoryMinimized = value;
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/* ---------- Piezas ---------- */

/** La «e» de la marca como trazo (`_brand/glyph.tsx`). */
function Glyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="16 16 68 68" aria-hidden="true" focusable="false">
      <path d="M24 50H76A26 26 0 1 0 69.9 66.7" fill="none" stroke="currentColor" strokeWidth={13} />
    </svg>
  );
}

function Swatch({ colors }: { colors?: DemoStyleColors }) {
  if (!colors) return <span className={s.swatch} aria-hidden="true" />;
  const [bg, text, primary, accent] = colors;
  return (
    <span className={s.swatch} style={{ background: bg }} aria-hidden="true">
      <i style={{ background: text }} />
      <i style={{ background: primary }} />
      <i style={{ background: accent }} />
    </span>
  );
}

/** Marca el globito como visto y dice si había que mostrarlo (sin storage: no se muestra, mejor no molestar). */
function takeHint(): boolean {
  try {
    if (window.sessionStorage.getItem(HINT_KEY)) return false;
    window.sessionStorage.setItem(HINT_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

function isPlainClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export function DemoStyleSwitcher({ current, presets, original, fabSide = null, signupHref }: DemoStyleSwitcherProps) {
  const pathname = usePathname() ?? "/";
  const minimized = useSyncExternalStore(
    subscribe,
    () => readMinimized() || memoryMinimized,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [atFooter, setAtFooter] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Mobile: arranca en la burbuja; la primera vez de la sesión un globito la presenta y se va
  // solo a los 5 s, al scrollear o al tocar cualquier cosa.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 639.98px)").matches) return;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const dismiss = () => setHint(false);
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) dismiss();
    };
    const showTimer = setTimeout(() => {
      if (!takeHint()) return;
      setHint(true);
      hideTimer = setTimeout(dismiss, HINT_MS);
      window.addEventListener("scroll", dismiss, { passive: true, once: true });
      document.addEventListener("pointerdown", onPointer);
    }, 900);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      window.removeEventListener("scroll", dismiss);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  // Al llegar al final del pie se corre (fade + baja) para no tapar los links legales.
  useEffect(() => {
    let footer: Element | null = null;
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!footer?.isConnected) footer = document.querySelector(".store-root footer");
      if (!footer) return setAtFooter(false);
      setAtFooter(isFooterEndVisible(footer.getBoundingClientRect().bottom, window.innerHeight));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [pathname]);

  // Abierto: foco en el estilo actual; Escape y click afuera cierran.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('[aria-current="true"]')?.focus({ preventScroll: true });
    // El foco quedó en el estilo actual: que también se vea en la lista.
    panel?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    // Un click dentro de un iframe (mapa, video de un bloque) no llega al document: blur de la ventana.
    const onBlur = () => close(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("blur", onBlur);
    };
  }, [open, close]);

  if (isHiddenPath(pathname)) return null;

  const currentPreset = current ? presets.find((p) => p.id === current) ?? null : null;
  const originalName = original?.name ?? "A medida";
  const signup = signupHref ?? platformUrl("/registro");
  // El panel sólo existe en el cliente (se abre con un click): puede leer la query real.
  const search = open && typeof window !== "undefined" ? window.location.search : "";

  const choose = (id: string | null) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    setPending(id ?? ORIGINAL_STYLE);
  };

  const label = currentPreset ? (
    <>
      <span className={s.pillStrong}>Estilo {currentPreset.name}</span>
      <span className={s.pillSoft}>
        <span className={s.sep} aria-hidden="true">
          ·
        </span>
        Cambiar
      </span>
    </>
  ) : (
    <>
      <span className={s.pillStrong}>
        <span className={s.desktopOnly}>Hecha con Ecommy</span>
        <span className={s.mobileOnly}>Probá otro estilo</span>
      </span>
      <span className={`${s.pillSoft} ${s.desktopOnly}`}>
        <span className={s.sep} aria-hidden="true">
          ·
        </span>
        Probá otro estilo
      </span>
    </>
  );

  const rows: { id: string | null; name: string; mood: string; colors?: DemoStyleColors }[] = [
    { id: null, name: originalName, mood: original?.mood ?? "El diseño propio de esta tienda", colors: original?.colors },
    ...presets.map((p) => ({ id: p.id, name: p.name, mood: p.mood, colors: p.colors })),
  ];

  return (
    <div
      ref={rootRef}
      className={s.root}
      data-fab={fabSide === "left" ? "left" : undefined}
      data-away={atFooter && !open ? "1" : undefined}
      inert={atFooter && !open ? true : undefined}
    >
      {open ? (
        <div ref={panelRef} id={panelId} className={s.panel} role="dialog" aria-modal="false" aria-labelledby={titleId}>
          <div className={s.head}>
            <p className={s.eyebrow}>Hecha con Ecommy</p>
            <h2 id={titleId} className={s.title}>
              Esta tienda es a&nbsp;medida
            </h2>
            <p className={s.lead}>Misma tienda, mismos productos: cambiá sólo el estilo.</p>
            <button type="button" className={s.close} onClick={() => close(true)} aria-label="Cerrar">
              <X aria-hidden="true" strokeWidth={1.75} />
            </button>
          </div>

          <div className={s.list}>
            {rows.map((row, i) => {
              const key = row.id ?? ORIGINAL_STYLE;
              const isCurrent = (row.id ?? null) === (currentPreset?.id ?? null);
              return (
                <div key={key}>
                  {i === 1 ? <p className={s.group}>Estilos de fábrica · {presets.length}</p> : null}
                  <a
                    href={styleHref(pathname, search, row.id)}
                    className={s.option}
                    aria-current={isCurrent ? "true" : undefined}
                    aria-busy={pending === key ? "true" : undefined}
                    onClick={choose(row.id)}
                  >
                    <Swatch colors={row.colors} />
                    <span className={s.optionText}>
                      <span className={s.optionName}>
                        {row.name}
                        {row.id === null ? <span className={s.tag}>Original</span> : null}
                      </span>
                      <span className={s.optionMood}>{pending === key ? "Cargando…" : row.mood}</span>
                    </span>
                    {isCurrent ? <Check className={s.check} aria-hidden="true" strokeWidth={2.25} /> : null}
                  </a>
                </div>
              );
            })}
          </div>

          <div className={s.foot}>
            <p className={s.footText}>
              <span className={s.footStrong}>¿Querés una así?</span> 14 días de Pro, sin tarjeta.
            </p>
            <a href={signup} className={s.cta} target="_blank" rel="noopener">
              Crear mi tienda
              <span className={s.ctaArrow} aria-hidden="true">
                <ArrowUpRight strokeWidth={2} />
              </span>
            </a>
          </div>
        </div>
      ) : null}

      <div className={s.bar}>
        <button
          ref={triggerRef}
          type="button"
          className={minimized ? s.mini : s.pill}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label={currentPreset ? `Estilo ${currentPreset.name}: cambiar el estilo de la tienda` : "Hecha con Ecommy: probá otro estilo"}
          onClick={() => {
            setHint(false);
            setOpen((v) => !v);
          }}
        >
          <span className={s.bubble} aria-hidden="true">
            <Glyph className={s.glyph} />
          </span>
          {minimized ? null : <span className={s.pillLabel}>{label}</span>}
        </button>
        {hint && !open ? (
          // Decorativo (el botón ya dice lo mismo): tocarlo abre el panel igual.
          <span
            className={s.hint}
            aria-hidden="true"
            onClick={() => {
              setHint(false);
              setOpen(true);
            }}
          >
            {currentPreset ? `Estilo ${currentPreset.name} · Cambiar` : "Probá otro estilo"}
          </span>
        ) : null}
        {!minimized && !open ? (
          <button type="button" className={s.minimize} onClick={() => writeMinimized(true)} aria-label="Achicar el selector de estilos">
            <Minus aria-hidden="true" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
