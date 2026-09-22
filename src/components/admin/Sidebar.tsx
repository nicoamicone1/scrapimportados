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
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Se llama al navegar (cierra el drawer en mobile). */
  onNavigate?: () => void;
  className?: string;
}

/** Navegación lateral del admin (DESIGN.md §7.3). */
export function Sidebar({ storeName, isOwner, collapsed = false, onToggleCollapsed, onNavigate, className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className={cn("flex h-full flex-col bg-adm-surface-2", className)}>
      <div className={cn("flex h-12 shrink-0 items-center gap-2.5 border-b border-adm-border", collapsed ? "justify-center px-2" : "px-4")}>
        <span
          aria-hidden
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-[4px] border border-adm-border bg-adm-surface text-xs font-semibold text-adm-fg"
        >
          {storeName.trim().charAt(0).toUpperCase() || "E"}
        </span>
        {!collapsed ? (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold text-adm-fg">{storeName}</div>
            <div className="text-[11px] text-adm-fg-muted">Panel de la tienda</div>
          </div>
        ) : null}
      </div>

      <nav aria-label="Principal" className="adm-scroll min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((group, gi) => {
          const items = group.items.filter((i) => !i.ownerOnly || isOwner);
          if (!items.length) return null;
          return (
            <div key={group.label} className={cn(gi > 0 && "mt-4")}>
              {collapsed ? (
                gi > 0 ? <div aria-hidden className="mx-2 mb-2 h-px bg-adm-border" /> : null
              ) : (
                <div className="px-2 pb-1 text-[11px] font-medium tracking-[0.06em] text-adm-fg-muted uppercase">
                  {group.label}
                </div>
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
                          "relative flex h-8 items-center gap-2.5 rounded-adm border text-sm transition-colors",
                          collapsed ? "justify-center px-0" : "px-2",
                          active
                            ? "border-adm-border bg-adm-surface font-medium text-adm-fg"
                            : "border-transparent text-adm-fg hover:bg-[color-mix(in_oklab,var(--adm-surface)_55%,var(--adm-surface-2))]",
                        )}
                      >
                        <Icon aria-hidden className={cn("size-4 shrink-0", active ? "text-adm-accent" : "text-adm-fg-muted")} />
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

      <div className={cn("flex h-11 shrink-0 items-center border-t border-adm-border", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        {!collapsed ? (
          // H: versión + punto de novedades sin leer
          <VersionBadge onNavigate={onNavigate} />
        ) : null}
        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            title={collapsed ? "Expandir menú" : "Contraer menú"}
            className="inline-flex size-7 items-center justify-center rounded-adm text-adm-fg-muted hover:bg-adm-surface hover:text-adm-fg"
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
