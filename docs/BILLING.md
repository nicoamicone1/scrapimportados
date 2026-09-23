# Cobro de planes con MercadoPago (implementado en v0.4)

Los planes pagos (Starter, Pro) se cobran con **MercadoPago Suscripciones**: débito
automático mensual con tarjeta o dinero en cuenta. Business sigue siendo a medida (por
WhatsApp / Contacto). El pedido por WhatsApp ("Quiero este plan") sigue disponible al
lado del botón de MercadoPago y es el único camino cuando el cobro automático no está
configurado.

Código: `src/lib/billing/` (cliente REST por `fetch`, sin SDK), webhook en
`src/app/api/billing/mercadopago/webhook/route.ts`, pantalla `/admin/plan`, superadmin en
`/platform/planes` y `/platform/tiendas/<id>`. Migración: `0015_billing.sql` (esquema 6).

## Qué hay en la base (0015)

- `plans.mp_plan_id`: id del `preapproval_plan` de MercadoPago que cobra ese plan. Vacío =
  el plan no se paga con MP. Lo carga el superadmin en `/platform/planes` (si hay
  `MP_ACCESS_TOKEN`, se verifica contra `GET /preapproval_plan/<id>` antes de guardar).
- `subscriptions`, además de `provider` (`manual` | `mercadopago`), `provider_ref` (id del
  `preapproval`), `status`, `current_period_start/end`:
  - `provider_status`: estado del preapproval en MP (`pending`, `authorized`, `paused`,
    `cancelled`) más dos propios: `authorized_unpaid` (MP autorizó el débito pero todavía
    no confirmó el primer cobro: 7 días de gracia) y `expired` (pasó a Free por falta de
    cobro).
  - `provider_plan_code`: plan del checkout en curso / aplicado. Sólo informativo: el
    webhook NUNCA lo usa para decidir el plan (sale del preapproval en MP).
  - `cancel_at_period_end`: la renovación está cancelada; el plan sigue hasta
    `current_period_end`.
  - `last_payment_at`: último cobro confirmado.
- `billing_events`: una fila por notificación (`event_id` único = idempotencia), con el
  payload, el resultado y `processed_at`. RLS: sólo la lee el superadmin; la escribe el
  webhook con la service-role key.
- `billing_start_checkout(store, plan, preapproval)`: ejecutable **sólo por
  `service_role`**. La llama la server action con el cliente de `service.ts` DESPUÉS de
  verificar que quien paga es el dueño (`ownerOnly`); la tienda sale de la sesión y el
  plan, de `plans`. Sólo marca `provider = mercadopago`, `provider_ref`,
  `provider_status = pending` y `provider_plan_code`. **No cambia plan ni estado.**
  Rechaza si ya hay una suscripción de MP cobrando (`authorized`, `authorized_unpaid`,
  `paused`) sin cancelar.
- `billing_apply_subscription(p_store_id, p_plan_code, p_status, p_provider_ref,
  p_period_start, p_period_end, p_provider_status, p_cancel_at_period_end,
  p_last_payment_at, p_adopt)`: security definer, ejecutable **sólo por `service_role`**
  (revocada a anon y authenticated). Verifica que la tienda esté en MP y que
  `provider_ref` coincida. `p_status = null` sólo registra `provider_status`. Con
  `p_adopt = true` (y `p_status = 'active'`) reemplaza `provider_ref` por otro preapproval
  autorizado de la tienda, sólo si el guardado está `pending`, `cancelled` o `expired`
  (chequeo con la fila bloqueada).
- `current_plan()`: cuenta como Free una renovación cancelada (`active`/`past_due`) cuyo
  período terminó, una `authorized_unpaid` cuya gracia terminó y una suscripción de MP
  sin cobro confirmado 7 días después de `current_period_end` (aunque el cron no haya
  corrido). Devuelve además `cancel_at_period_end`.
