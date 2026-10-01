# Auditoría UX/UI: admin de Catálogo

Alcance: productos (listado y ficha), categorías, inventario (stock, movimientos, avisos), precios (masivo e historial), importar (alta y detalle), promociones y cupones.
Vara: `docs/BRAND.md` §3, §10, §11, §13 y `docs/DESIGN.md` §7. No se corrió la app: todo se verificó con `tsc`, `eslint` y `vitest`; falta una pasada visual a 360 px y 1280 px.
Prioridades: **P0** bloquea la tarea o la deja a medias · **P1** ahorra tiempo o evita errores seguros · **P2** pulido.

## Resumen

| Tema | Antes | Ahora |
| --- | --- | --- |
| Celular | Tablas de 5 a 11 columnas con scroll horizontal; targets de 28 px | Listas de tarjetas con targets de 44 px en productos, inventario, importar (historial e ítems), promociones y cupones; filtros plegados en "Filtros (n)" |
| Alta de producto | Descripción antes que el precio; 9 campos de precio y stock juntos; dos botones primarios; había que cambiar el estado a mano | Nombre, fotos, precio y stock primero; "Más datos" plegado; un solo guardado (SaveBar); "Publicar al crear" y "Crear y cargar otro" |
| Acciones masivas | Archivar tenía Deshacer; publicar, borrador y categoría no; la barra se iba al hacer scroll | Deshacer en los cambios de estado; en celular la barra queda fija abajo (`data-adm-bottom-bar`); atajo "Cambiar precios" desde la selección |
| Precios | Dos botones primarios; la regla no estaba a la vista al aplicar; sin atajos desde otras pantallas | Un primario; la barra de aplicar dice la regla, cuántas variantes y el total; `?productos=` y `?categoria=` preseleccionan el alcance |
| Importar | Aviso legal arriba de todo; siempre arrancaba en "tienda online"; al terminar no decía qué hacer | Aviso debajo del panel; arranca en planilla si ya hay productos; al terminar, un paso siguiente (revisar y publicar borradores) |
| Promos y cupones | Pausar = 3 toques; formularios largos con todo abierto | Interruptor en la fila (1 toque, con Deshacer); lo avanzado plegado; nombre de promo opcional; cupón con frase "Así queda" |

## Productos: listado (`/admin/productos`)

**Objetivo:** encontrar un producto y corregir precio, stock o estado sin abrir la ficha; actuar sobre varios a la vez.

| Diagnóstico | Bien / mal | Por qué |
| --- | --- | --- |
| Edición en línea de precio y stock de variante única | Bien | Es la tarea diaria; 1 toque y Enter. |
| Filtros en URL, tabs de estado con conteo, velo de carga | Bien | Compartible, sin recargas. |
| "8 sin stock" era texto muerto | Mal | El dato más accionable no llevaba a ningún lado. |
| Deshacer sólo en archivar | Mal | Publicar por error deja la tienda mostrando borradores. |
| Tabla de 8 columnas a 360 px; edición inline de 28 px | Mal | Incumple BRAND §11 (celular) y §7 (44 px). |
| 6 controles de filtro siempre visibles | Mal en celular | Empujan la lista fuera de la pantalla. |
| Selección sin salida hacia precios | Mal | Seleccionar para "subir precios" es el flujo más común. |

**Cambios hechos** (`ProductsTable.tsx`, `InlineNumber.tsx`, `productos/page.tsx`)
- Lista de tarjetas en celular: miniatura 44 px, estado y stock bajo como badge, precio y stock como botones de 44 px editables en el lugar; tabla de escritorio sin cambios de columnas salvo que "Estado" ya no se esconde.
- "N sin stock" del encabezado es un link a `?stock=sin`.
- Deshacer para publicar, borrador, archivar y restaurar (cada producto vuelve a su estado previo).
- Barra de selección: Publicar, Pasar a borrador, Archivar, menú "Categoría" y "Cambiar precios" (abre Precios con la selección). En celular queda fija abajo.
- Filtros plegados en celular ("Filtros (2)"), abiertos mientras haya alguno activo.
- `InlineNumber` pasó a archivo propio para reusarlo en Inventario.

