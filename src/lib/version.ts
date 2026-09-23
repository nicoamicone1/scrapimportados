/**
 * Versión de Ecommy y changelog: FUENTE ÚNICA. `/admin/changelog` y el pie
 * del sidebar leen de acá. `docs/CHANGELOG.md` es un espejo en markdown.
 * Al sumar una versión: agregá la entrada ARRIBA y actualizá APP_VERSION y
 * `package.json`.
 */

export const APP_NAME = "Ecommy";
export const APP_VERSION = "0.2.0";

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
    version: "0.2.0",
    date: "2026-09-23",
    title: "Listos para el primer MVP público",
    sections: {
      added: [
        "Sitio de Ecommy renovado: cómo funciona en tres pasos, muestras de los diez estilos por rubro, qué plan incluye cada función (calculado desde los planes publicados), ejemplo de un pedido sin comisión, preguntas frecuentes y contacto.",
        "Términos del servicio y política de privacidad (Ley 25.326) con índice y fecha de actualización, enlazados desde el pie y desde el registro; página de contacto con mail, WhatsApp y el plan Business a medida.",
        "Ícono de Ecommy en la pestaña y en la pantalla de inicio del celular, e imagen propia al compartir los links de Ecommy en WhatsApp y redes.",
        "Emails automáticos (cuando la plataforma tiene configurado el envío): al comprador cuando hace el pedido, se confirma el pago, se despacha o se cancela; al vendedor cuando entra un pedido o una solicitud de arrepentimiento; al dueño de la cuenta al crear la tienda y cuando la prueba de Pro está por terminar o terminó.",
        "Nueva sección Marketing › Compartir: tu link con «Copiar», el QR de tu tienda para descargar e imprimir, y mensajes listos para pegar en la bio de Instagram, para responder por WhatsApp y para historias, armados con tu descuento por transferencia y tu envío gratis si los tenés. También el link o el QR de un producto o categoría.",
        "Una franja arriba del panel te avisa cuántos días de prueba te quedan y, el último día, a qué hora termina. En Free, un recordatorio de los límites del plan que se puede cerrar por 7 días.",
        "En Configuración › Tienda, el email de contacto aclara que ahí llegan los avisos de pedidos y arrepentimientos.",
      ],
      changed: [
        "El paso «Compartí el link de tu tienda» de los primeros pasos lleva a la nueva sección Compartir; copiar cualquier link desde ahí lo marca como hecho.",
        "Las preguntas frecuentes de Planes son las mismas que las de la página de inicio, y «Hablemos» del plan Business lleva a Contacto.",
      ],
      fixed: [
        "Los links de términos y privacidad del registro llevaban a Planes.",
        "En hosts de tienda con subdominio o dominio propio, el ícono de la pestaña ya no da 404 cuando la tienda no cargó un favicon propio.",
        "La página de inicio de Ecommy ya no tiene scroll horizontal en celulares.",
      ],
    },
  },
  {
    version: "0.1.2",
    date: "2026-09-23",
    title: "Diez estilos de tienda y selector nuevo",
    sections: {
      added: [
        "Cinco estilos nuevos: Botica (farmacia y perfumería), Recreo (librería y juguetería), Lapacho (muebles e iluminación), Galpón (mayoristas) y Bodega (vinos y gourmet). Cada uno tiene su rubro en el alta de tienda.",
        "Selector de estilos con miniatura fiel de cada tema, modo para ver y comparar los diez con la vista previa real, probar antes de aplicar y filtros por rubro, fondo claro u oscuro y plan.",
      ],
      changed: [
        "Los cinco estilos existentes se revisaron: Neón deja el lima sobre negro por grafito con un solo ámbar, Mercado pierde las sombras y el botón tintado, y en Nórdico y Editorial la oferta y el error ya no usan dos rojos casi iguales.",
        "Los bordes de inputs y controles tienen más contraste en todos los estilos.",
      ],
      fixed: [
        "En la ficha de producto desde una computadora, la foto principal ya no ocupa más alto que la pantalla: entra completa, con las miniaturas al lado.",
        "La fuente Libre Caslon Text ya carga siempre (se pedían pesos que no existen).",
      ],
    },
  },
  {
    version: "0.1.1",
    date: "2026-09-23",
    title: "Editor de páginas más fluido",
    sections: {
      added: [],
      changed: [
        "La vista previa del editor de páginas sólo actualiza los bloques que cambiaste; volver a un valor anterior o alternar entre computadora y celular es instantáneo.",
      ],
      fixed: [
        "Editar un bloque ya no hace parpadear todo el editor de páginas con la pantalla de carga ni lleva la vista previa arriba de todo.",
        "El checkout de las tiendas volvió a funcionar para los visitantes.",
      ],
    },
  },
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
