-- =====================================================================
-- 0015 · Cobro automático de planes con MercadoPago Suscripciones
--
-- Diseño: docs/BILLING.md. Idempotente (`if not exists`, `create or
-- replace`, `drop policy if exists`). Los cuerpos copiados de 0011 llevan los
-- agregados marcados "0015". CREATE OR REPLACE conserva owner y grants.
--
-- 1. plans.mp_plan_id: id del `preapproval_plan` de MercadoPago de cada plan
--    pago (lo carga el superadmin en /platform/planes).
-- 2. subscriptions: provider_status (estado crudo del preapproval en MP),
--    provider_plan_code (plan elegido en el checkout), cancel_at_period_end,
--    last_payment_at.
-- 3. billing_events: una fila por notificación de MP (idempotencia por
--    event_id). Sólo la lee el superadmin; la escribe el webhook con la
--    service-role key.
-- 4. billing_start_checkout(): el DUEÑO marca que empezó un pago (provider =
--    mercadopago, provider_ref = preapproval, provider_status = pending). NO
--    cambia plan ni estado.
-- 5. billing_apply_subscription(): aplica lo que dice MercadoPago. Sólo la
--    ejecuta service_role (webhook /api/billing/mercadopago/webhook y la
--    sincronización forzada del superadmin), nunca anon ni authenticated.
-- 6. current_plan(): una renovación cancelada cuenta como Free desde
--    current_period_end, y una suscripción de MP sin cobro confirmado cuenta
--    como Free 7 días después de current_period_end (aunque el cron no haya
--    corrido todavía). Devuelve además cancel_at_period_end.
-- 7. run_daily_maintenance(): además pasa a Free esas mismas suscripciones
--    (billing_expire_subscriptions()).
-- 8. platform_set_plan(): un cambio manual del superadmin (que no sea
--    extender la prueba) pasa la tienda a provider = 'manual': desde ahí los
--    avisos de MercadoPago no la tocan hasta que el dueño vuelva a pagar.
--
-- Orden de deploy: da igual. Sin esta migración la app no muestra el botón
-- de MercadoPago (sigue el pedido por WhatsApp) y el webhook no aplica nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1-2. Columnas
-- ---------------------------------------------------------------------
alter table public.plans add column if not exists mp_plan_id text;

alter table public.subscriptions add column if not exists provider_status text;
alter table public.subscriptions add column if not exists provider_plan_code text references public.plans (code);
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table public.subscriptions add column if not exists last_payment_at timestamptz;

create index if not exists subscriptions_provider_ref_idx on public.subscriptions (provider_ref) where provider_ref is not null;
create index if not exists subscriptions_provider_plan_idx on public.subscriptions (provider_plan_code) where provider_plan_code is not null;

-- ---------------------------------------------------------------------
-- 3. billing_events
-- ---------------------------------------------------------------------
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores (id) on delete set null,
  provider text not null default 'mercadopago',
  event_id text not null unique,
  type text not null,
  resource_id text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists billing_events_store_idx on public.billing_events (store_id, created_at desc);

alter table public.billing_events enable row level security;
drop policy if exists "billing_events: superadmin lee" on public.billing_events;
create policy "billing_events: superadmin lee" on public.billing_events
  for select to authenticated using ((select public.is_platform_admin()));
revoke all on public.billing_events from anon, authenticated;
grant select on public.billing_events to authenticated;

