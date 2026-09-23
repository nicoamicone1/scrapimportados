/**
 * Versión de Ecommy y changelog: FUENTE ÚNICA. `/admin/changelog` y el pie
 * del sidebar leen de acá. `docs/CHANGELOG.md` es un espejo en markdown.
 * Al sumar una versión: agregá la entrada ARRIBA y actualizá APP_VERSION y
 * `package.json`.
 */

export const APP_NAME = "Ecommy";
export const APP_VERSION = "0.1.0";

/**
 * Versión del esquema de base de datos que espera este código. Se compara
 * con `app_meta.schema_version` (Configuración muestra un aviso si la base
 * está atrasada). Subila junto con la migración que la actualiza.
 */
export const SCHEMA_VERSION = 4;

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
    version: "0.1.0",
    date: "2026-09-22",
    title: "Plataforma multi-tienda",
    sections: {
      added: [
        "Plataforma multi-tienda, registro y planes: cualquier persona se registra, crea su tienda en tres pasos y la administra desde su propio panel.",
        "Sitio de Ecommy con planes (Free, Starter, Pro y Business), registro, ingreso y recuperación de contraseña.",
        "Mis tiendas: hasta tres tiendas por cuenta y selector de tienda en el panel.",
        "Planes con funciones y límites por tienda; cada tienda nueva arranca con 14 días de Pro gratis.",
        "Pantalla Plan en el panel: uso contra los límites, comparación y pedido de cambio de plan por WhatsApp.",
        "Checklist de primeros pasos en el dashboard, que se tilda solo a medida que dejás lista la tienda.",
        "Equipo por tienda: invitaciones por link, roles por tienda y quitar a alguien del equipo.",
        "Panel de la plataforma para administrar tiendas, planes y pruebas.",
        "Barrido diario automático de pruebas vencidas y reservas sin pagar.",
      ],
      changed: [
        "Cada tienda tiene sus propios productos, pedidos, clientes, páginas, imágenes y configuración, aislados del resto.",
        "El ingreso pasó de /admin/login a /login, y el alta del primer dueño se reemplazó por el registro.",
        "Las tiendas se ven en su subdominio o, mientras no haya dominio propio, en /s/<tienda>.",
      ],
      fixed: [],
    },
  },
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
