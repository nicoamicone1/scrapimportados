# Ecommy: manual de marca

> Fuente de verdad de la marca **Ecommy** (la plataforma): landing y sitio público (`src/app/(platform)`), panel (`src/app/admin`), alta de tienda, placas de redes (`src/app/_brand`) e imagen para compartir.
> Documentos hermanos: [`DESIGN.md`](DESIGN.md) (dirección de diseño y storefront temable; manda en los detalles de componentes), [`MARKETING.md`](MARKETING.md) §0 (hoja de datos: cada afirmación sale de ahí), [`SOCIAL-KIT.md`](SOCIAL-KIT.md) §0 (tono en redes).
> Si este manual y `DESIGN.md` chocan en **marca** (color, tipografía, logo, voz), manda este. En storefront y presets manda `DESIGN.md`: ahí la marca es la del comercio (§12).

---

## 1. Propósito, promesa y objetivos

| | |
| --- | --- |
| **Propósito** | Que un comercio argentino que ya vende por WhatsApp y transferencia venda **ordenado**, con su marca, sin regalarle un porcentaje a nadie. |
| **Misión** | Darle a la pyme una tienda online que se arma en una tarde y resuelve las tareas que en Argentina se hacen todas las semanas: precios por inflación, lista del proveedor, envío según el barrio, lo que pide la ley. |
| **Promesa** | Armás la tienda en una tarde con tu catálogo, compartís el link y los pedidos te llegan ordenados. Cobrás como ya cobrás, sin comisión por venta. |
| **Categoría** | Tienda online para pymes y emprendedores en Argentina. Más que el catálogo de WhatsApp Business; más simple y barata de operar que una tienda con pasarela. |
| **Lo que no somos** | Plataforma global, pasarela de pagos, marketplace, ERP. Se dice sin vueltas (MARKETING §1). |

**Objetivos de marca → cómo se miden en la interfaz**

| Objetivo | Tipo | Señal verificable |
| --- | --- | --- |
| "La tienda en una tarde" | Experiencia | Del registro a una tienda publicable sin documentación: preset por rubro, datos precargados, checklist de onboarding visible en el dashboard. |
| "Pedidos ordenados" | Experiencia | Cada pedido tiene número, estado, pago y total visibles en una fila; ningún pedido depende de un chat para existir. |
| "Sin comisión" | Negocio | Se dice en landing, planes y checkout de alta; nunca aparece un cargo por venta ni letra chica. |
| "Con tu marca" | Negocio | El storefront no muestra nada de Ecommy salvo el crédito de §12. |
| Confianza | Negocio | Cero cifras, testimonios o logos inventados; los límites se dicen antes de que el usuario los choque. |
| Gestión desde el celular | Experiencia | Toda tarea diaria (ver pedido, cambiar estado, editar precio/stock) se completa a 360 px. |

---

## 2. Personalidad

**Arquetipo:** *Compañero de oficio* (Everyman con un toque de Sabio). Alguien que sabe de comercio y de software, habla como un comerciante y te resuelve el problema sin hacerte sentir que no sabés.

| Rasgo | Es | No es |
| --- | --- | --- |
| **Cercana** | Voseo, frases cortas, habla del rubro del usuario ("si tenés una ferretería…"). | Canchera, chistosa, "¡Hola, crack!", lunfardo forzado. |
| **Experta** | Sabe de inflación, transferencias, Data Fiscal y zonas de reparto; lo dice en palabras de mostrador. | Técnica: "SKU" sólo donde el usuario ya lo usa; nada de "sincronizar el inventario multicanal". |
| **Argentina sin folklore** | Pesos, CUIT, barrios, códigos postales, "transferencia", "retiro en el local". Grotesca tipográfica porteña (§6). | Mate, fileteado, celeste y blanco, banderitas, "che boludo". |
| **Honesta** | Dice lo que no hace ("Hoy no hay cobro con tarjeta"), muestra pantallas reales, avisa límites antes. | Autodespectiva ni defensiva; tampoco promesas vacías ("llevá tu negocio al siguiente nivel"). |
| **Ordenada** | Una idea por pantalla, una acción principal, números alineados, estados claros. | Rígida ni burocrática: no pide datos que puede inferir. |

