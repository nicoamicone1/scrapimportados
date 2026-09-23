# Deploy de Ecommy (Vercel + Supabase)

Estado actual de producción (spec §14.4):

| Dato | Valor |
| --- | --- |
| Proyecto Vercel | `scrapimportados` (team `nicoamicone1s-projects`) |
| Repo | GitHub `nicoamicone1/scrapimportados`, branch de producción `main` |
| Node | 24 |
| Dominio | `https://ecommy-app.vercel.app` (`ecommy.vercel.app` está tomado) |
| Modo de tiendas | **fallback**: `https://ecommy-app.vercel.app/s/<slug>/` (los `*.vercel.app` no admiten subdominios wildcard) |
| Supabase | proyecto `asudscbvsrmulbpozjmq` |

## 1. Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Producción | Notas |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://asudscbvsrmulbpozjmq.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave publishable | |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `ecommy-app.vercel.app` | dominio raíz; decide el modo de las tiendas |
| `NEXT_PUBLIC_SITE_URL` | `https://ecommy-app.vercel.app` | links de Auth, metadata, URLs absolutas en modo fallback |
| `PLATFORM_WHATSAPP` | `549…` (E.164 sin +) | "Quiero este plan" abre este WhatsApp |
| `CRON_SECRET` | secreto largo aleatorio (marcado *sensitive*) | Vercel Cron lo manda como `Authorization: Bearer …` |

No definas `DEV_LOGIN_EMAIL`/`DEV_LOGIN_PASSWORD` en producción (la ruta de dev-login
responde 404 con `NODE_ENV=production`, pero igual no hacen falta).

Las variables `NEXT_PUBLIC_*` se incrustan en el build: si las cambiás, **redeployá**.

## 2. Base de datos

1. Aplicá todas las migraciones de `supabase/migrations/` en orden (CLI `supabase db push`
   o MCP `apply_migration`). La `0011_multitenant.sql` es idempotente.
2. Si la base traía imágenes de antes de la 0011 (carpeta `products/` suelta en el
   bucket), movelas con un superadmin:
   `SEED_EMAIL=… SEED_PASSWORD=… npx tsx scripts/move-media-to-store.mts demo`
   (la migración ya reescribió las URLs; el script mueve los archivos físicos con la
   Storage API, porque renombrar `storage.objects` por SQL no los mueve).
3. Superadmin: `update public.profiles set is_platform_admin = true where email = '…';`
   (sólo por SQL; nadie puede dárselo desde la app).

## 3. Supabase Auth (manual, en el dashboard)

Authentication → URL Configuration:

- **Site URL**: `https://ecommy-app.vercel.app`
- **Redirect URLs** (agregar todas):
  - `https://ecommy-app.vercel.app/auth/callback`
  - `https://ecommy-app.vercel.app/auth/callback?next=*`
  - `http://localhost:3000/auth/callback` (desarrollo)
  - con dominio propio: `https://ecommy.app/auth/callback`
- Si "Confirm email" está activo, el registro muestra "Revisá tu correo" y el link
  vuelve a `/auth/callback?next=/app/nueva`. Recomendado: SMTP propio (el de Supabase
  tiene límite bajo de envíos) y "Leaked password protection" activado.

## 4. Cron diario

`vercel.json` programa `GET /api/cron/daily` todos los días a las 09:00 UTC. Vercel
manda `Authorization: Bearer $CRON_SECRET`; la ruta llama `run_daily_maintenance()`,
que vence trials (→ Free) y cancela pedidos impagos vencidos de todas las tiendas
(devolviendo stock). Probarlo a mano:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://ecommy-app.vercel.app/api/cron/daily
```

Además hay barridos perezosos: el listado de pedidos y el dashboard vencen reservas de
su tienda, y `current_plan()` ya trata un trial vencido como Free aunque el cron no
haya corrido.

## 5. Checklist post-deploy

- [ ] `https://ecommy-app.vercel.app/` muestra la landing con planes.
- [ ] `/s/demo/` muestra la tienda demo con imágenes.
- [ ] Registro → confirmación de email → `/app/nueva` → tienda creada → `/admin`.
- [ ] `/admin/plan` muestra el trial; "Quiero este plan" abre WhatsApp.
- [ ] `/platform` (superadmin) lista las tiendas.
- [ ] `curl` al cron con el secreto devuelve `{ ok: true }` y sin él, 401.

## 6. Pasar a dominio propio (subdominio por tienda)

1. Comprá/usá `ecommy.app` y en Vercel → Project → Domains agregá **`ecommy.app`**,
   **`www.ecommy.app`** y **`*.ecommy.app`**. El wildcard exige que el dominio use los
   nameservers de Vercel (DNS en Vercel): `ns1.vercel-dns.com`, `ns2.vercel-dns.com`.
2. Cambiá las env: `NEXT_PUBLIC_ROOT_DOMAIN=ecommy.app`,
   `NEXT_PUBLIC_SITE_URL=https://ecommy.app` y redeployá. Desde ahí:
   - `ecommy.app` → plataforma; `demo.ecommy.app` → storefront de `demo` (el proxy
     reescribe a `/s/demo/…`); `/admin` en un subdominio redirige a `ecommy.app/admin`.
   - `ecommy.app/s/<slug>/` sigue funcionando (links internos con prefijo).
3. Supabase Auth: Site URL `https://ecommy.app` y sumá `https://ecommy.app/auth/callback`.
4. La sesión del admin vive en `ecommy.app`; la barra de preview de borradores en un
   subdominio no ve esa cookie (usá la vista previa del panel o `/s/<slug>`).
5. Dominio propio de UNA tienda (`tienda.cliente.com`): cargar `stores.custom_domain`
   y `custom_domain_verified = true` (hoy por SQL/`/platform`), agregar el dominio al
   proyecto en Vercel y un CNAME `cname.vercel-dns.com`. El proxy lo resuelve por
   `custom_domain` (memoriza 60 s). Gate de plan: `domain.custom` (Pro).

## 7. Rollback

Vercel → Deployments → "Promote to production" del deploy anterior. La 0011 no tiene
rollback automático: si hiciera falta, restaurá el backup diario de Supabase (Point in
Time Recovery en planes pagos).
