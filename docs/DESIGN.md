# Ecommy — Dirección de diseño

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
| `rounded-2xl` / `rounded-3xl` en todo | Borra la personalidad del tema: todo parece un dashboard de Notion. | Sólo `var(--radius-sm\|md\|lg)` del tema. Nunca un radio literal en el storefront. |
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
| Todo centrado (títulos, textos, grillas) | Destruye el eje de lectura; todo pesa lo mismo. | Izquierda por defecto. Centrado sólo en: header `logo-center`, hero con `align:'center'` elegido por el dueño, announcement bar, estados vacíos de una línea. |
| Íconos gigantes (48–96px) como ilustración | Rellenan sin comunicar. | Íconos 16–20px, funcionales. La ilustración es la foto del producto. |
| Todas las secciones con la misma altura y el mismo `py-16` | Ritmo monótono, "scroll infinito de cajas". | Ritmo asimétrico (§2.2): `style.paddingY` varía por bloque; bloques relacionados se pegan. |
| Footer de 4 columnas iguales con 5 links cada una | Genérico, casi siempre con links inventados. | 3 estilos (§6.7) con columnas de ancho desigual y sólo links que existen. |
| Colores "tailwind-500" sin ajustar (`blue-500`, `violet-600`, `emerald-500`) | Delatan el framework y rara vez pasan AA. | En storefront no se usa **ninguna** clase de color de la paleta de Tailwind: sólo `bg-bg`, `text-fg`, `bg-primary`, etc. |
| Animaciones de entrada en cada sección (fade-up al scrollear) | Retrasan el contenido, marean. | Contenido visible de entrada. Movimiento sólo como respuesta a una acción (abrir drawer, agregar al carrito). `prefers-reduced-motion` siempre. |
| Barrita de color a la izquierda de cada título, chips pill de categoría y badge "En stock" en cada card (estado actual) | Ruido repetido 20 veces por pantalla. | Título tipográfico solo. Categoría, si hace falta, como texto `--fg-muted` 12px. El stock se comunica sólo cuando falta. |

### 1.2 Admin

| Prohibido | Reemplazo |
| --- | --- |
| Dashboard con 4 stat cards de colores pastel, cada una con ícono en círculo | Franja única con números tipográficos grandes separados por reglas verticales (§7.8). |
| Gráficos de área con gradiente, donuts de 6 colores | Tablas y listas primero. Si hay gráfico: barras monocromas `--adm-fg` al 80 %, sin gradiente ni animación. |
| Sidebar oscura con logo brillante o gradiente | Sidebar en `--adm-surface-2` (mismo neutro cálido), item activo con fondo `--adm-surface` y borde 1px. |
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
- Ficha de producto: galería 7/12 + buy box 5/12. `image_text`: 7/12 + 5/12. Nunca 50/50 por defecto.

### 2.7 Alineación

- Texto a la izquierda por defecto: títulos de sección, hero, rich text, footer, estados vacíos largos.
- "Ver todo" en la misma línea base que el título de sección, a la derecha, como link de texto (subrayado al hover). La flecha "→" sólo en `editorial`.

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
--border-strong: color-mix(in oklab, var(--fg) 38%, var(--bg));   /* bordes de inputs, ≥ 3:1 (WCAG 1.4.11) */
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
- Transición `background-color, color, border-color` 120 ms. Nunca `transform: scale`.

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
| `layout` | §6.4 |
| `sticky` | `position: sticky; top: 0`. Al scrollear > 8px aparece `border-bottom 1px --border` (o `--shadow-sm` si `shadows: 'strong'`). |
| `transparentOnHome` | Sólo si la home empieza con un `hero` con imagen: el header se superpone, texto blanco, fondo transparente; al scrollear pasa a `--bg` sólido. Sin blur. |
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

- `footer.style`: §6.7. `showSocial`: links de `store_settings.social` como texto ("Instagram · TikTok") o íconos lucide 18px monocromos; nunca logos a color. `showPayments`: **texto**, no logos de tarjetas (no hay pasarela): "Transferencia bancaria (10 % off) · Acordás con el vendedor".
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

---

## 4. Presets

Cada preset define **todos** los campos. Elegirlo en el admin copia el objeto completo; cualquier edición posterior pasa `preset` a `"custom"`. Contrastes verificados (WCAG 2.1): `text`, `textMuted`, `accent`, `success` y `danger` ≥ 4.5:1 sobre `background`; `primaryText` ≥ 7:1 sobre `primary`. Default de una tienda nueva: `nordico` (el más neutro y el que mejor tolera catálogos importados con fotos heterogéneas).

### 4.1 `atelier` — moda, joyería, marroquinería