---

## 3. Voz y tono

### 3.1 Reglas de microcopy

| Regla | Sí | No |
| --- | --- | --- |
| Voseo siempre | "Cargás", "probalo", "tu tienda" | "Carga", "pruébelo", "su tienda" |
| Botones: infinitivo + objeto | "Crear producto", "Guardar cambios", "Archivar 3 productos" | "Aceptar", "OK", "Enviar", "Click acá" |
| Invitaciones (landing, onboarding): voseo imperativo | "Probalo 14 días", "Dibujá tu zona" | "¡Registrate YA!" |
| Un dato por frase, con número | "Subí un 8 % a Herramientas y deshacelo si te equivocaste." | "Actualizá tus precios fácilmente." |
| Números | `$ 14.999` (espacio después de `$`, punto de miles), `8 %`, `hace 2 h`, "1–50 de 312" | `$14999`, `8%`, fechas ISO |
| Exclamaciones | Máximo una por vista, y casi nunca | Exclamaciones en serie, MAYÚSCULAS sostenidas |
| Emojis | Ninguno en UI | "🚀✨🔥" |
| Sujeto | El usuario y su negocio: "tus pedidos", "tu cliente" | "Nosotros", "nuestra plataforma" (salvo legales y precios) |
| Mayúsculas | Oración: "Pedidos por confirmar" | Title Case: "Pedidos Por Confirmar" |

**Palabras prohibidas:** solución, ecosistema, potenciá, revolucioná, disruptivo, siguiente nivel, experiencia única, sin límites (salvo que sea literal), increíble, mágico, fácil (mostralo, no lo digas), "emprendedor/a, ¡esto es para vos!", "Error:" como prefijo.

### 3.2 Tono por contexto

| Contexto | Tono | Ejemplo |
| --- | --- | --- |
| Landing | Directo, con dato y dolor concreto | "Dejá de pasar precios por privado." |
| Panel | Neutro, mínimo, operativo | "142 productos activos · 8 sin stock" |
| Error | Qué pasó + cómo seguir; sin culpa ni código a la vista | "No pudimos guardar el precio. Revisá la conexión y probá de nuevo." |
| Validación | Seca, junto al campo | "Tiene que ser mayor a 0." |
| Vacío | Qué va a aparecer acá + primera acción | "Todavía no hay pedidos. Cuando alguien compre lo vas a ver acá." + "Crear pedido manual" |
| Éxito | Participio corto + siguiente paso o Deshacer | "Precios actualizados en 214 productos. Deshacer" |
| Destructivo | Verbo exacto y consecuencia | "Archivar 3 productos. Dejan de verse en la tienda; podés restaurarlos." |
| Límites de plan | Número concreto, sin culpa, salida clara | "Usaste 48 de 50 productos del plan Free. Ver planes" |
| Cobros de Ecommy | Transparente: monto, fecha, qué pasa si no se paga | "Tu prueba de Pro termina el 14/10. Pasás a Free y no se borra nada." |

---

## 4. Logo

### 4.1 Construcción

| Pieza | Especificación (fuente: `src/app/_brand/glyph.tsx`) |
| --- | --- |
| **Glifo "e"** | Trazo, no tipografía. Grilla 100 × 100, recorte `viewBox 16 16 68 68`. Panza: círculo r = 26 centrado en (50, 50). Barra horizontal de x 24 a 76 en y 50. Apertura abajo a la derecha: el arco termina en (69,9; 66,7), ~40° bajo la horizontal. Trazo 13 (= r/2), extremos rectos. |
| **Tile** | Cuadrado `--eco-ink` con el glifo `--eco-amber` ocupando el 62 % del lado, centrado. Radio = 18 % del lado (28 px → 5 px). |
| **Wordmark** | "Ecommy" en Archivo 600, tracking −0,01 em, color `--eco-ink` (claro) o `--eco-mist` (oscuro). Altura de x ≈ 40 % del tile. |
| **Lockup horizontal** | Tile + wordmark, separación = 0,36 × lado del tile (28 px → 10 px), centrado vertical. Es la versión por defecto. |

