# Ecommy

Plataforma de e-commerce "una tienda por deploy": storefront 100 % personalizable
+ panel de administración (`/admin`) + checkout sin pasarela (transferencia con
descuento o coordinación por WhatsApp; el pedido siempre queda registrado).

Versión actual: **0.0.0** (ver `src/lib/version.ts` y `docs/CHANGELOG.md`).
Especificación completa: [`docs/ECOMMY-SPEC.md`](docs/ECOMMY-SPEC.md) ·
dirección de diseño: [`docs/DESIGN.md`](docs/DESIGN.md).

## Stack

- **Next.js 16.3** (App Router, Turbopack, `proxy.ts`), React 19.2, TypeScript strict.
- **Tailwind CSS v4**. El storefront usa CSS variables del tema (`store_settings.theme`);
  el admin, tokens fijos `--adm-*`.
- **Supabase**: Postgres con RLS en todas las tablas, Auth (email + contraseña),
  Storage (bucket público `media`). Sin service-role key: todo corre como el usuario
  logueado bajo RLS.
- `zod`, `lucide-react`, `sonner`, `date-fns`, `vitest`.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local      # completá URL y anon key de Supabase
npm run dev                     # http://localhost:3000
```

Variables de entorno:

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave pública (anon / publishable) |
| `NEXT_PUBLIC_SITE_URL` | URL pública (links de emails de Auth, metadata) |
| `NEXT_DIST_DIR` | opcional, build dir alternativo (ej. `.next-f`) |

### Base de datos

Las migraciones viven en `supabase/migrations/NNNN_nombre.sql`. `0001_foundation.sql`
crea TODO el esquema (tablas, índices, triggers, funciones, RLS, bucket `media`) y el
seed base (configuración de la tienda con el tema `nordico`, métodos de pago, menús y
la home publicada). Las siguientes (`0002`…`0010`) agregan redirecciones, arrepentimiento,
vencimiento de reservas, vistas del catálogo, funciones de pedidos, lotes de precios,
borradores de páginas, importación por CSV y guardas de usuarios. Se aplican en orden.

Aplicarlas con la CLI de Supabase (`supabase db push`) o, desde un agente, con la
herramienta MCP `apply_migration`. Después regenerá los tipos en
`src/lib/supabase/database.types.ts` (`supabase gen types typescript` o MCP
`generate_typescript_types`).

### Primer usuario

- En una base nueva, entrá a **`/admin/setup`** y creá la cuenta del dueño (el primer
  usuario queda `owner` activo; los siguientes, `pending` hasta que el dueño los apruebe).
- En desarrollo ya existe un owner de prueba: ver [`docs/DEV-ACCESS.md`](docs/DEV-ACCESS.md).
- Con `DEV_LOGIN_EMAIL` y `DEV_LOGIN_PASSWORD` en `.env.local`, `GET /admin/auth/dev-login`
  inicia sesión sin formulario (sólo fuera de producción; útil para QA automatizado).

### Catálogo de ejemplo (seed)

```bash
SEED_EMAIL=… SEED_PASSWORD=… npm run seed                 # sube las imágenes de public/img a Storage
SEED_EMAIL=… SEED_PASSWORD=… npm run seed -- --skip-images # usa las URLs del proveedor
```

Importa `data/products.json` (catálogo DAZ scrapeado con `npm run scrape`) como
productos activos. Es idempotente (upsert por `external_id`).

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm test` | Vitest (motor de precios, HTML, tema, bloques) |
| `npm run seed` | Importa `data/products.json` a Supabase |
| `npm run create-admin` | Alta de un usuario con `signUp` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) |
| `npm run scrape` | Scraper del catálogo DAZ → `data/products.json` + `public/img` |

Antes de entregar: `npx tsc --noEmit`, `npm run lint` y `npm test` sin errores.

## Deploy en Vercel

1. Importá el repo en Vercel (framework: Next.js; build `next build`).
2. Cargá las variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
   `NEXT_PUBLIC_SITE_URL` (la URL final, ej. `https://mitienda.com.ar`).
3. En Supabase → Auth → URL Configuration: poné la URL del sitio y agregá
   `https://<tu-dominio>/admin/auth/callback` a los redirect URLs (confirmación de
   email y recuperación de contraseña).
4. Aplicá las migraciones al proyecto de producción y creá el dueño en `/admin/setup`.

## Estructura

```
src/
  proxy.ts                  refresco de sesión + redirect optimista /admin → /admin/login
  app/
    layout.tsx              html/body mínimo
    (store)/                storefront (tema, header, footer, carrito)
    admin/
      login/ setup/ auth/   pantallas sin sesión + callback de Auth
      (panel)/              layout autenticado (sidebar + topbar + ⌘K) y secciones
  components/
    ui/                     primitivas del admin (Button, Input, Table, Dialog…)
    admin/                  shell del admin (nav.ts, Sidebar, Topbar, CommandPalette)
    store/                  componentes del storefront
    blocks/                 render de bloques del constructor de páginas
  lib/
    supabase/               clientes (server, client, proxy) + tipos generados
    auth.ts actions.ts audit.ts money.ts slug.ts dates.ts html.ts cn.ts version.ts
    theme/                  schema del tema, presets, fuentes, cssVars()
    blocks/                 schema de bloques + resolve
    pricing/                motor de precios puro (+ tests)
    store/                  lecturas cacheadas del storefront (unstable_cache + tags)
supabase/migrations/        SQL
scripts/                    scraper, seed, create-admin
docs/                       spec, diseño, changelog, acceso dev
```
