import {
  BadgePercent,
  BellRing,
  Blocks,
  Boxes,
  CreditCard,
  FileClock,
  FileText,
  FolderTree,
  Import,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Package,
  Palette,
  Receipt,
  ScrollText,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Ticket,
  Truck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { MODULE_CODES, MODULES, type ModuleCode } from "@/lib/modules/registry";

/**
 * Navegación del admin (ARCHIVO COMPARTIDO — spec §10).
 * Cada agente edita SÓLO su entrada (label, icon, keywords) y no reordena
 * grupos. Todas las rutas ya existen (con una page placeholder); si sumás una
 * ruta nueva de primer nivel, agregala en tu grupo con un comentario
 * `// <Agente>: …`. Un ítem queda activo en `href` y en `href/*`.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Palabras extra para el buscador (command palette). */
  keywords?: string[];
  /** Sólo visible para el dueño. */
  ownerOnly?: boolean;
  /** Coincidencia exacta (para el dashboard `/admin`). */
  exact?: boolean;
  /** Fuera del panel: se abre en otra pestaña y nunca queda activo. */
  external?: boolean;
}

/** Sección visual (tinta de la cabecera). U: restyling §14.6. */
export type AdminSection = "orders" | "catalog" | "marketing" | "store" | "system";

export interface NavGroup {
  label: string;
  /** Tinta de la sección (icono de PageHeader + franja del topbar). */
  section: AdminSection;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "Principal",
    section: "orders",
    items: [
      // B: dashboard
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true, keywords: ["inicio", "resumen", "ventas"] },
      // B: pedidos (listado, detalle, pedido manual)
      { label: "Pedidos", href: "/admin/pedidos", icon: Receipt, keywords: ["ventas", "órdenes", "ordenes"] },
      { label: "Carritos abandonados", href: "/admin/pedidos/abandonados", icon: ShoppingCart, keywords: ["abandonados", "checkout", "recuperar", "carrito", "sin terminar"] },
      // B: clientes
      { label: "Clientes", href: "/admin/clientes", icon: UsersRound, keywords: ["compradores"] },
    ],
  },
  {
    label: "Catálogo",
    section: "catalog",
    items: [
      // A: productos y variantes
      { label: "Productos", href: "/admin/productos", icon: Package, keywords: ["artículos", "variantes", "sku", "duplicar"] },
      // A: categorías
      { label: "Categorías", href: "/admin/categorias", icon: FolderTree, keywords: ["rubros"] },
      // A: inventario y movimientos
      { label: "Inventario", href: "/admin/inventario", icon: Boxes, keywords: ["stock", "existencias", "movimientos", "stock bajo", "agotados"] },
      // Avisos de stock ("Avisame cuando haya stock", 0016)
      { label: "Avisos de stock", href: "/admin/inventario/avisos", icon: BellRing, keywords: ["avisame", "avísame", "sin stock", "agotados", "esperando", "notificar"] },
    ],
  },
  {
    label: "Marketing",
    section: "marketing",
    items: [
      // C: promociones
      { label: "Promociones", href: "/admin/promociones", icon: BadgePercent, keywords: ["ofertas", "descuentos"] },
      // C: cupones
      { label: "Cupones", href: "/admin/cupones", icon: Ticket, keywords: ["códigos", "descuentos"] },
      // C: precios masivos
      { label: "Precios", href: "/admin/precios", icon: Tag, keywords: ["aumento", "masivo", "listas"] },
      // Activación: link, QR y mensajes listos para Instagram y WhatsApp
      { label: "Compartir", href: "/admin/compartir", icon: Share2, keywords: ["link", "qr", "instagram", "whatsapp", "difundir", "bio"] },
    ],
  },
  {
    label: "Tienda",
    section: "store",
    items: [
      // E: tema / apariencia
      { label: "Apariencia", href: "/admin/apariencia", icon: Palette, keywords: ["tema", "colores", "fuentes"] },
      // E: constructor de páginas
      { label: "Páginas", href: "/admin/paginas", icon: FileText, keywords: ["home", "inicio", "landing", "builder"] },
      // E: menús
      { label: "Menús", href: "/admin/menus", icon: Menu, keywords: ["navegación", "header", "footer"] },
      // D: envíos y retiro
      { label: "Envíos", href: "/admin/envios", icon: Truck, keywords: ["zonas", "retiro", "logística"] },
    ],
  },
  {
    label: "Sistema",
    section: "system",
    items: [
      // G: importador / scraping
      { label: "Importar", href: "/admin/importar", icon: Import, keywords: ["scraping", "catálogo", "woocommerce", "shopify"] },
      // A — Apps: catálogo de apps extra (docs/modules/TALLER-3D.md §1.3)
      { label: "Apps", href: "/admin/apps", icon: Blocks, keywords: ["módulos", "modulos", "extensiones", "taller 3d", "impresión 3d", "activar"] },
      // M: plan de la tienda (uso, límites, cambio de plan)
      { label: "Plan", href: "/admin/plan", icon: CreditCard, keywords: ["suscripción", "suscripcion", "precio", "límites", "limites", "upgrade", "facturación"] },
      // H: configuración (tienda, pagos, checkout, SEO, políticas)
      { label: "Configuración", href: "/admin/configuracion", icon: Settings, keywords: ["ajustes", "pagos", "checkout", "seo"] },
      // H: usuarios y roles
      { label: "Usuarios", href: "/admin/usuarios", icon: Users, keywords: ["equipo", "roles", "permisos"] },
      // H: auditoría
      { label: "Auditoría", href: "/admin/auditoria", icon: ShieldCheck, keywords: ["registro", "log", "historial"] },
      // H: changelog
      { label: "Changelog", href: "/admin/changelog", icon: FileClock, keywords: ["versiones", "novedades"] },
      // Ayuda: centro de ayuda público (/ayuda, mismo host que el panel), en otra pestaña
      { label: "Ayuda", href: "/ayuda", icon: LifeBuoy, external: true, keywords: ["soporte", "cómo", "como", "tutorial", "preguntas"] },
    ],
  },
];

