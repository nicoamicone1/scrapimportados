"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { Drawer } from "@/components/ui/Dialog";
import { NavigationProgress } from "@/components/ui/NavigationProgress";
import { UrlPendingScope } from "@/components/ui/useUrlTransition";
import { cn } from "@/lib/cn";

import { CommandPalette } from "./CommandPalette";
import { SIDEBAR_COOKIE } from "./nav";
import { Sidebar } from "./Sidebar";
import { Topbar, type TopbarUser } from "./Topbar";

export interface AdminShellProps {
  storeName: string;
  user: TopbarUser;
  isOwner: boolean;
  /** Estado inicial leído de la cookie (evita salto al hidratar). */
  initialCollapsed: boolean;
  /** Slot: chip del plan debajo del nombre de la tienda en el sidebar (M). */
  planChip?: ReactNode;
  /** Slot: selector de tienda en el topbar (M: `<StoreSwitcher>`). */
  storeSwitcher?: ReactNode;
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
 * Shell del admin: sidebar oscuro colapsable (desktop), drawer (mobile),
 * topbar, command palette con Ctrl/⌘ K, barra de progreso de navegación y
 * `UrlPendingScope` (los filtros de la página y sus tablas comparten el
 * estado "cargando").
 */
export function AdminShell({ storeName, user, isOwner, initialCollapsed, planChip, storeSwitcher, storeHref, children }: AdminShellProps) {
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
    <div className="flex min-h-dvh">
      <NavigationProgress />
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 bg-adm-sidebar-bg transition-[width] duration-150 md:block",
          collapsed ? "w-14" : "w-[232px]",
        )}
      >
        <Sidebar
          storeName={storeName}
          isOwner={isOwner}
          planChip={planChip}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      <Drawer
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        side="left"
        width="w-[264px]"
        hideClose
        label="Menú"
        className="bg-adm-sidebar-bg md:hidden"
      >
        <Sidebar storeName={storeName} isOwner={isOwner} planChip={planChip} onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          onOpenMenu={() => setMobileOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          shortcutLabel={isMac ? "⌘" : "Ctrl"}
          storeSwitcher={storeSwitcher}
          storeHref={storeHref}
        />
        <main id="contenido" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 md:px-6 md:py-6">
          <UrlPendingScope>{children}</UrlPendingScope>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
