# Auditoría UX/UI: admin de operación y configuración

Alcance: Pedidos (listado, detalle, nuevo, remitos, arrepentimientos, abandonados), Clientes, Envíos, Usuarios, Configuración, Plan, Compartir, Auditoría, Changelog, Menús.
Criterios: `BRAND.md` §3, §10, §11 y §13; `DESIGN.md` §7. Prioridad: el comerciante atiende desde el celular (360 px, targets >= 44 px).
Prioridades: P0 bloquea una tarea diaria · P1 fricción real · P2 pulido.

Cómo leer los "cambios hechos": todo está implementado en el árbol, sin tocar server actions, schema, billing ni `components/ui`. Verificado con `tsc`, `eslint` y `vitest` sobre mis carpetas. No se probó en navegador (no se corrió `next dev`).

---

## 1. Pedidos: listado (`/admin/pedidos`)

**Objetivo:** ver qué pedidos requieren acción y resolverlos (confirmar pago, pasar de estado) sin abrir cada uno.

| Diagnóstico | Bien / mal |
| --- | --- |
| Tabs con conteos (Pendientes, Por preparar…) y descripción con el dato útil | Bien: responde "qué hago ahora" |
| Tabla de 10 columnas | Mal: a 360 px es scroll horizontal; `Ítems` y `Método` eran columnas sueltas |
| Cambiar estado sólo con checkbox + menú masivo o entrando al detalle | Mal: el caso más común (confirmar un pedido) costaba 3+ toques |
| Menú "…" con `opacity-60`, 28 px | Mal: target chico, poco descubrible |
| 8 controles de filtro siempre visibles | Mal: a 360 px ocupan ~400 px antes del primer pedido |
| Error/feedback de acciones masivas con toast | Bien, pero sin Deshacer |

**Cambios hechos**

| Cambio | Archivo |
| --- | --- |
| Celular y tablet (< lg): cada pedido es una tarjeta táctil (toda la tarjeta navega al detalle), con total, cliente, badges, vencimiento de reserva y botón de siguiente paso de 44 px | `OrdersTable.tsx` |
| Escritorio: 8 columnas (se fusionan Ítems bajo Total y Método bajo Pago) | `OrdersTable.tsx` |
| **Acción rápida por fila**: "Confirmar pago" (pendiente + sin pagar + transferencia: registra el saldo y confirma), o el siguiente estado ("Confirmar", "Pasar a preparación", "Marcar enviado" con diálogo de seguimiento, "Marcar entregado"). Toast con **Deshacer** (vuelve al estado anterior) | `OrdersTable.tsx`, `quick-action.ts` (+ test) |
| Filtros: buscar, estado y pago a la vista; método, entrega, fechas y orden detrás de "Más filtros (n)", que se abre solo si hay alguno aplicado | `OrdersFilters.tsx` |
| Targets >= 44 px en celular en filtros, menú de fila y acciones masivas | ambos |

**Pendientes**

| P | Qué |
| --- | --- |
| P1 | "Confirmar pago" asume `payment_method_code === "transfer"`; un método propio de tipo transferencia con otro código no lo dispara. Convendría que `OrderListItem` traiga el `type` del método. |
| P1 | Atajos de teclado en escritorio (j/k para moverse, c para confirmar). |
| P1 | Vista guardada del último tab/filtros del comerciante. |
| P2 | Selección múltiple en celular (hoy el checkbox existe pero es secundario); falta barra de acciones masivas sticky abajo. |
| P2 | `loading.tsx` genérico: no imita las tarjetas del celular. |

---

## 2. Pedidos: detalle (`/admin/pedidos/[id]`)

**Objetivo:** "Confirmar el pago de un pedido y avisar al cliente por WhatsApp", y mover el pedido hasta entregado.

