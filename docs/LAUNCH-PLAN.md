# Ecommy: plan de lanzamiento

> Para: el dueño. Fecha: 2026-09-23. Supone un fundador solo con 10 a 12 horas por semana para marketing y ventas, además del producto.
> Posicionamiento, ICP y mensajes: [`MARKETING.md`](MARKETING.md). Lo que tenés que configurar vos: [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md). Copy listo: [`SOCIAL-KIT.md`](SOCIAL-KIT.md) (los códigos `P01`…`P15`, `H01`…`H10`, `W1`…`W5` y `M1`…`M3` de este plan son piezas de ese kit).

---

## 0. Resumen

1. **Semanas 0 y 1 (preparación):** cerrar los bloqueantes del checklist (§0 de ese documento), abrir las cuentas y grabar el material base con la tienda demo.
2. **Semanas 2 a 5 (beta privada):** 10 comercios reales que conocés, acompañados uno por uno. El objetivo no es crecer: es ver dónde se traban y conseguir el primer pedido real de cada uno.
3. **Semana 6 (lanzamiento):** abrir el registro al público con contenido, comunidades, LinkedIn y los primeros aliados.
4. **Semanas 7 a 18 (primeros 90 días):** repetir lo que funcionó en la beta, sumar Google Ads chico sobre keywords de alta intención y referidos.

**Fechas sugeridas** (movelas si hace falta): preparación del 24-sep al 4-oct, beta del 5-oct al 1-nov, lanzamiento el 2-nov. El CyberMonday argentino suele caer a principios de noviembre **[VERIFICAR la fecha 2026 en la CACE]**: sirve de gancho ("tené la tienda lista antes del CyberMonday") pero no conviene que el lanzamiento dependa de eso.

---

## 1. Objetivos medibles

Son hipótesis para un fundador solo. Al cerrar la beta, recalculalas con las tasas reales del embudo (§2) y reescribí los números de los 90 días.

| Fase | Objetivo | Métrica | Meta |
| --- | --- | --- | --- |
| Beta (4 semanas) | Que cada comercio venda por la tienda | Tiendas beta con ≥ 1 pedido real | 6 de 10 |
| Beta | Que la carga no sea el cuello de botella | Tiendas beta con ≥ 10 productos activos en la semana 1 | 8 de 10 |
| Beta | Tener prueba social verdadera | Casos con permiso escrito | 3 |
| Beta | Saber si pagan | Comercios que aceptan el precio fundador al terminar la beta | 4 de 10 |
| Día 30 post-lanzamiento | Activación | Tiendas nuevas (sin contar la beta) con ≥ 1 pedido real | 10 |
| Día 30 | Registro | Tiendas creadas | 40 |
| Día 90 | Activación sostenida | Tiendas con ≥ 1 pedido real en los últimos 30 días | 30 |
| Día 90 | Ingresos | Tiendas pagando (Starter o Pro) | 10 a 15 |
| Día 90 | Soporte sostenible | Tiempo mediano de primera respuesta en horario de soporte | ≤ 2 h |

"Pedido real" = pedido web no cancelado cuyo email de comprador no es el del dueño de la tienda (ver la consulta de §2.2). Los pedidos de prueba no cuentan.

---

## 2. Métricas de activación y cómo medirlas con lo que ya existe

### 2.1 El embudo

| Paso | Definición | Dónde se ve hoy |
| --- | --- | --- |
| 1. Registro | Cuenta creada en `/registro` | `platform_stats()` → `users` (tarjeta de `/platform`) |
| 2. Tienda creada | Fila en `stores` (alta en `/app/nueva`) | `/platform`: tabla de tiendas y "nuevas en 7 días" |
| 3. Producto cargado | ≥ 1 producto activo (meta sana: ≥ 10) | `/platform`: columna productos (cuenta todos, incluso borradores) |
| 4. Link compartido | El dueño tocó "Copiar link" en el checklist del dashboard (`stores.onboarding.shared`) | Sólo por SQL. Subestima: quien copia la URL de la barra no queda registrado |
| 5. Primer pedido real | Pedido web no cancelado de alguien que no es el dueño | `/platform`: columna pedidos (incluye los de prueba); exacto por SQL |
| 6. Pedido de plan | "Quiero este plan" en `/admin/plan` | `audit_log`, acción `plan.upgrade_request`, y tu WhatsApp |
| 7. Pago | Plan activado a mano en `/platform/tiendas/<id>` | `platform_stats()` → `by_plan` |

