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

/* Cada destino ocupa el ancho disponible y al menos 52 × 52 px (target ≥ 44). */
const tabClass =
  "relative flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full text-[11px] leading-none font-medium transition-[color,background-color] duration-[240ms] ease-eco-out";

/** Fondo del destino activo: pastilla tinta-3 con el ícono en pomelo. */
const activeClass = "bg-adm-sidebar-active text-white";
const idleClass = "text-adm-sidebar-muted active:bg-white/[0.06] active:text-white";

/**
 * Barra inferior del panel en mobile (< md): pastilla tinta flotante con
 * Inicio, Pedidos, Productos, Compartir y "Menú" (abre el drawer con todo).
 * El destino activo es una pastilla con el ícono pomelo. El comerciante
 * gestiona desde el celular: lo diario queda a un toque y al alcance del
 * pulgar (BRAND §11). Respeta la safe area.
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
    <nav
      aria-label="Accesos rápidos"
      className="adm-bottom-nav adm-dark pointer-events-none fixed inset-x-0 bottom-0 z-30 px-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] md:hidden"
    >
      <ul className="pointer-events-auto mx-auto flex h-16 max-w-md items-center gap-0.5 rounded-full bg-adm-sidebar-bg p-1.5 shadow-[0_16px_40px_-12px_rgb(16_22_47/0.55),0_0_0_1px_rgb(255_255_255/0.06)_inset]">
        {TABS.map(({ href, label, item }) => {
          const active = isNavActive(item, pathname);
          const Icon = item.icon;
          const badge = href === "/admin/pedidos" && newOrders > 0 ? newOrders : 0;
          return (
            <li key={href} className="flex min-w-0 flex-1">
              <Link href={href} aria-current={active ? "page" : undefined} className={cn(tabClass, active ? activeClass : idleClass)}>
                <span className="relative">
                  <Icon aria-hidden className={cn("size-5", active && "text-eco-pomelo")} strokeWidth={active ? 2 : 1.75} />
                  {badge ? (
                    <span
                      key={badge}
                      className="adm-bounce-in tnum absolute -top-2 left-3 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-eco-pomelo px-1 text-[10px] font-bold text-eco-ink ring-2 ring-adm-sidebar-bg"
                    >
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
            className={cn(tabClass, !anyActive ? activeClass : idleClass)}
          >
            <Menu aria-hidden className={cn("size-5", !anyActive && "text-eco-pomelo")} strokeWidth={1.75} />
            <span>Menú</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