**Cambio respecto de hoy:** `BrandMark` (PlatformChrome y sidebar) dibuja la "e" con texto `font-bold` del sistema, que cambia según el SO (Segoe, SF, Roboto) y no coincide con el glifo de `next/og`. **Todas las apariciones usan `BrandGlyph`/`BrandTile` (SVG).** Ninguna "e" de logo como texto vivo. Además: el wordmark se entrega como SVG con el texto convertido a trazos (`src/app/_brand/wordmark.tsx`, a crear); mientras tanto, en la landing va en texto vivo con Archivo y en el panel con el stack del sistema 600.

### 4.2 Versiones

| Fondo | Tile | Glifo | Wordmark |
| --- | --- | --- | --- |
| Claro (`--eco-paper`, `--eco-cream`) | `--eco-ink` | ámbar | `--eco-ink` |
| Oscuro (`--eco-ink`: sidebar, footer, placas) | `--eco-pine` (si no, desaparece) | ámbar | `--eco-mist` |
| Pino (`--eco-pine`) | `--eco-ink` | ámbar | blanco |
| Monocromo (sellos, remito impreso) | sin tile | `--eco-ink` o negro | igual color |
| Favicon / app icon | tile a sangre, radio 18 % | ámbar | — |

### 4.3 Resguardo y tamaños mínimos

- Área de resguardo: 25 % del lado del tile en los cuatro lados (tile de 28 px → 7 px libres). Nada de texto, bordes ni íconos adentro.
- Mínimos: tile solo **16 px** (favicon); lockup **20 px** de tile; glifo suelto **12 px**. Debajo de eso, sólo el nombre en texto.
- Tamaños de uso: header de landing y sidebar 28 px; footer 28 px; placas 1080 px → tile 96–120 px.

### 4.4 Usos incorrectos

No estirar ni rotar · no cambiar el ámbar del glifo por otro color de la paleta (salvo monocromo) · no agregar sombra, brillo, gradiente ni contorno · no meter el glifo en un círculo · no poner el tile ink sobre fondo ink sin pasar a pino · no escribir "ECOMMY" en mayúsculas ni "eCommy"/"Ecommy.app" como logo · no usar el logo dentro del storefront de un comercio (§12) · no animarlo.

---

## 5. Color

### 5.1 Paleta

Contraste WCAG 2.x calculado. "AA texto" = ≥ 4,5:1; "AA UI" = ≥ 3:1 (bordes, íconos, foco, texto ≥ 24 px).

| Token marca | Hex | Rol | Contraste clave |
| --- | --- | --- | --- |
| `--eco-ink` | `#1A2320` | Verde-tinta: texto principal, sidebar, footer, bandas oscuras, tile | 16,09 sobre blanco · 13,43 sobre crema |
| `--eco-ink-2` | `#232E2A` | Hover sobre ink | — |
| `--eco-pine` | `#2E4A3F` | Pino: acción primaria, links, tab activa, ítem activo | 9,69 blanco encima · 8,09 sobre crema |
| `--eco-pine-dark` | `#243C33` | Hover del primario | — |
| `--eco-pine-soft` | `#E6EFE9` | Fondo de selección/onboarding | pino encima 8,25 |
| `--eco-amber` | `#E0A458` | Ámbar: el punto de atención | ink encima 7,37 · **sobre blanco 2,18 / crema 1,82: nunca texto en claro** |
| `--eco-amber-dark` | `#D3954A` | Hover de botón ámbar | — |
| `--eco-amber-soft` | `#F8ECD9` | Fondo lavado: fila seleccionada, banner de límite | amber-ink encima 5,07 |
| `--eco-amber-ink` | `#8A5A12` | Ámbar como texto/ícono en claro (eyebrows, íconos de pedidos) | 5,91 blanco · 4,93 crema |
| `--eco-cream` | `#EFEAE1` | Fondo de página del panel y bandas cálidas de la landing | — |
| `--eco-paper` | `#FFFFFF` | Superficies: paneles, tablas, header, hero | — |
| `--eco-sand` | `#F4F1EA` | Superficie 2: buscador, readonly, chips | — |
| `--eco-line` | `#E2DBCD` | Bordes de paneles y reglas (decorativos) | 1,38 (no lleva info) |
| `--eco-text-muted` | `#6B6860` | Texto secundario | 5,56 blanco · 4,64 crema |
| `--eco-sage` | `#8FA39A` | Texto secundario sobre ink | 6,03 sobre ink |
| `--eco-mist` | `#E8E6DF` | Texto sobre ink | 12,88 sobre ink |

