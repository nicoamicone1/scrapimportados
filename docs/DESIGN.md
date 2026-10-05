# Ecommy — Dirección de diseño

> **Marca de la plataforma (logo, color, tipografía, voz):** [`BRAND.md`](BRAND.md). En marca manda ese documento; en storefront y presets, éste.
> **Rediseño 2026-10 (v0.9) en curso.** `BRAND.md` cambió (tinta noche + pomelo, burbuja, movimiento con curva) y el tema del storefront suma `theme.style` (`hero`, `titles`, `shape`, `card`, `motion`: §3.9). Donde este documento prohíbe pastillas, radios grandes, animación de entrada o composición centrada **como regla general**, ahora decide el estilo de cada preset: lo que sigue prohibido es que todos los presets se parezcan. Las secciones §1, §3–§6 (storefront) y §7 (panel) se actualizan con este rediseño.
> Documento OBLIGATORIO para todo agente que toque UI (storefront, bloques, admin).
> Complementa `docs/ECOMMY-SPEC.md` (§8 Tema, §9 Bloques). Si algo acá contradice la spec en datos o schema, manda la spec; en estética, manda este documento.
> Punto de partida: el storefront actual (`src/app/globals.css`, `src/components/*`) funciona pero es genérico: violeta + naranja fijos, `rounded-2xl` y `shadow-card` en todo, header con gradiente, barrita de color en cada título, chips pill por todos lados. **Nada de eso sobrevive** en el storefront temable.

Ecommy se vende a una casa de ropa de Palermo, a una santería de Once, a una ferretería de Morón y a un importador de auriculares. El diseño tiene que **desaparecer detrás de la marca del cliente**: el tema decide la personalidad, los componentes ponen el oficio (jerarquía, ritmo, legibilidad, precio claro).

---

## 1. Manifiesto anti-genérico

Un sitio "hecho con IA" se reconoce en dos segundos porque repite los mismos defaults. Los patrones de abajo están **PROHIBIDOS**. Si un agente cree que necesita uno, lo justifica en su reporte; si no, lo reemplaza.

### 1.1 Storefront

| Prohibido | Por qué | Reemplazo |
| --- | --- | --- |
| Gradientes violeta→rosa, violeta→azul, índigo→cian (fondos, headers, textos con `bg-clip-text`) | Es la firma visual del template SaaS 2023. Ninguna marca real de ropa ni ferretería se ve así. | Colores planos del tema. Si hace falta profundidad: foto, o `--secondary` como banda plana. |
| Glassmorphism (`backdrop-blur` + fondo translúcido + borde blanco) | Baja el contraste, cuesta performance en mobile y fecha el diseño. | Superficie opaca `--surface`. El header transparente sobre el hero NO se blurea: al scrollear pasa a sólido. |
| Blobs, orbes, círculos difuminados, "mesh gradients" de fondo | Relleno decorativo sin información. | `--bg` limpio y buena foto. |
| `rounded-2xl` / `rounded-3xl` en todo | Borra la personalidad del tema: todo parece un dashboard de Notion. | Radios del tema (`var(--radius-sm\|md\|lg)`) y, para lo que lleva forma, `var(--shape-radius)` / `var(--shape-radius-sm)` de `style.shape` (§3.9). Nunca un radio literal "porque sí": la curva la elige el preset. |
| Sombras grandes en todo (`shadow-lg/xl` en cards, secciones, inputs) | Todo "flota", nada tiene jerarquía. | `var(--shadow-*)` del tema; con `effects.shadows: 'none'` no hay ninguna. Sombras sólo en capas que de verdad están encima: drawer, popover, header sticky al scrollear. |
| Hero centrado con "Bienvenido a {tienda}" + subtítulo vago + dos botones iguales | Cero información: no dice qué vendés ni por qué comprarte. | Hero alineado a la izquierda, con una campaña concreta ("Temporada otoño. Camperas de gabardina desde $ 89.000") y **un** CTA fuerte; el segundo, si existe, es link de texto. |
| Tarjetas de "features" con ícono dentro de un círculo de color pastel | Patrón de landing SaaS. | Bloque `features` como fila de texto: ícono lucide 20px trazo 1.5 en `--fg`, a la izquierda del título, sin fondo. Máximo 4. Contenido operativo: "Envíos a todo el país", "Retirás en el local", "10 % off con transferencia". |
| Emojis y "✨", "🔥", "🚀" en UI o copy por defecto | Infantiliza y no escala a una marca seria. | Nada. La spec ya lo prohíbe (§1, Iconos). |
| Inter / Poppins / Montserrat / Roboto / Playfair como default | Son los defaults de todos los generadores. | Presets de §4 y lista curada de §5. Admin: stack del sistema. |
| Botones con gradiente, `hover:scale-105`, sombra de color | Movimiento que no comunica nada; el layout salta. | Hover = cambio de color/fondo en 120 ms. Nunca `scale` en botones. |
| Copy vacío: "Descubrí nuestra colección exclusiva", "Calidad y confianza", "Los mejores productos al mejor precio" | Es ruido; se lee como plantilla. | Copy con dato: qué, cuánto, cuándo, dónde. "Llegaron las mesas de lapacho. Hechas en Misiones, 8 modelos." |
| Lorem ipsum o "Título del producto" en defaults de bloques | Se publica por error. | Defaults con copy real de ejemplo en rioplatense, o placeholder visible sólo dentro del builder. |
| Testimonios inventados ("María G. — ★★★★★ ¡Excelente!") | Engaña al cliente final; riesgo legal. | El bloque `testimonials` nace **vacío**; el builder avisa "Usá sólo reseñas reales". Nunca estrellas generadas. |
| Badges "NUEVO" / "HOT" fluorescentes, rotados, con sombra | Gritan y compiten con la foto. | Badge de promo discreto (§6.1) con `badge_label` de la promoción. Sin badge "Nuevo" automático. |
| Todo centrado (títulos, textos, grillas) | Destruye el eje de lectura; todo pesa lo mismo. | Izquierda por defecto. Centrado sólo cuando el preset lo elige como voz (`style.titles: 'centered'`, header `logo-center`/`stacked`), el hero con `align:'center'`, la barra de anuncio y estados vacíos de una línea. |
| Íconos gigantes (48–96px) como ilustración | Rellenan sin comunicar. | Íconos 16–20px, funcionales. La ilustración es la foto del producto. |
| Todas las secciones con la misma altura y el mismo `py-16` | Ritmo monótono, "scroll infinito de cajas". | Ritmo asimétrico (§2.2): `style.paddingY` varía por bloque; bloques relacionados se pegan. |
| Footer de 4 columnas iguales con 5 links cada una | Genérico, casi siempre con links inventados. | 5 estilos (§6.7) con columnas de ancho desigual y sólo links que existen. |
| Colores "tailwind-500" sin ajustar (`blue-500`, `violet-600`, `emerald-500`) | Delatan el framework y rara vez pasan AA. | En storefront no se usa **ninguna** clase de color de la paleta de Tailwind: sólo `bg-bg`, `text-fg`, `bg-primary`, etc. |
| Animaciones de entrada que esconden contenido o se repiten en todo | Retrasan el contenido, marean. | `style.motion` decide (§3.9): `none` no mueve nada; `soft` y `lively` usan las utilidades `st-*` (CSS ligado al scroll dentro de `@supports`: sin soporte, el contenido está fijo y visible). Nunca una animación de la que dependa leer algo; `prefers-reduced-motion` siempre. |
| Barrita de color a la izquierda de cada título, chips pill de categoría y badge "En stock" en cada card (estado actual) | Ruido repetido 20 veces por pantalla. | Título con la voz de `style.titles` (solo, regla, centrado, índice o etiqueta). Pastillas de categoría sólo arriba del catálogo con `style.filters: 'bar'`, nunca dentro de la card. El stock se comunica sólo cuando falta. |
| **Diez presets con la misma disposición** (mismo header, misma card, misma grilla, mismo pie) | Es "el mismo sitio con otro skin": lo primero que nota un dueño que compara estilos. | Cada preset elige header, pie y `style.*` (§3.9, §4). `presets.test.ts` exige que dos presets difieran en ≥ 4 de 10 ejes de disposición. |

### 1.2 Admin

| Prohibido | Reemplazo |
| --- | --- |
| Dashboard con 4 stat cards de colores pastel, cada una con ícono en círculo | Franja única con números tipográficos grandes separados por reglas verticales (§7.8). |
| Gráficos de área con gradiente, donuts de 6 colores | Tablas y listas primero. Si hay gráfico: barras monocromas `--adm-fg` al 80 %, sin gradiente ni animación. |
| Sidebar oscura con logo brillante o gradiente | Sidebar plano `--adm-sidebar-bg` (verde-tinta), marca sin brillo, ítem activo `--adm-sidebar-active` + barra izquierda ámbar de 3px (§7.3). |
| Tablas con avatar circular de colores en cada fila | Texto. En productos, miniatura cuadrada 32px de la foto real; iniciales 20px grises sólo para usuarios del equipo. |
| Toasts con ícono gigante y fondo saturado | `sonner` neutro: superficie, borde, texto; sólo el ícono 16px lleva color semántico. |
| Badges de estado con 7 colores saturados | Paleta de estados de §7.7 (fondos lavados, texto oscuro, punto de 6px). |
| Empty states con ilustración de "persona con caja" | Texto claro + acción (§7.9). |

---

## 2. Principios de composición del storefront

### 2.1 Jerarquía tipográfica

- Tres niveles por pantalla: **display** (h1 de hero/página), **título de sección** (h2) y **cuerpo**. El resto se resuelve con peso y color, no con más tamaños.
- Escala derivada de `fonts.baseSize` (B):

| Token | Valor | Uso |
| --- | --- | --- |
| `--text-xs` | `B × 0.75` | legales, SKU, metadatos |
| `--text-sm` | `B × 0.875` | nombre en card, labels, ayuda |
| `--text-base` | `B` | cuerpo |
| `--text-lg` | `B × 1.125` | precio en card, lead |
| `--text-xl` | `B × 1.375` | h3, precio en ficha (mobile) |
| `--text-2xl` | `clamp(B×1.5, 2.2vw, B×2)` | h2 de sección |
| `--text-display` | `clamp(B×2.25, 5vw, B×4.5)` | h1 de hero y de página en desktop |

- Títulos: `--font-heading`, `--heading-weight`, `--heading-transform`, `--heading-tracking`, `line-height: 1.05` (display) / `1.15` (h2–h3). Cuerpo: `line-height: 1.55`, medida máxima **68ch**.
- Nombre de producto en card: fuente de **cuerpo**, `--text-sm`, peso `bodyWeight + 100`. Los nombres suelen ser largos y técnicos ("Taladro percutor 13 mm 750 W") y una serif de display no aguanta eso a 14px.
- Precios siempre en `--font-body` con `tabular-nums` (las serifs display dibujan mal los números).

### 2.2 Ritmo vertical asimétrico

- Nunca todos los bloques con el mismo padding. Defaults del builder: `hero: none`, `banner_grid: sm`, `product_slider`/`product_grid: md`, `rich_text`/`image_text: lg`, `heading: sm` (y se pega al bloque siguiente con `paddingY` del siguiente en `none` arriba).
- El título de sección está más cerca de su contenido (`0.75 × --gap-grid`) que de la sección anterior (`--space-section-*`). Proximidad = agrupación.
- Un bloque de campaña (hero, banner 1 col) seguido de un slider: sin espacio entre ellos o `sm`; entre dos sliders: `md` + regla si `dividers`.

### 2.3 Uso del blanco

- El espacio vacío es el lujo: en `atelier` y `editorial` el aire separa, no las cajas. En `nordico` y `mercado` las reglas finas ordenan sin engordar.
- No rellenar huecos con decoración. Si una grilla queda con 3 productos en 4 columnas, queda así.

### 2.4 Precio y oferta sin gritar

- El precio es texto `--fg`, peso semibold, `tabular-nums`. **No** se pinta de primario ni de naranja por defecto.
- Oferta = precio actual en `--accent` + precio anterior tachado en `--fg-muted` más chico, a la derecha. Nada de fondos amarillos ni "¡OFERTA!".
- Descuento por transferencia: línea secundaria "$ 33.048 con transferencia" en `--fg-muted`. Nunca como precio héroe: el precio de lista es el real y el descuento depende del método elegido.
- Formato siempre con `formatMoney` (spec §1): "$ 12.500", sin ",00".

### 2.5 Fotos como protagonistas

- La imagen ocupa el ancho completo de la card; la tipografía acompaña debajo.
- Todas las imágenes de una grilla con el **mismo** `aspect-ratio` (`cards.imageRatio`). `object-fit: cover` en `4:5` y `3:4`; `contain` con padding 6 % sobre `--surface` en `1:1` y `16:9` (producto recortado, típico de electro/ferretería).
- Mientras carga: bloque plano `--surface`. Sin skeleton con brillo animado.
- `effects.imageFilter` afecta sólo hero y banners; las fotos de producto van siempre a color (el cliente tiene que ver el color real).

### 2.6 Grillas con contraste 1+2

- Evitar filas de N elementos iguales una tras otra. Alternar una pieza grande con dos chicas: banner de 1 columna → banner de 2 → slider.
- `banner_grid` con 3 ítems y `ratio: 'auto'` se renderiza como 1 grande (2 filas) + 2 apilados (§6.6).
- Ficha de producto: galería 7/12 + buy box 5/12 (`thumbs`, `stack`), 8/4 (`grid`) o carrusel a todo el ancho con compra 5/12 + detalle 7/12 debajo (`carousel`). `image_text`: 7/12 + 5/12. Nunca 50/50 por defecto.

### 2.7 Alineación

- Texto a la izquierda por defecto: títulos de sección, hero, rich text, footer, estados vacíos largos.
- "Ver todo" en la misma línea base que el título de sección, a la derecha, como link de texto (subrayado al hover). La flecha "→" sólo en `editorial`. Con `titles: 'centered'` el título va centrado y el link debajo o a la derecha según el bloque.

### 2.8 Microcopy (voseo rioplatense)

Tono directo y amable, sin exclamaciones en serie. Botones en infinitivo; instrucciones en voseo.

| Contexto | Copy |
| --- | --- |
| Card / ficha | "Agregar al carrito" → "Agregado" (1.5 s) y se abre el drawer · con variantes: "Elegir opciones" |
| Variantes | "Elegí un talle" · "Elegí un color" (el botón muestra esto hasta que se elija) |
| Carrito | "Iniciar compra" · "Seguir comprando" · "Tu carrito está vacío" · "El envío se calcula en el checkout" |
| Entrega | "Te lo llevamos" · "Retirás en el local" · "Envío gratis desde $ 60.000" · "Llega en 24 a 48 hs" |
| Zona sin cobertura | "Todavía no llegamos a tu zona. Escribinos por WhatsApp y lo coordinamos." |
| Pago | "Transferencia bancaria · 10 % off" · "Acordás el pago con el vendedor por WhatsApp" |
| Stock | "Sin stock" · "Quedan 3" (sólo si stock ≤ umbral) · "Talle M sin stock" |
| Checkout | "Tus datos" → "Entrega" → "Pago" → "Revisá y confirmá" · CTA: "Confirmar pedido" |
| Pedido | "Recibimos tu pedido #1043" · "Enviá el comprobante por WhatsApp" · "Abrir WhatsApp" · "Guardá este link para ver cómo va tu pedido." |
| Errores | Qué pasó + cómo se arregla: "Revisá el teléfono: tiene que tener código de área." |