**Métrica norte:** tiendas con ≥ 1 pedido real en los últimos 30 días. Mide lo único que importa al comercio (vender) y predice si va a pagar.

### 2.2 Consultas para el SQL Editor de Supabase

Corren como administrador (saltan RLS) y son de sólo lectura. Guardalas como "snippets" en el SQL Editor y correlas cada lunes; anotá los resultados en una planilla semanal.

```sql
-- Embudo de las tiendas creadas en los últimos 30 días (sin la demo)
with s as (
  select st.id, st.onboarding, lower(coalesce(pr.email, '')) as owner_email
  from public.stores st
  left join public.profiles pr on pr.id = st.owner_id
  where st.slug <> 'demo' and st.status <> 'deleted'
    and st.created_at > now() - interval '30 days'
)
select
  count(*) as tiendas_creadas,
  count(*) filter (where exists (
    select 1 from public.products p where p.store_id = s.id and p.status = 'active')) as con_producto_activo,
  count(*) filter (where (
    select count(*) from public.products p where p.store_id = s.id and p.status = 'active') >= 10) as con_10_productos,
  count(*) filter (where s.onboarding ->> 'shared' = 'true') as link_copiado,
  count(*) filter (where exists (
    select 1 from public.orders o
    where o.store_id = s.id and o.source = 'web' and o.status <> 'cancelled'
      and lower(coalesce(o.customer ->> 'email', '')) <> s.owner_email)) as con_pedido_real
from s;
```

```sql
-- Tiempo hasta el primer pedido real, por tienda
select st.slug, st.created_at::date as creada, min(o.created_at) - st.created_at as hasta_primer_pedido
from public.stores st
left join public.profiles pr on pr.id = st.owner_id
join public.orders o on o.store_id = st.id and o.source = 'web' and o.status <> 'cancelled'
  and lower(coalesce(o.customer ->> 'email', '')) <> lower(coalesce(pr.email, ''))
where st.slug <> 'demo'
group by st.id, st.slug, st.created_at
order by st.created_at desc;
```

```sql
-- Métrica norte: tiendas con pedido real en los últimos 30 días
select count(distinct o.store_id) as tiendas_vendiendo
from public.orders o
join public.stores st on st.id = o.store_id and st.slug <> 'demo'
left join public.profiles pr on pr.id = st.owner_id
where o.created_at > now() - interval '30 days' and o.source = 'web' and o.status <> 'cancelled'
  and lower(coalesce(o.customer ->> 'email', '')) <> lower(coalesce(pr.email, ''));
```

```sql
-- Pedidos de cambio de plan
select created_at, actor_email, summary from public.audit_log
where action = 'plan.upgrade_request' order by created_at desc;
```

```sql
-- Dueños activos en la última semana (entraron al panel)
select count(*) from public.profiles where last_seen_at > now() - interval '7 days';
```

### 2.3 La web (landing)

- **Hoy la landing no carga GA4 ni Meta Pixel** (lo que existe es GA4/Pixel para cada tienda, configurable por el comercio). Hace falta un cambio de código chico en `src/app/(platform)/layout.tsx` detrás de una variable de entorno; está en el checklist (§5) y en el reporte como pedido fuera de este kit.
- Cuando esté: eventos `sign_up` (registro enviado) y `store_created` (tienda creada), y la conversión de Google Ads sobre `sign_up`.
- **UTM obligatorias** en todo link que publiques: `utm_source` (instagram, tiktok, linkedin, whatsapp, google, aliado-<nombre>), `utm_medium` (bio, reel, historia, post, dm, cpc, mail), `utm_campaign` (beta, lanzamiento, cybermonday, referidos). Ejemplo: `https://www.ecommy.app/?utm_source=instagram&utm_medium=bio&utm_campaign=lanzamiento`.
- Mientras no haya GA4, preguntá en el onboarding por WhatsApp "¿Cómo nos conociste?" y anotalo en la planilla semanal.

---