| Pendiente | Prio | Nota |
| --- | --- | --- |
| "Seleccionar los 312 productos" (todas las páginas con el filtro actual) | P0 | Hoy la acción masiva sólo alcanza los 50 de la página; requiere una action que reciba filtros en vez de ids. |
| Exportar la selección a CSV | P1 | |
| Atajo `/` para buscar y chips "Sin stock" / "Stock bajo" sobre la tabla | P1 | |
| Columna de margen (precio vs. costo) opcional | P2 | |

## Productos: alta y edición (`/admin/productos/nuevo`, `/[id]`)

**Objetivo:** cargar un producto vendible (nombre, foto, precio, stock, categoría) en el menor tiempo, desde el celular si hace falta.

| Diagnóstico | Bien / mal | Por qué |
| --- | --- | --- |
| Borrador local en `localStorage`, Ctrl+S, aviso al salir, errores con foco | Bien | Protege el trabajo; cumple BRAND §3 (error con salida). |
| Orden: descripción rica, descripción corta, fotos, precio | Mal | El único campo obligatorio además del nombre quedaba al final. |
| 9 campos de variante única a la vista (costo, SKU, código de barras, peso, umbral…) | Mal | Ruido para el 80 % de las altas; BRAND §11 pide divulgación progresiva. |
| Botón "Guardar" en el encabezado y SaveBar a la vez | Mal | Dos primarios en la vista (BRAND §10 y §13.4). |
| Producto nuevo queda en borrador; cambiarlo exigía abrir un select al final de la columna lateral | Mal | En celular está después de SEO. |
| Cargar varios seguidos exigía volver a la lista y a "Nuevo" | Mal | 3 toques de más por producto. |
| Tabla de variantes de 1080 px | Mal en celular | Sin vista alternativa. |
| Precio por cantidad, ficha, relacionados, SEO y IVA siempre abiertos | Mal | Página de 8 paneles para un alta de 4 datos. |
| Aviso de borrador con hex literales | Mal | Viola BRAND §13.2. |

**Cambios hechos** (`ProductForm.tsx`, `VariantsEditor.tsx`, `CollapsibleCard.tsx`, `CategoryTreeSelect.tsx`, `ImageManager.tsx`, `SpecsEditor.tsx`)
- Orden nuevo: Nombre, Imágenes, Precio y stock; en celular siguen Estado y Organización; después Descripción y los paneles plegables. En escritorio la columna lateral sigue sticky.
- Precio, stock y precio tachado arriba; costo, SKU, código de barras, peso, aviso de stock bajo y "Controlar stock" en "Más datos" (abierto si ya hay valores o un error).
- Un solo primario: la SaveBar (siempre visible en producto nuevo; sólo con cambios en edición).
- Producto nuevo: casilla "Publicar al crear" y botón "Crear y cargar otro" (conserva categoría, marca, estado e IVA del anterior; foco en Nombre).
- Variantes en celular: tarjetas con precio y stock, "Más datos" plegado; la tabla se mantiene desde 768 px.
- `CollapsibleCard`: Precio por cantidad, Ficha técnica, Relacionados, SEO e Impuestos arrancan cerrados con un resumen ("2 tramos", "Automático") y se abren solos si tienen contenido o un error.
- Tokens en vez de hex en el aviso de borrador y en los bordes hover; targets táctiles en selector de categorías, editor de specs, etiquetas e imágenes.

| Pendiente | Prio | Nota |
| --- | --- | --- |
| Subir fotos en un producto nuevo guarda el producto como borrador | P1 | Está avisado en el toast; lo ideal es subir a un lugar temporal y asociar al crear. |
| Publicar un producto sin foto o sin precio no avisa | P1 | Un aviso previo en el SaveBar ("Sin fotos: se va a ver sin imagen"). |
| SKU sugerido a partir del nombre | P1 | BRAND §11 (defaults inteligentes). |
| Editor de descripción en celular | P1 | La barra de herramientas es densa; evaluar modo texto simple. |
| Duplicar con variantes y fotos desde la ficha | P2 | |

## Categorías (`/admin/categorias`)

**Objetivo:** armar y ordenar el árbol que ve el cliente.

