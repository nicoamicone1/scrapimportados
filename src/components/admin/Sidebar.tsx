"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { BrandLockup, BrandMark } from "@/components/platform/brand";
import { cn } from "@/lib/cn";
import type { ModuleCode } from "@/lib/modules/registry";

import { buildNav, isNavActive } from "./nav";
import { OrdersBadge } from "./OrdersBadge";
import { VersionBadge } from "./VersionBadge";

/** Slot de badge por href (B: pedidos nuevos sin ver). */
const NAV_BADGES: Partial<Record<string, (props: { collapsed: boolean }) => ReactNode>> = {
  "/admin/pedidos": OrdersBadge,
};

export interface SidebarProps {
  storeName: string;
  isOwner: boolean;
  /** Apps vigentes de la tienda (`ctx.modules`): suman el grupo "Apps". */
  modules?: readonly ModuleCode[];
  /** Chip del plan debajo del nombre de la tienda (lo llena M: "Pro · trial 9 días"). */
  planChip?: ReactNode;
  /**
   * Selector de tienda para la tarjeta de arriba (`<StoreSwitcher variant="sidebar">`).
   * Si falta, la tarjeta muestra el nombre de la tienda sin menú.
   */
  storeSwitcher?: ReactNode;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Se llama al navegar (cierra el drawer en mobile). */
  onNavigate?: () => void;
  className?: string;
}

const NO_MODULES: readonly ModuleCode[] = [];

/** Inicial de la tienda en una tesela clara (la tienda, no Ecommy: sin pomelo). */
export function StoreAvatar({ name, className }: { name: string; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className={cn("eco-display inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-eco-mist text-[15px] text-eco-ink", className)}
    >
      {initial}
    </span>
  );
}

/**
 * Pastilla que se desliza al ítem activo (BRAND §9: el fondo viaja entre
 * ítems con `--eco-ease-out`). Mide `[data-active]` dentro del contenedor;
 * la primera vez se ubica sin animar.
 */
function useActivePill(containerRef: React.RefObject<HTMLElement | null>, activeKey: string | null, collapsed: boolean) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const box = containerRef.current;
    if (!box) return;
    const measure = () => {
      const el = box.querySelector<HTMLElement>("a[data-active]");
      if (!el) {
        setStyle(null);
        placed.current = false;
        return;
      }
      setStyle({
        height: el.offsetHeight,
        width: el.offsetWidth,
        transform: `translate(${el.offsetLeft}px, ${el.offsetTop}px)`,
        transitionProperty: placed.current ? "transform, height, width" : "none",
      });
      placed.current = true;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [containerRef, activeKey, collapsed]);

  return style;
}

/**
 * Navegación lateral del admin (BRAND §7, §9): tinta noche, lockup con la
 * burbuja pomelo, tarjeta de la tienda activa con su plan (y el selector de
 * tienda), grupos y el ítem activo como pastilla que se desliza, con el
 * ícono en pomelo. Al pie, versión y "contraer".
 */
