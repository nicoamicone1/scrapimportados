# Ecommy: posicionamiento y mensajes

> Para: el dueño (fundador). Fecha: 2026-09-23 · versión del producto: 0.1.2.
> Documentos hermanos: [`LAUNCH-PLAN.md`](LAUNCH-PLAN.md) (cómo y cuándo), [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md) (qué tenés que hacer vos), [`SOCIAL-KIT.md`](SOCIAL-KIT.md) (copy listo para pegar).
>
> **Regla de todo el kit:** nada de cifras de usuarios, testimonios, logos de clientes ni estrellas hasta que existan y tengas permiso escrito. Cada afirmación sobre Ecommy sale del código (la hoja de datos de abajo dice dónde). Cada afirmación sobre la competencia sale de [`FEATURES-AUDIT.md`](FEATURES-AUDIT.md) o lleva la marca **[VERIFICAR]**.

---

## 0. Hoja de datos (la fuente de verdad del copy)

Si cambia algo de esta tabla, cambiá el copy en los cuatro documentos. Los planes son los valores por defecto de la migración (`src/lib/plans/features.ts`, `PLAN_DEFAULTS`); los efectivos viven en la tabla `plans` y se editan en `/platform/planes`. **Si tocás un plan ahí, revisá esta tabla.**

| Dato | Valor hoy | De dónde sale |
| --- | --- | --- |
| Comisión por venta | Ninguna. No hay pasarela: el comprador transfiere a la cuenta del comercio o acuerda por WhatsApp | checkout, `docs/ECOMMY-SPEC.md` §7 |
| Prueba | 14 días de Pro al crear la tienda, sin tarjeta ni datos de pago. Al vencer pasa a Free; no se borra nada, lo que excede el plan queda bloqueado para crear | `create_store()`, FAQ de `/planes` |
| Tiendas por cuenta | Hasta 3, cada una con su plan y su equipo | README |
| Dirección de la tienda | `<tienda>.ecommy.app`; dominio propio desde Pro (hoy el alta es manual, ver checklist §8) | `docs/DEPLOY.md` §6 |
| Tienda demo | `https://demo.ecommy.app` (catálogo de electro, bazar y accesorios importado de la web de un proveedor) | `storeHref({ slug: "demo" })`, `data/products.json` |
| Estilos | 10 presets por rubro: Nórdico, Mercado, Atelier, Editorial, Botica, Recreo, Lapacho, Galpón, Bodega, Neón. Free usa 2 (Nórdico y Mercado); Starter en adelante, los 10 | `src/lib/theme/presets.ts`, `FREE_THEME_PRESETS` |
| Cobro | Transferencia (con descuento opcional, visible en la card y la ficha) o "acordar por WhatsApp" con el pedido armado; el pedido queda registrado antes de derivar | `PriceTag.tsx`, landing |
| Reserva de stock | Plazo configurable: el pedido impago vence solo y devuelve el stock | `run_daily_maintenance()`, config de checkout |
| Envíos | Zonas por polígono dibujado en el mapa, provincia o código postal, con costo y plazo; retiro en el local; envío gratis desde un monto con barra "te faltan $ X" | `/admin/envios`, `FreeShippingBar.tsx` |
| Importar | CSV (crear productos o actualizar precio/stock por SKU) desde Starter; desde otra web (WooCommerce, Shopify o cualquier sitio con datos estructurados; "Detectar" muestra qué se puede traer antes de importar) en Pro | `/admin/importar`, `src/lib/scraper/` |
| Precios masivos | %, monto o margen sobre el costo; por categoría, marca, etiqueta, producto o rango de precio; con redondeo, vista previa y **Deshacer** (también deshace precios que entraron por importación). Pro | `/admin/precios`, `undo_price_batch` |
| Legal AR (todos los planes) | Botón de arrepentimiento con bandeja en el panel, link a Defensa del Consumidor, QR de Data Fiscal, "precio sin impuestos nacionales", plantillas de políticas | `Footer.tsx`, `/admin/configuracion/legales` |
| SEO y medición | Título y descripción por producto con vista previa, sitemap, robots, JSON-LD, Open Graph, redirecciones 301 (con importación CSV). GA4, Tag Manager y Meta Pixel cargando sólo el ID: desde Starter | `/admin/configuracion/seo` |
| Operación | Remitos para imprimir, pedidos manuales, aviso de pedidos nuevos en el panel, inventario con historial, equipo con invitación por link y roles, auditoría (Pro), exportación CSV (Pro) | admin |
| Lo que NO hay (hoy) | Pasarela de pago/cuotas online, etiquetas de correo (OCA, Andreani), sincronización con Mercado Libre, facturación electrónica, emails automáticos al comprador (en curso), cuentas de cliente con login, carritos abandonados, precios mayoristas por cantidad, app store | `FEATURES-AUDIT.md` §3 |

