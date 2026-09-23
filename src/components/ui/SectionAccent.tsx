"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { FALLBACK_ICON, navItemFor, type AdminSection } from "@/components/admin/nav";
import { cn } from "@/lib/cn";

/** Clases estáticas por sección (Tailwind necesita strings literales). */
export const SECTION_TINTS: Record<AdminSection, { stripe: string; tile: string; label: string }> = {
  orders: { stripe: "bg-adm-tint-orders", tile: "bg-adm-tint-orders-bg text-adm-tint-orders-fg", label: "Pedidos" },
  catalog: { stripe: "bg-adm-tint-catalog", tile: "bg-adm-tint-catalog-bg text-adm-tint-catalog-fg", label: "Catálogo" },
  marketing: { stripe: "bg-adm-tint-marketing", tile: "bg-adm-tint-marketing-bg text-adm-tint-marketing-fg", label: "Marketing" },
  store: { stripe: "bg-adm-tint-store", tile: "bg-adm-tint-store-bg text-adm-tint-store-fg", label: "Tienda" },
  system: { stripe: "bg-adm-tint-system", tile: "bg-adm-tint-system-bg text-adm-tint-system-fg", label: "Sistema" },
};

/** Sección de la ruta actual (o la forzada) + icono de su entrada del menú. */
export function useSection(section?: AdminSection | null) {
  const pathname = usePathname();
  const match = navItemFor(pathname ?? "");
  return { section: section ?? match?.group.section ?? null, Icon: match?.item.icon ?? FALLBACK_ICON };
}

/**
 * Icono de la cabecera con fondo tintado según la sección. Si no se pasa
 * `section`, la deduce del pathname (mapa de grupos en `nav.ts`).
 */
export function SectionIcon({ section, icon, className }: { section?: AdminSection; icon?: ReactNode; className?: string }) {
  const { section: s, Icon } = useSection(section);
  if (!s) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-adm [&_svg]:size-[18px] [&_svg]:stroke-[1.75]",
        SECTION_TINTS[s].tile,
        className,
      )}
    >
      {icon ?? <Icon />}
    </span>
  );
}

/** Franja de 3 px del color de la sección (borde inferior del topbar). */
export function SectionStripe({ section, className }: { section?: AdminSection; className?: string }) {
  const { section: s } = useSection(section);
  if (!s) return null;
  return <span aria-hidden className={cn("pointer-events-none absolute inset-x-0 -bottom-px h-[3px]", SECTION_TINTS[s].stripe, className)} />;
}