Para marcas que venden con la foto: indumentaria de autor, joyería, cuero, lencería. Cormorant Garamond en títulos grandes sobre blanco roto, Jost (geométrica tipo Futura) para el resto, cero sombras, cero radios, botones rectos en mayúsculas espaciadas y fotos 4:5 grandes en 3 columnas. El tostado sólo aparece en promos. Se distingue por el silencio: mucho aire, poca UI.

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
    "secondary": "#E8E1D5",
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
  "cards": { "style": "flat", "imageRatio": "4:5", "hover": "zoom", "showSku": false, "showBrand": false },
  "header": { "layout": "logo-center", "sticky": true, "transparentOnHome": true, "showSearch": true },
  "layout": { "density": "airy", "containerWidth": "wide", "gridColumns": { "mobile": 2, "desktop": 3 } },
  "footer": { "style": "columns", "showSocial": true, "showPayments": false },
  "effects": { "shadows": "none", "dividers": true, "imageFilter": "none" }
}
```

### 4.2 `mercado` — artesanías, deco, dietética, feria

Para quien vende cerámica, mates, textiles, velas, productos naturales. Fondo crema, Fraunces (serif blanda y cálida) con Nunito Sans legible a 17px, verde bosque como CTA y terracota para promos. Cards con borde, radio generoso, botones pill tintados, hover que levanta apenas y grano sutil en las fotos de campaña. Se siente como un puesto cuidado, no como un marketplace.

```json
{
  "preset": "mercado",
  "colors": {
    "background": "#F6F0E4",
    "surface": "#FFFBF3",
    "text": "#2B2118",
    "textMuted": "#6B5C4B",
    "primary": "#2F5D46",
    "primaryText": "#FFFBF3",
    "secondary": "#EADFC9",
    "accent": "#A8431F",
    "border": "#DCCFB8",
    "success": "#3E6B2F",
    "danger": "#A8321F"
  },
  "fonts": {
    "heading": "fraunces",
    "body": "nunito-sans",
    "headingWeight": 600,
    "bodyWeight": 400,
    "headingTransform": "none",
    "headingTracking": "tight",
    "baseSize": 17
  },
  "radius": "lg",
  "buttons": { "style": "soft", "shape": "pill", "uppercase": false },
  "cards": { "style": "bordered", "imageRatio": "1:1", "hover": "lift", "showSku": false, "showBrand": false },
  "header": { "layout": "logo-left", "sticky": true, "transparentOnHome": false, "showSearch": true },
  "layout": { "density": "comfortable", "containerWidth": "normal", "gridColumns": { "mobile": 2, "desktop": 4 } },
  "footer": { "style": "columns", "showSocial": true, "showPayments": true },
  "effects": { "shadows": "soft", "dividers": false, "imageFilter": "grain" }
}
```

Nota: `1:1` va con `contain` (§2.5). Si el dueño sube fotos ambientadas (cerámica sobre una mesa), le conviene `4:5`, que pasa a `cover`.

### 4.3 `nordico` — electro, hogar, ferretería, importadoras

Para catálogos grandes y técnicos: auriculares, herramientas, bazar, iluminación, repuestos. Gris muy claro, negro suave y azul profundo; Sora en títulos y Manrope (cifras tabulares nítidas) para todo lo demás. Densidad compacta, 5 columnas, SKU y marca visibles, reglas finas entre celdas. El "flat con borde fino" del brief se implementa como `bordered` + `shadows: 'none'`. Se distingue por la precisión: se escanea como una planilla bien diseñada.

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
    "success": "#1F7A4D",
    "danger": "#9F1D1D"
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
  "cards": { "style": "bordered", "imageRatio": "1:1", "hover": "zoom", "showSku": true, "showBrand": true },
  "header": { "layout": "logo-left", "sticky": true, "transparentOnHome": false, "showSearch": true },
  "layout": { "density": "compact", "containerWidth": "wide", "gridColumns": { "mobile": 2, "desktop": 5 } },
  "footer": { "style": "columns", "showSocial": true, "showPayments": true },
  "effects": { "shadows": "none", "dividers": true, "imageFilter": "none" }
}
```

### 4.4 `editorial` — marcas con actitud

