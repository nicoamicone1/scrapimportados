# Ecommy · Plan Go-To-Market para los primeros 10-15 clientes pagos

Fecha: 2026-10-06. Base: landing y /planes públicos, código del repo (v0.10.0: planes, trial, onboarding, emails, tesis de producto), tienda demo, y 3 investigaciones independientes (ICP, competencia, adquisición). Leyenda: **[H]** hecho verificado con fuente · **[Hip]** hipótesis · **[R]** recomendación.

---

## 1. Executive Summary

**Decisión central:** Ecommy se vende como **el sistema de pedidos para marcas de ropa que venden por Instagram y WhatsApp**. No como tienda online, no como plataforma de ecommerce, y todavía no como "sistema operativo".

**Por qué:**
- La tienda online es commodity: Tiendanube tiene plan gratis sin límite de productos, Empretienda cobra $10.490 todo incluido, y "sin comisión" lo dicen Empretienda, Pedix, Changuito y WhatsPedidos [H].
- El dolor que nadie resuelve bien es el de la marca que vende por DM: "¿cuántas de la M me quedan?", stock vendido dos veces, 40 veces la misma respuesta, el pedido en siete lugares [H, citas en §3]. Ese dolor sólo existe con intensidad donde hay variantes talle × color: moda.
- Ecommy ya tiene construido exactamente eso (variantes con stock, pedido registrado antes de WhatsApp, Responder, Hoy, remitos, transferencia con descuento 0 %) [H, código].

**Lo que hay que cambiar primero (sin código):** una tienda demo de ropa, un above-the-fold que hable de pedidos y no de "orden", y una oferta de puesta en marcha asistida que elimine la fricción de cargar el catálogo.

**Cómo se consiguen los 10 clientes:** 100 prospectos calificados sacados de ferias (EmprenZona, Puro Diseño), hashtags y Google Maps; DM personalizado que abre conversación, no vende; demo de 10 minutos con **su** catálogo ya cargado; cierre con Plan Fundador (Starter, precio congelado 12 meses, catálogo cargado por vos, garantía de primer pedido).

**Métrica de activación:** primer pedido real (web, no cancelado, de alguien que no es el dueño). Ya existe la consulta SQL en el repo.

**Meta 30 días:** 100 prospectos → 40 conversaciones → 20 demos → 12 tiendas con catálogo cargado → 8 con pedido real → 6 a 10 pagando.

---

## 2. Diagnóstico (Fase 1: auditoría)

### Hechos relevados

| Área | Hecho [H] | Problema |
| --- | --- | --- |
| Hero | "Vendés por WhatsApp e Instagram. Ahora, con orden." + "Tu cliente arma el pedido en tu tienda y paga como siempre…" | "Orden" es abstracto. El beneficio concreto (el pedido te llega armado, con talle, total y dirección) está en la bajada, no en el título |
| CTA principal | "Crear tu tienda gratis" | Vende la tienda, que es lo commodity. El prospecto ya tiene "tienda": las historias destacadas |
| Prueba social | Ninguna (correcto, por regla del kit) | La demo es la única prueba, y es de electro y bazar, no de ropa |
| Pricing | Al auditar: Free (50 prod, variantes, cupones, zonas, remitos, checkout por transferencia) · Starter $14.999 · Pro $34.999 · Trial Pro 14 días sin tarjeta. Decidido y aplicado en esta rama: Free 25 productos, remitos y Responder desde Starter (migración 0024) | Free es demasiado bueno para el ICP moda (30 a 150 productos con variantes): puede vivir gratis para siempre. Starter cuesta 43 % más que Empretienda ($10.490) sin que la landing diga por qué |
| Onboarding | Registro 3 datos → alta de tienda en 2 pasos → checklist de 6 pasos (producto, apariencia, envíos, cobros, inicio, compartir) | El checklist pone "Personalizá la apariencia" antes que "Compartí". Para un vendedor por DM el único paso que importa es: 20 productos cargados y link compartido en una historia |
| Emails de activación | Sin productos a las 48 h; "compartí tu tienda" al día 7; aviso de fin de prueba a 3 días y 1 día | Entre el día 2 y el día 7 no pasa nada. El 90 % del abandono ocurre ahí [Hip] |
| Conversión a pago | "Quiero este plan" → WhatsApp del fundador o Mercado Pago Suscripciones | Bien. El cobro manual es una ventaja en esta etapa: cada upgrade es una conversación |
| Diferenciación real (código) | Pedido registrado antes de derivar a WhatsApp; stock por variante con reserva que vence; Responder (respuestas listas con stock, precio y link); Hoy con "Resolver desde acá"; precios masivos con Deshacer; transferencia con descuento a 0 % real; remitos; legales AR | Casi nada de esto está above-the-fold. Responder y Hoy son las dos cosas que ningún competidor directo tiene y aparecen como escenas secundarias |
| Analítica de la landing | Variable `NEXT_PUBLIC_PLATFORM_GA4_ID` existe; verificar que esté cargada en producción | Sin eventos de registro no se puede medir el funnel desde el día 1 |

### Respuestas

1. **¿Qué vende realmente Ecommy hoy?** Una tienda online argentina sin comisión, con un relato de "orden" encima. El visitante la lee como "otra Tiendanube más barata".
2. **¿Qué debería vender?** Que el pedido deje de depender del chat: el cliente lo arma solo, con talle y color, el stock baja solo, el pedido te llega armado y vos lo resolvés en un toque. La tienda es el medio; el pedido es el producto.
3. **¿Problema más urgente que resuelve?** La pérdida y el desorden de pedidos que entran por DM y WhatsApp: stock vendido dos veces, pedidos olvidados, horas respondiendo "¿precio? ¿tenés en M?". Es urgente porque cuesta plata y tiempo hoy, no en el futuro.
4. **¿Qué parte es commodity?** Tienda, catálogo, carrito, variantes, cupones, zonas de envío, Mercado Pago, botón de WhatsApp, "sin comisión", trial sin tarjeta, dominio propio, CSV, estilos. Todo lo que aparece en /planes lo tiene alguien más [H, Agente B].
5. **¿Cuál podría ser el wedge?** El circuito **consulta por WhatsApp → respuesta lista con stock y link → el cliente arma el pedido → te llega registrado → lo resolvés desde Hoy**. Es el único recorrido que arranca donde el comerciante ya está (el chat) y nadie lo cubre: el catálogo de WhatsApp no tiene stock ni variantes, Tiendanube requiere apps, Pedix y Changuito nacieron para gastronomía [H].
6. **¿Qué mensaje eliminarías?** "Crear tu tienda gratis" como CTA principal; "Un pedido, siete lugares" como sección de concepto (la idea es buena, pero compite con el hero por atención); la lista de funciones en /planes como argumento de venta (Precio mayorista, CSS propio, auditoría no le importan a quien recién llega); "De cero a tu primer pedido, en una tarde" (promete un tiempo que vos todavía no medís).
7. **¿Qué debería aparecer above-the-fold?** Headline sobre el pedido (ver §6), una captura real de un pedido de ropa llegando armado a WhatsApp con talle y color, un CTA que hable de **su** catálogo ("Cargamos tu catálogo y lo probás con tus clientas") y una tienda demo de ropa. Las tres garantías que ya están (14 días de Pro, sin comisión, Free después) quedan.