**Semánticos** (sin cambios): danger `#B42318` (6,57 sobre blanco), warning `#9A5B00` (5,43), success `#2F6B3F` (6,37), info `#2B5A84` (7,25); badges de estado según DESIGN §7.7. **Tintas de sección** (terracota `#B8542A`, azul `#3D5A80`, gris `#6B6860`, más pino y ámbar) son señalética del panel: no salen del panel, nunca en landing ni piezas de marca.

### 5.2 Proporción

| % | Qué | Dónde |
| --- | --- | --- |
| 60 | Claros: paper + cream + sand | Fondos y superficies |
| 25 | Ink: texto, sidebar, footer, una banda oscura por página como máximo en la landing | Estructura |
| 10 | Pino | CTA primario, links, estados activos |
| ≤ 5 | Ámbar | Glifo, foco, progreso, badge de pedidos, un acento por vista |

### 5.3 Reglas

- **Pino = acción.** Botón primario, link, tab activa, selección. Si algo es pino, se puede tocar.
- **Ámbar = atención, escaso.** Glifo, anillo de foco, barra de progreso de navegación, badge de pedidos nuevos, barra de ítem activo del sidebar, "Guardar" en la SaveBar (sobre ink), CTA primario **sólo sobre fondo ink** (texto ink encima). Botón `accent` en claro: máximo uno por pantalla ("Empezá por acá").
- Ámbar nunca como texto o ícono chico sobre claro: usar `--eco-amber-ink`. Nunca como fondo de sección grande. Nunca ámbar y pino como dos CTAs del mismo grupo.
- Ink sobre ámbar o crema; blanco sobre pino. Nada de gris claro sobre crema.
- Sin gradientes, sin transparencias sobre foto, sin colores `tailwind-500`.
- Modo oscuro: la marca no tiene modo oscuro de página; las superficies oscuras son bandas de ink con los pares de la tabla.

### 5.4 Correcciones de contraste (cambios a aplicar)

| Token | Hoy | Propuesto | Por qué |
| --- | --- | --- | --- |
| `--adm-focus-ring` | `#B97A2E` | `#A8702A` | Sobre crema da 2,98:1 (< 3:1, WCAG 1.4.11/2.4.13). Nuevo: 4,19 blanco · 3,49 crema; sigue siendo ámbar. |
| `--adm-input-border` | `#D9D2C3` | `#968F80` | El borde es lo único que delimita el input: 1,5:1 no llega al 3:1 que pide DESIGN §8.3. Nuevo: 3,21 sobre blanco. Hover `#7A7465`. Los bordes de panel (`--adm-border`) siguen claros: son decorativos. |
| `--adm-fg` | `#1C1917` | `#1A2320` (`--eco-ink`) | Dos negros casi iguales; `#1C1917` es `stone-900` de Tailwind. Una sola tinta, con el verde de la marca (16,09 / 13,43). |

### 5.5 Tokens

Primitivos de marca `--eco-*` en `:root` (globals.css, capa de marca); los semánticos `--adm-*` de `admin.css` los referencian (`--adm-accent: var(--eco-pine)`, etc.). **La landing y el panel consumen `--adm-*`** (ya comparten `.admin-root`); `--eco-*` se usa directo sólo para momentos de marca (logo, bandas ink, placas, OG) y en `_brand/glyph.tsx` (las constantes `BRAND_*` deben coincidir). El storefront no usa ninguno de los dos.