Para marcas que comunican como una revista: streetwear local, bicicletas, vinería de autor, editoriales independientes. Blanco puro, negro, rojo para promos y amarillo como banda de anuncio. Barlow Condensed 800 en mayúsculas para titulares enormes, Schibsted Grotesk (diseñada para un grupo de diarios) para el cuerpo, reglas negras de 1px que arman la grilla. Radio cero, header mínimo con texto en lugar de íconos. Se distingue por la tipografía: los títulos son la imagen.

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
    "accent": "#D90B0B",
    "border": "#0A0A0A",
    "success": "#0B7A3B",
    "danger": "#C20000"
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
  "cards": { "style": "flat", "imageRatio": "3:4", "hover": "none", "showSku": false, "showBrand": false },
  "header": { "layout": "minimal", "sticky": true, "transparentOnHome": true, "showSearch": true },
  "layout": { "density": "comfortable", "containerWidth": "wide", "gridColumns": { "mobile": 2, "desktop": 4 } },
  "footer": { "style": "simple", "showSocial": true, "showPayments": false },
  "effects": { "shadows": "none", "dividers": true, "imageFilter": "none" }
}
```

### 4.5 `neon` — gaming, periféricos, streetwear nocturno

Para hardware gamer, periféricos, sneakers, cultura urbana, tiendas de vinilos. Fondo `#0B0B0F`, superficies `#15151C`, texto claro y un único acento lima saturado que es CTA y precio promo a la vez. Unbounded (ancha, técnica) en títulos y Space Grotesk en el cuerpo. Cards "elevated" que en oscuro se resuelven con borde; el glow existe sólo en el botón primario. Se distingue por la disciplina: un solo color vivo, nada más brilla.

```json
{
  "preset": "neon",
  "colors": {
    "background": "#0B0B0F",
    "surface": "#15151C",
    "text": "#EDEDF2",
    "textMuted": "#9D9DAB",
    "primary": "#C6FF3D",
    "primaryText": "#0B0B0F",
    "secondary": "#22222C",
    "accent": "#C6FF3D",
    "border": "#2A2A35",
    "success": "#4ADE80",
    "danger": "#FF6B6B"
  },
  "fonts": {
    "heading": "unbounded",
    "body": "space-grotesk",
    "headingWeight": 600,
    "bodyWeight": 400,
    "headingTransform": "none",
    "headingTracking": "tight",
    "baseSize": 16
  },
  "radius": "md",
  "buttons": { "style": "solid", "shape": "radius", "uppercase": false },
  "cards": { "style": "elevated", "imageRatio": "1:1", "hover": "lift", "showSku": false, "showBrand": true },
  "header": { "layout": "logo-left", "sticky": true, "transparentOnHome": false, "showSearch": true },
  "layout": { "density": "comfortable", "containerWidth": "normal", "gridColumns": { "mobile": 2, "desktop": 4 } },
  "footer": { "style": "columns", "showSocial": true, "showPayments": true },
  "effects": { "shadows": "soft", "dividers": false, "imageFilter": "none" }
}
```

---

## 5. Fuentes curadas (`src/lib/theme/fonts.ts`)

Todas de Google Fonts. `id` kebab = valor en el tema; `family` = nombre exacto para la URL (espacios → `+`). Pesos: rango si es variable, lista si es estática. Excluidas a propósito: Inter, Roboto, Poppins, Montserrat, Playfair Display, Open Sans, Lato.

| id | family | cat. | pesos | Usala para |
| --- | --- | --- | --- | --- |
| `cormorant-garamond` | Cormorant Garamond | serif | 300–700 (+ itálicas) | títulos grandes de moda y joyería; nunca debajo de 20px |
| `instrument-serif` | Instrument Serif | serif | 400 (+ itálica) | display editorial fino y condensado; sólo títulos |
| `fraunces` | Fraunces | serif | 100–900 (ejes opsz, SOFT) | títulos cálidos: artesanal, gastronomía, dietética |
| `libre-caslon-text` | Libre Caslon Text | serif | 400–700 (+ itálica) | librerías, vinos, marcas clásicas; aguanta cuerpo |
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
| `ibm-plex-mono` | IBM Plex Mono | mono | 100–700 (+ itálicas) | marcas "de laboratorio": café de especialidad, cosmética técnica |

Reglas del selector:
- Categorías `display` y `mono`, más `instrument-serif`, `cormorant-garamond` y `syne`, se ofrecen **sólo para `heading`**.
- Cada opción se muestra renderizada con una frase real ("Camperas de gabardina — $ 89.000"), no con "The quick brown fox".
- Al cambiar de fuente, si el peso elegido no existe, se ajusta al más cercano disponible y se avisa.

---

## 6. Componentes del storefront

Viven en `src/components/store/*` y `src/components/blocks/*`. Consumen tokens; cero colores, radios o sombras literales.

### 6.1 ProductCard

Orden: imagen → [marca] → [SKU] → nombre (máx. 2 líneas, alto reservado) → PriceTag → [línea de transferencia]. **Sin** chips de categoría, sin badge "En stock", sin botón visible por defecto.