---

## 3. ICP elegido

**Marca de ropa chica que vende por Instagram y WhatsApp, en Argentina.**

| Dimensión | Perfil |
| --- | --- |
| Quién | Marca propia o showroom multimarca, 1 a 3 personas, dueña al frente. 67 % de los emprendedores argentinos son mujeres, 56 % sin local, 53 % trabajan solos [H, NubeCommerce 24/25] |
| Catálogo | 30 a 300 productos, casi todos con talle y color. Drops o colecciones por temporada |
| Cómo vende hoy | Instagram es la vidriera (historias, destacadas "CATÁLOGO", "CÓMO COMPRAR"), el pedido se cierra por DM o WhatsApp, cobra por alias, despacha por moto o correo, a veces showroom con turno |
| Volumen | 5 a 50 pedidos por día en los casos documentados (Te Mimo Mucho, Rosario: 30 a 50 por día [H]). Sin dato para la mediana del segmento |
| Capacidad de pago | Moda es la categoría #1 de Tiendanube en Argentina: 33,8 % de las tiendas y $850.047 millones en 2025 [H, Forbes/Storeleads]. Ya pagan Canva, pauta en Meta, fotógrafo |
| Dolor literal | "Tardaban mucho en contestar a cada cliente, mandarles fotos, explicarles los talles" (mayorista de Flores, tesis UdeSA) [H]. "¿Cuántas de la M me quedan? No lo sabés. Scrolleás WhatsApp buscando un mensaje de hace 3 días" (Spom, proveedor AR) [H] |
| Disparador | Drop o temporada nueva, Hot Sale/CyberMonday, un pedido que se perdió, la primera vez que quiere pautar en serio, el cierre de Mercado Shops (31/12/2025) [H] |
| Dónde está | AMBA (Palermo, Villa Crespo, Flores), Córdoba (Nueva Córdoba), Rosario (Pichincha), ferias de diseño. ~1.000 showrooms por ciudad grande según prensa [H, Infonegocios] |
| Señal de que es ella | Bio con "pedidos por DM/WhatsApp", destacadas con catálogo, historias "VENDIDO" o "último!", link wa.me o Linktree sin tienda |

**A quién no:** gastronomía (dolor de agenda, no de stock; Pedix y WhatsPedidos ya están), artesanos de pieza única (sin variantes, baja capacidad de pago), quien necesita etiquetas de correo automáticas o sincronizar con Mercado Libre (Ecommy no lo tiene y lo dice).

---

## 4. Competencia

Relevado el 06/10/2026. Precios en ARS por mes salvo indicación.

| Competidor | Precio | Comisión | Mensaje | Dónde gana | Dónde pierde frente a Ecommy |
| --- | --- | --- | --- | --- | --- |
| Tiendanube [H] | Inicial $0 · Esencial $27.999 · Impulso $79.999 · Escala $244.999 | 2 % / 1 % / 0,7 % con otros medios; 0 % con Pago Nube. Agente B reporta que Pago Nube cobra la transferencia 1,50 % + IVA en Inicial y Esencial, y que las órdenes manuales con pago confirmado generan costo [H, centro de ayuda; sacar captura antes de usarlo en público] | "Vendé mucho más por WhatsApp, con IA, catálogo y pagos integrados" | 180 mil tiendas, 150 integraciones, plan gratis sin límite de productos, Chat Nube con IA | Plan gratis atado a Pago Nube; ajuste de precios trimestral por inflación [H]; soporte por WhatsApp sólo desde $79.999; Trustpilot 2,0 con quejas de retención de fondos [H] |
| Empretienda (Ualá) [H] | $10.490 plan único, 15 días gratis | 0 % | "Creá tu tienda online y vendé sin comisiones a $10.490" | Precio más bajo, mensaje simple, "+390 mil emprendedores" | Es una tienda, nada más: sin Responder, sin Hoy, sin remitos como primera pantalla. Límites de usuarios y variantes no verificados |
| Changuito [H] | $29.000 / $37.700 / $72.500, 10 días gratis | 0 % | "Dejá de regalar comisiones. Vendé directo por WhatsApp." | Mismo relato anti-comisión, IA, POS, factura electrónica, prensa en octubre 2026 | El doble de precio que Starter y disperso en verticales (peluquerías a mayoristas). **Es el rival a vigilar** |
| Pedix [H] | $19.000 / $25.500 / $35.000 | 0 % | "Vendé mejor sin pagar comisión" | 3.000 tiendas, pedido a WhatsApp, impresión térmica | ADN gastronómico; sin talles ni remitos al frente |
| WhatsPedidos [H] | USD 0 / 22 / 30 | 0 % | "Vendé más por WhatsApp sin perder pedidos ni tiempo" | Plan gratis | Bares y cócteles; precio en dólares |
| Shopify [H] | USD 25 / 65 | 2 % con pasarela externa | "Para emprendedores independientes" | Ecosistema global | Dólar, Mercado Pago vía app, soporte en inglés |
| Mercado Libre "Mi página" [H] | $15.999 tras 3 meses gratis (reemplaza Mercado Shops, cerrado 31/12/2025) | Comisiones de ML por venta | — | Tráfico de ML | No es tienda propia. Los ex Mercado Shops son prospectos |
| WhatsApp Business catálogo + Meta [H] | $0 | — | — | Nativo y gratis | Sin stock, sin variantes, tope 500 ítems, sin checkout de Instagram en Argentina desde 08/2023 |
| Planilla + WhatsApp + notas | $0 | — | — | Cero fricción, cero aprendizaje | Es el verdadero competidor. Pierde cuando el volumen pasa los ~10 pedidos por día o cuando se vende algo dos veces [Hip] |

**Commodity (lo tienen todos o casi):** tienda, catálogo, carrito, variantes, cupones, zonas, Mercado Pago, botón WhatsApp, "sin comisión", trial sin tarjeta, plan gratis, dominio, CSV, analítica, IA en el chat (Tiendanube y Changuito).

**Gaps reales con evidencia:**
- Nadie ofrece "transferencia directa a tu cuenta, 0 % real, con descuento" como núcleo. Ecommy nunca toca la plata: ángulo de confianza directo contra las quejas de retención de fondos de Pago Nube [H].
- No hay checkout nativo de Instagram ni WhatsApp Pay en Argentina; el catálogo de WhatsApp no maneja stock ni variantes. El hueco "el cliente arma el pedido solo con talle y color" sigue abierto [H].
- Soporte humano por WhatsApp desde el plan de $14.999 es un diferenciador barato frente a Tiendanube ($79.999) [H].

**Quejas textuales utilizables (Trustpilot Tiendanube):** "Te cobran comisión aunque se cancele la venta" (08/2025); "Esta empresa se apropia de tu dinero sin motivo" (retención 180 días, 03/2024); "el plan básico no te permite tener un dominio personalizado" (Capterra, 04/2024) [H].

**Posición a ocupar:** sistema de pedidos para quien ya vende en el chat y cobra por transferencia. No competir con Tiendanube en integraciones ni con Empretienda en precio. No entrar en gastronomía.

---

## 5. Beachhead (Fase 3)

Escala 1 a 10. En "competencia", 10 = menos competencia.

