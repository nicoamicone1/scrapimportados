# Deploy de Ecommy (Vercel + Supabase)

Estado actual de producción (spec §14.4):

| Dato | Valor |
| --- | --- |
| Proyecto Vercel | `scrapimportados` (team `nicoamicone1s-projects`) |
| Repo | GitHub `nicoamicone1/scrapimportados`, branch de producción `main` |
| Node | 24 |
| Dominio | `https://www.ecommy.app` (canónico; `ecommy.app` redirige 308 a `www`). `https://ecommy-app.vercel.app` sigue activo como respaldo |
| Modo de tiendas | **subdominio**: `https://<slug>.ecommy.app/` (comodín `*.ecommy.app` verificado en Vercel). En `ecommy-app.vercel.app` sigue el fallback `/s/<slug>/` |
| Supabase | proyecto `asudscbvsrmulbpozjmq` |

## 1. Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Producción | Notas |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://asudscbvsrmulbpozjmq.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave publishable | |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `ecommy.app` | dominio raíz; `www.ecommy.app` y `ecommy.app` son la plataforma, `<slug>.ecommy.app` las tiendas |
| `NEXT_PUBLIC_SITE_URL` | `https://www.ecommy.app` | links de Auth, metadata, URLs absolutas de la plataforma |
| `PLATFORM_WHATSAPP` | `549…` (E.164 sin +) | "Quiero este plan" abre este WhatsApp |
| `CRON_SECRET` | secreto largo aleatorio (marcado *sensitive*) | Vercel Cron lo manda como `Authorization: Bearer …` |
| `RESEND_API_KEY` | `re_…` (marcado *sensitive*) | emails transaccionales (ver §4b). Sin ella no se manda ningún email y la app funciona igual |
| `EMAIL_FROM` | `Ecommy <no-reply@ecommy.app>` (default si falta) | remitente; el dominio tiene que estar verificado en Resend. Las tiendas mandan como `"{Tienda} vía Ecommy" <misma dirección>` |
| `PLATFORM_EMAIL` | casilla de soporte de Ecommy | recibe los pedidos de cambio de plan y es el reply-to de los mails de cuenta. Opcional |
| `SUPABASE_SERVICE_ROLE_KEY` | clave `service_role` de Supabase (marcada *sensitive*, **nunca** `NEXT_PUBLIC_`) | la usa SÓLO el cron diario para los avisos de "tu prueba termina" / "tu prueba terminó" y los de activación (día 2 y día 7). Sin ella esos avisos no salen; el cron y todo lo demás siguen igual |
| `NEXT_PUBLIC_PLATFORM_GA4_ID` | `G-XXXXXXXXXX` | GA4 del sitio de Ecommy (landing, planes, registro, contacto). Opcional; sin él no se carga ningún script. Las tiendas tienen su propio GA4 en Configuración › SEO |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | token de Search Console | sólo el valor `content` del meta que da Google, sin el meta entero. Opcional |

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

- **Site URL**: `https://www.ecommy.app`
- **Redirect URLs** (agregar todas):
  - `https://www.ecommy.app/auth/callback`
  - `https://www.ecommy.app/auth/callback?next=*`
  - `https://ecommy-app.vercel.app/auth/callback` (respaldo)
  - `http://localhost:3000/auth/callback` (desarrollo)
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

## 4b. Emails transaccionales (Resend)

Qué sale: al comprador (recibimos tu pedido con los datos de transferencia y la reserva,
pago confirmado, enviado / listo para retirar, número de seguimiento, cancelado), al
vendedor en el email de contacto de la tienda (pedido nuevo, arrepentimiento), al dueño
(bienvenida, prueba por terminar, prueba terminada) y a `PLATFORM_EMAIL` (pedido de
plan). Se mandan después de responder (`after()`), nunca bloquean un pedido y usan
`Idempotency-Key` para no duplicarse. Código: `src/lib/email/`.

Avisos de activación (cron diario, `src/lib/email/activation-notices.ts`, con `SUPABASE_SERVICE_ROLE_KEY`): al dueño, una sola vez cada uno y sólo si la tienda está activa, "falta el primer producto" (día 2 a 30 sin productos) y "ahora, que la vean" (día 7 a 30 con productos activos, sin `onboarding.shared` ni pedidos); quedan marcados en `stores.onboarding.notices` y el JSON del cron los cuenta en `emails.activation_no_products` / `emails.activation_share`.

1. Crear la cuenta en [resend.com](https://resend.com) y una API key con permiso
   *Sending access*.
2. **Domains → Add domain** `ecommy.app` y cargar en el DNS los registros que muestra
   Resend: **SPF** (TXT/MX del subdominio de envío), **DKIM** (TXT `resend._domainkey`) y
   un **DMARC** propio (TXT `_dmarc.ecommy.app`, para empezar
   `v=DMARC1; p=none; rua=mailto:<tu casilla>`). Esperar a que figure *Verified*.
3. Cargar en Vercel `RESEND_API_KEY`, `EMAIL_FROM` (si no es el default),
   `PLATFORM_EMAIL` y, si se quieren los avisos de fin de prueba,
   `SUPABASE_SERVICE_ROLE_KEY`. Redeployar.
4. Probar antes de verificar el dominio: con `EMAIL_FROM="Ecommy <onboarding@resend.dev>"`
   Resend sólo entrega a la casilla dueña de la cuenta; hacer un pedido en la tienda demo
   con ese email. Para probar sin casillas reales, usar una API key aparte (revocable) y los destinos
   `delivered@resend.dev` / `bounced@resend.dev`.
5. Log: en Vercel → Logs, filtrar por `[email]`. Ahí aparecen los rechazos de Resend
   (status y cuerpo recortado, sin la API key), los envíos repetidos que se saltearon y
   el aviso de "RESEND_API_KEY no está configurada". Los envíos que salieron se ven en el
   dashboard de Resend (Emails), con tags `kind` y `store`.

El vendedor recibe los avisos en **Configuración → Tienda → Email de contacto**: si está
vacío, no le llega nada (el comprador igual recibe los suyos).

## 5. Checklist post-deploy

- [ ] `https://ecommy-app.vercel.app/` muestra la landing con planes.
- [ ] `/s/demo/` muestra la tienda demo con imágenes.
- [ ] Registro → confirmación de email → `/app/nueva` → tienda creada → `/admin`.
- [ ] `/admin/plan` muestra el trial; "Quiero este plan" abre WhatsApp.
- [ ] `/platform` (superadmin) lista las tiendas.
- [ ] `curl` al cron con el secreto devuelve `{ ok: true }` y sin él, 401.
- [ ] Con `RESEND_API_KEY`: un pedido en `/s/demo/` manda "Recibimos tu pedido" al comprador
      y "Nuevo pedido" al email de contacto de la tienda.

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
