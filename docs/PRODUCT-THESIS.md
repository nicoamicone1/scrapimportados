# Ecommy: tesis de producto

> Fecha: 2026-10-05 · versión del producto: 0.9.0 → 0.10.0.
> Para: el dueño y los agentes. Es la idea alrededor de la cual gira el producto. Cuando una
> feature nueva no la empuja, no entra. Documentos hermanos: [`MARKETING.md`](MARKETING.md)
> (posicionamiento y copy), [`BRAND.md`](BRAND.md) (voz), [`ECOMMY-SPEC.md`](ECOMMY-SPEC.md)
> (qué hay construido), [`FEATURES-AUDIT.md`](FEATURES-AUDIT.md) (contra la competencia).

---

## 0. Origen

Un diagnóstico externo (otra IA, 2026-10-05) revisó la landing y concluyó: "Ecommy no se siente
vibecodeada; lo que le falta es una tesis". Propuso girar de *plataforma para crear tiendas* a
*sistema operativo del comercio chico argentino*, con "Hoy" como corazón, WhatsApp como canal
operativo en las dos direcciones, Argentina como ventaja y nada de "IA" decorativa.

Este documento toma de ese diagnóstico lo que confirma el código, descarta lo que no, y agrega lo
que el código muestra y la landing no cuenta.

## 1. Lo que confirmamos (y por qué)

| Idea del diagnóstico externo | Veredicto | Evidencia en el código |
| --- | --- | --- |
| "Hoy" tiene que ser el corazón del producto | **Sí, ya lo es a medias.** El inicio (`/admin`) ya ordena por urgencia (`TodoBoard`), pero cada ítem *te manda a otra pantalla*: es un resumen, no un lugar de trabajo | `src/app/admin/(panel)/page.tsx`, `src/components/admin/dashboard/TodoBoard.tsx` |
| El enemigo no es Shopify: es la planilla + WhatsApp + notas + memoria | **Sí.** `MARKETING.md` §1 ya lo dice ("lo que les falta no es una pasarela, es orden"), pero el hero de la landing abre con una lista de features ("Catálogo con variantes y stock, carrito, envíos por zona…") | `src/components/platform/landing/Hero.tsx` |
| Argentina como ventaja, sin folklore | **Sí.** Ya está en el producto (arrepentimiento, Ley 27.743, Data Fiscal, alias, cuotas, zonas por barrio, inflación con precios masivos). Falta decirlo de frente | `docs/BRAND.md` §2 "Argentina sin folklore" |
| Nada de "✨ IA" que escribe descripciones | **Sí.** Ninguna feature de este tipo entra |
| "Menos clics": acciones masivas con preview y deshacer como filosofía | **Sí.** Ya existe en precios (preview + undo), pedidos (acción rápida + deshacer, masivas) y páginas (plantilla con deshacer). Es una regla de diseño, no una feature | `src/components/admin/pricing/BulkPriceWizard.tsx`, `src/components/admin/orders/quick-action.ts` |
| No sobreconstruir; mantener "Lo que hoy no hace" | **Sí.** |

## 2. Lo que descartamos o acotamos

| Idea | Decisión | Por qué |
| --- | --- | --- |
| Bot de WhatsApp que responde solo ("¿tenés la remera negra M?" → respuesta automática) | **No, por ahora.** | Exige la API de WhatsApp Business (Meta Cloud API): aprobación, número dedicado, costo por conversación y un onboarding que el comercio chico no hace. Además rompe un principio vigente del producto: *Ecommy nunca manda nada solo; el comerciante lo manda desde su WhatsApp* (`src/lib/admin/whatsapp.ts`). Lo que sí hacemos: **respuestas listas** (§4.2), que resuelven el 80 % del valor sin bot |
| "¿Por qué vendí menos esta semana?" con IA conversacional | **Acotado a una versión determinista.** | El valor está en *qué cambió* (producto que cayó, precio que subiste, stock que se agotó), no en el chat. Eso sale de SQL que ya tenemos (`admin_top_products`, `price_batches`, `low_stock_variants`). Sin modelo de lenguaje, sin costo por consulta, sin alucinaciones |
| Puntajes (UX 8, diferenciación 5, defensibilidad 4) | **Coincidimos en el orden, no en la causa.** | La diferenciación baja no es por falta de features: es porque la landing cuenta la tienda y no la operación. El moat es *hábito + datos + conocimiento local*, y el hábito se construye con "Hoy" |

## 3. Diagnóstico propio (leyendo el código, no la landing)

1. **El producto va adelante del relato.** Hay stock por variante, reserva con vencimiento, pedido
   registrado antes de WhatsApp, cobro con MP, precios masivos con deshacer, auditoría, roles,
   legales argentinas. La landing lo presenta como "ecommerce completo", que es la categoría más
   ocupada del mercado.