| Vertical | Intensidad problema | Volumen | Capacidad pago | Encontrar | Contactar | Urgencia | Competencia | Demostrar ROI | Retención | Expansión | **Total** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Moda femenina chica (showroom, marca propia)** | 9 | 9 | 7 | 9 | 8 | 7 | 5 | 9 | 7 | 8 | **78** |
| Mayoristas Flores/Once a revendedoras | 9 | 7 | 8 | 6 | 5 | 7 | 7 | 8 | 8 | 7 | 72 |
| Retail multimarca de barrio | 7 | 8 | 8 | 4 | 4 | 5 | 6 | 6 | 8 | 8 | 64 |
| Cosmética / skincare | 5 | 7 | 6 | 6 | 7 | 5 | 5 | 6 | 7 | 7 | 61 |
| Accesorios / bijou | 6 | 6 | 4 | 8 | 8 | 5 | 5 | 6 | 5 | 6 | 59 |
| Decoración / hogar | 5 | 6 | 6 | 6 | 7 | 4 | 5 | 6 | 6 | 6 | 57 |
| Importadores / revendedores | 6 | 6 | 6 | 6 | 6 | 5 | 5 | 6 | 4 | 5 | 55 |
| Gastronomía | 6 | 7 | 4 | 8 | 7 | 4 | 2 | 5 | 5 | 4 | 52 |
| Artesanos / ferias | 4 | 3 | 3 | 9 | 8 | 3 | 5 | 4 | 4 | 4 | 47 |
| Impresión 3D / personalizados | 3 | 3 | 5 | 4 | 5 | 3 | 8 | 5 | 6 | 5 | 47 |

**Decisión: moda femenina chica que vende por Instagram y WhatsApp.** Es el único vertical donde el dolor de variantes es nativo, el universo es grande y visible por hashtags y ferias, y la demo de ROI es inmediata (un pedido armado con talle y color vs. el chat). La competencia directa en el mensaje (Changuito) está al doble de precio y dispersa.

**Segundo vertical, después del cliente 10:** mayoristas de Flores/Once/Avellaneda que venden a revendedoras. Ecommy ya tiene precios por cantidad desde Starter (migración 0021) [H, código], contrario a lo que supuso el Agente A. El dolor documentado es idéntico (celular saturado 24 h, stock que se agota el mismo día) y el ticket es más alto. Se deja para después porque requiere mínimo de compra por cliente y hábitos B2B que todavía no probaste.

**Descartados por ahora:** gastronomía (dolor de agenda y comisiones de apps, no de stock; Pedix, WhatsPedidos y Fudo ya están), artesanos (baja capacidad de pago, sin variantes), 3D (el módulo Taller 3D existe pero es un nicho de 47 puntos; no distraigas la adquisición con él).

---

## 6. Posicionamiento (Fase 4)

**Categoría elegida: C, sistema de pedidos.** Formulación exacta: "sistema de pedidos para marcas que venden por Instagram y WhatsApp".

Por qué no las otras:
- **A, plataforma ecommerce:** la categoría más ocupada y cara de explicar. Te compara con Tiendanube y Shopify y perdés en features.
- **B, tienda online:** commodity a $0 (Tiendanube Inicial) y a $10.490 (Empretienda). Si vendés "tienda", el precio es el único argumento y lo perdés.
- **D, sistema operativo para comercios:** es la visión correcta a 12 meses y la tesis interna ya la adoptó. Pero un prospecto frío no compra un "sistema operativo", compra que se le dejen de perder pedidos. D es a dónde vas; C es con qué entrás.
- **E, otra:** "catálogo de WhatsApp" te pone contra algo gratis de Meta.

C nombra el dolor (pedidos perdidos, stock vendido dos veces), tiene demanda validada (Pedix 3.000 tiendas, Changuito con prensa) y deja la tienda como medio, no como promesa.

| Elemento | Texto |
| --- | --- |
| ICP | Marca de ropa chica que vende por Instagram y cierra por WhatsApp |
| Problema | Cada venta empieza con "¿precio? ¿tenés en M?", el stock está en la cabeza o en una planilla, y los pedidos se mezclan entre chats |
| Resultado | El cliente arma el pedido solo, con talle y color. Te llega armado a WhatsApp y registrado en el panel. El stock baja solo. Cobrás por transferencia como siempre, sin comisión |
| Categoría | Sistema de pedidos para marcas que venden por Instagram y WhatsApp |
| Posicionamiento | Para marcas de ropa que venden por Instagram y WhatsApp, Ecommy es el sistema de pedidos que hace que el cliente arme el pedido solo, con talle y color, y que a vos te llegue armado y registrado. A diferencia de una tienda online, no te saca del chat: lo ordena. A diferencia de la planilla, no se equivoca de talle |
| One-liner | Tus clientas te piden por Instagram y WhatsApp. Con Ecommy el pedido te llega armado, con talle, color y total |
| Headline | **Dejá de preguntar "¿qué talle?". El pedido te llega armado.** |
| Subheadline | Tu clienta elige talle y color en tu tienda, paga por transferencia o Mercado Pago, y a vos te llega el pedido a WhatsApp con todo. El stock baja solo. Sin comisión por venta |
| CTA primario | **Cargamos tu catálogo y lo probás 14 días** (lleva a un formulario de 3 campos: Instagram, WhatsApp, cuántos productos) |
| CTA secundario | Ver una tienda de ropa funcionando (demo de ropa, no la de electro) |
| Beneficio 1 | **Nunca más stock vendido dos veces.** Cada talle y color tiene su stock. Cuando se vende, baja. Si no te pagan en el plazo que elegiste, el pedido se cancela solo y el stock vuelve |
| Beneficio 2 | **Respondés en un toque.** Te preguntan "¿tenés la negra en M?": buscás, copiás la respuesta con precio, stock, descuento por transferencia y link. Sin bot: lo mandás vos |
| Beneficio 3 | **Cobrás como siempre, sin comisión.** Transferencia con descuento o tarjeta y cuotas con tu Mercado Pago. La plata nunca pasa por Ecommy |

**Objeciones y respuestas:**

| Objeción | Respuesta |
| --- | --- |
| "Mis clientas compran por WhatsApp, no en una web" | Van a seguir escribiéndote. Lo que cambia es que en vez de preguntar talle, color, dirección y total, les pasás el link y el pedido te llega armado. Probalo con las próximas 10 consultas |
| "Ya tengo el catálogo de WhatsApp Business / las destacadas" | El catálogo de WhatsApp no tiene talles con stock, no calcula envío y no registra el pedido. Las destacadas no bajan stock. Probalo 14 días al lado y comparás |
| "No tengo tiempo de cargar todo" | No cargás nada: me pasás tu Instagram y una lista de precios y te dejo los 30 productos que más vendés cargados antes de la llamada. Después sumás de a poco |
| "Empretienda sale $10.490 / Tiendanube es gratis" | Son tiendas. Si lo que te falta es una tienda, andá con ellos. Si lo que te falta es dejar de perder pedidos y responder 40 veces lo mismo, eso es lo que hace Ecommy. Y en Tiendanube gratis, cobrar por transferencia te cuesta con Pago Nube [verificar captura antes de decirlo] |
| "¿Y si después no pago / Ecommy cierra?" | Pasás a Free y no se borra nada. Tus productos, pedidos y clientes se exportan en CSV. Tu alias y tu Mercado Pago son tuyos: la plata nunca pasó por nosotros |