- **Compra rápida**: en desktop, al `hover`/`focus-within` aparece "Agregar al carrito" pegado al borde inferior de la imagen (ancho completo, `--control-h`, estilo del tema). En mobile no hay botón: la card entera lleva a la ficha. Con variantes: "Elegir opciones" (abre la ficha).
- **Por `cards.style`**: `flat` → texto con `padding-top: --card-pad`, sin padding lateral; `bordered`/`elevated` → texto con `padding: --card-pad`, la imagen toca los bordes del panel (radio sólo arriba).
- **Por `imageRatio`**: `4:5`/`3:4` cover a sangre; `1:1`/`16:9` contain con padding 6 % sobre `--surface`.
- **Precio**: "$ 45.900" en `--fg`, `--text-lg`, `tabular-nums`. Variantes con distinto precio: "Desde $ 45.900" ("Desde" en `--fg-muted`, peso normal).
- **Promo**: actual en `--accent` + anterior tachado `--fg-muted --text-sm` en la misma línea: `$ 36.720  $ 45.900`. Si no entra, el tachado baja de línea.
- **Transferencia**: si el método `transfer` tiene descuento > 0, línea `--text-xs --fg-muted`: "$ 33.048 con transferencia". Una sola vez por card.
- **Badge de promo**: `badge_label` de la promoción ganadora ("-20 %", "Ciber Lunes"). Esquina superior izquierda de la imagen a 8px, `--text-xs`, peso 600, `bg --bg`, `color --accent`, `padding 2px 6px`, radio `--radius-sm`. Sin sombra, sin rotación; uppercase sólo si `buttons.uppercase`. Máximo **un** badge por card.
- **Sin stock**: imagen al 55 % de opacidad; precio en `--fg-muted` y debajo "Sin stock" `--text-xs`. El botón de hover dice "Consultar por WhatsApp" si el método whatsapp está activo; si no, no hay botón. Van al final de los listados salvo orden explícito.
- **Stock bajo**: "Quedan 3" sólo en la ficha, no en la card.

### 6.2 PriceTag

Un solo componente para card, ficha, carrito y checkout. Props: `price`, `compareAt?`, `transferPercent?`, `from?`, `size: 'sm' | 'md' | 'lg'`.

- `lg` (ficha): precio `--text-xl` mobile / `--text-2xl` desktop en `--font-body`. Debajo: "Pagando con transferencia **$ 41.310** (10 % off)" + link "Ver medios de pago" que abre un popover con los métodos activos.
- Accesibilidad: `<span class="sr-only">Precio anterior:</span>` antes del tachado y `Precio actual:` antes del vigente.
- Nunca cuotas ("6 cuotas sin interés"): no hay pasarela.

### 6.3 Ficha de producto

Desktop: galería 7/12 (miniaturas verticales a la izquierda, principal con `imageRatio` del tema) + buy box 5/12 sticky (`top: calc(var(--header-h) + 24px)`). Mobile: galería con scroll-snap horizontal y contador "2/5" en `--text-xs`, sin dots.

Buy box: marca/SKU → h1 (heading) → PriceTag `lg` → variantes (botones rectangulares `--radius-sm`; agotados tachados y `disabled`; colores como texto + muestra de 16px) → cantidad + "Agregar al carrito" → entrega ("Te lo llevamos · desde $ 4.500" / "Retirás en el local · gratis") → descripción (RichText).

### 6.4 Header — 3 layouts

Base: fondo `--bg`, texto `--fg`, alto `--header-h`, borde inferior `--border` si `dividers` o al scrollear. Announcement bar opcional encima: `announcement.bg/fg` o `--secondary`/`--fg`, 32px, `--text-xs`, centrado, sin botón de cerrar.

- **`logo-left`**: logo · nav (menú `header`, `--text-sm`, peso `bodyWeight + 100`) · buscador (si `showSearch`) · carrito. Para catálogos grandes.
- **`logo-center`**: nav a la izquierda, logo centrado (28–40px de alto), buscar + carrito a la derecha. Nav en uppercase `--text-xs` tracking 0.12em si `buttons.uppercase`. Para moda.
- **`minimal`**: logo a la izquierda; a la derecha **texto**: "Menú", "Buscar", "Carrito (2)". "Menú" abre un panel full-height con links en `--font-heading` grandes. Para marcas editoriales.
- Mobile (los tres): menú a la izquierda · logo · carrito. El buscador pasa a ícono.
- Contador del carrito: "(2)" en texto o círculo 18px `bg --primary`/`--primary-fg`. Nunca un color fijo.
- Megamenú sólo si un ítem tiene > 6 hijos: columnas de texto, sin imágenes promocionales.

### 6.5 Hero

