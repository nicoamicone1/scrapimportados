# Ecommy v0 — Especificación maestra

> Documento de referencia OBLIGATORIO para todo agente que trabaje en este repo.
> Si algo no está acá, seguí la convención más cercana y documentá la decisión en tu reporte final.
> Idioma de la UI: **español rioplatense (es-AR)**, voseo ("Agregá", "Guardá"). Comentarios de código en español.

## 0. Qué es Ecommy

Plataforma de e-commerce "white-label" (una tienda por deploy) con:

- **Storefront** público, 100% personalizable en marca (colores, fuentes, radios, estilo de botones/cards, layout de header, densidad).
- **Admin** (`/admin`) para el dueño de la tienda: productos con variantes, inventario avanzado, precios masivos/promos/cupones, pedidos + pagos + seguimiento + dashboard, envíos por polígonos, constructor de páginas y apariencia, scraping manual de catálogos, configuración general, usuarios, changelog.
- **Checkout** sin pasarela: *transferencia bancaria* (muestra datos + descuento configurable) o *acordar con el vendedor* (WhatsApp con el pedido armado). El pedido SIEMPRE queda registrado en la base antes de derivar.

Nombre del producto: **Ecommy**. Versión inicial: **0.0.0** ("v0"). `package.json` → `name: "ecommy"`, `version: "0.0.0"`.

## 1. Stack y decisiones cerradas

| Tema | Decisión |
| --- | --- |
| Framework | Next.js **16.3.1** App Router, React 19.2, TypeScript strict. **Leer `node_modules/next/dist/docs/`** antes de usar APIs (middleware se llama `proxy.ts`; `params`/`searchParams`/`cookies()` son async; `PageProps<"/ruta">` y `LayoutProps<"/ruta">` son tipos globales generados). |
| Render | Se ELIMINA `output: "export"`. App server-rendered (Vercel/Node). Storefront: páginas `export const dynamic = "force-dynamic"` + lecturas envueltas en `unstable_cache` con `tags` (ver §6). NO usar `cacheComponents` / `"use cache"`. |
| Estilos | Tailwind v4 (`@import "tailwindcss"` + `@theme`). Tokens del storefront son **CSS variables** que setea el tema desde la DB (§8). Admin usa su propio set de tokens fijos. |
| Backend | Supabase: Postgres + Auth (email/password) + Storage (bucket público `media`). Cliente: `@supabase/supabase-js` + `@supabase/ssr`. |
| Autorización | RLS en TODAS las tablas. Función SQL `public.is_admin()` (perfil activo con rol owner/admin/staff). Lecturas públicas solo de lo publicado. Sin service-role key en la app (no la tenemos); todo corre como el usuario logueado bajo RLS. |
| Mutaciones | **Server Actions** (`"use server"`) en `src/**/actions.ts`, siempre: (1) `requireAdmin()`; (2) validar con **zod**; (3) escribir; (4) `revalidateTag(...)`; (5) devolver `ActionResult<T>` (§6). Nunca `throw` para errores de negocio. |
| Validación | `zod` v3. Un schema por entidad en `src/lib/schemas/*.ts`, compartido entre form (client) y action (server). |
| Iconos | `lucide-react`. Sin emojis en la UI. |
| Toasts | `sonner`. |
| Fechas | `date-fns` + `date-fns/locale/es`. Zona horaria de la tienda: `store_settings.timezone` (default `America/Argentina/Buenos_Aires`). |
| Dinero | `numeric(12,2)` en DB, `number` en TS. Formateo SOLO vía `formatMoney(value, { currency, locale })` de `src/lib/money.ts` (toma defaults de la tienda). Nunca `toFixed` a mano. |
| IDs | `uuid` (`gen_random_uuid()`). Pedidos además tienen `number` (secuencia desde 1000, se muestra `#1000`). |
| Slugs | `slugify()` de `src/lib/slug.ts` (sin acentos, kebab). Únicos por tabla. |
| Testing | `vitest` para lógica pura (`src/lib/**`): pricing, cupones, polígonos, parser de scraping, bloques. Sin tests de UI. `npm test` debe pasar. |
| Lint/types | `npm run lint` y `npx tsc --noEmit` deben pasar sin errores antes de reportar. |

### Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=https://asudscbvsrmulbpozjmq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_m_RmCVp_ZXWmnt8EE3-nmQ_toZn25GQ
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`.env.local` (gitignored) ya existe con esos valores. `.env.example` documentado en el repo.

### Supabase: aplicar migraciones

Las migraciones viven en `supabase/migrations/NNNN_nombre.sql` (numeración incremental, 4 dígitos). Para aplicarlas al proyecto **usá la herramienta MCP de Supabase** `apply_migration` (project_id `asudscbvsrmulbpozjmq`, `name` = nombre del archivo sin extensión, `query` = contenido del archivo). Si tu entorno no tiene esa herramienta, dejá el archivo escrito y avisá en tu reporte final: el orquestador la aplica. No hay acceso directo a Postgres por password.

Los tipos de la DB se generan con la herramienta MCP `generate_typescript_types` → `src/lib/supabase/database.types.ts` (regenerar después de cada migración propia).

## 2. Estructura de carpetas

```
src/
  proxy.ts                      refresco de sesión Supabase + redirect optimista /admin → /admin/login
  app/
    layout.tsx                  html/body mínimo (sin header) — sólo providers globales
    (store)/                    STOREFRONT (layout con tema, header, footer, carrito)
      layout.tsx
      page.tsx                  home = página del builder con slug "home"
      productos/page.tsx        listado + filtros (?q= &cat= &orden= &precio=)
      producto/[slug]/page.tsx
      categoria/[slug]/page.tsx
      carrito/page.tsx
      checkout/page.tsx
      pedido/[token]/page.tsx   estado del pedido (token secreto, no el id)
      buscar/route.ts           JSON del índice de búsqueda del header
      [slug]/page.tsx           páginas del builder (landing "/ciberlunes", legales, etc.)
    admin/
      login/page.tsx            fuera del layout autenticado
      setup/page.tsx            alta del primer owner (sólo si no hay perfiles)
      (panel)/                  layout autenticado: sidebar + topbar + command palette
        layout.tsx
        page.tsx                dashboard
        productos/...           A
        categorias/...          A
        inventario/...          A
        pedidos/...             B
        clientes/...            B
        precios/...             C (masivo)
        promociones/...         C
        cupones/...             C
        envios/...              D
        apariencia/...          E (tema)
        paginas/...             E (builder)
        menus/...               E
        importar/...            G (scraping)
        configuracion/...       H (tienda, pagos, checkout, SEO, políticas)
        usuarios/...            H
        auditoria/...           H
        changelog/page.tsx      H
    api/                        route handlers (scraping jobs, uploads si hiciera falta)
  components/
    ui/                         primitivas del ADMIN (Button, Input, Select, Textarea, Checkbox, Switch, Badge,
                                Card, Table, Dialog, Drawer, DropdownMenu, Tabs, Tooltip, EmptyState, PageHeader,
                                Field, Toast provider, Skeleton, Kbd, Stat, ConfirmDialog, SearchInput, Pagination)
    admin/                      shell del admin (Sidebar, Topbar, CommandPalette, nav) + compuestos reutilizables
    store/                      componentes del storefront (Header, Footer, ProductCard, PriceTag, Gallery, Cart…)
    blocks/                     un componente por tipo de bloque del builder (render público)
  lib/
    supabase/{client.ts,server.ts,admin-guard.ts,database.types.ts}
    auth.ts                     requireAdmin(), getSession(), getProfile()
    actions.ts                  tipo ActionResult + helpers (ok/fail)
    money.ts  slug.ts  dates.ts  cn.ts
    schemas/                    zod por entidad
    pricing/                    motor de precios puro (promos, cupones, descuento por método de pago)
    shipping/                   resolución de zona (punto-en-polígono, provincias, retiro)
    blocks/                     schema zod de bloques + defaults + registry
    theme/                      schema del tema, presets, cssVars(), fuentes
    store/                      queries de lectura del storefront (con unstable_cache + tags)
    admin/                      queries de lectura del admin
    scraper/                    adaptadores (woocommerce, shopify, genérico) + normalización
    version.ts                  APP_NAME, APP_VERSION, CHANGELOG (fuente única)
    cart.tsx                    carrito (client, localStorage) — items por variante
supabase/migrations/*.sql
scripts/seed-from-json.mts     importa data/products.json (catálogo DAZ) a la DB como productos publicados
docs/                           esta spec + DESIGN.md + FEATURES-AUDIT.md + CHANGELOG.md
```