- `run_daily_maintenance()` llama a `billing_expire_subscriptions()`, que pasa a Free esas
  mismas suscripciones y lo anota en `notes` (el JSON del cron trae
  `subscriptions_expired`). Por falta de cobro deja `provider_status = 'expired'`: la
  pantalla Plan ya no muestra la suscripción de MP como vigente.
- `platform_set_plan()`: un cambio manual del superadmin (salvo extender la prueba) deja
  la tienda en `provider = 'manual'`; desde ahí los avisos de MP no la tocan hasta que el
  dueño vuelva a pagar. Si la tienda tenía un débito automático vigente (o un checkout a
  medias), `/platform/tiendas/<id>` pide confirmar "Se cancelará el débito automático en
  MercadoPago" y lo cancela en MP (`PUT /preapproval/<id>`) ANTES de guardar; si MP falla
  (salvo 404), el plan no cambia.

## Flujo

1. **Pagar** (`/admin/plan`, sólo el dueño con su cuenta; un superadmin "entrando como"
   no ve el botón). El pago se hace con la **cuenta de MercadoPago del email del dueño**
   (`payer_email`): MP pide entrar con esa cuenta, y la pantalla lo dice al lado del
   botón. Si la tienda tenía un preapproval anterior que todavía puede cobrar (checkout a
   medias, renovación cancelada que MP sigue viendo autorizada, o una vencida), primero se
   cancela en MP (`PUT /preapproval/<anterior>`); si esa cancelación falla se sigue igual
   y queda en el log (si ese preapproval se autorizara, el webhook lo cancela como
   duplicado). Después `startMercadoPagoCheckout(plan)` →
   `POST https://api.mercadopago.com/preapproval` con
   ```json
   {
     "preapproval_plan_id": "<plans.mp_plan_id>",
     "payer_email": "<email del dueño>",
     "external_reference": "<store_id>:<plan_code>",
     "back_url": "<platformOrigin>/admin/plan?mp=ok",
     "reason": "Ecommy <Plan> · <Tienda>"
   }
   ```
   y header `X-Idempotency-Key`. Se registra con `billing_start_checkout` y se redirige al
   `init_point` (sólo si es https en un dominio `mercadopago.com[.xx]`).
   - Si MP responde 400 pidiendo `card_token_id` (MP puede exigirlo para suscripciones
     CON plan asociado creadas por API), se crea la suscripción SIN plan: mismo
     `auto_recurring` que el `preapproval_plan` (se lee con `GET /preapproval_plan/<id>`),
     `status: "pending"`. El plan de Ecommy sale del `external_reference` y el webhook
     exige que `auto_recurring` (monto, moneda, frecuencia mensual) sea el de
     `plans.price_monthly` / `plans.currency`; si no coincide, el aviso se registra como
     "ignorado: plan_mismatch" y no se activa nada. **Verificar en sandbox cuál de los dos
     caminos usa la cuenta.**
2. **Vuelta** (`/admin/plan?mp=ok`): la pantalla dice que el plan se activa cuando MP
   confirme el cobro. No se activa nada por volver: lo hace el webhook.
3. **Webhook** `POST /api/billing/mercadopago/webhook`:
   - Sin `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` o `SUPABASE_SERVICE_ROLE_KEY` → 503.
   - Firma inválida → 401. Firma válida → 200 aunque el aviso no interese.
   - Firma válida con `ts` a más de 10 minutos de la hora del servidor → 401.
   - Excepción al 200: falla **transitoria** (MP con status 0 / 5xx / 429, o la base sin
     responder) → 500, para que MP reintente (el evento queda en `billing_events` sin
     `processed_at` y el reintento lo procesa; uno ya procesado se ignora). Un 4xx de MP,
     un cobro sin `preapproval_id` o un `raise` de negocio de la base (P0001) cierran el
     evento como ignorado, con el motivo, y responden 200 (reintentar no los arregla).
   - `subscription_preapproval` → `GET /preapproval/<data.id>`.
     `subscription_authorized_payment` → `GET /authorized_payments/<data.id>` y después
     `GET /preapproval/<preapproval_id>`. Nunca se confía en el cuerpo de la notificación.
   - `external_reference` tiene que ser `<uuid>:<plan>` y la tienda tiene que estar en
     `provider = 'mercadopago'`. El plan sale del `preapproval_plan_id` (si es el de un
     plan de Ecommy) o del `external_reference` (con el control de monto de arriba; una
     renovación del mismo preapproval ya verificado no se vuelve a controlar, así un cambio
     de precio en `/platform/planes` no corta suscripciones vigentes).
   - Si `provider_ref` no es ese preapproval: si el preapproval no está `authorized`, se
     ignora. Si está `authorized` y el guardado quedó `pending`/`cancelled`/`expired`, se
     **adopta** (checkout reemplazado o abierto en dos pestañas). Si la tienda ya paga con
     otro (`authorized`, `authorized_unpaid`, `paused`), se **cancela en MP** el nuevo y
     queda el evento "cancelled_duplicate" (lo ve el superadmin).