| Diagnóstico | Bien / mal |
| --- | --- |
| Estado y pago son independientes: confirmar un pago de transferencia eran 3 pasos (Registrar/Marcar pagado → diálogo → Confirmar → WhatsApp en otra tarjeta) | Mal |
| Botón primario "siguiente estado" al final de la fila de acciones del header, sin contexto de por qué | Mal: en celular queda último y bajo la imagen |
| Columna lateral (cliente, teléfono, dirección, WhatsApp) después de productos, pagos y actividad en celular | Mal: lo primero que hace el comerciante es leer a quién y adónde |
| Tres botones primarios a la vez (header, "Registrar pago", "Agregar nota") | Mal: viola "una acción primaria por vista" |
| Tabla de productos de 4 columnas con scroll horizontal en celular | Mal |
| Teléfono sin `tel:`; WhatsApp con 3 toques (botón, diálogo, abrir) | Mejorable |
| Plantilla de WhatsApp según estado, editable, con log en el timeline; link público copiable; reserva con "Extender 24 h"; notas autoguardadas | Bien |

**Cambios hechos**

| Cambio | Archivo |
| --- | --- |
| Tarjeta **"Siguiente paso"** arriba de todo: título + una frase de contexto + un botón primario + uno secundario (por WhatsApp). Cubre pendiente/transferencia ("Confirmar pago": cobra el saldo, confirma, y el toast ofrece "Avisar por WhatsApp"), pedido nuevo en otro método, confirmado, en preparación, enviado/retiro y entregado con saldo | `OrderActions.tsx` (nuevo; reemplaza `OrderHeaderActions.tsx`) |
| Proveedor único de acciones (estado, cobro, WhatsApp, seguimiento, cancelar) para que tarjeta, header y tarjeta de cliente compartan flujo y diálogos | `OrderActions.tsx` |
| Header: "Imprimir remito" + "Más acciones" (WhatsApp, cambiar estado, editar seguimiento, cancelar). El primario ya no está en el header salvo "Reabrir pedido" en cancelados | `OrderActions.tsx` |
| Cambios de estado con **Deshacer** en el toast | `OrderActions.tsx` |
| En celular, el orden es Cliente y Envío → Productos → Pagos → Actividad → Reserva, Notas, Link (grilla con áreas, escritorio sin cambios) | `pedidos/[id]/page.tsx` |
| Productos en celular: `cant × precio` bajo el nombre y sin columnas extra | `pedidos/[id]/page.tsx` |
| Teléfono con `tel:`; un solo primario por vista ("Registrar pago" y "Publicar nota" pasan a secundarios) | `page.tsx`, `PaymentsCard.tsx`, `OrderTimeline.tsx` |
| `WhatsAppComposer` pasa a `WhatsAppDialog` (se monta al abrir), reutilizable desde cualquier punto del detalle | `WhatsAppComposer.tsx` |

**Pendientes**

| P | Qué |
| --- | --- |
| P1 | Sin teléfono, el aviso sólo dice que no se puede; falta un campo en línea para cargarlo. |
| P1 | "Confirmar pago" no pide comprobante: para quien quiere adjuntarlo sigue "Registrar pago" (secundario, más abajo). Evaluar "Registrar con comprobante" dentro de la tarjeta. |
| P1 | Los íconos del timeline van en círculos con borde (BRAND §8 los quiere sin círculos). |
| P2 | Barra de acciones sticky abajo en celular (se evitó para no chocar con el shell). |
| P2 | Deshacer reenvía el aviso al cliente (los avisos salen de `applyStatusChange`); valorar un retardo de 5 s antes de notificar. |

---

## 3. Pedidos: crear pedido (`/admin/pedidos/nuevo`)

**Objetivo:** cargar rápido una venta por WhatsApp o del local.

| Diagnóstico | Bien / mal |
| --- | --- |
| Buscador de clientes y productos con debounce, precio editable, totales en vivo, "ya está pagado" | Bien |
| Para sumar un producto había que tocar el resultado | Mal si se tipea SKU o se usa lector |
| En celular el total y el botón quedaban al final de un formulario largo | Mal |
| Controles de línea de 28 px en celular | Mal |
| Cliente obligatorio aun en venta de mostrador | Mal (pendiente: requiere server) |