Alias: `@/` → `src/`. Usar SIEMPRE imports con `@/`.

## 3. Modelo de datos (schema `public`)

Convenciones: `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz` con trigger `set_updated_at()`. Enums como `text` + `check`. Índices en FKs y slugs. Todo con RLS.

### 3.1 Identidad

- **profiles**: `id uuid pk references auth.users`, `email`, `name`, `role text check in ('owner','admin','staff','pending')`, `is_active bool default false`, `last_seen_at`. Trigger `on auth.users insert` → crea perfil; si es el PRIMER perfil → `role='owner', is_active=true`; si no → `role='pending', is_active=false`.
- Función `is_admin()` (security definer, stable): `exists(select 1 from profiles where id = auth.uid() and is_active and role in ('owner','admin','staff'))`. `is_owner()` idem con role='owner'.

### 3.2 Configuración

- **store_settings** (singleton, `id int pk check (id=1)`):
  `name`, `tagline`, `logo_url`, `favicon_url`, `contact_email`, `contact_phone`, `whatsapp_phone` (E.164 sin +), `address`, `currency text default 'ARS'`, `locale text default 'es-AR'`, `timezone`, `social jsonb` ({instagram, facebook, tiktok, x, youtube}), `seo jsonb` ({title, description, og_image_url}), `announcement jsonb` ({enabled, text, href, bg, fg}), `theme jsonb` (§8), `checkout jsonb` (ver abajo), `inventory_policy text check in ('on_order','on_paid') default 'on_order'`, `low_stock_threshold int default 5`, `policies jsonb` ({shipping_md, returns_md, privacy_md, terms_md}), `header jsonb`/`footer jsonb` (layout + links extra), `maintenance jsonb` ({enabled, message}).
  `checkout jsonb`: `{ transfer: { enabled, discount_percent, bank_name, holder, cbu, alias, cuit, instructions_md }, whatsapp: { enabled, message_template }, require_phone, require_address_for_pickup:false, order_notes_enabled, min_order_total }`.
- **menus**: `id`, `handle text unique` ('header','footer'), `items jsonb` (`[{label, href, children:[...]}]`).

### 3.3 Catálogo

- **categories**: `name`, `slug unique`, `description`, `image_url`, `parent_id fk categories`, `position int`, `is_visible bool default true`, `seo jsonb`.
- **products**: `name`, `slug unique`, `description_html text` (rich text saneado), `short_description`, `status text check in ('draft','active','archived') default 'draft'`, `brand`, `tags text[] default '{}'`, `featured bool`, `options jsonb default '[]'` (`[{name:'Color', values:['Rojo','Azul']}]`; vacío = producto simple), `seo jsonb`, `source text check in ('manual','import','scrape') default 'manual'`, `source_url`, `external_id`, `published_at`, `metadata jsonb`.
- **product_images**: `product_id fk cascade`, `url`, `alt`, `position int`, `width`, `height`.
- **product_categories**: `(product_id, category_id) pk`, `position int`.
- **product_variants**: `product_id fk cascade`, `title` ("Rojo / M" o "Default"), `option_values jsonb` (`{"Color":"Rojo","Talle":"M"}`), `sku`, `barcode`, `price numeric(12,2) not null`, `compare_at_price numeric(12,2)`, `cost numeric(12,2)`, `stock int default 0`, `track_inventory bool default true`, `allow_backorder bool default false`, `low_stock_threshold int` (null = usa el global), `weight_grams int`, `image_id fk product_images`, `position int`, `is_active bool default true`. **Todo producto tiene ≥1 variante** (la "Default" cuando no hay opciones). Unique `(product_id, option_values)`.
- **inventory_movements**: `variant_id fk`, `delta int`, `stock_after int`, `reason text check in ('sale','cancel','restock','adjustment','return','import','correction')`, `note`, `order_id fk orders null`, `created_by uuid`. Función `adjust_stock(variant_id, delta, reason, note, order_id)` (security definer; actualiza `stock` y loguea). Nunca hacer `update stock` a mano.

### 3.4 Precios y promociones

- **payment_methods**: `id`, `code text unique` ('transfer','whatsapp'), `name`, `type text check in ('transfer','whatsapp','cash','other')`, `discount_percent numeric(5,2) default 0`, `instructions_md`, `is_active`, `position`. Seed: transfer (10 %), whatsapp (0 %).
- **promotions**: `name`, `type text check in ('percent','fixed','bxgy','nth_unit_percent')`, `value numeric(12,2)`, `config jsonb not null default '{}'` (0017), `scope text check in ('all','categories','products')`, `category_ids uuid[]`, `product_ids uuid[]`, `starts_at`, `ends_at`, `is_active`, `priority int`, `badge_label` ("-20 %", "Ciber Lunes", "3x2"), `stackable bool default false`. Se aplican **al leer** (motor de precios): gana la de mayor `priority`; si `stackable`, se acumulan. Nunca reescriben `price`.
  - **Por unidad** (`percent`, `fixed`): `value` es el % o el monto; `config` queda `{}`. Bajan el precio de la card.
  - **Por cantidad** (se resuelven en el carrito, antes del cupón y del medio de pago; nunca bajan el precio de la card): `bxgy` "Llevá X, pagá Y" con `config = {"buy": X, "pay": Y}` (enteros, 1 ≤ Y < X ≤ 99; `value` = 0); `nth_unit_percent` "N.ª unidad al Z %" con `config = {"nth": N}` (2 ≤ N ≤ 99) y Z en `value` (0 < Z ≤ 100). El check `promotions_config_check` valida los parámetros por tipo. Un tipo desconocido o con parámetros inválidos se ignora (nunca se lee como %).
  - **Agrupado**: todas las unidades del alcance cuentan juntas aunque sean productos distintos. Se ordenan de mayor a menor precio, se arman grupos de X (o N) y en cada grupo se bonifican las X − Y más baratas (o la más barata con Z %). El descuento va a nivel pedido (`orders.bundle_discount`, 0018), no cambia el precio unitario de la línea.
  - **Interacción**: una unidad participa de una sola promo por cantidad (gana la de mayor `priority`; a igual prioridad, la que más ahorra). Con una promo por unidad en la misma línea: si las dos son `stackable`, la de cantidad se calcula sobre el precio ya rebajado; si no, gana la de mayor `priority` y, a igual prioridad, la que más descuenta en ese carrito. Una promo por cantidad que no bonifica ninguna unidad (2 unidades con un 3x2) no se aplica ni le saca nada a la promo por unidad.
- **price_changes**: log de cambios masivos: `batch_id uuid`, `variant_id`, `old_price`, `old_compare_at`, `new_price`, `new_compare_at`, `created_by`. La acción masiva (§C) escribe en `product_variants` y loguea; permite **deshacer** un batch.
- **coupons**: `code text unique` (uppercase), `type text check in ('percent','fixed','free_shipping')`, `value`, `min_subtotal`, `max_uses int`, `uses_count int default 0`, `max_uses_per_customer int`, `starts_at`, `ends_at`, `is_active`, `scope` + `category_ids` + `product_ids` (igual que promos), `first_order_only bool`.
- **coupon_redemptions**: `coupon_id`, `order_id`, `customer_email`.

### 3.5 Clientes y pedidos

