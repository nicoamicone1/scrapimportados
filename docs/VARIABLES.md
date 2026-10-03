# Variables de entorno: qué hay, qué falta y dónde se cargan

Estado al 2026-10-03. Los valores secretos **no** van en este archivo: están en Vercel
(cifrados) y en el `.env.local` de cada máquina (ignorado por git).

## Dónde se cargan

| Lugar | Cómo |
| --- | --- |
| **Vercel (producción y preview)** | <https://vercel.com/nicoamicone1s-projects/scrapimportados/settings/environment-variables> → *Add New* → nombre, valor, marcar **Production** y **Preview**, tipo **Sensitive** para los secretos → *Save*. Después hay que **redeployar** (Deployments → último → *Redeploy*) o hacer un push a `main`. |
| **Local (`npm run dev`)** | Archivo `.env.local` en la raíz del proyecto. Reiniciar `next dev` después de cambiarlo. |
| **Mercado Pago "Ecommy Tiendas"** | <https://www.mercadopago.com.ar/developers/panel/app/954124726074456> (cuenta Easytraining). |

## Cobro con tarjeta de las tiendas (v0.8, docs/PAYMENTS.md)

| Variable | Valor / de dónde sale | Vercel | Local |
| --- | --- | --- | --- |
| `MP_PAYMENTS_CLIENT_ID` | `954124726074456` (número de la app "Ecommy Tiendas") | ✅ cargada | ✅ |
| `PAYMENTS_TOKEN_KEY` | clave AES generada (32 bytes base64). **No cambiarla**: si cambia, todas las tiendas reconectan | ✅ cargada (sensitive) | ✅ (la misma) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → secret key `sb_secret_…` | ✅ cargada (sensitive) | ✅ |
| `MP_PAYMENTS_CLIENT_SECRET` | App "Ecommy Tiendas" → **Credenciales de producción** → *Client Secret* (botón del ojo / copiar) | ❌ **falta** | ❌ **falta** |
| `MP_PAYMENTS_WEBHOOK_SECRET` | Opcional. App "Ecommy Tiendas" → **Webhooks** → *Clave secreta* (aparece al guardar una URL de webhook) | opcional | opcional |

Sin `MP_PAYMENTS_CLIENT_SECRET` el admin muestra "Muy pronto vas a poder conectar tu
cuenta de Mercado Pago" y nadie puede conectar.

### Configuración de la app en Mercado Pago (una vez)

App "Ecommy Tiendas" → **Configuración de la aplicación**:

- Categoría: Servicio de informática · URL del sitio: `https://www.ecommy.app`
- Configuración avanzada → URL de redireccionamiento:
  `https://www.ecommy.app/api/payments/mercadopago/oauth/callback`
- ¿PKCE?: **Sí** · Permisos: read, offline access, write
- Tildar el reCAPTCHA y **Guardar cambios**.

No hace falta configurar Webhooks en la app: cada pago manda su aviso a
`https://www.ecommy.app/api/payments/mercadopago/webhook?store=<id>` (lo arma Ecommy).

## Cobro de los planes de Ecommy (v0.4, docs/BILLING.md)

| Variable | De dónde sale | Vercel | Local |
| --- | --- | --- | --- |
| `MP_ACCESS_TOKEN` | App MP **"Ecommy"** (450745977213300) → Credenciales de producción → Access Token | ❌ falta | ✅ |
| `MP_WEBHOOK_SECRET` | App MP "Ecommy" → Webhooks → clave secreta | ❌ falta | ✅ |

Cargarlas en Vercel **activa el cobro automático de planes en producción** (débitos
reales a los dueños). Hacerlo cuando los `mp_plan_id` de /platform/planes estén listos.

## Mails (Resend)

| Variable | De dónde sale | Vercel | Local |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | resend.com → API Keys → "Ecommy" | ❌ falta | ✅ |
| `EMAIL_FROM` | `Ecommy <no-reply@ecommy.app>` | ✅ | ✅ |
| `PLATFORM_EMAIL` | `hola@ecommy.app` | ✅ | — |

Sin `RESEND_API_KEY` no sale ningún mail (pedido recibido, **pago acreditado**, etc.).

## Ya cargadas y sin cambios

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ROOT_DOMAIN`
(`ecommy.app`, sólo prod), `NEXT_PUBLIC_SITE_URL` (`https://www.ecommy.app`, sólo prod),
`PLATFORM_WHATSAPP`, `CRON_SECRET`, `HASH_SECRET`.

Sólo en local: `DEV_LOGIN_EMAIL`, `DEV_LOGIN_PASSWORD` (login de QA, nunca en Vercel).
