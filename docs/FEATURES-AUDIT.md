# Ecommy: auditoría de funcionalidades frente a la competencia

> Fecha: 2026-09-22 · Alcance: admin y storefront de **Tiendanube, Shopify, Empretienda, WooCommerce y Jumpseller** comparados con `docs/ECOMMY-SPEC.md` (v0).
> Método: centros de ayuda y documentación oficiales (fuentes primarias). Normativa argentina tomada del Boletín Oficial. Cada fila o sección cita una fuente con un ID `[XX-nombre]`. El listado de IDs y URLs está en el §7.
> Este documento es para el orquestador y los agentes de features. **No modifica la spec**: propone cambios. Las decisiones que chocan con la spec están en el §6.

**Leyenda**

- Competidores: `✓` nativo · `App` mediante app o extensión (pagas o de terceros) · `~` parcial o con limitaciones · `✗` no existe · `s/d` sin dato verificado.
- ¿Está en la spec v0?: `Sí` (con §) · `Parcial` (hay modelo pero falta UI o regla) · `No`.
- Prioridad: **P0** imprescindible para vender desde el día 1 · **P1** esperable (v0.1–v0.2) · **P2** nice-to-have (v0.3+).
- Esfuerzo: **S** ≤ 1 día-agente · **M** 2–4 días · **L** más de 4 días o con dependencias externas.
- Agentes (§10 de la spec): A catálogo/inventario · B pedidos/clientes/dashboard · C precios/promos/cupones · D envíos · E builder/apariencia/menús · S storefront · G importación · H configuración/usuarios/auditoría/CSV · F fundación (migraciones compartidas).

---

## 0. Resumen ejecutivo

1. La spec v0 ya cubre el **núcleo operativo** (variantes, inventario con movimientos, precios masivos con undo, promos, cupones, pedidos con timeline y pagos parciales, zonas por polígono, builder, auditoría). En varios puntos supera a Tiendanube: polígonos de envío, undo de precios masivos, scraping de catálogos y checkout por WhatsApp integrado.
2. Los huecos de la spec **no están en el core, están en los bordes**: SEO técnico (sitemap, robots, 301, JSON-LD y OG para compartir en WhatsApp e Instagram), cumplimiento legal argentino (botón de arrepentimiento, precio sin impuestos nacionales, Data Fiscal, link a Defensa del Consumidor), operación diaria (imprimir remito, CSV de ida y vuelta, vencimiento de pedidos impagos que hoy dejarían el stock trabado) y conversión (precio con descuento por transferencia visible en el listado, WhatsApp flotante, barra de envío gratis, filtros por talle y color).
3. Encontramos **20 gaps P0** (§2). Casi todos son S. Los únicos M son el CSV import/export, la transparencia fiscal y el vencimiento de pedidos impagos.
4. El mayor riesgo de producto es la **reserva de stock sin vencimiento**. Con `inventory_policy = 'on_order'`, cada pedido por transferencia que nunca se paga descuenta stock para siempre (§2, gap P0-06).
5. El mayor riesgo legal es vender en Argentina sin **botón de arrepentimiento** (Res. SCI 424/2020) ni **precio sin impuestos nacionales** (Ley 27.743 y Res. SIC 4/2025) [AR-424] [AR-4-2025].

---

## 1. Tabla comparativa por área

### 1.1 Catálogo

| Funcionalidad | Tiendanube | Shopify | Otros | Spec v0 | Prio | Esf | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Variantes por opciones (Color × Talle) con precio, stock, SKU e imagen por variante | ✓ | ✓ | JS ✓ | Sí §3.3 | P0 | — | [JS-product] |
| Estados del producto (borrador, activo, archivado, oculto) | ✓ "Mostrar en la tienda" | ✓ Active, Draft, Unlisted | — | Sí §3.3 (sin "unlisted") | P0 | — | [TN-ocultar] [SH-add] |
| Duplicar producto (con opción de copiar fotos) | ✓ | ✓ (elige qué copiar) | — | No | P0 | S | [TN-duplicar] [SH-add] |
| Vista previa de un producto sin publicar | s/d | ✓ | — | No | P0 | S | [SH-add] |
| Campos personalizados o metafields (ficha técnica, material, temporada) | ✓ | ✓ tipados y con validaciones | JS ✓ (usables como filtros) | Parcial: `metadata jsonb` sin UI | P0 ficha / P1 definiciones | S / M | [TN-campos] [SH-metafields] [JS-custom] |
| Productos relacionados: alternativos y complementarios | ✓ ambos tipos | ✓ hasta 10 complementarios | JS ✓ | No | P0 auto / P1 manual | S | [TN-relacionados] [SH-reco] |
| Categorías jerárquicas y producto en varias categorías | ✓ | ✓ colecciones | — | Sí §3.3 | P0 | — | [TN-categorias] |
| Colecciones automáticas por reglas (tag, precio, stock) | s/d | ✓ hasta 60 condiciones | — | Parcial: bloques por tag, oferta o novedades §9 | P2 | M | [SH-smart] |
| Botón "Consultar precio" o modo catálogo sin precio | ✓ | App | JS ✓ "Available to quote" | No | P2 | S | [TN-consultar] [TN-restringir] [JS-product] |
| Mínimo y máximo de unidades por producto | s/d | App | JS ✓ | No | P2 | S | [JS-product] |
| Producto digital o servicio | s/d | ✓ | JS ✓ | No | P2 | M | [JS-product] |
| Historial de cambios del producto | ✓ | ✓ timeline | — | Sí §3.9 `audit_log` | P1 | — | [TN-histprod] |
| Edición inline de precio y stock en el listado | ✓ | ✓ bulk editor tipo planilla | — | Parcial: acciones masivas §5 | P0 inline / P1 planilla | S / M | [TN-inline] [SH-bulkedit] |
| Importar y exportar productos por CSV | ✓ hasta 20.000 filas, no en plan gratis | ✓ plantilla oficial, UTF-8, 15 MB | EM ✓ | Parcial: H "exportaciones CSV" sin detalle; G sólo scraping | **P0** | M | [TN-csv] [TN-csvfaq] [SH-csv] |
| Importar desde otra tienda (scraping o API pública) | ✗ (migración asistida) | App | — | Sí §3.8 (diferencial) | P1 | — | [TN-migrar] |

### 1.2 Inventario

| Funcionalidad | Tiendanube | Shopify | Otros | Spec v0 | Prio | Esf | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Stock por variante, ilimitado o no seguido | ✓ | ✓ | EM ✓ (vacío = infinito) | Sí `track_inventory` | P0 | — | [EM-productos] |
| Historial de movimientos: quién, cuándo, por qué | ✓ | ✓ | — | Sí `inventory_movements` | P0 | — | [TN-historial] [SH-invhistory] |
| Umbral y alerta de stock bajo | ✓ | App | WC ✓ email · JS ✓ email | Parcial: umbral sin aviso | P0 (aviso en el admin) | S | [TN-historial] [WC-inventory] [JS-inventory] |
| Ocultar agotados o mandarlos al final del listado | ✓ ambas | ~ tema | WC ✓ | No | **P0** | S | [TN-ocultarsinstock] [TN-sinstockfinal] [WC-inventory] |
| Reserva de stock con vencimiento de pedidos impagos | ~ sólo Pago Nube (24 h a 3 días) | ✓ draft reserve | WC ✓ "Hold stock (minutes)" | **No** | **P0** | M | [TN-pendiente] [TN-cancelauto] [WC-inventory] |
| Estados de stock: disponible, comprometido, no disponible, entrante | s/d | ✓ | — | No | P2 | L | [SH-invstates] |
| Exportar e importar inventario por CSV (por SKU) | ✓ vía CSV de productos | ✓ | — | No | **P0** (junto al CSV) | S | [SH-invcsv] [TN-stockedit] |
| "Avisame cuando haya stock" | App | App | WC ext · JS ✓ (Pro) | No | P1 | S/M | [TN-avisostock] [WC-backinstock] [JS-backinstock] |
| Multi-depósito o sucursales con stock propio | s/d | ✓ | — | No | P2 | L | [SH-invstates] |

### 1.3 Precios y promociones

| Funcionalidad | Tiendanube | Shopify | Otros | Spec v0 | Prio | Esf | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Precio de lista y precio tachado (compare-at) | ✓ | ✓ | ✓ | Sí §3.3 | P0 | — | [JS-product] |
| Costo y margen | s/d | ✓ | JS ✓ | Sí `cost` (margen: mostrarlo) | P1 | S | [JS-product] |
| Actualización masiva de precios (%, monto, redondeo) | ✓ | ✓ bulk editor | — | Sí §3.4 + undo (diferencial) | P0 | — | [TN-preciosmasivo] |
| Promos % o monto por tienda, categoría o producto, con vigencia | ✓ | ✓ automáticas | EM ✓ | Sí §3.4 | P0 | — | [TN-lxpy] [SH-discounts] |
| "Llevá X, pagá Y" (2x1, 3x2, 4x3) y 2.ª unidad al X % | ✓ | ✓ Buy X get Y | EM ✓ | No | **P1 alta** | M | [TN-lxpy] [SH-bxgy] [EM-cupones] |
| Descuento por cantidad y precio mayorista | ✓ tablas de precios | App (B2B en Plus) | EM ✓ | No | P1 | M | [TN-mayorista] [EM-mayorista] |
| Cupones: %, monto, envío gratis, límites, primera compra | ✓ | ✓ | EM ✓ | Sí §3.4 | P0 | — | [SH-discounts] [EM-cupones] |
| Descuento por medio de pago (transferencia) | ✓ | ✗ nativo | EM ✓ | Sí `payment_methods.discount_percent` | P0 | — | [TN-transfdesc] [EM-transf] |
| Precio con descuento por transferencia en card y ficha de producto | ✓ | ✗ | EM ✓ | Parcial: sólo en checkout §7.3 | **P0** | S | [TN-preciodesc] [EM-transf] |
| Reglas de combinación (medio de pago + promo + cupón) | ✓ configurable | ✓ | — | Parcial: `stackable` sólo entre promos | P1 | S | [TN-combinable] [SH-combine] |
| "Precio sin impuestos nacionales" (IVA por producto) | ✓ gratis en todos los planes | ✗ (no AR) | — | **No** | **P0 legal** | M | [TN-sinimp] [AR-4-2025] |