- **customers**: `email` (unique, lower), `name`, `phone`, `doc_number`, `default_address jsonb`, `notes`, `orders_count int default 0`, `total_spent numeric(12,2) default 0`, `tags text[]`.
- **orders**: `number bigint unique default nextval('order_number_seq')` (empieza en 1000), `public_token text unique` (32 chars aleatorios; URL `/pedido/[token]`), `customer_id fk`, `customer jsonb` (snapshot: name, email, phone, doc), `status text check in ('pending','confirmed','preparing','shipped','delivered','cancelled') default 'pending'`, `payment_status text check in ('pending','paid','partial','refunded') default 'pending'`, `payment_method_code text`, `payment_discount_percent`, `fulfillment text check in ('delivery','pickup')`, `shipping_zone_id fk null`, `shipping_zone_name`, `shipping_cost numeric(12,2) default 0`, `shipping_address jsonb` ({street, number, floor, city, province, postal_code, notes, lat, lng}), `pickup_location_id fk null`, `subtotal`, `discount_total`, `promo_total`, `coupon_code`, `coupon_discount`, `total`, `currency`, `notes` (cliente), `internal_notes` (admin), `source text check in ('web','manual','whatsapp') default 'web'`, `tracking_carrier`, `tracking_number`, `tracking_url`, `paid_at`, `shipped_at`, `delivered_at`, `cancelled_at`, `cancel_reason`, `whatsapp_sent_at`.
- **order_items**: `order_id fk cascade`, `product_id`, `variant_id`, `name`, `variant_title`, `sku`, `image_url`, `unit_price` (ya con promo), `list_price`, `qty`, `total`.
- **order_events**: `order_id`, `type text` ('created','status_changed','payment_status_changed','payment_added','note','shipped','tracking_updated','whatsapp_opened','stock_adjusted','cancelled'), `message`, `data jsonb`, `created_by uuid null` (null = cliente/sistema), `visible_to_customer bool default false`.
- **order_payments**: `order_id`, `amount`, `method_code`, `reference`, `receipt_url`, `paid_at`, `note`, `created_by`. Trigger recalcula `payment_status` (paid si suma ≥ total, partial si > 0).
- Función `create_order(payload jsonb) returns jsonb` (security definer, ejecutable por `anon`): valida stock, recalcula precios server-side con las mismas reglas del motor TS (para v0: la action de checkout calcula en TS y la función SQL sólo inserta atómicamente + descuenta stock con `adjust_stock` + incrementa cupón). Es la ÚNICA vía de escritura pública.

### 3.6 Envíos

- **shipping_zones**: `name`, `type text check in ('polygon','provinces','postal_prefixes','everywhere')`, `geometry jsonb` (GeoJSON Polygon/MultiPolygon, WGS84), `provinces text[]`, `postal_prefixes text[]`, `cost numeric(12,2)`, `free_over numeric(12,2) null`, `eta_text` ("24 a 48 hs"), `is_active`, `position` (menor = evalúa primero; gana la primera que matchea), `notes`.
- **pickup_locations**: `name`, `address`, `hours_text`, `lat`, `lng`, `is_active`, `instructions_md`.

### 3.7 Contenido

- **pages**: `title`, `slug unique` (reservados: home, productos, producto, categoria, carrito, checkout, pedido, admin, api, buscar, _next), `type text check in ('home','landing','legal','custom')`, `status text check in ('draft','published')`, `blocks jsonb default '[]'` (§9), `seo jsonb`, `published_at`, `show_in_menu bool`. La home es la page con `slug='home'` (no se puede borrar).

### 3.8 Importación / scraping

- **import_jobs**: `source_url`, `adapter text` ('woocommerce','shopify','generic','jsonld'), `status text check in ('queued','running','done','failed','cancelled')`, `options jsonb` ({markup_percent, round_to, import_images, default_status, category_mode, default_category_id, sync_prices, sync_stock}), `stats jsonb` ({found, created, updated, skipped, images, errors}), `log jsonb[]` (últimas 200 líneas), `cursor jsonb` (paginación reanudable), `started_at`, `finished_at`, `error`, `created_by`.
- **import_items**: `job_id`, `external_id`, `name`, `payload jsonb` (normalizado), `status text` ('pending','imported','updated','skipped','error'), `product_id`, `error`.

### 3.9 Sistema

- **audit_log**: `actor_id`, `actor_email`, `action` ('product.create', 'order.status', …), `entity`, `entity_id`, `summary text`, `diff jsonb`. Helper `logAudit()` en `src/lib/audit.ts`; las actions lo llaman.
- **app_meta**: `key text pk`, `value jsonb` (ej. `schema_version`).

### 3.10 RLS (resumen)

- `anon`/`authenticated` (público) SELECT: `store_settings`, `menus`, `categories (is_visible)`, `products (status='active')`, `product_images`, `product_variants (is_active)` de productos activos, `product_categories`, `promotions (is_active)`, `payment_methods (is_active)`, `shipping_zones (is_active)`, `pickup_locations (is_active)`, `pages (status='published')`, `coupons` **NO** (se validan por RPC `validate_coupon(code, subtotal, items)`), `orders` **NO** (se leen por RPC `get_order_by_token(token)`).
- `is_admin()`: ALL en todo.
- `is_owner()`: además puede modificar `profiles` (roles/activar) y `store_settings` sensibles (misma policy que admin en v0; la diferencia se aplica en UI + action).
- Storage bucket `media` público para lectura; INSERT/UPDATE/DELETE sólo `is_admin()`.

## 4. Auth y sesión

- `src/lib/supabase/server.ts`: `createClient()` con cookies (`@supabase/ssr`), patrón oficial de Next App Router.
- `src/lib/supabase/client.ts`: `createBrowserClient()`.
- `src/proxy.ts`: refresca la sesión en cada request y, si la ruta empieza con `/admin` (excepto `/admin/login`, `/admin/setup`) y no hay usuario, redirige a `/admin/login?next=...`. Es chequeo optimista; el layout `(panel)` hace el chequeo real (`getProfile()` activo con rol admin; si `pending` → página "Tu cuenta espera aprobación").
- `requireAdmin()` en `src/lib/auth.ts`: devuelve `{ user, profile }` o lanza `AdminError('unauthorized')`. Toda action lo llama primero.
- Login: `/admin/login` (email + password). "Olvidé mi contraseña" → `resetPasswordForEmail` con redirect a `/admin/login?reset=1`.
- Setup: `/admin/setup` sólo funciona si `select count(*) from profiles = 0` (RPC `has_owner()` pública). Hace `signUp`; el trigger lo vuelve owner.

## 5. Convenciones de código

- Server Components por defecto; `"use client"` sólo donde hay estado/eventos. Los formularios del admin son Client Components que llaman Server Actions con `useActionState` o `startTransition`.
- Un archivo `actions.ts` por sección del admin (ej. `src/app/admin/(panel)/productos/actions.ts`), `"use server"` arriba del archivo.
- Lecturas del admin en `src/lib/admin/<entidad>.ts` (sin cache). Lecturas del storefront en `src/lib/store/<entidad>.ts` con `unstable_cache` y tags.
- Tags de caché: `settings`, `menus`, `products`, `product:<slug>`, `categories`, `promotions`, `pages`, `page:<slug>`, `shipping`, `payment-methods`. Al mutar, `revalidateTag(tag, 'max')` para todos los afectados (los productos afectan `products` y `product:<slug>`).
- `ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string,string[]> }`. Helpers `ok()` / `fail()` en `src/lib/actions.ts`.
- Errores de negocio en español, cortos, sin stack. Errores inesperados: `console.error` + `fail('Algo salió mal. Probá de nuevo.')`.
- Todas las listas del admin: búsqueda, filtros por estado, orden, paginación (`?page=&q=&estado=&orden=`) resueltos en el server; selección múltiple con acciones masivas donde aplica.
- Confirmación (`ConfirmDialog`) para toda acción destructiva; "archivar" antes que borrar en productos.
- Accesibilidad: labels reales, foco visible, `aria-*` en dialogs/menus, contraste AA.
- Sin `any`. Sin `// eslint-disable` salvo justificación en comentario.
- Nada de `console.log` en código final.

