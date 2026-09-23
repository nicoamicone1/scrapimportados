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
| `SUPABASE_SERVICE_ROLE_KEY` | clave `service_role` de Supabase (marcada *sensitive*, **nunca** `NEXT_PUBLIC_`) | la usan el cron diario (avisos de "tu prueba termina" / "tu prueba terminó" y de activación) y el cobro con MercadoPago (webhook y sincronización: `billing_apply_subscription` sólo la ejecuta service_role). Sin ella esos avisos no salen y los pagos de MP no se aplican; todo lo demás sigue igual |
| `MP_ACCESS_TOKEN` | access token de **producción** de la cuenta de MercadoPago de Ecommy (marcado *sensitive*, nunca `NEXT_PUBLIC_`) | cobro automático de planes (docs/BILLING.md). Sin él `/admin/plan` sólo ofrece el pedido por WhatsApp y el webhook responde 503 |
| `MP_WEBHOOK_SECRET` | clave secreta del webhook (MercadoPago → Tus integraciones → Webhooks) (marcado *sensitive*) | valida la firma `x-signature` de `/api/billing/mercadopago/webhook`. Sin ella el webhook responde 503 |
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

Cupos contra spam (el checkout y el arrepentimiento son públicos): aplicar
`supabase/migrations/0014_order_notify_quota.sql`. Con ella, "Recibimos tu pedido" no sale
si ese email ya hizo 3 pedidos en la última hora, si la tienda tuvo 30 en 10 minutos o si
una tienda sin ningún pedido pagado pasó los 50 en el día (el pedido se crea igual y el
vendedor recibe su aviso); el aviso de arrepentimiento al vendedor se corta a 20 por hora
por tienda (la solicitud se registra igual). Sin la migración la app manda todo como
antes. Además, en **Vercel → Firewall** crear una regla de rate limit para los POST con
header `next-action` en `/s/*` y en los hosts de tienda (~10 por minuto por IP; ver §5).

## 4c. Cobro de planes con MercadoPago

Diseño y detalle en [`docs/BILLING.md`](BILLING.md). Para activarlo:

1. Aplicar `supabase/migrations/0015_billing.sql` (esquema 6). Sin ella la pantalla Plan
   sigue sólo con WhatsApp.
2. MercadoPago (cuenta de Ecommy) → Suscripciones → crear un plan de suscripción por plan
   pago (Starter y Pro), mensual, en ARS y con el mismo precio que `/platform/planes`.
3. `/platform/planes` → pegar el id de cada `preapproval_plan` en "Plan de MercadoPago" y
   guardar (con `MP_ACCESS_TOKEN` cargado se verifica que exista).
4. MercadoPago → Tus integraciones → la aplicación → Webhooks → URL de producción
   `https://www.ecommy.app/api/billing/mercadopago/webhook`, eventos "Planes y
   suscripciones". Copiar la clave secreta.
5. Vercel: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y `SUPABASE_SERVICE_ROLE_KEY`.
   Redeployar.
6. Probar primero con credenciales y usuarios de prueba de MP (sandbox): pagar Pro desde
   una tienda de prueba, ver el aviso en `/platform/tiendas/<id>` (sección MercadoPago),
   cancelar la renovación y simular un cobro rechazado.

Probar el webhook sin firma (tiene que dar 401):

```bash
curl -i -X POST https://www.ecommy.app/api/billing/mercadopago/webhook -d '{}'
```

## 5. Checklist post-deploy

- [ ] `https://ecommy-app.vercel.app/` muestra la landing con planes.
- [ ] `/s/demo/` muestra la tienda demo con imágenes.
- [ ] Registro → confirmación de email → `/app/nueva` → tienda creada → `/admin`.
- [ ] `/admin/plan` muestra el trial; "Quiero este plan" abre WhatsApp.
- [ ] Migración `0014_order_notify_quota.sql` aplicada (cupos de mails del checkout y del
      arrepentimiento; `expire_trials()` ya no borra `trial_ends_at`).
- [ ] Migración `0015_billing.sql` aplicada; con `MP_ACCESS_TOKEN` y los `mp_plan_id`
      cargados, el dueño ve "Pagar con MercadoPago" en `/admin/plan`, y el webhook de MP
      apunta a `/api/billing/mercadopago/webhook` (sin firma responde 401).
- [ ] Migración `0016_stock_alerts.sql` aplicada ("Avisame cuando haya stock": tabla `stock_alerts`,
      RPC `create_stock_alert` con cupo 5/h por email y 200/día por tienda; sin ella el formulario
      de la ficha responde "No pudimos anotarte" y `/admin/inventario/avisos` lo avisa).
- [ ] Migración `0017_promotions_bxgy.sql` aplicada (promos "Llevá X, pagá Y" y "N.ª unidad al Z %";
      sin ella el panel no deja guardarlas y el resto de las promos sigue igual).
- [ ] Migración `0018_order_bundle_discount.sql` aplicada, DESPUÉS de 0017 (si falta 0017 frena
      con un error claro). El descuento de las promos por cantidad pasa a nivel pedido
      (`orders.bundle_discount`, ya incluido en `promo_total`): 3 × $ 100 con 3x2 → $ 200, no
      $ 199,98. `create_order` recalcula en SQL con la misma regla del motor y rechaza un
      descuento mayor; deroga el trigger de 0017. Suma `get_schema_version()`: la app manda
      `bundle_discount` sólo si es ≥ 9; sin la migración sigue con el precio promedio por línea.
      Verificación: un pedido con 3x2 en `/s/demo/` muestra "Promociones por cantidad" en
      `/pedido/<token>`, en el detalle del panel, en el remito y en el mail.
- [ ] `/platform` (superadmin) lista las tiendas.
- [ ] `curl` al cron con el secreto devuelve `{ ok: true }` y sin él, 401.
- [ ] Con `RESEND_API_KEY`: un pedido en `/s/demo/` manda "Recibimos tu pedido" al comprador
      y "Nuevo pedido" al email de contacto de la tienda.
- [ ] Vercel → Firewall → Custom Rule "Rate limit server actions de tienda": si `Method`
      es `POST`, existe el header `next-action` y (el path empieza con `/s/` o el host es
      `*.ecommy.app` distinto de `www`, o un dominio propio) → Rate Limit fixed window,
      10 pedidos por 60 s por IP, acción Deny (429).
- [ ] `curl -sI https://www.ecommy.app/admin` trae `X-Frame-Options: DENY` y
      `curl -sI https://<tienda>.ecommy.app/pedido/x` trae `Referrer-Policy: no-referrer`.

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

Antes de hacer rollback del código a una versión sin promos por cantidad (anterior a la
0017: "Llevá X, pagá Y" y "N.ª unidad al Z %"), pausá esas promos en `/admin/promociones`.
Esa versión lee cualquier tipo desconocido como porcentaje: una "2.ª unidad al 50 %"
activa se mostraría como 50 % off en todas las unidades (y un 3x2, con `value` 0,
dejaría de aplicarse sin aviso).

Vercel → Deployments → "Promote to production" del deploy anterior. La 0011 no tiene
rollback automático: si hiciera falta, restaurá el backup diario de Supabase (Point in
Time Recovery en planes pagos).
