# Auditoría UX/UI: shell del panel, inicio, marca y componentes compartidos

Alcance: tokens (`globals.css`, `admin.css`), shell (`AdminShell`, `Sidebar`, `Topbar`, `MobileTabBar`, `CommandPalette`, `StoreSwitcher`), Inicio (`(panel)/page.tsx` + `loading.tsx`), checklist de primeros pasos, `AuthLayout` (login, registro, reset, invitación, alta de tienda), banners de plan (`TrialBanner`, `LimitBanner`, `PlanGate`), `PendingApproval`, `UnderConstruction`, logo (`_brand/glyph.tsx`) y `components/ui/*`.
Criterios: `BRAND.md` (§4, §5, §7, §10, §11, §13) y `DESIGN.md` §1.2 y §7. El comerciante gestiona desde el celular (360 px, targets ≥ 44 px).
Prioridades: **P0** bloquea o rompe una tarea diaria · **P1** fricción real · **P2** pulido.

Todo lo de "Cambios hechos" está implementado en el árbol. Verificado con `tsc` (proyecto completo sin errores), `eslint` sobre mis archivos y `vitest` (`nav.test.ts`, `redes.test.ts`, `src/lib/admin`). No se probó en navegador.

---

## 0. Tokens de marca (primer paso, del que dependen los demás)

| Cambio | Archivo |
| --- | --- |
| Primitivos `--eco-*` de BRAND §5.5 en `:root` (colores, fuentes, radios 4/6/10, easing, duraciones 120/200/280) | `globals.css` |
| Utilidades Tailwind: `bg-eco-ink`, `text-eco-amber-ink`, `bg-eco-pine`… (16 colores), `font-display`, `rounded-eco(-sm/-lg)`, `ease-eco-out/in`. Nuevas `adm`: `bg-adm-danger-hover`, `text-adm-danger-on-dark` | `globals.css` |
| `--adm-*` referencian `--eco-*` (bg, surface, fg, accent, ámbar, sidebar, tintas pino/ámbar/gris, radio) | `admin.css` |
| Contraste BRAND §5.4: `--adm-focus-ring` `#A8702A` (3,49:1 sobre crema), `--adm-input-border` `#968F80` (3,21:1) y hover `#7A7465`, `--adm-fg` = `--eco-ink` | `admin.css` |
| Foco de inputs: además del halo ámbar al 35 % (decorativo), un anillo de 1 px `--adm-focus-ring` que sí llega a 3:1 aunque una utilidad pise el `border-color` | `admin.css` |
| Hex sueltos → tokens: `#f3b1a8` (error sobre tinta), `#9a1d13` (hover danger), sombras y backdrop con la tinta de marca; skeleton 1,2 s lineal (BRAND §9); dialogs/drawers con `--eco-dur-2/3` | `admin.css`, `globals.css`, `SaveBar`, `Sidebar`, `Button` |
| `BRAND_FG` = `#1a2320` (una sola tinta, BRAND §5.4); `BrandTile` acepta `background` (pino sobre tinta) y radio 18 % por defecto | `_brand/glyph.tsx` |

---

## 1. Shell: navegación (sidebar, topbar, mobile)

**Objetivo:** llegar a cualquier tarea en el menor número de toques y saber siempre en qué tienda y sección estoy.

| Diagnóstico | Bien / mal |
| --- | --- |
| Sidebar tinta plano, ítem activo pino + barra ámbar, grupos con tinta de sección | Bien: cumple DESIGN §7.3 |
| Logo = "e" en texto `font-bold` sobre cuadrado **ámbar** | Mal: BRAND §4.1/§4.2 (la "e" cambia según el SO; sobre tinta el tile va pino) |
| **Mobile: todo el menú detrás de una hamburguesa de 32 px** | Mal (P0 de BRAND §11): ver pedidos = 2 toques, target chico y arriba a la izquierda, lejos del pulgar |
| Topbar mobile: buscador ocupa todo el ancho, "Ver tienda" oculto | Mal: lo que más hace el comerciante en el celular (mirar su tienda) no estaba |
| 23 ítems en 5 grupos; "Importar" en Sistema | Mal: importar la lista del proveedor es una tarea de catálogo |
| "Dashboard", "Changelog" | Mal: jerga; BRAND §11 "lenguaje del comercio" |
| Breadcrumb "Principal / Dashboard" en el inicio | Mal: "Principal" no significa nada; duplica el título |
| Command palette: "Ver tienda" iba a `/` (la landing en el host del panel) | Bug |
| Sin "Saltar al contenido" | Mal: WCAG 2.4.1 |
| Menú de usuario sin "Mi cuenta" | Fricción: la ruta existe pero sólo se llegaba por la palette |

