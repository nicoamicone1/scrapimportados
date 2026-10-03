"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { FALLBACK_ICON, navItemFor, type AdminSection } from "@/components/admin/nav";
import { cn } from "@/lib/cn";

/** Clases estáticas por sección (Tailwind necesita strings literales). */
export const SECTION_TINTS: Record<AdminSection, { stripe: string; tile: string; text: string; label: string }> = {
  orders: { stripe: "bg-adm-tint-orders", tile: "bg-adm-tint-orders-bg text-adm-tint-orders-fg", text: "text-adm-tint-orders-fg", label: "Ventas" },
  catalog: { stripe: "bg-adm-tint-catalog", tile: "bg-adm-tint-catalog-bg text-adm-tint-catalog-fg", text: "text-adm-tint-catalog-fg", label: "Catálogo" },
  marketing: { stripe: "bg-adm-tint-marketing", tile: "bg-adm-tint-marketing-bg text-adm-tint-marketing-fg", text: "text-adm-tint-marketing-fg", label: "Marketing" },
  store: { stripe: "bg-adm-tint-store", tile: "bg-adm-tint-store-bg text-adm-tint-store-fg", text: "text-adm-tint-store-fg", label: "Tienda" },
  system: { stripe: "bg-adm-tint-system", tile: "bg-adm-tint-system-bg text-adm-tint-system-fg", text: "text-adm-tint-system-fg", label: "Sistema" },
};

/** Sección de la ruta actual (o la forzada) + icono de su entrada del menú + rótulo del grupo. */
export function useSection(section?: AdminSection | null) {
  const pathname = usePathname();
  const match = navItemFor(pathname ?? "");
  const s = section ?? match?.group.section ?? null;
  // Rótulo: el del grupo del menú ("Catálogo", "Apps"…); "Principal" se lee como "Ventas", y el inicio como "Inicio".
  const groupLabel = match && match.group.section === s && match.group.label !== "Principal" ? match.group.label : null;
  const label = match?.item.exact ? match.item.label : (groupLabel ?? (s ? SECTION_TINTS[s].label : null));
  return { section: s, Icon: match?.item.icon ?? FALLBACK_ICON, label };
}

/**
 * Rótulo de sección sobre el título de página (reemplaza al ícono en
 * cuadrado pastel): punto de la tinta de la sección + nombre del grupo, 11 px
 * en mayúsculas. Con `icon`, el ícono (14 px, tinta de la sección) ocupa el
 * lugar del punto.
 */
export function SectionEyebrow({ section, icon, className }: { section?: AdminSection; icon?: ReactNode; className?: string }) {
  const { section: s, label } = useSection(section);
  if (!s || !label) return null;
  return (
    <p className={cn("mb-1.5 flex items-center gap-1.5 text-[11px] leading-4 font-semibold tracking-[0.1em] text-adm-fg-muted uppercase", className)}>
      {icon ? (
        <span aria-hidden className={cn("inline-flex [&_svg]:size-3.5 [&_svg]:stroke-[2]", SECTION_TINTS[s].text)}>
          {icon}
        </span>
      ) : (
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", SECTION_TINTS[s].stripe)} />
      )}
      {label}
    </p>
  );
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