```css
:root {
  --eco-ink:#1A2320; --eco-ink-2:#232E2A; --eco-pine:#2E4A3F; --eco-pine-dark:#243C33; --eco-pine-soft:#E6EFE9;
  --eco-amber:#E0A458; --eco-amber-dark:#D3954A; --eco-amber-soft:#F8ECD9; --eco-amber-ink:#8A5A12;
  --eco-cream:#EFEAE1; --eco-paper:#FFFFFF; --eco-sand:#F4F1EA; --eco-line:#E2DBCD;
  --eco-text-muted:#6B6860; --eco-sage:#8FA39A; --eco-mist:#E8E6DF;
  --eco-font-display: var(--font-archivo), ui-sans-serif, system-ui, sans-serif;
  --eco-font-text: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --eco-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --eco-radius-sm:4px; --eco-radius:6px; --eco-radius-lg:10px;
  --eco-ease-out: cubic-bezier(.2,0,0,1); --eco-ease-in: cubic-bezier(.4,0,1,1);
  --eco-dur-1:120ms; --eco-dur-2:200ms; --eco-dur-3:280ms;
}
```

---

## 6. Tipografía

### 6.1 Familias

| Uso | Familia | Por qué |
| --- | --- | --- |
| **Display de marca** (wordmark, h1/h2 de landing, números grandes de planes, placas) | **Archivo** (Omnibus-Type, Buenos Aires), variable `wght` 500–700 | Grotesca diseñada en Argentina para ser leída en pantalla: "argentina sin folklore". Cifras firmes, buen ancho. No está en la lista prohibida. |
| Texto de landing y todo el panel | Stack del sistema (`--eco-font-text` = `--font-admin`) | Nitidez nativa y cero carga. El panel es herramienta. |
| Código, SKU, cupones, tokens | `--eco-font-mono` | Distinguir lo que se copia. |

**Cambio respecto de hoy:** la landing usa sólo el stack del sistema, que en Android es Roboto (default prohibido por DESIGN §1) y no tiene firma propia. Archivo entra **sólo** en display, con `next/font/google` (autohospedada: no agrega ninguna hoja de Google Fonts al HTML, así que respeta DESIGN §8.19), `subsets: ["latin"]`, `display: "swap"`, `adjustFontFallback` para CLS ≈ 0, un único archivo variable (~35 KB), variable CSS `--font-archivo`. El panel no la carga (el wordmark del sidebar va como SVG, §4.1). Si el LCP mobile empeora > 100 ms, el h1 vuelve al sistema y Archivo queda para h2 y wordmark.

### 6.2 Escala

| Nivel | Landing | Panel |
| --- | --- | --- |
| Eyebrow | 12 / 500, mayúsculas, tracking 0,08 em, `--eco-amber-ink` | — |
| H1 | Archivo 40 → 52 → 60 px / 600, interlínea 1,02, tracking −0,035 em, máx. 12–14 ch | 20 / 600 (título de página) |
| H2 | Archivo 30 → 36 px / 600, interlínea 1,08, tracking −0,025 em | 16 / 600 (panel, dialog) |
| Lead | 19 → 21 px / 400, interlínea 1,3, máx. 34 ch | — |
| Cuerpo | 15–16 px / 400, interlínea 1,6, máx. 52–65 ch | 14 px / 400 |
| Meta | 13 px | 13 px (tablas), 12 px (ayuda, badges) |
| Número destacado | Archivo 28–40 px / 600 `tabular-nums` (precios de planes) | 28 / 600 `tabular-nums` (dashboard) |

Pesos: 400, 500, 600 (700 sólo Archivo display ≥ 40 px). Sin itálicas para énfasis: se usa 500. `tabular-nums` en todo precio, cantidad, fecha y columna numérica; números alineados a la derecha en tablas. Nunca mayúsculas sostenidas salvo eyebrows y grupos del sidebar (11 px).