### 2.9 Estados vacíos con contenido útil

- Búsqueda sin resultados: "No encontramos «taladro inalámbrico». Probá con menos palabras o mirá estas categorías:" + 6 categorías + slider de destacados.
- Categoría vacía: "Estamos cargando productos en {categoría}." + slider "Lo más nuevo".
- Carrito vacío (drawer y página): texto + 4 destacados en mini grilla + "Ver todos los productos".
- Nunca un ícono gigante de carrito triste.

---

## 3. Sistema de tokens (theme → CSS)

`cssVars(theme)` (spec §8) emite variables en `:root`; Tailwind las mapea con `@theme inline` (`--color-bg: var(--bg)`, `--color-fg: var(--fg)`, `--radius-md: var(--radius-md)`, `--font-heading: var(--font-heading)`…). **Ningún componente del storefront usa valores literales** de color, radio, sombra ni fuente.

### 3.1 `colors`

Todos hex `#RRGGBB`. El editor de apariencia calcula contraste y muestra advertencia (no bloquea) si un requisito falla.

| Campo | Variable | Controla | Requisito |
| --- | --- | --- | --- |
| `background` | `--bg` | fondo de página | — |
| `surface` | `--surface` | panel de cards `bordered`/`elevated`, fondo de imágenes, inputs, drawer, dropdowns | puede ser igual a `--bg` |
| `text` | `--fg` | texto principal, precio | ≥ 7:1 recomendado, 4.5:1 mínimo sobre `--bg` |
| `textMuted` | `--fg-muted` | metadatos, tachado, ayuda | ≥ 4.5:1 sobre `--bg` y `--surface` |
| `primary` | `--primary` | CTA principal, link activo, foco, controles marcados | ≥ 3:1 sobre `--bg` |
| `primaryText` | `--primary-fg` | texto sobre `--primary` | ≥ 4.5:1 sobre `--primary` |
| `secondary` | `--secondary` | bandas planas (announcement, `style.background: 'surface'` alternativo), chip seleccionado | `--fg` ≥ 4.5:1 encima |
| `accent` | `--accent` | precio promocional, badge de promo | ≥ 4.5:1 sobre `--bg` y `--surface` (es texto) |
| `border` | `--border` | reglas, divisores, borde de cards | decorativo |
| `success` | `--success` | confirmaciones, "Pagado" en `/pedido` | ≥ 4.5:1 sobre `--bg` |
| `danger` | `--danger` | errores de formulario, "Sin stock" | ≥ 4.5:1 sobre `--bg` |

Derivados (calculados, no editables):

```css
--border-strong: color-mix(in oklab, var(--fg) 50%, var(--bg));   /* bordes de inputs, ≥ 3:1 (WCAG 1.4.11); al 38 % daba 2.5–2.9:1 */
--primary-hover: color-mix(in oklab, var(--primary) 86%, var(--fg));
--primary-soft:  color-mix(in oklab, var(--primary) 12%, var(--bg)); /* fondo de botón soft */
--is-dark: 0 | 1;  /* 1 si la luminancia relativa de --bg < 0.2: cambia sombras por bordes/glow (§3.8) */
```

### 3.2 `fonts`

| Campo | Valores | CSS |
| --- | --- | --- |
| `heading` / `body` | id de `src/lib/theme/fonts.ts` (§5) | `--font-heading: "Cormorant Garamond", <fallback de la categoría>` |
| `headingWeight` / `bodyWeight` | 100–900 en pasos de 100, **validado contra los pesos de esa fuente** (zod `superRefine`) | `--heading-weight`, `--body-weight` |
| `headingTransform` | `none` \| `uppercase` | `--heading-transform` |
| `headingTracking` | `tight` \| `normal` \| `wide` | `-0.02em` \| `0` \| `0.08em` (con `uppercase` + `tight` → `-0.01em`) |
| `baseSize` | `15` \| `16` \| `17` | `--text-base` en px; escala §2.1 |

- Fallbacks: serif → `ui-serif, Georgia, "Times New Roman", serif`; sans/display → `ui-sans-serif, system-ui, "Segoe UI", sans-serif`; mono → `ui-monospace, SFMono-Regular, Consolas, monospace`.
- `--font-mono` es siempre el stack mono del sistema (SKU, códigos de cupón). No es campo del tema.
- Carga: un `<link>` a `https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Jost:wght@400;600&display=swap` + `preconnect` a `https://fonts.gstatic.com` (crossorigin). Se piden sólo `headingWeight`, `bodyWeight` y `bodyWeight + 200` (acotado al máximo de la fuente). Si `heading === body`, una sola familia con los pesos unidos. Máximo 3 archivos.

### 3.3 `radius`

Uso: `--radius-sm` = chips, badges, miniaturas, selectores de variante · `--radius-md` = botones (`shape: 'radius'`), inputs, dropdowns · `--radius-lg` = cards, imágenes de card, banners, drawer.

| `radius` | `--radius-sm` | `--radius-md` | `--radius-lg` |
| --- | --- | --- | --- |
| `none` | 0 | 0 | 0 |
| `sm` | 2px | 4px | 6px |
| `md` | 4px | 8px | 10px |
| `lg` | 6px | 12px | 16px |
| `full` | 8px | 16px | 24px |

`--radius-pill: 9999px` existe siempre. Hero y banners con `container: 'full'` **nunca** llevan radio.

### 3.4 `buttons`

| Campo | Valor | CSS |
| --- | --- | --- |
| `style` | `solid` | `bg --primary`, `color --primary-fg`; hover `--primary-hover` |
| | `outline` | `border 1px solid --fg`, `color --fg`, fondo transparente; hover invierte (`bg --fg`, `color --bg`) |
| | `soft` | `bg --primary-soft`, `color --primary`; hover mezcla al 20 % |
| `shape` | `radius` / `square` / `pill` | `--btn-radius: var(--radius-md)` / `0` / `var(--radius-pill)` |
| `uppercase` | boolean | `text-transform: uppercase; letter-spacing: 0.1em; font-size: calc(var(--text-sm) * 0.93)` |

Reglas fijas:
- `style` define el botón **primario**. El secundario es siempre el siguiente más callado: `solid` → `outline`; `outline`/`soft` → link subrayado.
- El CTA de conversión final ("Iniciar compra", "Confirmar pedido", "Abrir WhatsApp") es **siempre `solid`**, diga lo que diga el tema.
- Alto `--control-h` (§3.7), padding horizontal `1.25em`, peso `min(bodyWeight + 200, 700)`. Íconos sólo funcionales (WhatsApp, carrito), 16px.
- Transición `background-color, color, border-color` 120 ms. Nunca `transform: scale` al hover (sí `scale(.92)` al apretar los botones redondos de ícono: stepper, flechas, "+" de la baldosa).

### 3.5 `cards`

| Campo | Valor | Efecto |
| --- | --- | --- |
| `style` | `flat` | sin panel: imagen (fondo `--surface`) + texto directo sobre `--bg`. Sin borde ni sombra. |
| | `bordered` | panel `--surface`, `border 1px --border`, radio `--radius-lg`. Sin sombra. |
| | `elevated` | panel `--surface` + `--shadow-sm`; en tema oscuro, `border 1px --border` en lugar de sombra. |
| `imageRatio` | `1:1` \| `4:5` \| `3:4` \| `16:9` | `aspect-ratio` de la imagen; fit según §2.5 |
| `hover` | `none` | sólo el nombre se subraya |
| | `zoom` | imagen `scale(1.03)` 400 ms ease-out con `overflow: hidden`; si el producto tiene 2.ª imagen, crossfade a ella en vez de zoom |
| | `lift` | panel `translateY(-2px)` + `--shadow-md` (o borde `--border-strong` si no hay sombras o el tema es oscuro) |
| `showSku` | boolean | SKU en `--font-mono`, `--text-xs`, `--fg-muted`, arriba del nombre |
| `showBrand` | boolean | marca en `--text-xs` uppercase tracking 0.06em, arriba del nombre |

### 3.6 `header`

| Campo | Efecto |
| --- | --- |
| `layout` | `logo-left` · `logo-center` · `minimal` · `stacked` · `pill` · `double` (§6.4) |
| `sticky` | `position: sticky; top: 0`. Al scrollear > 8px aparece `border-bottom 1px --border` (o `--shadow-sm` si `shadows: 'strong'`). |
| `transparentOnHome` | Sólo si la home empieza con un `hero` con imagen y el layout es de una fila (`logo-left`, `logo-center`, `minimal`): el header se superpone, texto blanco, fondo transparente; al scrollear pasa a `--bg` sólido. Sin blur. `stacked`, `pill` y `double` lo ignoran. |
| `showSearch` | `logo-left`: campo visible en desktop (máx. 420px). `logo-center`/`minimal`: ícono que abre un overlay de búsqueda de ancho completo. `false`: no hay búsqueda en el header (sigue existiendo `/productos?q=`). |

### 3.7 `layout`

**`density` → escala de spacing**

| Token | `compact` | `comfortable` | `airy` |
| --- | --- | --- | --- |
| `--space-section-sm` | 24px | 32px | 48px |
| `--space-section-md` | 40px | 56px | 80px |
| `--space-section-lg` | 56px | 80px | 120px |
| `--gap-grid` (mobile / desktop) | 8 / 12px | 12 / 20px | 16 / 32px |
| `--card-pad` | 8px | 12px | 16px |
| `--control-h` | 40px | 44px | 48px |
| `--header-h` (mobile / desktop) | 52 / 60px | 56 / 68px | 60 / 84px |

`style.paddingY` de los bloques: `none | sm | md | lg` → `0 | --space-section-sm | -md | -lg` (en mobile, 70 % de ese valor).

**`containerWidth` → px**: `narrow` 1080px · `normal` 1280px · `wide` 1520px (`--container`). Gutter: 16px (< 640px), 24px (≥ 640px), 40px (≥ 1024px). `style.container` del bloque: `full` = sin máximo ni gutter (sólo hero/banners/bandas), `normal` = `--container`, `narrow` = 760px.

**`gridColumns`**: `mobile: 1 | 2`, `desktop: 3 | 4 | 5`. Tablet (768–1023px) = `desktop − 1`, mínimo 2. `product_grid.columns` pisa `desktop` sólo en ese bloque.

### 3.8 `footer` y `effects`

- `footer.showCredit` (default `true`): "Hecho con Ecommy" en la banda legal, texto `--text-xs` `--fg-muted` del tema con link a la plataforma. Obligatorio en Free; desde Starter el dueño lo apaga en Apariencia › Pie de página (el server lo fuerza a `true` en Free). No es estilo: no pasa el tema a `custom` ni lo pisa un preset.
- `footer.style`: `simple` · `columns` · `minimal` · `statement` · `band` (§6.7). `showSocial`: links de `store_settings.social` como texto ("Instagram · TikTok") o íconos lucide 18px monocromos; nunca logos a color. `showPayments`: **texto**, no logos de tarjetas (no hay pasarela): "Transferencia bancaria (10 % off) · Acordás con el vendedor".
- `effects.shadows`:

| Valor | `--shadow-sm` | `--shadow-md` | `--shadow-lg` (drawer, popover) |
| --- | --- | --- | --- |
| `none` | `none` | `none` | `0 0 0 1px var(--border)` |
| `soft` | `0 1px 2px rgb(0 0 0 / .05)` | `0 6px 16px -8px rgb(0 0 0 / .14)` | `0 16px 40px -16px rgb(0 0 0 / .22)` |
| `strong` | `0 1px 3px rgb(0 0 0 / .10)` | `0 10px 24px -10px rgb(0 0 0 / .24)` | `0 24px 56px -20px rgb(0 0 0 / .35)` |

  Tema oscuro (`--is-dark: 1`): las sombras de cards se reemplazan por `0 0 0 1px var(--border)`. Si `shadows !== 'none'`, **sólo el botón primario** recibe glow: `0 0 0 1px color-mix(in oklab, var(--primary) 55%, transparent), 0 0 20px -6px color-mix(in oklab, var(--primary) 50%, transparent)`. Ningún otro elemento brilla.
- `effects.dividers`: `true` → reglas 1px `--border` entre bloques (ancho del container), bajo el header y entre celdas de las grillas de productos (look de catálogo). `false` → separación sólo por espacio.
- `effects.imageFilter`: `grain` → overlay SVG de ruido al 5 % sobre hero y banners; `mono` → `filter: grayscale(1) contrast(1.05)` sobre hero y banners. Nunca sobre fotos de producto.
- `custom_css`: se inyecta después de `cssVars`. Saneado: sin `@import`, sin `url(javascript:…)`, sin `expression(`.

### 3.9 `style`: la disposición (2026-10)

`theme.style` es lo que hace que dos presets no se parezcan aunque compartan colores. Se emite como `data-*` en `.store-root` (layout del storefront y `storeRootAttrs` de las vistas previas del panel) y el CSS (`store.css` para el chrome, `blocks.css` para los bloques) lo lee de ahí: los componentes no reciben props nuevas. Todos los campos tienen default; `parseTheme` completa un `style` faltante o parcial **con el del preset guardado** (no con el genérico), así un tema guardado antes de 2026-10 sigue siendo su preset.

| Campo | Valores | `data-*` | Qué cambia |
| --- | --- | --- | --- |
| `hero` | `cover` · `split` · `framed` · `poster` · `stack` | `data-hero` | Portada (bloque hero en `layout: "auto"`, de S2). |
| `titles` | `plain` · `rule` · `centered` · `index` · `tag` | `data-titles` | Voz de los títulos: bloques (`SectionTitle`) y chrome (`PageHead`: catálogo, carrito, checkout, relacionados). `index` vuela la cantidad ("Remeras ⁽¹²⁴⁾"); `tag` pone el eyebrow en una etiqueta. |
| `shape` | `rect` · `soft` · `arch` · `bubble` | `data-shape` | `--shape-radius` / `--shape-radius-sm`: portadas, banners, categorías, foto de las tarjetas, miniaturas del carrito, pastilla del header, hoja del pie. **Nunca** las fotos de la ficha. |
| `card` | `stack` · `overlay` · `boxed` · `row` · `tile` | `data-card` | Disposición de `ProductCard` (§6.1). |
| `motion` | `none` · `soft` · `lively` | `data-motion` | Utilidades `st-*` (abajo). `lively` suma marquesina en el anuncio y escalonados. |
| `grid` | `uniform` · `feature` · `list` | `data-grid` + `data-layout` en `.store-grid` | Grilla del catálogo: pareja, con un destacado a doble tamaño cada diez (izquierda y derecha alternados; sólo desde 1024px y con 3+ columnas, si no queda pareja), o lista de precios. |
| `filters` | `sidebar` · `bar` · `drawer` | `data-filters` | Filtros del catálogo: columna lateral sticky, pastillas de categoría arriba + panel, o sólo el panel. Sin columna, la grilla usa todas las columnas del tema. |
| `gallery` | `thumbs` · `grid` · `stack` · `carousel` | `data-gallery` | Ficha (§6.3). |