| Diagnóstico | Bien / mal | Por qué |
| --- | --- | --- |
| Árbol con arrastre, anidado por desplazamiento, teclado con `KeyboardSensor`, orden optimista | Bien | Directo y reversible (revierte si falla). |
| Arrastre en pantalla táctil | Mal | El handle no tenía `touch-action: none`: competía con el scroll. |
| Cantidad de productos oculta en celular | Mal | Es el dato para decidir si borrar o fusionar. |
| SEO siempre abierto en el drawer | Mal | Alta de una categoría = un nombre. |
| Armar el árbol exigía abrir el drawer por cada categoría | Mal | |

**Cambios hechos** (`CategoriesManager.tsx`, `CategoryDrawer.tsx`)
- Handle táctil de 44 px con `touch-none`; filas de 48 px en celular; conteo "n prod." visible en celular.
- Menú de fila: "Ver sus productos" y "Cambiar sus precios" (abre Precios con la categoría elegida).
- Drawer: "Crear y agregar otra" (queda abierto, mismo nivel) y SEO plegado ("Automático" / "Personalizado").

| Pendiente | Prio | Nota |
| --- | --- | --- |
| Alternativa al arrastre: "Subir", "Bajar", "Mover dentro de…" en el menú | P1 | Arrastrar con el pulgar sigue siendo incómodo y no es accesible por puntero sin arrastre (WCAG 2.5.7). |
| Asignar productos desde la categoría | P1 | |
| Categorías ocultas con productos activos: aviso | P2 | |

## Inventario (`/admin/inventario`, `/movimientos`, `/avisos`)

**Objetivo:** saber qué reponer y dejar el stock en su número real, con rastro.

| Diagnóstico | Bien / mal | Por qué |
| --- | --- | --- |
| Cada ajuste pasa por `adjust_stock` y queda en movimientos | Bien | Auditoría real. |
| Tarjetas "Stock bajo" y "Agotadas" más tabs con los mismos conteos | Mal | Dos controles para lo mismo; BRAND §11 (un objetivo por pantalla). |
| Ajustar = abrir un dialog con modo, cantidad, motivo y nota | Mal | 5 pasos para "tengo 12, no 9". |
| Tabla de 8 columnas; en celular, targets chicos | Mal | |
| Avisos de stock: columna "Pedido" era la fecha del pedido de aviso, y el texto mencionaba "migración 0016" | Mal | Ambigua con "pedido" de venta; jerga técnica a la vista (BRAND §3). |

**Cambios hechos** (`InventoryTable.tsx`, `inventario/page.tsx`, `movimientos`, `avisos`)
- Stock editable en el lugar (escribís lo que hay ahora; Enter): queda como movimiento "Ajuste" y el toast trae Deshacer. El dialog queda en el menú como "Sumar o restar con motivo…" y en la acción masiva.
- Celular: tarjetas con el stock como botón de 44 px y barra de acciones fija abajo.
- Encabezado con el resumen ("3 agotadas · 12 con stock bajo · $ X a costo"); sin tarjetas duplicadas.
- Movimientos: motivo bajo el producto en celular. Avisos: "Pidió", email bajo el producto en celular, copy sin jerga.

| Pendiente | Prio | Nota |
| --- | --- | --- |
| Modo recuento: recorrer la lista con teclado y escáner de código de barras | P1 | Ya existe el campo `barcode`. |
| "Reponer" como acción: sumar N a las agotadas desde la lista | P1 | |
| Exportar inventario desde esta pantalla (hoy lleva a Configuración) | P2 | |

## Precios (`/admin/precios`, `/historial`)

**Objetivo:** "subir 8 % a Herramientas", ver cómo queda y poder deshacerlo.

| Diagnóstico | Bien / mal | Por qué |
| --- | --- | --- |
| Vista previa fila por fila, exclusiones, tope y redondeo, historial con Deshacer | Bien | Es la promesa de marca ("Subí un 8 %… y deshacelo"). |
| "Aumento rápido" con botón primario y "Aplicar" también primario | Mal | Dos primarios. |
| Alcance sólo desde esta pantalla | Mal | Se llega desde la lista de productos o categorías con una idea ya formada. |
| La barra de aplicar no repetía la regla | Mal | Se aplica lejos de donde se eligió; el riesgo es aplicar otra cosa. |
| Vista previa de 6 columnas y chips de 32 px | Mal en celular | |

