# Ecommy: manual de marca

> **Identidad 2026-10 (v0.9).** Reemplaza a la paleta pino + ámbar + crema y a las reglas de "sin pastillas, sin animación al scrollear". Qué cambió y por qué: la paleta anterior (verde bosque, ámbar, crema) es la combinación que hoy entrega cualquier generador; la plataforma no tenía un gesto propio y la landing explicaba el producto con texto en vez de mostrarlo. Ahora: **tinta noche + pomelo**, Archivo expandida, **la burbuja** como forma propia, movimiento suave con curva y el producto real (capturas y bloques interactivos) como única ilustración.

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
| **Argentina sin folklore** | Pesos, CUIT, barrios, códigos postales, "transferencia", "retiro en el local". Tipografía de cartel porteña (§6). | Mate, fileteado, celeste y blanco, banderitas, "che boludo". |
| **Honesta** | Dice lo que no hace, muestra pantallas reales, avisa límites antes. |
| **Vital** | Color caliente, curvas, cosas que se mueven con gracia: vender es una actividad alegre. | Infantil, ruidosa, con confeti ni emojis. | Autodespectiva ni defensiva; tampoco promesas vacías ("llevá tu negocio al siguiente nivel"). |
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
| **Glifo "e"** | Trazo, no tipografía. Grilla 100 × 100, recorte `viewBox 16 16 68 68`. Panza: círculo r = 26 centrado en (50, 50). Barra horizontal de x 24 a 76 en y 50. Apertura abajo a la derecha. Trazo 13 (= r/2), extremos rectos. Es el origen de todas las curvas de la marca (§7.2). |
| **Burbuja** | El contenedor del glifo: cuadrado `--eco-pomelo` con tres esquinas al 34 % del lado y la inferior izquierda al 8 % (`bubbleRadii`). Es a la vez el globo del mensaje con el que llega el pedido y la etiqueta de precio. Glifo `--eco-ink` al 58 % del lado, centrado. |
| **Wordmark** | "ecommy" en minúsculas, Archivo expandida 750 (`.eco-display`), color `--eco-ink` (claro) o blanco (sobre tinta). Altura ≈ 72 % del lado de la burbuja. |
| **Lockup horizontal** | Burbuja + wordmark, separación 0,32 × lado, centrado vertical (`BrandLockup`). Es la versión por defecto. |

### 4.2 Versiones

| Fondo | Burbuja | Glifo | Wordmark |
| --- | --- | --- | --- |
| Claro (`--eco-paper`, `--eco-niebla`) | pomelo | tinta | tinta |
| Tinta (sidebar, footer, bandas, placas) | pomelo (no cambia) | tinta | blanco |
| Pomelo (bandas de marca) | tinta | pomelo | tinta |
| Monocromo (sellos, remito impreso) | tinta o negro | blanco | igual color |
| Favicon | burbuja a sangre | tinta | — |
| App icon iOS | cuadrado pomelo (iOS recorta) | tinta | — |

### 4.3 Resguardo, tamaños y animación

- Resguardo: 25 % del lado en los cuatro lados. Mínimos: burbuja sola 16 px; lockup 20 px; glifo suelto 12 px.
- Tamaños de uso: header de landing 32 px; sidebar 28 px; footer 36 px; placas 1080 px → 96–120 px.
- **El logo sí se anima, de una sola manera:** el trazo de la "e" se dibuja (`BrandMark draw`, `.eco-draw`, 1,1 s) al cargar la landing, el login y los estados de espera. Nada de rebotes, giros ni latidos.

### 4.4 Usos incorrectos

No estirar ni rotar · no cambiar la esquina recta de lugar (siempre abajo a la izquierda) · no meter el glifo en un círculo ni en un cuadrado de radios iguales · no usar otro color que pomelo/tinta/blanco · no agregar sombra, brillo ni gradiente · no escribir "ECOMMY" ni "eCommy" · no usar el logo dentro del storefront de un comercio (§12).

---

## 5. Color

**Idea:** un solo color caliente que nadie usa en el rubro (Tiendanube es azul, Mercado Libre amarillo, Shopify verde, WhatsApp verde) sobre una base fría y limpia. El pomelo es la marca; la tinta noche es la estructura; el azul es sólo para interactuar. Los colores de verdad los ponen las tiendas de los clientes: por eso el marco de Ecommy es sobrio y las muestras de tiendas son lo más colorido de cada pantalla.

### 5.1 Paleta

Contraste WCAG 2.x calculado. "AA texto" = ≥ 4,5:1; "AA UI" = ≥ 3:1.