## 3. Fases

### Fase 0 · Preparación (semanas 0 y 1)

- [ ] Cerrar los bloqueantes de [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md) §0.
- [ ] Revisar la tienda demo (`https://demo.ecommy.app`) de punta a punta en el celular: portada, ficha, carrito, checkout por transferencia y por WhatsApp, página de pedido. Es la prueba social principal hasta que haya casos.
- [ ] Crear una o dos tiendas demo más con fotos propias o con permiso: una de **ropa** (Atelier) y una de **artesanías o deco** (Mercado). La demo actual es de electro y bazar: le sirve a la ferretería, no a la marca de ropa.
- [ ] Grabar el material base (pantalla del celular y de la compu, sin editar): alta de tienda completa **cronometrada**, carga de un producto con talles, checkout por WhatsApp, zona dibujada en el mapa, cambio masivo de precios y Deshacer, importación CSV por SKU. De ahí salen los primeros 15 reels.
- [ ] Armar la lista de 25 a 30 candidatos para la beta (comercios que conocés o te pueden presentar) y separar 10 que encajen en los tres ICP.
- [ ] Preparar la planilla semanal: embudo (§2.2), fuente de cada registro, conversaciones, objeciones escuchadas.

### Fase 1 · Beta privada (semanas 2 a 5)

Detalle en §6. Resumen: 10 comercios, alta acompañada, pedido real como objetivo, dos entrevistas de 20 minutos por comercio, arreglos de producto semanales, 3 casos con permiso.

**Criterio para lanzar:** al menos 5 de 10 con pedido real, cero errores que bloqueen el checkout en las últimas dos semanas y los bloqueantes del checklist cerrados. Si no se cumple, extendé la beta dos semanas antes de abrir.

### Fase 2 · Lanzamiento (semana 6)

- Día 1: post de lanzamiento en LinkedIn del fundador (historia de por qué Ecommy, con la tienda demo) + reel P01 + historias H01.
- Días 1 a 5: mensajes 1 a 1 a la lista de espera y a los candidatos que no entraron a la beta (W1 a W3).
- Días 2 a 7: publicar en 3 comunidades de emprendedores donde ya participás (no llegar y pegar el link: ver §4).
- Semana 6: activar los primeros 2 aliados (contador y fotógrafo o diseñador) con M2 y M3.
- Landing: si ya tenés 1 a 3 casos con permiso, sumarlos (cambio de código, fuera de este kit).

### Fase 3 · Primeros 90 días (semanas 7 a 18)

- **Semanas 7 a 10:** calendario de contenido (§5) completo. Google Ads chico sobre 5 keywords transaccionales (§4). Programa de referidos a mano.
- **Semanas 11 a 14:** primeras páginas SEO (`/rubros/*` y `/funciones/*`, ver `MARKETING.md` §6). Webinar o vivo de 30 minutos "armamos una tienda en vivo". Segundo lote de aliados.
- **Semanas 15 a 18:** doblar lo que trajo tiendas activadas (no registros) y cortar lo que no. Revisión de precios y del plan anual (`MARKETING.md` §5.2). Si Mercado Pago (v0.2) ya está, automatizar el cobro y comunicarlo.

**Ritual semanal (lunes, 45 minutos):** correr las consultas de §2.2, completar la planilla, leer las conversaciones de soporte, elegir una sola mejora de producto o de onboarding para la semana.

---

## 4. Canales priorizados

Orden por costo, esfuerzo y cercanía con el ICP. Esfuerzo en horas por semana del fundador.