Además `data-header` (= `header.layout`) y `data-footer` (= `footer.style`).

**Utilidades compartidas** (`src/app/s/[store]/store.css`, comentario de cabecera; contrato S1 → S2):

| Utilidad | Qué hace | Con `none` | `soft` | `lively` |
| --- | --- | --- | --- | --- |
| `--st-ease`, `--st-ease-in-out`, `--st-ease-spring`, `--st-dur-1..3`, `--st-lift` | Curvas y duraciones | `ease`, 120–220 ms, lift 0 | curva larga, 160/280/520 ms, lift 3px | 640 ms en entradas, lift 5px |
| `.st-reveal`, `.st-reveal-scale` | Entrada al scrollear (`animation-timeline: view()` dentro de `@supports`) | nada | sí | sí |
| `.st-stagger` (+ `--i` en cada hijo) | Hijos que entran escalonados | nada | juntos | escalonados |
| `.st-hover-lift`, `.st-hover-zoom` + `.st-zoom` | Hover con curva | sin movimiento | sí | sí |
| `.st-pop` | Aparece al montar con rebote (badge, "Agregado", fila del carrito, número del stepper) | nada | sí | sí |
| `.st-marquee` > `.st-marquee-track` > `span` + `span[data-dup]` | Marquesina que se pausa con hover/foco | estática, centrada | estática | corre |
| `.st-link` | Subrayado que se dibuja | sí | sí | sí |
| `.st-shape`, `.st-shape-sm` | Aplican la forma y `overflow: hidden` | — | — | — |

Todo respeta `prefers-reduced-motion` (además de la regla global) y ninguna entrada esconde contenido sin soporte.

**Vista previa por preset (tienda demo).** `/s/demo?estilo=<preset>` (o `demo.<dominio>/?estilo=…`) muestra la demo con ese preset sin tocar la base: `src/proxy.ts` pasa `x-store-preview-style` al server y deja una cookie de sesión `ecommy_estilo`, así la navegación interna lo conserva; `?estilo=original` la borra. `getStoreDisplay` (`src/lib/store/display.ts`) pisa el tema completo con el del preset (salvo `footer.showCredit`) **sólo** si `x-store-slug` es `demo`. Un layout no recibe `searchParams` en Next 16: por eso se resuelve en el proxy y no en la página.

---

## 4. Presets

Cada preset define **todos** los campos. Elegirlo en el admin copia el objeto completo; cualquier edición posterior pasa `preset` a `"custom"`. Contrastes verificados (WCAG 2.1) y protegidos por `src/lib/theme/presets.test.ts`: `text`, `textMuted`, `accent`, `success` y `danger` ≥ 4.5:1 sobre `background` **y** sobre `surface`; `text` ≥ 7:1 sobre `background`; `primaryText` ≥ 4.5:1 sobre `primary` (7:1 cuando el primario lo permite; un mandarina o un rojo con texto blanco no llega); `primary` ≥ 3:1 sobre `background`, `surface` y `secondary` (es el relleno del botón en el hero sin foto y en el drawer); `text` y `textMuted` ≥ 4.5:1 sobre `secondary` (barra de anuncio, hero sin foto); `accent` y `danger` son el mismo color o están a ΔE_OKLab ≥ 0.08. Los mismos pares los muestra el editor de apariencia (`src/lib/theme/contrast.ts`), con un botón "Ajustar" que corrige el color que falla sin cambiarle el tono. `footer.showCredit` es `true` en todos: el crédito de la plataforma no es estilo, lo decide el dueño según su plan (BRAND.md §12) y aplicar un preset lo conserva. Default de una tienda nueva: `nordico` (el más neutro y el que mejor tolera catálogos importados con fotos heterogéneas).

`create_store()` guarda sólo `{ "preset": "…" }` y `parseTheme` completa con el preset: **cambiar un preset cambia todas las tiendas que nunca guardaron su apariencia**. Por eso se cura con razones concretas, no por gusto.

### Curado 2026-09-23

Auditoría de los 5 presets originales contra §1 y alta de 5 nuevos (§4.6–§4.10). Qué cambió y por qué:

| Preset | Cambio | Razón |
| --- | --- | --- |
| `atelier` | `dividers: true → false` | Las reglas entre celdas son el look de catálogo técnico y contradicen §2.3 ("en atelier el aire separa, no las cajas"). Colores y tipografía se quedan: Cormorant + Jost es el par Garamond/Futura de la moda clásica, no un default de generador (ese es Cormorant + Montserrat). |
| `mercado` | `radius lg → md`, botón `soft → solid` (sigue pill), `shadows soft → none`, `danger #A8321F → #8F2445` | Radio grande + sombra suave + pill tintado era exactamente el combo "todo parece Notion" de §1.1, y el CTA soft (verde al 12 % sobre crema) perdía contra la foto. Queda un solo gesto redondo: el botón pill sólido, como un sello. Sin sombras, el hover `lift` usa borde `--border-strong`. El `danger` estaba a ΔE 0.03 del terracota de promo: en el drawer, "−$ 4.500" y "Sin stock" se veían del mismo color. |
| `nordico` | `success #1F7A4D → #1A6E45`, `danger #9F1D1D → #B42318` (= `accent`) | `success` era el contraste más justo del set (4.87:1). Promo y error eran dos rojos a ΔE 0.05: parecían un error de copia. Un solo rojo, como en la vidriera de cualquier cadena de electro. |
| `editorial` | `accent` y `danger` `#D90B0B`/`#C20000` → `#CF0A0A` | Mismo problema de dos rojos casi iguales; en un sistema de tres tintas hay un solo rojo señal. De paso, el acento sobre `surface` sube de 4.68 a 5.06:1. Industrias: sale "Vinos" (ahora es `bodega`), entra "Skate". |
| `neon` | Rediseño: grafito neutro `#0D0D0C`, ámbar de fósforo `#FFB21E` (CTA + promo), Chivo Mono + Archivo, `radius md → sm`, `success`/`danger` propios | Era el preset más "hecho con IA": lima `#C6FF3D` sobre negro azulado (dashboard SaaS / gamer 2022), negros teñidos de violeta a lo Linear, Unbounded + Space Grotesk (el par cripto/web3), `#4ADE80` (literalmente emerald-400) y `#FF6B6B` (el coral de las librerías de UI). Se conserva la idea buena, un solo color vivo, con un ámbar de vúmetro y monitor CRT que ninguna tienda gamer local usa (casi todas van en rojo o RGB). Títulos mono en mayúsculas como ficha técnica. |

Resuelto en la misma pasada, fuera de §4: `libre-caslon-text` sólo existe en 400 y 700 en Google Fonts (500/600 hacen que css2 responda 400 y la familia no cargue; corregido en `fonts.ts` y en la tabla de §5); `fonts.ts` y §5 suman `atkinson-hyperlegible-next`, `archivo` y `chivo-mono`; y el derivado `--border-strong` pasó de `color-mix` al 38 % (2.45–2.92:1 en los diez presets) al 50 %, para cumplir el 3:1 que promete §3.1.

### Curado 2026-10-01

Auditoría completa en [`docs/ux-audit/presets-apariencia.md`](ux-audit/presets-apariencia.md). Cambios:

| Preset | Cambio | Razón |
| --- | --- | --- |
| `nordico` | `effects.dividers: true → false` | Con reglas entre celdas, las tarjetas `bordered` pierden el radio y quedan como celdas de tabla: en una categoría, `nordico` y `galpon` (también 5 columnas compactas, SKU, marca, azul + un rojo) se veían iguales. Ahora `nordico` son tarjetas blancas con borde fino sobre gris (vidriera de electro) y `galpon` conserva la grilla-tabla (lista de precios). Afecta a las tiendas que nunca guardaron su apariencia: el cambio es sólo de separación, no de color ni tipografía. |
| `atelier` | `secondary #E8E1D5 → #EBE4D8` | El texto secundario (4.45:1) y el tostado de promo (4.48:1) no llegaban a AA sobre la banda secundaria (barra de anuncio, hero sin foto). Con el lino un punto más claro: 4.58 y 4.60:1; la banda se sigue distinguiendo del fondo y de la superficie. |
| todos | `footer.showCredit: true` | Campo nuevo del schema (default `true`, sin migración: `theme` es jsonb). |

Fuera de §4, en la misma pasada: el precio de la card pasa a `--text-lg` como pide §6.1 (estaba en `--text-base`); dentro de una banda `background: 'primary'` el botón primario se invierte (antes tenía el mismo color que la banda) y las tarjetas con panel vuelven a los tokens del tema (antes: texto `--primary-fg` sobre `--surface`, blanco sobre blanco).

### Curado 2026-10: diez personalidades

Antes los diez presets cambiaban colores, fuentes, radios y densidad, pero la disposición era la misma. Desde 2026-10 cada uno elige además header, pie y `style` (§3.9). `create_store()` guarda sólo `{ preset }`: **las tiendas que nunca guardaron su apariencia cambian de disposición** con este curado (aceptado: es el rediseño). Las que guardaron su tema conservan colores, fuentes, header y pie guardados y toman el `style` de su preset.

| Preset | Header | Portada | Tarjeta | Catálogo (grilla · filtros) | Ficha | Títulos | Forma | Movimiento | Pie |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `atelier` | logo al centro, transparente | foto a sangre | apilada, texto centrado | destacados · panel | grilla de fotos (8/4) | centrados | recta | suave | simple |
| `mercado` | apilado (logo grande + toldo) | enmarcada | en caja, foto en arco, botón visible | pareja · pastillas | carrusel | solos | arco | suave | banda verde |
| `nordico` | una fila con buscador | mitad y mitad | en caja, botón visible | pareja · costado | miniaturas | con regla | suave | quieto | columnas |
| `editorial` | mínimo en texto | afiche | texto sobre la foto | destacados · panel | fotos apiladas | índice | recta | animado (marquesina) | nombre gigante |
| `neon` | doble barra, banda ámbar | mitad y mitad | baldosa con "+" | pareja · costado | miniaturas | etiqueta | suave | animado | columnas |
| `botica` | una fila con buscador | enmarcada | apilada, foto suave | pareja · pastillas | miniaturas | etiqueta | suave | suave | columnas |
| `recreo` | pastilla-burbuja flotante | apilada | baldosa con "+" | pareja · pastillas | carrusel | solos | burbuja | animado | banda mandarina |
| `lapacho` | una fila, transparente | foto a sangre | apilada 16:9 | destacados · pastillas | carrusel a todo el ancho | solos | recta | suave | mínimo |
| `galpon` | doble barra, banda azul | mitad y mitad | fila de lista de precios | lista · costado | miniaturas | con regla | recta | quieto | simple |
| `bodega` | apilado | foto a sangre | apilada, botella en arco | pareja · costado | grilla de fotos | centrados | arco | suave | nombre gigante |

Color y tipografía, en la misma pasada:

| Preset | Cambio | Razón |
| --- | --- | --- |
| `mercado` | Fondo `#F6F0E4 → #FBF4E6`, superficie blanca, banda secundaria mostaza `#F4CF6B`, `textMuted #5E4F3F`, Fraunces 600 → 700 | Atelier, mercado y lapacho eran tres "crema + serif" casi iguales. Mercado pasa a papel claro con mostaza de feria y una Fraunces más gorda. Contrastes en `presets.test.ts` (muted sobre mostaza 5,25:1). |
| `lapacho` | Fondo piedra `#EEECE7`, `textMuted #5C554F`, banda `#E0DBD2`; títulos Newsreader 400 → **Syne 600** | Fuera del grupo serif: Syne es la grotesca de galería de diseño, y el fondo gris piedra se separa del blanco roto de atelier. |
| `bodega` | `transparentOnHome: false` | El header apilado no se superpone a la portada. |

Fuente de verdad: `src/lib/theme/presets.ts` (cada preset lleva su dirección de arte en el comentario). Los JSON de abajo muestran colores y tipografía; `header`, `footer` y `style` de cada uno están en la tabla de arriba.

### 4.1 `atelier` — moda, joyería, marroquinería

Para marcas que venden con la foto: indumentaria de autor, joyería, cuero, lencería. Cormorant Garamond en títulos grandes sobre blanco roto, Jost (geométrica tipo Futura) para el resto, cero sombras, cero radios, botones rectos en mayúsculas espaciadas y fotos 4:5 grandes en 3 columnas. El tostado sólo aparece en promos; la banda secundaria (anuncio, hero sin foto) es un lino claro donde también se lee el texto secundario. Sin reglas entre celdas: el aire es el único separador. Se distingue por el silencio: mucho aire, poca UI.

```json
{
  "preset": "atelier",
  "colors": {
    "background": "#FAF8F4",
    "surface": "#F1EDE6",
    "text": "#1B1A18",
    "textMuted": "#6A655D",
    "primary": "#1B1A18",
    "primaryText": "#FAF8F4",
    "secondary": "#EBE4D8",
    "accent": "#8B5A34",
    "border": "#DDD6CA",
    "success": "#3F6B45",
    "danger": "#A3332B"
  },
  "fonts": {
    "heading": "cormorant-garamond",
    "body": "jost",
    "headingWeight": 500,
    "bodyWeight": 400,
    "headingTransform": "none",
    "headingTracking": "normal",
    "baseSize": 16
  },
  "radius": "none",
  "buttons": { "style": "solid", "shape": "square", "uppercase": true },
  "cards": { "style": "flat", "imageRatio": "4:5", "hover": "zoom", "showSku": false, "showBrand": false, "showTransferPrice": true, "showNetPrice": true },
  "header": { "layout": "logo-center", "sticky": true, "transparentOnHome": true, "showSearch": true },
  "layout": { "density": "airy", "containerWidth": "wide", "gridColumns": { "mobile": 2, "desktop": 3 } },
  "footer": { "style": "columns", "showSocial": true, "showPayments": false, "showCredit": true },
  "effects": { "shadows": "none", "dividers": false, "imageFilter": "none" }
}
```

### 4.2 `mercado` — artesanías, deco, dietética, feria

Para quien vende cerámica, mates, textiles, velas, productos naturales. Papel claro con una banda mostaza, Fraunces 700 (serif blanda y gorda) con Nunito Sans legible a 17px, verde bosque como CTA y terracota para promos; el error va en un carmín aparte para no confundirse con la promo. Logo grande arriba con el menú debajo como un toldo, tarjetas en caja con la foto en arco y el botón pill a la vista, categorías en pastillas, grano sutil en las fotos de campaña y un pie verde que entra con un arco. Se siente como un puesto cuidado, no como un marketplace.

