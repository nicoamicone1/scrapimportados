# Cobro con tarjeta y cuotas sin interés en las tiendas (v0.8)

Las tiendas de Ecommy cobran sus pedidos con **Mercado Pago Checkout Pro**, conectando
**la cuenta de Mercado Pago del comercio** por OAuth (modelo marketplace). La plata va
directo a la cuenta del comercio; Ecommy nunca la toca. Es distinto del cobro de los
planes (docs/BILLING.md), que usa la cuenta de Ecommy y Suscripciones.

## 1. Por qué Mercado Pago Checkout Pro + OAuth (decisión, 2026-10-02)

| Criterio | Mercado Pago (Checkout Pro + OAuth) | Mobbex | Payway / Getnet / Fiserv | MODO / Nave / Ualá Bis |
| --- | --- | --- | --- | --- |
| Alta del comercio | 1 clic ("Conectar Mercado Pago"); casi todos ya tienen cuenta | Alta y validación en Mobbex | Contrato y nº de establecimiento por tarjeta | Alta por banco / procesador |
| Integración para Ecommy | REST que ya usamos (billing), OAuth estándar, webhooks | API propia, menos documentada | SDK + certificación por comercio | Sin API multi-comercio abierta |
| Comisión tarjeta (sin IVA) | 6,29 % al instante · 4,39 % 10 d · 3,39 % 18 d · 1,49 % 35 d (lo elige el comercio en su cuenta) | ~4 % crédito, 5 días | ~1,8 % (18 d) a 5,69 % (1 d) | 1,5–4,9 % |
| Cuotas sin interés | Las ofrece el comercio en "Costos y cuotas" (3/6/9/12; absorbe el costo) + promos bancarias + Cuotas sin tarjeta (Mercado Crédito) | Planes por banco y día | Planes por banco | Promos bancarias (MODO), 3 y 6 (Nave) |
| Costo para Ecommy | **$0** (el comercio paga la comisión de MP) y opcional `marketplace_fee` | — | — | — |
| Riesgo / PCI | La tarjeta se carga en MP: Ecommy fuera de alcance PCI | Igual | Igual | Igual |

Conclusión: Payway/Getnet son más baratos por transacción pero obligan a cada comercio a
firmar con el procesador, y no hay forma de que Ecommy lo resuelva en un clic. Mercado
Pago es el único que permite **conectar en un clic, cobrar con todas las tarjetas, ofrecer
cuotas sin interés y que Ecommy cobre una comisión opcional sin costo propio**. El
comercio baja su costo eligiendo el plazo de acreditación en su cuenta de MP, y el
comprador que no quiere cuotas sigue teniendo el descuento por transferencia (ya existe).

Fuentes: tarifas MP AR (mercadopago.com.ar/costs-section, guías 2026), comparativas de
talo.com.ar (abril 2026), doc "Split de pagos 1:1 / marketplace" y "OAuth" de MP Developers.

## 2. Configuración (una vez, superadmin)

1. En MP Developers, crear la aplicación **"Ecommy Tiendas"** (producto: Checkout Pro,
   modelo de integración: Marketplace) con la cuenta de Ecommy. Redirect URL:
   `https://www.ecommy.app/api/payments/mercadopago/oauth/callback`.
2. Variables (Vercel prod + preview y `.env.local`):
   - `MP_PAYMENTS_CLIENT_ID`, `MP_PAYMENTS_CLIENT_SECRET`: de esa aplicación.
   - `PAYMENTS_TOKEN_KEY`: 32 bytes en base64 (`openssl rand -base64 32`). Cifra los tokens
     de los comercios (AES-256-GCM). **Si se pierde, todos los comercios reconectan.**
   - `MP_PAYMENTS_WEBHOOK_SECRET` (opcional): clave secreta de webhooks de esa aplicación.
     Si está, se valida `x-signature`; igual nunca se confía en el cuerpo (ver §5).
   - Ya existentes: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