| # | Canal | Por qué | Semana 1: qué hacer | Esfuerzo | Costo |
| --- | --- | --- | --- | --- | --- |
| 1 | **WhatsApp 1 a 1 y red propia** | Los primeros 30 clientes salen de gente que te conoce o te presentan. Es el canal con mejor conversión y el de los ICP | Lista de 30 contactos; mandar W1 o W2 personalizados, de a 5 por día, nunca en masa | 3 h | $ 0 |
| 2 | **Instagram orgánico** | Donde está la marca de ropa y la emprendedora; el contenido "cómo armé la tienda" muestra el producto de verdad | Crear la cuenta con la bio del kit, 3 posts fijados (P01, P02, P08), 1 reel por día hábil | 3 h | $ 0 |
| 3 | **TikTok** | El mismo video vertical se reutiliza; tutoriales de pantalla rinden bien | Subir los mismos reels con texto en pantalla propio de TikTok | 0,5 h | $ 0 |
| 4 | **LinkedIn del fundador** | Llega a contadores, diseñadores, agencias y dueños de pymes; el fundador técnico que construye en público genera confianza | Actualizar el titular y el "acerca de"; un post por semana con algo real (qué aprendiste de la beta, qué se lanzó) | 1 h | $ 0 |
| 5 | **Comunidades de emprendedores y grupos de WhatsApp o Facebook** | Muchísimos comercios chicos piden ahí recomendaciones de plataforma | Unirte a 5, leer las reglas, responder preguntas sin link durante una semana; recién después compartir un tutorial | 1,5 h | $ 0 |
| 6 | **Alianzas con contadores, diseñadores y fotógrafos de producto** | Cada uno ve decenas de comercios por año y le suma recomendar algo que ahorra trabajo | Lista de 10 aliados posibles; mandar M2 o M3 a 3; ofrecer una charla de 15 minutos | 1,5 h | $ 0 (o comisión por referido, decisión tuya) |
| 7 | **Ferias y mercados de diseño** | Ahí está la emprendedora de artesanías con stock y ganas de vender online | Llevar el celular con la tienda Mercado de ejemplo; tarjetas con QR a la landing (UTM `feria-<nombre>`) | 4 h por feria, 1 por mes | Impresión de tarjetas |
| 8 | **Google Ads de baja inversión** | Captura intención alta ("crear tienda online sin comisiones", "alternativa a tiendanube") | Solo cuando la landing tenga GA4 y la conversión `sign_up`. Campaña de búsqueda con 5 keywords en concordancia de frase, tope diario chico, 2 semanas de prueba | 1 h | Presupuesto a decidir. Medí el costo por tienda activada, no por clic |
| 9 | **Referidos** | Un comercio contento trae otro del mismo rubro | Desde la beta: "si traés a otro comercio y activa, a los dos les damos un mes de Starter". Se aplica a mano en `/platform` | 0,5 h | Un mes de plan por referido activado |

**Qué no hacer todavía:** pauta en Meta (sin Pixel en la landing no optimiza), influencers pagos, marketplaces de apps, prensa (sin casos no hay nota).

---

## 5. Calendario de contenido: primeros 30 días desde el lanzamiento

Día 1 = día del lanzamiento. Formatos de IG y TikTok verticales 9:16, 20 a 45 s. Todo sale de la demo o de las tiendas beta con permiso. "Link" = link en bio con UTM.