**Cambios hechos** (`BulkPriceWizard.tsx`, `precios/page.tsx`, `PriceBatchHistory.tsx`)
- `?productos=id,id` (hasta 100) y `?categoria=id` preseleccionan el alcance (uso desde la lista de productos y categorías).
- Una sola acción primaria ("Aplicar a N variantes"); "Aumento rápido" pasa a "Ver vista previa" (secundaria).
- Barra de aplicar con la regla en palabras, N variantes, suma antes → después y variación total; botón de ancho completo en celular; `data-adm-bottom-bar`.
- Vista previa e historial con columnas secundarias ocultas en celular (SKU, tachado, usuario) y chips de 44 px con foco visible.

| Pendiente | Prio | Nota |
| --- | --- | --- |
| Guardar reglas usadas ("+8 % mensual a Herramientas") | P1 | La inflación repite la operación. |
| Programar la aplicación para una fecha | P1 | |
| Resumen por categoría en la vista previa (antes de ver 214 filas) | P1 | |
| Reglas por costo: avisar cuántas variantes no tienen costo antes de elegirla | P2 | |

## Importar (`/admin/importar`, `/[jobId]`)

**Objetivo:** cargar la lista del proveedor (actualizar por SKU) o traer un catálogo de otra tienda.

| Diagnóstico | Bien / mal | Por qué |
| --- | --- | --- |
| Detectar antes de importar, vista previa de muestra con recargo, revisión previa opcional, pausa y reanudar, historial | Bien | Control sin fricción. |
| El aviso legal ocupaba la parte superior | Mal | Es un recordatorio; competía con la tarea. |
| Siempre arrancaba en "tienda online" y CSV en "actualizar" aun sin productos | Mal | El default no seguía el caso más probable. |
| El detalle mostraba estadísticas y registro antes que los ítems en revisión | Mal | La tarea en revisión es elegir qué importar. |
| Al terminar no había paso siguiente | Mal | Los nuevos quedan en borrador y nadie lo dice. |
| Historial de 11 columnas e ítems de 7 columnas en celular | Mal | |
| Dos botones primarios en el detalle terminado | Mal | "Volver a sincronizar" competía. |

**Cambios hechos** (`importar/page.tsx`, `NewImportPanel.tsx`, `JobDetailView.tsx`, `JobItemsTable.tsx`)
- Tabs "Traer de otra tienda" y "Planilla CSV del proveedor"; arranca en planilla si ya hay productos (modo "actualizar por SKU") o en tienda online si no.
- Aviso legal debajo del panel; encabezado orientado a las dos tareas.
- Detalle: en revisión, los ítems van primero; el registro es plegable (abierto si corre, falla o hay errores); al terminar aparece un bloque con el resultado y un primario ("Revisar y publicar los borradores" o "Ver los productos") y "Ver historial de precios".
- Historial e ítems como tarjetas en celular; columnas secundarias ocultas por ancho en escritorio.

| Pendiente | Prio | Nota |
| --- | --- | --- |
| Mapeo de columnas del CSV (hoy los encabezados son fijos: `sku`, `price`…) | P0 | La lista de un proveedor real casi nunca viene con esos nombres; sin mapeo hay que editar el archivo antes. |
| La importación sólo avanza mientras la página está abierta | P0 | En celular el sistema suspende la pestaña; se necesita un worker o cron del lado del server. |
| Aceptar `.xlsx` | P1 | Hoy: "Guardar como CSV UTF-8". |
| Vista previa del CSV (primeras filas) antes de subir | P1 | |
| "Ver los N con error" desde el bloque final | P2 | |

## Promociones (`/admin/promociones`)

**Objetivo:** armar un descuento (%, monto, 3x2, 2.ª unidad) para un alcance y una fecha, y cortarlo cuando haga falta.

