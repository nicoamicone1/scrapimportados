# Auditoría UX/UI v0.6.0 — índice

> Fecha: 2026-10-01. Vara de medida: [`BRAND.md`](BRAND.md) (§11 principios de UX y §13 checklist de marca) y [`DESIGN.md`](DESIGN.md).
> Cada informe lista, por pantalla, el objetivo, el diagnóstico (qué está bien, qué no y por qué), los cambios hechos y los pendientes con prioridad.

| Área | Informe | Alcance |
| --- | --- | --- |
| Marca | [`BRAND.md`](BRAND.md) | Propósito, personalidad, voz, logo, color, tipografía, forma, movimiento, componentes, principios de UX y checklist |
| Landing y plataforma | [`ux-audit/landing-plataforma.md`](ux-audit/landing-plataforma.md) | Home, planes, ayuda y guías, legales, login, registro, crear tienda, Mis tiendas, invitación y consola de plataforma |
| Shell del admin | [`ux-audit/admin-shell.md`](ux-audit/admin-shell.md) | Tokens, sidebar, topbar, barra inferior mobile, Inicio, palette, banners de plan y componentes `ui` |
| Catálogo | [`ux-audit/admin-catalogo.md`](ux-audit/admin-catalogo.md) | Productos, categorías, inventario, precios masivos, importar, promociones y cupones |
| Operación | [`ux-audit/admin-operacion.md`](ux-audit/admin-operacion.md) | Pedidos, remitos, clientes, envíos, usuarios, configuración, plan, compartir, auditoría, novedades y menús |
| Presets y Apariencia | [`ux-audit/presets-apariencia.md`](ux-audit/presets-apariencia.md) | Los 10 presets (contraste, rubro, diferenciación), galería y editor de tema, builder de páginas y storefront |

## Pendientes P0 (no resueltos en esta versión)

| # | Pendiente | Por qué quedó afuera |
| --- | --- | --- |
| 1 | **Legal:** validar que aceptar los términos por aviso junto al botón (sin checkbox) alcanza en el registro. | Decisión legal del dueño; volver al checkbox es una línea en `registro`. |
| 2 | **Crédito "Hecho con Ecommy" al bajar a Free:** si la tienda lo apagó en un plan pago, sigue apagado hasta que guarde Apariencia. | Requiere una RPC pública (`store_credit_required`) o que billing lo vuelva a prender al pasar a Free. |
| 3 | **Pedido de mostrador sin cliente** ("Consumidor final"). | Requiere cliente opcional en la server action `createManualOrder`. |
| 4 | **Importar CSV con mapeo de columnas.** Hoy los encabezados son fijos. | Cambio de flujo y de parser; merece su propia versión. |
| 5 | **Importación en el servidor.** Hoy avanza sólo con la pestaña abierta. | Requiere worker/cron. |
| 6 | **Acción masiva sobre todos los resultados filtrados** (no sólo los 50 de la página). | Requiere actions que reciban filtros en vez de ids. |
| 7 | **Medir LCP mobile con Archivo en el h1** de la landing; si empeora más de 100 ms, volver a la fuente del sistema (BRAND §6). | Necesita medición en producción. |