### 1.4 Pedidos

| Funcionalidad | Tiendanube | Shopify | Otros | Spec v0 | Prio | Esf | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Estado del pedido y estado del pago por separado | ✓ | ✓ | JS ✓ | Sí §3.5 | P0 | — | [JS-orders] |
| Pedido manual (venta por WhatsApp o en el local) que descuenta stock | ✓ | ✓ draft orders con precio editable | EM ✓ "Agregar venta" | Sí (B, `source='manual'`) | P0 | — | [TN-manual] [SH-draft] [EM-agregarventa] |
| Timeline con notas internas y notas visibles al cliente | ~ | ✓ comentarios, @menciones, adjuntos | WC ✓ nota privada o al cliente | Sí `order_events.visible_to_customer` | P0 | — | [SH-timeline] [WC-orders] |
| Editar ítems de un pedido ya creado | ✓ | ✓ | WC ✓ | No | P1 | M | [TN-editventa] [SH-editorder] |
| Cancelar o reabrir con reposición de stock | ✓ | ✓ | — | Sí (motivo `cancel`); reabrir no | P1 (reabrir) | S | [TN-cancelar] [TN-reabrir] |
| Imprimir remito o comprobante interno, individual y masivo | ✓ | ✓ packing slips + Order Printer (50 por tanda) | — | **No** | **P0** | S | [TN-remito] [SH-packing] [SH-orderprinter] |
| Etiquetas de correo (OCA, Andreani, Envío Nube) | ✓ | ✓ (no AR) | — | No | P2 | L | [TN-oca] |
| Filtros y vistas guardadas | ✓ filtros | ✓ vistas guardadas | — | Parcial (filtros §5) | P2 | S | [SH-views] |
| Exportar pedidos a CSV | ✓ | ✓ | — | Parcial (H) | **P0** | S | [TN-expventas] |
| Carritos o checkouts abandonados | ✓ (desde el paso de pago, 30 días) | ✓ email automático | JS ✓ | No | P1 | M | [TN-abandonados] [SH-abandoned] [JS-abandoned] |
| Aviso de pedido nuevo al vendedor | ✓ email | ✓ email y push | ✓ | No (emails fuera de alcance §12) | **P0** (en el admin) | S | [TN-usuarios] |
| Página pública de seguimiento del pedido | ✓ | ✓ | — | Sí §7.5 | P0 | — | [TN-seguimiento] |

### 1.5 Clientes

| Funcionalidad | Tiendanube | Shopify | Otros | Spec v0 | Prio | Esf | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ficha de cliente con pedidos, total gastado, notas y tags | ✓ | ✓ | — | Sí §3.5 | P0 | — | [SH-segments] |
| Exportar e importar clientes por CSV | ✓ | ✓ | — | Parcial (H) | P1 | S | [TN-expclientes] [TN-impclientes] |
| Segmentos dinámicos | s/d | ✓ | — | No | P2 | M | [SH-segments] |
| Cuentas de cliente con login | ✓ | ✓ | ✓ | No (§12) | P2 | L | — |
| Bandeja de solicitudes de arrepentimiento | ✓ (Clientes > Mensajes) | ✗ | — | **No** | **P0 legal** | S | [TN-arrep] |

### 1.6 Envíos

| Funcionalidad | Tiendanube | Shopify | Otros | Spec v0 | Prio | Esf | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Zonas por provincia o código postal con costo fijo | ✓ | ✓ | — | Sí §3.6 | P0 | — | [SH-local] |
| Zonas por radio o polígono dibujado | s/d | ~ sólo radio (hasta 160 km) o CP | — | Sí polígono (diferencial) | P0 | — | [SH-local] |
| Retiro en el local | ✓ | ✓ | — | Sí §3.6 | P0 | — | [SH-pickup] |
| Envío gratis desde un monto | ✓ | ✓ | — | Sí `free_over` | P0 | — | [TN-envgratis] |
| Barra o contador "te faltan $X para envío gratis" | ✓ | ~ tema | — | **No** | **P0** | S | [TN-contador] |
| Mínimo de compra por zona | s/d | ✓ | — | No (sólo global) | P2 | S | [SH-local] |
| Cotización e integración con correos | ✓ | ✓ | — | No | P2 | L | [TN-oca] |

### 1.7 Pagos y checkout

| Funcionalidad | Tiendanube | Shopify | Otros | Spec v0 | Prio | Esf | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pago manual con instrucciones (transferencia o depósito) | ✓ medio personalizado | ✓ manual payment methods | WC ✓ BACS · EM ✓ | Sí §3.2 y §7 | P0 | — | [TN-transfcfg] [SH-manualpay] [WC-bacs] [EM-transf] |
| Monto mínimo de compra | ✓ | ✗ nativo | EM ✓ (mayorista) | Sí `min_order_total` | P0 | — | [TN-minimo] |
| Checkout que deriva a WhatsApp con el pedido armado | App | App | — | Sí (diferencial) | P0 | — | [TN-wa] |
| El comprador sube el comprobante desde la web | ✗ para el comprador | ✗ | ✗ | Parcial: `receipt_url` sólo desde el admin | P1 | M | [EM-transf] |
| Link de pago externo (Mercado Pago) cargado a mano en el pedido | ~ | ✓ invoice de draft order | — | No | P1 | S | [SH-draft] |
| Botón de arrepentimiento (obligatorio en AR) | ✓ en todas las tiendas AR | ✗ | — | **No** | **P0 legal** | S | [TN-arrep] [AR-424] |
| Compra rápida (saltar el carrito) | ✓ | ✓ Buy it now | — | No | P2 | S | [TN-comprarapida] |
| Cuotas informativas | ✓ (con pasarela) | s/d | — | No | P2 (exige CFT) | S | [AR-4-2025] |

### 1.8 Contenido y diseño

| Funcionalidad | Tiendanube | Shopify | Otros | Spec v0 | Prio | Esf | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Editor de tema con vista previa y borrador | ✓ diseño en borrador | ✓ | — | Sí §8 | P0 | — | [TN-borrador] |
| Constructor de páginas por bloques y landings | ~ | ✓ secciones | — | Sí §9 | P0 | — | — |
| Menús de header y footer | ✓ | ✓ | — | Sí §3.2 | P0 | — | — |
| Políticas con plantilla generada (devoluciones, privacidad, términos, envíos) | s/d | ✓ "Insert template" | — | Parcial: `policies` en markdown vacío | **P0** (plantillas AR) | S | [SH-policies] |
| Botón flotante de WhatsApp | ✓ (no se muestra en el checkout) | App | — | **No** | **P0** | S | [TN-wa] |
| Barra de anuncios y modo mantenimiento | ✓ | ✓ | — | Sí §3.2 | P0 | — | — |
| Blog | s/d | ✓ | — | No | P2 | M | — |

### 1.9 Marketing

| Funcionalidad | Tiendanube | Shopify | Otros | Spec v0 | Prio | Esf | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cupones y promos con badge | ✓ | ✓ | ✓ | Sí §3.4 | P0 | — | [TN-lxpy] |
| Cross-sell al agregar al carrito | App "Venta Cruzada" | ✓ complementarios | — | No | P1 | S | [TN-crosssell] [SH-reco] |
| Recuperación de carritos abandonados | ✓ (+ Marketing Nube) | ✓ | JS ✓ | No | P1 | M | [TN-abandonados] [SH-abandoned] |
| Feed de catálogo para Google Merchant o Meta (Instagram Shopping) | ✓ / App | ✓ canal | — | No | P1 | S | [SH-pixels] |
| Popup o newsletter | App | App | — | No (§9) | P2 | S | — |

### 1.10 SEO

| Funcionalidad | Tiendanube | Shopify | Otros | Spec v0 | Prio | Esf | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Título SEO (70) y meta descripción (160) por producto y categoría | ✓ (+ IA) | ✓ con vista previa de buscador | JS ✓ | Parcial: `seo jsonb` sin vista previa ni contador | **P0** | S | [TN-seo] [SH-seo] [JS-product] |
| URL (slug) editable | ✓ | ✓ | JS ✓ | Sí | P0 | — | [TN-seo] |
| Redirecciones 301 (manuales y al cambiar el slug) | ✓ | ✓ hasta 100.000 | — | **No** | **P0** | S | [TN-301] [SH-redirect] |
| sitemap.xml automático | ✓ | ✓ | — | **No** | **P0** | S | [SH-sitemap] |
| robots.txt | ✓ | ✓ editable | — | **No** | **P0** | S | [SH-robots] |
| Datos estructurados (JSON-LD Product/Offer) y Open Graph por producto | ✓ tema | ✓ tema | — | No explícito ("SEO" en S) | **P0** | S | [SH-seo] |
| Ocultar una página de los buscadores (noindex) | s/d | ✓ | — | No | P1 | S | [SH-noindex] |

### 1.11 Analítica