---

## 7. Forma y espacio

| | Landing | Panel |
| --- | --- | --- |
| Base | 4 px | 4 px |
| Contenedor | `max-w-6xl` (1152 px), gutter 16 → 24 px | Fluido; formularios máx. 960 px |
| Grilla | 12 col; hero 1,1fr / 1fr; texto a la izquierda | Config 1/3 título + 2/3 campos; dashboard 8/4 |
| Ritmo vertical | Secciones 56–80 px, **asimétrico** (nunca 3 secciones seguidas con el mismo padding); título más cerca de su contenido | Gaps 8 / 12 / 16 px; panel 16 px (20 en formularios) |
| Densidad | Aireada: una idea por banda | Densa: filas 40 px, controles 32 (tablas) / 36 px (formularios) |
| Radios | 6 px botones, inputs, cards; 10 px marcos de capturas grandes; tile 18 % | 6 px todo; 4 px badges y miniaturas |
| Bordes | 1 px `--eco-line`; inputs `--adm-input-border` | Igual |
| Sombras | Ninguna en reposo; capturas con borde, no sombra | `--adm-shadow-surface` en superficies; `--adm-shadow` sólo en dialogs, menús y command palette |
| Targets táctiles | ≥ 44 px en mobile | ≥ 44 px en mobile (los 32 px de tabla son sólo desktop) |

Sin pills (salvo switches), sin `rounded-2xl`, sin glass, sin blobs.

---

## 8. Iconografía, imágenes y fotografía

- **Íconos:** `lucide-react`, trazo **1,5** (1,75 sólo dentro de botones de 14–16 px para igualar el peso del texto 500). Tamaños 16 px (panel, botones) y 20 px (landing, features). Color `currentColor`; ámbar sólo vía `--eco-amber-ink` o sobre ink. Nunca dentro de círculos de color ni como ilustración (> 24 px). `aria-hidden` si decoran.
- **Producto real, no ilustración.** La landing muestra el producto: mocks construidos con componentes reales (`LandingMocks.tsx`, `PresetSpecimens.tsx`) o capturas del panel y de `demo.ecommy.app`. Nada de celulares flotando, renders 3D, ilustraciones de personas con cajas ni stock de "equipo sonriente".
- Capturas: con borde 1 px y radio 10 px, datos verosímiles en rioplatense (productos y precios argentinos), nunca datos de clientes reales sin permiso escrito.
- **Fotografía** (si se usa, en redes o guías): manos y mostradores reales de comercios argentinos, luz natural, sin filtros ni saturación; nunca fotos de stock genéricas. Placas de redes: fondo ink con rectángulo crema para la captura (SOCIAL-KIT).
- Empty states: ícono lineal 20–24 px en `--adm-fg-subtle` como mucho; el contenido es el texto y la acción.

---

## 9. Movimiento

| Qué | Duración | Easing |
| --- | --- | --- |
| Hover y foco (color, fondo, borde) | 120 ms | `--eco-ease-out` |
| Popover, menú, tooltip, toast | 160–200 ms | entrada `ease-out`, salida `ease-in` |
| Drawer, dialog, panel lateral | 240–280 ms | `ease-out` |
| Barra de progreso de navegación | continua, ámbar 2 px | — |
| Skeleton `.sk` | shimmer 1,2 s | lineal |

Anima: respuesta a una acción (abrir, cerrar, guardar, agregar), cambios de estado, progreso. **No anima:** contenido al cargar o al scrollear (sin fade-up), logo, números que "cuentan", botones con `scale`, sombras que crecen. `prefers-reduced-motion: reduce` → transiciones de opacidad ≤ 120 ms, sin desplazamiento ni shimmer.

---

## 10. Componentes de marca