### Planes (defaults de la migración)

| | Free | Starter | Pro | Business |
| --- | --- | --- | --- | --- |
| Precio | $ 0 | $ 14.999 / mes | $ 34.999 / mes | A medida |
| Productos | 50 | 500 | Ilimitados | Ilimitados |
| Páginas | 1 (inicio) | 6 | Ilimitadas | Ilimitadas |
| Usuarios | 1 | 3 | 10 | Ilimitados |
| Estilos | 2 | 10 | 10 + CSS propio | 10 + CSS propio |
| Importar | — | CSV (10 por mes) | CSV + otra web, sin tope | Igual que Pro |
| Precios masivos con deshacer | — | — | Sí | Sí |
| Promos programadas / cupones | — / 3 | 10 / 20 | Sin tope | Sin tope |
| GA4, GTM, Meta Pixel | — | Sí | Sí | Sí |
| Dominio propio, auditoría, export CSV | — | — | Sí | Sí |
| Zonas por mapa, remitos, legales AR, checkout WhatsApp | Sí | Sí | Sí | Sí |

Los precios son de ejemplo (spec §14.1): **el precio real lo decidís vos**. En todo el copy público, mandá a `/planes` en vez de escribir el número, así no queda desactualizado en posts viejos.

---

## 1. Posicionamiento

**En una frase.** Ecommy es la tienda online para comercios argentinos que ya venden por WhatsApp y transferencia: tu catálogo con tu marca, cada pedido registrado y sin comisión por venta.

**En un párrafo.** La mayoría de las pymes argentinas ya vende: por Instagram, por WhatsApp, en el local. Lo que les falta no es una pasarela, es orden. Ecommy les da una tienda con su marca donde el cliente ve precio, stock y envío, arma el pedido y paga como ya paga (transferencia con descuento o acordándolo por WhatsApp). El pedido queda registrado y le llega al comercio armado, con total y dirección. Ecommy no cobra comisión por venta, trae de fábrica lo que la ley argentina exige (botón de arrepentimiento, precio sin impuestos nacionales, Data Fiscal) y resuelve las tareas que en Argentina se hacen todas las semanas: actualizar precios por inflación, cargar la lista del proveedor y cobrar el envío según el barrio.

**Promesa.** Armás la tienda en una tarde con tu catálogo, compartís el link y los pedidos te llegan ordenados. Cobrás como ya cobrás, sin que nadie se quede con un porcentaje.

**Categoría en la que competimos.** "Tienda online para pymes y emprendedores en Argentina". No competimos como "plataforma de e-commerce global" ni como "catálogo de WhatsApp". El lugar es el medio: más que el catálogo de WhatsApp Business, más simple y más barato de operar que una tienda con pasarela.

### A quién NO le sirve (decilo sin vueltas)

Decirlo ahorra soporte, reembolsos y malas reseñas. Si el prospecto cae acá, recomendale otra cosa.

