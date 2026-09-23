# Changelog

Espejo de `src/lib/version.ts` (la fuente única es ese archivo; `/admin/changelog` lee de ahí).

## v0.4.1 — 2026-09-23 · Kit de redes, CI y una landing más rápida

### Agregado

- Plataforma › Redes: piezas listas para Instagram y TikTok. Los 15 posts y reels y las 10 historias del kit se generan como imágenes de 1080 × 1080 y 1080 × 1920 con la marca, se descargan en PNG y tienen «Copiar texto» con gancho, texto, CTA y hashtags. Las que dependen de una grabación real se marcan «Completar antes de publicar» hasta que escribís el dato.
- Cada cambio del código pasa automáticamente por tipos, lint, tests y un build, más una recorrida del sitio público en computadora y en celular (páginas, SEO básico, links, sitemap, buscador de ayuda).

### Cambiado

- La página de inicio carga más rápido: las fuentes de las muestras de estilos se piden recién cuando la muestra se acerca en pantalla, y nada bloquea el primer render.
- El centro de ayuda y las guías se sirven como páginas estáticas desde la CDN; los íconos y las imágenes para compartir se cachean un día.

### Corregido

- Las imágenes para compartir el sitio ya no tienen espacios dobles entre palabras.

## v0.4.0 — 2026-09-23 · Cobro con MercadoPago, avisos de stock y promos 3x2

### Agregado

- Pagá tu plan con MercadoPago desde Plan: débito automático mensual con tarjeta o dinero en cuenta. El plan se activa cuando MercadoPago confirma el cobro (o con 7 días de gracia si autoriza antes de cobrar) y te llega un mail con la fecha del próximo cobro. «Cancelar renovación» te deja seguir hasta el fin del período pago y después la tienda pasa a Free sin borrar nada. Si MercadoPago no puede cobrar, Plan te avisa y te llega un mail.
- Panel de la plataforma: id del plan de MercadoPago por plan, estado de la suscripción de cada tienda y «Sincronizar con MercadoPago».
- «Avisame cuando haya stock»: en la ficha de un producto agotado el cliente deja su email y le llega un mail con el link y el precio cuando cargás stock. En Inventario › Avisos de stock ves quién espera cada producto y a quién ya se avisó.
- Promociones «Llevá X, pagá Y» (2x1, 3x2, 4x3…) y «N.ª unidad con descuento» (por ejemplo, 2.ª unidad al 50 %) para toda la tienda, categorías o productos. Las unidades se agrupan de a X de la más cara a la más barata y en cada grupo sale gratis la más barata. Las cards muestran el badge, la ficha «Llevá 3 y pagá 2» y el carrito, el checkout, el seguimiento, el remito y los mails muestran «Promociones por cantidad» como una línea del pedido, en pesos enteros.

### Cambiado

- El pedido de plan por WhatsApp sigue disponible al lado del pago con MercadoPago. Sólo el dueño puede pagar o cancelar la renovación.
- La sección Ofertas de la tienda incluye los productos con promociones por cantidad.
- El menú del panel resalta sólo la sección más específica (Inventario y Avisos de stock ya no se marcan a la vez).
- Requiere aplicar las migraciones 0015 a 0018 (en orden): cobro de planes, avisos de stock, promociones por cantidad y descuento a nivel pedido.

### Corregido

- El checkout valida en la base el descuento de las promociones por cantidad con la misma regla que la tienda, así nadie puede armar un pedido con más descuento del que corresponde.
- Un producto que sólo suma unidades para un 3x2 conserva su propia promoción, y sumar un producto barato ya no encarece el pedido.

## v0.3.0 — 2026-09-23 · Centro de ayuda, avisos de activación y seguridad

### Agregado