```json
{
  "preset": "mercado",
  "colors": {
    "background": "#FBF4E6",
    "surface": "#FFFFFF",
    "text": "#2A1F14",
    "textMuted": "#5E4F3F",
    "primary": "#2F5D46",
    "primaryText": "#FFFBF3",
    "secondary": "#F4CF6B",
    "accent": "#A8431F",
    "border": "#E6D7BC",
    "success": "#3E6B2F",
    "danger": "#8F2445"
  },
  "fonts": {
    "heading": "fraunces",
    "body": "nunito-sans",
    "headingWeight": 700,
    "bodyWeight": 400,
    "headingTransform": "none",
    "headingTracking": "tight",
    "baseSize": 17
  },
  "radius": "md",
  "buttons": { "style": "solid", "shape": "pill", "uppercase": false },
  "cards": { "style": "bordered", "imageRatio": "1:1", "hover": "lift", "showSku": false, "showBrand": false, "showTransferPrice": true, "showNetPrice": true },
  "header": { "layout": "logo-left", "sticky": true, "transparentOnHome": false, "showSearch": true },
  "layout": { "density": "comfortable", "containerWidth": "normal", "gridColumns": { "mobile": 2, "desktop": 4 } },
  "footer": { "style": "columns", "showSocial": true, "showPayments": true, "showCredit": true },
  "effects": { "shadows": "none", "dividers": false, "imageFilter": "grain" }
}
```

Nota: `1:1` va con `contain` (§2.5). Si el dueño sube fotos ambientadas (cerámica sobre una mesa), le conviene `4:5`, que pasa a `cover`.

### 4.3 `nordico` — electro, hogar, ferretería, importadoras

Para catálogos grandes y técnicos: auriculares, herramientas, bazar, iluminación, repuestos. Gris muy claro, negro suave y azul profundo; Sora en títulos y Manrope (cifras tabulares nítidas) para todo lo demás. Densidad compacta, 5 columnas de tarjetas blancas con borde fino sobre el gris (cada foto de fábrica, con su fondo blanco o gris, queda contenida en su caja), SKU y marca visibles. Un solo rojo para precio promo y errores. El "flat con borde fino" del brief se implementa como `bordered` + `shadows: 'none'`, **sin** reglas entre celdas (desde 2026-10-01: la grilla-tabla con reglas es la firma de `galpon`). Se distingue por la precisión de vidriera de electro: ordenado y escaneable, sin parecer una lista de precios.

```json
{
  "preset": "nordico",
  "colors": {
    "background": "#F4F5F6",
    "surface": "#FFFFFF",
    "text": "#16181C",
    "textMuted": "#5B616B",
    "primary": "#1E3A5F",
    "primaryText": "#FFFFFF",
    "secondary": "#E6E9ED",
    "accent": "#B42318",
    "border": "#DADDE2",
    "success": "#1A6E45",
    "danger": "#B42318"
  },
  "fonts": {
    "heading": "sora",
    "body": "manrope",
    "headingWeight": 600,
    "bodyWeight": 400,
    "headingTransform": "none",
    "headingTracking": "tight",
    "baseSize": 15
  },
  "radius": "sm",
  "buttons": { "style": "solid", "shape": "radius", "uppercase": false },
  "cards": { "style": "bordered", "imageRatio": "1:1", "hover": "zoom", "showSku": true, "showBrand": true, "showTransferPrice": true, "showNetPrice": true },
  "header": { "layout": "logo-left", "sticky": true, "transparentOnHome": false, "showSearch": true },
  "layout": { "density": "compact", "containerWidth": "wide", "gridColumns": { "mobile": 2, "desktop": 5 } },
  "footer": { "style": "columns", "showSocial": true, "showPayments": true, "showCredit": true },
  "effects": { "shadows": "none", "dividers": false, "imageFilter": "none" }
}
```

### 4.4 `editorial` — marcas con actitud

Para marcas que comunican como una revista: streetwear local, editoriales independientes, bicicletas, skate. Blanco puro, negro, un único rojo señal (promo y error) y amarillo como banda de anuncio. Barlow Condensed 800 en mayúsculas para titulares enormes, Schibsted Grotesk (diseñada para un grupo de diarios) para el cuerpo, reglas negras de 1px que arman la grilla. Radio cero, header mínimo con texto en lugar de íconos. Se distingue por la tipografía: los títulos son la imagen.

```json
{
  "preset": "editorial",
  "colors": {
    "background": "#FFFFFF",
    "surface": "#F2F2F0",
    "text": "#0A0A0A",
    "textMuted": "#595959",
    "primary": "#0A0A0A",
    "primaryText": "#FFFFFF",
    "secondary": "#FFE14D",
    "accent": "#CF0A0A",
    "border": "#0A0A0A",
    "success": "#0B7A3B",
    "danger": "#CF0A0A"
  },
  "fonts": {
    "heading": "barlow-condensed",
    "body": "schibsted-grotesk",
    "headingWeight": 800,
    "bodyWeight": 400,
    "headingTransform": "uppercase",
    "headingTracking": "tight",
    "baseSize": 16
  },
  "radius": "none",
  "buttons": { "style": "solid", "shape": "square", "uppercase": true },
  "cards": { "style": "flat", "imageRatio": "3:4", "hover": "none", "showSku": false, "showBrand": false, "showTransferPrice": true, "showNetPrice": true },
  "header": { "layout": "minimal", "sticky": true, "transparentOnHome": true, "showSearch": true },
  "layout": { "density": "comfortable", "containerWidth": "wide", "gridColumns": { "mobile": 2, "desktop": 4 } },
  "footer": { "style": "simple", "showSocial": true, "showPayments": false, "showCredit": true },
  "effects": { "shadows": "none", "dividers": true, "imageFilter": "none" }
}
```

### 4.5 `neon` — gaming, periféricos, audio, vinilos

Para hardware gamer, periféricos, audio, sintetizadores y disquerías. Grafito neutro `#0D0D0C` (sin el tinte violeta de los dashboards), superficies `#171716` y un único ámbar de fósforo, el de los vúmetros y los monitores CRT, que es CTA y precio promo a la vez. Chivo Mono (Omnibus-Type, Buenos Aires) en mayúsculas para los títulos, como la ficha técnica de un equipo, y Archivo, de la misma fundidora, en el cuerpo. Radios chicos de panel de hardware; cards "elevated" que en oscuro se resuelven con borde; el glow existe sólo en el botón primario. Se distingue por la disciplina: un solo color vivo, nada más brilla.

```json
{
  "preset": "neon",
  "colors": {
    "background": "#0D0D0C",
    "surface": "#171716",
    "text": "#ECEAE4",
    "textMuted": "#A19D94",
    "primary": "#FFB21E",
    "primaryText": "#14110A",
    "secondary": "#24231F",
    "accent": "#FFB21E",
    "border": "#2E2D29",
    "success": "#8FCB7E",
    "danger": "#FF5147"
  },
  "fonts": {
    "heading": "chivo-mono",
    "body": "archivo",
    "headingWeight": 600,
    "bodyWeight": 400,
    "headingTransform": "uppercase",
    "headingTracking": "normal",
    "baseSize": 16
  },
  "radius": "sm",
  "buttons": { "style": "solid", "shape": "radius", "uppercase": false },
  "cards": { "style": "elevated", "imageRatio": "1:1", "hover": "lift", "showSku": false, "showBrand": true, "showTransferPrice": true, "showNetPrice": true },
  "header": { "layout": "logo-left", "sticky": true, "transparentOnHome": false, "showSearch": true },
  "layout": { "density": "comfortable", "containerWidth": "normal", "gridColumns": { "mobile": 2, "desktop": 4 } },
  "footer": { "style": "columns", "showSocial": true, "showPayments": true, "showCredit": true },
  "effects": { "shadows": "soft", "dividers": false, "imageFilter": "none" }
}
```

### 4.6 `botica` — farmacia, perfumería, dermocosmética

Para farmacias de barrio, perfumerías, dermocosmética y herboristerías, rubros con clientela que incluye gente mayor y productos que se eligen por marca y por dosis. Cuerpo en Atkinson Hyperlegible Next a 17px (diseñada para baja visión: distingue 1/l/I y 0/O, que importan en "10 ml" o "FPS 50") y títulos en IBM Plex Mono, como la etiqueta de un frasco (tono The Ordinary / Aesop, no góndola de cadena). Blanco verdoso, verde botica en el CTA, frambuesa para promos. Cards planas con el packshot sobre una baldosa verde agua (`surface`) y la marca visible arriba del nombre. Se distingue por la legibilidad: se lee sin anteojos.

```json
{
  "preset": "botica",
  "colors": {
    "background": "#F7F9F8",
    "surface": "#EAF1EE",
    "text": "#10201C",
    "textMuted": "#4B5C57",
    "primary": "#0D5C55",
    "primaryText": "#FFFFFF",
    "secondary": "#DCEBE5",
    "accent": "#A3195B",
    "border": "#D3DEDA",
    "success": "#2F6B1A",
    "danger": "#B02A1E"
  },
  "fonts": {
    "heading": "ibm-plex-mono",
    "body": "atkinson-hyperlegible-next",
    "headingWeight": 500,
    "bodyWeight": 400,
    "headingTransform": "none",
    "headingTracking": "normal",
    "baseSize": 17
  },
  "radius": "md",
  "buttons": { "style": "solid", "shape": "radius", "uppercase": false },
  "cards": { "style": "flat", "imageRatio": "1:1", "hover": "zoom", "showSku": false, "showBrand": true, "showTransferPrice": true, "showNetPrice": true },
  "header": { "layout": "logo-left", "sticky": true, "transparentOnHome": false, "showSearch": true },
  "layout": { "density": "comfortable", "containerWidth": "normal", "gridColumns": { "mobile": 2, "desktop": 4 } },
  "footer": { "style": "columns", "showSocial": true, "showPayments": true, "showCredit": true },
  "effects": { "shadows": "none", "dividers": false, "imageFilter": "none" }
}
```

### 4.7 `recreo` — librería, papelería, juguetería, infantil

Para librerías escolares, papelerías, jugueterías y ropa de chicos, que necesitan color sin caer en lo infantil (nada de fuentes redondeadas ni arcoíris). Página celeste guardapolvo, tarjetas blancas sin borde ni sombra (papel sobre la mesa), un único mandarina para CTA y promo y una banda durazno para anuncios ("Lista escolar 2027: armala y te la tenemos lista"). Bricolage Grotesque 700 da carácter a los títulos; Figtree, clara y amistosa, el resto. Marca visible (Faber-Castell, Rivadavia, Lego). Tono de referencia: Monoblock, no juguetería de shopping. Se distingue por el color ordenado: vivo pero serio.

```json
{
  "preset": "recreo",
  "colors": {
    "background": "#F1F6FB",
    "surface": "#FFFFFF",
    "text": "#14202E",
    "textMuted": "#4F5D6C",
    "primary": "#B03C0B",
    "primaryText": "#FFFFFF",
    "secondary": "#FFE3B8",
    "accent": "#B03C0B",
    "border": "#D3DEEA",
    "success": "#1D6B45",
    "danger": "#A61C44"
  },
  "fonts": {
    "heading": "bricolage-grotesque",
    "body": "figtree",
    "headingWeight": 700,
    "bodyWeight": 400,
    "headingTransform": "none",
    "headingTracking": "tight",
    "baseSize": 16
  },
  "radius": "md",
  "buttons": { "style": "solid", "shape": "radius", "uppercase": false },
  "cards": { "style": "elevated", "imageRatio": "1:1", "hover": "zoom", "showSku": false, "showBrand": true, "showTransferPrice": true, "showNetPrice": true },
  "header": { "layout": "logo-left", "sticky": true, "transparentOnHome": false, "showSearch": true },
  "layout": { "density": "comfortable", "containerWidth": "normal", "gridColumns": { "mobile": 2, "desktop": 4 } },
  "footer": { "style": "columns", "showSocial": true, "showPayments": true, "showCredit": true },
  "effects": { "shadows": "none", "dividers": false, "imageFilter": "none" }
}
```

### 4.8 `lapacho` — mueblería, iluminación, objetos de diseño

Para mueblerías de diseño, carpinterías a medida, iluminación y objetos. Es el único preset apaisado: fotos 16:9 (mesas, sillones y aparadores son horizontales) en `contain` sobre blanco, una por fila en el celular y tres en desktop, con densidad amplia de showroom. Syne 600 en títulos (grotesca de galería de diseño; hasta 2026-10 era Newsreader) y Karla en el cuerpo; fondo gris piedra, marrón madera de lapacho en foco y links, botón outline, y el rosa de la flor del lapacho sólo para promos. Footer mínimo. Se distingue por el formato: el producto se ve entero y a escala.

```json
{
  "preset": "lapacho",
  "colors": {
    "background": "#EEECE7",
    "surface": "#FFFFFF",
    "text": "#1F1A17",
    "textMuted": "#5C554F",
    "primary": "#4E3426",
    "primaryText": "#F7F3EE",
    "secondary": "#E0DBD2",
    "accent": "#B0306A",
    "border": "#D4CEC4",
    "success": "#3C6B3F",
    "danger": "#A8281E"
  },
  "fonts": {
    "heading": "syne",
    "body": "karla",
    "headingWeight": 600,
    "bodyWeight": 400,
    "headingTransform": "none",
    "headingTracking": "tight",
    "baseSize": 16
  },
  "radius": "sm",
  "buttons": { "style": "outline", "shape": "radius", "uppercase": false },
  "cards": { "style": "flat", "imageRatio": "16:9", "hover": "zoom", "showSku": false, "showBrand": false, "showTransferPrice": true, "showNetPrice": true },
  "header": { "layout": "logo-left", "sticky": true, "transparentOnHome": true, "showSearch": true },
  "layout": { "density": "airy", "containerWidth": "wide", "gridColumns": { "mobile": 1, "desktop": 3 } },
  "footer": { "style": "minimal", "showSocial": true, "showPayments": true, "showCredit": true },
  "effects": { "shadows": "none", "dividers": false, "imageFilter": "none" }
}
```

Nota: para lámparas de pie o sillas (verticales), `4:5` con `cover` funciona mejor; es el primer ajuste que conviene sugerirle al dueño.

### 4.9 `galpon` — mayoristas, distribuidoras, corralones

Para mayoristas de Once y Flores, distribuidoras de limpieza o bebidas, corralones y casas de repuestos: catálogos de miles de SKU que se compran por bulto. La referencia es la nota de pedido: birome azul para el CTA, birome roja para precio promo y errores, resaltador amarillo para las bandas ("Pedido mínimo $ 150.000 · Envíos a todo el país"). IBM Plex Sans a 15px con cifras tabulares, Archivo Narrow en mayúsculas para que entren rubros largos ("ARTÍCULOS DE LIMPIEZA INSTITUCIONAL"). Compacto, 5 columnas, SKU y marca, celdas planas separadas por reglas, cero radios, sin hover decorativo. Frente a `nordico` (vidriera de retail tech) es una lista de precios: más plana, más blanca, sin cards. Se distingue por la densidad sin adornos.