| Token | Hex | Rol | Contraste clave |
| --- | --- | --- | --- |
| `--eco-ink` | `#10162F` | Tinta noche: texto, bandas oscuras, sidebar, footer, **botón primario del panel** | 17,83 blanco · 16,37 niebla |
| `--eco-ink-2` | `#1A2244` | Hover / superficie elevada sobre tinta | — |
| `--eco-ink-3` | `#2A3358` | Bordes y activos sobre tinta | — |
| `--eco-pomelo` | `#FF5A3C` | **El color de la marca**: burbuja del logo, CTA de marca, acentos | tinta encima 5,76 · **blanco encima 3,10: nunca texto blanco chico** |
| `--eco-pomelo-dark` | `#F2472A` | Hover del CTA de marca | — |
| `--eco-pomelo-soft` | `#FFE9E2` | Fondo lavado: banners, selección de marca | pomelo-ink encima 5,60 |
| `--eco-pomelo-ink` | `#B02C14` | Pomelo como texto/ícono sobre claro (eyebrows) | 5,99 niebla |
| `--eco-durazno` | `#FFD3C4` | Formas grandes de marca (arcos, burbujas, bandas) | tinta encima 13,05 |
| `--eco-azul` | `#2F4BFF` | Interacción: links, foco, selección, tab activa | 5,88 blanco · 5,40 niebla |
| `--eco-azul-dark` | `#2238D9` | Hover de links; info | 7,97 blanco |
| `--eco-azul-soft` | `#E8ECFF` | Fondo de selección | azul encima 5,00 |
| `--eco-azul-light` | `#8FA0FF` | Foco y links sobre tinta | 7,34 sobre tinta |
| `--eco-paper` | `#FFFFFF` | Superficies | — |
| `--eco-niebla` | `#F4F5F9` | Fondo de página | — |
| `--eco-niebla-2` | `#EEF0F6` | Superficie 2: buscador, readonly, chips | — |
| `--eco-line` | `#DFE2EC` | Bordes decorativos | — |
| `--eco-text-muted` | `#5B627A` | Texto secundario | 6,05 blanco · 5,55 niebla |
| `--eco-bruma` | `#9AA3C7` | Texto secundario sobre tinta | 7,16 |
| `--eco-mist` | `#E9ECF8` | Texto sobre tinta | 15,13 |

**Semánticos:** danger `#C01A3F` (carmín azulado, para no confundirse con el pomelo; 6,07 blanco), warning `#9A5B00`, success `#1B7A4B`, info `--eco-azul-dark`. **Tintas de sección del panel:** pedidos pomelo, catálogo azul, marketing magenta `#C2257A`, tienda petróleo `#0F7C80`, sistema gris azulado; no salen del panel.

Los nombres anteriores (`--eco-pine`, `--eco-amber`, `--eco-cream`, `--eco-sand`, `--eco-sage`) quedan como alias y no se usan en código nuevo.

### 5.2 Proporción

| % | Qué | Dónde |
| --- | --- | --- |
| 60 | Claros: paper + niebla | Fondos y superficies |
| 25 | Tinta | Texto, sidebar, footer, bandas oscuras, botones del panel |
| 10 | Pomelo + durazno | CTA de marca, logo, formas grandes, highlights |
| 5 | Azul | Links, foco, selección |

### 5.3 Reglas

- **Pomelo = marca y llamada.** CTA de la landing (siempre con texto tinta), logo, progreso, badge de pedidos nuevos, "empezá por acá". En el panel es acento, no acción: máximo un botón pomelo por pantalla.
- **Tinta = acción en el panel.** El botón primario del panel es tinta con texto blanco: no compite con el pomelo de marca ni se confunde con el carmín de peligro.
- **Azul = interacción.** Links (siempre subrayados dentro de texto), anillo de foco, fila seleccionada, tab activa. Nunca decorativo.
- Pomelo nunca como anillo de foco ni borde de input (se lee como error). Pomelo como texto chico sobre claro: `--eco-pomelo-ink`.
- **Gradientes: sólo entre vecinos de la marca** (pomelo → durazno, tinta → tinta-2) y sólo en formas grandes. Nunca violeta/rosa/cian, nunca en texto ni botones.
- La marca no tiene modo oscuro de página: las superficies oscuras son bandas de tinta.

### 5.4 Tokens

