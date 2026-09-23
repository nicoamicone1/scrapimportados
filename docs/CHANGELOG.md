# Changelog

Espejo de `src/lib/version.ts` (la fuente única es ese archivo; `/admin/changelog` lee de ahí).

## v0.1.2 — 2026-09-23 · Diez estilos de tienda y selector nuevo

### Agregado

- Cinco estilos nuevos: Botica (farmacia y perfumería), Recreo (librería y juguetería), Lapacho (muebles e iluminación), Galpón (mayoristas) y Bodega (vinos y gourmet). Cada uno tiene su rubro en el alta de tienda.
- Selector de estilos con miniatura fiel de cada tema, modo para ver y comparar los diez con la vista previa real, probar antes de aplicar y filtros por rubro, fondo claro u oscuro y plan.

### Cambiado

- Los cinco estilos existentes se revisaron: Neón deja el lima sobre negro por grafito con un solo ámbar, Mercado pierde las sombras y el botón tintado, y en Nórdico y Editorial la oferta y el error ya no usan dos rojos casi iguales.
- Los bordes de inputs y controles tienen más contraste en todos los estilos.

### Corregido

- En la ficha de producto desde una computadora, la foto principal ya no ocupa más alto que la pantalla: entra completa, con las miniaturas al lado.
- La fuente Libre Caslon Text ya carga siempre (se pedían pesos que no existen).

## v0.1.1 — 2026-09-23 · Editor de páginas más fluido

### Cambiado

- La vista previa del editor de páginas sólo actualiza los bloques que cambiaste; volver a un valor anterior o alternar entre computadora y celular es instantáneo.

### Corregido

- Editar un bloque ya no hace parpadear todo el editor de páginas con la pantalla de carga ni lleva la vista previa arriba de todo.
- El checkout de las tiendas volvió a funcionar para los visitantes.

## v0.1.0 — 2026-09-22 · Plataforma multi-tienda

### Agregado

- Plataforma multi-tienda, registro y planes: cualquier persona se registra, crea su tienda en tres pasos y la administra desde su propio panel.
- Sitio de Ecommy con planes (Free, Starter, Pro y Business), registro, ingreso y recuperación de contraseña.
- Mis tiendas: hasta tres tiendas por cuenta y selector de tienda en el panel.
- Planes con funciones y límites por tienda; cada tienda nueva arranca con 14 días de Pro gratis.
- Pantalla Plan en el panel: uso contra los límites, comparación y pedido de cambio de plan por WhatsApp.
- Checklist de primeros pasos en el dashboard, que se tilda solo a medida que dejás lista la tienda.
- Equipo por tienda: invitaciones por link, roles por tienda y quitar a alguien del equipo.
- Panel de la plataforma para administrar tiendas, planes y pruebas.
- Barrido diario automático de pruebas vencidas y reservas sin pagar.

### Cambiado

- Cada tienda tiene sus propios productos, pedidos, clientes, páginas, imágenes y configuración, aislados del resto.
- El ingreso pasó de /admin/login a /login, y el alta del primer dueño se reemplazó por el registro.
- Las tiendas se ven en su subdominio o, mientras no haya dominio propio, en /s/<tienda>.

## v0.0.0 — 2026-09-22 · Primera versión de Ecommy

### Agregado

- Base de datos completa en Supabase con seguridad por filas (RLS) en todas las tablas.
- Acceso al panel con email y contraseña, alta del primer dueño y aprobación de cuentas nuevas.
- Panel de administración con navegación lateral, buscador rápido (Ctrl+K) y diseño propio.
- Catálogo con productos, variantes, imágenes, categorías e inventario con historial de movimientos.
- Pedidos con número correlativo, seguimiento público por enlace secreto, pagos y línea de tiempo.
- Clientes con historial de compras y total gastado.
- Motor de precios: promociones, cupones, descuento por método de pago y envío gratis desde un monto.
- Checkout sin pasarela: transferencia bancaria con descuento o coordinación por WhatsApp.
- Zonas de envío por polígono, provincia o código postal, y puntos de retiro.
- Apariencia de la tienda: 5 estilos prearmados, colores, tipografías de Google Fonts, radios y botones.
- Constructor de páginas por bloques (portada, carruseles, banners, texto y más).
- Menús de encabezado y pie editables.
- Importación del catálogo desde otras tiendas.
- Configuración general, usuarios con roles, registro de auditoría y este changelog.
- Configuración de la tienda, pagos y checkout con validación de CBU, alias y CUIT, y plazo de reserva de stock.
- Impuestos y legales: precio sin impuestos nacionales, Defensa del Consumidor, Data Fiscal y plantillas de políticas para Argentina.
- SEO global, Google Analytics 4, Tag Manager, Meta Pixel, modo mantenimiento y redirecciones 301 con importación CSV.
- Exportación CSV de productos, inventario, pedidos, clientes y auditoría.
