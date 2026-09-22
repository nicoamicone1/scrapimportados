import {
  BadgePercent,
  Boxes,
  FileClock,
  FileText,
  FolderTree,
  Import,
  LayoutDashboard,
  Menu,
  Package,
  Palette,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Tag,
  Ticket,
  Truck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

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
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "Principal",
    items: [
      // B: dashboard
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true, keywords: ["inicio", "resumen", "ventas"] },
      // B: pedidos (listado, detalle, pedido manual)
      { label: "Pedidos", href: "/admin/pedidos", icon: Receipt, keywords: ["ventas", "órdenes", "ordenes"] },
      // B: clientes
      { label: "Clientes", href: "/admin/clientes", icon: UsersRound, keywords: ["compradores"] },
    ],
  },
  {
    label: "Catálogo",
    items: [
      // A: productos y variantes
      { label: "Productos", href: "/admin/productos", icon: Package, keywords: ["artículos", "variantes", "sku", "duplicar"] },
      // A: categorías
      { label: "Categorías", href: "/admin/categorias", icon: FolderTree, keywords: ["rubros"] },
      // A: inventario y movimientos
      { label: "Inventario", href: "/admin/inventario", icon: Boxes, keywords: ["stock", "existencias", "movimientos", "stock bajo", "agotados"] },
    ],
  },
  {
    label: "Marketing",
    items: [
      // C: promociones
      { label: "Promociones", href: "/admin/promociones", icon: BadgePercent, keywords: ["ofertas", "descuentos"] },
      // C: cupones
      { label: "Cupones", href: "/admin/cupones", icon: Ticket, keywords: ["códigos", "descuentos"] },
      // C: precios masivos
      { label: "Precios", href: "/admin/precios", icon: Tag, keywords: ["aumento", "masivo", "listas"] },
    ],
  },
  {
    label: "Tienda",
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
    items: [
      // G: importador / scraping
      { label: "Importar", href: "/admin/importar", icon: Import, keywords: ["scraping", "catálogo", "woocommerce", "shopify"] },
      // H: configuración (tienda, pagos, checkout, SEO, políticas)
      { label: "Configuración", href: "/admin/configuracion", icon: Settings, keywords: ["ajustes", "pagos", "checkout", "seo"] },
      // H: usuarios y roles
      { label: "Usuarios", href: "/admin/usuarios", icon: Users, keywords: ["equipo", "roles", "permisos"] },
      // H: auditoría
      { label: "Auditoría", href: "/admin/auditoria", icon: ShieldCheck, keywords: ["registro", "log", "historial"] },
      // H: changelog
      { label: "Changelog", href: "/admin/changelog", icon: FileClock, keywords: ["versiones", "novedades"] },
    ],
  },
];

/** Todas las entradas en una lista plana. */
export const NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Ítem del menú que corresponde a una ruta (para el breadcrumb). */
export function navItemFor(pathname: string): { group: NavGroup; item: NavItem } | null {
  for (const group of NAV) {
    for (const item of group.items) {
      if (!item.exact && isNavActive(item, pathname)) return { group, item };
    }
  }
  const dashboard = NAV[0].items[0];
  return pathname === dashboard.href ? { group: NAV[0], item: dashboard } : null;
}

/** Cookie con el estado del sidebar ("collapsed" | "open"). */
export const SIDEBAR_COOKIE = "adm-sidebar";

/** Icono de documentos genérico para rutas sin entrada. */
export const FALLBACK_ICON: LucideIcon = ScrollText;