export function Sidebar({
  storeName,
  isOwner,
  modules = NO_MODULES,
  planChip,
  storeSwitcher,
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
  className,
}: SidebarProps) {
  const pathname = usePathname() ?? "";
  const nav = useMemo(() => buildNav(modules), [modules]);

  // Al tocar un ítem, la pastilla se mueve enseguida (antes de que termine la navegación).
  const [optimistic, setOptimistic] = useState<{ href: string; from: string } | null>(null);
  const pendingHref = optimistic && optimistic.from === pathname ? optimistic.href : null;

  const realActive = useMemo(() => {
    for (const g of nav) for (const i of g.items) if (isNavActive(i, pathname)) return i.href;
    return null;
  }, [nav, pathname]);
  const shownActive = pendingHref ?? realActive;

  const listRef = useRef<HTMLDivElement>(null);
  const pill = useActivePill(listRef, shownActive, collapsed);

  return (
    <div
      data-collapsed={collapsed ? "" : undefined}
      className={cn("adm-dark group/sidebar flex h-full flex-col bg-adm-sidebar-bg text-adm-sidebar-fg", className)}
    >
      <div className={cn("shrink-0", collapsed ? "flex flex-col items-center gap-3 px-2 pt-4 pb-3" : "px-4 pt-5 pb-3")}>
        <Link
          href="/admin"
          onClick={onNavigate}
          className={cn("inline-flex rounded-adm", !collapsed && "px-1")}
          title={collapsed ? `Ecommy · ${storeName}` : undefined}
        >
          {collapsed ? (
            <>
              <BrandMark size={28} />
              <span className="sr-only">Ecommy, inicio</span>
            </>
          ) : (
            <>
              <BrandLockup tone="dark" size={26} />
              <span className="sr-only">, inicio</span>
            </>
          )}
        </Link>

        {/* Tarjeta de la tienda activa: nombre (selector de tienda) + plan. */}
        <div
          className={cn(
            "mt-4 rounded-adm-lg bg-white/[0.04] ring-1 ring-white/[0.07] ring-inset",
            collapsed ? "mt-0 bg-transparent ring-0" : "p-1.5",
          )}
        >
          {storeSwitcher ?? (
            <div className="flex items-center gap-2.5 p-1.5">
              <StoreAvatar name={storeName} />
              {!collapsed ? (
                <span className="truncate text-sm font-semibold text-white" title={storeName}>
                  {storeName}
                </span>
              ) : null}
            </div>
          )}
          {planChip && !collapsed ? <div className="flex pt-0.5 pb-1 pl-12">{planChip}</div> : null}
        </div>
      </div>

      <nav
        aria-label="Principal"
        className="adm-scroll min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-4 [scrollbar-color:var(--adm-sidebar-border)_transparent]"
      >
        <div ref={listRef} className="relative">
          {/* Pastilla del ítem activo (una sola: viaja entre ítems). */}
          {pill ? (
            <span
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 rounded-full bg-adm-sidebar-active shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)] duration-[320ms] ease-eco-out"
              style={pill}
            />
          ) : null}

          {nav.map((group, gi) => {
            const items = group.items.filter((i) => !i.ownerOnly || isOwner);
            if (!items.length) return null;
            return (
              <div key={group.label} className={cn(gi > 0 && (collapsed ? "mt-3" : "mt-5"))}>
                {collapsed ? (
                  gi > 0 ? <div aria-hidden className="mx-3 mb-3 h-px bg-adm-sidebar-border" /> : null
                ) : (
                  <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.1em] text-adm-sidebar-muted uppercase">{group.label}</div>
                )}
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = isNavActive(item, pathname);
                    const shown = item.href === shownActive;
                    const Icon = item.icon;
                    const Badge = NAV_BADGES[item.href];
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={(e) => {
                            if (!item.external && !e.metaKey && !e.ctrlKey && !e.shiftKey && item.href !== shownActive) {
                              setOptimistic({ href: item.href, from: pathname });
                            }
                            onNavigate?.();
                          }}
                          target={item.external ? "_blank" : undefined}
                          rel={item.external ? "noopener" : undefined}
                          aria-current={active ? "page" : undefined}
                          data-active={shown ? "" : undefined}
                          title={collapsed ? item.label : undefined}
                          className={cn(
                            "relative flex h-8 items-center gap-3 rounded-full text-sm transition-[color,background-color] duration-[240ms] ease-eco-out pointer-coarse:h-11",
                            collapsed ? "justify-center px-0" : "px-3",
                            shown
                              ? "font-medium text-white"
                              : // Sin pastilla propia: el hover es un velo apenas visible.
                                "text-adm-sidebar-fg/85 hover:bg-white/[0.05] hover:text-white",
                          )}
                        >
                          <Icon
                            aria-hidden
                            strokeWidth={shown ? 2 : 1.75}
                            className={cn(
                              "relative size-4 shrink-0 transition-colors duration-[240ms]",
                              shown ? "text-eco-pomelo" : "text-adm-sidebar-muted",
                            )}
                          />
                          {collapsed ? <span className="sr-only">{item.label}</span> : <span className="relative truncate">{item.label}</span>}
                          {item.external ? <span className="sr-only"> (se abre en otra pestaña)</span> : null}
                          {Badge ? <Badge collapsed={collapsed} /> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>

      <div
        className={cn(
          "flex h-12 shrink-0 items-center border-t border-adm-sidebar-border/70",
          collapsed ? "justify-center px-2" : "justify-between pr-2.5 pl-5",
        )}
      >
        {!collapsed ? (
          // H: versión + punto de novedades sin leer
          <VersionBadge onNavigate={onNavigate} className="text-adm-sidebar-muted hover:text-adm-sidebar-fg" />
        ) : null}
        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            title={collapsed ? "Expandir menú" : "Contraer menú"}
            className="inline-flex size-8 items-center justify-center rounded-full text-adm-sidebar-muted transition-colors duration-[140ms] hover:bg-white/[0.06] hover:text-adm-sidebar-fg"
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Chip de plan para el slot `planChip` (M decide el texto: "Pro", "Trial · 9 días").
 * Pastilla sobre tinta: `trial` en pomelo, `plan` en blanco tenue, `warning` en carmín claro.
 */
export function SidebarPlanChip({ children, tone = "plan", href }: { children: ReactNode; tone?: "plan" | "trial" | "warning"; href?: string }) {
  const cls = cn(
    "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-semibold tracking-[0.02em] transition-colors duration-[140ms]",
    tone === "trial" && "bg-eco-pomelo/15 text-eco-pomelo",
    tone === "plan" && "bg-white/[0.08] text-adm-sidebar-fg",
    tone === "warning" && "bg-adm-danger-on-dark/15 text-adm-danger-on-dark",
    href && "hover:bg-white/[0.14]",
  );
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}
