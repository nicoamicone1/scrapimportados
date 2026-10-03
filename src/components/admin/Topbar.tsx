"use client";

import { ExternalLink, LogOut, Search, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useTransition, type CSSProperties, type ReactNode } from "react";

import { signOut } from "@/app/admin/actions";
import { BrandMark } from "@/components/platform/brand";
import { DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { Kbd } from "@/components/ui/display";
import { cn } from "@/lib/cn";

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
  /** Selector de tienda (M: `<StoreSwitcher>`). Sólo en mobile: en escritorio vive en el sidebar. */
  storeSwitcher?: ReactNode;
  /** Link de "Ver tienda" de la tienda activa (M). */
  storeHref?: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/*
 * Íconos de 44 px en mobile (sobre tinta) y 36 px en escritorio (sobre la hoja).
 */
const iconBtn =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-[140ms] ease-eco-out text-eco-mist hover:bg-white/10 md:size-9 md:text-adm-fg-muted md:hover:bg-adm-surface-2 md:hover:text-adm-fg";

/**
 * Esquina cóncava de tinta: dibuja el borde curvo de "la hoja" (BRAND §7.2)
 * sobre el contenido que pasa por debajo de la barra fija.
 */
function SheetCorner({ className, at, size }: { className: string; at: string; size: string }) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute", className)}
      style={
        {
          width: size,
          height: size,
          background: `radial-gradient(circle at ${at}, transparent calc(${size} - 0.5px), var(--adm-sidebar-bg) ${size})`,
        } as CSSProperties
      }
    />
  );
}

/**
 * Barra superior.
 * - Escritorio: es el borde de arriba de la hoja (niebla, sin franjas), con la
 *   esquina superior izquierda curva sobre la tinta del sidebar. Buscador en
 *   pastilla (Ctrl K), "Ver tienda" y usuario.
 * - Mobile: tapa de tinta con la burbuja de Ecommy y el selector de tienda;
 *   la hoja asoma debajo con las dos esquinas curvas. Tres íconos de 44 px
 *   (buscar, ver tienda, cuenta); el menú vive en la barra inferior.
 */
export function Topbar({ user, onOpenPalette, shortcutLabel, storeSwitcher, storeHref = "/" }: TopbarProps) {
  const [pending, startTransition] = useTransition();

  return (
    <header className="adm-topbar sticky top-0 z-30 shrink-0">
      <div className="adm-dark flex h-14 items-center gap-1 bg-adm-sidebar-bg px-2 md:[color-scheme:light] md:gap-3 md:border-b md:border-adm-border md:bg-adm-bg md:px-8 md:[--adm-focus:0_0_0_2px_var(--adm-bg),0_0_0_4px_var(--adm-focus-ring)]">
        <Link href="/admin" aria-label="Ecommy, inicio" className="ml-1.5 inline-flex shrink-0 rounded-adm md:hidden">
          <BrandMark size={26} />
        </Link>

        {storeSwitcher ? <div className="ml-1 flex min-w-0 flex-1 items-center md:hidden">{storeSwitcher}</div> : <div className="flex-1 md:hidden" />}

        <div className="hidden min-w-0 flex-1 md:flex">
          <button
            type="button"
            onClick={onOpenPalette}
            className="group flex h-9 w-full max-w-[440px] items-center gap-2.5 rounded-full border border-adm-border bg-adm-surface pr-1.5 pl-3.5 text-left text-[13px] text-adm-fg-muted shadow-adm-card transition-[border-color,box-shadow] duration-[140ms] ease-eco-out hover:border-adm-input-border/60"
          >
            <Search className="size-4 shrink-0 transition-colors duration-[140ms] group-hover:text-adm-fg" aria-hidden />
            <span className="flex-1 truncate">Buscar pedidos, productos o ir a…</span>
            <span className="flex items-center gap-0.5 rounded-full bg-adm-surface-2 px-1.5 py-1">
              <Kbd className="border-0 bg-transparent">{shortcutLabel}</Kbd>
              <Kbd className="border-0 bg-transparent">K</Kbd>
            </span>
          </button>
        </div>

        <button type="button" onClick={onOpenPalette} aria-label="Buscar pedidos, productos o ir a…" className={cn(iconBtn, "md:hidden")}>
          <Search className="size-5" strokeWidth={1.75} aria-hidden />
        </button>

        <a
          href={storeHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ver tienda (se abre en otra pestaña)"
          className={cn(
            iconBtn,
            "md:h-9 md:w-auto md:gap-1.5 md:border md:border-adm-border md:bg-adm-surface md:px-3.5 md:text-[13px] md:font-medium md:text-adm-fg md:shadow-adm-card md:hover:border-adm-input-border/60 md:hover:bg-adm-surface",
          )}
        >
          <span className="hidden md:inline">Ver tienda</span>
          <ExternalLink className="size-5 md:size-3.5" strokeWidth={1.75} aria-hidden />
        </a>

        <DropdownMenu
          width={240}
          trigger={
            <button type="button" aria-label={`Cuenta de ${user.name}`} className={iconBtn}>
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-eco-mist text-[12px] font-semibold text-eco-ink md:bg-adm-accent md:text-adm-accent-fg">
                {initials(user.name)}
              </span>
            </button>
          }
        >
          <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-2.5">
            <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-adm-accent text-[13px] font-semibold text-adm-accent-fg">
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-adm-fg">{user.name}</div>
              <div className="truncate text-xs text-adm-fg-muted">{user.email}</div>
            </div>
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
          <DropdownItem icon={<LogOut />} disabled={pending} onSelect={() => startTransition(() => signOut())}>
            Cerrar sesión
          </DropdownItem>
        </DropdownMenu>
      </div>

      {/* La hoja: esquina superior izquierda curva sobre el sidebar (escritorio)… */}
      <SheetCorner className="top-0 left-0 hidden md:block" at="100% 100%" size="var(--adm-sheet-radius)" />
      {/* …y las dos esquinas debajo de la tapa de tinta (mobile). */}
      <SheetCorner className="top-full left-0 md:hidden" at="100% 100%" size="20px" />
      <SheetCorner className="top-full right-0 md:hidden" at="0% 100%" size="20px" />
    </header>
  );
}