- Centro de ayuda en /ayuda con 14 artículos cortos y buscador: cargar e importar productos, cobrar, zonas de envío, personalizar la tienda, compartirla, medir, cumplir con los legales y manejar el plan y el equipo, con los nombres de cada pantalla tal como aparecen en el panel. «Ayuda» en el menú del panel y en el sitio.
- Guías en /guias para quien todavía no tiene tienda: vender por WhatsApp sin perder pedidos, botón de arrepentimiento, precio sin impuestos nacionales y cómo migrar la tienda sin perder Google.
- Avisos por mail a los dos días de crear la tienda si todavía no tiene productos, y a la semana si tiene productos pero no se compartió el link ni hubo pedidos (cuando la plataforma tiene configurado el envío).

### Cambiado

- El mail «Recibimos tu pedido» ya no repite la nota del comprador y sólo saluda por el nombre cuando es un nombre de verdad; en los avisos al vendedor, la nota y el motivo del comprador aparecen rotulados y recortados (el pedido completo sigue en el panel).
- Sólo el dueño o un administrador pueden pedir un cambio de plan, y el pedido llega una vez por día por plan.
- Mejoras de seguridad en el envío de emails (cupo de avisos por comprador y por tienda para que el checkout no sirva para mandar spam) y en las cabeceras del sitio. Requiere aplicar la migración 0014.

### Corregido

- El aviso «tu prueba terminó» siempre llega, aunque el mantenimiento diario haya corrido antes.
- Las páginas de la tienda no pueden llamarse icon, apple-icon ni opengraph-image (chocaban con el ícono del sitio).

## v0.2.0 — 2026-09-23 · Listos para el primer MVP público

### Agregado

- Sitio de Ecommy renovado: cómo funciona en tres pasos, muestras de los diez estilos por rubro, qué plan incluye cada función (calculado desde los planes publicados), ejemplo de un pedido sin comisión, preguntas frecuentes y contacto.
- Términos del servicio y política de privacidad (Ley 25.326) con índice y fecha de actualización, enlazados desde el pie y desde el registro; página de contacto con mail, WhatsApp y el plan Business a medida.
- Ícono de Ecommy en la pestaña y en la pantalla de inicio del celular, e imagen propia al compartir los links de Ecommy en WhatsApp y redes.
- Emails automáticos (cuando la plataforma tiene configurado el envío): al comprador cuando hace el pedido, se confirma el pago, se despacha o se cancela; al vendedor cuando entra un pedido o una solicitud de arrepentimiento; al dueño de la cuenta al crear la tienda y cuando la prueba de Pro está por terminar o terminó.
- Nueva sección Marketing › Compartir: tu link con «Copiar», el QR de tu tienda para descargar e imprimir, y mensajes listos para pegar en la bio de Instagram, para responder por WhatsApp y para historias, armados con tu descuento por transferencia y tu envío gratis si los tenés. También el link o el QR de un producto o categoría.
- Una franja arriba del panel te avisa cuántos días de prueba te quedan y, el último día, a qué hora termina. En Free, un recordatorio de los límites del plan que se puede cerrar por 7 días.
- En Configuración › Tienda, el email de contacto aclara que ahí llegan los avisos de pedidos y arrepentimientos.
- Medición del sitio de Ecommy con Google Analytics 4 y verificación de Search Console, configurables por variables de entorno.
- Documentación de marketing y lanzamiento (`docs/MARKETING.md`, `docs/LAUNCH-PLAN.md`, `docs/LAUNCH-CHECKLIST.md`, `docs/SOCIAL-KIT.md`).

### Cambiado

- El paso «Compartí el link de tu tienda» de los primeros pasos lleva a la nueva sección Compartir; copiar cualquier link desde ahí lo marca como hecho.
- Las preguntas frecuentes de Planes son las mismas que las de la página de inicio, y «Hablemos» del plan Business lleva a Contacto.

### Corregido

- Los links de términos y privacidad del registro llevaban a Planes.
- En hosts de tienda con subdominio o dominio propio, el ícono de la pestaña ya no da 404 cuando la tienda no cargó un favicon propio.
- La página de inicio de Ecommy ya no tiene scroll horizontal en celulares.

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