| Día | Canal | Formato | Tema | CTA |
| --- | --- | --- | --- | --- |
| 1 | LinkedIn | Post texto + 3 capturas | Por qué construí Ecommy y qué hace hoy (y qué no) | Probar 14 días |
| 1 | IG + TikTok | Reel P01 | Armo una tienda de cero, cronometrado | Link en bio |
| 1 | IG | Historias H01 | Lanzamiento: qué es, en 4 pantallas | Sticker de link |
| 2 | IG + TikTok | Reel P02 | El pedido llega armado a WhatsApp | Link |
| 2 | WhatsApp | W1 a 5 contactos | Invitación personal | Crear tienda |
| 3 | IG + TikTok | Reel P03 | Sin comisión por venta: cuánto te queda | Ver planes |
| 3 | Comunidades | Aporte sin link | Responder dudas de "qué plataforma uso" | — |
| 4 | IG + TikTok | Reel P05 | Precios masivos con Deshacer | Link |
| 4 | IG | Historias H04 | Encuesta: ¿cada cuánto actualizás precios? | Responder |
| 5 | IG + TikTok | Reel P04 | Dibujo mi zona de reparto en el mapa | Link |
| 5 | Mail | M2 a 3 contadores | Alianza | Charla de 15 min |
| 6 | IG | Carrusel P08 | Los 10 estilos por rubro | Guardá el post |
| 7 | — | Descanso y revisión | Correr las consultas de §2.2 | — |
| 8 | IG + TikTok | Reel P06 | Subo la lista del proveedor por SKU | Link |
| 8 | LinkedIn | Post | Lo que aprendí en la beta (3 datos reales, sin nombres sin permiso) | Comentarios |
| 9 | IG + TikTok | Reel P07 | Traigo mi catálogo desde mi web actual con "Detectar" | Link |
| 9 | WhatsApp | W3 a 5 comercios de barrio | Ferretería o electro | Ver la demo |
| 10 | IG + TikTok | Reel P09 | La ley te pide 4 cosas en tu tienda | Guardá el post |
| 10 | IG | Historias H06 | Pregunta abierta: ¿qué te frena para tener tienda? | Responder |
| 11 | IG + TikTok | Reel P10 | Precio con transferencia desde la card | Link |
| 12 | Mail | M3 a 3 diseñadores o fotógrafos | Alianza | Charla |
| 12 | Comunidades | Tutorial | "Cómo armé una tienda en una tarde" (texto + capturas) | Link con UTM |
| 13 | IG | Carrusel P11 | Qué pasa cuando no te pagan: la reserva de stock que vence | Guardá |
| 14 | — | Revisión semanal | Consultas + planilla | — |
| 15 | IG + TikTok | Reel P12 | Remito impreso y pedido manual del local | Link |
| 15 | LinkedIn | Post | Caso beta 1 (sólo con permiso escrito) o "cómo funciona el checkout sin pasarela" | Probar |
| 16 | IG + TikTok | Reel P13 | Invito a mi socia al panel con un link | Link |
| 16 | IG | Historias H08 | Detrás de escena: una mejora que pidió un comercio beta | Responder |
| 17 | IG + TikTok | Reel P14 | Armo la portada con bloques | Link |
| 17 | WhatsApp | W4 a referidos de la beta | Programa de referidos | Presentar a alguien |
| 18 | IG + TikTok | Reel P15 | Si ya estás en otra plataforma: cuándo sí y cuándo no cambiarte | Ver comparación |
| 19 | Google Ads | Campaña de búsqueda | 5 keywords transaccionales | Crear tienda |
| 20 | IG | Carrusel | Preguntas frecuentes (objeciones del kit) | Link |
| 21 | — | Revisión semanal | Consultas + planilla; decidir si seguir con Ads | — |
| 22 | IG + TikTok | Reel P01 v2 | Otra alta cronometrada, con otro rubro (Mercado o Bodega) | Link |
| 22 | LinkedIn | Post | Qué cambió en Ecommy en 3 semanas (changelog real) | Probar |
| 23 | IG + TikTok | Reel P02 v2 | El pedido por WhatsApp, visto desde el celular del comprador | Link |
| 24 | IG | Historias H09 | Checklist de primeros pasos del panel | Link |
| 24 | WhatsApp | W5 seguimiento | Registrados que no cargaron productos | Ayuda de 15 min |
| 25 | IG + TikTok | Reel P06 v2 | +8 % a una categoría y Deshacer, en 20 s | Link |
| 26 | Feria | Presencial | Tienda Mercado de ejemplo en el celular + tarjetas QR | Escanear |
| 27 | IG | Carrusel | Caso beta 2 con permiso, o "cuánto cuesta de verdad una tienda online" | Guardá |
| 28 | — | Revisión mensual | Embudo completo vs. objetivos del día 30 | — |
| 29 | LinkedIn | Post | Primer mes: números reales del embudo (si te sentís cómodo) | Comentarios |
| 30 | IG | Historias H10 | Qué viene: próximas funciones confirmadas | Lista de espera |

---

## 6. Programa beta

### 6.1 Selección

- 10 comercios reales que vendan hoy (no ideas de negocio): 4 de ropa o accesorios, 3 ferreterías, casas de electro o bazar, 3 de artesanías o deco (idealmente 1 o 2 que estén en otra plataforma).
- Que tengan WhatsApp activo con clientes y al menos 20 productos para cargar.
- Que acepten dos charlas de 20 minutos y usar la tienda con clientes reales durante 30 días.

### 6.2 Qué les das y qué les pedís