/** Todas las entradas en una lista plana (sin las apps: esas dependen de la tienda). */
export const NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);

/** Grupo "Apps" del sidebar: se pinta con la tinta de "Tienda" (sin sección nueva). */
export const APPS_GROUP_LABEL = "Apps";

/** Grupo "Apps" con el menú de cada app vigente (en el orden del registro); `null` si no hay ninguna. */
export function appsNavGroup(modules: readonly ModuleCode[]): NavGroup | null {
  const items = MODULE_CODES.filter((c) => modules.includes(c)).flatMap((c): NavItem[] => MODULES[c].nav);
  return items.length ? { label: APPS_GROUP_LABEL, section: "store", items } : null;
}

/**
 * Menú de la tienda: `NAV` + el grupo "Apps" (antes de "Sistema") con las
 * apps vigentes (`ctx.modules`). Sin apps devuelve `NAV` tal cual.
 */
export function buildNav(modules: readonly ModuleCode[]): NavGroup[] {
  const apps = appsNavGroup(modules);
  if (!apps) return NAV;
  const at = NAV.findIndex((g) => g.section === "system");
  return at < 0 ? [...NAV, apps] : [...NAV.slice(0, at), apps, ...NAV.slice(at)];
}

/** Menú con TODAS las apps: para resolver rutas (activo, breadcrumb, tinta) sin saber cuáles tiene la tienda. */
const ALL_NAV: NavGroup[] = buildNav(MODULE_CODES);

function matchesPath(item: NavItem, pathname: string): boolean {
  if (item.external) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Ítem activo para una ruta. Si otro ítem del menú coincide con un `href`
 * más largo (por ejemplo `/admin/inventario/avisos` dentro de
 * `/admin/inventario`), gana el más específico y sólo ese se resalta.
 */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (!matchesPath(item, pathname)) return false;
  return !ALL_NAV.some((g) => g.items.some((o) => o !== item && o.href.length > item.href.length && matchesPath(o, pathname)));
}

/** Ítem del menú que corresponde a una ruta (para el breadcrumb). */
export function navItemFor(pathname: string): { group: NavGroup; item: NavItem } | null {
  for (const group of ALL_NAV) {
    for (const item of group.items) {
      if (!item.exact && isNavActive(item, pathname)) return { group, item };
    }
  }
  const dashboard = NAV[0].items[0];
  if (pathname === dashboard.href) return { group: NAV[0], item: dashboard };
  // Rutas de una app sin entrada propia (/admin/taller-3d, /admin/taller-3d/impresoras…): cuelgan de la app.
  const apps = ALL_NAV.find((g) => g.label === APPS_GROUP_LABEL);
  for (const code of MODULE_CODES) {
    const { adminHref } = MODULES[code];
    if (pathname !== adminHref && !pathname.startsWith(`${adminHref}/`)) continue;
    const item = apps?.items.find((i) => i.href === adminHref);
    if (apps && item) return { group: apps, item };
  }
  return null;
}

/** Sección (tinta) de una ruta del admin; null fuera de las rutas del menú. */
export function sectionFor(pathname: string): AdminSection | null {
  return navItemFor(pathname)?.group.section ?? null;
}

/** Cookie con el estado del sidebar ("collapsed" | "open"). */
export const SIDEBAR_COOKIE = "adm-sidebar";

/** Icono de documentos genérico para rutas sin entrada. */
export const FALLBACK_ICON: LucideIcon = ScrollText;
