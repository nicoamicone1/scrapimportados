# Auditoría UX/UI: sitio público, cuenta y alta de tienda

> Alcance: `src/app/(platform)/**` y `src/components/platform/*` (salvo `PresetSpecimens` y `specimens`). Fuente de verdad: `docs/BRAND.md` y `docs/MARKETING.md` §0–§5. Fecha: 2026-10-01.
> Prioridad de pendientes: **P0** bloquea conversión o marca · **P1** impacto alto · **P2** pulido.

## Resumen

| Embudo | Antes | Ahora |
| --- | --- | --- |
| Landing → registro | CTA claro, pero el diferencial (sin comisión) aparecía en la 5.ª sección; sin menú en mobile; header no fijo | Sin comisión en la 3.ª banda; header fijo con CTA a un toque; menú mobile; "Lo que hoy no hace" antes del FAQ |
| Registro | 4 controles (nombre, email, contraseña, checkbox de términos) + botón | 3 campos + botón; términos aceptados al crear (aviso junto al botón); contraseña con "Mostrar"; "Paso 1 de 3" |
| Alta de tienda | 3 pasos, 14 campos visibles; WhatsApp opcional en el paso 2 pero obligatorio al final (error y rebote al paso 2) | 2 pasos; 4 decisiones obligatorias (nombre, rubro, WhatsApp, forma de cobro); dirección automática; WhatsApp en cualquier formato; el resto plegado; vista previa en vivo |
| Login → panel | Login → Mis tiendas → "Entrar al panel" | Login → panel (última tienda usada); Mis tiendas sigue en el header |

## Por pantalla

### Landing `/`

| | |
| --- | --- |
| **Objetivo** | Registrarse ("Crear tu tienda gratis"). Secundario: ver la demo. |
| **Bien** | H1 con dolor concreto ("Dejá de pasar precios por privado."), mocks hechos con componentes reales, honestidad sobre tarjeta, recibo con "Comisión de Ecommy $ 0", copy en voseo y sin palabras prohibidas, JSON-LD y metadata completos. |
| **Mal** | (1) El diferencial n.º 1 (sin comisión) estaba en la 5.ª sección, detrás de rubros y features: el que escanea no lo veía. (2) Hero con dos párrafos: la tranquilidad ("14 días, sin tarjeta") estaba arriba del botón y no junto a él. (3) Franja de datos con "Plan Free $ 0" (dato débil). (4) Header no fijo y sin navegación mobile: en 360 px no había forma de llegar a Planes/Ayuda salvo el pie. (5) CTAs de planes "Probar Starter 14 días" eran falsos: toda prueba es de Pro. (6) Ningún aviso de lo que no hace hasta el FAQ (MARKETING §1 pide decirlo sin vueltas). (7) Logo con "e" en texto vivo; display en fuente del sistema (Roboto en Android). |
| **Cambios** | Narrativa: Hero → Cómo funciona → **Sin comisión (única banda tinta)** → Panel/features → Estilos por rubro → Planes → **Lo que hoy no hace** → FAQ → CTA final. Hero con un lead + microcopy bajo el CTA; franja "0 % · 14 días · 10 estilos" en Archivo. CTA secundario "Empezar ahora" al pie de "Cómo funciona". Planes: Pro "Incluido en la prueba" + "Probar Pro 14 días gratis"; Free/Starter "Empezar gratis". Archivo en h1/h2 y cifras. `scroll-mt-20` para el header fijo. Links de texto siempre subrayados y ≥ 44 px en mobile. |
| **Pendientes** | P1: capturas reales del panel (además de mocks) cuando haya datos de beta con permiso. P1: medir LCP mobile con Archivo en el h1 (BRAND §6.1: si empeora > 100 ms, el h1 vuelve al sistema). P2: prueba social real (comercios de la beta) cuando exista, nunca antes. P2: `/alternativa-a-tiendanube` (MARKETING §4). |

### Header y pie (`PlatformChrome`)

| | |
| --- | --- |
| **Objetivo** | Orientar y dejar el CTA siempre a mano. |
| **Mal** | `BrandMark` con "e" `font-bold` del sistema (BRAND §4.1); footer con tile pino armado a mano; sin nav mobile; links del pie de 20 px de alto. |
| **Cambios** | `BrandMark`/`BrandLockup` nuevos en `components/platform/brand.tsx` con `BrandGlyph` (SVG), tile tinta en claro y pino en oscuro, wordmark en Archivo. Header `sticky`; menú mobile con `<details>` (sin JS, 44 px por ítem). Pie con targets de 44 px en mobile. `AppHeader` usa el mismo lockup (sólo tile en < 640 px) y nav con scroll propio para no desbordar a 360 px. |
| **Pendientes** | P2: cerrar el menú mobile al tocar afuera (hoy se cierra al navegar). P2: wordmark como SVG con trazos (`_brand/wordmark.tsx`, BRAND §4.1). |