Primitivos `--eco-*` en `:root` (`globals.css`); los semánticos `--adm-*` (`admin.css`) los referencian. La landing y el panel consumen `--adm-*` y, en momentos de marca, `--eco-*` directo (`bg-eco-pomelo`, `text-eco-ink`, `bg-eco-durazno`…). `_brand/glyph.tsx` repite los hex para `next/og`. El storefront no usa ninguno.

---

## 6. Tipografía

### 6.1 Familias

| Uso | Familia | Por qué |
| --- | --- | --- |
| **Display** (wordmark, h1/h2, números grandes, títulos de página del panel) | **Archivo** variable, **expandida y pesada**: `font-stretch: 112 %`, peso 750 (`.eco-display`); números `.eco-num` | Diseñada en Buenos Aires (Omnibus-Type). En ancho normal es neutra; expandida y pesada tiene voz de cartel de vidriera. Es la firma tipográfica. |
| Texto de la landing y del sitio público | Archivo ancho normal 400/500 (`BODY`) | Una sola familia: el sitio se ve igual en Android, iOS y Windows. |
| Texto del panel | Stack del sistema | Herramienta: nitidez nativa. |
| Código, SKU, cupones | `--eco-font-mono` | Distinguir lo que se copia. |

Carga: `src/app/_brand/fonts.ts` (`next/font/google`, ejes `wght` + `wdth`, autohospedada, `display: swap`). La aplican el layout de la plataforma y el del panel.

### 6.2 Escala

| Nivel | Landing | Panel |
| --- | --- | --- |
| Eyebrow | 12 / 600, mayúsculas, tracking 0,1 em, `--eco-pomelo-ink` | — |
| H1 | display 44 → 60 → 76 px, interlínea 0,96, máx. 12–14 ch | display 22–24 px (título de página) |
| H2 | display 32 → 44 px, interlínea 1 | 16 / 600 (panel, dialog) |
| Lead | 19 → 22 px / 400, interlínea 1,35, máx. 36 ch | — |
| Cuerpo | 16–17 px / 400, interlínea 1,6, máx. 60 ch | 14 px / 400 |
| Meta | 13 px | 13 px (tablas), 12 px (ayuda, badges) |
| Número destacado | `.eco-num` 32–64 px | `.eco-num` 28–36 px (métricas) |

Una palabra del titular puede ir resaltada: subrayado con un arco pomelo dibujado (SVG, `.eco-draw`) o dentro de una burbuja pomelo/durazno. Máximo un resaltado por titular. `tabular-nums` en todo precio y cantidad.

---

## 7. Forma y espacio

### 7.1 Radios

| | Landing y sitio público | Panel |
| --- | --- | --- |
| Botones | **Pastilla** (`rounded-full`), 48 px | 10 px (`rounded-adm`), 36 px |
| Inputs | 12 px | 10 px |
| Cards, paneles | 20 px (`rounded-eco-lg`) | 16 px (`rounded-adm-lg`) paneles; 10 px controles; 6 px badges |
| Bandas y capturas grandes | 32 px (`rounded-eco-xl`) | — |

### 7.2 La curva: tres gestos y nada más

1. **La burbuja** (`.eco-bubble`, `.eco-bubble-r`, `.eco-bubble-up`): tres esquinas amplias y una casi recta. Para lo que "habla": el logo, la captura protagonista, la tarjeta destacada (plan recomendado, primer paso del onboarding), los mensajes de WhatsApp de las demos, los tooltips de ayuda. No va en todo: si todo es burbuja, nada lo es.
2. **El arco:** cuartos y medios círculos planos (durazno, pomelo, tinta-2) derivados de la panza de la "e", detrás de capturas y en esquinas de bandas; y arcos de trazo fino (anillos concéntricos) como fondo. Siempre nítidos, nunca difuminados: no son blobs.
3. **La hoja:** las bandas de color son hojas con esquinas de 32 px que se apilan (la banda tinta "entra" sobre la clara con sus esquinas superiores redondeadas). Nada de cortes rectos entre secciones de distinto color.

### 7.3 Espacio y sombra

- Base 4 px. Contenedor de landing `max-w-6xl`/`max-w-7xl`, gutter 16 → 24 px. Ritmo asimétrico (56–120 px).
- Panel: densidad de herramienta (filas 40–44 px, controles 36 px). Las curvas no agregan aire: cambian el radio, no el padding.
- Sombras: suaves y teñidas de tinta (`rgb(16 22 47 / …)`). En la landing, las capturas flotan con sombra amplia y baja opacidad; en el panel, `--adm-shadow-surface` en superficies y `--adm-shadow` en capas.
- Targets táctiles ≥ 44 px.

---

## 8. Imágenes: el producto es la ilustración