```json
{
  "preset": "galpon",
  "colors": {
    "background": "#FFFFFF",
    "surface": "#F3F3F0",
    "text": "#161616",
    "textMuted": "#565656",
    "primary": "#1F3FB0",
    "primaryText": "#FFFFFF",
    "secondary": "#FFF1A8",
    "accent": "#C0161C",
    "border": "#D9D9D4",
    "success": "#1E6B35",
    "danger": "#C0161C"
  },
  "fonts": {
    "heading": "archivo-narrow",
    "body": "ibm-plex-sans",
    "headingWeight": 600,
    "bodyWeight": 400,
    "headingTransform": "uppercase",
    "headingTracking": "normal",
    "baseSize": 15
  },
  "radius": "none",
  "buttons": { "style": "solid", "shape": "square", "uppercase": false },
  "cards": { "style": "flat", "imageRatio": "1:1", "hover": "none", "showSku": true, "showBrand": true, "showTransferPrice": true, "showNetPrice": true },
  "header": { "layout": "logo-left", "sticky": true, "transparentOnHome": false, "showSearch": true },
  "layout": { "density": "compact", "containerWidth": "wide", "gridColumns": { "mobile": 2, "desktop": 5 } },
  "footer": { "style": "columns", "showSocial": true, "showPayments": true, "showCredit": true },
  "effects": { "shadows": "none", "dividers": true, "imageFilter": "none" }
}
```

### 4.10 `bodega` — vinoteca, almacén gourmet, café de especialidad

Para vinotecas, almacenes gourmet, tostadores de café y destilados: productos que se venden con una historia larga (notas de cata, origen, maridaje). El oscuro de la cava, un vino casi negro con texto crema, distinto de `neon` en todo: cálido, serif y lento. Es el único preset con **serif en el cuerpo**: Literata a 17px, diseñada para leer en pantalla, con Libre Caslon (la de las etiquetas clásicas) en títulos. CTA color papel de etiqueta con texto oscuro, rosado para promos, fotos de botella 3:4 y la bodega o marca visible arriba del nombre. Header transparente sobre la foto de la cava. Se distingue por el ritmo: invita a leer antes de comprar.

```json
{
  "preset": "bodega",
  "colors": {
    "background": "#1A1214",
    "surface": "#241A1C",
    "text": "#EFE6DA",
    "textMuted": "#B3A597",
    "primary": "#E9DCC3",
    "primaryText": "#1A1214",
    "secondary": "#2E2224",
    "accent": "#F0A58F",
    "border": "#3A2C2E",
    "success": "#A9C98F",
    "danger": "#FF6B81"
  },
  "fonts": {
    "heading": "libre-caslon-text",
    "body": "literata",
    "headingWeight": 400,
    "bodyWeight": 400,
    "headingTransform": "none",
    "headingTracking": "normal",
    "baseSize": 17
  },
  "radius": "sm",
  "buttons": { "style": "solid", "shape": "radius", "uppercase": false },
  "cards": { "style": "flat", "imageRatio": "3:4", "hover": "zoom", "showSku": false, "showBrand": true, "showTransferPrice": true, "showNetPrice": true },
  "header": { "layout": "logo-left", "sticky": true, "transparentOnHome": true, "showSearch": true },
  "layout": { "density": "comfortable", "containerWidth": "normal", "gridColumns": { "mobile": 2, "desktop": 4 } },
  "footer": { "style": "columns", "showSocial": true, "showPayments": true, "showCredit": true },
  "effects": { "shadows": "none", "dividers": false, "imageFilter": "none" }
}
```

Nota: las fotos de botella sobre fondo blanco quedan como recortes claros sobre el oscuro; conviene fotografiar sobre fondo oscuro o usar fotos ambientadas.

---

## 5. Fuentes curadas (`src/lib/theme/fonts.ts`)

Todas de Google Fonts. `id` kebab = valor en el tema; `family` = nombre exacto para la URL (espacios → `+`). Pesos: rango si es variable, lista si es estática. Excluidas a propósito: Inter, Roboto, Poppins, Montserrat, Playfair Display, Open Sans, Lato.

| id | family | cat. | pesos | Usala para |
| --- | --- | --- | --- | --- |
| `cormorant-garamond` | Cormorant Garamond | serif | 300–700 (+ itálicas) | títulos grandes de moda y joyería; nunca debajo de 20px |
| `instrument-serif` | Instrument Serif | serif | 400 (+ itálica) | display editorial fino y condensado; sólo títulos |
| `fraunces` | Fraunces | serif | 100–900 (ejes opsz, SOFT) | títulos cálidos: artesanal, gastronomía, dietética |
| `libre-caslon-text` | Libre Caslon Text | serif | 400, 700 (estática, + itálica) | librerías, vinos, marcas clásicas; aguanta cuerpo |
| `newsreader` | Newsreader | serif | 200–800 (opsz) | textos largos y títulos de tono periodístico |
| `lora` | Lora | serif | 400–700 (+ itálicas) | cuerpo serif amable: regalería, papelería |
| `literata` | Literata | serif | 200–900 (opsz) | cuerpo serif muy legible en pantalla; fichas con mucha descripción |
| `jost` | Jost | sans | 100–900 | geométrica tipo Futura; moda, perfumería, cuerpo neutro |
| `dm-sans` | DM Sans | sans | 100–1000 (opsz) | cuerpo neutro y compacto para cualquier rubro |
| `manrope` | Manrope | sans | 200–800 | tecnología y electro; cifras tabulares nítidas |
| `figtree` | Figtree | sans | 300–900 | sans amistosa y clara: juguetería, mascotas, bazar |
| `nunito-sans` | Nunito Sans | sans | 200–1000 (opsz) | cuerpo humanista suave: artesanías, bienestar |
| `karla` | Karla | sans | 200–800 (+ itálicas) | grotesca con carácter: marcas indie, cafeterías |
| `work-sans` | Work Sans | sans | 100–900 | cuerpo robusto: ferreterías, corralones, industria |
| `atkinson-hyperlegible-next` | Atkinson Hyperlegible Next | sans | 200–800 | máxima legibilidad (1/l, 0/O): farmacia, salud, público mayor |
| `archivo` | Archivo | sans | 100–900 (wdth) | grotesca de Omnibus-Type (Buenos Aires): técnica, audio, gaming |
| `plus-jakarta-sans` | Plus Jakarta Sans | sans | 200–800 | cosmética, estética, servicios; moderna sin ser fría |
| `schibsted-grotesk` | Schibsted Grotesk | sans | 400–900 | cuerpo editorial; marcas con opinión |
| `ibm-plex-sans` | IBM Plex Sans | sans | 100–700 | catálogos técnicos, repuestos, instrumental |
| `sora` | Sora | sans | 100–800 | títulos geométricos de electro y hogar |
| `space-grotesk` | Space Grotesk | sans | 300–700 | cuerpo técnico con rasgos propios: gaming, audio |
| `bricolage-grotesque` | Bricolage Grotesque | sans | 200–800 (opsz, wdth) | títulos expresivos: marcas jóvenes, delis, eventos |
| `barlow-condensed` | Barlow Condensed | display | 100–900 (+ itálicas) | titulares condensados en mayúsculas: deporte, streetwear |
| `archivo-narrow` | Archivo Narrow | display | 400–700 (+ itálicas) | titulares angostos sobrios: outdoor, industria, herramientas |
| `syne` | Syne | display | 400–800 | títulos de arte, diseño, galerías; sólo tamaños grandes |
| `unbounded` | Unbounded | display | 200–900 | títulos anchos y técnicos: gaming, música, eventos |
| `jetbrains-mono` | JetBrains Mono | mono | 100–800 (+ itálicas) | títulos técnicos, specs; nunca cuerpo largo |
| `chivo-mono` | Chivo Mono | mono | 100–900 (+ itálicas) | mono gráfica: fichas técnicas, hardware, audio |
| `ibm-plex-mono` | IBM Plex Mono | mono | 100–700 (+ itálicas) | marcas "de laboratorio": café de especialidad, cosmética técnica |

Reglas del selector:
- Categorías `display` y `mono`, más `instrument-serif`, `cormorant-garamond` y `syne`, se ofrecen **sólo para `heading`**.
- Cada opción se muestra renderizada con una frase real ("Camperas de gabardina — $ 89.000"), no con "The quick brown fox".
- Al cambiar de fuente, si el peso elegido no existe, se ajusta al más cercano disponible y se avisa.

---

## 6. Componentes del storefront

Viven en `src/components/store/*` y `src/components/blocks/*`. Consumen tokens; cero colores, radios o sombras literales.

### 6.1 ProductCard

Orden: imagen → [marca] → [SKU] → nombre (máx. 2 líneas, alto reservado) → PriceTag → [línea de transferencia] → [compra rápida]. **Sin** chips de categoría, sin badge "En stock".

El markup es uno solo; la disposición la pone el CSS según `.store-root[data-card]` (`style.card`), ubicando las piezas en una grilla interna de tres áreas (`media`, `body`, `cta`). Así los bloques y la vista previa del panel la heredan sin props nuevas.

| `style.card` | Disposición | Compra rápida | Hover |
| --- | --- | --- | --- |
| `stack` | Foto + texto debajo; centrado si `titles: 'centered'`. Respeta `cards.style` (plana, con borde, con sombra). | Sube con rebote sobre el borde inferior de la foto, sólo desktop con hover. | Zoom o segunda foto (`cards.hover`). |
| `overlay` | Nombre (en la fuente de títulos) y precio sobre la foto, con un velo que sube desde abajo; los tokens de texto se re-derivan a blanco. En mobile se ocultan las líneas secundarias del precio. | Arriba de la foto, sólo desktop. | Zoom lento. |
| `boxed` | Caja `--surface` con borde, foto inset con `--shape-radius-sm`. | Botón siempre visible (también en mobile), con "+" que gira. | Borde fuerte + zoom. |
| `tile` | Baldosa sin borde (con borde en temas oscuros), radio de la forma. | "+" redondo de 44px sobre la foto, siempre visible; la etiqueta queda para lectores de pantalla. | La baldosa sube; el "+" gira con rebote. |
| `row` | Dentro de `.store-grid`: fila de lista de precios (foto 64–72px, SKU, nombre, precio a la derecha, botón). Dos columnas desde 1280px. Fuera de una grilla (sliders), se ve como `boxed`. | Botón compacto siempre visible. | Fondo apenas tintado. |

- **Compra rápida** (`QuickAdd`): "Agregar al carrito" → "Agregado" con check que aparece con rebote; con variantes, "Elegir opciones" (abre la ficha); agotado con WhatsApp, "Consultar por WhatsApp". Ícono y etiqueta van por separado para que cada disposición elija.
- **Por `cards.style`**: `flat` → texto con `padding-top: --card-pad`, sin padding lateral; `bordered`/`elevated` → texto con `padding: --card-pad`, la imagen toca los bordes del panel (radio sólo arriba).
- **Por `imageRatio`**: `4:5`/`3:4` cover a sangre; `1:1`/`16:9` contain con padding 6 % sobre `--surface`.
- **Precio**: "$ 45.900" en `--fg`, `--text-lg`, `tabular-nums`. Variantes con distinto precio: "Desde $ 45.900" ("Desde" en `--fg-muted`, peso normal).
- **Promo**: actual en `--accent` + anterior tachado `--fg-muted --text-sm` en la misma línea: `$ 36.720  $ 45.900`. Si no entra, el tachado baja de línea.
- **Transferencia**: si el método `transfer` tiene descuento > 0, línea `--text-xs --fg-muted`: "$ 33.048 con transferencia". Una sola vez por card.
- **Badge de promo**: `badge_label` de la promoción ganadora ("-20 %", "Ciber Lunes"). Esquina superior izquierda de la imagen a 8px (con `shape: 'arch'`, abajo: arriba no hay esquina), `--text-xs`, peso 600, `bg --bg`, `color --accent`, `padding 2px 6px`, radio `--radius-sm`. Sin sombra, sin rotación; uppercase sólo si `buttons.uppercase`. Máximo **un** badge por card.
- **Sin stock**: imagen al 55 % de opacidad; precio en `--fg-muted` y debajo "Sin stock" `--text-xs`. El botón de hover dice "Consultar por WhatsApp" si el método whatsapp está activo; si no, no hay botón. Van al final de los listados salvo orden explícito.
- **Stock bajo**: "Quedan 3" sólo en la ficha, no en la card.

### 6.2 PriceTag

Un solo componente para card, ficha, carrito y checkout. Props: `price`, `compareAt?`, `transferPercent?`, `from?`, `size: 'sm' | 'md' | 'lg'`.

- `lg` (ficha): precio `--text-xl` mobile / `--text-2xl` desktop en `--font-body`. Debajo: "Pagando con transferencia **$ 41.310** (10 % off)" + link "Ver medios de pago" que abre un popover con los métodos activos.
- Accesibilidad: `<span class="sr-only">Precio anterior:</span>` antes del tachado y `Precio actual:` antes del vigente.
- Cuotas ("6 cuotas sin interés de $ X") sólo si la tienda cobra con Mercado Pago y declaró las cuotas sin interés que ofrece (docs/PAYMENTS.md §6). Nunca cuotas con interés ni "hasta 12 cuotas" genérico en la card.

### 6.3 Ficha de producto

Cuatro disposiciones según `style.gallery` (el buy box es el mismo en las cuatro):

| `gallery` | Desktop | Columnas |
| --- | --- | --- |
| `thumbs` | Miniaturas verticales + principal con zoom (lo que sigue). | 7/12 + 5/12, las dos sticky. |
| `grid` | Todas las fotos en dos columnas, sin clics; la de la variante elegida pasa primera. | 8/12 + 4/12, buy box sticky. |
| `stack` | Fotos a ancho completo, una debajo de otra. | 7/12 + 5/12, buy box sticky. |
| `carousel` | Carrusel a sangre con alto fijo, la siguiente foto asomando, flechas y contador en una pastilla. | Galería 12/12; debajo compra 5/12 (sticky) + detalle 7/12. |

Con una sola foto, `grid` y `stack` se ven como `thumbs`. Las fotos de la ficha nunca llevan la forma del preset. El título usa la voz del preset (`index`: más grande y apretado; `tag`: `--text-2xl`).

`thumbs` en detalle — desktop: galería 7/12 (miniaturas verticales a la izquierda, principal con `imageRatio` del tema) + buy box 5/12, las dos columnas sticky (`top: calc(var(--header-sticky-h) + 24px)`: el alto que de verdad queda pegado arriba según el header): la más corta acompaña a la otra. La principal **entra completa en el viewport**: alto máximo `clamp(400px, 100svh − --header-h − 128px, 680px)` (128px = announcement bar + padding de sección + breadcrumb de la primera pantalla + aire inferior; cubre también el `top` del sticky); el ancho sale de ese alto × ratio y el conjunto miniaturas + principal se centra en su columna (4:5 → 544px de ancho, 3:4 → 510px; 1:1 y 16:9 suelen quedar limitadas por la columna). Las miniaturas miden lo mismo que la principal, con scroll interno. El zoom trabaja sobre la caja de la imagen; `sizes` refleja el tope (≤ 680px, nunca `vw` de la columna en pantallas anchas). El buy box no lleva tope propio: 5/12 de `wide` ≈ 68ch y el texto corrido ya tiene su medida. Mobile: galería con scroll-snap horizontal y contador "2/5" en `--text-xs`, sin dots.