-- ---------------------------------------------------------------------
-- 4. billing_start_checkout (dueño)
-- ---------------------------------------------------------------------
create or replace function public.billing_start_checkout(p_store_id uuid, p_plan_code text, p_provider_ref text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  if not public.is_store_owner(p_store_id) then
    raise exception 'Sólo el dueño de la tienda puede pagar el plan';
  end if;
  if p_plan_code is null or not exists (select 1 from public.plans where code = p_plan_code and mp_plan_id is not null) then
    raise exception 'Ese plan no se puede pagar con MercadoPago';
  end if;
  if p_provider_ref is null or p_provider_ref !~ '^[A-Za-z0-9_-]{1,80}$' then
    raise exception 'Referencia inválida';
  end if;
  select * into v_sub from public.subscriptions where store_id = p_store_id for update;
  -- Con una suscripción de MP cobrando, primero hay que cancelar la renovación.
  if found and v_sub.provider = 'mercadopago' and v_sub.provider_status in ('authorized', 'paused') and not v_sub.cancel_at_period_end then
    raise exception 'Ya tenés una suscripción activa en MercadoPago: cancelá la renovación antes de cambiar de plan';
  end if;
  insert into public.subscriptions (store_id, plan_code, status, provider, provider_ref, provider_status, provider_plan_code)
  values (p_store_id, 'free', 'active', 'mercadopago', p_provider_ref, 'pending', p_plan_code)
  on conflict (store_id) do update
     set provider = 'mercadopago',
         provider_ref = excluded.provider_ref,
         provider_status = 'pending',
         provider_plan_code = excluded.provider_plan_code;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. billing_apply_subscription (sólo service_role)
--    p_status null = sólo se registra el estado de MP (no cambia el plan).
-- ---------------------------------------------------------------------
create or replace function public.billing_apply_subscription(
  p_store_id uuid,
  p_plan_code text,
  p_status text,
  p_provider_ref text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_provider_status text,
  p_cancel_at_period_end boolean default false,
  p_last_payment_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  if p_provider_ref is null or p_provider_ref = '' then
    raise exception 'Falta la referencia de MercadoPago';
  end if;
  select * into v_sub from public.subscriptions where store_id = p_store_id for update;
  if not found then
    raise exception 'La tienda no tiene suscripción';
  end if;
  -- Doble control (la app ya lo verificó): el aviso tiene que ser del
  -- preapproval que inició esta tienda y la tienda tiene que estar en MP.
  if v_sub.provider is distinct from 'mercadopago' or v_sub.provider_ref is distinct from p_provider_ref then
    raise exception 'La suscripción no coincide con la referencia de MercadoPago';
  end if;

  if p_status is null then
    update public.subscriptions
       set provider_status = coalesce(p_provider_status, provider_status)
     where store_id = p_store_id
     returning * into v_sub;
  else
    if p_status not in ('active', 'past_due', 'cancelled') then
      raise exception 'Estado inválido';
    end if;
    if not exists (select 1 from public.plans where code = p_plan_code) then
      raise exception 'El plan no existe';
    end if;
    update public.subscriptions
       set plan_code = p_plan_code,
           status = p_status,
           current_period_start = coalesce(p_period_start, current_period_start),
           current_period_end = coalesce(p_period_end, current_period_end),
           provider_status = coalesce(p_provider_status, provider_status),
           cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
           last_payment_at = greatest(last_payment_at, p_last_payment_at),
           provider_plan_code = p_plan_code
     where store_id = p_store_id
     returning * into v_sub;
  end if;

  return jsonb_build_object(
    'store_id', v_sub.store_id,
    'plan_code', v_sub.plan_code,
    'status', v_sub.status,
    'provider_status', v_sub.provider_status,
    'current_period_end', v_sub.current_period_end,
    'cancel_at_period_end', v_sub.cancel_at_period_end
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 6. current_plan (copia de 0011 + vencimientos de MercadoPago)
-- ---------------------------------------------------------------------
create or replace function public.current_plan(p_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_code text;
  v_status text;
  v_plan public.plans;
begin
  if not public.is_store_member(p_store_id) then
    raise exception 'No autorizado';
  end if;
  select * into v_sub from public.subscriptions where store_id = p_store_id;
  if not found then
    v_code := 'free';
    v_status := 'active';
  elsif v_sub.status = 'trialing' and v_sub.trial_ends_at is not null and v_sub.trial_ends_at < now() then
    v_code := 'free';
    v_status := 'active';
  elsif v_sub.status = 'cancelled' then
    v_code := 'free';
    v_status := 'cancelled';
  -- 0015: renovación cancelada y período terminado.
  elsif v_sub.cancel_at_period_end and v_sub.current_period_end is not null and v_sub.current_period_end < now() then
    v_code := 'free';
    v_status := 'cancelled';
  -- 0015: MercadoPago sin cobro confirmado 7 días después del fin del período.
  elsif v_sub.provider = 'mercadopago' and v_sub.status in ('active', 'past_due')
        and v_sub.current_period_end is not null and v_sub.current_period_end < now() - interval '7 days' then
    v_code := 'free';
    v_status := 'active';
  else
    v_code := v_sub.plan_code;
    v_status := v_sub.status;
  end if;
  select * into v_plan from public.plans where code = v_code;
  return jsonb_build_object(
    'code', v_plan.code,
    'name', v_plan.name,
    'price_monthly', v_plan.price_monthly,
    'currency', v_plan.currency,
    'status', v_status,
    'trial_ends_at', case when v_status = 'trialing' then v_sub.trial_ends_at end,
    'current_period_end', v_sub.current_period_end,
    'cancel_at_period_end', coalesce(v_sub.cancel_at_period_end, false),
    'features', v_plan.features,
    'limits', v_plan.limits
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Vencimientos de MercadoPago + mantenimiento diario
-- ---------------------------------------------------------------------
create or replace function public.billing_expire_subscriptions()
returns int
language sql
security definer
set search_path = ''
as $$
  with upd as (
    update public.subscriptions
       set plan_code = 'free',
           status = 'active',
           cancel_at_period_end = false,
           notes = trim(coalesce(notes, '') || ' ' ||
             case when cancel_at_period_end then 'Renovación cancelada: pasó a Free el '
                  else 'Sin cobro confirmado en MercadoPago: pasó a Free el ' end
             || to_char(now(), 'YYYY-MM-DD') || '.')
     where plan_code <> 'free'
       and status in ('active', 'past_due')
       and current_period_end is not null
       and (
         (cancel_at_period_end and current_period_end < now())
         or (provider = 'mercadopago' and current_period_end < now() - interval '7 days')
       )
    returning 1
  )
  select count(*)::int from upd;
$$;

create or replace function public.run_daily_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trials int;
  v_orders int;
  v_subs int;
begin
  v_trials := public.expire_trials();
  v_orders := private.expire_unpaid_orders(null);
  v_subs := public.billing_expire_subscriptions(); -- 0015
  return jsonb_build_object('trials_expired', v_trials, 'orders_expired', v_orders, 'subscriptions_expired', v_subs, 'ran_at', now());
end;
$$;

-- ---------------------------------------------------------------------
-- 8. platform_set_plan (copia de 0011): un cambio manual pasa a 'manual'
-- ---------------------------------------------------------------------
create or replace function public.platform_set_plan(
  p_store_id uuid,
  p_plan_code text,
  p_status text,
  p_trial_ends_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'No autorizado';
  end if;
  if not exists (select 1 from public.plans where code = p_plan_code) then
    raise exception 'El plan no existe';
  end if;
  if p_status not in ('trialing', 'active', 'past_due', 'cancelled') then
    raise exception 'Estado inválido';
  end if;
  if p_status = 'trialing' and p_trial_ends_at is null then
    raise exception 'Indicá hasta cuándo dura la prueba';
  end if;
  insert into public.subscriptions (store_id, plan_code, status, trial_ends_at, current_period_start, provider)
  values (p_store_id, p_plan_code, p_status, case when p_status = 'trialing' then p_trial_ends_at end, now(), 'manual')
  on conflict (store_id) do update
     set plan_code = excluded.plan_code,
         status = excluded.status,
         trial_ends_at = excluded.trial_ends_at,
         current_period_start = case when public.subscriptions.plan_code is distinct from excluded.plan_code
                                     then now() else public.subscriptions.current_period_start end,
         -- 0015: extender la prueba no toca el cobro; cualquier otro cambio manual sí.
         provider = case when excluded.status = 'trialing' then coalesce(public.subscriptions.provider, 'manual') else 'manual' end,
         cancel_at_period_end = case when excluded.status = 'trialing' then public.subscriptions.cancel_at_period_end else false end;
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke execute on function public.billing_start_checkout(uuid, text, text) from public, anon;
grant execute on function public.billing_start_checkout(uuid, text, text) to authenticated;

revoke execute on function public.billing_apply_subscription(uuid, text, text, text, timestamptz, timestamptz, text, boolean, timestamptz)
  from public, anon, authenticated;
grant execute on function public.billing_apply_subscription(uuid, text, text, text, timestamptz, timestamptz, text, boolean, timestamptz)
  to service_role;

revoke execute on function public.billing_expire_subscriptions() from public, anon, authenticated;

-- Versión del esquema que espera el código (src/lib/version.ts → SCHEMA_VERSION).
-- Nunca la baja: si 0016 (esquema 7) se aplicó antes, queda en 7.
insert into public.app_meta (key, value) values ('schema_version', '6'::jsonb)
  on conflict (key) do update
     set value = to_jsonb(greatest(coalesce((public.app_meta.value #>> '{}')::int, 0), 6)),
         updated_at = now();