| Funcionalidad | Tiendanube | Shopify | Otros | Spec v0 | Prio | Esf | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard de ventas, facturación y ticket promedio | ✓ (varía según plan) | ✓ | — | Sí (B) | P0 | — | [TN-stats] |
| Visitas y tasa de conversión | ✓ | ✓ | — | No | P2 | M | [TN-stats] |
| GA4, GTM y Meta Pixel cargando sólo el ID | ✓ "Códigos externos" | ✓ pixels | — | **No** (§12 excluye "analytics integrados") | **P0** | S | [TN-ga4] [TN-gtm] [TN-pixel] [SH-pixels] |

### 1.12 Configuración y cumplimiento (Argentina)

| Funcionalidad | Tiendanube | Shopify | Otros | Spec v0 | Prio | Esf | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Datos de la tienda, contacto, redes, logo y favicon | ✓ | ✓ | ✓ | Sí §3.2 | P0 | — | — |
| QR de Data Fiscal (ARCA F960/D) en el footer | ✓ | ✗ | — | **No** | **P0 legal** | S | [TN-datafiscal] |
| Link "Defensa de las y los consumidores" en el footer | ✓ fijo para AR | ✗ | — | **No** | **P0 legal** | S | [TN-defcons] |
| Alícuota de IVA por defecto y excepciones por producto | ✓ | ✓ impuestos | — | **No** | **P0 legal** | M | [TN-sinimp] |

### 1.13 Usuarios y permisos

| Funcionalidad | Tiendanube | Shopify | Otros | Spec v0 | Prio | Esf | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Varios usuarios con alta, baja y edición | ✓ | ✓ | — | Sí §3.1 | P0 | — | [TN-usuarios] |
| Permisos por sección (ventas, estadísticas, clientes) | ✓ (según plan) | ✓ roles a medida | — | Parcial (owner, admin, staff) | P1 | M | [TN-usuarios] [SH-roles] |
| Registro de auditoría | ~ historial de producto y stock | ~ timeline | — | Sí §3.9 (diferencial) | P1 | — | [TN-histprod] |

### 1.14 Integraciones

| Funcionalidad | Tiendanube | Shopify | Otros | Spec v0 | Prio | Esf | Fuente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| API pública y webhooks | ✓ | ✓ | ✓ | No | P2 | L | — |
| Pasarela (Mercado Pago, Pago Nube) | ✓ | ✓ | ✓ | No (§12) | P2 (v0.3) | L | [TN-cancelauto] |
| Facturación electrónica ARCA | App | App | — | No (§12) | P2 | L | [TN-datafiscal] |
| Correos argentinos (OCA, Andreani, Correo Argentino) | ✓ | s/d | — | No | P2 | L | [TN-oca] |

---

## 2. Gaps P0 para la v0

Son funcionalidades que la spec **no cubre** y que un comercio espera desde el día 1, o que la ley exige. Cada gap indica qué es, por qué importa, cómo lo resuelve la competencia, una implementación mínima y el agente responsable. Las migraciones van en un `0002_features_audit.sql` coordinado por F, o una por agente siguiendo la numeración.

### P0-01 · SEO técnico: sitemap.xml y robots.txt — **S** · Agente **S**
- **Qué:** `/sitemap.xml` con productos activos, categorías visibles y páginas publicadas (`lastmod = updated_at`, imagen principal). `/robots.txt` que bloquee `/admin`, `/api`, `/carrito`, `/checkout`, `/pedido/*` y `/buscar`, y apunte al sitemap.
- **Por qué:** sin sitemap, Google tarda semanas en indexar un catálogo nuevo. Sin robots, se indexan checkout y pedidos.
- **Competencia:** Shopify los genera y actualiza solos [SH-sitemap] [SH-robots].
- **Propuesta:** `src/app/sitemap.ts` y `src/app/robots.ts` (convención de metadata de Next; leer `node_modules/next/dist/docs/` antes). Base URL tomada de `NEXT_PUBLIC_SITE_URL`. Con `maintenance.enabled`, robots devuelve `Disallow: /`.

### P0-02 · Redirecciones 301 — **S** · Agentes **H** (UI y tabla) + **A** (alta automática) + **F/S** (`proxy.ts`)
- **Qué:** una tabla de redirecciones. Cuando cambia el slug de un producto, categoría o página, se crea sola la redirección vieja → nueva.
- **Por qué:** Ecommy importa catálogos existentes (G) y reemplaza tiendas previas. Sin 301 se pierde el posicionamiento y los links que ya circulan por WhatsApp e Instagram quedan rotos.
- **Competencia:** Tiendanube en Configuración > Redireccionamientos 301, rutas relativas [TN-301]. Shopify ofrece hasta 100.000 y un checkbox "crear redirect" al cambiar el handle [SH-redirect].
- **Propuesta:** tabla `redirects(id, from_path text unique, to_path text, hits int default 0, created_at)` con RLS de lectura pública. En `proxy.ts` (o en `not-found` del storefront, más barato: sólo consulta cuando hay 404) se busca `from_path` y se devuelve `permanentRedirect`. Pantalla `admin/configuracion/redirecciones` con lista, alta, baja e importación CSV `from,to`. En la action de A que actualiza el slug: `insert into redirects` si cambió.

### P0-03 · SEO por producto y categoría con vista previa, JSON-LD y Open Graph — **S** · Agentes **A** + **E** (UI) + **S** (render)
- **Qué:** campos título (≤ 70) y descripción (≤ 160) con contador y **vista previa tipo resultado de Google**. En el storefront: `generateMetadata` con OG y Twitter card (imagen 1200×630 o la principal del producto), `<script type="application/ld+json">` con `Product`, `Offer` (precio final con promo, `availability`), `BreadcrumbList`, y `Organization` en la home.
- **Por qué:** el canal principal de las pymes es compartir links por WhatsApp e Instagram. Sin OG, el link sale sin foto ni precio. JSON-LD habilita los resultados enriquecidos con precio y stock.
- **Competencia:** Tiendanube, 70/160 caracteres y generación con IA [TN-seo]. Shopify, "Search engine listing preview" [SH-seo].
- **Propuesta:** componente compartido `components/admin/SeoFields.tsx` (título, descripción, slug y vista previa con fallback al nombre y la descripción corta), usado por A (productos y categorías), E (páginas) y H (SEO global). Helpers `lib/store/seo.ts` con `productJsonLd()` y `buildMetadata()` para S.

### P0-04 · Importar y exportar CSV de productos, variantes e inventario — **M** · Agentes **H** (export) + **G** (import)
- **Qué:** exportar a CSV una fila por variante (handle o slug, nombre, estado, categorías, tags, opción 1 y 2 con valores, SKU, precio, precio tachado, costo, stock, peso, imagen, título y descripción SEO). Importar el mismo formato en dos modos: **actualizar por SKU** (precio, precio tachado, costo, stock, estado) y **crear productos**. Antes de aplicar, una vista previa con el diff y los errores por fila.
- **Por qué:** con inflación, la lista de precios del proveedor llega en Excel todas las semanas. Es el flujo número 1 de edición masiva en Tiendanube.
- **Competencia:** Tiendanube, "Importar y exportar", CSV delimitado por comas, hasta 20.000 filas [TN-csv] [TN-csvfaq]. Shopify, plantilla oficial con sólo `Title` obligatorio, UTF-8, 15 MB [SH-csv]. Inventario por CSV aparte [SH-invcsv].
- **Propuesta:** reutilizar `import_jobs` e `import_items` con `adapter = 'csv'` (G ya tiene la UI de jobs, el log y los stats). Parser con `papaparse`. El stock se mueve **siempre** con `adjust_stock(..., 'import')` y los precios se loguean en `price_changes` con `batch_id` (así el undo de C también cubre el CSV). Export como Route Handler `GET /admin/api/export/products.csv` en streaming. Exportar pedidos y clientes también es de H (P0 export de pedidos, P1 clientes).

### P0-05 · Imprimir remito o comprobante de pedido — **S** · Agente **B**
- **Qué:** una vista imprimible (A4 y térmica de 80 mm) con logo, número, fecha, datos del cliente, dirección o retiro, ítems con SKU y variante, totales, método de pago, notas del cliente y un QR hacia `/pedido/[token]`. Individual y masiva (seleccionar pedidos y "Imprimir").
- **Por qué:** el vendedor arma paquetes con el papel en la mano. Es el pedido número 1 después de "ver pedidos".
- **Competencia:** Tiendanube imprime recibo o remito de control interno, también masivo [TN-remito]. Shopify tiene packing slips en el admin y Order Printer hasta 50 pedidos [SH-packing] [SH-orderprinter].
- **Propuesta:** ruta `admin/(panel)/pedidos/imprimir?ids=...` con CSS `@media print`, sin chrome del admin, y `window.print()`. Genera un evento `order_events` de tipo `printed` (agregarlo al check). Sin librería de PDF: "Guardar como PDF" del navegador, igual que Order Printer.

### P0-06 · Vencimiento de pedidos impagos (reserva de stock) — **M** · Agentes **B** + **F** (SQL) + **H** (config)
- **Qué:** un plazo configurable (por ejemplo 48 h) para pedidos `pending` con `payment_status = 'pending'`. Al vencer, el pedido pasa a `cancelled` con `cancel_reason = 'expired'` y el stock vuelve con `adjust_stock(..., 'cancel')`.
- **Por qué:** con `inventory_policy = 'on_order'`, cada pedido abandonado después de ver los datos bancarios **traba stock para siempre**, y los productos aparecen agotados sin estarlo.
- **Competencia:** WooCommerce, "Hold stock (minutes)" [WC-inventory]. Tiendanube con Pago Nube: 24 h a 3 días y cancelación automática con devolución de stock [TN-pendiente] [TN-cancelauto]. Jumpseller devuelve el stock cuando el pedido pasa a abandonado [JS-orders].
- **Propuesta:** `store_settings.checkout.reservation_hours int default 48` (0 = nunca). Columna `orders.expires_at` que calcula `create_order`. Función SQL `expire_unpaid_orders()` (security definer). La ejecución: si Supabase tiene `pg_cron`, cada 15 min; si no, un **barrido perezoso** (lo llaman las lecturas del listado de pedidos y del dashboard, y `create_order`). El admin ve "Vence en 5 h" en el listado y puede "Extender 24 h". En `/pedido/[token]`: "Te reservamos el stock hasta el jueves 18:00".