---

## 7. Oferta (Fase 5)

**Plan Fundador, para los primeros 15 comercios.** El objetivo no es bajar el precio: es bajar el esfuerzo de migrar y subir el compromiso.

| Componente | Decisión | Por qué |
| --- | --- | --- |
| Precio | **Starter a precio de lista ($14.999/mes), congelado 12 meses** | No es descuento, es previsibilidad. Tiendanube ajusta cada trimestre por inflación [H]. Para vos el costo es margen futuro, no caja hoy |
| Forma de pago | Primer mes por transferencia antes de activar; después mensual o anual (12 por 10) | El pago adelantado filtra curiosos. "Pagás por transferencia, como tus clientas" |
| Trial | Pro 14 días sin tarjeta, igual que hoy, pero **arranca con el catálogo ya cargado** | El trial vacío es el principal punto de abandono [Hip]. El trial con sus productos muestra su negocio funcionando |
| Carga de catálogo | **La hacés vos**: los 30 productos más vendidos desde sus fotos de Instagram y su lista de precios, con talles y colores, antes de la demo | Es tu costo de adquisición: 45 a 60 minutos por prospecto. 15 clientes = 15 horas. Ninguna pauta te da eso |
| Onboarding | Llamada de 30 minutos por WhatsApp o Meet: recorrido del panel, Responder, primer pedido de prueba con una amiga o clienta real | Reemplaza el checklist genérico para estos 15 |
| Soporte | Tu WhatsApp directo, respuesta en menos de 2 horas en horario comercial, durante 90 días | Tiendanube da WhatsApp desde $79.999 [H] |
| Garantía | **Si en 30 días no recibís un pedido real por la tienda, te devuelvo el mes** | Reduce el riesgo percibido a cero y te obliga a elegir bien |
| Caso de éxito | A cambio: permiso escrito para usar su tienda como caso y una captura del pedido | Es la prueba social que hoy no tenés |
| Free | Reducir Free a 25 productos desde /platform (editable sin código) y evaluar límite de pedidos por mes | Con 50 productos y variantes, una marca de ropa chica vive gratis para siempre [Hip] |

**Lo que no hago:** descuentos porcentuales, "gratis 3 meses", plan Fundador perpetuo, migración gratis para catálogos de 500+ productos (ahí vendés Pro y cobrás la migración o la hacen con CSV).

**Oferta en una frase para el cierre:** "Te cargo el catálogo, lo probás 14 días con tus clientas de verdad y, si lo querés seguir usando, pagás $14.999 por mes congelados por un año. Si en 30 días no te entró un pedido por la tienda, te devuelvo la plata."

---

## 8. Outbound (Fase 6)

### 8.1 Dónde buscar 100 prospectos (una semana, presupuesto cero)

| Fuente | Cómo | Rendimiento esperado [Hip] |
| --- | --- | --- |
| **EmprenZona** (ferias.emprenzona.com.ar, 159 ferias activas en BA) [H] | Entrar al Instagram de cada feria → "Seguidos" o "Etiquetados" → filtrar perfiles de ropa | 25 a 40 perfiles calificados por hora. La fuente más eficiente |
| **Feria Puro Diseño 2026** (9 al 11 de octubre, La Rural, +350 expositores) [H] | Lista pública de 26 expositores en purodiseno.lat + ir el sábado con el celular y la demo de ropa | 20 a 30 contactos cara a cara. Está esta semana |
| **Hashtags en Instagram** | #showroomargentina, #emprendedorasargentinas, #pedidosporwhatsapp, #ventaporcatalogo, #feriahonduras | Revisar los 50 posts recientes de cada uno; 10 a 15 calificados por hashtag |
| **Instagram Map** | Palermo, Villa Crespo, Flores, Nueva Córdoba, Pichincha → categoría "Tienda de ropa" / "Boutique" | 10 a 20 por barrio |
| **Google** | `site:instagram.com "pedidos por whatsapp" indumentaria "Buenos Aires"` · `site:instagram.com "showroom" "turnos por dm"` · `site:instagram.com "lista de precios" "por privado" ropa` · `site:instagram.com "wa.me" "showroom" -tiendanube -mitienda` · `site:linktr.ee whatsapp pedidos ropa argentina` | Cobertura parcial; probar y descartar si no rinde en 30 minutos |
| **Google Maps + Maps2Sheets** (gratis, 100 leads/día) [H] | `"showroom" Palermo`, `"tienda de ropa" Villa Crespo` → filas sin sitio web y con celular | 30 a 50 por día, calidad media |
| **Apify Instagram Hashtag Scraper** (USD 5 gratis/mes, ~1.900 resultados) [H] | Scrapear #showroomargentina → filtrar captions con "dm" o "whatsapp" | Para la segunda tanda de 100. No usa tu cuenta de IG |
| **Ex Mercado Shops** | Bios o links que todavía dicen "mercadoshops" | Señal de urgencia alta: perdieron la tienda el 31/12/2025 [H] |

**No usar:** Phantombuster logueado con tu IG principal (riesgo de baneo), listas compradas, WhatsApp frío a números no públicos (límite de ~150 chats nuevos por mes a quien no te tiene agendado y baneo por spam) [H].

### 8.2 Señales de intención

| Fuerza | Señal | Qué indica |
| --- | --- | --- |
| **Fuerte** | Bio: "pedidos por DM", "pedidos por WhatsApp", "consultar stock por privado", "lista de precios por WhatsApp" | Vende, no tiene tienda, opera por chat |
| **Fuerte** | Destacadas "CATÁLOGO", "PRECIOS", "CÓMO COMPRAR", "TALLES" | El catálogo vive en historias |
| **Fuerte** | Historias o posts "VENDIDO", "último!", "quedan 2 en M", "agotado, repone la semana que viene" | Stock manual, variantes |
| **Fuerte** | Post "disculpen la demora en responder", "estamos contestando todos los mensajes" | Saturación operativa |
| **Fuerte** | Link wa.me o Linktree con sólo WhatsApp | Sin tienda |
| **Fuerte** | Bio o link que menciona Mercado Shops | Tienda muerta desde enero |
| **Media** | "Envíos a todo el país", "hacemos envíos", "showroom con turno" | Volumen, pero puede tener tienda |
| **Media** | Link a Tiendanube o Empretienda con menos de 5 productos o sin actualizar en 6 meses (comparar fecha del último post) | Tienda abandonada |
| **Media** | Más de 1 post por día y respuesta a comentarios | Activa, con volumen |
| **Débil** | "Link en bio" genérico, menos de 500 seguidores, sin ubicación | Poco volumen para pagar [Hip] |

### 8.3 Scoring (0 a 10, prospectar sólo ≥ 6)

| Criterio | Puntos |
| --- | --- |
| Rubro ropa con talles (vs. accesorios o deco) | +3 |
| Dos o más señales fuertes | +3 (una señal fuerte: +1) |
| Entre 1.000 y 30.000 seguidores | +2 |
| Posteó en los últimos 7 días | +1 |
| Sin tienda, o tienda abandonada | +1 |
| Tiene tienda activa en Tiendanube con más de 50 productos | −3 (es otro pitch, dejalo para después) |
| Gastronomía, servicios, artesanía única | descartar |