## 6. Storefront: datos y caché

- `getSettings()`, `getMenus()`, `getPublishedPage(slug)`, `listProducts(filters)`, `getProduct(slug)`, `listCategories()`, `getActivePromotions()`, `getPaymentMethods()`, `getShippingZones()` — todas en `src/lib/store/*` con `unstable_cache(fn, [key], { tags: [...], revalidate: 300 })`.
- Páginas del storefront: `export const dynamic = "force-dynamic"` (el layout `(store)` lo declara; las páginas heredan).
- El carrito guarda `{ variantId, productId, slug, name, variantTitle, sku, image, unitPrice (lista), qty }`. Los precios finales (promos, descuento por método de pago, cupón, envío) se calculan con el motor `src/lib/pricing` en cliente para mostrar y **se recalculan en el server** en `createOrder`. Si difieren, manda el server.
- El motor de precios es puro y testeado: `computeCart({ items, promotions, coupon, paymentMethod, shipping }) → { lines[], subtotal, promoTotal, couponDiscount, paymentDiscount, shippingCost, total }`.

## 7. Checkout (flujo cerrado)

1. `/carrito` → "Iniciar compra" → `/checkout` (una página, pasos verticales: Datos → Entrega → Pago → Confirmar).
2. Entrega: `delivery` (dirección; se resuelve la zona con `resolveZone(address)`: geocodifica con Nominatim (`https://nominatim.openstreetmap.org/search`, `User-Agent: Ecommy/0.0`) y evalúa polígonos con `@turf/boolean-point-in-polygon`, luego provincias, luego prefijos postales, luego `everywhere`) o `pickup` (elige `pickup_location`). Si ninguna zona matchea → "No llegamos a tu zona todavía" + opción de consultar por WhatsApp (no bloquea si hay método whatsapp).
3. Pago: se listan los `payment_methods` activos. El de transferencia muestra "X % de descuento" y el total recalculado.
4. Confirmar → server action `createOrder` → RPC `create_order` → redirige a `/pedido/[token]`.
5. `/pedido/[token]`: resumen, estado, y según método: **transfer** → datos bancarios + botón "Enviar comprobante por WhatsApp" (wa.me con `#número`); **whatsapp** → botón grande "Abrir WhatsApp" con el pedido armado (número, ítems, total, dirección). El botón se auto-abre al llegar por primera vez si el navegador lo permite (`window.open` desde el click del paso 4; fallback: botón).
6. El cliente puede volver a `/pedido/[token]` y ver la timeline (eventos `visible_to_customer`).

## 8. Tema (apariencia)

`store_settings.theme` (zod en `src/lib/theme/schema.ts`):

```ts
{
  preset: 'atelier' | 'mercado' | 'nordico' | 'editorial' | 'neon' | 'custom',
  colors: { background, surface, text, textMuted, primary, primaryText, secondary, accent, border, success, danger },
  fonts: { heading: GoogleFontId, body: GoogleFontId, headingWeight, bodyWeight, headingTransform: 'none'|'uppercase', headingTracking: 'tight'|'normal'|'wide', baseSize: 15|16|17 },
  radius: 'none' | 'sm' | 'md' | 'lg' | 'full',   // tokens --radius-sm/md/lg/pill derivados
  buttons: { style: 'solid'|'outline'|'soft', shape: 'radius'|'square'|'pill', uppercase: boolean },
  cards: { style: 'flat'|'bordered'|'elevated', imageRatio: '1:1'|'4:5'|'3:4'|'16:9', hover: 'none'|'zoom'|'lift', showSku: boolean, showBrand: boolean },
  header: { layout: 'logo-left'|'logo-center'|'minimal', sticky: boolean, transparentOnHome: boolean, showSearch: boolean },
  layout: { density: 'compact'|'comfortable'|'airy', containerWidth: 'narrow'|'normal'|'wide', gridColumns: { mobile: 2, desktop: 4 } },
  footer: { style: 'simple'|'columns'|'minimal', showSocial: boolean, showPayments: boolean },
  effects: { shadows: 'none'|'soft'|'strong', dividers: boolean, imageFilter: 'none'|'grain'|'mono' },
  custom_css?: string   // opcional, saneado (sin @import ni url(javascript))
}
```

- `cssVars(theme)` → string de `:root{--bg:…;--fg:…;--primary:…;--radius-md:…;--font-heading:…;…}` inyectado en `(store)/layout.tsx` en un `<style>`. Tailwind mapea: `@theme inline { --color-bg: var(--bg); ... }` para poder escribir `bg-bg text-fg bg-primary rounded-md`.
- Fuentes: lista curada en `src/lib/theme/fonts.ts` (~24 Google Fonts con categoría: serif/sans/display/mono) cargadas con `<link>` a Google Fonts (`display=swap`) construido desde el tema. No usar `next/font` (el tema es dinámico).
- Presets con personalidad real (ver `docs/DESIGN.md`): *atelier* (moda elegante: serif alta + sans neutra, blanco roto, negro tinta, radios 0, botones square uppercase), *mercado* (artesanías/feria: fondo cálido, tipografía redondeada, radios grandes, colores terrosos), *nórdico* (minimal frío), *editorial* (grilla y tipografía fuerte), *neón* (oscuro con acento saturado). Cada preset define TODOS los campos.
- El admin de apariencia (E) edita este objeto con **preview en vivo** (iframe del storefront con `?preview=1` que lee el tema del `postMessage`, o render del storefront en un panel) y guarda en `store_settings.theme` → `revalidateTag('settings')`.

## 9. Bloques del builder

`src/lib/blocks/schema.ts` (zod discriminated union por `type`). Todo bloque tiene `id` (nanoid), `type`, `settings` y `style: { background: 'default'|'surface'|'primary'|'custom', customBg?, paddingY: 'none'|'sm'|'md'|'lg', container: 'full'|'normal'|'narrow', hidden?: boolean, hideOnMobile?: boolean }`.

| type | settings |
| --- | --- |
| `hero` | `{ title, subtitle, imageUrl, imageUrlMobile?, overlay: 0-80, align: 'left'|'center', height: 'sm'|'md'|'lg'|'screen', cta: {label, href}, cta2? }` |
| `product_slider` | `{ title, subtitle?, source: {kind:'manual', productIds[]} \| {kind:'category', categoryId, limit} \| {kind:'tag', tag, limit} \| {kind:'newest', limit} \| {kind:'on_sale', limit} \| {kind:'featured', limit}, viewAllHref?, cardsPerView: 2-6 }` |
| `product_grid` | igual a slider + `columns: 2-5`, `rows?` |
| `banner_grid` | `{ columns: 1-4, ratio: '1:1'|'4:5'|'16:9'|'21:9'|'auto', gap: 'none'|'sm'|'md', items: [{ imageUrl, imageUrlMobile?, title?, subtitle?, cta?: {label, href}, href?, align, overlay, textColor: 'light'|'dark' }] }` (items.length puede ser < columns) |
| `rich_text` | `{ html, align, maxWidth: 'narrow'|'normal'|'full' }` (HTML saneado con `sanitizeHtml()` de `src/lib/html.ts`, allowlist) |
| `heading` | `{ text, level: 1-3, align, eyebrow? }` |
| `image_text` | `{ imageUrl, imagePosition: 'left'|'right', title, html, cta? }` |
| `category_list` | `{ title?, categoryIds[] \| 'all', style: 'cards'|'chips'|'circles', columns }` |
| `features` | `{ items: [{ icon: LucideName, title, text }], columns: 2-4 }` |
| `faq` | `{ title?, items: [{ q, a }] }` |
| `countdown` | `{ title, endsAt (ISO), text?, cta? }` |
| `testimonials` | `{ items: [{ quote, author, meta? }] }` |
| `video` | `{ url (youtube/vimeo/mp4), ratio }` |
| `divider` | `{ style: 'line'|'space' , size }` |
| `newsletter`? | NO en v0. |
| `html` | NO (seguridad). |