### P0-07 · Aviso de pedido nuevo en el admin — **S** · Agente **B**
- **Qué:** un badge con los pedidos nuevos no vistos en el sidebar y en la pestaña (`(3) Pedidos`), sonido opcional y notificación del navegador (Notification API) mientras el admin está abierto.
- **Por qué:** los emails están fuera de alcance (§12). Hoy el vendedor sólo se entera si el cliente le escribe por WhatsApp. En transferencia el cliente puede no escribir nunca.
- **Competencia:** Tiendanube, Shopify y Jumpseller avisan por email o push [TN-usuarios] [JS-emails].
- **Propuesta:** `orders.seen_at timestamptz null` (o `profiles.last_orders_seen_at`). Supabase Realtime sobre `orders` (INSERT) si RLS lo permite para `is_admin()`. Fallback: polling cada 60 s desde el layout del panel. P1: email al owner con un proveedor transaccional.

### P0-08 · Alertas de stock bajo y agotados — **S** · Agente **A** (+ **B** dashboard)
- **Qué:** un filtro "Stock bajo" y "Agotado" en el inventario, un widget en el dashboard con las variantes bajo el umbral y un contador en el sidebar.
- **Por qué:** la spec define `low_stock_threshold` pero no dónde se ve el aviso.
- **Competencia:** Tiendanube, alertas cerca de cero [TN-historial]. WooCommerce y Jumpseller mandan email [WC-inventory] [JS-inventory].
- **Propuesta:** vista SQL `low_stock_variants` (`stock <= coalesce(v.low_stock_threshold, settings.low_stock_threshold)` y `track_inventory`). El widget es de B y el filtro de A.

### P0-09 · Visibilidad de productos agotados — **S** · Agentes **H** (setting) + **S**
- **Qué:** un setting `inventory.out_of_stock_display: 'show' | 'show_last' | 'hide'`. La ficha muestra "Sin stock" con el botón deshabilitado, o "Consultar por WhatsApp", en vez de desaparecer.
- **Por qué:** con catálogos scrapeados es común tener muchos agotados que ensucian la grilla.
- **Competencia:** Tiendanube permite ocultarlos o mandarlos al final [TN-ocultarsinstock] [TN-sinstockfinal]. WooCommerce, "Out of stock visibility" [WC-inventory].
- **Propuesta:** el campo en `store_settings` (jsonb nuevo `catalog`). `listProducts` ordena por `in_stock desc` o filtra según el setting.

### P0-10 · Filtros por talle, color y atributos en el listado — **S/M** · Agente **S** (+ **A** para la ficha técnica)
- **Qué:** filtros facetados en `/productos` y `/categoria/[slug]` construidos desde `product_variants.option_values` (Talle, Color), con conteo y "sólo con stock", más marca y rango de precio.
- **Por qué:** en indumentaria y calzado, que es el catálogo semilla (DAZ), "¿hay en mi talle?" es el primer filtro.
- **Competencia:** Tiendanube, filtros personalizados en el listado [TN-filtros]. Shopify, filtros por opción y metafield [SH-filters] [SH-mfilter]. Jumpseller convierte opciones y campos de selección en filtros [JS-filters]. En WooCommerce el filtro nativo requiere atributos globales [WC-attributes].
- **Propuesta:** query params `?talle=M&color=Negro&marca=...`. Índice GIN en `product_variants.option_values`. Función SQL o query en `lib/store/products.ts` que devuelve las facetas disponibles de la categoría (valores distintos de las variantes activas con stock). Swatches de color: P1.

### P0-11 · Ficha técnica (atributos simples) — **S** · Agentes **A** + **S**
- **Qué:** una lista clave-valor por producto (Material: Algodón, Origen: Argentina, Cuidado: Lavar a 30°) que se muestra como tabla en la ficha y viaja en el CSV y en JSON-LD (`additionalProperty`).
- **Por qué:** es la versión mínima de los metafields, que tienen todas las plataformas. Evita que el vendedor lo meta a mano en la descripción.
- **Competencia:** campos personalizados de Tiendanube [TN-campos], metafields tipados de Shopify [SH-metafields], custom fields de Jumpseller [JS-custom].
- **Propuesta:** `products.specs jsonb default '[]'` (`[{label, value}]`), un editor de filas en el form de A y "Copiar ficha de otro producto". Definiciones tipadas y filtrables por spec: P1.

### P0-12 · Productos relacionados (automático + manual) — **S** · Agentes **S** (auto) + **A** (manual)
- **Qué:** una sección "También te puede interesar" en la ficha. Automático: misma categoría, luego mismos tags, excluyendo el producto actual y los agotados. Manual opcional: elegir productos.
- **Por qué:** es la herramienta de ticket promedio más barata y está en todos los temas de Tiendanube.
- **Competencia:** Tiendanube separa alternativos y complementarios [TN-relacionados]. Shopify, hasta 10 complementarios [SH-reco].
- **Propuesta:** v0 automático (sin schema) en `lib/store/products.ts#getRelated(productId, limit)`. Manual: `products.related_ids uuid[] default '{}'` con un picker en A. Si hay manuales, tienen prioridad.

### P0-13 · Duplicar producto y vista previa sin publicar — **S** · Agentes **A** + **S**
- **Qué:** "Duplicar" desde el detalle y el listado (copia variantes, imágenes opcionales, categorías y specs; el duplicado queda en borrador, sin SKU ni código de barras y con slug `-copia`). "Ver en la tienda" y "Vista previa" en borradores.
- **Por qué:** cargar variantes de un modelo parecido es el 80 % del alta. Sin vista previa, el vendedor publica para ver cómo queda.
- **Competencia:** Tiendanube duplica todo menos el código de barras y deja elegir si copia las fotos [TN-duplicar]. Shopify permite elegir estado y qué se copia [SH-add].
- **Propuesta:** action `duplicateProduct(id, { images: boolean })`. Vista previa: `/producto/[slug]?preview=1`, que si el usuario es admin lee sin `unstable_cache` y sin filtro de `status` (RLS ya permite leer todo a `is_admin()`), con una barra superior "Vista previa: este producto no está publicado".

### P0-14 · Botón de arrepentimiento (Res. SCI 424/2020) — **S** · Agentes **S** (form y link) + **B** (bandeja) + **F** (tabla y RPC)
- **Qué:** un link "Botón de arrepentimiento" visible desde la home (footer) que abre un formulario **sin registro**: nombre, email o teléfono, número de pedido y motivo opcional. Al enviar, muestra en pantalla un **código de revocación**. La norma exige informarlo por el mismo medio dentro de las 24 h.
- **Por qué:** es obligatorio para quien vende por web en Argentina. El plazo del consumidor es de 10 días corridos [AR-424].
- **Competencia:** Tiendanube lo incluye en todas las tiendas AR, en el footer. El vendedor lo recibe en Clientes > Mensajes como "Arrepentimiento" y cancela a mano [TN-arrep].
- **Propuesta:** tabla `withdrawal_requests(id, code text unique, order_number, name, contact, reason, status 'new'|'processed'|'rejected', order_id null, created_at)`. RPC pública `create_withdrawal_request(payload)` (security definer, rate-limit simple por IP o contacto). Página `/arrepentimiento`. Si el pedido existe, se agrega un evento `order_events` de tipo `withdrawal_requested`. En el admin de B: una bandeja con badge y "Cancelar pedido" en un clic.

### P0-15 · Precio sin impuestos nacionales (Ley 27.743, Res. SIC 4/2025) — **M** · Agentes **H** (config) + **A** (alícuota por producto) + **S** (display) + **C** (motor)
- **Qué:** mostrar junto al precio final, en tipografía menor, el importe neto sin IVA ni otros impuestos nacionales indirectos con la leyenda **"PRECIO SIN IMPUESTOS NACIONALES"**, en la card, la ficha, el carrito y el checkout [AR-4-2025].
- **Por qué:** obligatorio desde el 1-4-2025 para comercios que venden al consumidor final. Tiendanube lo trata como obligación de los responsables inscriptos [TN-sinimp].
- **Competencia:** Tiendanube: alícuota por defecto 21 % con excepciones por producto, `neto = total / (1 + alícuota)`, visible en ficha, carrito y checkout, gratis en todos los planes [TN-sinimp].
- **Propuesta:** `store_settings.tax jsonb {show_net_price: bool, default_vat_percent: 21, label: 'Precio sin impuestos nacionales'}`, `products.vat_percent numeric(5,2) null` (null usa el default; opciones 0, 10,5, 21 y 27) y la función pura `netPrice(final, vat)` en `lib/pricing` con tests. Monotributistas: el switch en off (el vendedor decide, conviene documentarlo en la UI). P1: precio por unidad de medida (kg, l, m) que exige la misma resolución para ciertos rubros.