- **Alturas** (`settings.height`): `sm` 40vh (mín. 320px) · `md` 60vh (mín. 420px) · `lg` 80vh (mín. 520px) · `screen` `calc(100svh - var(--header-h))` (o `100svh` con header transparente). En mobile se usa `imageUrlMobile` (4:5) si existe.
- **Overlay** (`overlay` 0–80, α = overlay/100): gradiente orientado al texto, no un velo uniforme. `align: 'left'` → `linear-gradient(to top right, rgb(0 0 0/α) 0%, rgb(0 0 0/α·0.3) 60%)`; `center` → `rgb(0 0 0/α)` plano. Si `overlay < 25`, el builder advierte "El texto puede no leerse".
- **Alineación**: `left` (default) → bloque de texto abajo a la izquierda, máx. 560px, a un gutter del borde; `center` → centrado vertical y horizontal, máx. 720px.
- Contenido: eyebrow opcional (`--text-xs` uppercase tracking 0.12em) → título `--text-display` → subtítulo `--text-lg` máx. 2 líneas → CTA primario (`solid`, sobre imagen oscura usa `--bg`/`--fg`) + `cta2` como link subrayado.
- Sin imagen: hero tipográfico sobre `--bg` o `--secondary`, título a la izquierda, sin decoración.
- Ancho completo sin radio. Si es el primer bloque: imagen con `priority` / `fetchpriority="high"`.

### 6.6 BannerGrid

- **1 columna = banner de campaña**: `ratio` default `21:9` desktop / `4:5` mobile (`imageUrlMobile`), `container` `full` o `normal`, texto sobre imagen con overlay como el hero, título `--text-2xl` a `--text-display`. Un solo CTA, botón.
- **2 columnas**: `4:5` o `1:1`; texto abajo a la izquierda sobre la imagen, título `--text-xl`, CTA como link subrayado.
- **3–4 columnas = tiles**: `1:1` o `4:5`, texto **debajo** de la imagen (no encima): título `--text-base` semibold + subtítulo `--fg-muted`. Son accesos a categorías o colecciones; la pieza entera es link.
- **`ratio: 'auto'` con 3 ítems** (desktop): grilla asimétrica 2fr/1fr; el primero ocupa 2 filas, los otros dos apilados.
- `gap`: `none` 0 · `sm` 8px · `md` `--gap-grid`. Radio `--radius-lg`, salvo `gap: 'none'` o `container: 'full'` (0).
- Mobile: 1 col → full; 2 col → 2 col; 3 col → scroll horizontal con snap (tiles de 72vw); 4 col → 2×2.

### 6.7 Footer — 3 estilos

Fondo `--bg` con regla superior `--border` (no bloque negro por defecto). Texto `--text-sm`; links `--fg-muted` → `--fg` al hover.

- **`simple`**: fila 1 = nombre de la tienda en `--font-heading` grande (`--text-2xl`; `--text-display` en `editorial`) a la izquierda + links del menú `footer` en línea a la derecha. Fila 2 = contacto (WhatsApp, email, dirección) · redes · legales · "© 2026 {tienda}".
- **`columns`**: grilla de 12 con anchos desiguales: marca + tagline + contacto (5) · grupos del menú `footer` (2 grupos × 2) · "Medios de pago" y "Envíos" en texto (3). Sólo grupos con links reales; con un solo grupo se degrada a `simple`.
- **`minimal`**: una línea: "© 2026 {tienda} · Términos · Privacidad · Instagram". Para landings y marcas muy limpias.
- Siempre: datos de contacto reales y link "Botón de arrepentimiento" cuando hay política de devoluciones (obligatorio en Argentina para venta online).

### 6.8 ProductSlider

- Track `overflow-x: auto`, `scroll-snap-type: x mandatory`, ítems `scroll-snap-align: start`, scrollbar oculta, `scroll-padding-inline` = gutter. El último ítem visible asoma un 30 % para sugerir scroll.
- Ancho de ítem: `(100% − gaps) / cardsPerView` en desktop; en mobile, 2.3 visibles (1.3 si `gridColumns.mobile: 1`).
- **Flechas discretas**: sólo ≥ 1024px, en la línea del título a la derecha junto a "Ver todo": dos botones 32px, ícono `ChevronLeft`/`ChevronRight` 16px, `border 1px --border`, radio `--radius-sm`, opacidad 35 % y `disabled` en los extremos. **No** flotan sobre las cards. **Sin dots, sin autoplay.**
- Encabezado: h2 a la izquierda + subtítulo opcional `--fg-muted`; "Ver todo" como link de texto.

### 6.9 RichText (prose)

