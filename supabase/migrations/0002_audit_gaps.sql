-- =====================================================================
-- 0002 · Gaps P0 de la auditoría de producto (docs/ECOMMY-SPEC.md §13)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Productos: ficha técnica, relacionados manuales, alícuota de IVA
-- ---------------------------------------------------------------------
alter table public.products
  add column if not exists specs jsonb not null default '[]'::jsonb,
  add column if not exists related_ids uuid[] not null default '{}',
  add column if not exists vat_percent numeric(5, 2)
    check (vat_percent is null or (vat_percent >= 0 and vat_percent <= 100));

comment on column public.products.specs is 'Ficha técnica: [{label, value}]';
comment on column public.products.related_ids is 'Productos relacionados elegidos a mano (prioridad sobre los automáticos)';
comment on column public.products.vat_percent is 'Alícuota de IVA del producto; null = usa store_settings.tax.default_vat_percent';

-- Facetas por opción (Talle, Color…) en el storefront.
create index if not exists product_variants_option_values_gin
  on public.product_variants using gin (option_values jsonb_path_ops);

-- ---------------------------------------------------------------------
-- Pedidos: vencimiento de reserva, "visto" por el admin, nuevos eventos
-- ---------------------------------------------------------------------
alter table public.orders
  add column if not exists expires_at timestamptz,
  add column if not exists seen_at timestamptz;

create index if not exists orders_expires_at_idx
  on public.orders (expires_at)
  where status = 'pending' and payment_status = 'pending';

create index if not exists orders_seen_at_idx on public.orders (seen_at) where seen_at is null;

alter table public.order_events drop constraint if exists order_events_type_check;
alter table public.order_events add constraint order_events_type_check check (type in (
  'created', 'status_changed', 'payment_status_changed', 'payment_added', 'note', 'shipped',
  'tracking_updated', 'whatsapp_opened', 'stock_adjusted', 'cancelled',
  'printed', 'withdrawal_requested', 'expired', 'reservation_extended'
));

-- Al crear un pedido web impago se calcula la fecha de vencimiento de la reserva.
create or replace function private.set_order_expiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hours int;
begin
  if new.expires_at is null and new.payment_status = 'pending' and new.status = 'pending' then
    select coalesce((checkout ->> 'reservation_hours')::int, 48) into v_hours
      from public.store_settings where id = 1;
    if v_hours > 0 then
      new.expires_at := now() + make_interval(hours => v_hours);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_expiry on public.orders;
create trigger orders_set_expiry before insert on public.orders
  for each row execute function private.set_order_expiry();

-- Barrido de pedidos impagos vencidos: cancela y devuelve el stock.
create or replace function public.expire_unpaid_orders()
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
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  for v_order in
    select id, number from public.orders
    where status = 'pending' and payment_status = 'pending'
      and expires_at is not null and expires_at < now()
    for update skip locked
  loop
    update public.orders
      set status = 'cancelled', cancel_reason = 'expired', cancelled_at = now(), expires_at = null
      where id = v_order.id;

    for v_item in
      select oi.variant_id, oi.qty, oi.name from public.order_items oi
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

revoke execute on function public.expire_unpaid_orders() from public, anon;
grant execute on function public.expire_unpaid_orders() to authenticated;

-- Vista de stock bajo (umbral por variante o global).
create or replace view public.low_stock_variants
with (security_invoker = true) as
select
  v.id as variant_id,
  v.product_id,
  p.name as product_name,
  p.slug as product_slug,
  v.title as variant_title,
  v.sku,
  v.stock,
  coalesce(v.low_stock_threshold, s.low_stock_threshold) as threshold
from public.product_variants v
join public.products p on p.id = v.product_id
cross join public.store_settings s
where s.id = 1
  and v.track_inventory
  and v.is_active
  and p.status <> 'archived'
  and v.stock <= coalesce(v.low_stock_threshold, s.low_stock_threshold);

-- ---------------------------------------------------------------------
-- store_settings: nuevos bloques jsonb con defaults
-- ---------------------------------------------------------------------
alter table public.store_settings
  add column if not exists tax jsonb not null default
    '{"show_net_price": false, "default_vat_percent": 21, "label": "Precio sin impuestos nacionales"}'::jsonb,
  add column if not exists legal jsonb not null default
    '{"country": "AR", "consumer_defense_link": true, "data_fiscal": {"image_url": null, "href": null}, "cuit": null, "razon_social": null}'::jsonb,
  add column if not exists integrations jsonb not null default
    '{"ga4_id": null, "gtm_id": null, "meta_pixel_id": null, "google_site_verification": null}'::jsonb,
  add column if not exists whatsapp_button jsonb not null default
    '{"enabled": true, "position": "right", "message_template": "Hola! Tengo una consulta.", "show_on_mobile": true, "show_on_desktop": true}'::jsonb,
  add column if not exists free_shipping_bar jsonb not null default
    '{"enabled": true, "threshold": null}'::jsonb,
  add column if not exists catalog jsonb not null default
    '{"out_of_stock_display": "show_last"}'::jsonb;

