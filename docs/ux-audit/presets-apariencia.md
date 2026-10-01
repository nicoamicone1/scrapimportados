# Auditoría UX/UI: presets, Apariencia y builder de páginas

Alcance: los 10 presets de tema (`src/lib/theme/presets.ts`), el editor de Apariencia (`/admin/apariencia`), el builder de páginas (`/admin/paginas/[id]`), el storefront en lo que depende del tema y las muestras de presets de la landing (`PresetSpecimens`).
Criterios: `DESIGN.md` §1–§6 (manifiesto, composición, tokens, presets, fuentes, componentes) y `BRAND.md` §11–§13 (principios UX, marca Ecommy ↔ marca del comercio, checklist).
Prioridades: **P0** bloquea o incumple una regla de marca/legal · **P1** fricción real · **P2** pulido.

Cómo leer los "cambios": todo está implementado en el árbol, sin migraciones ni dependencias nuevas. Verificado con `tsc`, `eslint` y `vitest` (`src/lib/theme`, `src/components/admin/appearance`, `src/components/admin/builder`, `specimens.test.ts`, `src/lib/schemas/appearance.test.ts`). No se probó en navegador (no se corrió `next dev`).

---

## 1. Presets

### 1.1 Método

- Contraste WCAG 2.1 calculado con `contrastRatio()` (la misma función que usa el test) sobre **todos** los pares que la tienda realmente pinta, no sólo los que protegía el test: además de texto/muted/acento/éxito/peligro sobre fondo y superficie, `textMuted` y `accent` sobre la banda `secondary` (barra de anuncio, hero sin foto), `primary` sobre `surface` y `secondary` (el botón vive ahí), `--border-strong` (mezcla OKLab 50 %) sobre fondo y superficie (borde de inputs, ≥ 3:1) y `--primary-fg` sobre `--primary-hover`.
- Diferenciación: se compararon los "esqueletos" (layout del header, densidad, columnas, estilo de card, ratio, radio, reglas, sombras) además de color y tipografía. Dos presets con el mismo esqueleto se distinguen sólo si color **y** tipo son de familias distintas.
- Venta: foto protagonista (ratio y fit por rubro), precio legible (tamaño, `tabular-nums`, promo en acento), nombre largo (2 líneas en fuente de cuerpo), CTA (estilo del botón primario y CTA final siempre sólido).

### 1.2 Tabla por preset

Contraste: `fg/bg` texto sobre fondo · `mut` texto secundario sobre fondo / superficie / banda · `acc` precio promo sobre fondo / superficie · `btn` texto del botón sobre primario · `p/bg` primario sobre fondo. Valores después de los cambios.

