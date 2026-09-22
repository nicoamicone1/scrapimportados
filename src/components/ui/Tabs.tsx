"use client";

import Link from "next/link";
import { useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/*
 * Tabs con subrayado de 2px (no pills), DESIGN.md §7.4.
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
    "relative -mb-px inline-flex h-9 items-center gap-1.5 border-b-2 px-0.5 text-sm whitespace-nowrap transition-colors",
    active
      ? "border-adm-accent font-medium text-adm-fg"
      : "border-transparent text-adm-fg-muted hover:border-adm-border hover:text-adm-fg",
  );

function Count({ n }: { n?: number }) {
  if (n === undefined) return null;
  return <span className="tnum rounded-[4px] bg-adm-surface-2 px-1 text-xs text-adm-fg-muted">{n}</span>;
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

  return (
    <div className={className}>
      <div ref={listRef} role="tablist" onKeyDown={onKeyDown} className="flex gap-5 overflow-x-auto border-b border-adm-border">
        {items.map((item) => {
          const isActive = item.value === current;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              data-value={item.value}
              id={`${baseId}-tab-${item.value}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${item.value}`}
              tabIndex={isActive ? 0 : -1}
              disabled={item.disabled}
              onClick={() => select(item.value)}
              className={cn(tabClass(isActive), "disabled:opacity-50")}
            >
              {item.label}
              <Count n={item.count} />
            </button>
          );
        })}
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
  return (
    <nav aria-label={label} className={cn("flex gap-5 overflow-x-auto border-b border-adm-border", className)}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} className={tabClass(item.active)} scroll={false}>
          {item.label}
          <Count n={item.count} />
        </Link>
      ))}
    </nav>
  );
}