update public.store_settings
  set checkout = checkout || jsonb_build_object('reservation_hours', 48)
  where id = 1 and (checkout ->> 'reservation_hours') is null;

-- ---------------------------------------------------------------------
-- Páginas: slugs reservados adicionales
-- ---------------------------------------------------------------------
alter table public.pages drop constraint if exists pages_slug_check;
alter table public.pages add constraint pages_slug_check check (
  slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  and (slug = 'home' or slug not in (
    'productos', 'producto', 'categoria', 'carrito', 'checkout', 'pedido', 'admin', 'api', 'buscar', '_next',
    'arrepentimiento', 'politicas', 'sitemap', 'robots', 'feeds'
  ))
);

-- ---------------------------------------------------------------------
-- Redirecciones 301
-- ---------------------------------------------------------------------
create table if not exists public.redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique check (from_path ~ '^/' and from_path <> '/'),
  to_path text not null check (to_path ~ '^(/|https?://)'),
  hits int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.redirects enable row level security;

create policy "redirects_public_read" on public.redirects
  for select to anon, authenticated using (true);
create policy "redirects_admin_insert" on public.redirects
  for insert to authenticated with check ((select public.is_admin()));
create policy "redirects_admin_update" on public.redirects
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "redirects_admin_delete" on public.redirects
  for delete to authenticated using ((select public.is_admin()));

-- Contador de hits sin exponer UPDATE al público.
create or replace function public.hit_redirect(p_from_path text)
returns text
language sql
security definer
set search_path = ''
as $$
  update public.redirects set hits = hits + 1 where from_path = p_from_path returning to_path;
$$;
grant execute on function public.hit_redirect(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Botón de arrepentimiento (Res. SCI 424/2020)
-- ---------------------------------------------------------------------
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  order_number bigint,
  order_id uuid references public.orders (id) on delete set null,
  name text not null,
  contact text not null,
  reason text,
  status text not null default 'new' check (status in ('new', 'processed', 'rejected')),
  admin_notes text,
  processed_by uuid references auth.users (id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists withdrawal_requests_status_idx on public.withdrawal_requests (status, created_at desc);

create trigger withdrawal_requests_set_updated_at before update on public.withdrawal_requests
  for each row execute function public.set_updated_at();

alter table public.withdrawal_requests enable row level security;

create policy "withdrawal_admin_select" on public.withdrawal_requests
  for select to authenticated using ((select public.is_admin()));
create policy "withdrawal_admin_update" on public.withdrawal_requests
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "withdrawal_admin_delete" on public.withdrawal_requests
  for delete to authenticated using ((select public.is_admin()));

-- Alta pública (sin registro). Devuelve el código de revocación.
create or replace function public.create_withdrawal_request(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(coalesce(payload ->> 'name', ''));
  v_contact text := trim(coalesce(payload ->> 'contact', ''));
  v_reason text := nullif(trim(coalesce(payload ->> 'reason', '')), '');
  v_number bigint := nullif(payload ->> 'order_number', '')::bigint;
  v_order_id uuid;
  v_code text;
  v_recent int;
begin
  if length(v_name) < 2 then
    raise exception 'Ingresá tu nombre';
  end if;
  if length(v_contact) < 5 then
    raise exception 'Ingresá un email o teléfono de contacto';
  end if;

  -- Freno simple: máximo 5 solicitudes por contacto por hora.
  select count(*) into v_recent from public.withdrawal_requests
    where contact = v_contact and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'Demasiadas solicitudes. Probá de nuevo más tarde.';
  end if;

  if v_number is not null then
    select id into v_order_id from public.orders where number = v_number;
  end if;

  v_code := 'ARR-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));

  insert into public.withdrawal_requests (code, order_number, order_id, name, contact, reason)
    values (v_code, v_number, v_order_id, v_name, v_contact, v_reason);

  if v_order_id is not null then
    insert into public.order_events (order_id, type, message, data, visible_to_customer)
      values (v_order_id, 'withdrawal_requested',
        format('Solicitud de arrepentimiento %s', v_code),
        jsonb_build_object('code', v_code, 'contact', v_contact), true);
  end if;

  return jsonb_build_object('code', v_code, 'order_found', v_order_id is not null);
end;
$$;

revoke execute on function public.create_withdrawal_request(jsonb) from public;
grant execute on function public.create_withdrawal_request(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Versión del esquema
-- ---------------------------------------------------------------------
insert into public.app_meta (key, value) values ('schema_version', '2'::jsonb)
  on conflict (key) do update set value = '2'::jsonb;