3. Sin `MP_PAYMENTS_CLIENT_ID`/`SECRET`/`PAYMENTS_TOKEN_KEY` la opción no aparece en el
   admin (`paymentsEnabled() === false`) y el webhook responde 503.

## 3. Base (migración `0023_store_payments.sql`, esquema 14)

- `payment_methods.type` admite `'mercadopago'`. Cada tienda tiene como mucho un método
  `code = 'mercadopago'` (se crea al conectar, `is_active = true`). Trigger: no se puede
  activar un método `mercadopago` si la tienda no tiene cuenta conectada (`status = 'connected'`).
- `store_payment_accounts` (una fila por tienda y proveedor; `provider = 'mercadopago'`):
  `store_id` (pk junto con provider), `mp_user_id bigint`, `public_key`, `live_mode bool`,
  `access_token_enc text`, `refresh_token_enc text`, `token_expires_at timestamptz`,
  `status` (`connected` | `disconnected` | `error`), `last_error text`, `connected_by uuid`,
  `connected_at`, `updated_at`. **RLS activada sin políticas**: sólo service_role. Los
  tokens van cifrados por la app; la base nunca ve el texto plano.
- `public.store_payment_account_status(p_store_id uuid)` security definer, sólo
  `is_store_admin(p_store_id)`: devuelve lo NO secreto (`status`, `mp_user_id`, `live_mode`,
  `connected_at`, `token_expires_at`, `last_error`).
- `public.store_payments_online(p_store_id uuid) returns boolean` (anon + authenticated):
  ¿la tienda cobra online? (cuenta conectada y método activo). Lo usa el storefront para
  mostrar cuotas.