### 8.4 Datos a registrar (una planilla, una fila por prospecto)

Fecha · @instagram · nombre de la dueña · ciudad/barrio · rubro · seguidores · señales detectadas (texto literal) · tiene tienda (no / abandonada / activa, cuál) · score · fuente (feria X, hashtag Y, Maps) · canal de contacto · fecha mensaje 1 · fecha respuesta · estado (sin contacto / conversando / demo agendada / trial / cliente / no) · objeción escuchada · próximo paso y fecha.

### 8.5 Mensajes

Reglas (de la investigación de DM frío): primer mensaje de menos de 300 caracteres, personalizado con algo que viste en su perfil, una sola pregunta, sin link y sin pitch. Antes del DM, interactuá (responder una historia o comentar un post) para que el mensaje no caiga en "Solicitudes". Máximo 20 a 30 DMs por día desde una cuenta establecida; mensajes nunca idénticos. Benchmarks: 3 a 12 % de respuesta en frío; hasta 80 % con 10 DMs muy personalizados por día [H, Indie Hackers].

**Instagram DM**

- **Inicial (responder a una historia suya):** "¡Qué bueno el drop nuevo! Vi que la [remera X] se agotó en M el martes. Te pregunto por curiosidad, no te vendo nada: cuando se te vende algo por DM, ¿cómo llevás el stock de los talles? Estoy armando algo para marcas que venden por IG y quiero entender cómo lo hacen hoy."
- **Follow-up 1 (día 3, si no respondió):** "Te dejo lo que estoy haciendo por si te sirve: un sistema donde la clienta arma el pedido con talle y color y a vos te llega a WhatsApp armado, y el stock baja solo. Si querés te cargo 30 productos tuyos y lo ves con tu catálogo, sin costo. ¿Te interesa?"
- **Follow-up 2 (día 7):** "Hoy cargué el catálogo de [otra marca del rubro, con permiso] y le entró el primer pedido armado a las 2 horas. Te mando la captura si querés ver cómo llega."
- **Follow-up 3 (día 12):** "Última por acá para no ser pesado. Si en algún momento se te mezclan pedidos o vendés algo que no tenías en ese talle, escribime y lo armamos en una tarde."
- **Último (día 20):** "Te sigo por acá y me quedo con ganas de ver cómo te va con la colección. Si cambia algo, acá estoy. Éxitos con el drop."

**WhatsApp** (sólo si el número es público "para pedidos" o si respondió en IG)

- **Inicial:** "Hola [nombre], soy [tu nombre], te escribí por Instagram por lo del stock de talles. ¿Te puedo mandar un audio de 40 segundos mostrando cómo llega un pedido armado?"
- **Follow-up 1 (día 2):** [audio o video de 40 s: pedido llegando a WhatsApp con talle, color, total y dirección] "Eso es con el catálogo de una marca de [rubro]. Lo armo con el tuyo si querés, sin costo."
- **Follow-up 2 (día 5):** "¿Te vendría bien una llamada de 15 minutos el [día] a las [hora]? Te muestro tu catálogo funcionando y vos decidís."
- **Follow-up 3 (día 10):** "Te dejo el link de una tienda de ropa real funcionando para que lo veas cuando puedas: [demo ropa]. Elegí un talle y fijate cómo llega el pedido."
- **Último (día 18):** "Cierro por acá. Si en la temporada que viene querés ordenar los pedidos, me escribís y lo hacemos."

**Email** (sólo si tiene mail público; asunto corto)

- **Inicial.** Asunto: "¿cómo llevás el stock de talles?" Cuerpo: 4 líneas, misma pregunta que el DM, firma con tu nombre y WhatsApp.
- **Follow-up 1 (día 3).** Asunto: "tu catálogo cargado, sin costo". Oferta de cargar 30 productos.
- **Follow-up 2 (día 7).** Asunto: "así llega un pedido armado". Una captura.
- **Follow-up 3 (día 12).** Asunto: "15 minutos esta semana?" Dos horarios.
- **Último (día 20).** Asunto: "cierro por acá". Una línea y la puerta abierta.

**LinkedIn** (no para la dueña de la marca: para aliados, community managers y organizadores de ferias)

- **Inicial:** "Hola [nombre], vi que manejás las redes de [marca]. Estoy trabajando con marcas de ropa que venden por IG para que el pedido les llegue armado con talle y color y dejen de responder 'qué talle' 40 veces al día. ¿Te pasa con tus clientes que el DM se les desborda?"
- **Follow-up 1 (día 4):** "Si te sirve, armo una cuenta de prueba con el catálogo de uno de tus clientes y lo ves. Si lo recomendás, hablamos de una comisión por referido."
- **Follow-up 2 (día 9):** Un dato real de la beta (sin nombres sin permiso).
- **Follow-up 3 (día 15):** Invitación a una charla de 15 minutos.
- **Último (día 25):** Cierre amable.

---

## 9. Demo (Fase 7)

Duración máxima 10 minutos. Condición: el catálogo del prospecto ya está cargado (30 productos con talles y colores) en una tienda a su nombre. Sin eso, no hay demo: hay un tour, y los tours no venden.

**Discovery (3 minutos, antes de mostrar nada):**
1. "¿Cuántos pedidos tenés en una semana normal? ¿Y en un drop?"
2. "¿Cómo te enterás de que se te acabó un talle?"
3. "¿Alguna vez vendiste algo que no tenías? ¿Qué pasó?"
4. "¿Cuánto tiempo por día estás respondiendo precio, talle y envío?"
5. "¿Cómo cobrás hoy y cómo confirmás que entró la transferencia?"
6. "¿Qué hiciste con la tienda que probaste antes, si probaste alguna?"

**Demo (6 minutos, en su celular o compartiendo pantalla):**

| Min | Paso | Qué ve | Frase |
| --- | --- | --- | --- |
| 0 a 1 | Instagram → tienda | Su marca, sus fotos, su estilo (preset Atelier) en el link que iría en la bio | "Esto es lo que ve tu clienta cuando toca el link" |
| 1 a 2 | Catálogo con variantes | Su remera, los talles, el stock de cada uno, el precio con descuento por transferencia visible | "Fijate que la M dice 'quedan 2'. Eso lo ve ella, no te lo pregunta" |
| 2 a 3 | Pedido | Vos (o ella desde otro celular) elegís talle y color, cargás dirección, elegís transferencia | "Ella arma el pedido. Vos no escribiste nada" |
| 3 a 4 | WhatsApp | El pedido llega a su WhatsApp armado: número, ítems con talle, total, dirección, link | "Esto te llega. Comparalo con el chat de hoy" |
| 4 a 5 | Stock y panel | En el panel la M bajó a 1; en Hoy aparece "1 por confirmar" con el botón "Confirmar pago" | "Si no te paga en 48 horas, se cancela solo y el stock vuelve" |
| 5 a 6 | Responder | Simulá una consulta: "¿tenés la negra en S?" → buscás, copiás la respuesta con precio, stock y link | "Esto es lo que respondés mañana en vez de escribir" |

**Objeciones probables y respuesta:** ver §6. Sumá: "Mis fotos no dan para una tienda" → "Son las mismas fotos que ya usás en Instagram; la tienda las muestra grandes y sin adornos".

