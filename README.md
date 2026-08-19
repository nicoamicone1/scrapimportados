# Catálogo estático

Catálogo web estático (Next.js App Router + Tailwind, export 100% estático) que
muestra los productos scrapeados del proveedor con **precio Efectivo** y
**Precio web**, ambos con el markup ya aplicado.

## Requisitos

- Node.js 20+ (probado con Node 24)
- npm

Instalación de dependencias:

```bash
npm install
```

## 1. Scrapear los productos

```bash
npm run scrape
```

Genera / actualiza `data/products.json` (contrato documentado en
`data/SCHEMA.md`). Mientras ese archivo no exista, el sitio usa
`data/products.sample.json` (5 productos de ejemplo) y muestra un aviso en la
portada.

## 2. Desarrollo

```bash
npm run dev
```

Abrir http://localhost:3000

Los datos se leen del disco **en build time**, así que después de un `npm run
scrape` hay que reiniciar el server de desarrollo (o rebuildear) para ver los
productos nuevos.

## 3. Rutas

| Ruta                | Qué es                                                              |
| ------------------- | ------------------------------------------------------------------- |
| `/`                 | Portada: grilla de **categorías** (con icono) y sliders horizontales |
| `/productos/`       | Listado completo: buscador, filtros, orden y grilla                  |
| `/producto/<slug>/` | Detalle de producto (una página estática por producto)              |
| `/carrito/`         | Carrito en página completa (mismo contenido que el drawer)          |
| `/search-index.json` | Índice liviano del buscador del header (generado en build)         |

La portada linkea a `/productos/?cat=<slug>` y `/productos/?q=<texto>`; el
listado lee esos parámetros al entrar y los reescribe cuando se cambian los
filtros (`router.replace`, sin scroll), así que **los links son compartibles**.

Los sliders de la portada se configuran en `src/lib/home.ts`
(`HOME_SLIDERS`): cada uno se arma con categorías exactas (`slugs`) o por
prefijo (`slugPrefix`, que es lo que junta todas las de auriculares). Para
agregar otro slider, basta con sumar un objeto al array.

## 3.1 Buscador del header

El input del header abre un **desplegable en vivo**: a partir de 2 caracteres
(con debounce de 150 ms) muestra hasta 8 productos (miniatura, nombre con la
parte que matcheó resaltada, SKU y precio efectivo) más una fila final "Ver
todos los resultados (N)". Enter sin fila seleccionada lleva a
`/productos/?q=…`; se navega con flechas + Enter, se cierra con Esc o con un
click afuera. La búsqueda ignora mayúsculas y acentos, sobre nombre y SKU.

Los datos salen de `/search-index.json`, que genera en build
`src/app/search-index.json/route.ts` a partir de `getSearchIndex()`
(`{ id, slug, name, sku, image, priceEfectivo }`, ~694 items, ~130 KB). Es un
archivo estático que se baja **una sola vez por sesión**, la primera vez que
alguien toca el buscador: por eso no se manda como prop desde el layout (eso
lo duplicaría en las ~700 páginas del export y llevaba `out/` de 88 MB a
447 MB).

El matcher vive en `src/lib/search.ts` y lo reusa el listado de `/productos`,
así que header y listado devuelven exactamente los mismos resultados.

## 3.2 Diseño

El sistema de diseño está en `src/app/globals.css`, como tokens de
`@theme` de Tailwind v4:

- **Marca**: violeta profundo (`brand-50…950`, primario `brand-600 #6535e0`).
  Header con gradiente, botones y links.
- **Acento**: naranja cálido (`accent-50…900`). El precio "Efectivo" usa
  `accent-700 #c23c0c` (5.4:1 sobre blanco) y las barritas de sección
  `accent-500`.
- **Neutros cálidos**: `page #f7f5f2` (fondo), `surface` (tarjetas), `tint`
  (fondo de imágenes), `line` (bordes), `ink` / `ink-soft` / `muted` (texto).
- **Sombras**: `shadow-card` (reposo) y `shadow-lift` (hover / popovers).
  Radios: `rounded-xl` / `rounded-2xl`.

Todo con la fuente del sistema (sin `next/font/google`, para que el build
funcione offline).

## 4. Carrito y checkout por WhatsApp

- El carrito es **100% local**: React Context + `localStorage` (clave
  `carrito`, y `carrito-pago` para la forma de pago). No hay backend ni
  checkout online.
- Se agrega desde el botón "Agregar al carrito" de cada tarjeta o desde el
  detalle (con selector de cantidad).
- El ícono del header muestra la cantidad total y abre el **drawer**; el mismo
  contenido está en `/carrito/`.
- El toggle **Forma de pago** (Efectivo | Precio web) cambia los precios
  unitarios y el total que se muestran y se envían.
- "Finalizar compra por WhatsApp" abre `https://wa.me/<telefono>?text=...` en
  una pestaña nueva, con el pedido armado:

```
Hola! Quiero hacer este pedido:
• 2x Auricular Bluetooth F-35 (SKU 01020345) — $ 11.556 c/u = $ 23.112
Forma de pago: Efectivo
Total: $ 23.112
```

Si se completan los campos opcionales de nombre y notas, se agregan al final.

### Cambiar el teléfono de WhatsApp

Está en un solo lugar, `src/lib/config.ts`:

```ts
export const BRAND_NAME = "Catálogo";
export const WHATSAPP_PHONE = "5493816173548";
```

Formato internacional **sin `+`, espacios ni guiones** (Argentina:
`54` + `9` + área sin el 0 + número sin el 15). Después, `npm run build`.
El mismo archivo tiene el nombre de la marca que muestra el header.