**Cambios hechos**

| Cambio | Archivo |
| --- | --- |
| **Barra inferior mobile** (< md, 56 px + safe area): Inicio, Pedidos (badge ámbar de nuevos), Productos, Compartir, Menú (drawer completo). Activo pino + barra ámbar. Pedidos/Productos/Compartir a **1 toque** | `MobileTabBar.tsx` (nuevo), `nav.ts` (`MOBILE_TABS`), `AdminShell.tsx` |
| La barra se oculta sola si la página tiene barra fija inferior (`[data-adm-bottom-bar]`, ya en `SaveBar`) o un campo con foco (teclado); los toasts suben para no taparla | `admin.css`, `Toaster.tsx`, `SaveBar.tsx` |
| Topbar mobile: tienda a la izquierda (ocupa el ancho) + buscar, ver tienda y cuenta como íconos de 44 px; sin hamburguesa. Desktop: buscador con borde visible y placeholder "Buscar pedidos, productos o ir a…" | `Topbar.tsx`, `StoreSwitcher.tsx` |
| Logo SVG: `BrandMark` 28 px tile **pino** + "Ecommy" 17/600 mist en el sidebar | `Sidebar.tsx` |
| Menú: "Inicio" y "Novedades" (keywords conservan "dashboard"/"changelog"); "Importar" pasa a Catálogo | `nav.ts`, `nav.test.ts` |
| Breadcrumb sólo desde `lg` y nunca en Inicio | `Topbar.tsx` |
| "Ver tienda" de la palette usa la URL de la tienda activa; palette más arriba en mobile, filas 44 px táctil, input 16 px | `CommandPalette.tsx` |
| "Saltar al contenido" + `main` enfocable; drawer `min(288px, 85vw)` | `AdminShell.tsx` |
| Menú de usuario: Mi cuenta · Usuarios y roles · Cerrar sesión | `Topbar.tsx` |
| Ítems del sidebar/drawer y dropdowns a 44 px en pantallas táctiles; items de dropdown con alto mínimo (el de dos líneas del selector de tienda desbordaba) | `Sidebar.tsx`, `DropdownMenu.tsx` |

**Pendientes**

| Prioridad | Pendiente |
| --- | --- |
| P1 | Validar en iOS/Android reales la regla `:has(input:focus)` y el safe area (no hay `viewport-fit=cover`; sumarlo exige padding de safe area en sidebar y topbar en horizontal). |
| P1 | El dueño de `changelog/` debe renombrar el título de la página a "Novedades" para que coincida con el menú. |
| P2 | Grupo Sistema: Auditoría y Novedades podrían salir del menú (Novedades ya está en el pie del sidebar) y quedar en Configuración. |
| P2 | Sidebar desktop: el nombre de la tienda se repite en el sidebar y en el selector del topbar; con una sola tienda sobra uno. |

---

## 2. Inicio (`/admin`)

**Objetivo:** contestar "¿qué tengo que hacer hoy?" y llegar a eso en un toque; después, "¿cómo viene la tienda?".

| Diagnóstico | Bien / mal |
| --- | --- |
| Franja de métricas tipográfica, barras monocromas, sin donuts | Bien: DESIGN §1.2 |
| Orden: métricas → **gráfico a todo el ancho** → recién ahí "Requieren acción" | Mal: la tarea del día quedaba bajo el pliegue (en 360 px, a ~2 pantallas) |
| "Requieren acción" en 3 columnas fijas, sin reservas, arrepentimientos ni stock | Mal: cortado a 360 px; pendientes repartidos en 4 tarjetas distintas |
| Descripción "Hola, Nico. Así viene tu tienda." | Mal: no es un dato (DESIGN §7.4) |
| Chip del plan en el título + "Ver tienda" en acciones | Mal: duplicados del sidebar, del banner de prueba y del topbar |
| Últimos pedidos: sólo el `#número` es link (target de ~40×16 px) | Mal: ver un pedido costaba puntería |
| Tarjetas "Stock bajo"/"Arrepentimientos" vacías siempre visibles | Mal: ruido ("No hay solicitudes pendientes") |
| Sin pedidos: tarjeta pino-claro con primario "Crear pedido manual" + checklist con su CTA ámbar | Mal: dos acciones principales compitiendo; hex `#cfdcd3` |
| Gráfico SVG 720 escalado a 330 px → etiquetas de ~5 px | Mal: ilegible en celular |
| Números de 28 px en grilla 2×2 a 360 px (`$ 1.234.567` desborda) | Mal |
| Compartir el link: no estaba en el inicio (BRAND §11: ≤ 2 toques) | Mal |