1. **Necesita cobrar con tarjeta y en cuotas dentro de la tienda.** Hoy no hay pasarela. Se puede mandar un link de pago de Mercado Pago por WhatsApp, a mano y fuera de Ecommy. Si más de la mitad de sus ventas son con tarjeta online, todavía no es para él.
2. **Despacha muchos paquetes por correo y necesita etiquetas y cotización automática** (OCA, Andreani, Correo Argentino). No está.
3. **Vende fuerte en Mercado Libre y necesita sincronizar stock.** No hay integración.
4. **Necesita facturación electrónica automática por cada venta.** Sigue con su sistema de facturación.
5. **Depende de apps de terceros** (reseñas, fidelización, ERPs) o de una API. No hay app store ni API pública.
6. **Vende productos digitales o servicios con turnos.**
7. **Vende mayorista con listas de precio por cantidad.** El estilo Galpón sirve para mostrar el catálogo, pero los precios escalonados por cantidad todavía no existen.

---

## 2. Perfiles de cliente ideal (ICP)

### 2.1 La marca de ropa que vende por Instagram y WhatsApp

- **Quién.** Marca propia o multimarca chica, 1 a 3 personas, 30 a 300 productos con talle y color. Vende por DM de Instagram y por WhatsApp, cobra a un alias, despacha por moto o correo, a veces tiene showroom.
- **Situación actual.** El catálogo son las historias destacadas y el catálogo de WhatsApp Business. El stock está en la cabeza o en una planilla. Cada venta empieza con "precio?" y "¿tenés en M?".
- **Dolor.** Responde lo mismo 40 veces por día. Se le mezclan pedidos entre chats. Vende algo que no tenía en ese talle. No puede pautar bien porque no tiene dónde mandar el tráfico ni un Pixel que mida.
- **Disparador de compra.** Lanzamiento de temporada o de colección, un drop, un Hot Sale, un pedido que se perdió, la primera vez que quiere pautar en serio.
- **Qué le mostramos.** Variantes talle × color con stock por variante. Estilo Atelier o Editorial. Checkout que termina en WhatsApp con el pedido armado. Precio con transferencia visible desde la card. Meta Pixel cargando sólo el ID (Starter).
- **Plan probable.** Starter; Pro si quiere dominio propio o pasa los 500 productos.

| Objeción | Respuesta |
| --- | --- |
| "Mis clientas compran por WhatsApp, no en una web." | Y lo van a seguir haciendo. La tienda no reemplaza el chat: el pedido llega al WhatsApp armado, con talle, color, total y dirección. Vos dejás de preguntar "¿qué talle?". |
| "Ya tengo el catálogo de WhatsApp Business." | No tiene talles con stock, no calcula el envío y no registra el pedido. Probalo 14 días al lado del catálogo y comparás. |
| "No tengo tiempo de cargar todo." | Cargás los 20 que más vendés y compartís. El resto lo sumás de a poco; la tienda funciona desde el primer producto. Si ya tenés una planilla, la subís en CSV. |
| "No sé de diseño." | Elegís el rubro y arranca con un estilo pensado para ropa: fotos grandes, sin adornos. Cambiás logo y colores y listo. |
| "¿Y si después no pago?" | Pasás a Free: no se borra nada. Hasta 50 productos es gratis. |

### 2.2 La ferretería o casa de electro de barrio con la lista del proveedor en Excel

- **Quién.** Comercio con local, 1 a 5 personas, 300 a 3.000 artículos, varios proveedores que mandan listas en Excel. Clientes del barrio que preguntan por WhatsApp si hay stock y cuánto sale.
- **Situación actual.** Sin web o con una web vieja sin precios. Publica en Facebook o Marketplace de vez en cuando. Actualiza precios a mano cada vez que llega una lista.
- **Dolor.** La inflación: la lista cambia todas las semanas y actualizar 800 precios es un día perdido. Pasar precios por WhatsApp uno por uno. El corralón de la avenida ya tiene web.
- **Disparador de compra.** Llega una lista con aumento. Un cliente le pide "pasame el link". Se va el empleado que sabía los precios.
- **Qué le mostramos.** CSV que actualiza precio y stock por SKU (Starter). Cambio masivo "+8 % a Herramientas eléctricas" con redondeo, vista previa y Deshacer (Pro). Importar el catálogo desde la web del proveedor, si tiene permiso (Pro). Estilo Nórdico o Galpón con SKU y marca a la vista. Zona de reparto dibujada sobre el barrio y retiro en el local.
- **Plan probable.** Starter si le alcanza el CSV; Pro si quiere precios masivos o traer el catálogo desde la web del proveedor.