Clase propia `.prose-store` (no el plugin typography por defecto):
- `h2`/`h3`: `--font-heading` con peso, transform y tracking del tema; `margin: 1.6em 0 .5em`.
- `p`, `li`: `--font-body`, `--text-base`, `line-height: 1.6`; medida 68ch (`maxWidth: 'narrow'` = 60ch).
- Links: `color --fg`, `text-decoration-thickness: 1px; text-underline-offset: 3px`; hover `--primary`.
- `blockquote`: borde izquierdo 2px `--fg`, `--text-lg`, itálica del heading si la fuente la tiene.
- Listas con viñeta "–" en `--fg-muted`. Tablas (fichas técnicas): reglas horizontales `--border`, sin zebra, números a la derecha con `tabular-nums`.
- Imágenes al ancho de la columna, radio `--radius-lg`; `figcaption` `--text-xs --fg-muted`.

### 6.10 Carrito y Checkout

- **Drawer**: 420px desktop / 100 % mobile, desde la derecha, `bg --bg`, `--shadow-lg`. Filas: miniatura 64px (ratio del tema) · nombre + variante · stepper 32px · precio. Pie sticky: subtotal, "El envío se calcula en el checkout", "Iniciar compra" (solid, ancho completo), "Seguir comprando" (link).
- **Checkout**: **una columna** de formulario (máx. 560px) + resumen a la derecha en desktop (380px, `position: sticky; top: calc(var(--header-h) + 24px)`). En mobile, el resumen es un acordeón arriba: "Ver resumen · $ 128.400".
- **Pasos verticales** numerados: "1. Tus datos", "2. Entrega", "3. Pago", "4. Revisá y confirmá". Activo expandido; completos colapsados en una línea + "Editar"; futuros en `--fg-muted`. Sin stepper horizontal de círculos.
- **Entrega**: dos radios grandes (tarjetas `bordered` de una línea): "Te lo llevamos — {zona}, llega en {eta} · $ 4.500" / "Retirás en el local — {dirección} · Gratis". Zona sin cobertura: mensaje inline con link a WhatsApp, no un modal.
- **Pago**: radios con el descuento alineado a la derecha ("Transferencia bancaria   −10 %"). El total del resumen se actualiza al instante.
- **Inputs**: label arriba (`--text-sm`, peso 500), alto `--control-h`, borde `--border-strong`, radio `--radius-md`, foco `outline: 2px solid var(--primary); outline-offset: 2px`. Error debajo en `--danger` `--text-sm`. `autocomplete` correcto (`name`, `email`, `tel`, `street-address`, `postal-code`).
- **CTA final**: "Confirmar pedido" (solid, ancho completo) y debajo, `--text-xs`: "En el próximo paso te mostramos cómo pagar."

### 6.11 Página de pedido (`/pedido/[token]`)

- Encabezado: "Recibimos tu pedido #1043" (heading) + fecha + estado como texto con punto de color, no badge chillón.
- **La acción va primero**, antes del resumen. Transferencia → caja `bordered` con filas Banco / Titular / CBU / Alias / CUIT / Monto a transferir, cada una con "Copiar" (feedback "Copiado"); debajo "Enviar comprobante por WhatsApp" (solid). WhatsApp → botón grande "Abrir WhatsApp" + "Si no se abrió solo, tocá el botón."
- Después: timeline vertical de eventos visibles (fecha `--text-xs --fg-muted` + mensaje), ítems, totales y entrega.
- Pie: "Guardá este link para ver cómo va tu pedido." + "Copiar link".

### 6.12 Resto de bloques (§9 de la spec)

- `heading`: eyebrow + título, izquierda por defecto, sin subrayados decorativos.
- `image_text`: imagen 7/12 + texto 5/12 (o invertido), texto centrado verticalmente y alineado a la izquierda.
- `category_list`: `cards` = tiles como BannerGrid 3–4 cols; `chips` = links de texto con borde `--border` y `--radius-pill`; `circles` = foto circular 96px + nombre debajo (el único círculo permitido, y sólo con fotos reales).
- `features`: ver §1.1. `faq`: `<details>` con regla entre ítems y "+"/"−" a la derecha, sin cajas. `countdown`: números `tabular-nums` en heading, sin tarjetitas por dígito; al vencer, el bloque se oculta. `testimonials`: cita en heading + autor, nace vacío. `video`: sin autoplay con sonido. `divider`: regla `--border` o espacio.

---

## 7. Admin

Herramienta de trabajo: neutra, densa, rápida. **No** hereda el tema de la tienda (salvo dentro del preview). Tokens fijos bajo `.admin-root`.

### 7.1 Paleta fija