### P0-16 · Link a Defensa del Consumidor y QR de Data Fiscal — **S** · Agentes **H** + **S**
- **Qué:** en el footer, siempre para AR: "Defensa de las y los consumidores. Para reclamos **ingresá acá**" → `https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario` [TN-defcons]. Además, el QR de Data Fiscal de ARCA (formulario 960/D para sitios web), que se pega como script o como URL del QR [TN-datafiscal].
- **Por qué:** Tiendanube lo muestra obligatorio en las tiendas AR [TN-defcons]. El Data Fiscal es exigible para sitios que venden.
- **Propuesta:** `store_settings.legal jsonb {country:'AR', consumer_defense_link: true, data_fiscal: {image_url, href}, cuit, razon_social}`. **No** se acepta el script crudo de ARCA: se guarda la URL de la imagen y el link, porque la spec prohíbe HTML arbitrario. Render en `Footer` (S).

### P0-17 · Políticas y páginas legales con plantilla AR — **S** · Agente **H** (+ **E** si se usan `pages`)
- **Qué:** botones "Insertar plantilla" en Envíos, Cambios y devoluciones (con los 10 días de arrepentimiento), Privacidad (Ley 25.326) y Términos. La plantilla se completa con variables de la tienda (razón social, CUIT, email, dirección). Links automáticos en el footer y en el paso Confirmar del checkout ("Al confirmar aceptás los Términos").
- **Por qué:** el vendedor no sabe redactarlas y quedan vacías.
- **Competencia:** Shopify genera plantillas de devoluciones, privacidad, envíos, términos y aviso legal [SH-policies].
- **Propuesta:** textos en `src/lib/legal/templates.ts` (markdown con `{{store.name}}`), rutas `/politicas/[tipo]` o páginas `type='legal'` ya previstas. Aclaración visible: "Plantilla orientativa, no es asesoramiento legal".

### P0-18 · Google Analytics 4, GTM y Meta Pixel por ID — **S** · Agentes **H** (campos) + **S** (inyección y eventos)
- **Qué:** campos `ga4_id` (G-XXXX), `gtm_id` (GTM-XXXX), `meta_pixel_id` y `google_site_verification`. El storefront carga los scripts con `next/script` y emite eventos estándar: `view_item`, `add_to_cart`, `begin_checkout`, `purchase` en `/pedido/[token]` (una sola vez por pedido) y los equivalentes de Meta (`ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`).
- **Por qué:** toda pyme que pauta en Instagram necesita el Pixel desde el día 1. Sin él, la pauta no optimiza.
- **Competencia:** Tiendanube, Configuración > Códigos externos (GA4, GTM, Pixel) [TN-ga4] [TN-gtm] [TN-pixel]. Shopify, pixels y customer events [SH-pixels].
- **Propuesta:** `store_settings.integrations jsonb`. Validar los formatos con zod (sin HTML libre). Helper `lib/store/analytics.ts#track(event, payload)` que despacha a `gtag` y `fbq` si existen. Ver el §6 (choca con el texto del §12).

### P0-19 · Botón flotante de WhatsApp — **S** · Agentes **H** (setting) + **S**
- **Qué:** un botón fijo abajo a la derecha que abre `wa.me/<whatsapp_phone>?text=<mensaje>` con un mensaje contextual ("Hola, consulto por *{producto}* {url}" en la ficha). Oculto en el checkout.
- **Por qué:** en Argentina la consulta previa por WhatsApp es la norma. Tiendanube lo trae nativo [TN-wa].
- **Propuesta:** `store_settings.whatsapp_button jsonb {enabled, position:'right'|'left', message_template, show_on_mobile, show_on_desktop}`. Componente `components/store/WhatsAppFab.tsx`, que no se renderiza en `/checkout` ni en `/pedido/*`.

### P0-20 · Conversión: precio con transferencia visible y barra de envío gratis — **S** · Agentes **S** (+ **E** toggles de tema, **C** helper)
- **Qué:** (a) en la card y la ficha, debajo del precio: "**$ 9.000** con transferencia" (el método activo con mayor `discount_percent`). (b) En el carrito y el mini-carrito: "Te faltan **$ 12.500** para el envío gratis" con una barra de progreso.
- **Por qué:** el descuento por transferencia es la palanca de conversión número 1 en tiendas sin pasarela. Si recién aparece en el checkout, no vende. La barra sube el ticket promedio.
- **Competencia:** Tiendanube, "mostrar el precio con mayor descuento en listados, detalle y carrito" [TN-preciodesc] y el contador de envío gratis [TN-contador]. Empretienda, toggle "Precio con transferencia" en la card [EM-transf].
- **Propuesta:** `theme.cards.showTransferPrice: boolean` y `store_settings.free_shipping_bar jsonb {enabled, threshold}` (si es null, se usa el `free_over` mínimo entre las zonas activas y se aclara "en zonas seleccionadas"). Helper `bestPaymentDiscount(methods)` en `lib/pricing`.

> **Chequeos rápidos de cosas que la spec ya tiene pero conviene asegurar:** `min_order_total` validado en el carrito (mensaje) **y** en `create_order` (server). `internal_notes` editable inline. Pedido manual (B) que descuenta stock y permite precio unitario editado. Export CSV de pedidos (H) con columnas contables (fecha, número, cliente, CUIT o DNI, subtotal, descuentos, envío, total, método, estado de pago).

### Asignación por agente (resumen)

| Agente | Gaps P0 |
| --- | --- |
| A | P0-02 (redirección al cambiar el slug), P0-03 (SEO de producto y categoría), P0-08, P0-11, P0-12 (manual), P0-13, P0-15 (alícuota por producto) |
| B | P0-05, P0-06, P0-07, P0-08 (widget), P0-14 (bandeja) |
| C | P0-15 (`netPrice`), P0-20 (`bestPaymentDiscount`) |
| D | (sin gaps P0; `free_over` alimenta P0-20) |
| E | P0-03 (SEO de páginas y componente compartido), P0-20 (toggles de card) |
| S | P0-01, P0-03 (metadata, OG, JSON-LD), P0-09, P0-10, P0-12 (auto), P0-13 (preview), P0-14 (form), P0-15 (display), P0-16, P0-18 (eventos), P0-19, P0-20 |
| G | P0-04 (import CSV por SKU y alta) |
| H | P0-02 (UI), P0-04 (export), P0-06 (plazo), P0-09, P0-15 (config), P0-16, P0-17, P0-18, P0-19 |
| F | migración con `redirects`, `withdrawal_requests`, columnas nuevas, `expire_unpaid_orders()`, `create_withdrawal_request()` |

---

## 3. Backlog v0.1–v0.3 (P1 y P2)

**v0.1 (P1, lo que más reclaman los comercios)**
1. **Promos "Llevá X, pagá Y" y 2.ª unidad al X %**: `promotions.type` suma `'bxgy'` con `buy_qty`, `pay_qty`, y se bonifica el de menor precio [TN-lxpy] [SH-bxgy]. (C)
2. **Descuento por cantidad o precio mayorista**: `promotions.type='quantity_tiers'` o `product_variants.price_tiers jsonb [{min_qty, price}]`, más cantidad mínima [TN-mayorista] [EM-mayorista]. (C, A)
3. **Comprobante subido por el comprador** en `/pedido/[token]`: bucket privado `receipts`, RPC con token, y crea un `order_payments` borrador para validar. (S, B)
4. **Link de pago manual** (Mercado Pago u otro) en el pedido, con un botón "Pagar" en `/pedido/[token]` [SH-draft]. (B, S)
5. **Editar ítems de un pedido** (agregar, quitar, cambiar cantidades, recálculo, ajuste de stock) [SH-editorder] [TN-editventa]. (B)
6. **Reabrir un pedido cancelado** (re-descuenta stock si hay) [TN-reabrir]. (B)
7. **"Avisame cuando haya stock"**: tabla `stock_waitlist(variant_id, email|phone)`, lista en el admin y "Avisar por WhatsApp" manual [TN-avisostock] [JS-backinstock]. (S, A)
8. **Checkouts abandonados**: persistir el paso "Datos" en `checkout_sessions`, lista en el admin y "Contactar por WhatsApp" con el link del carrito [TN-abandonados] [SH-abandoned]. (S, B)
9. **Feed de catálogo** `/feeds/google.xml` y `/feeds/meta.csv` para Merchant Center e Instagram Shopping. (S)
10. **Cross-sell en el carrito** ("Completá tu compra") con los relacionados manuales [TN-crosssell]. (S)
11. **Definiciones de atributos tipados** (text, select, number) filtrables en el storefront [SH-metafields] [JS-custom]. (A, S)
12. **Editor tipo planilla** para precio, precio tachado, stock y SKU de muchas variantes [SH-bulkedit]. (A)
13. **Permisos por sección** para staff (pedidos, catálogo, config) [TN-usuarios] [SH-roles]. (H)
14. **Export e import de clientes por CSV** [TN-expclientes] [TN-impclientes]. (H)
15. **Reglas de combinación del descuento por medio de pago** con promos y cupones [TN-combinable]. (C)
16. **Swatches de color** (hex o imagen por valor de opción) en la ficha y los filtros. (A, S)
17. **Email transaccional mínimo** (pedido recibido y pagado) con un proveedor externo. Requiere revisar el §12. (B, H)
18. **noindex por página y producto** [SH-noindex]. (E, A)
19. **Margen visible** (precio − costo) en el listado y el editor de variantes. (A)
20. **Precio por unidad de medida** (kg, l, m) según la Res. SIC 4/2025 [AR-4-2025]. (A, S)

**v0.2 (P2 cercano)**
21. Vistas guardadas en los listados de pedidos y productos [SH-views]. (B, A)
22. Colecciones automáticas por reglas (tag, precio, en oferta, stock) [SH-smart]. (A)
23. Modo catálogo o "Consultar precio" por producto o global [TN-consultar] [TN-restringir]. (A, S)
24. Mínimo y máximo de unidades por producto [JS-product]. (A, S)
25. Compra rápida desde la ficha [TN-comprarapida]. (S)
26. Mínimo de compra y costo condicional por zona [SH-local]. (D)
27. Tags de pedido y filtros por tag. (B)
28. Visitas y conversión en el dashboard (contador propio sin cookies). (B, S)
29. Blog simple reutilizando `pages` con `type='post'`. (E, S)

