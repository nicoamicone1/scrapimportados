"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

import { isNavActive, MOBILE_TABS, NAV_ITEMS } from "./nav";
import { useNewOrdersCount } from "./OrdersBadge";

const TABS = MOBILE_TABS.flatMap((t) => {
  const item = NAV_ITEMS.find((i) => i.href === t.href);
  return item ? [{ ...t, item }] : [];
});

const tabClass =
  "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] leading-none font-medium transition-colors duration-[120ms]";

/**
 * Barra inferior del panel en mobile (< md): Inicio, Pedidos, Productos,
 * Compartir y "Menú" (abre el drawer con todo). El comerciante gestiona desde
 * el celular: lo diario queda a un toque y al alcance del pulgar (BRAND §11).
 *
 * Se oculta sola (admin.css) cuando la página muestra una barra fija inferior
 * propia (`[data-adm-bottom-bar]`, ej. `SaveBar`) o cuando hay un campo con
 * foco (el teclado ya ocupa la mitad de la pantalla).
 */
export function MobileTabBar({ onOpenMenu, menuOpen }: { onOpenMenu: () => void; menuOpen: boolean }) {
  const pathname = usePathname() ?? "";
  const newOrders = useNewOrdersCount();
  const anyActive = TABS.some((t) => isNavActive(t.item, pathname));

  return (
    <nav aria-label="Accesos rápidos" className="adm-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-adm-border bg-adm-surface md:hidden">
      <ul className="flex h-14 items-stretch pb-[env(safe-area-inset-bottom)] [box-sizing:content-box]">
        {TABS.map(({ href, label, item }) => {
          const active = isNavActive(item, pathname);
          const Icon = item.icon;
          const badge = href === "/admin/pedidos" && newOrders > 0 ? newOrders : 0;
          return (
            <li key={href} className="flex min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(tabClass, active ? "text-adm-accent" : "text-adm-fg-muted active:text-adm-fg")}
              >
                {active ? <span aria-hidden className="absolute inset-x-4 top-0 h-[3px] rounded-b-[2px] bg-adm-accent-2" /> : null}
                <span className="relative">
                  <Icon aria-hidden className="size-5" strokeWidth={active ? 1.75 : 1.5} />
                  {badge ? (
                    <span className="tnum absolute -top-1.5 left-3 inline-flex h-4 min-w-4 items-center justify-center rounded-[4px] bg-adm-accent-2 px-1 text-[10px] font-semibold text-adm-accent-2-fg">
                      {badge > 99 ? "99+" : badge}
                      <span className="sr-only"> {badge === 1 ? "pedido nuevo" : "pedidos nuevos"}</span>
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate px-1">{label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            className={cn(tabClass, !anyActive ? "text-adm-accent" : "text-adm-fg-muted active:text-adm-fg")}
          >
            {!anyActive ? <span aria-hidden className="absolute inset-x-4 top-0 h-[3px] rounded-b-[2px] bg-adm-accent-2" /> : null}
            <Menu aria-hidden className="size-5" strokeWidth={1.5} />
            <span>Menú</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