| Diagnóstico | Bien / mal | Por qué |
| --- | --- | --- |
| Vista previa en vivo con precios reales, reglas explicadas en palabras, SaveBar | Bien | Evita errores de configuración. |
| Nombre obligatorio "sólo lo ves vos" | Mal | Un campo que no aporta bloquea el guardado. |
| Prioridad, acumulable y etiqueta abiertas | Mal | Avanzado para el 90 % de los casos. |
| La vista previa quedaba al final en celular | Mal | Es el feedback de lo que se acaba de elegir. |
| Tabla de 9 columnas; pausar = menú, Pausar (3 toques) | Mal | |

**Cambios hechos** (`PromotionForm.tsx`, `PromotionActions.tsx`, `promociones/page.tsx`)
- Nombre opcional: si queda vacío se usa "-20 % · Hogar" (el hint lo muestra).
- Orden: Descuento, Alcance, Vista previa (en celular, justo después), Vigencia y estado, "Más opciones" plegado con resumen.
- `PromotionActiveSwitch`: pausar o activar en la fila, con Deshacer; tarjetas en celular; Tipo, Prioridad y Acumulable ocultos hasta pantallas anchas.

| Pendiente | Prio | Nota |
| --- | --- | --- |
| Plantillas ("Ciber Monday", "Liquidación de temporada") con vigencia y etiqueta | P1 | |
| Aviso de promos superpuestas sobre los mismos productos en el listado | P1 | |
| Vigencia rápida ("hoy", "este fin de semana") | P2 | |

## Cupones (`/admin/cupones`)

**Objetivo:** crear un código, limitarlo y poder cortarlo.

| Diagnóstico | Bien / mal | Por qué |
| --- | --- | --- |
| Generar código, probador de cupón en el detalle, "ya se usó: desactivalo" | Bien | Previene errores. |
| Alcance y vigencia abiertos aunque casi siempre son "toda la tienda / sin límite" | Mal | |
| Sin una frase que resuma lo que se está por crear | Mal | Seis campos numéricos sueltos. |
| Tabla de 8 columnas; pausar en 3 toques | Mal | |

**Cambios hechos** (`CouponForm.tsx`, `CouponActions.tsx`, `cupones/page.tsx`)
- "Activo" junto al código; Alcance y Vigencia plegados con resumen; frase "Así queda: BIENVENIDO10 · 10 % de descuento · compra mínima $ 20.000. Alcance: Toda la tienda. Sin vencimiento."
- `CouponActiveSwitch` en la fila con Deshacer; tarjetas en celular.

| Pendiente | Prio | Nota |
| --- | --- | --- |
| Crear varios códigos de una vez (campaña con N códigos de un solo uso) | P1 | |
| Copiar el código desde la fila | P2 | |

## Checklist BRAND §13 para esta área

| # | Ítem | Estado |
| --- | --- | --- |
| 2 | Sólo tokens `--adm-*`; sin hex ni clases de color de Tailwind | Cumple (se quitaron los hex de `ProductForm`, `VariantsEditor`, `SpecsEditor`). |
| 4 | Una acción primaria por vista | Cumple en ficha de producto, precios, importar. Inventario no tiene primaria: la tarea es editar en la fila. |
| 5 | Contraste y foco | Los chips de radio ahora muestran foco (`has-[:focus-visible]`); el resto usa los componentes `ui`. |
| 10 | Copy en voseo, verbo + objeto, sin jerga | Cumple; se reescribieron avisos de stock y el mensaje del borrador. |
| 12 | Estados | Hay `loading.tsx` en cada ruta; vacíos con acción en todos los listados; Deshacer en estados, stock, precios, promos y cupones. |
| 14 | 360 px, sin scroll horizontal, 44 px | Listas en celular en 5 de 6 listados; el detalle de variantes y la vista previa de precios siguen siendo tablas con columnas ocultas. Falta verificación visual. |

## Para otros agentes

- `components/ui`: `Checkbox` mide 16 px (el área de toque se resolvió envolviéndolo en un `label` de 44 px en las listas); conviene un `before:` ampliado como en `Switch`.
- `components/ui`: un primitivo `ResponsiveList` (tabla en escritorio, tarjetas en celular) evitaría repetir el patrón `hidden md:block` / `md:hidden` en cada listado.
- `CollapsibleCard` vive en `components/admin/products` y lo usan promociones y cupones; si se quiere compartir en todo el admin, moverlo a `components/ui`.