| Objeción | Respuesta |
| --- | --- |
| "Cargar 800 productos es imposible." | No los cargás uno por uno: guardás la planilla como CSV desde Excel y la subís (columnas como código, nombre, precio y stock se reconocen solas) o, si el proveedor tiene web, la importás desde ahí. Antes de aplicar ves qué se crea y qué se actualiza. |
| "Los precios cambian todas las semanas." | Subís la lista nueva por SKU y se actualizan precio y stock de una. O aplicás un % a una categoría. Si te equivocaste, Deshacer vuelve todo como estaba. |
| "Mis clientes no compran por internet." | Buscan el precio por internet y te escriben por WhatsApp. Con la tienda ven precio y stock, y el pedido te llega armado. Muchos van a elegir retirar en el local. |
| "¿Me hace las facturas?" | No. Seguís facturando con tu sistema; Ecommy registra el pedido y el pago. |
| "¿Y si el proveedor no me deja usar sus fotos?" | Importá sólo lo que tengas permiso de usar; el panel lo avisa antes de importar. Pedíselo por escrito: la mayoría de los distribuidores lo autoriza porque les vende más. |

### 2.3 La emprendedora de artesanías o deco que hoy está en Tiendanube

- **Quién.** Cerámica, textiles, velas, mates, objetos. 20 a 150 productos, ventas por Instagram y ferias. Tiene tienda en Tiendanube (u otra plataforma) y paga plan mensual; según su plan, además un costo por venta **[VERIFICAR el esquema de costos vigente de Tiendanube antes de decirlo en público]**.
- **Situación actual.** La mayoría de las ventas terminan en transferencia o en "te escribo por privado". Usa poco de lo que paga.
- **Dolor.** Siente que paga por funciones que no usa y que cada venta le deja menos. Rearmar la tienda en otro lado le da miedo: perder fotos, textos y lo que ganó en Google.
- **Disparador de compra.** Aumento del plan o del costo por venta, un mes flojo, el cierre de una temporada de ferias.
- **Qué le mostramos.** Sin comisión por venta. Importador desde su web actual con "Detectar" (ve qué se puede traer antes de importar). Redirecciones 301 que se cargan en CSV para no perder los links viejos. Estilo Mercado. Descuento por transferencia visible desde la card.
- **Plan probable.** Starter para arrancar; Pro durante la migración (el importador web es Pro y la prueba de 14 días lo incluye).

| Objeción | Respuesta |
| --- | --- |
| "Migrar es un lío." | Pegás la dirección de tu tienda actual y tocás "Detectar": te muestra qué productos se pueden traer antes de importar. Si no se puede, exportás el CSV de tu tienda actual y lo adaptás a la plantilla de Ecommy: columnas en castellano como nombre, precio, stock o código se reconocen solas; las variantes hay que acomodarlas. **[VERIFICAR el importador web con 2 o 3 tiendas Tiendanube reales antes de prometerlo en público.]** |
| "Voy a perder lo que tengo en Google." | Cargás las redirecciones 301 de las direcciones viejas a las nuevas (también por CSV). Para eso hace falta el dominio propio apuntando a Ecommy (Pro). |
| "¿Y mis clientas que pagan con tarjeta?" | Hoy no hay pasarela. Podés mandar un link de pago de Mercado Pago por WhatsApp. Si la tarjeta es la mayoría de tus ventas, esperá: te aviso cuando esté. |
| "Tiendanube tiene de todo." | Sí, tiene más cosas, incluidas apps. Ecommy trae lo que un comercio chico en Argentina usa todas las semanas, sin comisión por venta. Probalo 14 días con tu catálogo real al lado de tu tienda actual. |
| "¿Y si Ecommy cierra?" | Tus pedidos y clientes se exportan en CSV (Pro), y tu dominio es tuyo. |

---

## 3. Mensajes por diferencial

Cada mensaje: qué decir, el dato que lo respalda, dónde se prueba en el producto y qué NO decir.

