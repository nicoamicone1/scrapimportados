# Demo de ropa: Luna Indumentaria

> La tienda demo pública de Ecommy (PLAN-GTM §9): vive en **`demo`** (`https://demo.ecommy.app`), la misma dirección del link «Tienda demo» y del CTA de la landing, así que no hay que cambiar variables. Reemplaza a la demo vieja de electro y bazar (catálogo importado de un proveedor), que no le servía a una marca de ropa: necesita ver **talles, colores y stock por variante**.
> «Luna Indumentaria» es una marca **ficticia**: los nombres, precios, alias y dirección son de ejemplo. No la uses para cobrarle a nadie.

## Qué crea

| | |
| --- | --- |
| Tienda | `demo` renombrada a «Luna Indumentaria», rubro moda (preset **Atelier** para el alta) con el **diseño a medida «Luna»**: tema propio con CSS personalizado, logo, favicon, anuncio, menús, imágenes de categoría y portada editorial (ver [Diseño a medida](#diseño-a-medida-luna)) |
| Catálogo | 32 productos en 6 categorías: Remeras (7), Buzos y camperas (6), Pantalones (7), Vestidos (5), Camisas (4), Accesorios (3). Dos son las prendas del pedido de ejemplo de la landing (#1042) |
| Variantes | 253 variantes **color × talle** (S a XL, S a L o 36 a 44; accesorios por color), stock de 0 a 8 por variante: 47 agotadas y 35 con 1 o 2 unidades |
| Para mostrar | «Quedan 2» en **Remera básica de algodón, Negro / M** · precio tachado en 5 productos · **precio por cantidad** en 3 (Remera básica: 3+ a $ 23.500 y 6+ a $ 21.900; Musculosa acanalada: 3+ a $ 21.500; Medias por 3 pares: 3+ a $ 10.500) · **Tapado de paño largo sin stock** en todas sus variantes, para mostrar «¿Querés que te avisemos cuando vuelva?» |
| Cobro | Transferencia con **10 %** de descuento (alias `ALIAS.DE.EJEMPLO`, titular de ejemplo) y «Acordar con el vendedor» por WhatsApp |
| Entrega | Envío **CABA** $ 4.500 (gratis desde $ 120.000, 24 a 48 hs hábiles) y **retiro en el local** («Local de Palermo», dirección de ejemplo) |
| Stock | Aviso de «quedan pocas» desde 3 unidades por variante |
| Imágenes | Una ilustración por color (SVG 4:5: la prenda en plano técnico con el color del talle sobre el fondo de la marca). Al elegir un color, la ficha muestra la suya |
| Plan | Pro activo si corrés el script con un admin de plataforma; si no, los 14 días de Pro del alta |

Archivos: `data/demo-ropa.json` (catálogo + bloque `store` con la configuración y `"design": "luna"`), `scripts/seed-demo-ropa.mts` (`npm run seed`: tienda, configuración, diseño y portada, con `scripts/lib/store-setup.mts`, que comparte con la tienda de prospectas), `scripts/lib/store-replace.mts` (el `--replace`), `scripts/seed-from-json.mts` (catálogo), `scripts/lib/garment-svg.mts` (ilustraciones de producto), `src/lib/showcase/luna/` (tema, CSS y portada del diseño) y `public/demo/luna/` (logo, favicon e ilustraciones).

## Diseño a medida «Luna»

La demo tiene que mostrar **el techo de personalización** de Ecommy: una tienda con identidad propia, no un template. Todo está hecho con lo que un dueño Pro tiene en el panel; no hay nada de la demo hardcodeado en el storefront.

Concepto: **«ropa por fases»**. Un taller chico de Palermo que saca una tirada corta por ciclo lunar (cada ~29,5 días). Las fases ordenan la tienda: luna nueva = lo que viene (cuenta regresiva), creciente = la colección actual (lookbook), llena = lo que más sale, menguante = últimas unidades con descuento.

| Qué | Dónde lo carga un dueño | Archivo |
| --- | --- | --- |
| Tema «Luna» (tinta noche y luz de luna fría, Instrument Serif para títulos) con **CSS personalizado** (hasta 20 KB, plan Pro) | Apariencia → Tema → Personalizado | `src/lib/showcase/luna/theme.ts`, `custom-css.ts` |
| Logo, favicon y banda de anuncio | Apariencia → Marca / Anuncio | `src/lib/showcase/luna/index.ts`, `public/demo/luna/logo.svg`, `favicon.svg` |
| Menús de encabezado (Colección, Remeras, Vestidos, Pantalones, Cómo comprar) y pie | Menús | `src/lib/showcase/luna/index.ts` |
| Imagen de cada categoría (se recorta en arco) | Productos → Categorías | `public/demo/luna/cat-<slug>.svg` |
| Portada de 13 bloques | Páginas → Inicio (constructor) | `src/lib/showcase/luna/home.ts` |
| Ilustración por producto y color | Productos → Imágenes | `scripts/lib/garment-svg.mts` |

La portada, de arriba abajo:

1. **Marquesina chica** (banda noche): 10 % por transferencia, envío gratis en CABA desde $ 120.000, cambios en 30 días y la fecha de la próxima luna nueva.
2. **Portada a sangre** con la escena nocturna (`hero.svg`, `hero-mobile.svg` en el celular): «Una tirada por luna», la fase de hoy arriba y «Ver la colección».
3. **Elegí por prenda**: las 6 categorías en arco con su ilustración.
4. **Llena · lo que más sale**: grilla de destacados con uno protagonista.
5. **La colección de esta luna** (lookbook «Fase 02 · Creciente») con la ilustración editorial y 4 productos nuevos.
6. **Marquesina grande** con las cuatro fases (banda noche).
7. **Luna nueva: próxima tirada**: cuenta regresiva a la **próxima luna nueva real** (calculada con los términos de Meeus, error de minutos). Cuando llega a cero dice «La tirada de luna nueva ya está online».
8. **Hecho en Palermo, de a poco**: imagen y texto del taller.
9. **Menguante · últimas unidades**: carrusel de productos con descuento.
10. **Tres banners**: Remeras, Vestidos, Accesorios.
11. **Reseñas** con una cita grande (banda noche).
12. **Datos de compra**: envío en moto por CABA, retiro en Palermo, transferencia, cambios.
13. **Cómo comprar**: preguntas (las fases, talles, cambios, envíos, pago, arrepentimiento). Es el ancla `/#como-comprar` del menú.

> La cuenta regresiva queda fija en la fecha del día que corriste el seed: después de esa luna nueva muestra el texto de cierre. Para que apunte a la siguiente, volvé a correr el seed (sin `--replace`) o cambiá la fecha desde el constructor.

### Verlo en tu compu antes de sembrar (sólo desarrollo)

Con `npm run dev` y la cookie `ecommy_dev_theme=luna`, `http://localhost:3000/s/demo` se ve **como va a quedar después del seed** (tema, CSS, logo, favicon, anuncio, menús, imágenes de categoría y portada con la fecha de hoy) **sin escribir nada en la base**. En producción la cookie no hace nada (`isLunaDevPreview()` en `src/lib/store/display.ts` exige `NODE_ENV=development` y la tienda `demo`).

En el navegador, con `http://localhost:3000/s/demo` abierto, en la consola (F12):

```js
document.cookie = "ecommy_dev_theme=luna; path=/"; location.reload();
```

Para volver a ver lo que hay en la base: `document.cookie = "ecommy_dev_theme=; path=/; max-age=0"; location.reload();`. Con `?estilo=<preset>` en la URL manda la vista previa por estilo, no la de Luna.

### Re-sembrar la demo que ya está en producción

1. **Primero mergeá y desplegá** (push a `main`): el logo, el favicon y las ilustraciones de categoría y portada son archivos de la app (`public/demo/luna/`) y tienen que estar online antes de que la base apunte a ellos. Las imágenes de categoría se guardan con URL absoluta (`https://www.ecommy.app/demo/luna/cat-<slug>.svg`; otro dominio con `SEED_ASSET_ORIGIN`) porque el formulario de categorías del panel sólo acepta URLs.
2. Mirá el plan en seco (no escribe nada; lista el diseño y los 13 bloques de la portada):

```powershell
npx tsx scripts/seed-demo-ropa.mts --dry-run
```

3. Corré el seed **sin `--replace`** (la demo ya tiene el catálogo de Luna, así que no frena). Con `--force-images` además se regeneran las imágenes de los 32 productos con las ilustraciones nuevas:

```powershell
$env:SEED_EMAIL='tu-mail'; $env:SEED_PASSWORD='tu-clave'; $env:SEED_WHATSAPP='549XXXXXXXXXX'; npx tsx scripts/seed-demo-ropa.mts --force-images
```

Qué hace, en orden: renombra (sin cambios), aplica el tema Luna con su CSS, logo, favicon, anuncio y menús, vuelve a aplicar transferencia, envío y retiro, actualiza los productos por su id del JSON **sin pisar el stock**, con `--force-images` borra las imágenes de cada producto y sube las ilustraciones (las variantes vuelven a apuntar a la imagen de su color), pone la imagen de cada categoría (si el dueño subió una propia, no la pisa) y reescribe la portada con los ids reales de las categorías (borra el borrador de la portada si había uno). Es idempotente: correrlo dos veces deja lo mismo.

- **Sin `--force-images`** se aplican tema, logo, anuncio, menús, imágenes de categoría y portada, pero los productos **conservan las imágenes que ya tienen** (las de «Foto de ejemplo»).
- `--force-images` borra **también las fotos que hayas subido desde el panel** a esos 32 productos. No toca pedidos: los pedidos guardan la URL de la imagen de cada ítem.
- Si un navegador ya había abierto la demo puede mostrar alguna imagen vieja de producto hasta que recargue con Ctrl+F5 (las imágenes se cachean mucho tiempo).
- La tienda cachea 5 minutos: si no ves el cambio, esperá o recargá.
- El CSS personalizado se puede **editar** desde el panel sólo en Pro (`theme.custom_css`): con un admin de plataforma el seed deja la demo en Pro activo.

## Antes de empezar

1. `.env.local` en la raíz con las variables del proyecto que ya usa la app: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y, para que el script imprima el link correcto, `NEXT_PUBLIC_ROOT_DOMAIN`. El script no usa la service-role key.
2. Tu cuenta de **admin de plataforma** (o una dueña o admin de la tienda `demo`; con la de plataforma, el script además deja la demo en Pro activo). `demo` es una dirección reservada, así que el script no la crea: la creó la migración 0011 y ya existe en producción.
3. Migraciones aplicadas hasta la 0021 como mínimo (precios por cantidad; sin ella los productos se cargan igual, sin tramos, y el script avisa). La 0016 es la de «Avisame cuando vuelva».
4. Tu WhatsApp en formato internacional sin `+`, sin 0 y sin 15 (ej. `5491122334455`): es adonde llegan los pedidos de la demo. Sin `SEED_WHATSAPP` queda el número que ya tenía `demo` (o el placeholder `5491100000000` si no tenía) y el paso 5 de abajo puede no llegarte a vos.

## Comando

Primero en seco. Valida el JSON con los mismos schemas del panel y lista todo lo que crearía, sin escribir nada:

```powershell
npx tsx scripts/seed-demo-ropa.mts --dry-run --replace
```

Sin credenciales no se conecta a la base: dice qué borraría `--replace`, pero no cuántos productos hay. Con `SEED_EMAIL` y `SEED_PASSWORD` el mismo comando se conecta **sólo para leer** y lista los números reales (productos que se borran y cuáles se archivan por tener pedidos, variantes, imágenes, categorías, archivos del bucket, páginas, promociones, zonas y medios de pago que se desactivan):

```powershell
$env:SEED_EMAIL='tu-mail'; $env:SEED_PASSWORD='tu-clave'; npx tsx scripts/seed-demo-ropa.mts --dry-run --replace
```

Después, de verdad, **una sola vez**:

```powershell
$env:SEED_EMAIL='tu-mail'; $env:SEED_PASSWORD='tu-clave'; $env:SEED_WHATSAPP='549XXXXXXXXXX'; npx tsx scripts/seed-demo-ropa.mts --replace
```

Muestra el mismo resumen y pide que escribas `demo` para seguir (sin terminal interactiva, `--yes`). La respuesta va **al script**, cuando la pregunta aparece; el `--dry-run` no pregunta nada.

Con el catálogo de electro, el `--replace` (y el `--dry-run --replace` con credenciales) tardó unos **5 minutos** en mostrar el resumen: lista el bucket carpeta por carpeta (700 carpetas de producto). No está colgado.

En **PowerShell** la sintaxis `VAR=valor comando` no existe y `npm run seed -- …` puede perder el `--`. Usá:

```powershell
$env:SEED_EMAIL="tu-mail"; $env:SEED_PASSWORD="tu-clave"; $env:SEED_WHATSAPP="549XXXXXXXXXX"
npx tsx scripts/seed-demo-ropa.mts --dry-run --replace
npx tsx scripts/seed-demo-ropa.mts --replace
Remove-Item Env:SEED_PASSWORD
```

> **Hecho en producción el 2026-10-11**: 689 productos, 70 categorías y 789 archivos borrados; 11 productos con pedidos archivados; 32 productos, 253 variantes y 72 imágenes de ejemplo sembrados. Re-correrlo sin `--replace` es idempotente.

> **`--replace` borra el catálogo de electro y no se puede deshacer.** Antes de sembrar: borra todos los productos de `demo` con sus variantes, imágenes, categorías y movimientos de stock (los que tienen pedidos se **archivan**, como pide el panel, para no perder el historial: quedan ocultos y con el slug `…-archivado-…`), borra los archivos del bucket `media/<store_id>/` salvo `receipts/` (comprobantes de pedidos; las miniaturas de los pedidos viejos quedan sin foto), vuelve nombre, bajada, SEO, anuncio, redes, logo, encabezado y pie, políticas, datos fiscales y cuenta de transferencia a los de una tienda nueva, pone los menús y la portada de fábrica, pasa las otras páginas a borrador, desactiva promociones, zonas de envío, retiros y medios de pago que no son del JSON y borra las redirecciones. No toca pedidos, clientes, cupones, equipo, plan, dominio ni el mail y teléfono de contacto. El catálogo de electro queda sólo en el historial de git (`data/products.json`, borrado del repo junto con su scraper).

| Variable | Obligatoria | Qué es |
| --- | --- | --- |
| `SEED_EMAIL` | Sí | Mail de tu cuenta de admin de plataforma (o dueña o admin de `demo`) |
| `SEED_PASSWORD` | Sí | Su contraseña. No la guardes en archivos del repo |
| `SEED_WHATSAPP` | Recomendada | Tu WhatsApp para recibir los pedidos de la demo. Sin esto no se pisa el que ya tenga la tienda (si no tiene, queda el placeholder) |
| `SEED_STORE` | No | Otro slug (default `demo`). Si no existe, la crea con `create_store()` |
| `SEED_FILE` | No | Otro catálogo con el mismo formato y bloque `store` (default `data/demo-ropa.json`) |
| `SEED_ASSET_ORIGIN` | No | Dominio de las imágenes de categoría del diseño (default `https://www.ecommy.app`) |

Flags: `--dry-run` (no escribe), `--replace` (borra el catálogo anterior, ver arriba), `--yes` (sin la confirmación de `--replace`), `--force-images` (borra **todas** las imágenes de los 32 productos, incluidas fotos que hayas subido, y vuelve a generar las ilustraciones).

Sin `--replace`, si la tienda tiene productos (no archivados) que no son del JSON, el script **frena sin tocar nada** y te dice cuántos son. Re-correrlo sobre la demo ya sembrada es idempotente: renombra la tienda, vuelve a aplicar el diseño (o el preset si el JSON no trae `design`), transferencia, envío y retiro, imágenes de categoría y portada; los productos se actualizan por su id del JSON, el **stock de las variantes existentes no se pisa** y las imágenes que ya tenga un producto tampoco. Para ver los cambios puede tardar hasta 5 minutos (caché de la tienda).

Al terminar imprime el link de la tienda y el de la ficha para la demo: `https://demo.<dominio>` (en modo sin subdominios, `https://<dominio>/s/demo`).

## Qué verificar en el celular

Hacelo una vez antes de cada demo, en el orden del guion (PLAN-GTM §9, GUION-DEMO).

1. **Tienda.** Abrí el link: fondo claro lavanda con bandas noche, títulos en Instrument Serif, el logo de Luna, la banda «Ropa por fases…» y la marquesina con el 10 % por transferencia. La portada abre con la escena nocturna y la cuenta regresiva apunta a la próxima luna nueva. En el catálogo, las tarjetas muestran el precio por transferencia y el Tapado aparece al final, sin stock.
2. **Ficha con talles y «quedan 2».** Remera básica de algodón → Color **Negro** → Talle **M**: dice «Quedan 2» y la imagen pasa a la negra. Probá **Negro / L**: «Negro / L sin stock», el formulario «¿Querés que te avisemos cuando vuelva?» y «Consultar por WhatsApp». Más abajo, la tabla de precio por cantidad (desde 3 unidades).
3. **«Avisame cuando vuelva».** Tapado de paño largo: «Sin stock» en todos los talles y el formulario de aviso. Dejá un mail y fijate que aparece en el panel, Inventario → Avisos.
4. **Checkout por transferencia.** Agregá Negro / M al carrito → «Iniciar compra» → datos de prueba con dirección en CABA (envío $ 4.500) o retiro en el local («Retirás en Local de Palermo») → **Transferencia bancaria** (se ve el 10 % de descuento) → confirmar.
5. **Pedido llegando a WhatsApp.** En la página del pedido tocá «Enviar comprobante por WhatsApp»: se abre el chat con el número de `SEED_WHATSAPP` con el pedido armado (número, ítems con color y talle, total, entrega). Hacelo desde otro celular para que se vea como llega; desde el tuyo, WhatsApp lo abre en el chat con vos mismo.
6. **Hoy con «1 por confirmar».** Entrá al panel con `SEED_EMAIL`, tienda Luna Indumentaria: en Hoy aparece «1 por confirmar» con «Confirmar pago». En Inventario, Remera básica Negro / M bajó de 2 a 1.
7. **Responder con «¿tenés la negra en M?».** Panel → Responder → buscá **«remera básica»** (busca por nombre o SKU, no por color: «negra» sola no encuentra nada) → elegí Negro / M → copiá la respuesta con precio, stock y link.

**Después de la demo:** cancelá el pedido de prueba desde el panel; el stock vuelve solo. Si dejaste pasar las 48 horas, se cancela solo.

## Landing apuntando a esta demo

La landing toma la tienda demo de `NEXT_PUBLIC_DEMO_STORE_SLUG`, con default `demo`: como Luna vive en `demo`, no hay que cambiar nada en Vercel. Si alguna vez la definiste en `ropa`, borrala o volvela a `demo`.

## Reemplazar las imágenes de ejemplo

Las ilustraciones son de ejemplo a propósito (una marca real muestra fotos). Para mostrarla con fotos:

1. Panel → Productos → el producto → Imágenes: subí fotos propias o con permiso (nunca de otra marca) y borrá las de ejemplo.
2. En la tabla de variantes, asigná a cada color su foto (la ficha cambia de foto al elegir el color).
3. No corras `--force-images` después: borra también las fotos que subiste.

Para la demo con un prospecto (PLAN-GTM §9) no uses esta tienda: cargá su catálogo con sus fotos en una tienda a su nombre (`docs/DEMO-PROSPECTA.md`: 10 a 15 productos en 20 minutos con `scripts/prospect-store.mts`). Luna sirve para la landing, los videos y la primera conversación.