- **Das:** plan Pro durante la beta (extendé el trial a mano en `/platform/tiendas/<id>`), alta acompañada de 30 minutos por videollamada, tu WhatsApp directo y el precio fundador (`MARKETING.md` §5.2) si deciden quedarse.
- **Pedís:** compartir el link con sus clientes, dos entrevistas, contarte cada vez que algo no funciona y, si les va bien y están de acuerdo, un caso con su nombre.

### 6.3 Calendario de cada comercio

| Momento | Qué pasa |
| --- | --- |
| Día 0 | Invitación (texto en `SOCIAL-KIT.md` §6) |
| Día 1 | Alta acompañada: el comercio maneja, vos mirás. Anotá cada duda |
| Día 3 | WhatsApp: "¿Pudiste cargar los productos que te faltaban? ¿Qué te trabó?" |
| Día 7 | Entrevista 1 (guion §6.4) |
| Días 7 a 21 | Un mensaje por semana con una sola pregunta (§6.6) |
| Día 21 | Entrevista 2: valor y precio |
| Día 30 | Cierre: ¿se queda? ¿con qué plan? ¿caso? |

### 6.4 Guion de la entrevista (20 minutos)

Grabá sólo si te lo autorizan. Hablá poco: la meta es escuchar.

**0 a 2 min · Contexto**
- "Gracias por el tiempo. No hay respuestas buenas ni malas: si algo no te sirve, me ahorrás meses de trabajo."
- "¿Te molesta si grabo para no tomar notas? Queda entre nosotros."

**2 a 7 min · Cómo vende hoy**
- "Contame la última venta que hiciste: desde que te escribieron hasta que entregaste."
- "¿Qué parte de eso te lleva más tiempo? ¿Qué parte te da más miedo que salga mal?"
- "¿Cuántas consultas por día te llegan por WhatsApp o Instagram, más o menos?"

**7 a 15 min · Uso observado** (comparte pantalla)
- "Mostrame cómo cargarías un producto nuevo con talles." (No ayudes. Anotá dónde duda.)
- "Ahora cambiale el precio a toda una categoría." / "Configurá el envío a tu barrio."
- "Si fueras tu cliente, comprá algo en tu tienda desde el celular."
- Preguntas neutras: "¿Qué esperabas que pasara acá?" · "¿Qué buscás en esta pantalla?"

**15 a 18 min · Valor y precio**
- "Si mañana Ecommy desaparece, ¿qué extrañarías? ¿Qué no?"
- "¿Cuánto pagás hoy por herramientas para vender (plataforma, apps, diseñador)?"
- "¿A qué precio por mes te parecería caro? ¿A cuál tan barato que desconfiarías?"

**18 a 20 min · Cierre**
- "¿Qué es lo único que cambiarías esta semana?"
- "¿Conocés a otro comercio al que le serviría? ¿Me lo presentarías?"
- "Si en unas semanas los números te acompañan, ¿te animarías a contar tu experiencia con tu nombre? Te mando todo para que lo apruebes antes."

### 6.5 Qué observar (checklist para tus notas)

- Tiempo desde el registro hasta la tienda con ≥ 10 productos activos.
- Pantallas donde duda más de 10 segundos o vuelve atrás.
- Palabras que usa para describir su problema (sirven para el copy, textuales).
- Si entiende la diferencia entre "transferencia" y "acordar por WhatsApp" en el checkout.
- Si configura el descuento por transferencia y los datos bancarios sin ayuda.
- Si comparte el link y dónde (bio, estados de WhatsApp, grupos).
- Primer pedido real: cuándo, por qué canal llegó, si el comercio lo vio en el panel o se enteró por WhatsApp.
- Qué pide que no existe (anotalo con la frase exacta y cuántos lo pidieron).

### 6.6 Cómo pedir feedback sin molestar

- Una sola pregunta por mensaje, una vez por semana, siempre el mismo día.
- Preguntas concretas: "¿Qué hiciste esta semana en el panel que te llevó más de lo que esperabas?" · "Del 0 al 10, ¿cuánto recomendarías Ecommy a otro comercio? ¿Por qué ese número?" (el porqué vale más que el número).
- Cuando arregles algo que pidió, avisale con el nombre de la mejora. Es la mejor manera de que siga contando cosas.

### 6.7 De beta a caso de éxito real

