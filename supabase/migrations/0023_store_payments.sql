-- =====================================================================
-- 0023 · Cobro online en las tiendas: tarjeta y cuotas con Mercado Pago
--        Spec: docs/PAYMENTS.md §3.
--
-- Idempotente (`if not exists`, `create or replace`, `drop … if exists`).
--
-- 1. payment_methods.type admite 'mercadopago' (uno por tienda, code
--    'mercadopago'). Trigger: no se activa sin cuenta conectada.
-- 2. store_payment_accounts: cuenta de MP del comercio (OAuth). Tokens
--    cifrados por la app (AES-256-GCM); RLS sin políticas = sólo service_role.
-- 3. store_payment_account_status(store): lo no secreto, para el equipo.
--    store_payments_online(store): ¿cobra online? (anon).
-- 4. plans.payment_fee_percent: comisión de Ecommy por venta online
--    (marketplace_fee). 0 en todos los planes.
-- 5. orders.payment_provider / payment_provider_ref / payment_detail;
--    índice único de pagos de MP por tienda (idempotencia del webhook).
-- 6. payments_apply_mp_payment(...): sólo service_role (webhook).
--    payments_store_context(store): sólo service_role (fee + datos).
-- 7. expire_unpaid_orders no vence pedidos con un pago de MP en revisión.
-- 8. schema_version = 14 (con greatest).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Método de pago 'mercadopago'
-- ---------------------------------------------------------------------
alter table public.payment_methods drop constraint if exists payment_methods_type_check;
alter table public.payment_methods add constraint payment_methods_type_check
  check (type in ('transfer', 'whatsapp', 'cash', 'other', 'mercadopago'));

-- ---------------------------------------------------------------------
-- 2. Cuenta de Mercado Pago del comercio
-- ---------------------------------------------------------------------
create table if not exists public.store_payment_accounts (
  store_id uuid not null references public.stores (id) on delete cascade,
  provider text not null default 'mercadopago' check (provider in ('mercadopago')),
  mp_user_id bigint,
  public_key text,
  live_mode boolean not null default true,
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  last_error text,
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_id, provider)
);
create index if not exists store_payment_accounts_connected_by_idx on public.store_payment_accounts (connected_by);
create index if not exists store_payment_accounts_expiry_idx
  on public.store_payment_accounts (token_expires_at) where status = 'connected';

-- RLS sin políticas: anon y authenticated no leen ni escriben (los tokens
-- sólo los toca el servidor con la service-role key).
alter table public.store_payment_accounts enable row level security;
revoke all on public.store_payment_accounts from anon, authenticated;

-- Activar el método sólo con la cuenta conectada.
create or replace function private.guard_mercadopago_method()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'mercadopago' and new.is_active and not exists (
    select 1 from public.store_payment_accounts a
     where a.store_id = new.store_id and a.provider = 'mercadopago' and a.status = 'connected'
  ) then
    raise exception 'Conectá tu cuenta de Mercado Pago antes de activar el cobro con tarjeta.';
  end if;
  return new;
end;
$$;

drop trigger if exists payment_methods_guard_mercadopago on public.payment_methods;
create trigger payment_methods_guard_mercadopago
  before insert or update of is_active, type on public.payment_methods
  for each row execute function private.guard_mercadopago_method();

-- ---------------------------------------------------------------------
-- 3. Estado de la cuenta (sin secretos) y "¿cobra online?"
-- ---------------------------------------------------------------------
create or replace function public.store_payment_account_status(p_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.store_payment_accounts;
begin
  if p_store_id is null or not public.is_store_admin(p_store_id) then
    raise exception 'No autorizado';
  end if;
  select * into a from public.store_payment_accounts where store_id = p_store_id and provider = 'mercadopago';
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'status', a.status,
    'mp_user_id', a.mp_user_id,
    'live_mode', a.live_mode,
    'connected_at', a.connected_at,
    'token_expires_at', a.token_expires_at,
    'last_error', a.last_error
  );
end;
$$;

create or replace function public.store_payments_online(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.store_payment_accounts a
      join public.payment_methods pm on pm.store_id = a.store_id and pm.type = 'mercadopago' and pm.is_active
     where a.store_id = p_store_id and a.provider = 'mercadopago' and a.status = 'connected'
  );
$$;

