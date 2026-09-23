-- =====================================================================
-- 0019 · Plan anual: 12 meses por el precio de 10 (docs/BILLING.md, docs/MARKETING.md §5.2)
--
-- Idempotente (`if not exists`, `create or replace`, `drop function if
-- exists` antes de cambiar una firma). Los cuerpos copiados de 0015 / 0011
-- llevan los agregados marcados "0019".
--
-- 1. plans.price_yearly (null = el plan no tiene pago anual) y
--    plans.mp_plan_id_yearly (id del `preapproval_plan` de MercadoPago con
--    frecuencia de 12 meses; null = el pago anual con MercadoPago se crea sin
--    plan asociado, con el precio anual cada 12 meses).
-- 2. subscriptions.billing_period ('monthly' | 'yearly'): periodicidad del
--    plan vigente. subscriptions.provider_billing_period: la del checkout de
--    MercadoPago en curso / aplicado (como provider_plan_code; sólo
--    informativo, el webhook la saca del preapproval en MP).
-- 3. billing_start_checkout(): acepta p_billing_period (default 'monthly').
--    Anual: el plan tiene que tener price_yearly.
-- 4. billing_apply_subscription(): acepta p_billing_period (default
--    'monthly') y lo guarda cuando cambia el plan o el estado.
-- 5. current_plan(): devuelve además billing_period y price_yearly.
--    Free y la prueba cuentan siempre como mensual.
-- 6. platform_set_plan(): acepta p_billing_period opcional (default
--    'monthly'). Extender la prueba no toca la periodicidad.
-- 7. platform_list_stores(): devuelve además billing_period.
--
-- billing_expire_subscriptions() no cambia: el vencimiento sale de
-- current_period_end, que para el anual es el `next_payment_date` de MP
-- (12 meses después del cobro).
--
-- Requiere 0015. Respecto del deploy del código, el orden da igual: sin esta
-- migración la app no ofrece el pago anual (los campos faltan → sin anual) y
-- todo sigue mensual como antes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1-2. Columnas
-- ---------------------------------------------------------------------
alter table public.plans add column if not exists price_yearly numeric(12, 2)
  check (price_yearly is null or price_yearly > 0);
alter table public.plans add column if not exists mp_plan_id_yearly text;

alter table public.subscriptions add column if not exists billing_period text not null default 'monthly'
  check (billing_period in ('monthly', 'yearly'));
alter table public.subscriptions add column if not exists provider_billing_period text
  check (provider_billing_period is null or provider_billing_period in ('monthly', 'yearly'));

-- ---------------------------------------------------------------------
-- 3. billing_start_checkout (copia de 0015 + período)
-- ---------------------------------------------------------------------
drop function if exists public.billing_start_checkout(uuid, text, text);