Buy box: marca/SKU → h1 (heading) → PriceTag `lg` → variantes (botones rectangulares `--radius-sm`; agotados tachados y `disabled`; colores como texto + muestra de 16px) → cantidad + "Agregar al carrito" → entrega ("Te lo llevamos · desde $ 4.500" / "Retirás en el local · gratis") → descripción (RichText).

### 6.4 Header — 6 layouts

Base: fondo `--bg`, texto `--fg`, borde inferior `--border` si `dividers` o al scrollear. Announcement bar opcional encima: `announcement.bg/fg` o `--secondary`/`--fg`, 32px, `--text-xs`, centrada y estática; con `style.motion: 'lively'` corre como marquesina (`.st-marquee`, se pausa con hover/foco, quieta con movimiento reducido). Sin botón de cerrar.

| `layout` | Desktop | Mobile | Para |
| --- | --- | --- | --- |
| `logo-left` | logo · nav · buscador (máx. 420px) · carrito, en `--header-h`. | menú · logo · buscar + carrito | catálogos, salud, objetos |
| `logo-center` | nav · logo al centro · buscar + carrito. Nav en versalitas si `buttons.uppercase`. | ídem | moda |
| `minimal` | logo + **texto**: "Menú", "Buscar", "Carrito (2)". "Menú" abre un panel con links grandes en `--font-heading`. | ídem | marcas editoriales |
| `stacked` | Logo grande (30–52px) centrado entre "Buscar" y "Carrito (2)", y la nav centrada en una segunda fila entre reglas. Al scrollear sube la primera fila (`transform`, sin cambiar el layout) y queda sólo la nav. | ídem | feria, vinoteca |
| `pill` | Pastilla flotante despegada de los bordes, `--surface` con borde; el header no tiene fondo. Radio según la forma: pastilla, 16px (`soft`) o burbuja. Al scrollear, sombra (o anillo en oscuro). | La pastilla se mantiene. | infantil, gaming |
| `double` | Logo · buscador protagonista (46px, borde `--fg` de 1,5px) · "Carrito"; debajo, la nav en una banda `--primary` / `--primary-fg`. | Suma el buscador visible en una segunda fila. | mayoristas, gaming, catálogos grandes |

- Transparente sobre la portada sólo en los tres de una fila (§3.6).
- `--header-sticky-h` (definida en `.store-root[data-header]`) es el alto que queda pegado arriba; lo usan ficha, carrito, checkout y la columna de filtros.
- Contador del carrito: "(2)" en texto o círculo 18px `bg --primary`/`--primary-fg` que aparece con rebote al cambiar. Nunca un color fijo.
- Links de la nav con subrayado que se dibuja (`.st-link`). Megamenú sólo si un ítem tiene > 6 hijos: columnas de texto, sin imágenes promocionales.

### 6.5 Hero

Componente: `src/components/blocks/Hero.tsx` (+ `src/lib/blocks/hero.ts`). Cinco disposiciones, elegidas con `settings.layout`: `auto` (default: la de `theme.style.hero`) o una fija. Todas funcionan **con y sin foto** (sin foto nunca queda una caja vacía), se recomponen con container queries (tienda y vista previa del panel) y entran con `.blk-in` (sube y aparece, escalonado con `--i`; la foto se "asienta" con `.blk-in-media`). Con `motion: 'none'`, `prefers-reduced-motion` o dentro de la vista previa del panel no se anima nada.

| Disposición | Con foto | Sin foto | Mobile (390) | Preset de fábrica |
| --- | --- | --- | --- | --- |
| `cover` | A sangre, texto abajo a la izquierda (o centrado) sobre el overlay | Se arma como `poster` | Igual, foto `imageUrlMobile` si existe | atelier, lapacho, bodega |
| `split` | Mitad texto sobre `--primary` (`.blk-bg-primary`) · mitad foto con la forma del tema | Collage escalonado de 2–4 productos (foto + nombre + precio); con `card: 'row'` (galpon) **lista de precios** de hasta 6 filas con SKU y tachado; sin productos, monograma (inicial de la tienda) | Texto arriba, foto o 2 productos debajo | nordico, neon, galpon |
| `framed` | Foto enmarcada en el contenedor (forma del tema) + tarjeta `--bg` que la pisa abajo a la izquierda (`align: 'center'` = a la derecha) | Marco `--secondary` con 3 productos en fila; sin productos, monograma gigante | Foto 4:5 y la tarjeta sube 72px sobre ella | mercado, botica |
| `poster` | Titular gigante a lo ancho sobre `--secondary` (tamaño por largo del título: ≤14 letras 15,5cqi, ≤30 10cqi, más 7cqi), regla, bajada + CTAs en una fila; la foto va como franja 21:8 debajo | Tira de 4 productos debajo (o nada) | El titular baja a 2,4–3,4 × base | editorial |
| `stack` | Título centrado y la foto como franja | Título centrado + tira de 4 `ProductCard` escalonada sobre media banda `--secondary` | 2 cards por fila | recreo |

- **Productos de la portada** (`settings.products`, `ProductSource | null`): default (incluye portadas guardadas antes de 2026-10) = los 4 más nuevos; `null` = sin productos. Portada: hasta 6 (`blockProductSource`).
- **Alturas** (`settings.height`): en `cover` `sm` 40vh/320 · `md` 60vh/440 · `lg` 80vh/540 · `screen`; en `split` 400/480/72vh/100svh; en `framed` cambia la proporción del marco; en `poster` el aire.
- **Overlay** (sólo `cover`): gradiente orientado al texto (`to top right`) o plano si está centrado. El panel lo muestra sólo cuando la portada efectiva es `cover` y advierte por debajo de 25 %.
- Contenido: eyebrow → título (`h1` si es el primer bloque) → bajada `--text-lg` (máx. 52ch) → CTA primario + `cta2` como link. Un solo CTA fuerte.
- **Header transparente**: sólo sobre `cover` con foto (`heroIsFullBleed(block, theme.style.hero)`); en las demás el header va sólido.
- Si es el primer bloque: foto con `fetchpriority="high"`.

### 6.6 BannerGrid

- **1 columna = banner de campaña**: `ratio` default `21:9` desktop / `4:5` mobile (`imageUrlMobile`), `container` `full` o `normal`, texto sobre imagen con overlay como el hero, título `--text-2xl` a `--text-display`. Un solo CTA, botón.
- **2 columnas**: `4:5` o `1:1`; texto abajo a la izquierda sobre la imagen, título `--text-xl`, CTA como link subrayado.
- **3–4 columnas = tiles**: `1:1` o `4:5`, texto **debajo** de la imagen (no encima): título `--text-base` semibold + subtítulo `--fg-muted`. Son accesos a categorías o colecciones; la pieza entera es link.
- **`ratio: 'auto'` con 3 ítems** (desktop): grilla asimétrica 2fr/1fr; el primero ocupa 2 filas, los otros dos apilados.
- **Forma**: cada marco usa `.blk-shape` (`--shape-radius` del estilo; con `rect`, `--radius-lg` del tema). Sin forma con `gap: 'none'` o `container: 'full'`.
- **Sin foto**: el marco es un plano tipográfico que rota `--secondary` → `--primary` (con los tokens de texto re-derivados) → `--surface` con borde, con el número del banner ("01") arriba y el título en `--font-heading` grande. Nunca una caja gris vacía.
- **Movimiento**: entran escalonados (`.st-stagger`); al hover la foto se acerca (`.st-hover-zoom` + `.st-zoom`).
- `gap`: `none` 0 · `sm` 8px · `md` `--gap-grid`.
- Mobile: 1 col → full; 2 col → 2 col; 3 col → scroll horizontal con snap (tiles de 72vw); 4 col → 2×2.

### 6.7 Footer — 5 estilos

Fondo `--bg` con regla superior `--border` (no bloque negro por defecto), salvo `band`. Texto `--text-sm`; links `--fg-muted` → `--fg` al hover. Rótulos de grupo en `.ftr-label` (versalitas 12px).

- **`simple`**: fila 1 = nombre de la tienda en `--font-heading` grande + links del menú `footer` en línea a la derecha. Fila 2 = contacto · redes · pagos · envíos.
- **`columns`**: grilla de 12 con anchos desiguales: marca + tagline + contacto (5) · grupos del menú `footer` (2 grupos × 2) · "Medios de pago" y "Envíos" en texto (3). Sólo grupos con links reales; con un solo grupo se degrada a `simple`.
- **`minimal`**: una línea: "{tienda} · Términos · Privacidad · Instagram · WhatsApp".
- **`statement`**: tagline + contacto · links + pagos + envíos · redes, y debajo **el nombre de la tienda a todo el ancho** (`.ftr-giant`) como cierre: el cuerpo sale de la cantidad de letras y del ancho de la familia (angostas ×2,15, mono ×1,25), con tope de 24vw / 380px; entra con `.st-reveal`. Es decorativo (`aria-hidden`): el nombre ya está en la banda legal.
- **`band`**: una hoja `--primary` con texto `--primary-fg` (los tokens de texto se re-derivan adentro, `--fg-muted` al 88 %) cuyas esquinas de arriba siguen la forma: rectas, 24–40px (`soft`), arco elíptico (`arch`) o 32–56px (`bubble`). Marca + redes (5) · contacto (3) · links + pagos + envíos (4).
- Siempre: datos de contacto reales, banda legal con "Botón de arrepentimiento" (obligatorio en Argentina para venta online), Defensa del Consumidor, CUIT y "Hecho con Ecommy" según `footer.showCredit`.

### 6.8 ProductSlider (y ProductGrid)

- Track `overflow-x: auto`, `scroll-snap-type: x mandatory`, ítems `scroll-snap-align: start`, scrollbar oculta, `scroll-padding-inline` = gutter. El último ítem visible asoma un 30 % para sugerir scroll.
- Ancho de ítem: `(100% − gaps) / cardsPerView` en desktop; en mobile, 2.3 visibles (1.3 si `gridColumns.mobile: 1`).
- **Flechas discretas**: sólo ≥ 1024px, en la línea del título a la derecha junto a "Ver todo": dos botones 32px, `border 1px --border`, radio `--radius-sm`, opacidad 35 % y `disabled` en los extremos. **No** flotan sobre las cards. **Sin dots, sin autoplay.**
- Encabezado: `SectionTitle` (ver §6.12, títulos de sección). "Ver todo" con subrayado que se dibuja (`.st-link`).
- **Protagonista** (`highlight: 'first'`, slider y grilla): en el carrusel el primer producto mide el doble de ancho y el **mismo alto** (su foto toma el ratio del tema ×2 vía `--card-ratio`); en la grilla ocupa 2 × 2 en desktop y todo el ancho en mobile, y la grilla se recorta para cerrar la última fila. La tarjeta es la de S1 (`ProductCard`, `theme.style.card`), sin cambios.
- Entrada: `.st-stagger` (los hijos toman `--i` por `nth-child`, ciclo de 6).

### 6.9 RichText (prose)

Clase propia `.prose-store` (no el plugin typography por defecto):
- `h2`/`h3`: `--font-heading` con peso, transform y tracking del tema; `margin: 1.6em 0 .5em`.
- `p`, `li`: `--font-body`, `--text-base`, `line-height: 1.6`; medida 68ch (`maxWidth: 'narrow'` = 60ch).
- Links: `color --fg`, `text-decoration-thickness: 1px; text-underline-offset: 3px`; hover `--primary`.
- `blockquote`: borde izquierdo 2px `--fg`, `--text-lg`, itálica del heading si la fuente la tiene.
- Listas con viñeta "–" en `--fg-muted`. Tablas (fichas técnicas): reglas horizontales `--border`, sin zebra, números a la derecha con `tabular-nums`.
- Imágenes al ancho de la columna, radio `--radius-lg`; `figcaption` `--text-xs --fg-muted`.
- La portada de fábrica ya no usa un `rich_text` para "Cómo comprar": usa una `faq` titulada "Cómo comprar" (su título es el ancla `#como-comprar` del menú de fábrica). El texto enriquecido queda para políticas y páginas largas.

### 6.10 Carrito y Checkout

- **Drawer**: 420px desktop / 100 % mobile, desde la derecha, `bg --bg`, `--shadow-lg`; entra con `--st-ease` en `--st-dur-3` y, si la forma no es recta, con el borde interior redondeado (20px). Filas: miniatura 64px (con la forma chica del preset) · nombre + variante · stepper 32px · precio; cada fila aparece con `.st-pop`. Pie sticky: barra de envío gratis, subtotal, "El envío se calcula en el checkout", "Iniciar compra" (solid, ancho completo), "Ver carrito" / "Seguir comprando" (links).
- **Micro-interacciones**: el número del stepper rebota al cambiar y los botones se achican al apretar (`scale(.88)`); la barra de envío gratis crece con `transform: scaleX` (no `width`) y, al llegar, se pinta `--success` con un check que aparece con rebote; el contador del header rebota al sumar.
- **Página del carrito y resumen del checkout**: panel `.cart-summary` (`--surface`, borde, `--panel-radius`: radio del tema, ≥ 16px con forma, burbuja con `bubble`), sticky bajo `--header-sticky-h`. Títulos con `PageHead` (eyebrow = nombre de la tienda) en la voz del preset. Vacío: titular en `--font-heading` + una línea + "Ver todos los productos" + destacados en grilla.
- **Checkout**: **una columna** de formulario (máx. 560px) + resumen a la derecha en desktop (380px, `position: sticky; top: calc(var(--header-h) + 24px)`). En mobile, el resumen es un acordeón arriba: "Ver resumen · $ 128.400".
- **Pasos verticales** numerados: "1. Tus datos", "2. Entrega", "3. Pago", "4. Revisá y confirmá". El número va en una ficha de 28px (circular, o cuadrada si la forma es recta): activa en `--fg` sólida, completa con un check `--success` que aparece con rebote, futura con borde. Activo expandido (el contenido entra con un `st-rise` corto); completos colapsados en una línea + "Editar"; futuros en `--fg-muted`. Sin stepper horizontal de círculos.
- **Entrega**: dos radios grandes (tarjetas `bordered` de una línea): "Te lo llevamos — {zona}, llega en {eta} · $ 4.500" / "Retirás en el local — {dirección} · Gratis". Zona sin cobertura: mensaje inline con link a WhatsApp, no un modal.
- **Pago**: radios con el descuento alineado a la derecha ("Transferencia bancaria   −10 %"). El total del resumen se actualiza al instante.
- **Inputs**: label arriba (`--text-sm`, peso 500), alto `--control-h`, borde `--border-strong`, radio `--radius-md`, foco `outline: 2px solid var(--primary); outline-offset: 2px`. Error debajo en `--danger` `--text-sm`. `autocomplete` correcto (`name`, `email`, `tel`, `street-address`, `postal-code`).
- **CTA final**: "Confirmar pedido" (solid, ancho completo) y debajo, `--text-xs`: "En el próximo paso te mostramos cómo pagar."

### 6.11 Página de pedido (`/pedido/[token]`)