revoke execute on function public.store_payment_account_status(uuid) from public, anon;
grant execute on function public.store_payment_account_status(uuid) to authenticated;
revoke execute on function public.store_payments_online(uuid) from public;
grant execute on function public.store_payments_online(uuid) to anon, authenticated;
revoke execute on function private.guard_mercadopago_method() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Comisión de Ecommy por venta online
-- ---------------------------------------------------------------------
alter table public.plans add column if not exists payment_fee_percent numeric(5, 2) not null default 0;
alter table public.plans drop constraint if exists plans_payment_fee_percent_check;
alter table public.plans add constraint plans_payment_fee_percent_check
  check (payment_fee_percent >= 0 and payment_fee_percent <= 10);

-- ---------------------------------------------------------------------
-- 5. Pedidos
-- ---------------------------------------------------------------------
alter table public.orders add column if not exists payment_provider text;
alter table public.orders add column if not exists payment_provider_ref text;
alter table public.orders add column if not exists payment_detail jsonb;
alter table public.orders drop constraint if exists orders_payment_provider_check;
alter table public.orders add constraint orders_payment_provider_check
  check (payment_provider is null or payment_provider in ('mercadopago'));

create unique index if not exists order_payments_mp_reference_key
  on public.order_payments (store_id, reference)
  where method_code = 'mercadopago' and reference is not null;

-- ---------------------------------------------------------------------
-- 6. RPC del servidor (sólo service_role)
-- ---------------------------------------------------------------------