| Componente | Regla |
| --- | --- |
| **Botón primario** | Pino, texto blanco 500, 36 px (panel) / 44 px (landing y mobile), radio 6 px. **Uno por vista**. Verbo + objeto. Ícono de flecha opcional a la derecha sólo en landing. |
| Secundario | Blanco, borde `--adm-input-border`, texto ink. |
| Ghost / link | Sin fondo; hover `--eco-sand`. Los CTAs secundarios de la landing son link de texto, no un segundo botón igual. |
| Accent (ámbar) | Texto ink. Sobre ink: CTA principal de bandas oscuras y "Guardar" de la SaveBar. Sobre claro: máx. uno por pantalla. |
| Danger | `--adm-danger`, sólo en confirmaciones con verbo exacto. |
| Links | Pino; dentro de texto, **siempre subrayados** (pino vs. tinta no llega a 3:1, el color solo no alcanza). En navegación, sin subrayado y hover a ink. |
| Badges | DESIGN §7.7: 20 px, radio 4 px, punto + etiqueta; el estado nunca sólo por color. "Plan Pro": badge neutro con candado lineal. |
| Cards | Superficie blanca, borde 1 px, radio 6 px, sin sombra (panel: `shadow-surface`). Nada de grillas de cards con ícono en círculo. |
| Formularios | Label arriba 13/500, ayuda 12 px muted, error reemplaza la ayuda; `aria-invalid` + `aria-describedby`; `autocomplete`; defaults precargados. |
| Estados vacíos | A la izquierda: título 16 px + una línea útil + acción primaria (+ secundaria). Sin ilustraciones. |
| Toasts | `sonner` neutro: superficie, borde, texto ink; sólo el ícono 16 px lleva color semántico. Éxito con "Deshacer" cuando se pueda. Errores persistentes van inline, no en toast. |
| Banners de plan y límites | Fondo `--eco-amber-soft`, texto ink, ícono `--eco-amber-ink`, radio 6 px, dentro del contenido (no modal). Número concreto + consecuencia + "Ver planes". Aparece desde el 80 % del límite; al 100 % el botón de crear se deshabilita con la explicación al lado. Prueba Pro: días restantes y qué pasa al vencer. Nunca bloquea lo ya creado ni tapa la tarea. |
| SaveBar | Sticky abajo, fondo ink, "Cambios sin guardar · Descartar · Guardar" (ámbar). |

---

## 11. Principios de UX de Ecommy

Lo que mide la auditoría. Cada pantalla tiene que poder contestar "¿para qué estoy acá?" en una línea.

| Principio | Criterio verificable |
| --- | --- |
| **Un objetivo por pantalla** | El título + la descripción dicen la tarea; nada en la vista compite con ella. |
| **Una acción primaria** | Exactamente un botón pino (o ámbar sobre ink) por vista; el resto, secundarios o links. |
| **Mínimo de clics** | Desde el dashboard, ≤ 2 toques para: ver un pedido, cambiar su estado, editar precio o stock, compartir el link de la tienda. Crear producto ≤ 3. |
| **Divulgación progresiva** | Lo avanzado (SEO, CSS propio, redirecciones, roles) colapsado o en "Más opciones"; lo diario, arriba. |
| **Defaults inteligentes** | Nada vacío si se puede inferir: preset por rubro, moneda ARS, retiro en el local activado, textos legales con plantilla, SKU sugerido. |
| **Feedback inmediato** | Respuesta visual < 100 ms (estado del botón, velo con spinner); skeleton con la forma de la página; resultado con toast o cambio en la fila; acciones masivas con vista previa y Deshacer. |
| **Mobile-first para el comerciante** | Toda tarea diaria funciona a 360 px sin scroll horizontal; tablas se vuelven listas; acciones al alcance del pulgar; targets ≥ 44 px. |
| **Prevenir antes que avisar** | Confirmación sólo en lo destructivo o irreversible; lo demás, con Deshacer. Límites avisados antes de chocarlos. |
| **Lenguaje del comercio** | Términos del usuario ("pedido", "transferencia", "retiro"); jerga técnica sólo con explicación al lado. |
| **Accesibilidad AA** | Texto ≥ 4,5:1, UI ≥ 3:1, foco visible ámbar, orden de tab lógico, focus trap en dialogs, Esc y retorno de foco, `alt` real, estado no sólo por color. |