**Cambios hechos**

| Cambio | Archivo |
| --- | --- |
| Nuevo orden: encabezado → checklist (si está abierto) → **Para hacer** + últimos pedidos (8) / arrepentimientos + stock (4) → "Cómo viene la tienda" (período, métricas, gráfico, más vendidos) | `(panel)/page.tsx` |
| **"Para hacer"**: sólo lo pendiente (por confirmar, para despachar, pagos sin acreditar con monto, reservas por vencer, arrepentimientos, stock bajo); cada fila 56 px lleva a la vista filtrada (`?tab=`, `?pago=impago`, `?estado=bajo`, `#por-vencer`) | `(panel)/page.tsx` |
| Descripción = dato: "Para hoy: 3 por confirmar · 2 para despachar" o "Estás al día…" | `(panel)/page.tsx` |
| Acciones: **Copiar link** (1 toque; tilda el paso "compartí tu link") + avisos de pedidos. Fuera chip de plan y "Ver tienda" duplicados | `(panel)/page.tsx`, `OnboardingActions.tsx` |
| Últimos pedidos y reservas: **fila entera clickeable**, 2 líneas en mobile (número + cliente + total / badges), punto ámbar + "nuevo" para no vistos | `(panel)/page.tsx` |
| Arrepentimientos sólo si hay; selector de período junto a las métricas que afecta (antes arriba de todo) | `(panel)/page.tsx` |
| Sin pedidos: `EmptyState` neutro; "Crear pedido manual" es secundario mientras el checklist esté abierto (una acción principal por vista) | `(panel)/page.tsx` |
| Gráfico: versión compacta (360) en mobile y completa (720) desde `sm`; tabla `sr-only` única | `SalesChart.tsx` |
| `Stat`: 22 px en mobile, 28 px desde `sm`, padding 16 px | `ui/display.tsx` |
| Skeleton con la forma nueva (para hacer + pedidos | stock, luego métricas) | `skeletons.tsx`, `(panel)/loading.tsx` |
| Título de la pestaña "Inicio" | `(panel)/page.tsx` |

**Pendientes**

| Prioridad | Pendiente |
| --- | --- |
| P1 | Acción rápida en la fila de "Para hacer" (ej. "Confirmar" sin salir del inicio) reutilizando la acción rápida de `OrdersTable` (otro agente). |
| P1 | `getDashboard` devuelve hasta N reservas por vencer: el contador de "Para hacer" usa `expiring.length`, no un `count` real (cambio de datos fuera de mi área). |
| P2 | Tooltip del gráfico con `<title>` no funciona al tocar; un tap debería mostrar monto del día. |

---

## 3. Primeros pasos (checklist)

**Objetivo:** "la tienda en una tarde": el siguiente paso siempre visible y a un toque.

| Diagnóstico | Bien / mal |
| --- | --- |
| Pasos que se tildan solos mirando la base; siguiente paso en ámbar | Bien |
| "Copiar link" siempre ámbar aunque no fuera el siguiente paso | Mal: dos botones ámbar en pantalla (BRAND §5.3) |
| Hex `#cfdcd3`/`#b9c9be`; números en círculos; barra de progreso pill | Mal: §13.2 y §13.7 |
| Link "QR y mensajes listos" sin subrayar | Mal: BRAND §10 (pino vs. tinta < 3:1) |

**Cambios hechos:** ámbar sólo si "compartí" es el próximo paso; WhatsApp con `buttonClass` (mismo alto que los botones); bordes `adm-accent/20`, números en cuadrado radio 4, barra radio 2; links subrayados. Prop opcional `status` para no leer dos veces. (`OnboardingChecklist.tsx`, `OnboardingActions.tsx`)

