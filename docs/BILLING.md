# Cobro de planes con MercadoPago (diseño para v0.2)

Hoy (v0.1) los planes se cambian a mano: "Quiero este plan" en `/admin/plan` registra
`plan.upgrade_request` en la auditoría y abre el WhatsApp de la plataforma; el
superadmin lo activa en `/platform/tiendas/<id>` (`platform_set_plan`). Este documento
describe cómo automatizarlo.

## Producto de MercadoPago

**Suscripciones con plan asociado** (`/preapproval_plan` + `/preapproval`): un
`preapproval_plan` por plan pago y moneda (Starter, Pro), cobro mensual automático con
tarjeta de crédito/débito o dinero en cuenta. Business sigue siendo a medida.

- Ventaja: MercadoPago reintenta cobros y maneja la tarjeta; nosotros sólo reaccionamos
  a webhooks.
- Alternativa descartada: links de pago mensuales (Checkout Pro) → obligan a pagar a
  mano todos los meses.

## Datos

Ya existen en `subscriptions`: `provider` (`'manual' | 'mercadopago'`), `provider_ref`
(id del `preapproval`), `status`, `current_period_start/end`, `trial_ends_at`.
Agregar en la migración de v0.2:

```sql
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores (id) on delete set null,
  provider text not null,              -- 'mercadopago'
  event_id text not null unique,       -- id de la notificación (idempotencia)
  type text not null,                  -- 'subscription_preapproval', 'subscription_authorized_payment'
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.plans add column mp_plan_id text;   -- preapproval_plan por plan
```

`billing_events` sólo la lee el superadmin (RLS); la escribe una función security definer.

## Flujo

1. **Elegir plan** (`/admin/plan` → "Pagar con MercadoPago"): server action
   `startCheckout(plan)` → `POST /preapproval` con `preapproval_plan_id`, `payer_email`
   (email del dueño), `external_reference = store_id` y `back_url = /admin/plan?mp=ok`.
   Guarda `provider = 'mercadopago'`, `provider_ref = preapproval.id`, estado
   `past_due` hasta confirmar. Redirige al `init_point`.
2. **Webhook** `POST /api/billing/mercadopago` (route handler):
   - Valida la firma `x-signature` (HMAC SHA256 con el secreto del webhook) y el
     `x-request-id`; descarta duplicados por `event_id`.
   - Consulta el recurso a la API de MP (nunca confía en el body).
   - `preapproval.status = authorized` → `subscriptions.status = 'active'`,
     `plan_code` = el del `preapproval_plan`, `current_period_end` = `next_payment_date`.
   - Pago rechazado → `past_due` (se muestra el aviso en `/admin/plan`; a los 7 días de
     `past_due`, el cron pasa a `free`).
   - `cancelled` → `status = 'cancelled'` (cuenta como Free: `current_plan()`).
3. **Cancelar**: `/admin/plan` → `PUT /preapproval/{id}` con `status: cancelled`.
4. **Cambiar de plan**: cancelar el preapproval actual y crear uno nuevo (MP no
   prorratea; se cobra el nuevo desde el próximo período).

## Por qué hace falta una clave de servidor

El webhook corre sin sesión de usuario y tiene que escribir `subscriptions` de
cualquier tienda. Opciones (elegir una):

- **RPC con secreto** (sin service-role): `billing_apply_event(p_secret, p_event jsonb)`
  security definer que compara `p_secret` con un hash guardado en una tabla privada
  (`private.settings`). Consistente con la política actual de "sin service-role key".
- **Service-role key** sólo en la función del webhook (env `SUPABASE_SERVICE_ROLE_KEY`,
  nunca `NEXT_PUBLIC_`). Más simple, más riesgo si se filtra.

Recomendado: RPC con secreto.

## Variables nuevas

`MP_ACCESS_TOKEN` (producción), `MP_WEBHOOK_SECRET`, `BILLING_RPC_SECRET`.

## Precios e impuestos

- Precios finales en ARS con IVA incluido (monotributo/RI de la plataforma a definir).
- Facturación electrónica (AFIP) fuera de alcance de v0.2: se emite a mano o con un
  servicio externo a partir de `billing_events`.

## Pruebas

- Credenciales de prueba de MP y usuarios de test (comprador/vendedor).
- Tests unitarios del mapeo `preapproval.status → subscriptions.status` y de la
  validación de firma (puros, en `src/lib/billing/`).