**v0.3 (P2 con dependencias externas)**
30. Pasarela Mercado Pago (Checkout Pro) con webhooks [TN-cancelauto]. (nuevo agente)
31. Cotización y etiquetas de correo: Andreani, OCA, Correo Argentino [TN-oca]. (D)
32. Facturación electrónica ARCA mediante un servicio externo. (B, H)
33. Cuentas de cliente con login e historial. (S)
34. API pública y webhooks salientes (pedido creado o pagado). (H)
35. Multi-depósito con stock por ubicación [SH-invstates]. (A)
36. Producto digital o servicio [JS-product]. (A)

---

## 4. Detalles de UX que marcan la diferencia

"Barato en v0" = se hace en horas dentro del alcance del agente, sin schema nuevo o con una columna.

| # | Detalle | Quién lo hace | ¿Barato en v0? | Agente |
| --- | --- | --- | --- | --- |
| 1 | Edición inline de precio, precio tachado y stock en el listado, que guarda al salir del campo | Tiendanube [TN-inline] [TN-stockedit] | **Sí** | A |
| 2 | Duplicar producto con opción "copiar fotos" | Tiendanube [TN-duplicar] · Shopify [SH-add] | **Sí** | A |
| 3 | Vista previa de un borrador con barra "No publicado" | Shopify [SH-add] | **Sí** | A, S |
| 4 | Bulk actions: publicar, ocultar, archivar, categoría, tags y ajustar % | Shopify [SH-bulkactions] · Tiendanube [TN-ocultar] | **Sí** (ya en §5) | A |
| 5 | Command palette ⌘K / Ctrl+K y `?` para ver los atajos | Shopify [SH-shortcuts] | **Sí** (en §10 H) | H |
| 6 | Atajos de secuencia: `g p` pedidos, `g o` productos, `n` nuevo | Shopify [SH-shortcuts] | **Sí** | H |
| 7 | Timeline del pedido con comentarios internos, adjuntos y @menciones | Shopify [SH-timeline] | Sí sin @menciones | B |
| 8 | Nota privada o nota visible al cliente en el mismo input (toggle) | WooCommerce [WC-orders] | **Sí** | B |
| 9 | Botones "Copiar" para CBU, alias, monto y número de pedido | Práctica AR (ver §5) | **Sí** | S |
| 10 | Mensaje de WhatsApp prearmado desde la ficha del pedido ("Tu pedido #1024 fue despachado, seguimiento: …") | — (diferencial) | **Sí** | B |
| 11 | Marcar pagado con un clic desde el listado (registra `order_payments` por el total) | Empretienda [EM-transf] | **Sí** | B |
| 12 | Aviso de vencimiento de reserva ("vence en 5 h") y "Extender" | WooCommerce [WC-inventory] | Sí (con P0-06) | B |
| 13 | Historial de stock por variante con usuario y motivo, accesible desde la fila | Tiendanube [TN-historial] | **Sí** (hay datos) | A |
| 14 | Undo del último cambio masivo de precios | — (diferencial Ecommy §3.4) | Ya en spec | C |
| 15 | Toast con "Deshacer" tras archivar u ocultar (5 s) | Patrón estándar | **Sí** | A, B |
| 16 | Autoguardado de borradores de producto y página (localStorage + "Hay cambios sin guardar") | Tiendanube, diseño en borrador [TN-borrador] | **Sí** (aviso `beforeunload` + draft local) | A, E |
| 17 | Contador de caracteres y vista previa de Google en SEO | Tiendanube [TN-seo] · Shopify [SH-seo] | **Sí** | A, E |
| 18 | Selector de columnas en listados | Shopify [SH-bulkedit] | No (P2) | A, B |
| 19 | Vistas guardadas de filtros | Shopify [SH-views] | No (P2) | B |
| 20 | Generador de variantes: escribir "S, M, L" y crear la matriz con precio y stock "aplicar a todas" | Shopify y Tiendanube (alta de variantes) [JS-product] | **Sí** | A |
| 21 | Reordenar imágenes con drag y marcar la principal. Alt editable | Jumpseller [JS-product] | **Sí** | A |
| 22 | Pegar imágenes desde el portapapeles o arrastrar varias a la vez | Patrón estándar | **Sí** | A |
| 23 | Empty states con acción ("Todavía no tenés productos → Importar desde CSV o URL") | Patrón estándar | **Sí** | todos |
| 24 | Badge de pedidos nuevos y título de pestaña `(3)` | Shopify (push) · Tiendanube (email) | **Sí** (P0-07) | B |
| 25 | Imprimir varios pedidos seleccionados en una tanda | Tiendanube [TN-remito] · Shopify [SH-orderprinter] | **Sí** (P0-05) | B |
| 26 | Link "Ver en la tienda" y "Copiar link" en cada producto, más un QR del producto para imprimir en el local | — | **Sí** | A |
| 27 | Checklist de onboarding (logo, datos bancarios, primer producto, zona de envío, políticas) con progreso | Tiendanube y Shopify (home del admin) | Sí (M chico) | H |
| 28 | Filtros de estado como tabs con conteo ("Pendientes de pago (4)") | Shopify [SH-views] | **Sí** | B |
| 29 | Confirmación con resumen antes de aplicar un CSV (N filas, M cambios de precio, K errores) | Shopify, vista previa del import [SH-csv] | Sí (con P0-04) | G |
| 30 | Ocultar el WhatsApp flotante en el checkout para no distraer | Tiendanube [TN-wa] | **Sí** | S |

---

## 5. Checkout y confianza en tiendas que venden por transferencia o WhatsApp en Argentina

### 5.1 Qué muestran hoy las plataformas y las tiendas

| Elemento | Práctica observada | Fuente |
| --- | --- | --- |
| **Descuento por transferencia** visible antes del checkout | Tiendanube y Empretienda permiten mostrar "precio con transferencia" en card, ficha y carrito. Suele ser del 10 al 20 %. | [TN-preciodesc] [EM-transf] [TN-transfdesc] |
| **Datos bancarios completos** | Empretienda recomienda CBU o CVU, **titular y CUIT/DNI** "por seguridad". Tiendanube los pone en "Instrucciones para tu cliente". | [EM-transf] [TN-transfcfg] |
| **Instrucciones después de comprar** | Shopify muestra las instrucciones del pago manual en la página de confirmación. | [SH-manualpay] |
| **Plazo para pagar o reserva** | Pago Nube transferencia: 24 h fijas. Transferencia AR vía Pago Nube: 3 días y rechazo automático. WooCommerce: "hold stock" en minutos (no aplica a on-hold). | [TN-cancelauto] [TN-pendiente] [WC-inventory] [WC-bacs] |
| **Estado "pendiente" hasta verificar** | Empretienda: la venta queda "Pendiente" hasta que el vendedor la marca pagada y recomienda verificar la acreditación antes de despachar. | [EM-transf] |
| **Comprobante** | Lo usual es que el cliente lo mande por WhatsApp o email. Ninguna de las plataformas relevadas trae nativo que el **comprador** lo suba en el pedido (Tiendanube lo tiene sólo para el pago del plan del comerciante). | [EM-transf] [TN-comprobante] |
| **Seguimiento del pedido** | Tiendanube muestra una página de seguimiento con confirmación, pago, empaquetado, envío, ETA y tracking. | [TN-seguimiento] |
| **Cuotas** | Tiendanube muestra cuotas con pasarela. La Res. SIC 4/2025 exige informar el monto de cada cuota, la cantidad y el **CFT** si se ofrecen. | [AR-4-2025] |
| **Señales legales** | Botón de arrepentimiento, link a Defensa del Consumidor y Data Fiscal en el footer. | [TN-arrep] [TN-defcons] [TN-datafiscal] |

### 5.2 Recomendaciones para Ecommy (en orden de impacto)

1. **Mostrar el precio con transferencia desde la card** (P0-20). Tomar el método activo con mayor descuento. En el checkout, el selector de pago muestra el total de cada opción lado a lado ("Transferencia **$ 90.000** · Acordar por WhatsApp $ 100.000").
2. **Página de pedido pensada para pagar desde el celular** (`/pedido/[token]`, S):
   - Arriba: estado, "Pedido **#1024**" y el **monto exacto a transferir** con un botón **Copiar**.
   - Una tarjeta de datos bancarios con **Alias**, **CBU/CVU**, **Titular**, **CUIT** y **Banco**, cada uno con Copiar, más "Copiar todos los datos" (texto listo para pegar).
   - "Poné **#1024** en el concepto o la referencia".
   - Plazo: "Te reservamos el stock hasta el **jue 18/09 18:00**" (P0-06), con una cuenta regresiva discreta.
   - CTA principal: "**Enviar comprobante por WhatsApp**" (ya en la spec) con un mensaje prearmado que incluye número, total y nombre. P1: "Subir comprobante" en la misma página.
   - "¿Qué pasa ahora?": 3 pasos (Transferís → Confirmamos el pago, en general en X h hábiles → Preparamos y enviamos o coordinamos el retiro).
   - Timeline de eventos visibles al cliente (ya en la spec).