### Planes `/planes`

| | |
| --- | --- |
| **Objetivo** | Entender que se empieza con Pro gratis y crear la tienda; comparar si hace falta. |
| **Mal** | H1 "Planes" sin mensaje; "Recomendado" en Pro sin decir por qué; CTAs "Probar Starter 14 días" inexactos; tabla comparativa sin encabezados de fila (lectores de pantalla) y en mobile se perdía la columna de nombres al desplazar. |
| **Cambios** | H1 "Empezás con todo. Después elegís." + garantías (sin comisión, precio final, cambio de plan). Pro destacado como "Incluido en la prueba" (`highlightLabel`, default "Recomendado" para `/admin/plan`). Precios en Archivo 32 px `tabular-nums`. Tabla con `caption`, `scope` y primera columna fija. Canonical. |
| **Pendientes** | P1: cargar precios anuales (ya soportado, MARKETING §5.2). P2: un "¿Cuál me conviene?" con 3 preguntas (productos, precios semanales, dominio) que recomiende plan. |

### Registro `/registro`

| | |
| --- | --- |
| **Objetivo** | Cuenta creada en el menor tiempo y seguir directo al alta. |
| **Mal** | Checkbox de términos obligatorio (un control y un error más); sin forma de ver la contraseña (no hay "repetila"); controles de 36 px y texto 14 px (zoom de iOS); panel lateral con slogan genérico y mock con hex sueltos (`admin/AuthLayout`). Sin indicar cuántos pasos faltan. |
| **Cambios** | `AccountShell` propio (logo SVG, banda tinta con datos de MARKETING §0 y recibo "Comisión de Ecommy $ 0"). Términos: aviso "Al crear la cuenta aceptás…" junto al botón y `terms=on` oculto (el server sigue validando). `PasswordInput` con Mostrar/Ocultar. Inputs 44 px / 16 px en mobile, `inputMode`, `autoCapitalize="none"`. "Paso 1 de 3 · Tu cuenta" y botón "Crear cuenta y seguir". Con invitación (`next` fuera del alta) el copy cambia a "Creá tu cuenta". |
| **Pendientes** | **P0 (legal):** validar con el abogado que la aceptación por aviso (sign-in wrap) alcanza; si no, volver al checkbox (es una línea). P1: alta con Google (Supabase OAuth) para saltear contraseña y confirmación de email. P1: si Supabase exige confirmar el email, el embudo se corta en "Revisá tu correo": evaluar crear la tienda antes de confirmar. |

### Ingresar `/login`, nueva contraseña `/auth/reset`

| | |
| --- | --- |
| **Objetivo** | Volver al trabajo. |
| **Mal** | Destino por defecto `/app` (Mis tiendas): un clic extra para quien tiene una sola tienda (el caso común). |
| **Cambios** | Destino por defecto `/admin` (abre la última tienda usada o la primera; sin tiendas, el panel manda al alta). Mostrar contraseña, foco en la contraseña si el email llega precargado, controles táctiles, `FormAlert` sin hex. `robots: noindex` en login. |
| **Pendientes** | P2: link mágico por email como alternativa a la contraseña. |

### Alta de tienda `/app/nueva`

| | |
| --- | --- |
| **Objetivo** | Tienda creada y publicable en el mínimo de pasos (BRAND §1: "la tienda en una tarde"). |
| **Mal** | 3 pasos y ~14 campos visibles (moneda, ciudad, provincia, CBU, titular…) que no hacen falta para recibir el primer pedido. La dirección pedía edición manual siempre visible. "Seguir" fallaba con "Esperá a que verifiquemos la dirección" si el chequeo no había vuelto. WhatsApp opcional en el paso 2, pero "Acordar por WhatsApp" venía activado: el server rechazaba al final y rebotaba al paso 2. El número exigía formato `549…` sin espacios. |
| **Cambios** | **2 pasos.** Paso 1: nombre (la dirección sale sola, se verifica en vivo, "Cambiar" la abre; si está tomada se abre con el error) + rubro con miniatura del estilo. Paso 2: WhatsApp en cualquier formato (normalizado con `toWhatsAppNumber`, muestra "+54 9 381 617-3548"), transferencia con alias y 10 % por defecto; CBU/titular y ciudad/provincia/moneda plegados. Validación del WhatsApp y de "al menos una forma de cobro" antes de enviar. "Seguir" espera la verificación de la dirección en vez de pedir que el usuario espere. Vista previa en desktop: la tienda con su estilo + checklist de lo que ya queda listo. Progreso "Paso 2 de 3" si viene del registro, "Paso 1 de 2" si ya tiene tiendas. Foco al título al cambiar de paso. Borradores viejos (paso 3) se migran al 2. |
| **Pendientes** | P1: tras crear, aterrizar en el checklist de onboarding del panel con "Cargá tu primer producto" como única acción (lado panel, otro agente). P1: si la dirección está tomada, sugerir 2–3 alternativas libres. P2: en mobile la grilla de 11 rubros es larga; probar una lista compacta con miniatura sólo del elegido. |

