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
  - `provider_status`: estado crudo del preapproval en MP (`pending`, `authorized`,
    `paused`, `cancelled`).
  - `provider_plan_code`: plan elegido en el checkout (respaldo si el preapproval no trae
    `preapproval_plan_id`).
  - `cancel_at_period_end`: la renovación está cancelada; el plan sigue hasta
    `current_period_end`.
  - `last_payment_at`: último cobro confirmado.
- `billing_events`: una fila por notificación (`event_id` único = idempotencia), con el
  payload, el resultado y `processed_at`. RLS: sólo la lee el superadmin; la escribe el
  webhook con la service-role key.
- `billing_start_checkout(store, plan, preapproval)`: la llama el DUEÑO desde la server
  action. Sólo marca `provider = mercadopago`, `provider_ref`, `provider_status = pending`
  y `provider_plan_code`. **No cambia plan ni estado.** Rechaza si ya hay una suscripción
  de MP cobrando sin cancelar.
- `billing_apply_subscription(p_store_id, p_plan_code, p_status, p_provider_ref,
  p_period_start, p_period_end, p_provider_status, p_cancel_at_period_end,
  p_last_payment_at)`: security definer, ejecutable **sólo por `service_role`** (revocada
  a anon y authenticated). Verifica que la tienda esté en MP y que `provider_ref` coincida.
  `p_status = null` sólo registra `provider_status`.
- `current_plan()`: cuenta como Free una renovación cancelada cuyo período terminó y una
  suscripción de MP sin cobro confirmado 7 días después de `current_period_end` (aunque
  el cron no haya corrido). Devuelve además `cancel_at_period_end`.
- `run_daily_maintenance()` llama a `billing_expire_subscriptions()`, que pasa a Free esas
  mismas suscripciones y lo anota en `notes` (el JSON del cron trae
  `subscriptions_expired`).
- `platform_set_plan()`: un cambio manual del superadmin (salvo extender la prueba) deja
  la tienda en `provider = 'manual'`; desde ahí los avisos de MP no la tocan hasta que el
  dueño vuelva a pagar. Si la tienda pagaba con MP, cancelá antes la suscripción en MP.

## Flujo

1. **Pagar** (`/admin/plan`, sólo el dueño con su cuenta; un superadmin "entrando como"
   no ve el botón): `startMercadoPagoCheckout(plan)` →
   `POST https://api.mercadopago.com/preapproval` con
   ```json
   {
     "preapproval_plan_id": "<plans.mp_plan_id>",
     "payer_email": "<email del dueño>",
     "external_reference": "<store_id>",
     "back_url": "<platformOrigin>/admin/plan?mp=ok",
     "reason": "Ecommy <Plan> · <Tienda>"
   }
   ```
   y header `X-Idempotency-Key`. Se registra con `billing_start_checkout` y se redirige al
   `init_point` (sólo si es https en un dominio `mercadopago.com[.xx]`).
   - Si MP responde 400 pidiendo `card_token_id` (MP puede exigirlo para suscripciones
     CON plan asociado creadas por API), se crea la suscripción SIN plan: mismo
     `auto_recurring` que el `preapproval_plan` (se lee con `GET /preapproval_plan/<id>`),
     `status: "pending"`, y el plan de Ecommy sale de `provider_plan_code`.
     **Verificar en sandbox cuál de los dos caminos usa la cuenta.**
2. **Vuelta** (`/admin/plan?mp=ok`): la pantalla dice que el plan se activa cuando MP
   confirme el cobro. No se activa nada por volver: lo hace el webhook.
3. **Webhook** `POST /api/billing/mercadopago/webhook`:
   - Sin `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` o `SUPABASE_SERVICE_ROLE_KEY` → 503.
   - Firma inválida → 401. Firma válida → 200 aunque el aviso no interese.
   - Excepción: si MP o la base fallan procesando un aviso de suscripción → 500, para que
     MP reintente (el evento queda en `billing_events` sin `processed_at` y el reintento
     lo procesa; uno ya procesado se ignora).
   - `subscription_preapproval` → `GET /preapproval/<data.id>`.
     `subscription_authorized_payment` → `GET /authorized_payments/<data.id>` y después
     `GET /preapproval/<preapproval_id>`. Nunca se confía en el cuerpo de la notificación.
   - `external_reference` tiene que ser un uuid, la tienda tiene que estar en
     `provider = 'mercadopago'` y `provider_ref` tiene que ser ese preapproval. Si no, se
     registra como ignorado.
4. **Cancelar renovación** (`/admin/plan`, dueño): `PUT /preapproval/<id>` con
   `{"status":"cancelled"}` y sincronización inmediata (la confirma después el webhook).
   La tienda **mantiene el plan hasta `current_period_end`** (`status = active`,
   `cancel_at_period_end = true`) y después pasa a Free (cron / `current_plan()`).
5. **Cambiar de plan**: con una suscripción cobrando, primero se cancela la renovación y
   después se paga el plan nuevo (MP no prorratea: el nuevo cobra desde que se autoriza).
6. **Superadmin**: `/platform/tiendas/<id>` muestra el estado de MP y los últimos avisos, y
   "Sincronizar con MercadoPago" relee el preapproval y lo aplica igual que el webhook.

## Estados (`src/lib/billing/state.ts`)

"Con período pago" = la tienda está `active`/`past_due` y su `provider_status` ya pasó
por `authorized`.

| MercadoPago | Con período pago | Sin período pago (prueba, Free, checkout a medias) |
| --- | --- | --- |
| `authorized` | `active`, período = último cobro → `next_payment_date` | `active` con el plan pagado (mail "Tu plan X está activo hasta …") |
| `authorized` + cobro rechazado | `past_due` (mail "No pudimos cobrar tu plan") | sin cambios (mail "No pudimos cobrar…") |
| `paused` / `pending` | `past_due` (mail, una vez) | sin cambios: **nada se activa sin cobro** |
| `cancelled` | `active` + `cancel_at_period_end` si queda período; si no, `cancelled` | sin cambios (no se corta la prueba) |

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
- Comparación en tiempo constante. Sin ventana de tiempo sobre `ts`: un reenvío sólo
  dispara una relectura en MP y los eventos son idempotentes.

## Credenciales y seguridad

- `MP_ACCESS_TOKEN` (access token de producción de la cuenta de Ecommy) y
  `MP_WEBHOOK_SECRET` (clave secreta del webhook, en "Tus integraciones › Webhooks"):
  sólo servidor, nunca `NEXT_PUBLIC_`. Los errores de MP se loguean sin el token.
- `SUPABASE_SERVICE_ROLE_KEY`: la crea sólo `src/lib/billing/service.ts` y la usan el
  webhook (firma validada) y dos acciones ya autorizadas (dueño que cancela, superadmin
  que sincroniza). En los tres casos lo que se escribe sale de la API de MP.
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
  revisá en MP cómo afecta a las suscripciones ya creadas (no lo verificamos).
- Facturación electrónica (AFIP) fuera de alcance: se emite a mano o con un servicio
  externo a partir de `billing_events`.