Render: `src/components/blocks/BlockRenderer.tsx` mapea `type → componente`. Los bloques con productos reciben los productos ya resueltos por el server (`resolveBlockData(blocks)` en `src/lib/blocks/resolve.ts`).

Builder (admin E): lista de bloques ordenable (dnd-kit), panel de settings por bloque (forms tipados), agregar bloque desde una paleta con miniatura, duplicar, ocultar, borrar, **preview** (render real de `BlockRenderer` con el tema actual dentro del admin, responsive toggle mobile/desktop), guardar borrador / publicar. Reutilizable para `home` y para landings (`/ciberlunes`).

## 10. Reparto por agente y propiedad de archivos

| Ag. | Alcance | Carpetas propias |
| --- | --- | --- |
| F | Fundación: migración 0001 completa (§3), RLS, funciones, seed base (settings, payment_methods, page home, menus), clientes Supabase, auth + proxy + login + setup, shell del admin, primitivas `components/ui`, `lib/{money,slug,dates,cn,actions,audit,auth,version}`, `lib/theme/*`, `lib/blocks/schema.ts`, `lib/pricing/*` (motor + tests), `lib/store/*` base, storefront layout mínimo funcional, `scripts/seed-from-json.mts`, vitest, `.env.example`, README nuevo. | todo lo anterior |
| A | Productos, variantes, imágenes, categorías, inventario. | `admin/(panel)/{productos,categorias,inventario}`, `lib/admin/{products,categories,inventory}.ts`, `lib/schemas/{product,category}.ts`, `components/admin/{products,inventory}/*` |
| B | Pedidos, clientes, pagos, timeline, dashboard, pedido manual. | `admin/(panel)/{pedidos,clientes,page.tsx(dashboard)}`, `lib/admin/{orders,customers,dashboard}.ts`, `components/admin/orders/*` |
| C | Precios masivos, promociones, cupones, métodos de pago (config). | `admin/(panel)/{precios,promociones,cupones}`, `lib/admin/pricing.ts`, `lib/schemas/{promotion,coupon}.ts`, extensiones de `lib/pricing` |
| D | Zonas de envío (mapa con polígonos), retiro, resolución de zona, geocoding. | `admin/(panel)/envios`, `lib/shipping/*`, `components/admin/shipping/*` |
| E | Apariencia (editor de tema con preview) + builder de páginas + menús + render de bloques. | `admin/(panel)/{apariencia,paginas,menus}`, `components/blocks/*`, `components/admin/builder/*`, `lib/blocks/{resolve,defaults}.ts` |
| S | Storefront completo: home (page builder), listado, producto (variantes), categoría, carrito, checkout, pedido, búsqueda, SEO, header/footer temables. | `app/(store)/*`, `components/store/*`, `lib/store/*`, `lib/cart.tsx` |
| G | Importador/scraper desde el admin (adaptadores + jobs + UI + re-sync). | `admin/(panel)/importar`, `api/import/*`, `lib/scraper/*` |
| H | Configuración (tienda, checkout/pagos, SEO, políticas, mantenimiento), usuarios/roles, auditoría, changelog, command palette, exportaciones CSV. | `admin/(panel)/{configuracion,usuarios,auditoria,changelog}`, `components/admin/CommandPalette.tsx` |

Archivos **compartidos** (editar con cuidado, releer antes de editar, cambios mínimos): `src/components/admin/nav.ts` (cada agente agrega su entrada en la posición indicada por el comentario), `package.json` (agregar deps con `npm i`, no editar a mano si es posible), `src/lib/supabase/database.types.ts` (regenerar, no editar), `.gitignore`. **No** tocar carpetas de otro agente; si necesitás algo de otro, creá un helper en tu carpeta o pedilo en el reporte.

## 11. Verificación por agente (antes de reportar)

1. `npx tsc --noEmit` sin errores.
2. `npm run lint` sin errores en tus archivos.
3. `npm test` verde.
4. Si tu feature tiene UI: levantá un dev server propio en background con `NEXT_DIST_DIR=.next-<letra> npx next dev -p 31<NN>` (F=3100, A=3101, B=3102, C=3103, D=3104, E=3105, S=3106, G=3107, H=3108) y probá el flujo real (curl para páginas server, y el navegador integrado en una pestaña propia para interacciones). Matá el server al terminar. Credenciales admin de prueba: ver `docs/DEV-ACCESS.md`.
5. Reporte final: qué construiste, decisiones tomadas, qué NO quedó, migraciones creadas (y si las aplicaste), deps agregadas.

## 12. Fuera de alcance v0 (documentar, no construir)

Pasarelas de pago online, emails transaccionales, multi-moneda, multi-tienda, marketplace, facturación electrónica, apps móviles, reviews de clientes, wishlist, cuentas de cliente con login, analytics integrados (sólo dashboard interno), i18n del storefront.

## 13. Addendum: gaps P0 de la auditoría (OBLIGATORIOS en v0)

Fuente: `docs/FEATURES-AUDIT.md` §2 (leerla para el detalle y las fuentes). Resumen de lo que suma cada agente. La migración `0002_audit_gaps.sql` (la escribe el orquestador sobre la 0001) agrega:

- `products.specs jsonb default '[]'` (`[{label, value}]`), `products.related_ids uuid[] default '{}'`, `products.vat_percent numeric(5,2) null`.
- `orders.expires_at timestamptz null`, `orders.seen_at timestamptz null`, `orders.cancel_reason` acepta `'expired'`; `order_events.type` suma `printed`, `withdrawal_requested`, `expired`, `reservation_extended`.
- `store_settings` suma jsonb con defaults: `tax {show_net_price:false, default_vat_percent:21, label:'Precio sin impuestos nacionales'}`, `legal {country:'AR', consumer_defense_link:true, data_fiscal:{image_url:null, href:null}, cuit:null, razon_social:null}`, `integrations {ga4_id, gtm_id, meta_pixel_id, google_site_verification}`, `whatsapp_button {enabled:true, position:'right', message_template, show_on_mobile:true, show_on_desktop:true}`, `free_shipping_bar {enabled:true, threshold:null}`, `catalog {out_of_stock_display:'show_last'}`; `checkout.reservation_hours` (default 48; 0 = nunca vence).
- Tablas `redirects (from_path unique, to_path, hits, created_at)` (lectura pública) y `withdrawal_requests (code unique, order_number, name, contact, reason, status new|processed|rejected, order_id null)`.
- Funciones `expire_unpaid_orders()` (cancela `pending`+`payment_status='pending'` vencidos, devuelve stock con `adjust_stock(...,'cancel')`, evento `expired`), `create_withdrawal_request(payload)` (pública, security definer; agrega evento `withdrawal_requested` si el pedido existe), vista `low_stock_variants`. Índice GIN en `product_variants.option_values`.
- Slugs reservados adicionales: `arrepentimiento`, `politicas`, `sitemap.xml`, `robots.txt`, `feeds`.
- §12 se aclara: quedan fuera los dashboards de tráfico propios; **sí** entra la inyección de GA4/GTM/Pixel por ID con eventos estándar.

Por agente:

| Ag. | Suma |
| --- | --- |
| A | Al cambiar un slug (producto/categoría) insertar en `redirects`. Campos SEO con vista previa Google (componente compartido `components/admin/SeoFields.tsx`, lo crea A y lo reusan E/H). Ficha técnica `specs` (editor de filas). Picker de `related_ids`. Duplicar producto (`{images:boolean}`, borrador, slug `-copia`, sin SKU). Botón "Vista previa" (`/producto/[slug]?preview=1`) y "Ver en la tienda". `vat_percent` por producto (select 0 / 10,5 / 21 / 27 / default). Filtros "Stock bajo" y "Agotado" en inventario. |
| B | Impresión de remito (individual y masiva, `@media print`, QR a `/pedido/[token]`, evento `printed`). Vencimiento: mostrar "Vence en X h", acción "Extender 24 h", barrido perezoso llamando `expire_unpaid_orders()` al cargar listado/dashboard. Badge de pedidos nuevos no vistos (`seen_at`) en sidebar + título de pestaña, polling 60 s. Widget de stock bajo en dashboard. Bandeja de `withdrawal_requests` (`/admin/pedidos/arrepentimientos`) con "Cancelar pedido". Pedido manual. |
| C | `netPrice(final, vatPercent)` y `bestPaymentDiscount(methods)` en `lib/pricing` con tests. |
| E | Toggle `cards.showTransferPrice` y `cards.showNetPrice` en el editor de apariencia (agregarlos al schema del tema). SEO de páginas con `SeoFields`. |
| S | `sitemap.ts`, `robots.ts`. `generateMetadata` con OG/Twitter + JSON-LD (Product/Offer/BreadcrumbList/Organization). Visibilidad de agotados según `catalog.out_of_stock_display`. Filtros facetados por opción/marca/precio/stock en listado y categoría. Relacionados (auto + manual). Vista previa de borrador con barra. Página `/arrepentimiento` (form sin registro → código). Precio neto "PRECIO SIN IMPUESTOS NACIONALES" si `tax.show_net_price`. Footer legal (Defensa del Consumidor, Data Fiscal, botón de arrepentimiento, links a políticas). Scripts GA4/GTM/Pixel con eventos estándar (`lib/store/analytics.ts`). `WhatsAppFab`. "$ X con transferencia" en card/ficha y barra de envío gratis en carrito. `min_order_total` validado en carrito. |
| G | Modo CSV en el importador (`adapter='csv'`): actualizar por SKU (precio, tachado, costo, stock, estado) y crear productos; vista previa con diff y errores por fila; stock vía `adjust_stock('import')`, precios logueados en `price_changes`. |
| H | Redirecciones (lista, alta, baja, importación CSV). Export CSV de productos/variantes/inventario y de pedidos (columnas contables) y clientes. Settings nuevos: `reservation_hours`, `catalog.out_of_stock_display`, `tax`, `legal`, `integrations`, `whatsapp_button`, `free_shipping_bar`. Plantillas legales AR (`lib/legal/templates.ts` con variables `{{store.name}}`) con "Insertar plantilla" en políticas. |

## 14. Addendum v0.1: plataforma multi-tienda (SaaS), planes, deploy, carga y restyling del admin

Ecommy pasa de "una tienda por deploy" a **una plataforma**: cualquier persona se registra, crea su tienda y la administra; los planes de suscripción habilitan o no funcionalidades. Todo lo anterior de esta spec sigue valiendo salvo lo que este addendum cambia.

### 14.1 Modelo multi-tenant

- **`stores`**: `id uuid pk`, `slug text unique` (subdominio; `^[a-z0-9]+(-[a-z0-9]+)*$`, 3-40, reservados: `www, app, admin, api, mail, ecommy, platform, static, cdn`; `demo` es la tienda DAZ), `name`, `owner_id uuid references auth.users`, `status text check in ('active','suspended','deleted') default 'active'`, `custom_domain text unique null`, `custom_domain_verified bool default false`, `next_order_number bigint default 1000`, `onboarding jsonb default '{}'` (pasos completados), `created_at`, `updated_at`.
- **`store_members`**: `(store_id, user_id) pk`, `role text check in ('owner','admin','staff')`, `is_active bool default true`, `invited_by`, `created_at`. `profiles` deja de tener rol global: queda `id, email, name, last_seen_at, is_platform_admin bool default false` (las columnas `role` / `is_active` se eliminan; `is_platform_admin` sólo lo escribe SQL o un superadmin).
- **`plans`**: `code text pk` ('free','starter','pro','business'), `name`, `description`, `price_monthly numeric(12,2)`, `currency`, `position int`, `is_public bool`, `features jsonb` (mapa `feature → true/false`), `limits jsonb` (`{ products: 50, pages: 3, staff: 1, promotions: 1, coupons: 3, import_jobs_month: 0, images_per_product: 3, storage_mb: 200 }`; `null` = ilimitado). Seed: **Free** (50 productos, sólo home en el builder, sin importador, sin promos programadas, 1 usuario, sin CSS custom), **Starter** ($ 14.999/mes: 500 productos, 5 landings, importador CSV, promos/cupones, 3 usuarios), **Pro** ($ 34.999/mes: ilimitado, importador web, precios masivos, CSS custom, dominio propio, 10 usuarios, auditoría/export), **Business** (a medida). Los precios son de ejemplo y se editan desde `/platform`.
- **`subscriptions`**: `id`, `store_id unique`, `plan_code fk plans`, `status text check in ('trialing','active','past_due','cancelled')`, `trial_ends_at`, `current_period_start/end`, `provider text null` ('manual','mercadopago'), `provider_ref`, `notes`. Al crear una tienda: `pro` en **trial de 14 días**; al vencer sin pago → `free` (barrido perezoso `expire_trials()`; las features por encima del plan quedan bloqueadas, los datos no se borran).
- **Feature flags** (`src/lib/plans/features.ts`, fuente única, tipado): `catalog.variants`, `catalog.import_csv`, `catalog.import_web`, `pricing.bulk`, `marketing.promotions`, `marketing.coupons`, `content.landings`, `theme.custom_css`, `theme.all_presets`, `shipping.polygons`, `orders.print`, `orders.export`, `analytics.integrations`, `domain.custom`, `team.members`, `audit.log`. Límites: `products`, `pages`, `staff`, `promotions`, `coupons`, `images_per_product`, `import_jobs_month`. Helpers: `hasFeature(plan, key)`, `limitOf(plan, key)`, `assertFeature(ctx, key)` (lanza `PlanError` → `fail("Esta función está disponible desde el plan Starter")`), `assertLimit(ctx, key, currentCount)`. UI: componente `<PlanGate feature="…">` que renderiza el contenido bloqueado con un candado discreto + "Disponible en Pro · Ver planes" (link a `/admin/plan`), y `<LimitBanner>`.
- **Todas las tablas de tienda** llevan `store_id uuid not null references stores(id) on delete cascade` + índice: `store_settings` (pk pasa a `store_id`; se elimina el check `id = 1`), `menus (unique (store_id, handle))`, `categories (unique (store_id, slug))`, `products (unique (store_id, slug), unique (store_id, source, external_id))`, `product_images`, `product_categories`, `product_variants`, `inventory_movements`, `payment_methods (unique (store_id, code))`, `promotions`, `price_changes`, `price_batches`, `coupons (unique (store_id, code))`, `coupon_redemptions`, `customers (unique (store_id, email))`, `orders (unique (store_id, number))`, `order_items`, `order_events`, `order_payments`, `shipping_zones`, `pickup_locations`, `pages (unique (store_id, slug))`, `page_drafts`, `import_jobs`, `import_items`, `audit_log`, `redirects (unique (store_id, from_path))`, `withdrawal_requests`. `order_number_seq` global se reemplaza por `stores.next_order_number` (asignado con `update … returning` dentro de `create_order`).
- **RLS**: `is_store_member(store_id)` / `is_store_admin(store_id)` (security definer, stable) reemplazan a `is_admin()`. Lectura pública: el storefront pasa el `store_id` en cada query (`.eq("store_id", storeId)`) y las policies públicas exigen sólo "publicado/activo" + tienda `active`. Escritura: `is_store_admin(store_id)`. `profiles.is_platform_admin` puede todo. Storage: objetos en `media/<store_id>/…`; policy: `(storage.foldername(name))[1]::uuid` es una tienda del usuario.
- **Funciones SQL** que cambian de firma: `create_order(payload)` (deriva `store_id` de las variantes, valida que todas sean de la misma tienda, usa `next_order_number`), `get_order_by_token(token)` (sin cambio), `validate_coupon(p_store_id, code, subtotal, items, email)`, `create_withdrawal_request(payload)` (con `store_id`), `hit_redirect(p_store_id, path)`, `adjust_stock` (verifica `is_store_admin` de la variante), `expire_unpaid_orders(p_store_id)`, `admin_*` / `pricing_*` / `inventory_summary` / `reorder_categories` / `undo_price_batch` / `apply_price_changes` (reciben `p_store_id` o lo derivan y verifican membresía), `has_owner()` se elimina. Nueva: **`create_store(name, slug, kind, whatsapp)`** (security definer, para `authenticated`): crea `stores`, `store_members(owner)`, `store_settings` con preset según `kind` (`moda→atelier`, `artesanias→mercado`, `tecnologia→nordico`, `marca→editorial`, `gaming→neon`, otro→nordico), `payment_methods` (transfer 10 %, whatsapp), `menus`, page `home` publicada con bloques de ejemplo (sin productos), `subscriptions` trial pro 14 días. Devuelve `store_id`. Límite: 3 tiendas por usuario. También **`expire_trials()`**, **`current_plan(store_id)`** (jsonb con plan + limits + status), **`platform_stats()`**, **`platform_set_plan(store_id, plan_code, status, trial_ends_at)`** (sólo platform admin).
- **Migración de datos**: `0011_multitenant.sql` crea la tienda `demo` ("Ecommy Demo", owner = admin@ecommy.local) y le asigna TODAS las filas existentes (`update … set store_id = <demo>`), mueve los objetos del bucket a `<demo_id>/…` (update `storage.objects.name` + reescritura de URLs en `product_images.url`, `store_settings.logo_url`, bloques de `pages` (`replace` textual sobre el jsonb)), crea `plans` y `subscriptions(demo → pro activo)`, y marca `is_platform_admin` al admin. La migración es idempotente y se aplica con `apply_migration`.

