"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { isNavActive, NAV } from "./nav";
import { OrdersBadge } from "./OrdersBadge";
import { VersionBadge } from "./VersionBadge";

/** Slot de badge por href (B: pedidos nuevos sin ver). */
const NAV_BADGES: Partial<Record<string, (props: { collapsed: boolean }) => ReactNode>> = {
  "/admin/pedidos": OrdersBadge,
};

export interface SidebarProps {
  storeName: string;
  isOwner: boolean;
  /** Chip del plan debajo del nombre de la tienda (lo llena M: "Pro · trial 9 días"). */
  planChip?: ReactNode;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Se llama al navegar (cierra el drawer en mobile). */
  onNavigate?: () => void;
  className?: string;
}

/** Marca "Ecommy": cuadrado ámbar con la "e" y el nombre en blanco. Sin gradientes ni brillo. */
function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-[5px] bg-adm-accent-2 text-[13px] leading-none font-bold text-adm-accent-2-fg"
      >
        e
      </span>
      {collapsed ? <span className="sr-only">Ecommy</span> : <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">Ecommy</span>}
    </span>
  );
}

/**
 * Navegación lateral del admin (spec §14.6): fondo verde-tinta, marca +
 * tienda + chip del plan arriba, ítem activo en pino con barra ámbar a la
 * izquierda, versión al pie.
 */
export function Sidebar({ storeName, isOwner, planChip, collapsed = false, onToggleCollapsed, onNavigate, className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className={cn("adm-dark flex h-full flex-col bg-adm-sidebar-bg text-adm-sidebar-fg", className)}>
      <div className={cn("shrink-0 border-b border-adm-sidebar-border", collapsed ? "flex h-14 items-center justify-center px-2" : "px-4 pt-4 pb-3.5")}>
        <Link href="/admin" onClick={onNavigate} className="inline-flex rounded-[5px]" title={collapsed ? `Ecommy · ${storeName}` : undefined}>
          <Brand collapsed={collapsed} />
        </Link>
        {!collapsed ? (
          <div className="mt-2.5 min-w-0">
            <div className="truncate text-[13px] font-medium text-adm-sidebar-fg" title={storeName}>
              {storeName}
            </div>
            {planChip ? <div className="mt-1.5 flex">{planChip}</div> : null}
          </div>
        ) : null}
      </div>

      <nav aria-label="Principal" className="adm-scroll min-h-0 flex-1 overflow-y-auto px-2 py-3 [scrollbar-color:#3a4642_transparent]">
        {NAV.map((group, gi) => {
          const items = group.items.filter((i) => !i.ownerOnly || isOwner);
          if (!items.length) return null;
          return (
            <div key={group.label} className={cn(gi > 0 && "mt-4")}>
              {collapsed ? (
                gi > 0 ? <div aria-hidden className="mx-2 mb-2 h-px bg-adm-sidebar-border" /> : null
              ) : (
                <div className="px-2.5 pb-1 text-[11px] font-medium tracking-[0.07em] text-adm-sidebar-muted uppercase">{group.label}</div>
              )}
              <ul className="space-y-px">
                {items.map((item) => {
                  const active = isNavActive(item, pathname);
                  const Icon = item.icon;
                  const Badge = NAV_BADGES[item.href];
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "relative flex h-8 items-center gap-2.5 rounded-adm text-sm transition-colors duration-100",
                          collapsed ? "justify-center px-0" : "px-2.5",
                          active
                            ? "bg-adm-sidebar-active font-medium text-white"
                            : "text-adm-sidebar-fg/90 hover:bg-adm-sidebar-hover hover:text-white",
                        )}
                      >
                        {active ? (
                          <span aria-hidden className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-[2px] bg-adm-accent-2" />
                        ) : null}
                        <Icon
                          aria-hidden
                          className={cn("size-4 shrink-0", active ? "text-adm-accent-2" : "text-adm-sidebar-muted")}
                        />
                        {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                        {Badge ? <Badge collapsed={collapsed} /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div
        className={cn(
          "flex h-11 shrink-0 items-center border-t border-adm-sidebar-border",
          collapsed ? "justify-center px-2" : "justify-between px-4",
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
            className="inline-flex size-7 items-center justify-center rounded-adm text-adm-sidebar-muted hover:bg-adm-sidebar-hover hover:text-adm-sidebar-fg"
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
 * `tone="trial"` lo pinta ámbar; `"plan"`, pino claro sobre el sidebar.
 */
export function SidebarPlanChip({ children, tone = "plan", href }: { children: ReactNode; tone?: "plan" | "trial" | "warning"; href?: string }) {
  const cls = cn(
    "inline-flex h-5 items-center gap-1 rounded-[4px] px-1.5 text-[11px] font-medium",
    tone === "trial" && "bg-adm-accent-2/15 text-adm-accent-2",
    tone === "plan" && "bg-white/8 text-adm-sidebar-fg",
    tone === "warning" && "bg-[#f3b1a8]/15 text-[#f3b1a8]",
    href && "hover:bg-white/12",
  );
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}