| # | Diferencial | Mensaje | Dato que lo respalda | Dónde se muestra | No decir |
| --- | --- | --- | --- | --- | --- |
| 1 | Sin comisión por venta | "Lo que vendés es tuyo. Ecommy no cobra comisión por venta." | No hay pasarela: la plata va de la cuenta del comprador a la del comercio | Checkout de la demo | "Gratis para siempre" (sólo Free lo es), "cero costos" |
| 2 | Cobrás como ya cobrás | "Transferencia con descuento o acordar por WhatsApp. El pedido queda registrado antes de derivar y te llega armado." | Checkout de dos métodos; `/pedido/<token>` con monto y datos bancarios con botón Copiar | Checkout y página de pedido de la demo | "Cobrás con tarjeta" |
| 3 | 14 días de Pro sin tarjeta | "Probás todo Pro 14 días. No te pedimos tarjeta. Si no elegís plan, pasás a Free sin perder nada." | Trial automático en `create_store()`; vencimiento en `current_plan()` | `/admin/plan` | "Gratis para siempre con todo" |
| 4 | Traés tu catálogo | "Subí tu planilla o importá desde tu web actual. Antes de aplicar, ves qué se crea." | CSV crear/actualizar por SKU (Starter); importador web WooCommerce, Shopify y datos estructurados (Pro) | `/admin/importar` | "Importamos cualquier tienda", "en un clic" |
| 5 | Envíos por zona dibujada | "Dibujá tu zona de reparto sobre el mapa y poné el costo. El checkout calcula el envío solo." | Zonas por polígono, provincia o CP, retiro en el local, envío gratis desde un monto | `/admin/envios` | "Integrado con correos" |
| 6 | Precios masivos con deshacer | "Subí un 8 % a una categoría con redondeo. Si te equivocaste, Deshacer." | `undo_price_batch`; también deshace precios de importaciones (Pro) | `/admin/precios` y su historial | "Actualización automática de precios" (no se conecta con nadie) |
| 7 | Cumplimiento legal AR incluido | "Botón de arrepentimiento, precio sin impuestos nacionales, Data Fiscal y Defensa del Consumidor, en todos los planes." | Footer del storefront, bandeja de arrepentimientos, `/admin/configuracion/legales` | Footer de la demo | "Te cubre legalmente", "no necesitás abogado" |
| 8 | 10 estilos por rubro | "Diez estilos pensados por rubro: ropa, ferretería, farmacia, vinoteca, mueblería. Elegís el rubro y arranca con el suyo." | `PRESET_LIST` y `STORE_KINDS` | Alta de tienda y `/admin/apariencia` | "Miles de plantillas", "diseño a medida" |
| 9 | Stock que no se traba | "Si no te pagan en el plazo que elegiste, el pedido se cancela solo y el stock vuelve." | Reserva con vencimiento + barrido diario | Config de checkout | — |
| 10 | Hecho para Argentina | "Pesos, alias y CBU validados, WhatsApp, zonas por barrio y la ley argentina de fábrica." | Validación de CBU, alias y CUIT; todo lo anterior | Configuración de pagos | "Hecho por argentinos para argentinos" sin dato |

**Orden de los mensajes según el ICP.** Ropa: 2 → 8 → 3. Ferretería o electro: 6 → 4 → 5. Artesanías que migra: 1 → 4 → 3.

---

## 4. Comparativa de mensajes frente a la competencia

Regla: comparar sólo lo que podés sostener con una captura o un link. Precios y planes ajenos cambian seguido: **todo lo marcado [VERIFICAR] se chequea en la web oficial la semana en que se publica** y se guarda la captura con fecha. Nunca uses logos ni marcas ajenas en piezas gráficas; en texto, nombrar al competidor está bien si es cierto y comparable.