### Mis tiendas `/app`

| | |
| --- | --- |
| **Objetivo** | Entrar a la tienda correcta o compartir su link. |
| **Mal** | Un "Entrar al panel" pino por tarjeta + "Crear tienda" pino: varios primarios por vista. Compartir el link pedía abrir la tienda y copiar de la barra. Estado vacío con borde punteado y sin acción. |
| **Cambios** | Con una sola tienda, "Entrar al panel" es el primario; con varias, todos secundarios. "Crear otra tienda" secundario con contador "N de 3 tiendas propias". "Copiar link" por tienda publicada (`CopyText`) y dirección clickeable. Estado vacío con título + línea útil + "Crear tu tienda". |
| **Pendientes** | P2: última actividad por tienda (pedidos nuevos) para elegir rápido. |

### Invitación `/invitacion/[token]`

| | |
| --- | --- |
| **Objetivo** | Aceptar y entrar al panel. |
| **Cambios** | `AccountShell` con banda explicativa, títulos en Archivo, CTA de 44 px, `FormAlert`. El registro desde una invitación ya no muestra "Paso 1 de 3" ni empuja a crear tienda. |
| **Pendientes** | — |

### Contacto, ayuda, guías, legales

| | |
| --- | --- |
| **Objetivo** | Resolver dudas sin escribir; si hace falta, escribir con contexto. |
| **Bien** | Contacto con mail + WhatsApp precargado, bloque Business con criterios concretos; ayuda con buscador; legales con índice. |
| **Cambios** | H1 en Archivo (contacto, ayuda, guías, artículos, legales); hex del bloque "Primeros pasos" de ayuda reemplazado por token. |
| **Pendientes** | P2: en artículos de ayuda, CTA contextual al final ("Probalo en tu tienda" → `/registro`). |

### Consola de plataforma `/platform/*`

| | |
| --- | --- |
| **Objetivo** | Operar tiendas y planes (uso interno). |
| **Diagnóstico** | Funcional y denso, como corresponde a una herramienta. Header con el lockup nuevo. Buscador sin botón visible (se envía con Enter) y tabla de 860 px con scroll horizontal en mobile. |
| **Pendientes** | P2: buscador con `SearchInput` y botón; P2: lista en mobile en vez de tabla. |

## Checklist BRAND §13

| # | Ítem | Estado |
| --- | --- | --- |
| 1 | Logo SVG, versión por fondo, resguardo | Cumple en header, pie, cuenta y `AppHeader`. `admin/AuthLayout` (fuera de este alcance) sigue con "e" de texto; el sitio ya no lo usa. |
| 2 | Sólo colores de §5, sin hex nuevos | Cumple en lo tocado: `FormAlert` reemplaza 5 alertas con `#efc6c0`/`#8f1c13`. Los mocks de `LandingMocks` conservan sus tonos de producto (son "fotos" de la tienda de ejemplo). |
| 3 | Ámbar ≤ 5 %, nunca texto en claro | Cumple: eyebrows en `--adm-accent-2-ink`; ámbar sólo en glifo, barra de progreso del alta y eyebrows sobre tinta. |
| 4 | Una acción primaria por vista | Cumple por sección. El header fijo repite el mismo CTA ("Crear tu tienda gratis") que el hero: misma acción, no compite. |
| 5 | Contraste | Cumple: links pino subrayados; texto muted ≥ 4,5:1; inputs con `--adm-input-border`. |
| 6 | Tipografía | Archivo (`next/font`, `--font-archivo`) sólo en h1/h2, cifras de planes, franja del hero y wordmark; texto en el sistema; `tabular-nums` en precios, pasos y direcciones. |
| 7 | Radios y sombras | Cumple; sólo el menú mobile (capa superpuesta) lleva `shadow-adm`. |
| 8 | Íconos lucide 16/20, trazo 1,5 | Cumple en lo tocado (1,75 dentro de botones). |
| 9 | Producto real o mock real | Cumple: vista previa del alta con `PresetThumb` real. |
| 10 | Copy | Voseo, verbo + objeto, sin palabras prohibidas ni emojis. |
| 11 | Afirmaciones = MARKETING §0 | Cumple: "Lo que hoy no hace" sale de MARKETING §1; cero cifras o testimonios. |
| 12 | Estados | Carga (skeleton del alta), vacío con acción (Mis tiendas), error con salida, éxito ("Copiado"). |
| 13 | Movimiento | Sólo hover/foco 120 ms y progreso 280 ms; nada al cargar. |
| 14 | 360 px | Header con menú, controles 44 px y texto 16 px en formularios, acciones de alta apiladas. |
| 15 | Storefront sin Ecommy | No aplica a este alcance. |