**Cierre (1 minuto):** "Tenés 14 días de Pro con tu catálogo cargado. Compartí el link en una historia hoy y usá Responder con las próximas 10 consultas. Si te sirve, el plan es $14.999 por mes congelados por un año y si en 30 días no te entró un pedido te devuelvo la plata. ¿Lo publicás hoy o lo querés para el drop del [fecha]?"

Si dice que lo piensa: agendá un mensaje para el día 5 con una pregunta concreta ("¿cuántas consultas respondiste con Responder?"), no un "¿cómo vas?".

---

## 10. Activación (Fase 8)

**Aha Moment:** el momento en que el pedido le llega a WhatsApp armado, con talle, color, total y dirección, de una clienta real, sin que ella haya preguntado nada.

**Métrica principal de activación: primer pedido real.** Pedido web, no cancelado, cuyo email de comprador no es el del dueño. La consulta SQL ya existe en el repo (plan de lanzamiento §2.2).

Por qué esa y no otra:
- Cuenta creada, productos cargados, tienda publicada: son esfuerzo, no valor.
- Link compartido y primer visitante: necesarios pero no prueban nada.
- Primer carrito: lo puede hacer ella misma.
- Primer pedido real: es la única señal de que el circuito funcionó con una clienta de verdad. Predice el pago.
- Primer pago: es la consecuencia, no la activación.

**Métricas de apoyo:** 10 productos activos en 48 horas; link compartido en 72 horas; primer uso de Responder en 7 días.

**Onboarding rediseñado para el ICP (sin cambiar código, con el checklist que ya existe):**

| Paso | Hoy | Para el ICP moda |
| --- | --- | --- |
| Registro | 3 datos | Igual. Pero el CTA de la landing lleva primero al formulario de "cargamos tu catálogo", y el registro llega después, con la tienda ya armada por vos |
| Cargar productos | Checklist "Cargá tu primer producto" | Para los 15 fundadores lo hacés vos. Para el resto: pedir primero los 10 más vendidos, con talles, y recién después todo. Reordenar el checklist: productos → cobros → compartir; apariencia y página de inicio al final |
| Publicar tienda | Implícito | Decir explícitamente: "Tu tienda ya está publicada en [link]". Está publicada desde el minuto uno y muchos no lo saben [Hip] |
| Compartir | "Compartí el link de tu tienda" al final del checklist | Moverlo al paso 3 con el texto listo para la historia: "Ahora podés pedir directo acá: [link]. Elegís talle y color y te llega el total" |
| Primer pedido | Nada | Pedirle que una amiga o clienta habitual haga un pedido real ese mismo día. Es la práctica más fiable para que llegue el aha en 24 horas [Hip] |
| Convertir a pago | Avisos a 3 y 1 día | Ver §11 |

**Mensajes para acelerar (email + WhatsApp del fundador para los primeros 15; email automático para el resto):**

| Cuándo | Canal | Disparador | Mensaje (asunto o primera línea) |
| --- | --- | --- | --- |
| Hora 0 | In-app + email | Tienda creada | "Tu tienda ya está publicada. Compartí este link en una historia hoy: [link]." Con el texto para la historia |
| Hora 24 | WhatsApp (fundador) | Sin link compartido | "¿Lo publicaste en una historia? Si querés te paso el texto" |
| Hora 48 | Email (ya existe) | Sin productos | Mantener el actual |
| Día 3 | Email nuevo | Con productos, sin pedido | "La prueba de fuego: pedile a una clienta habitual que haga su próximo pedido por acá" |
| Día 5 | WhatsApp (fundador) | Sin pedido real | "¿Usaste Responder con alguna consulta esta semana? Mostrame una y te digo cómo acortarla" |
| Día 7 | Email (ya existe) | "Compartí tu tienda" | Mantener |
| Primer pedido real | Email + WhatsApp | Evento | "Te entró el primero. Así se ve el stock ahora. ¿Lo confirmaste desde Hoy?" + pedir permiso para el caso |
| Día 10 | WhatsApp (fundador) | Con ≥ 1 pedido real | Conversación de cierre (ver §11) |
| Día 11 y 13 | Email (ya existe a 3 y 1 día) | Fin de prueba | Reescribir con lo que pierde según uso real: "Tenés 84 productos y 3 usuarios: en Free quedan 25 y 1" |

---

## 11. Conversión (Fase 9)

**Cuándo mostrar pricing:** siempre visible en /planes (ya está), pero no en el flujo de registro ni en el panel durante los primeros 7 días. Al prospecto se lo decís vos en la demo: el precio no es una sorpresa, es parte de la oferta.

**Cuándo pedir el upgrade:** en el momento de mayor valor percibido, no en el de mayor urgencia tuya. Tres disparadores, en orden:
1. 48 horas después del primer pedido real.
2. Cuando toca un límite (producto 26 en Free, segundo usuario, Pixel).
3. Día 10 de la prueba, si tiene al menos 1 pedido real. Si no lo tiene, no pidas el upgrade: preguntá qué pasó.

**Límites de Free [R]:** 25 productos (hoy 50; se cambia desde /platform sin código), 1 usuario, sin Responder, sin remitos, sin Pixel. Evaluar un tope de 20 pedidos por mes como métrica de valor: pagás cuando vendés. Requiere código; medir primero si los 25 productos alcanzan para convertir.

**Comportamientos que indican intención de pago:**
- 3 o más pedidos reales en una semana.
- Usa Responder más de 5 veces.
- Invita a un segundo usuario.
- Activa Meta Pixel o pregunta por dominio propio.
- Carga más de 40 productos.
- Entra al panel 5 de 7 días.
- Pregunta "¿qué pasa cuando termina la prueba?".

**Eventos que disparan intervención humana (tu WhatsApp, el mismo día):**
- Primer pedido real (felicitar, pedir caso).
- Tienda creada y 72 horas sin productos ni link compartido.
- Prueba en día 10 con pedidos y sin plan elegido.
- Pedido cancelado por vencimiento de reserva (preguntar si el cobro fue por fuera).
- Pedido de cambio de plan por WhatsApp (ya llega; activar en el día).
- Tienda pasó a Free con más de 25 productos (pierde funciones; es el mejor momento para una llamada).

**Funnel y metas (30 días, cohorte de prospectos outbound):**

| Paso | Definición | Meta | Cómo se mide hoy |
| --- | --- | --- | --- |
| Prospectos contactados | Mensaje 1 enviado | 100 | Planilla |
| Conversación | Respondió | 40 % → 40 | Planilla |
| Demo | Demo con su catálogo | 50 % → 20 | Planilla |
| Tienda creada con catálogo | Registro + 20 productos | 60 % → 12 | /platform, SQL |
| Link compartido | Flag `shared` o historia vista | 90 % → 11 | SQL (subestima) + verificación manual |
| Primera visita | Visita no tuya | 90 % → 10 | GA4 de la tienda si lo activa; si no, pedido |
| Primer pedido real | Pedido web no cancelado de un tercero | 70 % → 8 | SQL (existe) |
| Pago | Plan activado | 75 % → 6 | `platform_stats().by_plan` |