| Tema | Lo que podés decir | Respaldo | Estado |
| --- | --- | --- | --- |
| Comisión | "Ecommy no cobra comisión por venta." | Producto | Seguro |
| Comisión de Tiendanube, Empretienda o Shopify | "En otras plataformas, según el plan, hay un costo por venta." | Ninguno en el audit | **[VERIFICAR]** en cada página de precios; si no lo confirmás, no lo digas |
| Checkout por WhatsApp | "En Tiendanube y Shopify, derivar el checkout a WhatsApp con el pedido armado requiere una app; en Ecommy viene de fábrica." | `FEATURES-AUDIT.md` §1.7 [TN-wa] | Seguro a sep-2026, re-chequear |
| Importar desde otra tienda | "Tiendanube ofrece migración asistida; Ecommy importa el catálogo desde tu web actual." | §1.1 [TN-migrar] | Re-chequear |
| Envíos por mapa | "La entrega local de Shopify es por radio o código postal; en Ecommy dibujás el polígono." | §1.6 [SH-local] | Seguro a sep-2026 |
| Envíos por mapa, Tiendanube | Nada: el audit no lo pudo confirmar (`s/d`). | — | No comparar |
| Deshacer precios masivos | "Cambiás precios en masa y lo deshacés con un botón." (sin nombrar a nadie) | Producto | Seguro; no digas "nadie más lo tiene" |
| Legal AR | "Todo lo que exige la ley argentina, incluido en todos los planes." Frente a Shopify: "no trae botón de arrepentimiento ni Data Fiscal." | §1.7 y §1.12 [TN-arrep] [TN-datafiscal] | **Ojo:** Tiendanube también lo trae gratis. No es diferencial frente a Tiendanube |
| Precio con transferencia en la card | No es diferencial: Tiendanube y Empretienda también lo muestran. | §1.3 [TN-preciodesc] [EM-transf] | Paridad: no comparar |
| CSV | No es diferencial: Tiendanube también tiene CSV (no en su plan gratis, igual que Ecommy). | §1.1 [TN-csv] | Paridad |
| Auditoría | "Registro de quién cambió qué en tu tienda." (sin comparar) | Producto (Pro) | Seguro |
| Lo que ellos tienen y Ecommy no | Pasarela, cuotas, correos, carritos abandonados, precios mayoristas, apps. | §3 | Decilo si te preguntan; no lo escondas |

**Mensaje de comparación recomendado** (landing futura `/alternativa-a-tiendanube`, posts y respuestas): "Si vendés por transferencia y WhatsApp, pagá por eso y nada más. Si necesitás tarjeta en cuotas dentro de la tienda, hoy Tiendanube te sirve más." La honestidad compra confianza y filtra a quien se va a ir en un mes.

---

## 5. Pricing: cómo comunicarlo

### 5.1 Cómo presentar cada plan

| Plan | Para quién (una línea) | Lo que lo define en el copy |
| --- | --- | --- |
| Free | "Para probar con tus primeros 50 productos." | $ 0, sin vencimiento, 2 estilos, checkout WhatsApp y transferencia, zonas por mapa, legales. Sin importador ni Pixel |
| Starter | "Para vender todos los días." | 500 productos, los 10 estilos, CSV, promos y cupones, Meta Pixel y GA4, 3 usuarios |
| Pro | "Para el que actualiza precios cada semana o tiene catálogo grande." | Productos ilimitados, precios masivos con deshacer, importar desde otra web, dominio propio, export, auditoría |
| Business | "Para varias sucursales, catálogos muy grandes o necesidades a medida." | Se habla por WhatsApp |

- **La prueba es el producto.** Todo el copy empuja a "Crear tu tienda" y a probar Pro 14 días, no a elegir plan el día 1. Frase: "Probás todo Pro 14 días, sin tarjeta. Después elegís: si no pagás nada, pasás a Free y no perdés nada."
- **Antes de que venza la prueba** (día 10 y día 13), el mensaje dice qué va a dejar de funcionar según lo que la tienda usa de verdad ("Tenés 212 productos: en Free se quedan visibles pero no podés crear más de 50"). Hoy es manual por WhatsApp; cuando estén los emails, automatizarlo.
- **Precio en el copy:** mandá a `/planes`. Si lo escribís, "desde $ X por mes, precio final", nunca "a partir de" sin decir qué incluye.
- **Cobro hoy:** manual. "Quiero este plan" en `/admin/plan` abre tu WhatsApp; cobrás por transferencia y activás el plan en `/platform/tiendas/<id>`. Decilo como ventaja: "Pagás por transferencia, como tus clientes".