| Preset | Rubro | Veredicto | Contraste | Problemas encontrados | Cambios |
| --- | --- | --- | --- | --- | --- |
| `atelier` | Moda, joyería, marroquinería, lencería | **Bien.** El más fiel a su rubro: Cormorant + Jost, 4:5 a sangre, cero UI. Logo centrado justificado (moda). | fg/bg 16.4 · mut 5.45 / 4.95 / **4.58** · acc 5.48 / 4.99 · btn 16.4 · p/bg 16.4 | Texto secundario (4.45) y tostado de promo (4.48) **no llegaban a AA sobre la banda secundaria** (anuncio, hero sin foto). | `secondary #E8E1D5 → #EBE4D8`. |
| `mercado` | Artesanías, deco, dietética, mates | **Bien.** Crema + Fraunces + un único gesto redondo (pill sólido). Grano sólo en campañas. | fg/bg 13.9 · mut 5.68 / 6.25 / 4.88 · acc 5.31 / 5.83 · btn 7.33 · p/bg 6.67 | 1:1 en `contain` deja la cerámica ambientada chica (ya documentado en §4.2: usar 4:5). | Ninguno. |
| `nordico` | Electro, hogar, ferretería, importadoras (default) | **Corregido.** En categorías era casi idéntico a `galpon`: mismas 5 columnas compactas, SKU, marca, azul + un rojo, y con `dividers` las cards `bordered` perdían el radio y quedaban como celdas de tabla. | fg/bg 16.3 · mut 5.71 / 6.24 / 5.12 · acc 6.02 / 6.57 · btn 11.5 · p/bg 10.5 | Dos presets con el mismo look de grilla (§1.1 "todo pesa lo mismo"). Doble línea (regla de celda + borde de card). | `effects.dividers: true → false`: tarjetas blancas con borde fino sobre gris (vidriera de electro). La grilla-tabla queda como firma de `galpon`. Test nuevo lo protege. |
| `editorial` | Streetwear, editoriales, bicis, skate | **Bien.** Tres tintas, Barlow Condensed 800, reglas negras. Es el único preset donde el borde negro es intencional. | fg/bg 19.8 · mut 7.00 / 6.25 / 5.38 · acc 5.67 / 5.06 · btn 19.8 · p/bg 19.8 | Rojo sobre amarillo = 4.36:1. Hoy ningún componente pinta acento sobre la banda (el badge va sobre `--bg`), por eso no se cambió el rojo: queda como regla "no usar precio promo sobre la banda". | Ninguno. |
| `neon` | Gaming, periféricos, audio, vinilos | **Bien** (rediseño 09-23). Un solo ámbar para CTA y promo, mono en títulos; glow sólo en el botón primario (permitido por §3.8). | fg/bg 16.2 · mut 7.19 / 6.63 / 5.82 · acc 10.8 / 9.94 · btn 10.4 · p/bg 10.8 | Texto blanco sobre el ámbar daría 1.8:1: el badge usa `--bg` de fondo, correcto; cualquier componente nuevo debe usar `--primary-fg`. | Ninguno. |
| `botica` | Farmacia, perfumería, dermocosmética | **Bien.** Atkinson Hyperlegible a 17 px para público mayor, mono de etiqueta en títulos. | fg/bg 16.0 · mut 6.69 / 6.17 / 5.75 · acc 6.97 / 6.43 · btn 7.84 · p/bg 7.41 | Mismo esqueleto que `recreo` y `mercado` (logo-left, 2/4 cómoda, 1:1); se distingue por color y tipo, alcanza. Títulos de categoría largos en IBM Plex Mono ocupan mucho ancho (P2). | Ninguno. |
| `recreo` | Librería, papelería, juguetería, infantil | **Bien.** Color sin infantilizar (celeste guardapolvo + un mandarina). | fg/bg 15.1 · mut 6.20 / 6.74 / 5.44 · acc 5.52 / 6.00 · btn 6.00 · p/bg 5.52 | El mandarina con texto blanco no llega a 7:1 (sí a AA). | Ninguno. |
| `lapacho` | Mueblería, iluminación, objetos | **Bien.** 16:9 en 1 columna mobile es lo correcto para muebles horizontales. | fg/bg 15.0 · mut 5.89 / 6.76 / 5.15 · acc 5.27 / 6.04 · btn 10.3 · p/bg 9.93 | Botón primario `outline` (se pinta en `--fg`, no en el marrón): "Agregar al carrito" de la ficha es contorno. Elegante, menos vendedor; el CTA final sí es sólido marrón. La muestra de la landing pintaba el contorno en `--primary` (no coincidía con la tienda). | Muestra de la landing corregida (contorno en `--fg`, como `.btn-primary`). P2: medir conversión antes de tocar el preset. |
| `galpon` | Mayoristas, distribuidoras, corralones | **Bien.** Lista de precios: Archivo Narrow en mayúsculas, Plex Sans 15 px tabular, celdas planas con reglas. Ahora es el único con grilla-tabla. | fg/bg 18.1 · mut 7.34 / 6.60 / 6.43 · acc 6.23 / 5.60 · btn 8.76 · p/bg 8.76 | — | Ninguno (lo diferencia el cambio de `nordico`). |
| `bodega` | Vinoteca, gourmet, café | **Bien.** Único con serif en el cuerpo y oscuro cálido (no negro azulado SaaS). | fg/bg 14.9 · mut 7.67 / 7.06 / 6.38 · acc 9.19 / 8.46 · btn 13.6 · p/bg 13.6 | Packshots de distribuidora con fondo blanco quedan como cajas blancas en 3:4 `cover` sobre el fondo oscuro (P2: recomendar fotos recortadas o `1:1`). | Ninguno. |