3. **Nada de sorpresas en el costo**: mostrar el envío, o "Retiro gratis en {local}", antes del paso de pago. Si la zona no se resuelve, el fallback a WhatsApp ya está en la spec.
4. **Datos de la transferencia validados en la config (H)**: el CBU/CVU con 22 dígitos y dígito verificador, el alias entre 6 y 20 caracteres (letras, números, punto y guion), el CUIT con 11 dígitos y dígito verificador. Una vista previa de cómo lo verá el cliente. Un campo `instructions_md` para aclaraciones ("Aceptamos transferencias desde cualquier banco o billetera").
5. **Reglas de descuento claras**: una leyenda "Descuento por transferencia no acumulable con cupones" configurable (C). Hoy la spec no define la combinabilidad del descuento por medio de pago; Tiendanube lo hace configurable [TN-combinable].
6. **Confianza en la ficha y el checkout**: una fila de iconos "Pagás por transferencia o acordás por WhatsApp · Envíos a {zonas} · Cambios dentro de 30 días" con links a las políticas. Datos de contacto reales (WhatsApp, dirección si hay local) en el footer. Botón de arrepentimiento, Defensa del Consumidor y Data Fiscal (P0-14 y P0-16).
7. **WhatsApp como método de pago** ("Acordar con el vendedor"): el mensaje prearmado debe incluir el link a `/pedido/[token]`, para que el vendedor abra el pedido desde el chat, y los ítems con variante y cantidad. Evitar mensajes de más de 1.000 caracteres (se trunca la URL de `wa.me`); si el pedido es largo, resumirlo y mandar el link.
8. **No mostrar cuotas en v0** salvo que el vendedor cargue explícitamente las condiciones con CFT. Mostrar "hasta 6 cuotas" sin CFT incumple la Res. SIC 4/2025 [AR-4-2025].
9. **Avisar al vendedor** (P0-07) y darle **"Marcar pagado" en un clic** con monto precargado y referencia (UX 11). La conciliación manual es el cuello de botella de este modelo.
10. **Sin email transaccional**, el `/pedido/[token]` es el comprobante del cliente: sugerir "Guardá este link" con un botón "Copiar link" y "Enviármelo por WhatsApp" (abre `wa.me` al propio número del cliente, sin backend).

---

## 6. Decisiones y conflictos con la spec (para el orquestador)

1. **§12 "analytics integrados" fuera de alcance vs. P0-18.** Propuesta: aclarar en la spec que se excluyen los dashboards de tráfico propios, **no** la inyección de GA4, GTM y Pixel por ID con eventos estándar. Es S y es esperable desde el día 1.
2. **§12 "emails transaccionales" fuera de alcance.** Se compensa con P0-07 (aviso en el admin), la página de pedido como comprobante (§5.2.10) y WhatsApp prearmado. El email al owner pasa a v0.1.
3. **`order_events.type`** necesita los valores `printed`, `withdrawal_requested`, `expired` y `reservation_extended`. **`orders.cancel_reason`** puede tomar `'expired'`.
4. **`store_settings`** suma los jsonb `tax`, `legal`, `integrations`, `whatsapp_button`, `free_shipping_bar` y `catalog` (visibilidad de agotados), y `checkout.reservation_hours`. Conviene que F los agregue en una sola migración con defaults, para no pisarse entre H y S.
5. **`products`** suma `specs jsonb`, `related_ids uuid[]` y `vat_percent numeric(5,2)`. **Tablas nuevas:** `redirects` y `withdrawal_requests`.
6. **Palabras reservadas de slug** (§3.7): agregar `arrepentimiento`, `politicas`, `sitemap.xml`, `robots.txt` y `feeds`.
7. **Cron:** confirmar si el proyecto Supabase tiene `pg_cron`. Si no, usar el barrido perezoso descripto en P0-06.
8. **Data Fiscal:** no aceptar el `<script>` de ARCA (la spec prohíbe HTML arbitrario). Guardar la URL de la imagen y el link.

---

## 7. Fuentes

**Tiendanube (ayuda.tiendanube.com / docs.tiendanube.com)**
- [TN-campos] https://ayuda.tiendanube.com/es_ES/122708-lista-de-productos/como-usar-los-campos-personalizados-de-mi-tiendanube
- [TN-filtros] https://ayuda.tiendanube.com/es_ES/123134-listado-de-productos/como-configurar-filtros-personalizados-en-el-listado-de-productos
- [TN-301] https://ayuda.tiendanube.com/es_ES/123373-redireccionamiento-301/que-es-el-redireccionamiento--y-como-lo-uso
- [TN-csv] https://ayuda.tiendanube.com/es_ES/122710-importar-y-exportar-productos/como-modificar-los-productos-de-forma-masiva
- [TN-csvfaq] https://ayuda.tiendanube.com/es_ES/122710-importar-y-exportar-productos/preguntas-frecuentes-sobre-la-carga-masiva-de-productos
- [TN-migrar] http://ayuda.tiendanube.com/es/articles/3969552-como-migrar-tu-tienda-online-a-tiendanube
- [TN-manual] https://ayuda.tiendanube.com/es_ES/123337-agregar-orden-de-compra/como-agregar-ventas-manualmente-desde-el-administrador-de-mi-tienda
- [TN-remito] https://ayuda.tiendanube.com/es_MX/informacion/como-imprimir-un-recibo-o-remito-para-control-interno-de-mis-ordenes
- [TN-oca] https://ayuda.tiendanube.com/es_ES/122816-oca/como-imprimir-las-etiquetas-de-oca-de-forma-masiva-desde-el-administrador-de-mi-tienda
- [TN-avisostock] https://ayuda.tiendanube.com/es_ES/123503-aplicaciones-de-difusion-y-marketing/como-integrar-notificaciones-de-stock-en-mi-tienda
- [TN-mayorista] https://ayuda.tiendanube.com/ventas-mayoristas/que-es-y-como-configurar-la-funcion-de-ventas-mayoristas-y-minoristas-de-tiendanube
- [TN-abandonados] https://ayuda.tiendanube.com/es_ES/123339-carritos-abandonados/como-recuperar-los-carritos-abandonados
- [TN-transfdesc] https://ayuda.tiendanube.com/es_ES/122925-medio-de-pago-personalizado/como-crear-un-descuento-con-un-medio-de-pago-personalizado
- [TN-transfcfg] https://ayuda.tiendanube.com/es_ES/122925-medio-de-pago-personalizado/como-configurar-una-opcion-de-pago-por-transferencia-en-mi-tienda
- [TN-preciodesc] https://ayuda.tiendanube.com/es_ES/123159-detalle-del-producto/como-mostrar-el-precio-con-descuento-por-el-pago-personalizado
- [TN-combinable] https://ayuda.tiendanube.com/es_ES/123465-cupones-y-promociones/como-definir-si-el-descuento-por-medio-de-pago-es-combinable-con-otros-descuentos
- [TN-lxpy] https://ayuda.tiendanube.com/es_ES/123465-cupones-y-promociones/como-ofrecer-promociones-de-x-y-x
- [TN-preciosmasivo] https://ayuda.tiendanube.com/es_ES/precios-del-producto/como-actualizar-los-precios-de-mis-productos-de-forma-masiva
- [TN-consultar] https://ayuda.tiendanube.com/es_CO/precios-del-producto/como-configurar-el-boton-consultar-precio-en-mis-productos
- [TN-restringir] https://ayuda.tiendanube.com/es_ES/123367-opciones-del-checkout/como-restringir-compras-y-ocultar-los-precios
- [TN-sinimp] https://ayuda.tiendanube.com/es_ES/precios-del-producto/como-mostrar-el-total-de-la-compra-sin-impuestos-en-mi-tiendanube
- [TN-ga4] https://ayuda.tiendanube.com/es_ES/123490-google-analytics/como-vincular-google-analytics-4-con-mi-tiendanube
- [TN-gtm] https://ayuda.tiendanube.com/es_MX/google/como-instalar-google-tag-manager-en-mi-tiendanube
- [TN-pixel] https://ayuda.tiendanube.com/es_ES/pixel-de-facebook/como-instalar-el-pixel-de-facebook-en-mi-tienda
- [TN-seo] https://ayuda.tiendanube.com/es_ES/160351-seo-del-producto/que-son-las-opciones-avanzadas-de-seo-de-mis-productos
- [TN-usuarios] https://ayuda.tiendanube.com/es_ES/123366-permisos-para-usuarios/que-permisos-puedo-asignar-a-los-usuarios-de-mi-tiendanube
- [TN-arrep] https://ayuda.tiendanube.com/es_ES/123288-mis-ventas/que-es-el-boton-de-arrepentimiento-de-compra-de-mi-tiendanube
- [TN-datafiscal] https://ayuda.tiendanube.com/es_ES/afip/como-agregar-el-codigo-de-data-fiscal-de-afip
- [TN-defcons] https://docs.tiendanube.com/help/defensa-al-consumidor
- [TN-wa] https://ayuda.tiendanube.com/es_ES/123362-whatsapp/como-agregar-el-boton-de-whatsapp-en-mi-tiendanube
- [TN-pendiente] https://ayuda.tiendanube.com/es_ES/123288-mis-ventas/por-que-hay-una-orden-en-el-administrador-de-tu-tiendanube-que-esta-esperando-la-confirmacion-de-pago
- [TN-cancelauto] https://ayuda.tiendanube.com/es_ES/preguntas-frecuentes-pago-nube/cancelacion-automatica-de-ventas-pago-nube
- [TN-cancelar] https://ayuda.tiendanube.com/es_AR/123288-mis-ventas/como-cancelar-una-venta-en-mi-tiendanube
- [TN-reabrir] https://ayuda.tiendanube.com/es_AR/123288-mis-ventas/como-reabrir-una-orden-de-compra
- [TN-editventa] https://ayuda.tiendanube.com/es_ES/123288-mis-ventas/como-editar-una-venta-en-tiendanube
- [TN-seguimiento] https://ayuda.tiendanube.com/es_ES/123288-mis-ventas/como-puede-mi-cliente-conocer-el-estado-de-su-compra
- [TN-comprobante] https://ayuda.tiendanube.com/es_AR/123480-pagar-con-transferencia-bancaria/como-enviar-el-comprobante-de-mi-transferencia
- [TN-relacionados] https://ayuda.tiendanube.com/es_ES/123159-detalle-del-producto/como-seleccionar-los-productos-relacionados-en-tiendanube
- [TN-crosssell] https://ayuda.tiendanube.com/es_AR/123178-carrito-de-compras/como-sugerir-productos-complementarios-al-agregar-un-producto-al-carrito
- [TN-minimo] https://ayuda.tiendanube.com/es_ES/123178-carrito-de-compras/como-configurar-un-minimo-de-compra-en-mi-tienda
- [TN-contador] https://ayuda.tiendanube.com/es_ES/123178-carrito-de-compras/como-mostrar-el-contador-de-envio-gratis-en-mi-tiendanube
- [TN-envgratis] https://ayuda.tiendanube.com/es_ES/122907-envio-gratis/como-ofrecer-envio-gratuito
- [TN-comprarapida] https://ayuda.tiendanube.com/es_AR/123178-carrito-de-compras/como-activar-la-opcion-de-compra-rapida-en-mi-tienda
- [TN-inline] https://ayuda.tiendanube.com/es_ES/122708-lista-de-productos/como-actualizar-mis-productos
- [TN-stockedit] https://ayuda.tiendanube.com/es_ES/gestion-de-inventario/como-editar-el-stock-de-mis-productos
- [TN-historial] https://ayuda.tiendanube.com/es_ES/gestion-de-inventario/como-ver-el-historial-de-stock-de-mis-productos-y-variantes
- [TN-histprod] https://ayuda.tiendanube.com/es_ES/gestion-de-inventario/como-ver-el-historial-de-cambios-de-un-producto-en-mi-tiendanube
- [TN-duplicar] https://ayuda.tiendanube.com/es_MX/122708-lista-de-productos/como-duplicar-productos-en-mi-tienda
- [TN-ocultar] https://ayuda.tiendanube.com/es_ES/122708-lista-de-productos/como-ocultar-productos
- [TN-ocultarsinstock] https://ayuda.tiendanube.com/es_MX/122708-lista-de-productos/como-ocultar-los-productos-sin-stock
- [TN-sinstockfinal] https://ayuda.tiendanube.com/es_MX/122707-organizar-productos/como-mostrar-los-productos-sin-stock-al-final-del-listado
- [TN-borrador] https://ayuda.tiendanube.com/es_MX/informacion-general-design/como-personalizar-el-diseno-de-mi-tienda-en-un-borrador
- [TN-categorias] https://ayuda.tiendanube.com/es_CO/productos/guia-organizar-los-productos-en-categorias
- [TN-stats] https://ayuda.tiendanube.com/es_ES/123489-estadisticas/como-ver-las-estadisticas-de-mi-tiendanube
- [TN-expclientes] https://ayuda.tiendanube.com/es_ES/123344-exportar-lista-de-clientes/como-exportar-mi-lista-de-clientes
- [TN-impclientes] https://ayuda.tiendanube.com/es_ES/123342-mis-clientes/como-importar-clientes-de-forma-masiva-en-tiendanube
- [TN-expventas] https://ayuda.tiendanube.com/es_ES/123338-exportar-lista-de-ventas/como-exportar-mi-lista-de-ventas

