"use client";

import { ExternalLink, LogOut, Search, UserRound, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTransition, type ReactNode } from "react";

import { signOut } from "@/app/admin/actions";
import { DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { Kbd } from "@/components/ui/display";
import { SectionStripe } from "@/components/ui/SectionAccent";
import { cn } from "@/lib/cn";

import { navItemFor } from "./nav";

export interface TopbarUser {
  name: string;
  email: string;
  roleLabel: string;
}

export interface TopbarProps {
  user: TopbarUser;
  /** Ya no se usa: en mobile el menú se abre desde la barra inferior (`MobileTabBar`). */
  onOpenMenu?: () => void;
  onOpenPalette: () => void;
  shortcutLabel: string;
  /** Slot a la izquierda del breadcrumb: selector de tienda (M: `<StoreSwitcher>`). */
  storeSwitcher?: ReactNode;
  /** Link de "Ver tienda" de la tienda activa (M). */
  storeHref?: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const iconBtn =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-adm text-adm-fg-muted transition-colors duration-[120ms] hover:bg-adm-surface-2 hover:text-adm-fg pointer-coarse:size-11";

/**
 * Barra superior 48px, blanca con borde (spec §14.6): selector de tienda,
 * breadcrumb, buscador crema (⌘K), "Ver tienda" y usuario. El borde inferior
 * lleva la franja de 3 px del color de la sección. En mobile: tienda a la
 * izquierda y tres íconos de 44 px (buscar, ver tienda, cuenta); el menú vive
 * en la barra inferior.
 */
export function Topbar({ user, onOpenPalette, shortcutLabel, storeSwitcher, storeHref = "/" }: TopbarProps) {
  const pathname = usePathname();
  const current = navItemFor(pathname);
  const [pending, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-1 border-b border-adm-border bg-adm-surface px-2 sm:gap-3 md:px-5 pointer-coarse:h-14">
      <SectionStripe />

      {storeSwitcher ? <div className="flex min-w-0 flex-1 items-center sm:flex-none sm:shrink-0">{storeSwitcher}</div> : null}

      <nav aria-label="Ubicación" className="hidden min-w-0 items-center gap-1.5 text-[13px] lg:flex">
        {current && !current.item.exact ? (
          <>
            <span className="text-adm-fg-muted">{current.group.label}</span>
            <span aria-hidden className="text-adm-fg-muted">/</span>
            <span className="truncate font-medium text-adm-fg">{current.item.label}</span>
          </>
        ) : null}
      </nav>

      <div className="hidden flex-1 sm:flex md:pl-6">
        <button
          type="button"
          onClick={onOpenPalette}
          className="flex h-8 w-full max-w-72 items-center gap-2 rounded-adm border border-adm-border bg-adm-surface-2 px-2.5 text-left text-[13px] text-adm-fg-muted transition-colors duration-[120ms] hover:border-adm-input-border hover:bg-adm-surface pointer-coarse:h-10"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 truncate">Buscar pedidos, productos o ir a…</span>
          <span className="hidden items-center gap-0.5 md:flex">
            <Kbd>{shortcutLabel}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </div>

      <button type="button" onClick={onOpenPalette} aria-label="Buscar pedidos, productos o ir a…" className={cn(iconBtn, "sm:hidden")}>
        <Search className="size-5" strokeWidth={1.5} aria-hidden />
      </button>

      <a
        href={storeHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ver tienda (se abre en otra pestaña)"
        className={cn(iconBtn, "sm:w-auto sm:gap-1.5 sm:px-2.5 sm:text-[13px]")}
      >
        <span className="hidden sm:inline">Ver tienda</span>
        <ExternalLink className="size-5 sm:size-3.5" strokeWidth={1.5} aria-hidden />
      </a>

      <DropdownMenu
        width={232}
        trigger={
          <button
            type="button"
            aria-label={`Cuenta de ${user.name}`}
            className={iconBtn}
          >
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-adm-accent text-[11px] font-semibold text-adm-accent-fg">
              {initials(user.name)}
            </span>
          </button>
        }
      >
        <div className="px-2 pt-1.5 pb-2">
          <div className="truncate text-sm font-medium text-adm-fg">{user.name}</div>
          <div className="truncate text-xs text-adm-fg-muted">{user.email}</div>
        </div>
        <DropdownSeparator />
        <DropdownLabel>{user.roleLabel}</DropdownLabel>
        <DropdownItem href="/admin/usuarios/mi-cuenta" icon={<UserRound />}>
          Mi cuenta
        </DropdownItem>
        <DropdownItem href="/admin/usuarios" icon={<Users />}>
          Usuarios y roles
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem
          icon={<LogOut />}
          disabled={pending}
          onSelect={() => startTransition(() => signOut())}
        >
          Cerrar sesión
        </DropdownItem>
      </DropdownMenu>
    </header>
  );
}