---

## 12. Ecommy y la marca del comerciante

| Superficie | Marca que manda | Ecommy aparece |
| --- | --- | --- |
| Storefront (`<tienda>.ecommy.app`, dominio propio) | La del comercio vía tema/preset (DESIGN §3–§4) | Sólo "Hecho con Ecommy" en el footer: texto 12 px `--fg-muted` del tema, sin logo ni color de Ecommy. Obligatorio en Free (con link a `ecommy.app`); desde Starter se apaga en Apariencia › Pie de página (`theme.footer.showCredit`). Pendiente: volver a exigirlo si la tienda baja a Free sin guardar Apariencia (ver `docs/ux-audit/presets-apariencia.md`). |
| Checkout, página de pedido, mensaje de WhatsApp, remito | Comercio | Nunca. El cliente final le compra al comercio. |
| Presets | Los pone el comercio (colores, fuentes, logo). Ningún preset usa pino + ámbar + crema como combinación de fábrica, para no parecer "la tienda de Ecommy". | Nunca. |
| Panel | Ecommy (shell, sidebar, tokens `--adm-*`) | Siempre; dentro de la vista previa, el tema de la tienda. |
| Alta de tienda y onboarding | Ecommy alrededor; la miniatura del preset muestra el nombre que escribe el dueño | Shell. |
| Landing, planes, ayuda, guías, OG, redes | Ecommy | Completo. Los muestrarios de presets (`PresetSpecimens`) muestran las marcas de ejemplo con su propia tipografía, no la de Ecommy. |

---

## 13. Checklist de cumplimiento de marca

Para cada interfaz auditada (landing, panel, alta, placas). Marcá cada ítem; si no se cumple, explicá por qué en el reporte.

1. [ ] El logo es `BrandGlyph`/`BrandTile` (SVG), versión correcta para el fondo, con resguardo del 25 % y ≥ tamaño mínimo; ninguna "e" de logo en texto vivo.
2. [ ] Sólo colores de §5 vía `--adm-*` / `--eco-*`; cero hex literales nuevos, cero clases de color de Tailwind, cero gradientes.
3. [ ] Proporción respetada: ámbar ≤ 5 % y nunca como texto en claro (se usa `--eco-amber-ink`); pino sólo en lo accionable.
4. [ ] Exactamente una acción primaria por vista; los CTAs secundarios son secundarios o links.
5. [ ] Contraste: texto ≥ 4,5:1, bordes de input / íconos / foco ≥ 3:1 (con las correcciones de §5.4 aplicadas).
6. [ ] Tipografía: Archivo sólo en display de marca; texto y panel en el stack del sistema; ninguna fuente prohibida (Inter, Poppins, Montserrat, Roboto como elección, Playfair); `tabular-nums` en todo número.
7. [ ] Radios 4 / 6 / 10 px; sombras sólo en capas superpuestas; sin pills, glass ni blobs.
8. [ ] Íconos lucide 16/20 px, trazo 1,5, sin círculos de color.
9. [ ] Imágenes = producto real o mock con componentes reales; ningún render, stock genérico ni ilustración decorativa.
10. [ ] Copy en voseo, verbo + objeto en botones, un dato concreto por frase, sin palabras prohibidas ni emojis ni exclamaciones en serie.
11. [ ] Cada afirmación de producto coincide con MARKETING §0; cero cifras, testimonios o logos inventados.
12. [ ] Estados cubiertos con el tono de §3.2: carga (skeleton), vacío con acción, error con salida, éxito con Deshacer cuando aplica, límite de plan con número.
13. [ ] Movimiento sólo como respuesta, ≤ 280 ms, nada al cargar ni al scrollear; `prefers-reduced-motion` respetado.
14. [ ] A 360 px: sin scroll horizontal, targets ≥ 44 px, tareas diarias completas desde el celular.
15. [ ] Storefront y presets: ningún rastro de Ecommy salvo el crédito de §12.