2. **"Hoy" no cierra el ciclo.** El inicio dice *qué* hay que hacer, pero para hacerlo hay que
   entrar a cada pedido. Un comerciante con 6 pedidos por confirmar hace 6 × (abrir, confirmar,
   volver). El "sistema operativo" se gana cuando lo resuelve ahí mismo.
3. **No hay cierre del día.** No existe el momento "listo por hoy". Sin ese cierre, el panel es
   un tablero más; con él, es un hábito.
4. **WhatsApp es de ida.** La tienda → pedido → WhatsApp funciona. La vuelta (el cliente pregunta
   por WhatsApp → el comercio responde con stock, precio y link → se arma el pedido) hoy es
   "abrir productos, mirar stock, escribir a mano".
5. **Los números del inicio describen, no explican.** "Ventas 7 días −18 %" sin el *por qué*
   es un dato que el comerciante ya intuye.

## 4. Decisión: qué construimos en 0.10

**Una frase.** Ecommy es el lugar donde un comercio argentino que vende por WhatsApp, Instagram
y su tienda sabe qué tiene que hacer hoy, lo resuelve ahí mismo y entiende qué pasó.

### 4.1 Hoy como superficie de trabajo (no como resumen)

- Cabecera: "Tenés N cosas para resolver" y, al terminar, "Listo por hoy".
- "Resolver desde acá": los pedidos accionables (por confirmar, por preparar, por despachar)
  con su siguiente paso en un toque (reutiliza `quickActionFor` y las acciones de pedidos),
  con Deshacer y "Avisar por WhatsApp" sin salir del inicio.
- Nada nuevo en la base: todo sale de `orders` y de las acciones que ya existen.

### 4.2 Respuestas listas (WhatsApp → operación, sin bot)

- `/admin/responder`: buscás el producto, ves variantes con stock y precio, y copiás la respuesta
  armada ("Sí, tenemos la remera negra en M. Sale $ 24.900, con 10 % menos por transferencia.
  Podés comprarla acá: link"). Sin stock: la respuesta ofrece el aviso de reposición.
- Respuestas fijas para lo que preguntan siempre: envío a una zona (costo y plazo), cómo pagar
  (alias, descuento, cuotas), retiro (dirección y horarios).
- Desde cada respuesta: "Armar pedido" (pedido manual) y "Abrir WhatsApp".
- Principio intacto: el comerciante manda el mensaje; Ecommy sólo lo deja listo.

### 4.3 Qué pasó esta semana (inteligencia operacional determinista)

- Una tarjeta en el inicio: "Vendiste 18 % menos que la semana pasada. Remeras cayó 31 %. Subiste
  los precios de Remeras un 12 % el martes. La remera negra M se quedó sin stock el jueves".
- Sale de comparar los dos períodos con lo que ya hay. Sin IA. Cada línea linkea a donde se
  resuelve.

### 4.4 Relato de la landing

- Hero: el dolor (vender por WhatsApp e Instagram con planilla y memoria) y la promesa (orden),
  no la lista de features.
- Sección "Antes / Con Ecommy": las siete herramientas contra una sola operación.
- Argentina de frente: "Hecho para vender en Argentina", con lo que eso implica, dicho en
  palabras de mostrador.
- "Hoy" y "Respuestas listas" como escenas del panel, no como bullets.
- Se conservan: "Lo que vendés es tuyo. Entero.", "Lo que hoy Ecommy no hace", planes, FAQ.

## 5. Reglas para lo que viene (filtro de features)

Una feature entra si contesta **sí** a por lo menos una:

1. ¿Le saca una tarea de hoy al comerciante o se la deja resuelta en un toque?
2. ¿Cierra un paso del circuito cliente → tienda → pedido → cobro → envío → WhatsApp?
3. ¿Resuelve algo que en Argentina se hace todas las semanas (inflación, transferencia, zonas,
   ley)?
4. ¿Hace que Ecommy *entienda* el negocio (datos que después explican algo)?

Y no entra si:

- Es "IA" que escribe por el comerciante (descripciones, banners, slogans).
- Es una feature de checklist comparativo contra Shopify o Tiendanube que ninguna pyme pidió.
- Manda mensajes en nombre del comercio sin que el comerciante los toque.

## 6. Lo que sigue (después de 0.10)

- Hoy: "preparar los pedidos de hoy" como lote (seleccionar, marcar preparados, imprimir remitos).
- Respuestas listas desde el celular en dos toques (barra inferior) y desde el command palette.
- Semana: comparar contra el mismo período del año anterior cuando haya historia.
- Clientes: "quién compró hace 60 días y no volvió" como respuesta lista para WhatsApp.