```css
.admin-root {
  --adm-bg:        #F7F6F3; /* fondo general, neutro cálido */
  --adm-surface:   #FFFFFF; /* paneles, tablas, dialogs */
  --adm-surface-2: #F1EFEA; /* sidebar, header de tabla, fila seleccionada, readonly */
  --adm-border:    #E2DED6; /* reglas y bordes de paneles */
  --adm-fg:        #1F1E1B; /* texto (15.4:1 sobre bg) */
  --adm-fg-muted:  #6B6860; /* secundario (5.2:1 sobre bg, 4.8:1 sobre surface-2) */
  --adm-accent:    #2E4A3F; /* verde pino: primario, links, foco, activo */
  --adm-accent-fg: #FFFFFF; /* 9.7:1 sobre accent */
  --adm-danger:    #B42318; /* 6.6:1 sobre surface */
  --adm-warning:   #9A5B00; /* 5.4:1 */
  --adm-success:   #2F6B3F; /* 6.4:1 */
  --adm-info:      #2B5A84; /* 7.3:1 */
  --adm-input-border: #CFCABF; /* ≥ 3:1 sobre surface */
  --adm-radius:    6px;
  --adm-focus:     0 0 0 2px var(--adm-surface), 0 0 0 4px var(--adm-accent);
  --adm-shadow:    0 12px 32px -12px rgb(31 30 27 / .25), 0 0 0 1px var(--adm-border);
}
```

Hover de filas e ítems: `color-mix(in oklab, var(--adm-surface-2) 60%, var(--adm-surface))`. Sombra (`--adm-shadow`) sólo en dialogs, dropdowns, popovers y command palette.

### 7.2 Tipografía y densidad

- Stack del sistema: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (herramienta: nitidez nativa y cero carga). Mono: `ui-monospace, SFMono-Regular, Consolas, monospace` para SKU, cupones, tokens.
- Tamaños: **13px** tablas y metadatos · **14px** cuerpo, inputs, botones · 16px títulos de panel · 20px título de página · 28px números del dashboard. Pesos 400 / 500 / 600.
- `font-variant-numeric: tabular-nums` en celdas numéricas, precios, stock y fechas; números alineados a la derecha.
- Densidad: controles 32px en tablas/filtros y 36px en formularios; padding de paneles 16px (20px en formularios); gaps 8 / 12 / 16px. Radio único 6px (badges 4px).

### 7.3 Shell

- Sidebar 232px, `bg --adm-surface-2`, borde derecho `--adm-border`. Arriba: nombre de la tienda 14px/600 + "Ecommy 0.0.0" 12px muted. Ítems 32px, ícono lucide 16px `--adm-fg-muted`, texto 14px; activo: `bg --adm-surface`, borde 1px, texto 500. Grupos con título 11px uppercase muted: "Catálogo", "Ventas", "Tienda online", "Configuración".
- Topbar 48px: disparador de la command palette ("Buscar o ir a…  Ctrl K"), "Ver tienda" (externo), menú de usuario.

### 7.4 PageHeader

Título 20px/600 a la izquierda + descripción opcional 14px muted con dato útil ("142 productos activos · 8 sin stock"). A la derecha: secundaria (outline) y primaria ("Nuevo producto"). Breadcrumb 13px arriba sólo en detalle ("Pedidos / #1043"). Tabs de filtro debajo con subrayado 2px `--adm-accent`, no pills.

### 7.5 Tablas

- Panel `--adm-surface`, borde 1px, radio 6px. Header **sticky** 36px, `bg --adm-surface-2`, 12px/500 muted, sin uppercase. Filas **40px**, 13px, regla inferior `--adm-border`, hover sutil, seleccionada `--adm-surface-2`.
- Primera columna = identidad clickeable (miniatura 32px radio 4px + nombre 500 + SKU mono 12px muted). Números a la derecha. Fechas relativas ("hace 2 h") con `title` absoluto.
- Acciones de fila en menú "…" al final (visible al hover y al foco). Al seleccionar, la barra de filtros se reemplaza por la de acciones masivas: "3 seleccionados · Cambiar estado · Archivar · Exportar CSV".
- Filtros arriba: búsqueda 280px + selects 32px + "Limpiar filtros". Paginación abajo: "1–50 de 312" + anterior/siguiente.

### 7.6 Formularios y dialogs

- Label arriba 13px/500; ayuda debajo 12px `--adm-fg-muted`; el error reemplaza la ayuda en `--adm-danger` 12px, sin ícono, seco: "Tiene que ser mayor a 0." Campo con error: borde `--adm-danger` + `aria-invalid`.
- Inputs 36px, borde `--adm-input-border`, foco `--adm-focus`. Configuración en paneles de 2 columnas (título + descripción 1/3, campos 2/3); dialogs en 1 columna.
- Guardado: barra sticky inferior cuando hay cambios: "Cambios sin guardar · Descartar · Guardar".
- Dialogs 480px (confirmación) / 640px (form), radio 6px, título 16px/600, acciones a la derecha. ConfirmDialog destructivo: botón `--adm-danger` con el verbo exacto ("Archivar 3 productos"), nunca "Aceptar".