- **Todo lo visual es producto real.** Tres niveles, en este orden de preferencia: (1) **bloques interactivos reales**: componentes del producto funcionando dentro de la landing (el cambio de estilo de una tienda en vivo, la suba de precios con vista previa, el pedido que llega por WhatsApp, el mapa de zonas); (2) **capturas reales** del panel y de tiendas reales generadas con `scripts/shots.cjs` (`public/img/platform/…`); (3) mocks construidos con los componentes reales cuando la captura no alcanza.
- Las capturas van en marcos con radio 20–32 px o en burbuja, con sombra amplia, a veces inclinadas 1–2° y superpuestas, sobre un arco durazno. Datos verosímiles en rioplatense; nunca datos de clientes reales sin permiso.
- Nada de stock, renders 3D, ilustraciones de personas, íconos gigantes ni emojis.
- **Íconos:** `lucide-react`, trazo 1,75; 16–20 px. En la landing pueden ir dentro de una burbuja chica durazno/tinta (32–40 px) cuando encabezan un bloque.
- Sin cifras, testimonios ni logos inventados (MARKETING §0).

---

## 9. Movimiento: suave y con curva

El movimiento es parte de la marca: todo entra y responde con una curva de desaceleración larga, y lo que "aparece" hace un rebote corto.

| Token | Valor | Uso |
| --- | --- | --- |
| `--eco-ease-out` | `cubic-bezier(.22,1,.36,1)` | Todo lo que entra o responde |
| `--eco-ease-in-out` | `cubic-bezier(.65,0,.35,1)` | Lo que se desplaza de un lugar a otro, loops |
| `--eco-ease-spring` | `linear(…)` con un rebote de ~16 % | Lo que aparece: burbujas, toasts, checks, badges, la flecha del CTA |
| `--eco-dur-1…4` | 140 / 240 / 420 / 720 ms | hover · popovers · drawers y paneles · entradas grandes |

**Repertorio** (utilidades en `globals.css`; no inventar otras sin sumarlas ahí):

| Qué | Cómo |
| --- | --- |
| Entrada al scrollear | `.eco-reveal`, `.eco-reveal-left/right`, `.eco-reveal-scale`: CSS ligado al scroll (`animation-timeline: view()`), sin JS; sin soporte, el contenido se ve fijo (nunca oculto). Sólo en la landing y el sitio público. |
| Entrada al montar | `.eco-pop` (sube + rebote), escalonado con `--i`. Hero, dialogs, toasts, tarjetas del onboarding. |
| Trazo que se dibuja | `.eco-draw`: el logo, los arcos de resaltado, los checks. |
| Flotación | `.eco-float`: capturas y burbujas decorativas del hero, lenta (7 s) y de 10 px. |
| Marquesina | `.eco-marquee`: rubros, estilos. Se pausa al hover. |
| Hover de CTA | El círculo de la flecha se corre y gira 45° con rebote; el botón no escala (sí `active:scale-[.98]`). |
| Hover de card | Sube 2–4 px y el radio de una esquina cambia (de card a burbuja) en 420 ms. |
| Números | Pueden contar hasta su valor una vez, al entrar en pantalla (≤ 900 ms), sólo en la landing. En el panel los números no cuentan. |
| Panel | Transiciones de 140–240 ms en hover y foco; dialogs y drawers con `--eco-ease-out`; fila que se guarda, parpadeo suave de fondo; barra de progreso pomelo de 3 px. Nada que demore una tarea. |

Reglas: `prefers-reduced-motion: reduce` desactiva todo (regla global). Nada parpadea, nada se mueve en loop cerca de un formulario, ninguna animación bloquea un clic, y el contenido nunca depende de una animación para leerse.

---

## 10. Componentes de marca