Un caso se publica sólo si se cumplen las tres cosas:
1. **Hay un dato real** tomado de su panel con su permiso: pedidos en 30 días, tiempo que le lleva actualizar precios antes y después, cantidad de productos cargados. Nunca números redondeados "hacia arriba" ni proyecciones.
2. **La cita es textual**, salida de la entrevista, y la aprobó por escrito tal como se va a publicar.
3. **Hay autorización escrita** (WhatsApp o mail alcanza) para usar nombre, logo, capturas de su tienda y link. Guardala en una carpeta "Autorizaciones" con fecha.

Texto de autorización para mandar:

> "Hola, [nombre]. Te paso cómo quedaría el caso para la web de Ecommy: [texto completo + capturas]. ¿Me autorizás a publicarlo con el nombre de tu tienda, tu logo, estas capturas y el link a tu tienda? Podés pedirme que lo baje cuando quieras y lo saco en el día."

**Formato del caso** (200 palabras): quién es y qué vende · cómo vendía antes · qué cambió (una función concreta) · el dato · la cita · link a su tienda. Va en la landing (cambio de código fuera de este kit), en un post de LinkedIn y en un carrusel de IG.

Si un comercio pide que lo bajes, se baja el mismo día, de todos los canales.

---

## 7. Riesgos y supuestos

### Supuestos (validarlos en la beta)

| Supuesto | Cómo se valida | Si es falso |
| --- | --- | --- |
| Los comercios chicos cobran mayormente por transferencia y WhatsApp y no necesitan pasarela para empezar | % de pedidos beta por transferencia vs. WhatsApp; cuántos piden tarjeta | Adelantar Mercado Pago como pasarela para las tiendas (hoy está en v0.3 del backlog) |
| "Sin comisión" es un motivo de cambio fuerte | Frecuencia con que aparece en entrevistas sin que lo sugieras | Liderar con "pedido ordenado por WhatsApp" y "precios que se actualizan" |
| La carga del catálogo se resuelve en una tarde | Tiempo a 10 productos activos | Plantillas CSV por rubro, alta acompañada como servicio |
| El comercio comparte el link | Paso 4 del embudo + preguntar | Mensajes prearmados para compartir, QR para el local |
| El dueño puede atender soporte de 30 a 50 tiendas por WhatsApp | Horas por semana en soporte | FAQ en la web, videos cortos por tarea, respuestas rápidas |

### Riesgos

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Cobro manual de planes que no escala y se olvida | Ingresos perdidos, clientes en Pro sin pagar | Planilla de cobros con vencimientos; plan anual por transferencia; priorizar Mercado Pago (v0.2, `BILLING.md`) |
| Sin emails automáticos (confirmación de pedido al comprador, aviso al vendedor) | Pedidos que el comercio no ve a tiempo | Aviso de pedidos nuevos en el panel; otro agente está implementando emails con Resend (checklist §3) |
| Mails de registro que no llegan (SMTP de Supabase con límite bajo) | Registros perdidos el día del lanzamiento | SMTP propio con Resend antes de lanzar (checklist §2 y §3) |
| Catálogo de la demo tomado de la web de un tercero | Reclamo por uso de imágenes y textos | Confirmar el permiso por escrito o reemplazar la demo (checklist §0) |
| Nombre "Ecommy" con otra marca registrada | Tener que cambiar de nombre con cuentas ya abiertas | Búsqueda y registro en INPI (checklist §7) |
| Bloqueo del WhatsApp de la plataforma por mensajes en masa | Se corta el canal de ventas y de soporte | Sólo mensajes 1 a 1 a gente con relación; número de respaldo |
| Caída de Supabase o de Vercel el día del lanzamiento | Mala primera impresión | Monitoreo externo, mensaje de incidente preparado, rollback (checklist §10) |
| Afirmaciones sobre la competencia que cambian | Descrédito o reclamo | Sólo lo marcado como seguro en `MARKETING.md` §4, con captura fechada |
| Fundador solo: producto, soporte y marketing compiten por las mismas horas | Todo avanza a medias | Ritual semanal; un solo objetivo por semana; cortar canales que no activan tiendas |
| Precios en pesos con inflación | Margen que se achica mes a mes | Revisión trimestral; anual limitado (`MARKETING.md` §5.2) |
