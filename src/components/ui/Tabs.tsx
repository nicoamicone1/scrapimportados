"use client";

import Link from "next/link";
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import { cn } from "@/lib/cn";

/*
 * Tabs con subrayado tinta que SE DESLIZA entre pestañas (DESIGN.md §7.4,
 * BRAND §9: 240 ms con `--eco-ease-out`). Antes de hidratar, cada pestaña
 * activa pinta su propio subrayado (sin salto); al medir, lo reemplaza el
 * indicador único que se mueve.
 * - `Tabs`: pestañas con estado local y paneles (patrón WAI-ARIA tabs).
 * - `TabsNav`: pestañas como links (filtros por URL, ej. ?estado=pendiente).
 */

export interface TabItem {
  value: string;
  label: ReactNode;
  count?: number;
  content?: ReactNode;
  disabled?: boolean;
}

const tabClass = (active: boolean) =>
  cn(
    "relative inline-flex h-9 items-center gap-1.5 px-0.5 text-sm whitespace-nowrap transition-colors duration-[140ms] ease-eco-out pointer-coarse:h-11",
    // Subrayado propio sólo hasta que el indicador deslizante está listo.
    "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full group-data-[slide]/tabs:after:hidden",
    active ? "font-medium text-adm-fg after:bg-adm-accent" : "text-adm-fg-muted hover:text-adm-fg after:bg-transparent hover:after:bg-adm-border",
  );

const listClass = "group/tabs relative flex gap-5 overflow-x-auto border-b border-adm-border [scrollbar-width:none]";

function Count({ n, active }: { n?: number; active?: boolean }) {
  if (n === undefined) return null;
  return (
    <span
      className={cn(
        "tnum inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium transition-colors duration-[140ms]",
        active ? "bg-adm-accent text-adm-accent-fg" : "bg-adm-surface-2 text-adm-fg-muted",
      )}
    >
      {n}
    </span>
  );
}

/** Mide la pestaña activa (`[data-active]`) y devuelve el estilo del indicador. */
function useSlidingIndicator(listRef: RefObject<HTMLElement | null>, activeKey: string | undefined) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const measured = useRef(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const el = list.querySelector<HTMLElement>("[data-active]");
      if (!el) {
        setStyle(null);
        return;
      }
      setStyle({
        width: el.offsetWidth,
        transform: `translateX(${el.offsetLeft}px)`,
        // La primera vez se ubica sin animar; después, se desliza.
        transitionProperty: measured.current ? "transform, width" : "none",
      });
      measured.current = true;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [listRef, activeKey]);

  return style;
}

function Indicator({ style }: { style: CSSProperties | null }) {
  if (!style) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-adm-accent duration-[240ms] ease-eco-out"
      style={style}
    />
  );
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  /** Clases del panel. */
  panelClassName?: string;
}

export function Tabs({ items, value, defaultValue, onValueChange, className, panelClassName }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.value);
  const current = value ?? internal;
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const select = (v: string) => {
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const enabled = items.filter((i) => !i.disabled);
    const idx = enabled.findIndex((i) => i.value === current);
    let next: TabItem | undefined;
    if (e.key === "ArrowRight") next = enabled[(idx + 1) % enabled.length];
    else if (e.key === "ArrowLeft") next = enabled[(idx - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];
    if (!next) return;
    e.preventDefault();
    select(next.value);
    listRef.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus();
  };

  const active = items.find((i) => i.value === current);
  const indicator = useSlidingIndicator(listRef, current);

  return (
    <div className={className}>
      <div ref={listRef} role="tablist" onKeyDown={onKeyDown} data-slide={indicator ? "" : undefined} className={listClass}>
        {items.map((item) => {
          const isActive = item.value === current;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              data-value={item.value}
              data-active={isActive ? "" : undefined}
              id={`${baseId}-tab-${item.value}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${item.value}`}
              tabIndex={isActive ? 0 : -1}
              disabled={item.disabled}
              onClick={() => select(item.value)}
              className={cn(tabClass(isActive), "disabled:opacity-50")}
            >
              {item.label}
              <Count n={item.count} active={isActive} />
            </button>
          );
        })}
        <Indicator style={indicator} />
      </div>
      {active?.content !== undefined ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.value}`}
          aria-labelledby={`${baseId}-tab-${active.value}`}
          tabIndex={0}
          className={cn("pt-4 focus-visible:outline-none", panelClassName)}
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}

export interface TabsNavItem {
  href: string;
  label: ReactNode;
  active: boolean;
  count?: number;
}

/** Pestañas-link para filtros por URL. */
export function TabsNav({ items, className, label = "Filtros" }: { items: TabsNavItem[]; className?: string; label?: string }) {
  const listRef = useRef<HTMLElement>(null);
  const indicator = useSlidingIndicator(listRef, items.find((i) => i.active)?.href);
  return (
    <nav ref={listRef} aria-label={label} data-slide={indicator ? "" : undefined} className={cn(listClass, className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          data-active={item.active ? "" : undefined}
          className={tabClass(item.active)}
          scroll={false}
        >
          {item.label}
          <Count n={item.count} active={item.active} />
        </Link>
      ))}
      <Indicator style={indicator} />
    </nav>
  );
}
