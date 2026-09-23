# Ecommy

Plataforma de e-commerce multi-tienda (SaaS): cualquier persona se registra, crea su
tienda en tres pasos y la administra desde su panel. Cada tienda tiene storefront 100 %
personalizable, panel de administración (`/admin`) y checkout sin pasarela
(transferencia con descuento o coordinación por WhatsApp; el pedido siempre queda
registrado). Los planes (Free, Starter, Pro, Business) habilitan funciones y límites.

Versión actual: **0.4.0** (ver `src/lib/version.ts` y `docs/CHANGELOG.md`).
Especificación completa: [`docs/ECOMMY-SPEC.md`](docs/ECOMMY-SPEC.md) (§14: multi-tienda) ·
diseño: [`docs/DESIGN.md`](docs/DESIGN.md) · deploy: [`docs/DEPLOY.md`](docs/DEPLOY.md) ·
cobro de planes con MercadoPago: [`docs/BILLING.md`](docs/BILLING.md) ·
lanzamiento: [`docs/MARKETING.md`](docs/MARKETING.md), [`docs/LAUNCH-PLAN.md`](docs/LAUNCH-PLAN.md),
[`docs/LAUNCH-CHECKLIST.md`](docs/LAUNCH-CHECKLIST.md) (todo lo que requiere acción del dueño) y
[`docs/SOCIAL-KIT.md`](docs/SOCIAL-KIT.md).

## Stack

- **Next.js 16.3** (App Router, Turbopack, `proxy.ts`), React 19.2, TypeScript strict.
- **Tailwind CSS v4**. El storefront usa CSS variables del tema (`store_settings.theme`);
  el admin y la plataforma, tokens fijos `--adm-*`.
- **Supabase**: Postgres con RLS en todas las tablas (aislamiento por `store_id`), Auth
  (email + contraseña), Storage (bucket público `media`, un prefijo por tienda). Todo
  corre como el usuario logueado (o anon) bajo RLS. Única excepción, acotada: el cron
  diario usa `SUPABASE_SERVICE_ROLE_KEY` (si está) sólo para leer las pruebas por vencer
  y mandar los avisos de fin de prueba (`src/lib/email/trial-notices.ts`), y el cobro con
  MercadoPago la usa para aplicar lo que dice MP (`src/lib/billing/service.ts`).
- **Cobro de planes** con MercadoPago Suscripciones por REST (`src/lib/billing/`,
  webhook en `/api/billing/mercadopago/webhook`), apagado sin `MP_ACCESS_TOKEN`.
- **Emails transaccionales** por la API REST de Resend (`src/lib/email/`), apagados sin
  `RESEND_API_KEY`.
- `zod`, `lucide-react`, `sonner`, `date-fns`, `vitest`.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local      # completá URL y anon key de Supabase
npm run dev                     # http://localhost:3000
```

- `http://localhost:3000/` → landing de la plataforma (registro, planes, ingreso).
- `http://localhost:3000/s/<slug>/` → storefront de una tienda (ej. `/s/demo/`).
- `http://localhost:3000/admin` → panel de la tienda activa (pide sesión).