**Cambios hechos:** Enter agrega el primer resultado con stock (SKU o lector); barra sticky con unidades, total y "Crear pedido" en celular (el botón de la tarjeta queda sólo en escritorio, una sola acción primaria por breakpoint); controles de línea de 44 px.

| P | Pendiente |
| --- | --- |
| P0 | "Consumidor final": hoy se obliga a elegir o crear un cliente aun para una venta de mostrador. Requiere permitir cliente opcional en `createManualOrder`. |
| P1 | Atajo de tipo de venta ("Mostrador": retiro + pagado) como defaults. |
| P2 | Resultados del buscador con teclado (flechas). |

---

## 4. Remitos (`/admin/pedidos/imprimir`)

**Objetivo:** imprimir A4 o ticket 80 mm.

Diagnóstico: bien resuelto (auto-print, QR, log de impresión, sin marca de Ecommy como pide BRAND §12). Mal: el formato elegido no se recordaba.
**Cambio hecho:** el formato se recuerda por navegador (`localStorage` con try/catch) y se aplica si la URL no trae `format` (`PrintToolbar.tsx`).
Pendiente P2: botón "Imprimir" y pestañas de formato de 28 px (es vista de escritorio).

## 5. Arrepentimientos y carritos abandonados

Diagnóstico: informativos y correctos (copy legal claro, `PlanGate`). Tablas de 7 columnas sin versión para celular.
Cambios: ninguno. Pendientes: **P1** versión en tarjetas para celular (las dos); **P2** acción rápida "Responder por WhatsApp" desde la fila de arrepentimientos.

---

## 6. Clientes

**Objetivo:** encontrar a un cliente y contactarlo.

| Diagnóstico | Bien / mal |
| --- | --- |
| Listado con 6 columnas | Mal en celular |
| Para escribirle había que entrar al detalle | Mal |
| Filtro por etiqueta sin forma visible de sacarlo | Mal |
| Detalle con métricas (Pedidos, Total, Ticket, Por cobrar), pedidos y notas autoguardadas | Bien |
| Teléfono y email como texto plano | Mal |

**Cambios hechos:** teléfono y email bajo el nombre (columnas Último pedido y Etiquetas sólo desde md/lg); botón de WhatsApp por fila con saludo armado (sólo si el teléfono es válido); chip "Etiqueta: x" que se saca de un toque; buscador y orden de 44 px en celular; en el detalle `tel:` y `mailto:` (`clientes/page.tsx`, `CustomersToolbar.tsx`, `clientes/[id]/page.tsx`).

| P | Pendiente |
| --- | --- |
| P1 | Segmentos rápidos (sin comprar hace 60 días, con saldo por cobrar). |
| P1 | Sin exportar desde acá (está en Configuración › Exportar). |
| P2 | Fila completa clickeable. |

---

## 7. Envíos

**Objetivo:** configurar una zona de envío (qué cubre, cuánto cuesta, cuándo es gratis).

| Diagnóstico | Bien / mal |
| --- | --- |
| Pestañas Zonas / Retiro / Probar dirección con conteos, empty state con "Cargar ejemplo" | Bien |
| Formulario de zona: nombre, costo y demora, alcance con 4 tipos y mapa, SaveBar sticky | Bien: orden y divulgación correctos |
| Aviso de prioridad ("queda debajo de Todo el país") | Bien: previene un error silencioso |
| Lista de 10 columnas | Mal en celular |
| Asa de arrastre y menú de 28 px | Mal en táctil |

**Cambios hechos:** en pantallas chicas la lista deja nombre, costo, activa y menú; alcance, demora y "gratis desde" pasan a una línea bajo el nombre; asa y menú de 44 px (`ZonesList.tsx`).

| P | Pendiente |
| --- | --- |
| P1 | Reordenar sin arrastrar (botones subir/bajar) para táctil. |
| P1 | "Probar dirección" debería estar a un toque desde el formulario de zona. |
| P2 | `PickupsPanel` no se revisó a fondo en celular. |

---

## 8. Configuración

