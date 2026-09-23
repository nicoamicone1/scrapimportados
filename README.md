# Ecommy

Plataforma de e-commerce multi-tienda (SaaS): cualquier persona se registra, crea su
tienda en tres pasos y la administra desde su panel. Cada tienda tiene storefront 100 %
personalizable, panel de administración (`/admin`) y checkout sin pasarela
(transferencia con descuento o coordinación por WhatsApp; el pedido siempre queda
registrado). Los planes (Free, Starter, Pro, Business) habilitan funciones y límites.

Versión actual: **0.1.0** (ver `src/lib/version.ts` y `docs/CHANGELOG.md`).
Especificación completa: [`docs/ECOMMY-SPEC.md`](docs/ECOMMY-SPEC.md) (§14: multi-tienda) ·
diseño: [`docs/DESIGN.md`](docs/DESIGN.md) · deploy: [`docs/DEPLOY.md`](docs/DEPLOY.md) ·
cobro de planes (v0.2): [`docs/BILLING.md`](docs/BILLING.md).

## Stack

- **Next.js 16.3** (App Router, Turbopack, `proxy.ts`), React 19.2, TypeScript strict.
- **Tailwind CSS v4**. El storefront usa CSS variables del tema (`store_settings.theme`);
  el admin y la plataforma, tokens fijos `--adm-*`.
- **Supabase**: Postgres con RLS en todas las tablas (aislamiento por `store_id`), Auth
  (email + contraseña), Storage (bucket público `media`, un prefijo por tienda). Sin
  service-role key: todo corre como el usuario logueado (o anon) bajo RLS.
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
| `NEXT_DIST_DIR` | opcional, build dir alternativo (ej. `.next-m`) |

### Base de datos

Las migraciones viven en `supabase/migrations/NNNN_nombre.sql` y se aplican en orden.
`0001`…`0010` crean el esquema de una tienda; **`0011_multitenant.sql`** lo convierte en
multi-tienda (`stores`, `store_members`, `store_invites`, `plans`, `subscriptions`,
`store_id` en todas las tablas, RLS por tienda, `create_store()`, planes, etc.) y migra
todo lo existente a la tienda `demo`. Después de aplicarla sobre una base con imágenes
viejas, mové los objetos del bucket con `npx tsx scripts/move-media-to-store.mts demo`.

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
    (platform)/             landing, /planes, /login, /registro, /auth/*, /app (mis tiendas,
                            alta), /invitacion/<token>, /platform (superadmin)
    s/[store]/              storefront de una tienda (tema, header, footer, carrito)
    admin/(panel)/          panel de la tienda activa (sidebar + topbar + ⌘K)
    api/cron/daily          barrido diario (trials, reservas impagas)
  components/
    ui/ admin/ store/ blocks/ platform/
  lib/
    tenant/                 host → tienda, URLs (storePath, storeUrl), slugs, alta
    plans/                  features y límites, PlanError, uso
    cache-tags.ts           tagFor(base, storeId)
    media.ts                mediaPath(storeId, …)
    auth.ts                 requireAdmin() → { store, membership, plan, … }
    store/ admin/ pricing/ theme/ blocks/ …
supabase/migrations/        SQL
scripts/                    scraper, seed, create-admin, move-media-to-store
docs/                       spec, diseño, deploy, billing, changelog, acceso dev
```
