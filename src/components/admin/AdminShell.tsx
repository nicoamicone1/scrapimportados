"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { Drawer } from "@/components/ui/Dialog";
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
 * Shell del admin: sidebar colapsable (desktop), drawer (mobile), topbar y
 * command palette con Ctrl/⌘ K.
 */
export function AdminShell({ storeName, user, isOwner, initialCollapsed, children }: AdminShellProps) {
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
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 border-r border-adm-border transition-[width] duration-150 md:block",
          collapsed ? "w-14" : "w-[232px]",
        )}
      >
        <Sidebar storeName={storeName} isOwner={isOwner} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <Drawer
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        side="left"
        width="w-[264px]"
        hideClose
        label="Menú"
        className="md:hidden"
      >
        <Sidebar storeName={storeName} isOwner={isOwner} onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          onOpenMenu={() => setMobileOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          shortcutLabel={isMac ? "⌘" : "Ctrl"}
        />
        <main id="contenido" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 md:px-6 md:py-6">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