4. **Cancelar renovación** (`/admin/plan`, dueño): `PUT /preapproval/<id>` con
   `{"status":"cancelled"}` y sincronización inmediata (la confirma después el webhook).
   La tienda **mantiene el plan hasta `current_period_end`** (`status = active`,
   `cancel_at_period_end = true`) y después pasa a Free (cron / `current_plan()`).
5. **Cambiar de plan**: con una suscripción cobrando, primero se cancela la renovación y
   después se paga el plan nuevo (MP no prorratea: el nuevo cobra desde que se autoriza).
   Con la renovación cancelada también se puede volver a suscribir al MISMO plan
   ("Volver a suscribirme"); el período pago que quedaba no se acorta.
6. **Superadmin**: `/platform/tiendas/<id>` muestra el estado de MP y los últimos avisos, y
   "Sincronizar con MercadoPago" relee el preapproval y lo aplica igual que el webhook.

## Estados (`src/lib/billing/state.ts`)

"Con período pago" = la tienda está `active`/`past_due` y su `provider_status` ya pasó
por `authorized` (o está en la gracia `authorized_unpaid`).

| MercadoPago | Con período pago | Sin período pago (prueba, Free, checkout a medias) |
| --- | --- | --- |
| `authorized` con cobro | `active`, período = último cobro → `next_payment_date` | `active` con el plan pagado (mail "Tu plan X está activo hasta …") |
| `authorized` sin cobro todavía | renovación: `active`; `past_due` sigue `past_due` hasta un cobro nuevo | `active` 7 días de gracia, `provider_status = authorized_unpaid` (mail "Tu plan está activo; el primer cobro se acredita en los próximos días"). El cobro aprobado lo pasa al período real sin otro mail; si no llega, a los 7 días pasa a Free (`expired`). Una `expired` no recibe otra gracia: vuelve sólo con un cobro |
| `authorized` + cobro rechazado | `past_due` (mail "No pudimos cobrar tu plan") | sin cambios (mail "No pudimos cobrar…") |
| `paused` / `pending` | `past_due` (mail, una vez) | sin cambios: **nada se activa sin cobro** |
| `cancelled` | `active` + `cancel_at_period_end` si queda período; si no, `cancelled` | sin cambios (no se corta la prueba) |

"Con cobro" = un `authorized_payment` aprobado, `summarized.last_charged_date` posterior
al último cobro conocido o, en la primera activación, `summarized.charged_quantity > 0`.

`past_due` mantiene el plan; 7 días después de `current_period_end` sin cobro, la tienda
pasa a Free. Los mails se mandan con `after()` desde el webhook, con `Idempotency-Key` de
Resend por tienda + preapproval + período (o cobro).

## Firma del webhook

Implementada según la doc "Webhooks › Validar origen de la notificación" y el
`WebhookSignatureValidator` del SDK oficial de Node (`mercadopago/sdk-nodejs`,
`src/utils/webhook/index.ts`, revisado el 2026-09-23):