| Prioridad | Pendiente |
| --- | --- |
| P2 | "Ocultar" no tiene Deshacer: debería volver a mostrarse desde Configuración o con un toast con Deshacer. |

---

## 4. Pantallas sin sesión (`AuthLayout`) y redirects `/admin/login`, `/admin/setup`

**Objetivo:** entrar o crear la cuenta sin distracciones; transmitir la marca.

| Diagnóstico | Bien / mal |
| --- | --- |
| Formulario a la izquierda, frase + mock del storefront a la derecha (desktop) | Bien: producto real, no ilustración (BRAND §8) |
| Logo "e" en texto | Mal: BRAND §4.1 |
| Panel derecho **pino** de media pantalla | Mal: BRAND §5.3 "pino = acción"; las bandas grandes son tinta |
| Hex `#e8b574`, `#cfe0d7`, `#e2dbcd`… en la frase y el mock | Mal: §13.2 |
| Redirects `/admin/login` → `/login` (con `next`), `/admin/setup` → `/registro` | Bien: sin cambios |

**Cambios hechos:** `BrandMark` SVG 28 px tinta + "Ecommy" 17/600, todo link a `/`; banda **tinta** con eyebrow ámbar 12 px y dato en sage; mock con tokens (sólo los tonos de "foto" del comercio de ejemplo quedan literales); aviso de pedido del mock en pino (sobre tinta un tile tinta desaparece, BRAND §4.2). (`AuthLayout.tsx`)

| Prioridad | Pendiente |
| --- | --- |
| P2 | En mobile no hay nada de marca más allá del lockup: una línea de la promesa bajo el título ayudaría en el registro (owner de `registro/`). |

---

## 5. Banners de plan, PlanGate, PendingApproval, UnderConstruction

| Pantalla | Diagnóstico | Cambios hechos |
| --- | --- | --- |
| `LimitBanner` | Al 80 % era gris neutro sin consecuencia; BRAND §10 pide ámbar lavado + número + consecuencia | Siempre `amber-soft` + ícono `amber-ink`; texto "Usás 46 de 50… Al llegar a 50 no vas a poder sumar más; lo que ya tenés no se toca." Link subrayado |
| `TrialBanner` | Bien (días restantes y qué pasa al vencer). Link sin subrayar; cerrar 32 px | Link subrayado; cerrar 44 px táctil |
| `PlanGate` | Candado en círculo (BRAND §8) | Cuadrado radio 6, ícono `amber-ink`; link subrayado |
| `PendingApproval` | Pantalla huérfana sin marca; "hablá con él" asume género | Lockup arriba; "Quien administra la tienda… escribile." |
| `UnderConstruction` | Mostraba "agente X" al comerciante (jerga interna) e "Ir al dashboard" | Texto neutro, "Ir al inicio"; la prop `owner` se mantiene por compatibilidad |

---

## 6. Componentes `ui/*` (consistencia y táctil)

| Diagnóstico | Bien / mal |
| --- | --- |
| Densidades de desktop (28/32/36 px) coherentes con DESIGN §7.2 | Bien |
| En celular los mismos 28–32 px | Mal: BRAND §7/§11 piden ≥ 44 px |
| Inputs a 14 px | Mal: iOS hace zoom al enfocar |
| `variant="link"` sin subrayado | Mal: BRAND §10 |
| Placeholder al 70 % de muted (~3:1) | Mal: poco legible |
| Switch apagado: perilla blanca sobre riel arena (sin contraste) | Mal: WCAG 1.4.11 |
| `EmptyState` con ícono de 40 px | Mal: BRAND §8 (20–24 px) |
| Badges con hex de DESIGN §7.7 | Aceptable (documentados), pero no son tokens |

**Cambios hechos** (API compatible: sólo clases y props opcionales)

