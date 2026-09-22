/**
 * Versión de Ecommy y changelog: FUENTE ÚNICA. `/admin/changelog` y el pie
 * del sidebar leen de acá. `docs/CHANGELOG.md` es un espejo en markdown.
 * Al sumar una versión: agregá la entrada ARRIBA y actualizá APP_VERSION y
 * `package.json`.
 */

export const APP_NAME = "Ecommy";
export const APP_VERSION = "0.0.0";

/**
 * Versión del esquema de base de datos que espera este código. Se compara
 * con `app_meta.schema_version` (Configuración muestra un aviso si la base
 * está atrasada). Subila junto con la migración que la actualiza.
 */
export const SCHEMA_VERSION = 3;

export interface ChangelogEntry {
  version: string;
  /** ISO (YYYY-MM-DD). */
  date: string;
  title: string;
  sections: {
    added: string[];
    changed: string[];
    fixed: string[];
  };
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.0.0",
    date: "2026-09-22",
    title: "Primera versión de Ecommy",
    sections: {
      added: [
        "Base de datos completa en Supabase con seguridad por filas (RLS) en todas las tablas.",
        "Acceso al panel con email y contraseña, alta del primer dueño y aprobación de cuentas nuevas.",
        "Panel de administración con navegación lateral, buscador rápido (Ctrl+K) y diseño propio.",
        "Catálogo con productos, variantes, imágenes, categorías e inventario con historial de movimientos.",
        "Pedidos con número correlativo, seguimiento público por enlace secreto, pagos y línea de tiempo.",
        "Clientes con historial de compras y total gastado.",
        "Motor de precios: promociones, cupones, descuento por método de pago y envío gratis desde un monto.",
        "Checkout sin pasarela: transferencia bancaria con descuento o coordinación por WhatsApp.",
        "Zonas de envío por polígono, provincia o código postal, y puntos de retiro.",
        "Apariencia de la tienda: 5 estilos prearmados, colores, tipografías de Google Fonts, radios y botones.",
        "Constructor de páginas por bloques (portada, carruseles, banners, texto y más).",
        "Menús de encabezado y pie editables.",
        "Importación del catálogo desde otras tiendas.",
        "Configuración general, usuarios con roles, registro de auditoría y este changelog.",
        "Configuración de la tienda, pagos y checkout con validación de CBU, alias y CUIT, y plazo de reserva de stock.",
        "Impuestos y legales: precio sin impuestos nacionales, Defensa del Consumidor, Data Fiscal y plantillas de políticas para Argentina.",
        "SEO global, Google Analytics 4, Tag Manager, Meta Pixel, modo mantenimiento y redirecciones 301 con importación CSV.",
        "Exportación CSV de productos, inventario, pedidos, clientes y auditoría.",
      ],
      changed: [],
      fixed: [],
    },
  },
];