| Componente | Regla |
| --- | --- |
| **CTA de marca** (landing, alta) | Pastilla pomelo, texto tinta 600, 48 px, con la flecha en un círculo tinta (`CTA_PRIMARY` + `CTA_ARROW`). **Uno por vista.** Verbo + objeto. |
| CTA secundario (landing) | Pastilla con borde tinta de 2 px (`CTA_SECONDARY`), o link de texto. Sobre tinta: `CTA_GHOST_DARK`. |
| **Botón primario del panel** | Tinta, texto blanco 500, 36 px, radio 10 px. Uno por vista. |
| Secundario / ghost (panel) | Blanco con borde `--adm-input-border` / sin fondo, hover `--eco-niebla-2`. |
| Accent (panel) | Pomelo con texto tinta: "Guardar" de la SaveBar (sobre tinta) y "empezá por acá". Máx. uno por pantalla. |
| Danger | Carmín `--adm-danger`, sólo en confirmaciones con verbo exacto. |
| Links | Azul; dentro de texto, siempre subrayados (2 px, offset 4). |
| Chips y filtros | Pastilla. Seleccionado: tinta con texto blanco, o `--eco-azul-soft` con texto azul. |
| Badges de estado | Pastilla 22 px, punto + etiqueta; el estado nunca sólo por color. |
| Cards | Superficie blanca, radio 16–20 px, borde `--eco-line` o sombra suave (no las dos). La destacada es una burbuja. |
| Formularios | Label arriba 13/500, ayuda 12 px, error reemplaza la ayuda; foco azul. |
| Estados vacíos | Una burbuja durazno chica con el ícono lineal + título + una línea útil + acción primaria. Sin ilustraciones. |
| Toasts | Pastilla tinta con texto claro que entra con rebote; ícono con color semántico. |
| Banners de plan y límites | Fondo `--eco-pomelo-soft`, texto tinta, radio 16 px; número concreto + consecuencia + "Ver planes". |
| SaveBar | Pastilla flotante tinta, centrada abajo: "Cambios sin guardar · Descartar · Guardar" (pomelo). |

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
| Presets | Los pone el comercio (colores, fuentes, logo). Ningún preset usa tinta noche + pomelo como combinación de fábrica, para no parecer "la tienda de Ecommy". | Nunca. |
| Panel | Ecommy (shell, sidebar, tokens `--adm-*`) | Siempre; dentro de la vista previa, el tema de la tienda. |
| Alta de tienda y onboarding | Ecommy alrededor; la miniatura del preset muestra el nombre que escribe el dueño | Shell. |
| Landing, planes, ayuda, guías, OG, redes | Ecommy | Completo. Los muestrarios de presets (`PresetSpecimens`) muestran las marcas de ejemplo con su propia tipografía, no la de Ecommy. |

---

## 13. Checklist de cumplimiento de marca

Para cada interfaz auditada (landing, panel, alta, placas). Marcá cada ítem; si no se cumple, explicá por qué en el reporte.

1. [ ] El logo es `BrandMark`/`BrandTile` (burbuja pomelo + "e" tinta, SVG), con la esquina recta abajo a la izquierda, resguardo del 25 % y ≥ tamaño mínimo.
2. [ ] Sólo colores de §5 vía `--adm-*` / `--eco-*`; cero hex literales nuevos, cero clases de color de Tailwind; gradientes sólo entre vecinos de la marca y en formas grandes.
3. [ ] Pomelo = marca (CTA con texto tinta, nunca texto blanco chico, nunca foco ni borde de input); tinta = botón primario del panel; azul = links, foco y selección.
4. [ ] Exactamente una acción primaria por vista; los CTAs secundarios son secundarios o links.
5. [ ] Contraste: texto ≥ 4,5:1, bordes de input / íconos / foco ≥ 3:1.
6. [ ] Tipografía: display en Archivo expandida (`.eco-display`, `.eco-num`); texto del sitio en Archivo normal; panel en el stack del sistema; `tabular-nums` en todo número.
7. [ ] Forma: pastillas en CTAs y chips; radios 10/16 px en el panel y 20/32 px en la landing; la burbuja sólo en lo que "habla"; arcos nítidos, nunca blobs difuminados ni glass.
8. [ ] Íconos lucide 16–20 px, trazo 1,75.
9. [ ] Imágenes = bloque interactivo real, captura real o mock con componentes reales; ningún render, stock ni ilustración decorativa.
10. [ ] Copy en voseo, verbo + objeto en botones, un dato concreto por frase, sin palabras prohibidas ni emojis ni exclamaciones en serie.
11. [ ] Cada afirmación de producto coincide con el producto de hoy (CHANGELOG + MARKETING §0); cero cifras, testimonios o logos inventados.
12. [ ] Estados cubiertos con el tono de §3.2: carga (skeleton), vacío con acción, error con salida, éxito con Deshacer cuando aplica, límite de plan con número.
13. [ ] Movimiento del repertorio de §9, con las curvas `--eco-ease-*`; el contenido nunca depende de una animación; `prefers-reduced-motion` respetado; en el panel nada demora una tarea.
14. [ ] A 360 px: sin scroll horizontal, targets ≥ 44 px, tareas diarias completas desde el celular.
15. [ ] Storefront y presets: ningún rastro de Ecommy salvo el crédito de §12.