- **Notas de implementación (0011)**: las tablas hijas (imágenes, variantes, `product_categories`, movimientos, `price_changes`, `coupon_redemptions`, ítems/eventos/pagos de pedidos, `page_drafts`, `import_items`) heredan `store_id` del padre con un trigger (`private.inherit_store_id`), así nunca quedan filas cruzadas; igual los tipos de Insert lo exigen y la app lo pasa. `orders.number` tiene default 0 y un trigger lo toma de `stores.next_order_number` (pedidos manuales). Helpers de RLS: `admin_store_ids()` (miembro activo, usado como initplan `store_id = any((select admin_store_ids())::uuid[])`), `is_store_member`, `is_store_admin` (miembro activo o superadmin), `is_store_owner`, `store_is_active`, `can_manage_media`. Las policies públicas exigen tienda `active`; `stores` expone a anon sólo (id, slug, name, status, custom_domain, custom_domain_verified). Invitaciones: `store_invites` + RPCs `invite_store_member`, `get_store_invite`, `accept_store_invite`. Cron: `run_daily_maintenance()` (sin parámetros, ejecutable por anon: sólo aplica vencimientos que ya correspondían). Objetos del bucket: movidos con `scripts/move-media-to-store.mts` (renombrar `storage.objects` por SQL no mueve el archivo físico). **Criterio de consultas sin `store_id`**: sólo tablas globales (`profiles`, `plans`, `app_meta`) y RPCs que derivan/validan la tienda por su cuenta (`adjust_stock`, `get_order_by_token`); todo INSERT lleva `store_id` (los tipos lo exigen) y todo select/update/delete del admin filtra `.eq("store_id", ctx.store.id)`.

### 14.2 Resolución de tienda (routing)

- Env: `NEXT_PUBLIC_ROOT_DOMAIN` (ej. `ecommy.app`; en Vercel sin dominio propio: `<proyecto>.vercel.app`). El host se clasifica en `src/lib/tenant/resolve.ts`:
  1. `host === ROOT_DOMAIN` o `www.` → **sitio de la plataforma**: `/` landing comercial (planes, CTA "Creá tu tienda gratis"), `/registro`, `/login`, `/planes`, `/app` (mis tiendas + crear), `/admin/*` (panel de la tienda activa), `/platform/*` (superadmin).
  2. `host === <slug>.ROOT_DOMAIN` → **storefront** de esa tienda.
  3. `host` = `custom_domain` verificado de una tienda → storefront.
  4. Fallback de desarrollo/preview (cuando el host no permite subdominios, ej. `*.vercel.app` o `localhost`): el path `/s/<slug>/…` que el proxy **reescribe** a `/…` fijando el header `x-store-slug`. Los links del storefront usan `storePath(path)` de `src/lib/tenant/urls.ts`, que antepone `/s/<slug>` sólo en modo fallback; en subdominio devuelve el path tal cual. `storeUrl(store)` devuelve la URL pública correcta según el modo (para "Ver tienda", remitos, WhatsApp, sitemap).
- `src/proxy.ts`: resuelve el host → headers `x-site: platform|store` y `x-store-slug`, reescribe `/s/<slug>`, y redirige `/admin/*` y `/app/*` sin sesión a `/login`. `getTenant()` (server, `cache()`) lee los headers y devuelve `{ site, store }` (store cargado con `unstable_cache` por slug, tag `store:<slug>`).
- Admin: la **tienda activa** se guarda en cookie `ecommy_admin_store=<store_id>`; `requireAdmin()` devuelve `{ supabase, user, profile, store, membership, plan }` y valida membresía; si no hay cookie → primera tienda del usuario; si el usuario no tiene tiendas → redirect a `/app/nueva`. Selector de tienda en el topbar del admin (si tiene más de una). Todas las lecturas/escrituras del admin filtran por `store.id`. Tags de caché con sufijo: `products:<storeId>`, `settings:<storeId>`, etc. (`tagFor("products", storeId)` en `src/lib/cache-tags.ts`).
- **Estructura de rutas implementada (v0.1)**. Next trata las carpetas `_x` como privadas (no rutean), así que en vez de `_platform`/`_store`:
  - `src/app/(platform)/*` (route group, URLs sin prefijo): `/` landing, `/planes`, `/login`, `/registro`, `/auth/callback`, `/auth/reset`, `/app` (mis tiendas), `/app/nueva` (wizard), `/invitacion/[token]`, `/platform`, `/platform/tiendas/[id]`, `/platform/planes`. Layout propio con los tokens del admin (`.admin-root`).
  - `src/app/admin/*`: el panel (sin mover). `/admin/login` y `/admin/setup` redirigen a `/login` y `/registro`; `/admin/auth/callback` redirige a `/auth/callback`.
  - `src/app/s/[store]/*`: el storefront (ex `(store)`). Es ruta real: en modo fallback la URL pública ES `/s/<slug>/…`; en host de tienda (`<slug>.ROOT_DOMAIN` o dominio propio verificado) el proxy REESCRIBE `/…` → `/s/<slug>/…` (la URL no cambia) y `/admin/*` redirige al admin de la plataforma. `params.store` siempre es el slug. Tienda inexistente o no activa → `src/app/s/not-found.tsx` ("Esta tienda no existe").
  - `robots.ts`/`sitemap.ts` de la raíz son los de la plataforma; cada tienda tiene `s/[store]/sitemap.ts` y `s/[store]/robots.txt/route.ts` (en subdominio el proxy reescribe `/robots.txt` y `/sitemap.xml`).