### 5.2 ¿Plan anual? Sí, pero con cuidado por la inflación

**Recomendación:** ofrecé desde el lanzamiento un **pago anual por transferencia con 2 meses bonificados** (pagás 10, usás 12, ≈ 17 % menos) sólo en Starter y Pro.

- **A favor:** te adelanta caja (clave con un solo fundador), baja el churn de los primeros meses y te ahorra 11 cobros manuales por cliente mientras no esté Mercado Pago.
- **En contra:** con inflación, un precio congelado 12 meses se come tu margen. Mitigación: (a) el descuento anual no pasa del 2 × 12; (b) revisás el precio de lista cada trimestre y el anual se ajusta sólo al renovar; (c) si la inflación mensual sube mucho, cambiá a semestral con 1 mes bonificado.
- **Cómo presentarlo:** debajo del precio mensual, una línea: "Pagando el año por transferencia: 12 meses por el precio de 10". Sin tachados gigantes, sin contador regresivo.
- **Precio fundador para la beta** (decisión tuya): los 10 comercios de la beta mantienen el precio de lista del día que pagan durante 12 meses. Es real, es simple de cumplir a mano y no inventa escasez.
- **Qué hace falta en el producto:** hoy `/planes` sólo muestra el precio mensual. Mostrar la opción anual es un cambio de copy en `PlanCards` (fuera de este kit); mientras tanto, se ofrece por WhatsApp.

---

## 6. SEO

### 6.1 Estado y límites

La plataforma hoy tiene dos páginas indexables: `/` y `/planes` (más `robots.ts` y `sitemap.ts` en la raíz). Todas las keywords que no sean de marca o de "tienda online" genérica necesitan **páginas nuevas** (lista en §6.3). No inventes volúmenes: antes de priorizar, medí con Google Keyword Planner (necesita la cuenta de Google Ads) y, después del lanzamiento, con Search Console.

### 6.2 Keywords objetivo

Intención: **T** transaccional (quiere crear la tienda ya), **C** comercial (compara opciones), **I** informacional (quiere aprender).

| # | Keyword | Intención | Página que la ataca |
| --- | --- | --- | --- |
| 1 | crear tienda online argentina | T | `/` |
| 2 | crear tienda online gratis | T | `/` |
| 3 | tienda online sin comisiones | T | `/` |
| 4 | crear tienda online argentina sin comisiones | T | `/` |
| 5 | armar tienda online para mi emprendimiento | T | `/` |
| 6 | tienda online con pago por transferencia | T | `/funciones/cobrar-por-transferencia` |
| 7 | tienda online transferencia bancaria descuento | T | `/funciones/cobrar-por-transferencia` |
| 8 | tienda online con pedidos por whatsapp | T | `/funciones/pedidos-por-whatsapp` |
| 9 | catálogo online para whatsapp | T | `/funciones/pedidos-por-whatsapp` |
| 10 | carrito de compras que manda el pedido a whatsapp | T | `/funciones/pedidos-por-whatsapp` |
| 11 | precios de plataformas de tienda online | C | `/planes` |
| 12 | cuánto cuesta una tienda online en argentina | C | `/planes` + guía |
| 13 | alternativa a tiendanube | C | `/alternativa-a-tiendanube` |
| 14 | tiendanube sin comisión | C | `/alternativa-a-tiendanube` |
| 15 | migrar tienda de tiendanube | C | `/funciones/importar-catalogo` |
| 16 | alternativa a empretienda | C | `/alternativa-a-empretienda` |
| 17 | shopify en argentina | C | `/guias/shopify-en-argentina` |
| 18 | importar productos desde excel a tienda online | T | `/funciones/importar-catalogo` |
| 19 | actualizar precios masivamente tienda online | T | `/funciones/precios-masivos` |
| 20 | actualizar lista de precios del proveedor | I | guía + `/funciones/precios-masivos` |
| 21 | zonas de envío por barrio tienda online | T | `/funciones/envios-por-zona` |
| 22 | calcular costo de envío por zona | I | `/funciones/envios-por-zona` |
| 23 | botón de arrepentimiento tienda online | I | `/guias/tienda-online-legal-argentina` |
| 24 | precio sin impuestos nacionales tienda online | I | `/guias/tienda-online-legal-argentina` |
| 25 | data fiscal tienda online | I | `/guias/tienda-online-legal-argentina` |
| 26 | tienda online para ferretería | T | `/rubros/ferreteria` |
| 27 | tienda online para marca de ropa | T | `/rubros/ropa` |
| 28 | tienda online para vinoteca | T | `/rubros/vinoteca` |
| 29 | tienda online para mueblería | T | `/rubros/muebleria` |
| 30 | vender por instagram y whatsapp con tienda online | I | guía |