Además, en los diez: `--border-strong` (inputs) da 3.36–4.14:1 sobre la superficie (cumple 3:1); `primary` ≥ 3:1 sobre superficie y banda; ningún preset usa una fuente prohibida (Inter, Poppins, Montserrat, Roboto, Playfair), gradientes, glass ni radios literales.

### 1.3 Parecidos

| Par | Antes | Ahora |
| --- | --- | --- |
| `nordico` ↔ `galpon` | Mismo look de grilla en categorías (celdas con reglas, 5 columnas, SKU) | Tarjetas sobre gris vs. tabla con reglas sobre blanco |
| `botica` ↔ `recreo` ↔ `mercado` | Mismo esqueleto (logo-left, 2/4, 1:1, cómoda) | Sin cambios: color (verde agua / celeste / crema) y tipo (mono / grotesca / serif blanda) los separan a primera vista |
| `neon` ↔ `bodega` | Los dos oscuros | Sin cambios: grafito + ámbar + mono vs. vino + crema + serif |

### 1.4 Venta (storefront)

| Diagnóstico | Cambio |
| --- | --- |
| El precio de la card estaba en `--text-base` (15 px en `nordico`/`galpon`); §6.1 pide `--text-lg` | `PriceTag` `size="sm"` → `text-lg`. El precio es lo segundo que se lee después de la foto. |
| Banda de sección `background: 'primary'` con un CTA adentro: el botón sólido tenía el mismo color que la banda (se veía como texto suelto) y el hover del contorno pintaba `--primary-fg` sobre `--bg` (blanco sobre crema) | `blocks.css`: dentro de `.blk-bg-primary` el botón se invierte (`--primary-fg` de fondo, `--primary` de texto). |
| Productos con card `bordered`/`elevated` dentro de una banda primaria u oscura: el texto heredaba `--primary-fg` sobre `--surface` (blanco sobre blanco) y el badge de promo quedaba invisible | `themeVars` emite copias fijas (`--theme-fg`, `--theme-fg-muted`, `--theme-accent`, `--theme-border`) y las cards con panel y el badge vuelven a ellas. |
| Nombre de producto: 2 líneas con alto reservado, fuente de cuerpo | Bien, sin cambios. |
| Compra rápida sólo al hover en desktop; en mobile la card lleva a la ficha | Bien (§6.1), sin cambios. |

### 1.5 Crédito "Hecho con Ecommy" (BRAND.md §12)

| Antes | Ahora |
| --- | --- |
| Se mostraba en todos los planes, como texto sin link | Campo nuevo `theme.footer.showCredit` (default `true`; `theme` es jsonb: sin migración). Texto `--text-xs` `--fg-muted` del tema con link a la plataforma. En Apariencia › Pie de página hay un switch: deshabilitado en Free con "Desde Starter lo podés sacar · Ver planes". `saveTheme` lo fuerza a `true` si el plan es Free (`canHideCredit`). No es estilo: cambiarlo no pasa el tema a "Personalizado", `basePresetOf` lo ignora y aplicar o probar un preset lo conserva. |

---

## 2. Apariencia (`/admin/apariencia`)

**Objetivo:** que la tienda se vea como la marca del comercio en minutos, sin romper la legibilidad.