## 5. Build / export estático

```bash
npm run build
```

`next.config.ts` usa `output: "export"`, por lo que el build deja el sitio
completo en la carpeta `out/`: HTML por producto, sin necesidad de servidor
Node. Se puede subir tal cual a cualquier hosting estático (Netlify, Vercel,
GitHub Pages, Nginx, un bucket S3, etc.).

Para probar el resultado localmente:

```bash
npx serve out
```

Otros comandos:

```bash
npm run lint   # ESLint (en Next 16 reemplaza a `next lint`)
```

## 6. Fórmula de precios (cambiar porcentajes)

Los precios **se calculan en el scraper**, no en el front. A partir del precio
de lista del proveedor (`prices.price` de la Store API):

```
costoWeb       = lista * (1 + WEB_SURCHARGE)        # valor real comprando por la web  (default +15%)
precioWeb      = round(costoWeb * (1 + MARKUP))     # ganancia                         (default +20%)
precioEfectivo = round(precioWeb * (1 - CASH_DISCOUNT))  # descuento por efectivo      (default -10%)
```

Ejemplo: lista $ 29.900 → costo web $ 34.385 → **Precio web $ 41.262** → **Efectivo $ 37.135**.

Para cambiar cualquiera de los tres porcentajes, pasarlos al scraper y volver a
generar los datos (por flag o por variable de entorno):

```bash
npm run scrape -- --markup=0.25 --web-surcharge=0.15 --cash-discount=0.1
```

```bash
MARKUP=0.25 WEB_SURCHARGE=0.15 CASH_DISCOUNT=0.1 npm run scrape
```

Después, rebuildear (`npm run build`). Los defaults viven en `resolvePricing()`
dentro de `scripts/scrape.mjs`; los valores usados quedan guardados en
`data/products.json` → `pricing`. En el GitHub Action se configuran como
variables del repo (`MARKUP`, `WEB_SURCHARGE`, `CASH_DISCOUNT`).

> El precio `base` (costo del proveedor) **nunca** se muestra ni se serializa al
> HTML público: los Client Components (listado, tarjetas, carrito) reciben sólo
> los precios finales, vía `getCatalogItems()` / `toCatalogItem()` en
> `src/lib/products.ts`. El detalle también proyecta con `toCatalogItem()`
> antes de pasarle el producto al botón de carrito.

## Estructura

```
data/
  SCHEMA.md              contrato de products.json
  products.json          datos reales (generados por el scraper)
  products.sample.json   fallback de ejemplo
scripts/
  scrape.mjs             scraper del proveedor
src/
  app/
    layout.tsx           layout raíz (header sticky + footer + drawer)
    page.tsx             portada: categorías + sliders
    productos/           listado con buscador y filtros
    producto/[slug]/     detalle de producto (generateStaticParams)
    carrito/             carrito en página completa
    search-index.json/   route handler estático: índice del buscador
  components/
    Header.tsx           marca + buscador + botón de carrito con badge
    HeaderSearch.tsx     buscador en vivo del header (desplegable + teclado)
    SectionHeader.tsx    título de sección con barrita de acento
    CatalogClient.tsx    buscador + filtros + orden (Client Component)
    UrlSync.tsx          ?q= / ?cat= <-> filtros (dentro de <Suspense>)
    CategoryGrid.tsx     grilla de categorías con "Ver todas"
    CategoryIcon.tsx     iconos SVG inline elegidos por palabra clave
    ProductSlider.tsx    fila horizontal con scroll-snap y flechas
    ProductCard.tsx      tarjeta de producto
    AddToCartButton.tsx  "Agregar al carrito"
    ProductBuyBox.tsx    cantidad + agregar, en el detalle
    CartDrawer.tsx       slide-over del carrito
    CartView.tsx         items, forma de pago, total y WhatsApp
    PriceBlock.tsx       precios "Efectivo" / "Precio web"
    Gallery.tsx          galería de imágenes del detalle
    ProductImage.tsx     imagen con placeholder si falta o falla
    Footer.tsx           fecha de actualización + disclaimer
  lib/
    products.ts          carga y tipos del catálogo (sólo servidor)
    format.ts            formatARS / formatPrice / formatDateAR / normalizeText
    search.ts            matcher compartido (header + listado) y resaltado
    config.ts            marca + teléfono de WhatsApp
    cart.tsx             estado del carrito + localStorage
    whatsapp.ts          armado del mensaje y de la URL wa.me
    home.ts              configuración de los sliders de la portada
```

## Notas

- Las imágenes se sirven directo desde el proveedor con `<img>` y
  `images.unoptimized: true` (no hay optimizador de imágenes en un export
  estático). Si una URL falla, se muestra un placeholder.
- La búsqueda, los filtros y el orden son 100% del lado del cliente: no hay
  llamadas a ninguna API.
- El carrito se lee de `localStorage` recién en el navegador
  (`useSyncExternalStore`), así que el HTML estático y la hidratación
  coinciden: el badge del header aparece después de hidratar.
- Los productos `variable` se muestran con el prefijo "desde".

## Imágenes

`npm run scrape` también descarga las imágenes del proveedor a `public/img/` (redimensionadas a 800px y convertidas a WebP con `sharp`; ~34 MB para todo el catálogo) y reescribe `image`/`images` con rutas locales. Las URLs originales quedan en `imagesRemote`. El proveedor bloquea hotlinking por Referer, así que servir las imágenes propias es obligatorio.

- Solo datos: `npm run scrape:data`
- Solo imágenes (idempotente, salta las ya bajadas): `npm run scrape:images` (`--force` para rebajar, `--max=1200` para otro tamaño)