**Objetivo:** completar lo que hace falta para vender (WhatsApp, pagos, legales) y volver a lo diario.

| Diagnóstico | Bien / mal |
| --- | --- |
| Índice con estado por fila (WhatsApp cargado, métodos activos, políticas 2 de 4) y alertas | Bien: dice qué falta |
| Subpáginas sin navegación entre sí: de Pagos a Legales había que volver al índice | Mal |
| Doble "Guardar": botón primario en el header y "Guardar" ámbar en la SaveBar | Mal: dos acciones primarias, dos formas de guardar |
| Formularios en 1/3 + 2/3, errores junto al campo, aviso al salir, Ctrl/Cmd+S | Bien |

**Cambios hechos:** `SettingsHeader` suma pestañas entre las 5 secciones (Tienda, Pagos y checkout, Impuestos y legales, SEO e integraciones, Exportar), activa por ruta; se saca `HeaderSave` de Tienda, Pagos, Legales y SEO: el único guardado es la SaveBar (más Ctrl/Cmd+S) (`SettingsHeader.tsx`, `SaveBar.tsx`, 4 formularios).

| P | Pendiente |
| --- | --- |
| P1 | `PaymentsForm` (492 líneas) mezcla métodos, datos bancarios, reserva, mensajes de WhatsApp y barra de envío gratis: partir en secciones plegables ("Cobro", "Checkout", "Mensajes"). |
| P1 | Inputs de 36 px en celular (global, del sistema `Input`). |
| P2 | Redirecciones sigue colgando de SEO sin pestaña propia. |

---

## 9. Plan

**Objetivo:** saber en qué plan estoy, cuánto uso, y cambiarlo/pagarlo.

| Diagnóstico | Bien / mal |
| --- | --- |
| Plan actual con precio, estado de MercadoPago (activo, pendiente, cancelando, mora) con fechas y consecuencias | Bien: transparente (BRAND §3.2) |
| Uso vs. límites sin aviso al acercarse | Mal: BRAND §10 pide banner desde el 80 % |
| Barras de uso sin semántica ni texto al llegar al límite | Mal: sólo color |
| Párrafo de 4 frases antes de las tarjetas de planes | Mal: texto largo antes de la decisión |
| Sin acceso directo a "Ver planes" arriba | Mal |

**Cambios hechos:** banner ámbar suave con el número concreto y "Ver planes" desde el 80 % (al 100 % dice que lo creado sigue ahí); barras ordenadas por cercanía al límite, con `role="progressbar"` y texto "Cerca del límite" / "Llegaste al límite"; botón "Ver planes" en el header; explicación de MercadoPago plegada en "Cómo funciona el cobro" y una sola frase visible (`plan/page.tsx`).

| P | Pendiente |
| --- | --- |
| P1 | Las tarjetas (`components/platform/PlanCards`, fuera de mi área) mezclan CTA primario por plan; revisar con el agente de plataforma. |
| P1 | Historial de cobros y comprobantes (no existe la vista). |
| P2 | Mostrar el próximo cobro como dato destacado en lugar de párrafo. |

---

## 10. Compartir

**Objetivo:** copiar y mandar el link de la tienda (<= 2 toques desde el dashboard).

| Diagnóstico | Bien / mal |
| --- | --- |
| Link + QR + mensajes listos con datos reales de la tienda (descuento, envío gratis) + selector por producto/categoría; marca el paso de onboarding | Bien: es la mejor pantalla del área |
| Sin hoja nativa de compartir en el celular | Mal: Instagram/Telegram no estaban cubiertos |
| Botones de 28–32 px | Mal en celular |
| QR con `#1C1917` (stone-900) | Mal: BRAND §5.4 unifica a `--eco-ink` |

**Cambios hechos:** "Compartir…" con Web Share API (sólo si el navegador la soporta); WhatsApp antes que "Abrir tienda" (que pasa a ghost); targets de 44 px; QR en `#1A2320` (`compartir/page.tsx`, `CopyButton.tsx`).
Pendiente: **P2** que `/admin/compartir/qr` (PNG) use el mismo color de tinta.

