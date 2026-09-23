"use client";

import { ExternalLink, LogOut, Menu as MenuIcon, Search, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTransition, type ReactNode } from "react";

import { signOut } from "@/app/admin/actions";
import { DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { Kbd } from "@/components/ui/display";
import { SectionStripe } from "@/components/ui/SectionAccent";

import { navItemFor } from "./nav";

export interface TopbarUser {
  name: string;
  email: string;
  roleLabel: string;
}

export interface TopbarProps {
  user: TopbarUser;
  onOpenMenu: () => void;
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

/**
 * Barra superior 48px, blanca con borde (spec §14.6): selector de tienda,
 * breadcrumb, buscador crema (⌘K), "Ver tienda" y usuario. El borde inferior
 * lleva la franja de 3 px del color de la sección.
 */
export function Topbar({ user, onOpenMenu, onOpenPalette, shortcutLabel, storeSwitcher, storeHref = "/" }: TopbarProps) {
  const pathname = usePathname();
  const current = navItemFor(pathname);
  const [pending, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-adm-border bg-adm-surface px-3 md:px-5">
      <SectionStripe />
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir menú"
        className="inline-flex size-8 items-center justify-center rounded-adm text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg md:hidden"
      >
        <MenuIcon className="size-4" aria-hidden />
      </button>

      {storeSwitcher ? <div className="flex min-w-0 shrink-0 items-center">{storeSwitcher}</div> : null}

      <nav aria-label="Ubicación" className="hidden min-w-0 items-center gap-1.5 text-[13px] sm:flex">
        {current ? (
          <>
            <span className="text-adm-fg-muted">{current.group.label}</span>
            <span aria-hidden className="text-adm-fg-muted">/</span>
            <span className="truncate font-medium text-adm-fg">{current.item.label}</span>
          </>
        ) : null}
      </nav>

      <div className="flex flex-1 justify-center md:justify-start md:pl-6">
        <button
          type="button"
          onClick={onOpenPalette}
          className="flex h-8 w-full max-w-72 items-center gap-2 rounded-adm border border-transparent bg-adm-surface-2 px-2.5 text-left text-[13px] text-adm-fg-muted transition-colors hover:border-adm-border hover:bg-adm-surface"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 truncate">Buscar o ir a…</span>
          <span className="hidden items-center gap-0.5 sm:flex">
            <Kbd>{shortcutLabel}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </div>

      <a
        href={storeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden h-8 items-center gap-1.5 rounded-adm px-2.5 text-[13px] text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg sm:inline-flex"
      >
        Ver tienda
        <ExternalLink className="size-3.5" aria-hidden />
      </a>

      <DropdownMenu
        width={232}
        trigger={
          <button
            type="button"
            aria-label={`Cuenta de ${user.name}`}
            className="inline-flex size-8 items-center justify-center rounded-adm hover:bg-adm-surface-2"
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
        <DropdownItem href="/admin/usuarios" icon={<UserRound />}>
          Usuarios y roles
        </DropdownItem>
        <DropdownItem href={storeHref} icon={<ExternalLink />}>
          Ver tienda
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