**Páginas `/rubros/*`:** una por preset (10). Cada una muestra el estilo real con capturas, qué resuelve para ese rubro y un CTA que crea la tienda con ese rubro preseleccionado. Es contenido único y verdadero: el estilo existe y está pensado para ese rubro.

### 6.3 Páginas nuevas a construir (fuera de este kit, para el dev)

`/funciones/cobrar-por-transferencia`, `/funciones/pedidos-por-whatsapp`, `/funciones/importar-catalogo`, `/funciones/precios-masivos`, `/funciones/envios-por-zona`, `/alternativa-a-tiendanube`, `/alternativa-a-empretienda`, `/rubros/<rubro>` (10) y una sección `/guias`. Todas con título ≤ 60, descripción ≤ 155, OG con captura real, entrada en `sitemap.ts` y un CTA a `/registro`.

### 6.4 Diez artículos o páginas de contenido

| # | Título | Ángulo | Keyword principal |
| --- | --- | --- | --- |
| 1 | Cómo armar tu tienda online en una tarde (con capturas de cada paso) | Tutorial real sobre Ecommy, del registro al primer link compartido, cronometrado | crear tienda online argentina |
| 2 | Cobrar por transferencia en tu tienda online: descuento, alias y comprobante | Cómo mostrar el precio con transferencia desde la card, qué datos pedir, cómo conciliar | tienda online transferencia bancaria |
| 3 | Pedidos por WhatsApp sin perder ninguno | Del catálogo de WhatsApp al pedido registrado: qué cambia y qué no | tienda online con pedidos por whatsapp |
| 4 | Cómo actualizar la lista de precios del proveedor sin perder un día | CSV por SKU, % por categoría con redondeo, deshacer; plantilla CSV descargable | actualizar precios masivamente |
| 5 | Qué exige la ley a una tienda online en Argentina (2026) | Botón de arrepentimiento, precio sin impuestos nacionales, Data Fiscal, Defensa del Consumidor, con links al Boletín Oficial. Revisado por un abogado antes de publicar | botón de arrepentimiento tienda online |
| 6 | Cómo definir zonas y costos de envío si repartís vos | Dibujar el barrio, retiro en el local, envío gratis desde un monto, qué pasa fuera de zona | zonas de envío tienda online |
| 7 | Tiendanube, Empretienda o Ecommy: cuál te conviene según cómo cobrás | Comparativa honesta con tabla y fecha; cuándo NO elegir Ecommy | alternativa a tiendanube |
| 8 | Cómo migrar tu tienda sin perder lo que ganaste en Google | Importar, redirecciones 301, dominio, checklist | migrar tienda online |
| 9 | Fotos de producto con el celular para tu tienda (sin estudio) | Guía práctica; co-escrita con un fotógrafo aliado (canal de alianzas) | fotos de producto con celular |
| 10 | Cuánto cuesta de verdad tener una tienda online en Argentina | Costos fijos, costos por venta, dominio, fotos, tiempo; con planilla para calcular | cuánto cuesta una tienda online |

Regla de contenido: cada artículo tiene al menos una captura real del producto, fecha de actualización visible y cero datos de mercado sin fuente.