- **Proxy** (`src/proxy.ts`): `classifyHost(host, ROOT_DOMAIN)` (`src/lib/tenant/host.ts`, puro, con tests) → `platform` | `fallback` (localhost, 127.0.0.1, `*.vercel.app`) | `store` (subdominio; también `<slug>.localhost`) | `custom` (se resuelve `stores.custom_domain` verificado por REST anon, memoizado 60 s). Fija los headers `x-site`, `x-store-slug`, `x-store-base` (`""` en subdominio/dominio, `"/s/<slug>"` en fallback) descartando los que manda el cliente, refresca la sesión de Supabase y redirige `/admin`, `/app`, `/platform` sin sesión a `/login?next=`. `isFallbackMode()` es `true` si `NEXT_PUBLIC_ROOT_DOMAIN` es localhost o termina en `.vercel.app` (o `NEXT_PUBLIC_TENANT_MODE=path`).
- **Links del storefront**: `StoreLink` (`src/components/store/StoreLink.tsx`) reemplaza a `next/link` y aplica `storePath(path, basePath)`; en client, `useStorePath()` (`src/components/store/StoreBase.tsx`); en server, `getTenant()` o `requireStore(params)` (`src/lib/store/context.ts`) dan `{ store, basePath }`. URLs absolutas (SEO, WhatsApp, remitos, QR, "Ver tienda" para compartir): `storeUrl(store, path)`; links desde el admin: `storeHref(store, path)` (relativo en fallback).
- **Carrito** por tienda en localStorage (`ecommy:cart:<storeId>`), porque en fallback todas las tiendas comparten origen.

### 14.3 Registro y onboarding

- `/registro`: nombre, email, contraseña (mín. 8), aceptación de términos → `signUp` con `emailRedirectTo` a `/auth/callback?next=/app/nueva`. Si el proyecto exige confirmación: pantalla "Revisá tu correo" con reenviar. `/login` (+ olvidé contraseña → `/auth/reset`). Google OAuth queda documentado, no implementado. `/admin/login` y `/admin/setup` se eliminan (redirigen a `/login`).
- `/app`: mis tiendas (tarjetas con nombre, slug, plan, estado, "Entrar al panel" (setea la cookie y va a `/admin`), "Ver tienda"), "Crear tienda".
- `/app/nueva` (wizard 3 pasos, cada paso guarda en `localStorage` hasta crear): (1) nombre + slug (auto, disponibilidad en vivo vía action) + rubro (tarjetas con mini-preview del preset: moda, artesanías/deco, tecnología/hogar, marca con actitud, gaming, otro); (2) WhatsApp, ciudad/provincia, moneda; (3) "¿Cómo querés cobrar?" (transferencia con datos opcionales, WhatsApp) → `create_store` → `/admin` con **checklist de primeros pasos** en el dashboard (cargar productos / importar, personalizar apariencia, configurar envíos, publicar, compartir link) que se tilda sola (`stores.onboarding`).
- `/admin/plan`: plan actual, uso vs límites (barras), comparación de planes, botón "Quiero este plan" → abre WhatsApp de la plataforma (`PLATFORM_WHATSAPP` env) con el pedido de upgrade y registra `logAudit('plan.upgrade_request')`. Integración de cobro (MercadoPago suscripciones) queda como v0.2, documentada en `docs/BILLING.md` con el diseño.
- `/platform` (solo `is_platform_admin`): tabla de tiendas (nombre, slug, dueño, plan, estado, productos, pedidos, creada), cambiar plan / estado / extender trial, "entrar como" (setea cookie y abre `/admin`), stats globales, edición de planes (precios, features, límites).

### 14.4 Deploy en Vercel

- Proyecto Vercel `ecommy` (team `nicoamicone1s-projects`) conectado al repo GitHub `nicoamicone1/scrapimportados`, branch de producción `main`. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ROOT_DOMAIN`, `NEXT_PUBLIC_SITE_URL`, `PLATFORM_WHATSAPP`, `CRON_SECRET`. `NEXT_PUBLIC_ROOT_DOMAIN` apunta al dominio del proyecto (`<proyecto>.vercel.app`) hasta que exista dominio propio; ahí la resolución usa el fallback `/s/<slug>`. Con dominio propio: agregar `ecommy.app` y `*.ecommy.app` al proyecto y cambiar la env. Supabase Auth: agregar la URL de producción a "Site URL" y "Redirect URLs" (manual, documentado en `docs/DEPLOY.md`). `vercel.json` con `crons` (`/api/cron/daily` → `expire_trials` + `expire_unpaid_orders` de todas las tiendas, protegido con `CRON_SECRET`) y `functions.maxDuration` para `/api/import/**` si hace falta.

### 14.5 Experiencia de carga

- **Barra de progreso global** (`src/components/ui/NavigationProgress.tsx`): fina, en color ámbar, arriba de todo; se dispara con `useLinkStatus` (Next 16: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-link-status.md`) o interceptando clicks en `<a>` internos + `usePathname`, y termina al cambiar la ruta. Se monta en el admin, la plataforma y el storefront.
- **`loading.tsx` en cada ruta** del admin y del storefront con **skeletons que imitan la página** (PageHeader + tabla de N filas / grilla de cards / formulario), no un spinner centrado. Skeletons con shimmer sutil. Librería de skeletons reutilizables en `src/components/ui/skeletons.tsx` (`TableSkeleton`, `FormSkeleton`, `CardsSkeleton`, `DetailSkeleton`, `StatsSkeleton`).
- **Estados pendientes en todas las acciones**: botones con `loading` (spinner + texto "Guardando…"), `useFormStatus` / `useTransition`, deshabilitar doble submit, filas con opacidad mientras mutan (optimistic para toggles: switches, activo/inactivo, visto/no visto), `router.refresh()` acompañado de indicador. Filtros de tablas: al cambiar `?q=` / filtros, la tabla muestra overlay translúcido con spinner pequeño hasta que llega el resultado (`useTransition` alrededor de `router.replace`; hook `useUrlTransition()` en `src/components/ui/useUrlTransition.ts`).
- Regla: ninguna interacción del admin puede quedar sin feedback en 100 ms.

### 14.6 Restyling del admin

Dirección (actualiza `docs/DESIGN.md` §7): el admin deja de ser "hoja blanca". Sin caer en lo genérico:

- **Sidebar oscuro** `--adm-sidebar-bg #1a2320` (verde-tinta profundo), texto `#e8e6df`, ítem activo con fondo `#2e4a3f` (pino) y barra izquierda en acento cálido `#e0a458` (ámbar), etiquetas de grupo en `#8fa39a`. Marca en blanco con el nombre de la tienda debajo y el chip del plan.
- **Fondo del contenido** `--adm-bg #efeae1` (crema cálida, no blanca), **superficies** `#ffffff` con borde `#e2dbcd` y sombra `0 1px 2px rgb(20 25 22 / .06)`; **topbar** blanca con borde inferior y buscador con fondo `#f4f1ea`.
- **Acento** primario pino `#2e4a3f` (botones), **acento secundario ámbar** `#e0a458` para foco, badges de "nuevo", barra de progreso y highlights. Tinta por sección en la cabecera de cada página (icono con fondo tintado + franja de 3 px: Pedidos → ámbar, Catálogo → pino, Marketing → terracota `#b8542a`, Tienda → azul pizarra `#3d5a80`, Sistema → gris cálido `#6b6860`). Nada de gradientes.
- **Tablas**: cabecera con fondo `#f7f4ee`, filas 40 px con hover `#faf8f3`, números `tabular-nums`, badges de estado con dot (colores ya definidos).
- **Cards de stats**: número grande en tinta `#1c1917`, etiqueta gris, variación en verde/rojo secos, sin iconos decorativos.
- **Dashboard**: saludo con nombre de la tienda y chip del plan, checklist de onboarding como tarjeta destacada con fondo `#e6efe9` hasta completarse.
- **Formularios**: inputs fondo blanco, borde `#d9d2c3`, foco ámbar; barra sticky de guardar con fondo `#1a2320` y texto claro.
- **Empty states** con icono lineal grande en `#c9c1b0` y CTA primario.
- **Login / registro / onboarding**: pantalla dividida (izquierda formulario en superficie blanca, derecha panel pino con una frase corta y un mock del storefront), no un card centrado sobre gris.
- Todo se implementa vía tokens `--adm-*` en `src/app/admin/admin.css` + `globals.css` y en las primitivas de `src/components/ui`; las páginas sólo ajustan donde usan colores a mano.