---

## 11. Usuarios

**Objetivo:** invitar gente y darle un rol.

| Diagnóstico | Bien / mal |
| --- | --- |
| Tabla con rol, estado, último acceso, alta, banner de límite de staff, invitaciones pendientes | Bien |
| Matriz de permisos siempre abierta debajo de la tabla | Mal: info de referencia compite con la tarea |
| 5 columnas y menú de 28 px | Mal en celular |

**Cambios hechos:** matriz de roles colapsada en `<details>` (resumen de una línea); Último acceso pasa bajo el email en celular y Alta sólo desde lg; menú de 44 px (`usuarios/page.tsx`, `UsersTable.tsx`).
Pendiente: **P1** mostrar el hint del rol dentro del diálogo de invitación (existe sólo en "Cambiar rol").

---

## 12. Auditoría

**Objetivo:** saber quién cambió qué y cuándo.

| Diagnóstico | Bien / mal |
| --- | --- |
| Código de acción en mono (`order.status`) como columna principal; el resumen legible, truncado | Mal: jerga delante, lo útil escondido |
| 6 columnas | Mal en celular |
| Filtros y export CSV, detalle expandible con antes/después | Bien |

**Cambios hechos:** columna "Qué pasó" (resumen, hasta 2 líneas) como principal; usuario y entidad bajo el resumen en pantallas chicas; Usuario, Entidad y código de acción pasan a columnas de escritorio, el código en muted; botón de detalle de 44 px (`AuditTable.tsx`, `AuditFilters.tsx`).
Pendiente: **P2** filtros colapsables en celular (hoy se apilan).

---

## 13. Changelog y Menús

| Pantalla | Diagnóstico | Cambios | Pendiente |
| --- | --- | --- | --- |
| Changelog | Versión actual abierta, anteriores plegadas, fechas con `<time>`: correcto | `summary` de 44 px en celular | Ninguno |
| Menús | Dos editores con su propio "Guardar" primario: dos acciones primarias y dos guardados independientes | "Guardar" es primario sólo cuando hay cambios; asas, quitar, sangría y "Agregar link" de 44 px y `touch-none` en el asa | **P1** una sola SaveBar para los dos menús; **P2** vista previa del menú |

---

## Checklist BRAND §13 (resumen del área)

| # | Ítem | Estado |
| --- | --- | --- |
| 1 | Logo | No aplica (no hay logo en estas pantallas) |
| 2 | Sólo tokens `--adm-*` / `--eco-*`, sin hex nuevos | Cumple (`WithdrawalsLink` pasa a `Badge`) |
| 3 | Ámbar sólo como atención | Cumple (banner de límite y SaveBar) |
| 4 | Una acción primaria por vista | Cumple en detalle de pedido, crear pedido, configuración. Menús: dos editores, un primario cada uno sólo cuando hay cambios |
| 5 | Contraste | Sin cambios de color; el borde del input depende de `admin.css` (otro agente) |
| 6 | Tipografía | Cumple; `tnum` en números nuevos |
| 7 | Radios y sombras | Cumple |
| 8 | Íconos lucide | Cumple, salvo timeline en círculos (P1) |
| 10 | Copy | Voseo, verbo + objeto ("Confirmar pago", "Avisar por WhatsApp", "Ver planes"); sin emojis ni exclamaciones |
| 12 | Estados | Vacío y error cubiertos; Deshacer en cambios de estado desde listado y detalle; límite de plan con número |
| 13 | Movimiento | Sin animaciones nuevas |
| 14 | 360 px | Listado y detalle de pedidos, crear pedido, clientes, envíos (lista), usuarios y auditoría sin scroll horizontal por diseño; **sin verificar en navegador** |

## Resumen de P0

| Pantalla | P0 |
| --- | --- |
| Crear pedido | Cliente opcional ("Consumidor final") para ventas de mostrador (requiere cambio en `createManualOrder`) |

Todo lo demás quedó en P1/P2.