-- Contexto para armar la preferencia: comisión del plan vigente.
create or replace function public.payments_store_context(p_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_fee numeric(5, 2);
begin
  v_plan := private.store_plan_code(p_store_id);
  select coalesce(payment_fee_percent, 0) into v_fee from public.plans where code = v_plan;
  return jsonb_build_object('plan_code', v_plan, 'fee_percent', coalesce(v_fee, 0));
end;
$$;

-- Aplica un pago de MP ya verificado contra la API (src/lib/payments/webhook.ts).
create or replace function public.payments_apply_mp_payment(
  p_store_id uuid,
  p_order_id uuid,
  p_payment_id text,
  p_status text,
  p_amount numeric,
  p_detail jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_policy text;
  v_prev_status text;
  v_inserted int := 0;
  v_deleted int := 0;
  v_item record;
  v_note text;
  v_summary text;
  v_after text;
begin
  if p_payment_id is null or p_payment_id !~ '^[0-9]{1,20}$' then
    raise exception 'Pago inválido';
  end if;

  select * into o from public.orders where id = p_order_id and store_id = p_store_id for update;
  if not found then
    raise exception 'El pedido no es de esta tienda';
  end if;

  v_prev_status := o.payment_detail ->> 'status';
  v_summary := nullif(p_detail ->> 'summary', '');

  update public.orders
     set payment_provider = 'mercadopago',
         payment_detail = p_detail || jsonb_build_object('payment_id', p_payment_id, 'updated_at', now())
   where id = o.id;

  if p_status = 'approved' then
    v_note := 'Mercado Pago' || coalesce(' · ' || v_summary, '');
    insert into public.order_payments (store_id, order_id, amount, method_code, reference, paid_at, note)
    values (p_store_id, o.id, p_amount, 'mercadopago', p_payment_id,
            coalesce((p_detail ->> 'date_approved')::timestamptz, now()), v_note)
    on conflict (store_id, reference) where method_code = 'mercadopago' and reference is not null do nothing;
    get diagnostics v_inserted = row_count;

    if v_inserted > 0 then
      update public.orders set expires_at = null where id = o.id;
      select payment_status into v_after from public.orders where id = o.id;

      insert into public.order_events (store_id, order_id, type, message, visible_to_customer, data)
      values (p_store_id, o.id, 'payment_added',
              case when v_after = 'paid'
                   then 'Recibimos tu pago con Mercado Pago. El pedido está pago.'
                   else 'Recibimos un pago con Mercado Pago.' end,
              true,
              jsonb_build_object('amount', p_amount, 'method', 'mercadopago', 'reference', p_payment_id,
                                 'payment_status', v_after));

      if o.status = 'cancelled' then
        insert into public.order_events (store_id, order_id, type, message, visible_to_customer, data)
        values (p_store_id, o.id, 'note',
                'Entró un pago de Mercado Pago en un pedido cancelado: reactivalo o devolvé el dinero desde Mercado Pago.',
                false, jsonb_build_object('reference', p_payment_id));
      end if;

      -- Stock al pagar (misma regla que recordOrderPayment en src/lib/admin/order-ops.ts).
      select inventory_policy into v_policy from public.store_settings where store_id = p_store_id;
      if v_policy = 'on_paid' and v_after = 'paid' and o.status <> 'cancelled' and not exists (
        select 1 from public.inventory_movements m where m.order_id = o.id and m.reason = 'sale'
      ) then
        for v_item in
          select oi.variant_id, oi.qty
            from public.order_items oi
            join public.product_variants pv on pv.id = oi.variant_id
           where oi.order_id = o.id and oi.variant_id is not null and pv.track_inventory and oi.qty > 0
        loop
          perform private.adjust_stock(v_item.variant_id, -v_item.qty, 'sale', format('Pedido #%s', o.number), o.id);
        end loop;
      end if;
    end if;

  elsif p_status in ('refunded', 'charged_back') then
    delete from public.order_payments
     where store_id = p_store_id and order_id = o.id and method_code = 'mercadopago' and reference = p_payment_id;
    get diagnostics v_deleted = row_count;
    if v_deleted > 0 then
      if not exists (select 1 from public.order_payments where order_id = o.id) then
        update public.orders set payment_status = 'refunded', paid_at = null where id = o.id;
      end if;
      insert into public.order_events (store_id, order_id, type, message, visible_to_customer, data)
      values (p_store_id, o.id, 'payment_status_changed',
              case when p_status = 'refunded' then 'Se devolvió el pago de Mercado Pago.'
                   else 'El pago de Mercado Pago tuvo un contracargo.' end,
              p_status = 'refunded',
              jsonb_build_object('reference', p_payment_id, 'status', p_status));
    end if;

  elsif v_prev_status is distinct from p_status then
    insert into public.order_events (store_id, order_id, type, message, visible_to_customer, data)
    values (p_store_id, o.id, 'note',
            format('Mercado Pago: pago %s %s.', p_payment_id,
                   case p_status
                     when 'rejected' then 'rechazado'
                     when 'cancelled' then 'cancelado'
                     when 'in_process' then 'en revisión'
                     when 'pending' then 'pendiente'
                     when 'amount_mismatch' then 'aprobado por un monto distinto al del pedido (no se marcó pagado: revisalo)'
                     else coalesce(p_status, 'sin estado') end),
            false, jsonb_build_object('reference', p_payment_id, 'status', p_status,
                                      'status_detail', p_detail ->> 'status_detail'));
  end if;

  select payment_status into v_after from public.orders where id = o.id;
  return jsonb_build_object(
    'applied', v_inserted > 0 or v_deleted > 0,
    'payment_status', v_after,
    'order_number', o.number,
    'public_token', o.public_token,
    'notify', v_inserted > 0
  );
end;
$$;

revoke execute on function public.payments_store_context(uuid) from public, anon, authenticated;
grant execute on function public.payments_store_context(uuid) to service_role;
revoke execute on function public.payments_apply_mp_payment(uuid, uuid, text, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.payments_apply_mp_payment(uuid, uuid, text, text, numeric, jsonb) to service_role;

-- ---------------------------------------------------------------------
-- 7. Reservas: no vencer un pedido con un pago de MP en revisión (48 h)
-- ---------------------------------------------------------------------
create or replace function private.expire_unpaid_orders(p_store_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_item record;
  v_count int := 0;
begin
  for v_order in
    select id, number from public.orders
     where (p_store_id is null or store_id = p_store_id)
       and status = 'pending' and payment_status = 'pending'
       and expires_at is not null and expires_at < now()
       and not (
         payment_detail ->> 'status' in ('in_process', 'pending', 'authorized')
         and coalesce((payment_detail ->> 'updated_at')::timestamptz, created_at) > now() - interval '48 hours'
       )
       for update skip locked
  loop
    update public.orders
       set status = 'cancelled', cancel_reason = 'expired', cancelled_at = now(), expires_at = null
     where id = v_order.id;

    for v_item in
      select oi.variant_id, oi.qty from public.order_items oi
       where oi.order_id = v_order.id and oi.variant_id is not null
    loop
      if exists (
        select 1 from public.inventory_movements m
         where m.order_id = v_order.id and m.variant_id = v_item.variant_id and m.reason = 'sale'
      ) then
        perform private.adjust_stock(v_item.variant_id, v_item.qty, 'cancel',
          format('Pedido #%s vencido sin pago', v_order.number), v_order.id);
      end if;
    end loop;

    insert into public.order_events (order_id, type, message, visible_to_customer)
    values (v_order.id, 'expired', 'El pedido venció sin registrar el pago y se canceló automáticamente.', true);

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. schema_version = 14 (`greatest`: aplicarla fuera de orden no baja la versión)
-- ---------------------------------------------------------------------
insert into public.app_meta (key, value) values ('schema_version', '14'::jsonb)
  on conflict (key) do update
     set value = to_jsonb(greatest(coalesce((public.app_meta.value #>> '{}')::int, 0), 14)),
         updated_at = now();