Variables de entorno:

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave pública (anon / publishable) |
| `NEXT_PUBLIC_SITE_URL` | URL pública de la plataforma (links de Auth, metadata) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | dominio raíz (`localhost:3000`, `ecommy-app.vercel.app`, `ecommy.app`). Con localhost o `*.vercel.app` las tiendas viven en `/s/<slug>`; con dominio propio, en `<slug>.<dominio>` |
| `NEXT_PUBLIC_TENANT_MODE` | opcional: `path` o `subdomain` para forzar el modo |
| `PLATFORM_WHATSAPP` | WhatsApp de la plataforma (pedidos de cambio de plan) |
| `CRON_SECRET` | secreto del cron diario `/api/cron/daily` |
| `RESEND_API_KEY` | opcional: API key de Resend. Sin ella no sale ningún email (se avisa una vez en el log) |
| `EMAIL_FROM` | opcional: remitente, por defecto `Ecommy <no-reply@ecommy.app>` (el dominio tiene que estar verificado en Resend) |
| `PLATFORM_EMAIL` | opcional: casilla de la plataforma (avisos de pedido de plan y reply-to de los mails de cuenta) |
| `NEXT_PUBLIC_PLATFORM_GA4_ID` | opcional: GA4 del sitio de Ecommy (landing, planes, registro), `G-XXXX`. No afecta a las tiendas, que tienen su propio GA4 en Configuración › SEO |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | opcional: token de Google Search Console para `www.ecommy.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | opcional, sólo servidor: la usan el cron (avisos de fin de prueba y de activación) y el cobro con MercadoPago (webhook y sincronización). Sin ella esos avisos no salen y los pagos de MP no se aplican; el resto funciona igual |
| `MP_ACCESS_TOKEN` | opcional, sólo servidor: access token de MercadoPago para cobrar los planes con Suscripciones. Sin él `/admin/plan` sólo ofrece el pedido por WhatsApp |
| `MP_WEBHOOK_SECRET` | opcional, sólo servidor: clave secreta del webhook de MercadoPago (`/api/billing/mercadopago/webhook`); sin ella el webhook responde 503 |
| `NEXT_DIST_DIR` | opcional, build dir alternativo (ej. `.next-m`) |

### Base de datos

Las migraciones viven en `supabase/migrations/NNNN_nombre.sql` y se aplican en orden.
`0001`…`0010` crean el esquema de una tienda; **`0011_multitenant.sql`** lo convierte en
multi-tienda (`stores`, `store_members`, `store_invites`, `plans`, `subscriptions`,
`store_id` en todas las tablas, RLS por tienda, `create_store()`, planes, etc.) y migra
todo lo existente a la tienda `demo`. Después de aplicarla sobre una base con imágenes
viejas, mové los objetos del bucket con `npx tsx scripts/move-media-to-store.mts demo`.
`0014_order_notify_quota.sql` (esquema 5) agrega el cupo de avisos por mail del checkout
y del arrepentimiento y deja de borrar `trial_ends_at` al vencer la prueba; hasta
aplicarla, Configuración muestra "base de datos desactualizada" y los mails salen sin cupo.
`0015_billing.sql` (esquema 6) cobro de planes con MercadoPago, `0016_stock_alerts.sql` (7)
avisos de stock, `0017_promotions_bxgy.sql` (8) promociones por cantidad y
`0018_order_bundle_discount.sql` (9) descuento por cantidad a nivel pedido con recálculo en
`create_order`. Se aplican en ese orden; el código tolera que falten (cada función se
oculta o degrada) y `SCHEMA_VERSION` en `src/lib/version.ts` indica la esperada.
`0015_billing.sql` (esquema 6) agrega el cobro con MercadoPago (`plans.mp_plan_id`,
`billing_events`, columnas de `subscriptions`, `billing_apply_subscription` sólo para
service role); sin ella `/admin/plan` sigue sólo con WhatsApp.

Aplicarlas con la CLI de Supabase (`supabase db push`) o, desde un agente, con la
herramienta MCP `apply_migration`. Después regenerá los tipos en
`src/lib/supabase/database.types.ts` (`supabase gen types typescript` o MCP
`generate_typescript_types`).

### Usuarios y tiendas

- Cada persona se registra en **`/registro`** y crea su tienda en **`/app/nueva`**
  (trial de 14 días de Pro). Hasta 3 tiendas por cuenta. El equipo se suma desde
  `/admin/usuarios` (invitación por link).
- `profiles.is_platform_admin` habilita **`/platform`** (tiendas, planes, trials).
- En desarrollo ya existe el superadmin dueño de la tienda demo: ver
  [`docs/DEV-ACCESS.md`](docs/DEV-ACCESS.md). Con `DEV_LOGIN_EMAIL` y `DEV_LOGIN_PASSWORD`
  en `.env.local`, `GET /admin/auth/dev-login?next=/admin` inicia sesión sin formulario
  (sólo fuera de producción).

### Catálogo de ejemplo (seed)

```bash
SEED_EMAIL=… SEED_PASSWORD=… SEED_STORE=demo npm run seed   # sube las imágenes a <store_id>/products/…
SEED_EMAIL=… SEED_PASSWORD=… npm run seed -- --skip-images  # usa las URLs del proveedor
```

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm test` | Vitest (precios, tema, bloques, tenant, planes…) |
| `npm run seed` | Importa `data/products.json` a una tienda (`SEED_STORE`) |
| `npm run create-admin` | Alta de un usuario con `signUp` (la tienda se crea en `/app/nueva`) |
| `npx tsx scripts/move-media-to-store.mts <slug>` | Mueve objetos sueltos del bucket a `<store_id>/…` |
| `npm run scrape` | Scraper del catálogo DAZ → `data/products.json` + `public/img` |

Antes de entregar: `npx tsc --noEmit`, `npm run lint` y `npm test` sin errores.

## Deploy

Ver [`docs/DEPLOY.md`](docs/DEPLOY.md) (Vercel, dominio propio con wildcard, Supabase
Auth, cron diario).

## Estructura

```
src/
  proxy.ts                  clasifica el host (plataforma / tienda / dominio propio),
                            reescribe <slug>.dominio → /s/<slug>, headers x-site/x-store-*,
                            refresco de sesión y redirect optimista a /login
  app/
    layout.tsx              html/body mínimo
    (platform)/             landing, /planes, /contacto, /terminos, /privacidad, /ayuda,
                            /guias, /login, /registro, /auth/*, /app (mis tiendas, alta),
                            /invitacion/<token>, /platform (superadmin); opengraph-image
    icon.tsx, apple-icon.tsx ícono raíz (src/app/_brand/glyph.tsx)
    s/[store]/              storefront de una tienda (tema, header, footer, carrito)
    admin/(panel)/          panel de la tienda activa (sidebar + topbar + ⌘K); /admin/compartir
                            (link, QR y mensajes listos)
    api/cron/daily          barrido diario (trials, reservas impagas) + avisos de fin de prueba
                            y de activación (día 2 y día 7)
  content/                  artículos de /ayuda y /guias (JSX tipado, tests de contenido)
  components/
    ui/ admin/ store/ blocks/ platform/
  lib/
    tenant/                 host → tienda, URLs (storePath, storeUrl), slugs, alta
    plans/                  features y límites, PlanError, uso
    cache-tags.ts           tagFor(base, storeId)
    media.ts                mediaPath(storeId, …)
    auth.ts                 requireAdmin() → { store, membership, plan, … }
    email/                  emails transaccionales (Resend por REST, plantillas, disparadores)
    billing/                MercadoPago Suscripciones (cliente REST, firma del webhook, estados)
    store/ admin/ pricing/ theme/ blocks/ …
supabase/migrations/        SQL
scripts/                    scraper, seed, create-admin, move-media-to-store
docs/                       spec, diseño, deploy, billing, changelog, acceso dev, marketing y lanzamiento
```