Si la conversación cae por debajo del 20 % el mensaje está mal, no la lista. Si demo → tienda cae por debajo del 40 %, la oferta no reduce suficiente esfuerzo. Si pedido → pago cae por debajo del 50 %, el precio o Free están mal calibrados.

---

## 12. Plan de 30 días (Fase 10)

Supuesto: 15 a 20 horas por semana del fundador para esto. Días 1 a 7 son la semana del 6 al 12 de octubre (Puro Diseño es el 9, 10 y 11).

| Día | Qué hacés | Resultado del día |
| --- | --- | --- |
| 1 | Crear la tienda demo de ropa (30 productos con talles y colores, preset Atelier, fotos propias o con permiso). Cambiar Free a 25 productos en /platform. Verificar GA4 en la landing | Demo de ropa online |
| 2 | Reescribir hero, CTA y subheadline según §6. Formulario de 3 campos "Cargamos tu catálogo" (puede ser un Google Form o Tally). Grabar el video de 40 s del pedido llegando a WhatsApp | Landing alineada al ICP |
| 3 | Planilla de prospectos (§8.4). EmprenZona: 10 ferias → Instagram → seguidos. Objetivo 40 prospectos con score ≥ 6 | 40 prospectos |
| 4 | Hashtags e Instagram Map: 30 prospectos más. Interactuar (historias, comentarios) con los primeros 20 | 70 prospectos |
| 5 | Primeros 15 DMs iniciales. Preparar tarjetas con QR a la demo de ropa para Puro Diseño | 15 DMs |
| 6 | Puro Diseño (sábado): 3 horas, 20 a 30 conversaciones cara a cara, mostrar la demo en el celular, pedir Instagram. 15 DMs | 25 contactos presenciales |
| 7 | Correr las SQL del embudo, completar la planilla, leer respuestas. Ajustar el mensaje 1 según lo que respondió la gente | Primer dato real de tasa de respuesta |
| 8 | 20 DMs (incluye follow-up 1 a los del día 5). Cargar el catálogo de los primeros 2 que dijeron sí | 2 catálogos cargados |
| 9 | 2 demos. 15 DMs. Follow-up 1 a los del día 6 | 2 demos hechas |
| 10 | Cargar 2 catálogos. 15 DMs. Mensaje de hora 24 a los que crearon tienda | 4 catálogos acumulados |
| 11 | 2 demos. Pedir a cada tienda activa que una clienta real pida hoy | Primeros pedidos reales esperados |
| 12 | 15 DMs. Follow-up 2 a los del día 5. Cargar 1 catálogo | 100 prospectos contactados |
| 13 | 2 demos. Primer WhatsApp de día 5 a tiendas sin pedido | 6 demos acumuladas |
| 14 | Revisión semanal: embudo, objeciones, tasa de respuesta por fuente (feria vs. hashtag vs. Maps). Decidir qué fuente duplicar | Scoreboard semana 2 |
| 15 | Follow-up 2 y 3. 2 demos. Cargar 2 catálogos | 8 demos |
| 16 | Escribir el primer caso (con permiso) a partir del primer pedido real. Captura del pedido en WhatsApp. Sumarlo a la landing | Prueba social #1 |
| 17 | 2 demos. Conversación de cierre con los que están en día 10 con pedidos | Primeros cierres |
| 18 | Cobrar el primer mes por transferencia, activar Starter en /platform | **Clientes 1 a 3** |
| 19 | Pedir a cada cliente 2 referidos del rubro ("¿qué otra marca conocés que venda como vos?"). 10 DMs a referidos, mencionando quién la recomendó | 6 referidos |
| 20 | 2 demos. Follow-ups pendientes. Mensaje de LinkedIn a 5 community managers freelance | Canal aliado abierto |
| 21 | Revisión semanal. Reescribir los emails de día 11 y 13 con uso real. Decidir si Free a 25 convierte o hay que tocar pedidos/mes | Scoreboard semana 3 |
| 22 | Segunda tanda de prospección: Apify sobre #showroomargentina (USD 5 gratis) + 1 feria más. 40 prospectos nuevos | 140 prospectos |
| 23 | 15 DMs nuevos. 2 demos. Cierres de día 10 | Clientes 4 a 5 |
| 24 | Cargar 2 catálogos. Mensaje de "último" a la primera tanda que no respondió | Lista limpia |
| 25 | 2 demos. Charla de 20 minutos con 1 organizador de feria: "ordená tus pedidos después de la feria" para sus expositores | Primer partner |
| 26 | Segundo caso con permiso. Post en LinkedIn con 3 datos reales del mes | Prueba social #2 |
| 27 | 15 DMs. 2 demos. Cierres | Clientes 6 a 8 |
| 28 | Revisión semanal. Calcular: costo en horas por cliente, tasa real de cada paso, objeción #1 | Scoreboard semana 4 |
| 29 | Llamada de 15 minutos a cada cliente: qué usó, qué no, qué le faltó. Una sola mejora de producto elegida | Lista de retención |
| 30 | Decidir: ¿la fuente, el mensaje y la oferta se repiten o cambian? Escribir el plan de los días 31 a 60 con los números reales | Canal repetible o no |

**Fuera del plan:** calendario de contenido para redes, reels diarios, TikTok, Google Ads, pauta en Meta, prensa, programa de aliados formal, páginas SEO. Nada de eso trae un cliente pago en 30 días con cero clientes previos.

---

## 13. Estrategia posterior (Fase 11)

Sólo después del cliente 10 y con un canal que repite. Cada capa entra cuando los clientes actuales la piden o cuando abre un vertical, no antes.

| Capa | Qué significa en Ecommy | Cuándo | Para qué vertical |
| --- | --- | --- | --- |
| Pedidos | Lo que hay: pedido armado, Hoy, Responder, remitos | Hoy | Moda chica |
| Stock | Ya existe por variante. Sumar: preparar los pedidos de hoy en lote, aviso de reposición a clientas (existe), stock comprometido vs. disponible | Mes 2 a 3 | Moda chica, mayoristas |
| Clientes | "Quién compró hace 60 días y no volvió" como respuesta lista para WhatsApp (ya está en la tesis §6). Lista de revendedoras con precio mayorista (precios por cantidad ya existen) | Mes 3 a 4 | Mayoristas Flores/Once |
| Pagos | Mercado Pago ya está. Sumar: conciliación de transferencias (marcar pagado desde el comprobante), cuotas destacadas | Mes 4 a 6 | Todos |
| Envíos | Zonas por mapa ya están. Sumar etiquetas de correo sólo si 5 clientes lo piden; hasta entonces decir "no" como hoy | Mes 6+ | Moda que despacha al interior |
| Marketing | Pixel y GA4 ya están. Sumar: link por producto para historias con UTM, cupón por historia, carritos abandonados por WhatsApp (hoy por mail) | Mes 6 a 9 | Moda |
| Analítica | "Qué pasó esta semana" ya existe y es determinista. Sumar comparación contra el mismo período del año anterior | Mes 9+ | Todos |
| Automatización | Reglas que el comerciante activa: "si no paga en 48 h, recordar por WhatsApp" (siempre con el comerciante tocando enviar, principio de la tesis) | Mes 9 a 12 | Todos |
| IA | Sólo lo que entienda el negocio: sugerir respuesta en Responder a partir del historial, detectar producto en una consulta de WhatsApp. Nunca escribir banners | Mes 12+ | Todos |

