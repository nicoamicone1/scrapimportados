import { FileBox, ListOrdered, Printer, Spool, type LucideIcon } from "lucide-react";

/*
 * Apps (módulos) extra de Ecommy — registro estático (docs/modules/TALLER-3D.md §1.2).
 * Puro e isomórfico: lo usan el sidebar (client), el command palette, los
 * guards del server y los tests. Los datos comerciales (nombre, precio,
 * visibilidad) viven en `public.modules`; acá está lo que necesita el código
 * (rutas, menú, textos de venta del catálogo /admin/apps).
 */

export const MODULE_CODES = ["print3d"] as const;
export type ModuleCode = (typeof MODULE_CODES)[number];

/** Estado de `store_modules.status`. */
export const MODULE_STATUSES = ["active", "trial", "disabled"] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

export const MODULE_STATUS_LABELS: Record<ModuleStatus, string> = {
  active: "Activa",
  trial: "Prueba",
  disabled: "Desactivada",
};

export interface ModuleNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  keywords?: string[];
  exact?: boolean;
}

export interface ModuleDef {
  code: ModuleCode;
  name: string;
  tagline: string;
  /** Ruta base del admin, ej. "/admin/taller-3d". */
  adminHref: string;
  /** Ítems del grupo "Apps" del sidebar cuando la app está activa. */
  nav: ModuleNavItem[];
  /** Rutas públicas del storefront que agrega (para páginas reservadas). */
  storefrontPaths: string[];
  /** Ícono principal (catálogo de apps, encabezado del módulo). */
  icon: LucideIcon;
  /** Para quién es, en una línea (catálogo /admin/apps). */
  audience: string;
  /** Qué incluye (catálogo /admin/apps). */
  includes: { title: string; text: string }[];
  /** Epígrafe chico (mono) bajo la ilustración. */
  artCaption?: string;
}

export const MODULES: Record<ModuleCode, ModuleDef> = {
  print3d: {
    code: "print3d",
    name: "Taller 3D",
    tagline: "Cotizador de STL, cola de impresoras y stock de filamento",
    adminHref: "/admin/taller-3d",
    icon: Printer,
    nav: [
      { label: "Taller 3D", href: "/admin/taller-3d", icon: Printer, exact: true, keywords: ["impresión 3d", "impresion 3d", "resumen", "print3d"] },
      { label: "Cola de impresión", href: "/admin/taller-3d/cola", icon: ListOrdered, keywords: ["impresoras", "trabajos", "producción", "produccion", "plato"] },
      { label: "Cotizaciones", href: "/admin/taller-3d/cotizaciones", icon: FileBox, keywords: ["stl", "3mf", "presupuestos", "revisión", "revision"] },
      { label: "Filamento", href: "/admin/taller-3d/filamento", icon: Spool, keywords: ["bobinas", "pla", "petg", "tpu", "stock", "gramos"] },
    ],
    storefrontPaths: ["impresion-3d"],
    artCaption: "PLA · capa 0,20 mm · relleno 20 %",
    audience: "Para talleres de impresión 3D FDM con 3 a 10 impresoras.",
    includes: [
      {
        title: "Cotizador de STL en tu tienda",
        text: "El cliente sube su STL o 3MF, elige material, color, calidad y relleno, y ve el precio y la fecha al toque.",
      },
      {
        title: "Cola por impresora",
        text: "Un tablero con una columna por impresora: arrastrás los trabajos, marcás fallas por warping o atasco y reimprimís.",
      },
      {
        title: "Stock de filamento en gramos",
        text: "Cada bobina descuenta lo que se usó de verdad. Te avisa cuando un color se queda corto.",
      },
      {
        title: "Costo real por pedido",
        text: "Material, luz, desgaste de la máquina y post-proceso: sabés cuánto ganaste en cada pieza.",
      },
    ],
  },
};

/** Lista ordenada (orden del registro). */
export const MODULE_LIST: ModuleDef[] = MODULE_CODES.map((c) => MODULES[c]);

export function isModuleCode(value: unknown): value is ModuleCode {
  return typeof value === "string" && (MODULE_CODES as readonly string[]).includes(value);
}

export function isModuleStatus(value: unknown): value is ModuleStatus {
  return typeof value === "string" && (MODULE_STATUSES as readonly string[]).includes(value);
}

/** Tag de caché del storefront para las apps de una tienda (`storeHasModule`). */
export function modulesTag(storeId: string): string {
  return `modules:${storeId}`;
}

/** ¿La tienda del contexto tiene la app activa (o en prueba vigente)? */
export function hasModule(ctx: { modules: readonly ModuleCode[] }, code: ModuleCode): boolean {
  return ctx.modules.includes(code);
}

/**
 * Misma regla que `public.store_has_module`: estado `active` o `trial` y sin
 * vencer (`expires_at` null o futuro).
 */
export function isModuleLive(row: { status: string; expires_at: string | null }, now: Date = new Date()): boolean {
  if (row.status !== "active" && row.status !== "trial") return false;
  if (!row.expires_at) return true;
  const exp = new Date(row.expires_at);
  return Number.isNaN(exp.getTime()) ? false : exp.getTime() > now.getTime();
}

/** Estado de una app para una tienda, para mostrar (catálogo, superadmin). */
export type ModuleState =
  | { kind: "active" | "trial"; expiresAt: string | null }
  | { kind: "expired"; expiresAt: string }
  | { kind: "off" };

/** Fila de `store_modules` (o su ausencia) → estado para mostrar. */
export function moduleState(row: { status: string; expires_at: string | null } | null | undefined, now: Date = new Date()): ModuleState {
  if (!row || (row.status !== "active" && row.status !== "trial")) return { kind: "off" };
  if (isModuleLive(row, now)) return { kind: row.status, expiresAt: row.expires_at };
  return row.expires_at ? { kind: "expired", expiresAt: row.expires_at } : { kind: "off" };
}

/** Códigos conocidos, sin repetir y en el orden del registro (descarta los que el código no conoce). */
export function normalizeModuleCodes(codes: readonly unknown[]): ModuleCode[] {
  const set = new Set(codes.filter(isModuleCode));
  return MODULE_CODES.filter((c) => set.has(c));
}