- Encabezado: un círculo con check en `--success` que se dibuja una vez (SVG, `stroke-dashoffset`, quieto con movimiento reducido o `motion: 'none'`) + "Recibimos tu pedido #1043" (heading) + fecha + estado como texto con punto de color, no badge chillón. Centrado si `titles: 'centered'`. Las cajas de pago y detalle son `.order-panel` (mismo panel que el resumen del carrito).
- **La acción va primero**, antes del resumen. Transferencia → caja `bordered` con filas Banco / Titular / CBU / Alias / CUIT / Monto a transferir, cada una con "Copiar" (feedback "Copiado"); debajo "Enviar comprobante por WhatsApp" (solid). WhatsApp → botón grande "Abrir WhatsApp" + "Si no se abrió solo, tocá el botón."
- Después: timeline vertical de eventos visibles (fecha `--text-xs --fg-muted` + mensaje), ítems, totales y entrega.
- Pie: "Guardá este link para ver cómo va tu pedido." + "Copiar link".

### 6.12 Resto de bloques (§9 de la spec)

**Títulos de sección** (`SectionTitle`, `heading` nivel 2, `faq`, `countdown`: clase `.blk-sectitle`) según `theme.style.titles`:
`plain` solo · `rule` regla de 2px `--fg` arriba (diario) · `centered` centrado entre dos filetes, "Ver todo" debajo · `index` número de sección `01`, `02`… arriba con una regla corta (revista; el render calcula el número porque `container-type` aísla los contadores CSS: `sectionIndexes()` → `--sec`) · `tag` el título como etiqueta `--primary` (en `bubble`, con la esquina baja izquierda recta).

**Forma** (`theme.style.shape`, utilidades de S1 en `store.css`): `.blk-shape` para imágenes de campaña (hero, banners, tiles de categoría, imagen y texto, colección), `.blk-shape-sm` para miniaturas, `.blk-card-shape` para tarjetas con texto (el arco se insinúa con 40px arriba, nunca corta el texto). Con `rect` se respeta el radio del tema.

- `heading`: eyebrow + título; el h2 toma la forma de `titles`. Entra con `.st-reveal`.
- `image_text`: `layout: 'split'` (imagen 7/12 con la forma del estilo + texto 5/12, o invertido; en `arch` la foto pasa a 4:5) o `'overlap'` (foto 8/12 y una tarjeta `--bg` que la pisa desde el otro lado; sin foto, la tarjeta queda sobre un plano `--secondary`). Eyebrow opcional.
- `category_list` (`style`): `cards` = tiles con forma (4:5 en `arch`); sin foto, plano de color rotado con el nombre en `--font-heading` · `chips` = pastillas con la cantidad, se rellenan de `--fg` al hover · `circles` = foto 96–120px en círculo (burbuja en `bubble`, ventana en `arch`), sin foto la inicial; al hover sube y gira 3° con rebote · `list` = **índice tipográfico**: número, nombre en `--font-heading` a 4,6cqi, cantidad y flecha, con reglas; al hover el nombre se corre 10px, toma `--accent` y asoma la foto de la categoría girada (sólo ≥ 768px).
- `features` (`layout`): `row` (fila de texto, ícono 20px sin fondo) · `cards` (tarjetas `--surface` con número "01" y título en `--font-heading`; sin círculos pastel) · `strip` (tira compacta con separadores verticales, 2×2 en mobile; ideal debajo de la portada). Máx. 4.
- `faq` (`layout`): `list` (título arriba) · `split` (título a la izquierda, fijo al scrollear, y preguntas a la derecha). `<details>` nativo con reglas y un "+" que gira a "−". El título es ancla.
- `countdown` (`layout`): `inline` · `banner` (números gigantes a todo el ancho entre dos reglas; queda bien con fondo primario). Al vencer muestra `expiredText` o se oculta.
- `testimonials` (`layout`): `cards` (tarjetas con forma chica) · `quote` (la primera reseña gigante en `--font-heading` con la comilla en `--accent`; el resto debajo). **Nace vacío** y nunca va en las portadas de fábrica.
- **`marquee`** (nuevo): tira de frases (máx. 12 × 120) que corre a la izquierda; `size: 'sm'` (tira de datos 48px) o `'lg'` (titular gigante en `--font-heading`); `speed`; link opcional. Separador: un punto con la forma del estilo (rombo en `rect`, burbuja, arco). Se mueve con `motion: soft` (×1,5 más lenta) y `lively`; se pausa con hover, foco o su botón (WCAG 2.2.2); con `motion: 'none'` o movimiento reducido queda quieta y centrada (en `lg`, sólo la primera frase). Sin regla divisoria (es una banda).
- **`lookbook`** — Colección destacada (nuevo): una foto grande 7/12 con forma + texto y 2–4 `ProductCard` en 2 columnas (5/12), `imagePosition` izquierda/derecha. Sin foto, el lado grande es un plano `--secondary` con el título gigante (es el h2: no se repite). Sin foto ni productos, no se muestra.
- `video`: sin autoplay con sonido. `divider`: regla `--border` o espacio.

**Portadas de fábrica** (`src/lib/blocks/starters.ts`, `defaultHomeFor(preset, opts)`): una composición por preset, con copy verdadero para cualquier tienda nueva (nombre, % real por transferencia, WhatsApp si lo tiene; sin plazos, años ni reseñas). Los bloques sin datos no se muestran, así que la portada se completa sola a medida que se carga el catálogo.

| Preset | Composición |
| --- | --- |
| atelier | cover lg silencioso → colección destacada (foto a la derecha) → categorías en tarjetas → grilla 3 col. con descuento → tira de beneficios → Cómo comprar |
| mercado | framed (arco) con collage → beneficios en tarjetas → categorías en arco → grilla con protagonista → Cómo comprar dividida sobre `--surface` |
| nordico | split bajo con collage → beneficios en fila sobre `--surface` → rubros en pastillas → carrusel de 5 → grilla 5 col. con descuento → Cómo comprar |
| editorial | poster con el nombre gigante → marquesina `lg` sobre `--primary` → grilla con protagonista e índice 01/02 → secciones en lista → carrusel → Cómo comprar dividida |
| neon | split ámbar con collage → marquesina sobre `--primary` → carrusel con protagonista → pastillas → grilla → tira de beneficios → Cómo comprar |
| botica | framed con la tarjeta a la derecha → categorías como etiquetas → grilla → beneficios en tarjetas → Cómo comprar dividida |
| recreo | stack con 4 cards escalonadas → categorías en burbujas → marquesina lenta → carrusel con protagonista → beneficios en tarjetas → Cómo comprar |
| lapacho | cover a pantalla completa → colección destacada (foto a la izquierda) → categorías en tarjetas 3 col. → grilla → Cómo comprar dividida |
| galpon | split compacto con **lista de precios** (ofertas, SKU, tachado) → beneficios en fila → rubros en lista → grilla densa 5 × 4 → Cómo comprar |
| bodega | cover centrado lg → colección (2 botellas) → la carta en lista sobre `--surface` → carrusel → Cómo comprar dividida |

Se usan en: la home de una tienda nueva (`starterHomeBlocks`, después de `create_store`), "Empezar desde una plantilla" del constructor (fija la disposición de la portada de esa plantilla) y la vista previa `?estilo=<preset>` de la tienda demo (`previewHomeBlocks`, sólo lectura; reusa la foto guardada sólo en los presets `cover`).

---

## 7. Admin

Herramienta de trabajo con sello propio: densa y rápida, pero reconocible en cualquier captura como Ecommy (BRAND §5–§10). **No** hereda el tema de la tienda (salvo dentro del preview). Tokens fijos bajo `.admin-root` en `src/app/admin/admin.css`, mapeados a Tailwind en `globals.css` (`bg-adm-*`, `text-adm-*`, `rounded-adm|adm-lg`, `shadow-adm-card`, `ease-eco-out|spring`). Kit en `src/components/ui` (nombres y props estables: lo usan todas las pantallas).

### 7.1 Paleta fija (v0.9, identidad 2026-10)

Base fría (niebla + blanco), **tinta** para la estructura y la acción, **azul** para interactuar y seleccionar, **pomelo** sólo como marca y llamada. Los `--adm-*` referencian los primitivos `--eco-*` (BRAND §5.1).

| Token | Valor | Uso |
| --- | --- | --- |
| `--adm-bg` | niebla `#F4F5F9` | La hoja (fondo del contenido) |
| `--adm-surface` / `-2` | `#FFFFFF` / `#EEF0F6` | Paneles, tablas, dialogs / buscador, readonly, chips, fila activa de menús |
| `--adm-border` | `#DFE2EC` | Bordes decorativos de paneles y reglas (1,38:1: no delimita controles) |
| `--adm-input-border` | `#7E86A0` | Borde de inputs (3,62:1); en botones secundarios al 45 % (el texto identifica el botón) |
| `--adm-fg` / `-muted` | tinta `#10162F` / `#5B627A` | Texto (17,8:1) / secundario (6,05:1) |
| `--adm-accent` | tinta | **Botón primario**, tab activa, contador activo, avatar |
| `--adm-accent-soft` | `#E8ECFF` | Selección lavada (chips, filas, drop targets) |
| `--adm-link` / `-hover` | azul `#2F4BFF` / `#2238D9` | Links (subrayados dentro de texto), foco, selección; nunca decorativo |
| `--adm-select` / `-soft` | azul / azul-soft | Checkbox, radio, switch encendido, fila seleccionada |
| `--adm-accent-2` (+`-soft`, `-ink`, `-fg`) | pomelo `#FF5A3C` | Marca: ícono del ítem activo, badge de pedidos nuevos, barra de progreso, "Guardar" de la SaveBar, banners de plan. Texto encima siempre tinta. Nunca foco ni borde de input |
| `--adm-danger` (+`-soft`, `-on-dark`) | carmín `#C01A3F` | Destructivo y errores (no se confunde con el pomelo) |
| `--adm-success` / `-warning` / `-info` (+`-on-dark`) | `#1B7A4B` / `#9A5B00` / azul-dark | Deltas; íconos de toasts (variante clara sobre tinta) |
| `--adm-sidebar-*` | tinta / ink-2 / ink-3, texto `#E9ECF8`, muted `#9AA3C7` | Sidebar, tapa mobile, barra inferior, SaveBar, toasts |
| `--adm-badge-*` | ver §7.7 | Estados |
| `--adm-sheet-radius` | 28 px | Esquina de la hoja |

**Tinta por sección** (`NavGroup.section` en `nav.ts`): ventas pomelo, catálogo azul, marketing magenta `#C2257A`, tienda petróleo `#0F7C80`, sistema gris azulado. Ya no hay franja en el topbar: la sección se marca con el **punto de color del rótulo** sobre el título (§7.4).

Foco: anillo doble azul (`--adm-focus`); en inputs, borde azul + halo azul 22 %; sobre tinta (`.adm-dark`), anillo azul claro `#8FA0FF`. Sombras teñidas de tinta: `--adm-shadow-surface` casi imperceptible (botones, buscador), `--adm-shadow` en capas (dialogs, menús, palette, toasts). **Paneles: borde o sombra, no las dos**: `Card`, `Table` y `StatStrip` llevan sólo borde.

### 7.2 Tipografía, forma y densidad

- Texto en el stack del sistema (nitidez nativa). **Títulos de página y números de métrica en Archivo expandida y pesada** (`.eco-display` 22 → 26 px vía `PAGE_TITLE`; `.eco-num` 24 → 30 px en `Stat`). Mono para SKU, cupones, slugs.
- Tamaños: 13 px tablas y metadatos · 14 px cuerpo, inputs, botones · 15–17 px títulos de panel y dialog · 11 px rótulos en mayúsculas (tracking 0,08–0,1 em). Pesos 400 / 500 / 600. `tabular-nums` en todo número.
- Radios: **10 px** controles y botones (`rounded-adm`) · **16 px** paneles, tablas, banners (`rounded-adm-lg`) · **20 px** dialogs y drawers · **pastilla** en badges, chips, buscador, paginación, contadores de tabs, toasts, SaveBar, barra mobile e ítem activo del sidebar.
- Densidad: filas 40 px, controles 32 px en tablas/filtros y 36 px en formularios; padding de paneles 16 → 20 px. Las curvas no agregan aire.
- Pantallas táctiles (`pointer-coarse`): botones md/lg e inputs a 44 px, sm a 36 px con área táctil extendida, texto de inputs 16 px (evita el zoom de iOS).

### 7.3 Shell: la hoja sobre la tinta

- **Escritorio.** El fondo del shell es tinta; el sidebar vive sobre ella sin borde y el contenido apoya encima como una **hoja niebla con la esquina superior izquierda de 28 px** (BRAND §7.2). La curva la dibuja el topbar fijo (`SheetCorner`, gradiente radial con la tinta del sidebar), así no se pierde al scrollear.
- **Sidebar** (244 px; contraído 64 px, cookie `adm-sidebar`): `BrandLockup` sobre tinta (burbuja pomelo + "ecommy" en display blanco; contraído, sólo `BrandMark`). Debajo, la **tarjeta de la tienda activa** (`rounded-adm-lg`, blanco 4 % + filo 7 %): inicial en tesela clara + nombre + `⇅` (es el `StoreSwitcher variant="sidebar"`) y el chip del plan (`SidebarPlanChip`, pastilla; la prueba en pomelo). Grupos con rótulo 11 px en mayúsculas `--adm-sidebar-muted`. Ítems de 32 px (44 táctil) en pastilla: **el activo es una sola pastilla tinta-3 que se desliza de un ítem a otro** (320 ms, `--eco-ease-out`; se mueve al tocar, antes de que termine la navegación) con el ícono en **pomelo**; hover, velo blanco 5 %. Badge de pedidos nuevos: pastilla pomelo con texto tinta que entra con rebote (`.adm-bounce-in`, se repite al cambiar el número); contraído, punto pomelo. Al pie, versión (punto pomelo si hay novedades) y "Contraer menú".
- **Topbar** de 56 px del color de la hoja, borde inferior `--adm-border`, alineado con el contenido (32 px): buscador en **pastilla blanca** ("Buscar pedidos, productos o ir a…" + `Ctrl K` en una pastilla niebla) que abre la palette, "Ver tienda" en pastilla blanca y avatar tinta con menú (Mi cuenta, Usuarios y roles, Cerrar sesión). Sin breadcrumb ni franja de color: la ubicación la dan el sidebar y el rótulo del título.
- **Mobile (< md).** Tapa de tinta de 56 px con la burbuja de Ecommy, el selector de tienda en pastilla y tres íconos de 44 px (buscar, ver tienda, cuenta); debajo, la hoja asoma con **las dos esquinas curvas de 20 px** (fijas al scrollear). **Barra inferior flotante**: pastilla tinta de 64 px a 10 px del borde (+ safe area) con Inicio, Pedidos (badge pomelo), Productos, Compartir y "Menú" (drawer izquierdo con el sidebar completo y el borde derecho curvo). Activo: pastilla tinta-3 con ícono pomelo y texto blanco; targets de 52 px. Se oculta con `data-adm-bottom-bar` (SaveBar, acciones masivas) o con un campo enfocado; los toasts suben (`--adm-toast-*`).
- "Saltar al contenido" como primer foco. Barra de progreso de navegación **pomelo de 3 px** arriba de todo (`NavigationProgress`).
- **SaveBar**: pastilla tinta flotante centrada abajo (en mobile, ancho completo con radio 22 px) que sube con rebote corto al aparecer: punto pomelo + "Cambios sin guardar" · "Descartar" (ghost claro) · **"Guardar" pomelo** con texto tinta. Lleva `data-adm-bottom-bar`; cualquier otra barra fija inferior también. `className` va al contenedor (ubicación en grillas).
- Carga: cada ruta tiene `loading.tsx` con skeletons que imitan la página (rótulo + título display, paneles de 16 px, pastillas; `src/components/ui/skeletons.tsx`, shimmer `.sk`); los filtros usan `useUrlTransition` y la tabla muestra un velo con una **pastilla tinta** "Actualizando…" con spinner pomelo.