create or replace function public.billing_start_checkout(
  p_store_id uuid,
  p_plan_code text,
  p_provider_ref text,
  p_billing_period text default 'monthly'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_period text := coalesce(p_billing_period, 'monthly');
begin
  if p_store_id is null or not exists (select 1 from public.stores where id = p_store_id) then
    raise exception 'La tienda no existe';
  end if;
  -- 0019: período válido; el anual necesita precio anual (con o sin plan de MP asociado).
  if v_period not in ('monthly', 'yearly') then
    raise exception 'Periodicidad inválida';
  end if;
  if v_period = 'monthly' and (p_plan_code is null or not exists (select 1 from public.plans where code = p_plan_code and mp_plan_id is not null)) then
    raise exception 'Ese plan no se puede pagar con MercadoPago';
  end if;
  if v_period = 'yearly' and (p_plan_code is null or not exists (select 1 from public.plans where code = p_plan_code and price_yearly > 0)) then
    raise exception 'Ese plan no tiene pago anual';
  end if;
  if p_provider_ref is null or p_provider_ref !~ '^[A-Za-z0-9_-]{1,80}$' then
    raise exception 'Referencia inválida';
  end if;
  select * into v_sub from public.subscriptions where store_id = p_store_id for update;
  -- Con una suscripción de MP cobrando (o autorizada esperando el primer
  -- cobro), primero hay que cancelar la renovación.
  if found and v_sub.provider = 'mercadopago' and v_sub.provider_status in ('authorized', 'authorized_unpaid', 'paused')
     and not v_sub.cancel_at_period_end then
    raise exception 'Ya tenés una suscripción activa en MercadoPago: cancelá la renovación antes de cambiar de plan';
  end if;
  insert into public.subscriptions (store_id, plan_code, status, provider, provider_ref, provider_status, provider_plan_code, provider_billing_period)
  values (p_store_id, 'free', 'active', 'mercadopago', p_provider_ref, 'pending', p_plan_code, v_period)
  on conflict (store_id) do update
     set provider = 'mercadopago',
         provider_ref = excluded.provider_ref,
         provider_status = 'pending',
         provider_plan_code = excluded.provider_plan_code,
         provider_billing_period = excluded.provider_billing_period; -- 0019
end;
$$;

-- ---------------------------------------------------------------------
-- 4. billing_apply_subscription (copia de 0015 + período)
-- ---------------------------------------------------------------------
drop function if exists public.billing_apply_subscription(uuid, text, text, text, timestamptz, timestamptz, text, boolean, timestamptz, boolean);

create or replace function public.billing_apply_subscription(
  p_store_id uuid,
  p_plan_code text,
  p_status text,
  p_provider_ref text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_provider_status text,
  p_cancel_at_period_end boolean default false,
  p_last_payment_at timestamptz default null,
  p_adopt boolean default false,
  p_billing_period text default 'monthly'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_period text := coalesce(p_billing_period, 'monthly');
begin
  if p_provider_ref is null or p_provider_ref = '' then
    raise exception 'Falta la referencia de MercadoPago';
  end if;
  if v_period not in ('monthly', 'yearly') then -- 0019
    raise exception 'Periodicidad inválida';
  end if;
  select * into v_sub from public.subscriptions where store_id = p_store_id for update;
  if not found then
    raise exception 'La tienda no tiene suscripción';
  end if;
  -- Doble control (la app ya lo verificó): el aviso tiene que ser del
  -- preapproval que inició esta tienda y la tienda tiene que estar en MP.
  if v_sub.provider is distinct from 'mercadopago' then
    raise exception 'La suscripción no coincide con la referencia de MercadoPago';
  end if;
  if v_sub.provider_ref is distinct from p_provider_ref then
    if not coalesce(p_adopt, false)
       or coalesce(v_sub.provider_status, 'pending') not in ('pending', 'cancelled', 'expired')
       or p_status is distinct from 'active' then
      raise exception 'La suscripción no coincide con la referencia de MercadoPago';
    end if;
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
           provider_ref = p_provider_ref,
           provider_status = coalesce(p_provider_status, provider_status),
           cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
           last_payment_at = greatest(last_payment_at, p_last_payment_at),
           provider_plan_code = p_plan_code,
           billing_period = v_period,          -- 0019
           provider_billing_period = v_period  -- 0019
     where store_id = p_store_id
     returning * into v_sub;
  end if;

  return jsonb_build_object(
    'store_id', v_sub.store_id,
    'plan_code', v_sub.plan_code,
    'status', v_sub.status,
    'billing_period', v_sub.billing_period,
    'provider_ref', v_sub.provider_ref,
    'provider_status', v_sub.provider_status,
    'current_period_end', v_sub.current_period_end,
    'cancel_at_period_end', v_sub.cancel_at_period_end
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5. current_plan (copia de 0015 + billing_period y price_yearly)
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
  elsif v_sub.cancel_at_period_end and v_sub.status in ('active', 'past_due')
        and v_sub.current_period_end is not null and v_sub.current_period_end < now() then
    v_code := 'free';
    v_status := 'cancelled';
  -- 0015: MercadoPago autorizó pero el primer cobro no llegó en los 7 días de gracia.
  elsif v_sub.provider = 'mercadopago' and v_sub.provider_status = 'authorized_unpaid' and v_sub.status in ('active', 'past_due')
        and v_sub.current_period_end is not null and v_sub.current_period_end < now() then
    v_code := 'free';
    v_status := 'active';
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
    'price_yearly', v_plan.price_yearly, -- 0019
    'currency', v_plan.currency,
    'status', v_status,
    -- 0019: Free y la prueba son siempre mensuales.
    'billing_period', case when v_code = 'free' or v_status = 'trialing' then 'monthly'
                           else coalesce(v_sub.billing_period, 'monthly') end,
    'trial_ends_at', case when v_status = 'trialing' then v_sub.trial_ends_at end,
    'current_period_end', v_sub.current_period_end,
    'cancel_at_period_end', coalesce(v_sub.cancel_at_period_end, false),
    'features', v_plan.features,
    'limits', v_plan.limits
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 6. platform_set_plan (copia de 0015 + período)
-- ---------------------------------------------------------------------
drop function if exists public.platform_set_plan(uuid, text, text, timestamptz);

create or replace function public.platform_set_plan(
  p_store_id uuid,
  p_plan_code text,
  p_status text,
  p_trial_ends_at timestamptz default null,
  p_billing_period text default 'monthly'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- 0019: Free siempre es mensual.
  v_period text := case when p_plan_code = 'free' then 'monthly' else coalesce(p_billing_period, 'monthly') end;
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
  if v_period not in ('monthly', 'yearly') then -- 0019
    raise exception 'Periodicidad inválida';
  end if;
  insert into public.subscriptions (store_id, plan_code, status, trial_ends_at, current_period_start, provider, billing_period)
  values (p_store_id, p_plan_code, p_status, case when p_status = 'trialing' then p_trial_ends_at end, now(), 'manual',
          case when p_status = 'trialing' then 'monthly' else v_period end)
  on conflict (store_id) do update
     set plan_code = excluded.plan_code,
         status = excluded.status,
         trial_ends_at = excluded.trial_ends_at,
         current_period_start = case when public.subscriptions.plan_code is distinct from excluded.plan_code
                                     then now() else public.subscriptions.current_period_start end,
         -- 0015: extender la prueba no toca el cobro; cualquier otro cambio manual sí.
         provider = case when excluded.status = 'trialing' then coalesce(public.subscriptions.provider, 'manual') else 'manual' end,
         cancel_at_period_end = case when excluded.status = 'trialing' then public.subscriptions.cancel_at_period_end else false end,
         -- 0019: extender la prueba tampoco toca la periodicidad.
         billing_period = case when excluded.status = 'trialing' then public.subscriptions.billing_period else v_period end;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. platform_list_stores (copia de 0011 + billing_period al final)
-- ---------------------------------------------------------------------
drop function if exists public.platform_list_stores();

create or replace function public.platform_list_stores()
returns table (
  id uuid,
  slug text,
  name text,
  status text,
  owner_email text,
  plan_code text,
  sub_status text,
  trial_ends_at timestamptz,
  products bigint,
  orders bigint,
  created_at timestamptz,
  billing_period text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'No autorizado';
  end if;
  return query
    select s.id, s.slug, s.name, s.status, p.email, sub.plan_code, sub.status, sub.trial_ends_at,
           (select count(*) from public.products pr where pr.store_id = s.id),
           (select count(*) from public.orders o where o.store_id = s.id),
           s.created_at,
           sub.billing_period -- 0019
      from public.stores s
      left join public.profiles p on p.id = s.owner_id
      left join public.subscriptions sub on sub.store_id = s.id
     order by s.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos (las funciones recreadas con `drop` vuelven con EXECUTE para PUBLIC)
-- ---------------------------------------------------------------------
revoke execute on function public.billing_start_checkout(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.billing_start_checkout(uuid, text, text, text) to service_role;

revoke execute on function public.billing_apply_subscription(uuid, text, text, text, timestamptz, timestamptz, text, boolean, timestamptz, boolean, text)
  from public, anon, authenticated;
grant execute on function public.billing_apply_subscription(uuid, text, text, text, timestamptz, timestamptz, text, boolean, timestamptz, boolean, text)
  to service_role;

revoke execute on function public.platform_set_plan(uuid, text, text, timestamptz, text) from public, anon;
grant execute on function public.platform_set_plan(uuid, text, text, timestamptz, text) to authenticated;

revoke execute on function public.platform_list_stores() from public, anon;
grant execute on function public.platform_list_stores() to authenticated;

-- Versión del esquema que espera el código (src/lib/version.ts → SCHEMA_VERSION).
-- `greatest`: aplicarla fuera de orden no baja la versión.
insert into public.app_meta (key, value) values ('schema_version', '10'::jsonb)
  on conflict (key) do update
     set value = to_jsonb(greatest(coalesce((public.app_meta.value #>> '{}')::int, 0), 10)),
         updated_at = now();