| Diagnóstico | Bien / mal |
| --- | --- |
| Galería con miniaturas fieles (tokens reales), "probar" sin tocar el tema y "aplicar" aparte; búsqueda por rubro, filtro claro/oscuro y "sólo los de mi plan" | Bien. Camino a "mi tienda se ve bien": abrir galería → tocar → Aplicar → Guardar = **4 toques** (+1 confirmación si había un tema personalizado). |
| No usaba el rubro que el dueño eligió en el alta (`stores.onboarding.kind`) | Mal: el preset de su rubro estaba en el lugar 1–10 según el orden fijo. |
| En celular la vista previa queda debajo de la grilla: "probar" cambiaba algo que no se veía | Mal. |
| Contraste: lista pasiva de 8 pares, siempre desplegada, sin forma de arreglar; faltaban acento y error sobre superficie, éxito, texto secundario sobre la banda | Mal: el dueño ve un número rojo y no sabe qué hacer (§11 "error con salida"). |
| Aplicar un preset pisaba todo menos el CSS | Correcto para estilo, pero hubiera pisado decisiones del dueño que no son estilo (crédito). |

**Cambios hechos**

| Cambio | Archivo |
| --- | --- |
| **"Para tu rubro"**: el preset del rubro del alta va primero en la galería, con badge | `apariencia/page.tsx`, `ThemeEditor.tsx`, `PresetGallery.tsx` |
| En pantallas angostas la tarjeta elegida suma "Ver con mis productos", que lleva a la vista previa (respeta `prefers-reduced-motion`) | `PresetGallery.tsx`, `ThemeEditor.tsx` |
| **Contraste con salida**: resumen en una línea ("Todo se lee bien: 12 de 12" o "2 pares no se leen bien"), sólo los que fallan a la vista, cada uno con **Ajustar** y "Ajustar todos". El ajuste cambia sólo la luminosidad en OKLab (mismo tono) hasta el mínimo, contra todos los fondos donde se usa ese color | `ThemeEditor.tsx`, `src/lib/theme/contrast.ts` (+ test) |
| 12 pares controlados (antes 8), los mismos que protege `presets.test.ts` | `contrast.ts` |
| Switch del crédito con regla de plan; `withOwnerChoices()` conserva CSS propio y crédito al aplicar o probar un preset | `ThemeEditor.tsx`, `schemas/appearance.ts`, `apariencia/actions.ts` |

**Pendientes**

| Prioridad | Pendiente |
| --- | --- |
| **P0** | **Crédito al bajar de plan.** Una tienda que lo apagó en Starter/Pro y vuelve a Free (vence la prueba, cancela, no paga) lo sigue teniendo apagado hasta que guarde Apariencia. Para exigirlo al renderizar hace falta saber el plan desde el storefront (anon), y hoy `current_plan()` exige ser miembro y `private.store_plan_code()` no es ejecutable por anon. Requiere migración: `public.store_credit_required(p_store_id uuid) returns boolean` (security definer, `store_is_active` + `private.store_plan_code(...) = 'free'`, `grant execute to anon`), cacheada con el tag de settings; `Footer` muestra el crédito si `showCredit || required`. No se hizo (sin migraciones en esta pasada). Alternativa sin RPC: que el cambio de plan a Free (billing) resetee `theme.footer.showCredit`. |
| P1 | "Color de marca" rápido: un solo color que fije `primary` y elija `primaryText` (blanco u oscuro) y ajuste contraste solo; hoy son 11 campos para un cambio que el 80 % hace una vez. |
| P1 | Al abrir Apariencia por primera vez (tema nunca guardado), abrir directo la galería con el preset del rubro marcado. |
| P2 | La galería carga ~20 familias de Google Fonts al abrirse (las miniaturas); recortar con `text=` como hace la landing. |
| P2 | Títulos largos en mono (`botica`, `neon`): avisar en Tipografía cuando la fuente de títulos es mono y el catálogo tiene categorías largas. |

---

## 3. Páginas y builder (`/admin/paginas`, `/admin/paginas/[id]`)

**Objetivo:** armar la portada y las landings con bloques, ver cómo quedan en el celular y publicar sin errores.

