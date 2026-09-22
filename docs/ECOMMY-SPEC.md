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
- **promotions**: `name`, `type text check in ('percent','fixed')`, `value numeric(12,2)`, `scope text check in ('all','categories','products')`, `category_ids uuid[]`, `product_ids uuid[]`, `starts_at`, `ends_at`, `is_active`, `priority int`, `badge_label` ("-20 %", "Ciber Lunes"), `stackable bool default false`. Se aplican **al leer** (motor de precios): gana la de mayor `priority`; si `stackable`, se acumulan. Nunca reescriben `price`.
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