**Shopify (help.shopify.com)**
- [SH-metafields] https://help.shopify.com/en/manual/custom-data/metafields
- [SH-mfilter] https://help.shopify.com/en/manual/custom-data/metafields/filtering-products
- [SH-filters] https://help.shopify.com/en/manual/online-store/storefront-search/search-and-discovery-filters
- [SH-reco] https://help.shopify.com/en/manual/online-store/storefront-search/search-and-discovery-recommendations
- [SH-redirect] https://help.shopify.com/en/manual/online-store/menus-and-links/url-redirect
- [SH-sitemap] https://help.shopify.com/en/manual/promoting-marketing/seo/find-site-map
- [SH-robots] https://help.shopify.com/en/manual/promoting-marketing/seo/editing-robots-txt
- [SH-noindex] https://help.shopify.com/en/manual/promoting-marketing/seo/hide-a-page-from-search-engines
- [SH-seo] https://help.shopify.com/en/manual/promoting-marketing/seo/adding-keywords
- [SH-csv] https://help.shopify.com/en/manual/products/import-export/using-csv
- [SH-invcsv] https://help.shopify.com/en/manual/products/inventory/getting-started-with-inventory/inventory-csv
- [SH-bulkedit] https://help.shopify.com/en/manual/shopify-admin/productivity-tools/bulk-editing
- [SH-bulkactions] https://help.shopify.com/en/manual/shopify-admin/productivity-tools/bulk-actions
- [SH-add] https://help.shopify.com/en/manual/products/add-update-products
- [SH-smart] https://help.shopify.com/en/manual/products/collections/smart-collections
- [SH-draft] https://help.shopify.com/en/manual/fulfillment/managing-orders/create-orders/create-draft
- [SH-packing] https://help.shopify.com/en/manual/fulfillment/managing-orders/printing-orders/packing-slips
- [SH-orderprinter] https://help.shopify.com/en/manual/fulfillment/managing-orders/printing-orders/shopify-order-printer/index
- [SH-timeline] https://help.shopify.com/en/manual/shopify-admin/timeline
- [SH-editorder] https://help.shopify.com/en/manual/fulfillment/managing-orders/editing-orders
- [SH-invstates] https://help.shopify.com/en/manual/products/inventory/fundamentals/inventory-states
- [SH-invhistory] https://help.shopify.com/en/manual/products/inventory/adjusting-inventory/adjustment-history
- [SH-manualpay] https://help.shopify.com/en/manual/payments/manual-payments
- [SH-discounts] https://help.shopify.com/en/manual/discounts/discount-types
- [SH-bxgy] https://help.shopify.com/en/manual/discounts/discount-types/buy-x-get-y
- [SH-combine] https://help.shopify.com/en/manual/discounts/discount-combinations
- [SH-shortcuts] https://help.shopify.com/en/manual/shopify-admin/productivity-tools/keyboard-shortcuts
- [SH-views] https://help.shopify.com/en/manual/shopify-admin/productivity-tools/searching-filtering-views
- [SH-segments] https://help.shopify.com/en/manual/customers/customer-segmentation
- [SH-policies] https://help.shopify.com/en/manual/checkout-settings/refund-privacy-tos
- [SH-abandoned] https://help.shopify.com/en/manual/promoting-marketing/create-marketing/abandoned-checkouts
- [SH-roles] https://help.shopify.com/en/manual/your-account/users/roles
- [SH-pixels] https://help.shopify.com/en/manual/promoting-marketing/pixels
- [SH-local] https://help.shopify.com/en/manual/fulfillment/setup/delivery-methods/local-delivery
- [SH-pickup] https://help.shopify.com/en/manual/fulfillment/setup/delivery-methods/pickup-in-store

**Empretienda (empretienda.helpjuice.com)**
- [EM-transf] https://empretienda.helpjuice.com/dep%C3%B3sito-transferencia
- [EM-agregarventa] https://empretienda.helpjuice.com/funcionalidad-agregar-venta/conociendo-agregar-
- [EM-mayorista] https://empretienda.helpjuice.com/venta-mayorista
- [EM-cupones] https://empretienda.helpjuice.com/cupones-de-descuento
- [EM-productos] https://empretienda.helpjuice.com/agregar-productos

**WooCommerce (woocommerce.com/document)**
- [WC-inventory] https://woocommerce.com/document/configuring-woocommerce-settings/products/
- [WC-bacs] https://woocommerce.com/document/bacs/
- [WC-orders] https://woocommerce.com/document/managing-orders/view-edit-or-add-an-order/
- [WC-backinstock] https://woocommerce.com/document/back-in-stock-notifications/
- [WC-attributes] https://woocommerce.com/document/managing-product-taxonomies/

**Jumpseller (jumpseller.com/support)**
- [JS-product] https://jumpseller.com/support/product/
- [JS-custom] https://jumpseller.com/support/product-custom-fields/
- [JS-filters] https://jumpseller.com/support/product-filters/
- [JS-backinstock] https://jumpseller.com/support/back-in-stock/
- [JS-abandoned] https://jumpseller.com/support/abandoned-orders/
- [JS-inventory] https://jumpseller.com/support/inventory-management/
- [JS-orders] https://jumpseller.com/support/orders/
- [JS-emails] https://jumpseller.com/support/orders-emails-and-notifications/

**Normativa argentina (fuentes oficiales)**
- [AR-424] Resolución SCI 424/2020, botón de arrepentimiento: https://www.boletinoficial.gob.ar/detalleAviso/primera/235729/20201005
- [AR-4-2025] Resolución SIC 4/2025, exhibición de precios y "PRECIO SIN IMPUESTOS NACIONALES": https://www.boletinoficial.gob.ar/detalleAviso/primera/319787/20250117 (texto: https://www.argentina.gob.ar/normativa/nacional/norma-408455/texto)
- Formulario de reclamos de Defensa del Consumidor (link del footer): https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario

> Nota de verificación: los datos de competidores salen de sus centros de ayuda a septiembre de 2026 y pueden variar según el plan (por ejemplo, el CSV de Tiendanube no está en el plan gratis [TN-csv] y los permisos dependen del plan [TN-usuarios]). Las celdas `s/d` no se pudieron confirmar en fuente primaria y no se afirman. Las recomendaciones legales son orientativas y no reemplazan asesoramiento profesional.