- `store_settings.checkout -> 'mercadopago'` (jsonb, sin columna nueva):
  `{ "max_installments": 1..24 (default 12), "free_installments": 0|3|6|9|12 (default 0),
  "binary_mode": bool (default true), "statement_descriptor": text <= 13 }`.
  `free_installments` es lo que el comercio declara haber activado en MP ("Costos y
  cuotas › Ofrecer cuotas sin interés"); sólo se usa para comunicarlo en la tienda.
- `plans.payment_fee_percent numeric(5,2) not null default 0` (0–10): comisión de Ecommy
  por venta cobrada online (`marketplace_fee`). Todos en 0 al migrar; se edita en
  `/platform/planes`.
- `orders`: `payment_provider text`, `payment_provider_ref text` (id de la preferencia
  vigente), `payment_detail jsonb` (último pago de MP: estado, `status_detail`, cuotas,
  medio, últimos 4, id). `order_payments`: índice único `(store_id, reference)` donde
  `method_code = 'mercadopago'` (idempotencia por id de pago de MP).
- `public.payments_apply_mp_payment(p_store_id, p_order_id, p_payment_id text,
  p_status text, p_amount numeric, p_detail jsonb)` security definer, **sólo
  service_role**. Bloquea el pedido; exige que sea de la tienda.
  - `approved`: inserta `order_payments` (`method_code 'mercadopago'`, `reference` = id de
    pago, `note` "Mercado Pago · 6 cuotas · Visa ••4242"); idempotente. Deja
    `expires_at = null`, guarda `payment_detail`, agrega `order_events`
    (`payment_added`, visible). Si `inventory_policy = 'on_paid'` y el pedido no tiene
    movimientos de venta, descuenta stock igual que `recordOrderPayment`. Si el pedido
    estaba **cancelado/vencido**, igual registra el pago (la plata entró) y deja un evento
    interno "Pago recibido en un pedido cancelado: revisar/devolver".
  - `refunded` / `charged_back`: borra el `order_payments` de ese pago (el trigger
    recalcula) y marca `payment_status = 'refunded'` si no quedan pagos; evento.
  - `rejected` / `cancelled` / `pending` / `in_process`: sólo `payment_detail` + evento
    interno (no visible) la primera vez.
  - Devuelve jsonb `{ applied: bool, payment_status, order_number, notify: bool }`.
- `private.expire_unpaid_orders`: no vence pedidos con `payment_detail->>'status'` en
  (`in_process`, `pending`) de las últimas 48 h (pago con tarjeta en revisión).
- `app_meta.schema_version = 14` y `SCHEMA_VERSION = 14` en `src/lib/version.ts`.

## 4. Código

`src/lib/payments/` (server-only salvo `installments.ts`):

- `config.ts`: `paymentsEnabled()`, credenciales, `PAYMENTS_TOKEN_KEY`.
- `crypto.ts`: `sealToken(plain) / openToken(sealed)` AES-256-GCM (`v1.<iv>.<tag>.<data>` base64url).
- `oauth.ts`: URL de autorización con PKCE (`code_challenge_method=S256`) y `state`;
  canje de `code` y `refresh_token` en `POST /oauth/token`.
- `accounts.ts`: leer/guardar/desconectar la cuenta (service client), `getSellerToken(storeId)`
  que refresca si vence en < 15 días.
- `preferences.ts`: `createOrderPreference(order, store, settings, fee)` →
  `POST /checkout/preferences` con el token del comercio:
  - 1 ítem "Pedido #N · Tienda" con `unit_price = order.total` (evita diferencias de
    redondeo con descuentos/envío), `currency_id`.
  - `payer` (nombre, email), `external_reference = order.id`,
    `notification_url = <platformOrigin>/api/payments/mercadopago/webhook?store=<store_id>`,
    `back_urls` a `/pedido/<token>?pago=ok|pendiente|error` de la tienda, `auto_return: "approved"`,
    `binary_mode`, `payment_methods.installments = max_installments`,
    `statement_descriptor`, `expires`/`expiration_date_to` = `orders.expires_at` si hay,
    `marketplace_fee` = `round(total * plan.payment_fee_percent / 100, 2)` si > 0,
    `metadata: { store_id, order_id }`, header `X-Idempotency-Key`.
  - Guarda `payment_provider = 'mercadopago'`, `payment_provider_ref` en el pedido.
  - Sólo acepta `init_point` https en dominio `mercadopago.com[.xx]`.
- `webhook.ts`: procesa `type=payment`: `GET /v1/payments/<id>` con el token del
  comercio; exige `collector_id === mp_user_id`, `external_reference` = un pedido de esa
  tienda, misma moneda, `transaction_amount >= order.total - 0.01` para aprobar (si no,
  evento interno "monto distinto" y no se marca pago). Llama a
  `payments_apply_mp_payment`. Tests con repos falsos (como `src/lib/billing/*.test.ts`).
- `installments.ts` (cliente y servidor): `installmentLabel(price, n)` → "3 cuotas sin
  interés de $1.234" (redondeo hacia arriba al centavo).

Rutas:

- `GET /api/payments/mercadopago/oauth/start?store=<id>`: exige sesión y
  `is_store_owner` (o admin de la tienda); cookie httpOnly firmada con `state`,
  `code_verifier`, `store_id`, 10 min; redirige a `auth.mercadopago.com/authorization`.
- `GET /api/payments/mercadopago/oauth/callback`: valida cookie/state y sesión de nuevo,
  canjea el code, guarda la cuenta, crea/activa el método `mercadopago`, invalida cache
  `payment-methods:<store>`, redirige a `/admin/configuracion/pagos?mp=conectado`
  (o `?mp=error&motivo=…`).
- `POST /api/payments/mercadopago/webhook?store=<id>`: 503 sin configuración; si hay
  `MP_PAYMENTS_WEBHOOK_SECRET` y viene `x-signature`, se valida (reusa
  `src/lib/billing/signature.ts`); se relee el pago SIEMPRE. 200 salvo fallas
  transitorias (500 para que MP reintente). Mails: "pago acreditado" al comprador y al
  vendedor con `after()` cuando `notify`.
- Server actions: `disconnectMercadoPago()` (admin), `saveMercadoPagoSettings()`;
  storefront `createOrder` devuelve `paymentUrl` cuando el método es `mercadopago`;
  `startOrderPayment(token)` reintenta el pago desde la página del pedido (pedido
  pendiente, sin pagar y sin vencer).
- Cron diario: refresca tokens que vencen en < 30 días; si falla, `status = 'error'` y
  aviso en el admin.

## 5. Seguridad

- Nunca se confía en la notificación ni en la vuelta (`?pago=ok`): el pago se marca
  sólo con lo que devuelve `GET /v1/payments/<id>` con el token del comercio.
- Tokens cifrados, nunca en logs (`redactTokens`), nunca al cliente.
- `state` + PKCE + cookie httpOnly `SameSite=Lax` atada a la tienda y al usuario.
- El `store` del webhook sólo elige qué token usar; el pago tiene que ser de esa cuenta.

## 6. UX

- **Admin › Configuración › Pagos**: tarjeta "Tarjetas y cuotas con Mercado Pago" arriba
  de los métodos: estado (conectada como cuenta #id, modo prueba/real), botón Conectar /
  Desconectar, cuotas máximas, "cuotas sin interés que ofrecés en Mercado Pago" (0/3/6/9/12)
  con el paso a paso para activarlas en MP y la tabla de costos de referencia, cobro en
  modo binario, nombre en el resumen. Muestra la comisión de Ecommy si el plan tiene.
- **Checkout**: el método "Tarjeta de crédito o débito" (Mercado Pago) muestra
  "Hasta N cuotas sin interés" y los logos genéricos; al confirmar, redirige a MP.
- **Pedido**: con `?pago=ok` "Estamos confirmando tu pago" (se refresca cada 4 s hasta
  ver `paid`, máx. 1 min); `pendiente` = en revisión; `error` = "No se pudo cobrar" con
  botón "Reintentar pago". Pedido MP sin pagar: botón "Pagar con Mercado Pago".
- **Storefront**: si `free_installments > 0` y la tienda cobra online, la ficha y las cards
  muestran "3 cuotas sin interés de $X" (además de la línea de transferencia).
- **Admin › Pedido**: detalle del pago (cuotas, tarjeta, id de MP con link a la actividad).

## 7. Estado (2026-10-02, v0.8.0)

- App de Mercado Pago **"Ecommy Tiendas"** creada en la cuenta Easytraining: número
  `954124726074456` (Checkout Pro, API de Preferences). Falta guardar en su
  "Configuración de la aplicación" la Redirect URL
  `https://www.ecommy.app/api/payments/mercadopago/oauth/callback`, PKCE = Sí y permisos
  read / offline access / write (el formulario pide un captcha: lo guarda el dueño).
- Migración `0023_store_payments` aplicada en producción (esquema 14). Todos los planes
  con `payment_fee_percent = 0`.
- Vercel (prod + preview): `MP_PAYMENTS_CLIENT_ID`, `PAYMENTS_TOKEN_KEY` y
  `SUPABASE_SERVICE_ROLE_KEY` cargadas. Falta `MP_PAYMENTS_CLIENT_SECRET` (Credenciales de
  producción de la app). Detalle de todas las variables: docs/VARIABLES.md.
- Código (además de §4): `preference-body.ts` (cuerpo puro, con tests), `checkout.ts`
  (link de pago para `createOrder` / `startOrderPayment`), `repo.ts` (webhook ↔ Supabase),
  `oauth-state.ts` (cookie cifrada), `admin.ts` (estado para Configuración › Pagos).
  Tests: `src/lib/payments/payments.test.ts`.

Verificar con una cuenta de prueba de MP antes de anunciarlo:
1. Que el aviso a `notification_url` de una preferencia creada con el token del comercio
   llegue con `type=payment` y `data.id` (o `topic`/`id`): el webhook acepta los dos.
2. Que `marketplace_fee` > 0 funcione con esta app (si MP lo rechaza, dejar 0 % hasta que
   MP habilite el modelo marketplace en la app).
3. Que las cuotas sin interés configuradas en "Costos y cuotas" del comercio aparezcan en
   el checkout de la preferencia.