```
x-signature: ts=<ts>,v1=<hex>
manifest   : id:<data.id>;request-id:<x-request-id>;ts:<ts>;
v1         = hex(HMAC_SHA256(MP_WEBHOOK_SECRET, manifest))
```

- `data.id` sale del query string (`?data.id=…`); si falta, del cuerpo.
- Las partes ausentes se omiten del manifest.
- La doc pide `data.id` en minúsculas si es alfanumérico; el SDK lo usa tal cual. Se
  aceptan las dos variantes (ambas requieren el secreto).
- Comparación en tiempo constante. `ts` tiene que estar a ±10 minutos de la hora del
  servidor (en segundos como dice la doc; en milisegundos también se acepta).
  Supuesto a verificar en sandbox: MP firma cada entrega (el manifest lleva el
  `x-request-id` del envío), así que los reintentos traen un `ts` nuevo. Si alguno
  llegara con el `ts` original se rechaza; el estado se recupera con el próximo aviso o
  con "Sincronizar con MercadoPago".

## Credenciales y seguridad

- `MP_ACCESS_TOKEN` (access token de producción de la cuenta de Ecommy) y
  `MP_WEBHOOK_SECRET` (clave secreta del webhook, en "Tus integraciones › Webhooks"):
  sólo servidor, nunca `NEXT_PUBLIC_`. Los errores de MP se loguean sin el token.
- `SUPABASE_SERVICE_ROLE_KEY`: la crea sólo `src/lib/billing/service.ts` y la usan el
  webhook (firma validada) y tres acciones ya autorizadas (dueño que empieza el pago o
  cancela, superadmin que sincroniza). Lo que se escribe sale de la API de MP o, al
  empezar el pago, de la sesión (tienda) y de `plans` (plan). Sin la clave, el botón de
  MercadoPago responde que el pago no está disponible y sigue el pedido por WhatsApp.
- Sin `MP_ACCESS_TOKEN`, `/admin/plan` no muestra MercadoPago y sigue el pedido por
  WhatsApp. Sin la migración 0015, igual.
- No hace falta `MP_PUBLIC_KEY`: no hay Bricks ni checkout embebido (se redirige al
  `init_point`).

## Puesta en marcha

1. Aplicar `supabase/migrations/0015_billing.sql` y subir `SCHEMA_VERSION` a 6 en
   `src/lib/version.ts` (o 7 si ya está 0016).
2. En MercadoPago (cuenta de Ecommy) → Suscripciones: crear un plan de suscripción por
   plan pago (Starter, Pro), mensual, en ARS, con el mismo precio que `/platform/planes`.
   Anotar el id de cada `preapproval_plan`.
3. `/platform/planes` → pegar cada id en "Plan de MercadoPago" y guardar.
4. MercadoPago → Tus integraciones → la aplicación → Webhooks → URL de producción
   `https://www.ecommy.app/api/billing/mercadopago/webhook`, eventos **Planes y
   suscripciones** (`subscription_preapproval`, `subscription_authorized_payment`).
   Copiar la clave secreta a `MP_WEBHOOK_SECRET`.
5. Vercel: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` (si no
   estaba). Redeployar.
6. Probar en sandbox con usuarios de prueba (vendedor = Ecommy, comprador = dueño de una
   tienda de prueba): pagar Pro, ver el aviso en `/platform/tiendas/<id>`, cancelar la
   renovación, simular un cobro rechazado.

## Precios e impuestos

- Precios finales en ARS con IVA incluido (monotributo/RI de la plataforma a definir).
- Si cambiás el precio de un plan, cambialo también en el `preapproval_plan` de MP y
  revisá en MP cómo afecta a las suscripciones ya creadas (no lo verificamos). Las
  suscripciones creadas SIN plan asociado (camino `card_token_id`) se activan sólo si el
  monto coincide con `plans.price_monthly`: mientras los dos precios no coincidan, un pago
  nuevo por ese camino queda "ignorado: plan_mismatch" (las ya activas siguen).
- Facturación electrónica (AFIP) fuera de alcance: se emite a mano o con un servicio
  externo a partir de `billing_events`.