### 7.4 PageHeader

Arriba, **rótulo de sección**: punto de la tinta de la sección + nombre del grupo en 11 px mayúsculas ("● CATÁLOGO"; "Ventas" para pedidos y clientes, "Inicio" en el dashboard; `icon` pone el ícono en lugar del punto; `section={false}` lo oculta). En el detalle, el rótulo se reemplaza por las migas ("Configuración / Tienda", links que se vuelven azules al hover). Título en `.eco-display` 22 → 26 px y debajo la línea con el dato útil ("142 productos activos · 8 sin stock"). Acciones a la derecha, alineadas a la base del bloque: secundaria y luego primaria. Tabs debajo (§7.6).

### 7.5 Tablas

- Panel blanco, borde `--adm-border`, **radio 16 px**, sin sombra. Header sticky 36 px, `--adm-table-head`, 12 px/500 muted, sin mayúsculas; primera y última celda con 16 px de aire. Filas 40 px, 13 px, `tabular-nums`, hover `--adm-row-hover` (140 ms), **seleccionada en azul lavado** (`--adm-select-soft`). `pending` (o el `UrlPendingScope`): velo blanco 60 % + pastilla tinta "Actualizando…".
- Primera columna = identidad clickeable (miniatura 32 px + nombre 500 + SKU mono 12 px muted). Números a la derecha. Fechas relativas con `title` absoluto. Acciones de fila en "…" al final. Con selección, la barra de filtros se reemplaza por la de acciones masivas.
- Filtros: búsqueda en **pastilla** (`SearchInput`, 280 px) + selects de 10 px + "Limpiar filtros". Paginación: "1–50 de 312" + anterior/siguiente en pastillas.

### 7.6 Formularios, tabs, dialogs y overlays

- Label arriba 13 px/500; ayuda 12 px muted; el error la reemplaza en `--adm-danger`, seco. Inputs de 36 px, radio 10 px, borde `--adm-input-border`, transición de borde y halo de 140 ms; foco azul. Checkbox y radio con `accent-color` azul. **Switch** de 36 × 20: encendido azul, la perilla llega con un rebote corto (`--eco-ease-spring`).
- Configuración en paneles de 2 columnas (título + descripción 1/3, campos 2/3).
- **Botones** (radio 10 px, 140 ms, al apretar escala 0,97): `primary` tinta · `secondary` blanco con borde suave · `ghost` · `danger` carmín · `accent` pomelo con texto tinta (uno por pantalla: "empezá por acá", SaveBar) · `link` azul subrayado.
- **Tabs** (`Tabs`, `TabsNav`): texto 14 px, subrayado tinta de 2 px que **se desliza** a la pestaña activa (240 ms); contador en pastilla (tinta con texto blanco en la activa, niebla en el resto). Antes de hidratar, la activa pinta su propio subrayado (sin salto).
- **Dialogs** de 400/480/640/800 px, **radio 20 px**: entran subiendo 10 px con escala 0,97 y el backdrop tinta 48 % se funde (240 ms, `--eco-ease-out`); título 17 px/600; pie niebla con las acciones a la derecha. **Drawers**: entran 32 px desde el costado (420 ms) con el borde interior curvo de 20 px. ConfirmDialog destructivo: botón carmín con el verbo exacto.
- **DropdownMenu**: radio 14 px, ítems de 8 px, crece desde el disparador (`.adm-pop-in`). **Tooltip**: burbuja tinta (la esquina que mira al disparador casi recta, BRAND §7.2) que entra con 2 px de corrimiento.
- **Toasts** (sonner): pastilla tinta (radio 22 px) con texto claro que entra con rebote; sólo el ícono lleva el color semántico (variante `-on-dark`); la acción va en pastilla pomelo.
- **Banners de plan** (`TrialBanner`, `LimitBanner`): fondo pomelo lavado, radio 16 px, burbuja chica con el ícono, número concreto (en `LimitBanner`, con barra de uso) + consecuencia + "Ver planes" en pastilla tinta. El aviso de Free es blanco y se cierra por 7 días. `PlanGate`: candado en burbuja durazno + "Disponible en <plan>" + link azul.

### 7.7 Badges de estado

**Pastilla de 22 px**, 12 px/500, punto de 6 px del color del texto + etiqueta: el estado nunca se comunica sólo por color. Fondos lavados fríos y texto oscuro del mismo tono (tokens `--adm-badge-*`), contraste ≥ 5,9:1.

| Tono | Fondo | Texto y punto | Estados |
| --- | --- | --- | --- |
| `neutral` | `#EEF0F6` | `#4A5068` (7,0:1) | Cancelado, Reintegrado, Borrador, Archivado |
| `amber` | `#FFF1D6` | `#8A4B00` (6,1:1) | Pendiente, Sin pagar, Stock bajo |
| `blue` | `#E5E9FB` | `#23338A` (9,0:1) | Confirmado |
| `purple` | `#F0E8FB` | `#5B2E9E` (7,6:1) | En preparación |
| `teal` | `#DDF3F2` | `#0B6366` (6,1:1) | Enviado |
| `green` | `#E0F3E8` | `#17683F` (5,9:1) | Entregado, Pagado, Activo, Publicada, En stock |
| `orange` | `#FDEBDC` | `#93400A` (6,1:1) | Pago parcial |
| `red` | `#FBE3E8` | `#A01434` (6,5:1) | Sin stock |
| `accent` | pomelo-soft `#FFE9E2` | pomelo-ink `#B02C14` (5,6:1) | "En uso", "Nuevo" (marca) |
| `ink` | tinta | blanco | Un dato que tiene que saltar |

Mapas de estado → etiqueta + tono en `STATUS_BADGES` (`Badge.tsx`).

### 7.8 Dashboard

- Orden por objetivo ("¿qué tengo que hacer hoy?"): encabezado con el nombre de la tienda y un resumen de una línea, "Para hacer" (sólo lo que tiene pendientes; cada fila lleva a la vista filtrada) + últimos pedidos, stock bajo y arrepentimientos; al final "Cómo viene la tienda" con el selector de período, la franja de métricas, el gráfico y más vendidos. El detalle visual lo define la pantalla.
- Cabecera: debajo del nombre, una línea en 17 px semibold con el conteo del día ("Tenés 7 cosas para resolver", suma de "Para hacer"; `todoHeadline` en `src/lib/admin/work-queue.ts`) y las tres pastillas más urgentes. Sin pendientes y con pedidos: "Listo por hoy" con el punto verde.
- "Resolver desde acá" (`WorkQueue`, PRODUCT-THESIS §4.1): debajo de "Para hacer", hasta 8 pedidos accionables agrupados en "Por confirmar" y "Por preparar y despachar" (orden en `prioritizeWorkQueue`: pendientes primero, las reservas que vencen antes y después el más viejo). Cada fila: número, cliente, total, badges, hace cuánto entró y su siguiente paso en un toque (`quickActionFor`, con Deshacer en el toast; "Marcar enviado" abre `ShipDialog`), "Avisar" por WhatsApp (sólo con teléfono válido, plantilla del estado) y "Ver pedido". En contenedores angostos la fila se apila; targets de 44 px con `pointer-coarse`. "Últimos pedidos" no repite los de la cola y baja a 5.
- `StatStrip`: **una** franja blanca (radio 16 px) con métricas separadas por reglas verticales: etiqueta 12 px muted + número `.eco-num` 24 → 30 px + delta 12 px en `--adm-success` / `--adm-danger` / muted, o `--adm-warning` si es alerta. Sin íconos ni fondos de color. En el panel los números no cuentan (BRAND §9).
- Gráfico: barras planas en tinta, sin gradiente ni animación, tooltip con monto exacto. Nada de áreas, donuts ni radar.

### 7.9 Empty states

Dentro del panel (o `bare` dentro de una tabla), alineado a la izquierda, padding 32 px: **burbuja durazno chica** (44 px, `.eco-bubble`) con el ícono lineal en tinta + título 16 px ("Todavía no hay pedidos") + una línea útil + acción primaria y secundaria. Sin ilustraciones. Con filtros sin resultados: "No hay pedidos con estos filtros." + "Limpiar filtros".

**Selector de presets (Apariencia).** El acordeón "Preset" sólo muestra el tema actual (miniatura + estado) y "Ver y comparar los N presets"; ese botón cambia el formulario de 400px por una grilla de 540px (`PresetGallery`) con la vista previa real al lado. Cada tarjeta es una miniatura fiel (`PresetThumb`: `themeVars()` en el contenedor y unidades de container query, así que header, portada, columnas, `cards.style`/`imageRatio`, botón y acento son los del tema) + nombre, descripción y rubros. Tocar una tarjeta la **prueba** en la vista previa sin tocar el tema (`aria-pressed`); aplicar es un paso aparte ("Aplicar Atelier" en la toolbar, con la confirmación de siempre si hay cambios sin guardar o un tema personalizado); Esc vuelve. Estados: "En uso" (badge `accent`), "Base de tu tema" (badge neutral, `basePresetOf`) y candado lineal "Plan Pro": se puede probar, y la acción pasa a "Ver planes". Filtros: búsqueda por rubro o tono (con alias: "ropa" → moda), fondo claro/oscuro y "Sólo los de mi plan". Todo sale de `PRESET_LIST`: nada de ids ni cantidades fijas. El alta de tienda usa la misma miniatura con el nombre que va escribiendo el dueño.

### 7.10 Command palette

Ctrl K / ⌘K. 640 px, a 15vh del borde superior, radio 20 px, `--adm-shadow`. Input de 56 px y 15 px sin borde con la lupa (spinner pomelo mientras busca): "Buscar pedidos, productos o ir a…". Resultados agrupados ("Ir a", "Acciones", "Pedidos", "Productos") con rótulos 11 px en mayúsculas; filas de 40 px con radio 10 px, ícono 16 px y la tecla Enter que aparece deslizándose en la fila activa (niebla). Pie niebla con las teclas. "#1043" abre ese pedido. 100 % teclado; Esc cierra y devuelve el foco.

### 7.11 Movimiento del panel (BRAND §9)

Suave y corto; nada demora una tarea. Hover y foco 140 ms; popovers y tabs 240 ms; pastilla del sidebar 320 ms; drawers 420 ms; todo con `--eco-ease-out`. Rebote corto (`--eco-ease-spring`) sólo en lo que **aparece**: badge de pedidos, perilla del switch, SaveBar, toasts. Utilidades en `admin.css`: `.adm-pop-in`, `.adm-bounce-in`, `.adm-rise-in`. `prefers-reduced-motion` las corta (regla global de `globals.css`); ningún contenido depende de una animación para verse.

---

## 8. Checklist de revisión (antes de entregar UI)

1. [ ] Ningún patrón de §1: gradientes, glass, blobs, emojis, íconos en círculo, hover que agranda, fade-up por sección, todo centrado.
2. [ ] Storefront: cero colores, radios, sombras o fuentes literales; sólo tokens del tema. Probado con **`atelier`, `nordico` y `neon`** sin romperse.
3. [ ] Contraste AA: texto ≥ 4.5:1; texto grande, íconos funcionales y bordes de inputs ≥ 3:1 (revisado en `neon` oscuro y en `mercado` crema).
4. [ ] Foco visible en todo lo interactivo (`--primary` / `--adm-focus`), orden de tab lógico, drawers y dialogs con focus trap, Esc y retorno del foco.
5. [ ] Mobile a 360px: sin scroll horizontal, targets ≥ 44px, gutter 16px, nada cortado.
6. [ ] Copy en voseo rioplatense, concreto, sin frases vacías ni exclamaciones; botones con verbo ("Agregar al carrito", "Iniciar compra").
7. [ ] Precios con `formatMoney` + `tabular-nums`; promo en `--accent` + tachado muted; transferencia como línea secundaria.
8. [ ] Alineación a la izquierda salvo las excepciones de §1.1.
9. [ ] Ritmo: no hay 3 bloques seguidos con el mismo `paddingY`; títulos más cerca de su contenido que de la sección anterior.
10. [ ] Imágenes con `alt` real, `aspect-ratio` reservado (sin CLS), `sizes` correcto, prioridad sólo para la primera del viewport.
11. [ ] Estados cubiertos: carga, vacío con contenido útil y acción, error (qué pasó + cómo seguir), sin stock, deshabilitado.
12. [ ] Sin lorem ipsum, sin reseñas inventadas, sin logos de tarjetas; cuotas sólo las sin interés reales del comercio (Mercado Pago conectado).
13. [ ] Íconos lucide 16–20px; `aria-hidden` si decoran, `aria-label` si son el único contenido del botón.
14. [ ] `prefers-reduced-motion` respetado; transiciones ≤ 200 ms (drawers ≤ 280 ms); nada animado al cargar.
15. [ ] Formularios: label real arriba, `autocomplete`, errores junto al campo con `aria-describedby` y `aria-invalid`.
16. [ ] Admin: sólo tokens `--adm-*`; tablas con filas 40px, header sticky, números a la derecha; badges de §7.7 con etiqueta + punto.
17. [ ] Admin: dashboard sin stat cards de colores ni gráficos con gradiente; empty states con acción.
18. [ ] Acciones destructivas con ConfirmDialog y verbo exacto; toasts neutros y en español.
19. [ ] Fuentes: sólo las de §5, máximo 2 familias y 3 archivos por página, `display=swap`. **Excepción: el muestrario de estilos de la landing** (`/`, sección "Para quién", y el mock de tienda del hero), que dibuja los 10 presets con sus fuentes reales. Presupuesto: ninguna hoja de Google Fonts en el HTML (nada bloquea el render; el LCP es el h1 en la fuente del sistema); una hoja por preset (2 familias, recortada con `text=` a los glifos que se dibujan), que `LazyFontSheets` inyecta cuando su elemento está a 600 px del viewport. Al cargar se piden sólo las 2 familias del hero (Mercado: 1 hoja precargada con prioridad baja, 2 archivos, ~27 KB); recorriendo toda la página, 10 hojas, 20 familias y 20 archivos (~220 KB). Si se agrega un preset, suma una hoja que no se pide hasta que su muestra se acerca.
20. [ ] Lighthouse mobile del storefront: Accesibilidad ≥ 95, CLS < 0.05.