| Diagnóstico | Bien / mal |
| --- | --- |
| Editor a pantalla completa: bloques · vista previa con componentes reales · ajustes; borrador local con recuperación, borrador en servidor, atajos (Ctrl+S, Ctrl+D, Supr), arrastrar con teclado (dnd-kit) | Bien. |
| Paleta "Agregar bloque" agrupada con miniaturas y descripción de una línea | Bien. |
| Tres paneles de ancho fijo (272 + 340 px) también en celular y tablet | **Mal:** a 360 px no entra la vista previa ni los ajustes (scroll horizontal). BRAND §11 "mobile-first". |
| Borrar un bloque pedía confirmación con un texto falso ("recuperalo con Descartar cambios": ese botón no existe) | Mal: §11 "prevenir antes que avisar": lo no destructivo va con Deshacer. |
| Los bloques nuevos traen copy de **otra** tienda ("Empezamos en 2012 con un local chico en Morón", "10 % off con transferencia", "Despachamos en 24 a 48 hs", "Hasta 30 % off en tecnología y hogar") y se podían publicar sin tocar | **Mal:** §1.1 "Lorem ipsum… se publica por error"; acá peor, porque son afirmaciones verosímiles y falsas frente al cliente final. |
| Acciones de fila (ocultar, duplicar, borrar) sólo visibles al hover; botones de 28 px | Mal en táctil (P2). |
| Defaults de padding asimétrico (§2.2), testimonios nacen vacíos | Bien. |

**Cambios hechos**

| Cambio | Archivo |
| --- | --- |
| **Celular y tablet (< lg): un panel por vez** con barra inferior de 48 px ("Bloques (n)", "Vista previa", "Ajustes del bloque" / "Datos de la página"). Elegir un bloque en la lista o en la vista previa, agregar uno, o un error de validación llevan directo a sus ajustes. En desktop no cambia nada | `PageEditor.tsx` |
| **Borrar sin confirmación, con Deshacer** en el aviso (vuelve a su lugar y queda seleccionado); también con Supr | `PageEditor.tsx` |
| **Texto de ejemplo**: la fila del bloque dice "Texto de ejemplo: cambialo" en vez del resumen; al publicar con bloques visibles que lo conservan, diálogo "¿Publicar con texto de ejemplo?" que los nombra, con "Revisar" (lleva al primero) y "Publicar igual". Detecta frases de afirmación (≥ 30 caracteres en título, bajada, texto, HTML, respuestas) de los defaults y de las plantillas; ignora títulos genéricos ("Novedades", "Preguntas frecuentes") y bloques de productos | `example-copy.ts` (+ test), `BlockList.tsx`, `PageEditor.tsx` |

**Pendientes**

| Prioridad | Pendiente |
| --- | --- |
| P1 | Defaults de bloques según el rubro del alta (hoy todos hablan de "cocina, audio y deco"): `src/lib/blocks/defaults.ts` (fuera de mi área) podría recibir el `kind` y elegir copy de ejemplo de su rubro. |
| P1 | La portada que crea `create_store()` (SQL) también trae copy de ejemplo; el aviso de publicar sólo la detecta si coincide con los defaults de TS. Unificar la fuente. |
| P2 | Acciones de fila visibles en táctil (`@media (hover: none)`) y botones de 44 px en < lg. |
| P2 | En celular, abrir la vista previa en modo "Celular" por defecto. |
| P2 | Mover un bloque arriba/abajo con botones en < lg (arrastrar en una lista angosta con el pulgar es impreciso). |

---

## 4. Checklist BRAND §13 (lo que aplica a esta área)

| Ítem | Estado |
| --- | --- |
| 5. Contraste | Presets: todos los pares de §1.2 ≥ 4.5 (texto) / 3 (UI). Editor: los 12 pares con arreglo de un toque. |
| 7. Radios / sombras / sin pills, glass ni blobs | Presets: sin cambios necesarios (el pill de `mercado` es el único gesto redondo, justificado en §4). |
| 10. Copy en voseo, sin inventar | Builder ahora avisa antes de publicar copy de ejemplo con datos de otra tienda. |
| 12. Estados (error con salida, éxito con Deshacer) | Contraste con "Ajustar"; borrar bloque con "Deshacer". |
| 14. 360 px sin scroll horizontal | Builder: un panel por vez en < lg. |
| 15. Storefront sin rastro de Ecommy salvo el crédito | Crédito sólo en la banda legal, con colores del tema, apagable desde Starter (pendiente P0 al bajar de plan). |