| Cambio | Archivo |
| --- | --- |
| `pointer-coarse`: botones md/lg/icon 44 px, sm/icon-sm 36 px + área táctil invisible (`::before`) ≥ 44 px; inputs/select 44 px (sm 40), texto 16 px | `Button.tsx`, `Input.tsx`, `SearchInput.tsx` |
| Tabs, paginación, items de dropdown y palette a 44 px táctil | `Tabs.tsx`, `Pagination.tsx`, `DropdownMenu.tsx`, `CommandPalette.tsx` |
| `link` subrayado (hover lo quita); danger hover por token; transiciones 120 ms `ease-eco-out` | `Button.tsx` |
| Placeholder `--adm-fg-muted` pleno; hover de borde en `SearchInput`; limpiar búsqueda 24/32 px | `Input.tsx`, `SearchInput.tsx` |
| Switch: perilla gris apagada (5:1), área táctil extendida | `Switch.tsx` |
| `SaveBar`: `data-adm-bottom-bar`, safe area, botones a todo el ancho en mobile, `z-40` (si el navegador no soporta `:has`, la SaveBar queda por encima de la barra inferior) | `SaveBar.tsx` |
| Toasts: suben sobre la barra inferior y la SaveBar (`offset`/`mobileOffset` con variables) | `Toaster.tsx`, `admin.css` |
| `EmptyState` ícono 24 px trazo 1,5 | `display.tsx` |
| `AccountPageSkeleton` con `BrandMark` en vez de la "e" de texto | `skeletons.tsx` |

**Pendientes**

| Prioridad | Pendiente |
| --- | --- |
| P1 | `Dialog` en mobile: hoy es un modal centrado; para formularios largos conviene hoja inferior a pantalla completa con acciones fijas abajo. |
| P1 | Componentes hechos a mano por otras áreas al lado de un `Button` (alto fijo `h-7`/`h-8`) quedan desalineados en táctil: migrarlos a `buttonClass()`. |
| P2 | Badges §7.7 como tokens `--adm-status-*` en `admin.css` (hoy hex en `Badge.tsx`). |
| P2 | `_brand/wordmark.tsx` (wordmark SVG con trazos de Archivo, BRAND §4.1): requiere los contornos de la fuente; hoy el panel usa texto del sistema 600. |

---

## 7. Checklist BRAND §13 por interfaz (después de los cambios)

`ok` cumple · `parc` parcial (ver nota) · `—` no aplica

| # | Shell | Inicio | Checklist | Auth | Banners | ui/* |
| --- | --- | --- | --- | --- | --- | --- |
| 1 Logo SVG | ok | — | — | ok | — | ok |
| 2 Sólo tokens | ok | ok | ok | parc¹ | ok | parc² |
| 3 Proporción ámbar/pino | ok | ok | ok | ok | ok | ok |
| 4 Una acción primaria | ok | ok | ok | ok | ok | — |
| 5 Contraste | ok | ok | ok | ok | ok | ok |
| 6 Tipografía | ok | ok | ok | ok | ok | ok |
| 7 Radios/sombras | ok | ok | ok | ok | ok | parc³ |
| 8 Íconos | ok | ok | ok | — | ok | ok |
| 9 Imágenes | — | — | — | ok | — | — |
| 10 Copy | ok | ok | ok | ok | ok | — |
| 11 Afirmaciones | — | ok | — | ok | ok | — |
| 12 Estados | ok | ok | parc⁴ | — | ok | ok |
| 13 Movimiento | ok | ok | ok | ok | ok | ok |
| 14 360 px | ok | ok | ok | ok | ok | parc⁵ |
| 15 Storefront | — | — | — | — | — | — |

¹ Tonos de "foto" del comercio de ejemplo en el mock. ² Badges §7.7. ³ Avatar redondo del topbar (DESIGN §7.3 lo pide). ⁴ "Ocultar" sin Deshacer. ⁵ `Dialog` sin versión hoja inferior.

---

## 8. Para los demás agentes

- Barra fija inferior propia (acciones masivas, wizards, como `BulkPriceWizard`): agregá `data-adm-bottom-bar` al contenedor para ocultar la barra inferior mobile y subir los toasts.
- En pantallas táctiles los controles miden 44 px: un control hecho a mano al lado de un `Button` tiene que usar `buttonClass()` / `controlClass`.
- Contenido de página en mobile ya tiene `padding-bottom` para la barra inferior (`--adm-bottom-nav-h`); no sumes otro.
- Logo: `BrandMark`/`BrandLockup` de `components/platform/brand.tsx` (usan `BrandGlyph`). Nunca la "e" en texto.
- Menú: "Inicio", "Novedades" y "Importar" en Catálogo.