### 7.7 Badges de estado

Alto 20px, radio 4px, 12px/500, punto de 6px del color del texto + etiqueta: el estado nunca se comunica sólo por color. Contraste ≥ 5.8:1 en todos.

| Estado | Etiqueta | Fondo | Texto y punto |
| --- | --- | --- | --- |
| `pending` | Pendiente | `#F5EAD3` | `#7A4A00` |
| `confirmed` | Confirmado | `#E2EBF4` | `#1F4B75` |
| `preparing` | En preparación | `#ECE5F2` | `#5A3C82` |
| `shipped` | Enviado | `#DCEFEC` | `#1C5C55` |
| `delivered` | Entregado | `#E1EFDF` | `#2A5F2E` |
| `cancelled` | Cancelado | `#ECEBE7` | `#5C5952` |
| pago `pending` | Sin pagar | `#F5EAD3` | `#7A4A00` |
| pago `partial` | Pago parcial | `#F7E4D6` | `#8A3C0C` |
| pago `paid` | Pagado | `#E1EFDF` | `#2A5F2E` |
| pago `refunded` | Reintegrado | `#ECEBE7` | `#5C5952` |
| producto `draft` / `active` / `archived` | Borrador / Activo / Archivado | `#ECEBE7` / `#E1EFDF` / `#ECEBE7` | `#5C5952` / `#2A5F2E` / `#5C5952` |
| stock bajo / sin stock | Stock bajo / Sin stock | `#F5EAD3` / `#F8E1DE` | `#7A4A00` / `#9B2218` |

### 7.8 Dashboard

- Arriba, **una** franja `--adm-surface` con 4 métricas separadas por reglas verticales: etiqueta 12px muted ("Ventas hoy", "Pedidos por confirmar", "Ticket promedio 7 días", "Por cobrar") + número 28px/600 `tabular-nums` + delta 12px muted ("+12 % vs. semana anterior"). Sin íconos ni fondos de color; el delta se colorea sólo si es alerta (`--adm-warning`).
- Debajo, 8/4: "Pedidos que requieren acción" (tabla: por confirmar, pagos sin acreditar, para despachar) y "Stock bajo" (lista con cantidad y link a inventario).
- Gráfico opcional "Ventas de los últimos 30 días": barras verticales `--adm-fg` al 80 %, hoy en `--adm-accent`, 3 líneas guía `--adm-border`, sin gradiente ni animación, tooltip con monto exacto. Nada de áreas, donuts ni radar.

### 7.9 Empty states

Dentro del panel de la tabla, alineado a la izquierda, padding 32px: título 16px ("Todavía no hay pedidos"), una línea útil ("Cuando alguien compre en tu tienda lo vas a ver acá. También podés cargar uno a mano.") y acción primaria ("Crear pedido manual") + secundaria ("Ver la tienda"). Con filtros sin resultados: "No hay pedidos con estos filtros." + "Limpiar filtros".

### 7.10 Command palette

Ctrl K / ⌘K. 640px de ancho, a 15vh del borde superior, `--adm-surface`, radio 6px, `--adm-shadow`. Input 44px sin borde: "Buscar pedidos, productos o ir a…". Resultados agrupados ("Ir a", "Acciones", "Pedidos", "Productos") con títulos 11px uppercase muted; filas 36px con ícono 16px, texto 14px y `Kbd` a la derecha; activa con `--adm-surface-2`. "#1043" abre ese pedido. 100 % teclado; Esc cierra y devuelve el foco.

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
12. [ ] Sin lorem ipsum, sin reseñas inventadas, sin logos de tarjetas ni cuotas.
13. [ ] Íconos lucide 16–20px; `aria-hidden` si decoran, `aria-label` si son el único contenido del botón.
14. [ ] `prefers-reduced-motion` respetado; transiciones ≤ 200 ms (drawers ≤ 280 ms); nada animado al cargar.
15. [ ] Formularios: label real arriba, `autocomplete`, errores junto al campo con `aria-describedby` y `aria-invalid`.
16. [ ] Admin: sólo tokens `--adm-*`; tablas con filas 40px, header sticky, números a la derecha; badges de §7.7 con etiqueta + punto.
17. [ ] Admin: dashboard sin stat cards de colores ni gráficos con gradiente; empty states con acción.
18. [ ] Acciones destructivas con ConfirmDialog y verbo exacto; toasts neutros y en español.
19. [ ] Fuentes: sólo las de §5, máximo 2 familias y 3 archivos por página, `display=swap`.
20. [ ] Lighthouse mobile del storefront: Accesibilidad ≥ 95, CLS < 0.05.
