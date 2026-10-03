"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { Drawer } from "@/components/ui/Dialog";
import { NavigationProgress } from "@/components/ui/NavigationProgress";
import { UrlPendingScope } from "@/components/ui/useUrlTransition";
import { cn } from "@/lib/cn";
import type { ModuleCode } from "@/lib/modules/registry";

import { CommandPalette } from "./CommandPalette";
import { MobileTabBar } from "./MobileTabBar";
import { SIDEBAR_COOKIE } from "./nav";
import { Sidebar } from "./Sidebar";
import { Topbar, type TopbarUser } from "./Topbar";

export interface AdminShellProps {
  storeName: string;
  user: TopbarUser;
  isOwner: boolean;
  /** Apps vigentes de la tienda (`ctx.modules`): grupo "Apps" del sidebar y del command palette. */
  modules?: readonly ModuleCode[];
  /** Estado inicial leído de la cookie (evita salto al hidratar). */
  initialCollapsed: boolean;
  /** Slot: chip del plan debajo del nombre de la tienda en el sidebar (M). */
  planChip?: ReactNode;
  /** Slot: selector de tienda de la barra superior mobile (M: `<StoreSwitcher>`). */
  storeSwitcher?: ReactNode;
  /** Slot: selector de tienda de la tarjeta del sidebar (`<StoreSwitcher variant="sidebar">`). */
  sidebarStoreSwitcher?: ReactNode;
  /** Link de "Ver tienda" (M: `storeHref(store)`, relativo en modo fallback). */
  storeHref?: string;
  children: ReactNode;
}

const noop = () => () => {};

/** ¿Mac? (para mostrar ⌘ o Ctrl). En el server asume Ctrl. */
function useIsMac() {
  return useSyncExternalStore(
    noop,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
}

/**
 * Shell del admin (BRAND §7.2, "la hoja"): el fondo del shell es tinta; el
 * sidebar colapsable vive sobre ella y el contenido apoya encima como una
 * hoja niebla con la esquina superior izquierda curva (la dibuja el topbar,
 * que es fijo, así la curva no se pierde al scrollear). En mobile: tapa de
 * tinta arriba, hoja con las dos esquinas curvas y la barra inferior
 * flotante (`MobileTabBar`) con lo diario; el menú completo en un drawer.
 * Además: command palette con Ctrl/⌘ K, barra de progreso de navegación y
 * `UrlPendingScope` (los filtros de la página y sus tablas comparten el
 * estado "cargando").
 */
export function AdminShell({
  storeName,
  user,
  isOwner,
  modules,
  initialCollapsed,
  planChip,
  storeSwitcher,
  sidebarStoreSwitcher,
  storeHref,
  children,
}: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isMac = useIsMac();

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/admin; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-dvh bg-adm-bg md:bg-adm-sidebar-bg">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-full bg-adm-surface px-4 py-2 text-sm font-medium text-adm-fg shadow-[var(--adm-shadow)] focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>
      <NavigationProgress />
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 bg-adm-sidebar-bg transition-[width] duration-[240ms] ease-eco-out md:block",
          collapsed ? "w-16" : "w-[244px]",
        )}
      >
        <Sidebar
          storeName={storeName}
          isOwner={isOwner}
          modules={modules}
          planChip={planChip}
          storeSwitcher={sidebarStoreSwitcher}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      <Drawer
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        side="left"
        width="w-[min(296px,85vw)]"
        hideClose
        label="Menú"
        className="bg-adm-sidebar-bg shadow-[0_0_48px_rgb(0_0_0/0.35)] md:hidden"
      >
        <Sidebar
          storeName={storeName}
          isOwner={isOwner}
          modules={modules}
          planChip={planChip}
          storeSwitcher={sidebarStoreSwitcher}
          onNavigate={() => setMobileOpen(false)}
        />
      </Drawer>

      {/* La hoja: niebla sobre la tinta del shell. */}
      <div className="flex min-w-0 flex-1 flex-col bg-adm-bg md:rounded-tl-[var(--adm-sheet-radius)]">
        <Topbar
          user={user}
          onOpenPalette={() => setPaletteOpen(true)}
          shortcutLabel={isMac ? "⌘" : "Ctrl"}
          storeSwitcher={storeSwitcher}
          storeHref={storeHref}
        />
        <main
          id="contenido"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 pb-[calc(var(--adm-bottom-nav-h)+24px)] outline-none md:px-8 md:pt-8 md:pb-10 focus-visible:shadow-none"
        >
          <UrlPendingScope>{children}</UrlPendingScope>
        </main>
      </div>

      <MobileTabBar onOpenMenu={() => setMobileOpen(true)} menuOpen={mobileOpen} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} modules={modules} />
    </div>
  );
}