**Secuencia de verticales:** moda chica → mayoristas de indumentaria a revendedoras → cosmética y accesorios (mismo canal Instagram, menos variantes) → retail de barrio con lista de proveedor (el ICP 2.2 del kit actual, que requiere CSV y precios masivos, ya construidos).

**Regla que protege los 10 primeros clientes:** ninguna de estas capas entra en el roadmap hasta que la métrica "tiendas con pedido real en los últimos 30 días" sea 10 o más durante dos semanas seguidas.

---

## 14. Top 10 decisiones

1. Vendo un **sistema de pedidos para marcas de ropa que venden por Instagram y WhatsApp**, no una tienda online.
2. El beachhead es **moda femenina chica** en AMBA, Córdoba y Rosario. Nada más hasta el cliente 10.
3. El CTA principal pasa de "Crear tu tienda gratis" a **"Cargamos tu catálogo y lo probás 14 días"**.
4. **Yo cargo el catálogo** de los primeros 15 (30 productos con talles). Es mi costo de adquisición.
5. **Plan Fundador**: Starter a precio de lista congelado 12 meses, primer mes por transferencia antes de activar, garantía de primer pedido en 30 días.
6. **Free baja a 25 productos** hoy desde /platform. Sin Responder ni remitos en Free.
7. La **métrica de activación es el primer pedido real**; la métrica norte, tiendas con pedido real en 30 días.
8. Prospección sólo por **ferias (EmprenZona, Puro Diseño), hashtags, Instagram Map y Maps2Sheets**. 100 prospectos en 7 días, 15 a 20 DMs por día, personalizados.
9. La **demo siempre es con su catálogo** cargado. Sin catálogo no hay demo.
10. Toda mejora de producto de los próximos 30 días sale de una objeción escuchada en una demo o de un cliente que no activó. Una por semana, máximo.

## 15. Top 10 cosas que no haría

1. No competir por precio con Empretienda ni por features con Tiendanube.
2. No hacer calendario de contenido, reels diarios ni TikTok hasta tener 10 clientes y 3 casos.
3. No pagar Google Ads ni Meta Ads: sin funnel medido y sin prueba social, es tirar plata.
4. No vender a gastronomía, artesanos ni 3D aunque pidan: decir "no te sirve" y recomendar otra cosa.
5. No dar descuentos porcentuales ni meses gratis. La oferta es esfuerzo cero y riesgo cero, no precio bajo.
6. No mandar WhatsApp frío a números que no son públicos "para pedidos". Baneo y mala reputación.
7. No construir features nuevas que no salgan de una objeción de demo (ni IA, ni etiquetas de correo, ni app store).
8. No usar "sistema operativo" en la landing todavía. Es visión interna.
9. No prometer tiempos ("de cero a tu primer pedido en una tarde") hasta medirlos en 10 tiendas.
10. No ampliar al segundo vertical (mayoristas) hasta que el canal de moda repita dos semanas seguidas.

## 16. Top 10 experimentos

| # | Experimento | Hipótesis | Métrica | Decisión si funciona |
| --- | --- | --- | --- | --- |
| 1 | DM que abre con pregunta sobre stock de talles vs. DM que ofrece "te cargo el catálogo" | La pregunta responde más del 30 %; la oferta menos del 15 % | Tasa de respuesta a 20 DMs cada uno | Mensaje 1 definitivo |
| 2 | Fuente: feria vs. hashtag vs. Maps | Las ferias dan el doble de respuesta que Maps | Respuesta y demo por fuente | Duplicar la fuente ganadora |
| 3 | Catálogo cargado por vos vs. "cargalo vos con esta guía" | Cargado por vos convierte demo → tienda al 60 %; solo, al 20 % | Tasa demo → tienda con catálogo | Mantener o automatizar la carga |
| 4 | Pedir a una clienta real que compre el día 1 | Reduce el tiempo al primer pedido real de 7 días a 2 | Días hasta primer pedido real | Hacerlo parte del onboarding escrito |
| 5 | Free 25 productos vs. 50 | Con 25, pedido → pago sube del 40 % al 70 % | Conversión a pago en día 14 | Fijar el límite |
| 6 | Garantía "te devuelvo el mes" | Sube el cierre en la demo más de 15 puntos y nadie la ejecuta | Cierres y devoluciones | Mantener como estándar |
| 7 | Headline "pedido armado" vs. "con orden" | Registros desde landing por visita suben | Tasa de registro con GA4 | Fijar el hero |
| 8 | Precio congelado 12 meses como argumento | Aparece como razón de compra en más del 30 % de los cierres | Planilla de objeciones | Comunicarlo en la landing |
| 9 | Referidos: pedir 2 nombres a cada cliente | 1 de cada 3 referidos llega a demo | Referidos → demo | Programa de referidos simple (1 mes de Starter) |
| 10 | Community manager como aliado | 1 de 5 contactados trae una marca en 30 días | Marcas traídas por aliado | Comisión del 20 % el primer año |

## Scoreboard semanal

Se completa el lunes en 45 minutos con la planilla y las SQL que ya existen en el repo. Una fila por semana.

| Métrica | Definición | Meta semana 1 | Meta semana 2 | Meta semana 3 | Meta semana 4 |
| --- | --- | --- | --- | --- | --- |
| Prospectos nuevos calificados | Score ≥ 6 en planilla | 70 | 30 | 0 | 40 |
| Mensajes 1 enviados | DMs iniciales | 30 | 50 | 20 | 30 |
| Tasa de respuesta | Respondieron / mensaje 1 | ≥ 25 % | ≥ 30 % | ≥ 30 % | ≥ 35 % |
| Demos hechas | Con catálogo cargado | 0 | 6 | 8 | 6 |
| Tiendas con catálogo | ≥ 20 productos activos | 2 | 4 | 4 | 2 |
| Link compartido en 72 h | Flag o historia vista | 100 % | 90 % | 90 % | 90 % |
| **Tiendas con primer pedido real** | SQL del repo | 0 | 3 | 3 | 2 |
| Días hasta primer pedido real (mediana) | SQL del repo | — | ≤ 4 | ≤ 3 | ≤ 3 |
| **Clientes pagos nuevos** | Plan activado y cobrado | 0 | 0 | 3 | 4 |
| **MRR** | Suma de planes activos | $0 | $0 | $44.997 | $104.993 |
| Tiendas con pedido real en 30 días (métrica norte) | SQL del repo | 0 | 3 | 6 | 8 |
| Horas del fundador en ventas | Registro propio | 15 | 20 | 20 | 18 |
| Horas por cliente pago | Acumulado horas / clientes | — | — | ≤ 20 | ≤ 12 |
| Objeción #1 de la semana | Texto literal más repetido | — | — | — | — |
| Una mejora de producto elegida | Sale de una objeción o un no-activado | 1 | 1 | 1 | 1 |

Si al final de la semana 4 hay menos de 4 clientes pagos y la tasa de respuesta fue mayor al 25 %, el problema es la oferta o la demo. Si la tasa de respuesta fue menor al 15 %, el problema es el mensaje o la lista. Si hubo 8 pedidos reales y menos de 4 pagos, el problema es Free.
