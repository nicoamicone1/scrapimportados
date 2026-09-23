-- =====================================================================
-- 0011 · Plataforma multi-tienda (docs/ECOMMY-SPEC.md §14.1)
-- =====================================================================
-- * stores, store_members, store_invites, plans, subscriptions.
-- * store_id en TODAS las tablas de tienda (+ índices y unique compuestos).
--   Las tablas "hijas" (imágenes, variantes, ítems de pedido, …) reciben el
--   store_id del padre con un trigger BEFORE INSERT/UPDATE: el valor que
--   manda la app se pisa con el del padre, así nunca hay filas cruzadas.
-- * profiles pierde role/is_active (el rol vive en store_members) y suma
--   is_platform_admin.
-- * Helpers de RLS: is_platform_admin(), admin_store_ids(), is_store_member(),
--   is_store_admin(), is_store_owner(), store_is_active(). Se reescriben
--   TODAS las policies.
-- * Funciones con store_id (create_order, validate_coupon, …) y nuevas:
--   create_store, check_store_slug, current_plan, expire_trials,
--   platform_*, invitaciones, run_daily_maintenance.
-- * Migración de datos: todo lo existente pasa a la tienda `demo`.
--   Las URLs de `media` se reescriben a `<demo_id>/…`; los OBJETOS se mueven
--   con `scripts/move-media-to-store.mts` (Storage API): renombrar
--   storage.objects por SQL no mueve el archivo físico.
-- Idempotente: se puede volver a correr sin romper nada.
-- =====================================================================

-- =====================================================================
-- 1. Tablas nuevas
-- =====================================================================

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 40),
  name text not null check (length(trim(name)) between 1 and 80),
  owner_id uuid references auth.users (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  custom_domain text unique check (custom_domain is null or custom_domain = lower(custom_domain)),
  custom_domain_verified boolean not null default false,
  next_order_number bigint not null default 1000,
  onboarding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stores_owner_idx on public.stores (owner_id);

create table if not exists public.store_members (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'staff')),
  is_active boolean not null default true,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index if not exists store_members_user_idx on public.store_members (user_id);
create index if not exists store_members_invited_by_idx on public.store_members (invited_by);

create table if not exists public.store_invites (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('admin', 'staff')),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default now() + interval '7 days',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (store_id, email)
);
create index if not exists store_invites_invited_by_idx on public.store_invites (invited_by);

create table if not exists public.plans (
  code text primary key check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  description text,
  price_monthly numeric(12, 2),
  currency text not null default 'ARS',
  position int not null default 0,
  is_public boolean not null default true,
  features jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores (id) on delete cascade,
  plan_code text not null references public.plans (code),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider text check (provider is null or provider in ('manual', 'mercadopago')),
  provider_ref text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_plan_idx on public.subscriptions (plan_code);

do $$
declare
  t text;
begin
  foreach t in array array['stores', 'plans', 'subscriptions'] loop
    if not exists (select 1 from pg_trigger where tgname = t || '_set_updated_at') then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
        t || '_set_updated_at', t
      );
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Planes (features/limits coherentes con src/lib/plans/features.ts).
-- `null` en un límite = ilimitado. No pisa ediciones hechas desde /platform.
-- ---------------------------------------------------------------------
insert into public.plans (code, name, description, price_monthly, currency, position, is_public, features, limits) values
  ('free', 'Free', 'Para empezar a vender sin costo.', 0, 'ARS', 0, true,
   '{"catalog.variants":true,"catalog.import_csv":false,"catalog.import_web":false,"pricing.bulk":false,
     "marketing.promotions":false,"marketing.coupons":true,"content.landings":false,"theme.custom_css":false,
     "theme.all_presets":false,"shipping.polygons":true,"orders.print":true,"orders.export":false,
     "analytics.integrations":false,"domain.custom":false,"team.members":false,"audit.log":false}',
   '{"products":50,"pages":1,"staff":1,"promotions":0,"coupons":3,"images_per_product":3,"import_jobs_month":0,"storage_mb":200}'),
  ('starter', 'Starter', 'Para tiendas que ya venden todos los días.', 14999, 'ARS', 1, true,
   '{"catalog.variants":true,"catalog.import_csv":true,"catalog.import_web":false,"pricing.bulk":false,
     "marketing.promotions":true,"marketing.coupons":true,"content.landings":true,"theme.custom_css":false,
     "theme.all_presets":true,"shipping.polygons":true,"orders.print":true,"orders.export":false,
     "analytics.integrations":true,"domain.custom":false,"team.members":true,"audit.log":false}',
   '{"products":500,"pages":6,"staff":3,"promotions":10,"coupons":20,"images_per_product":8,"import_jobs_month":10,"storage_mb":1000}'),
  ('pro', 'Pro', 'Catálogo grande, equipo y herramientas de volumen.', 34999, 'ARS', 2, true,
   '{"catalog.variants":true,"catalog.import_csv":true,"catalog.import_web":true,"pricing.bulk":true,
     "marketing.promotions":true,"marketing.coupons":true,"content.landings":true,"theme.custom_css":true,
     "theme.all_presets":true,"shipping.polygons":true,"orders.print":true,"orders.export":true,
     "analytics.integrations":true,"domain.custom":true,"team.members":true,"audit.log":true}',
   '{"products":null,"pages":null,"staff":10,"promotions":null,"coupons":null,"images_per_product":20,"import_jobs_month":null,"storage_mb":5000}'),
  ('business', 'Business', 'A medida: varias marcas, volumen alto, acompañamiento.', null, 'ARS', 3, true,
   '{"catalog.variants":true,"catalog.import_csv":true,"catalog.import_web":true,"pricing.bulk":true,
     "marketing.promotions":true,"marketing.coupons":true,"content.landings":true,"theme.custom_css":true,
     "theme.all_presets":true,"shipping.polygons":true,"orders.print":true,"orders.export":true,
     "analytics.integrations":true,"domain.custom":true,"team.members":true,"audit.log":true}',
   '{"products":null,"pages":null,"staff":null,"promotions":null,"coupons":null,"images_per_product":null,"import_jobs_month":null,"storage_mb":null}')
on conflict (code) do nothing;

-- =====================================================================
-- 2. profiles: is_platform_admin
-- =====================================================================
alter table public.profiles add column if not exists is_platform_admin boolean not null default false;

-- =====================================================================
-- 3. Tienda demo + miembros (a partir de los roles globales viejos)
-- =====================================================================
do $$
declare
  v_owner uuid;
  v_store uuid;
  v_has_role boolean := exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  );
begin
  select id into v_owner from auth.users where lower(email) = 'admin@ecommy.local' limit 1;

  insert into public.stores (slug, name, owner_id, status)
  values ('demo', 'Ecommy Demo', v_owner, 'active')
  on conflict (slug) do nothing;

  select id into v_store from public.stores where slug = 'demo';

  if v_has_role then
    execute $q$
      insert into public.store_members (store_id, user_id, role, is_active)
      select $1, p.id, p.role, p.is_active
        from public.profiles p
       where p.role in ('owner', 'admin', 'staff')
      on conflict (store_id, user_id) do nothing
    $q$ using v_store;
  end if;

  if v_owner is not null then
    insert into public.store_members (store_id, user_id, role, is_active)
    values (v_store, v_owner, 'owner', true)
    on conflict (store_id, user_id) do update set role = 'owner', is_active = true;
    update public.profiles set is_platform_admin = true where id = v_owner;
  end if;

  insert into public.subscriptions (store_id, plan_code, status, current_period_start, provider, notes)
  values (v_store, 'pro', 'active', now(), 'manual', 'Tienda demo de la plataforma')
  on conflict (store_id) do nothing;
end;
$$;

-- =====================================================================
-- 4. store_id en las tablas de tienda
-- =====================================================================
do $$
declare
  v_store uuid := (select id from public.stores where slug = 'demo');
  t text;
begin
  foreach t in array array[
    'store_settings', 'menus', 'categories', 'products', 'product_images', 'product_categories',
    'product_variants', 'inventory_movements', 'payment_methods', 'promotions', 'price_changes',
    'price_batches', 'coupons', 'coupon_redemptions', 'customers', 'orders', 'order_items',
    'order_events', 'order_payments', 'shipping_zones', 'pickup_locations', 'pages', 'page_drafts',
    'import_jobs', 'import_items', 'audit_log', 'redirects', 'withdrawal_requests'
  ] loop
    execute format('alter table public.%I add column if not exists store_id uuid', t);
    execute format('update public.%I set store_id = $1 where store_id is null', t) using v_store;
    execute format('alter table public.%I alter column store_id set not null', t);
    if not exists (
      select 1 from pg_constraint where conname = t || '_store_id_fkey' and conrelid = format('public.%I', t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (store_id) references public.stores (id) on delete cascade',
        t, t || '_store_id_fkey'
      );
    end if;
    execute format('create index if not exists %I on public.%I (store_id)', t || '_store_idx', t);
  end loop;
end;
$$;

-- store_settings: la pk pasa a store_id (se elimina el singleton id = 1).
-- Las vistas que cruzaban con `id = 1` se recrean más abajo.
drop view if exists public.low_stock_variants;
drop view if exists public.admin_products;
drop view if exists public.admin_inventory;
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'store_settings' and column_name = 'id'
  ) then
    alter table public.store_settings drop constraint if exists store_settings_pkey;
    alter table public.store_settings drop column id;
    alter table public.store_settings add constraint store_settings_pkey primary key (store_id);
  end if;
end;
$$;
drop index if exists public.store_settings_store_idx;

-- Unique globales → compuestos por tienda.
alter table public.menus drop constraint if exists menus_handle_key;
alter table public.categories drop constraint if exists categories_slug_key;
alter table public.categories drop constraint if exists categories_external_id_key;
alter table public.products drop constraint if exists products_slug_key;
alter table public.products drop constraint if exists products_source_external_id_key;
alter table public.payment_methods drop constraint if exists payment_methods_code_key;
alter table public.coupons drop constraint if exists coupons_code_key;
alter table public.customers drop constraint if exists customers_email_key;
alter table public.orders drop constraint if exists orders_number_key;
alter table public.pages drop constraint if exists pages_slug_key;
alter table public.redirects drop constraint if exists redirects_from_path_key;

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('menus', 'menus_store_handle_key', '(store_id, handle)'),
      ('categories', 'categories_store_slug_key', '(store_id, slug)'),
      ('categories', 'categories_store_external_id_key', '(store_id, external_id)'),
      ('products', 'products_store_slug_key', '(store_id, slug)'),
      ('products', 'products_store_source_external_id_key', '(store_id, source, external_id)'),
      ('payment_methods', 'payment_methods_store_code_key', '(store_id, code)'),
      ('coupons', 'coupons_store_code_key', '(store_id, code)'),
      ('customers', 'customers_store_email_key', '(store_id, email)'),
      ('orders', 'orders_store_number_key', '(store_id, number)'),
      ('pages', 'pages_store_slug_key', '(store_id, slug)'),
      ('redirects', 'redirects_store_from_path_key', '(store_id, from_path)')
    ) as x(tbl, name, cols)
  loop
    if not exists (select 1 from pg_constraint where conname = r.name) then
      execute format('alter table public.%I add constraint %I unique %s', r.tbl, r.name, r.cols);
    end if;
  end loop;
end;
$$;

-- Los unique compuestos que empiezan por store_id ya cubren el índice simple.
drop index if exists public.menus_store_idx;
drop index if exists public.categories_store_idx;
drop index if exists public.products_store_idx;
drop index if exists public.payment_methods_store_idx;
drop index if exists public.coupons_store_idx;
drop index if exists public.customers_store_idx;
drop index if exists public.orders_store_idx;
drop index if exists public.pages_store_idx;
drop index if exists public.redirects_store_idx;

create index if not exists orders_store_created_idx on public.orders (store_id, created_at desc);
create index if not exists products_store_status_idx on public.products (store_id, status);
create index if not exists audit_log_store_created_idx on public.audit_log (store_id, created_at desc);
drop index if exists public.audit_log_store_idx;

-- Numeración de pedidos por tienda (reemplaza order_number_seq).
update public.stores s
   set next_order_number = greatest(s.next_order_number, coalesce((select max(o.number) + 1 from public.orders o where o.store_id = s.id), 1000));
alter table public.orders alter column number drop default;
drop sequence if exists public.order_number_seq;

-- =====================================================================
-- 5. store_id de las tablas hijas = el del padre (trigger)
-- =====================================================================
create or replace function private.inherit_store_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_id uuid := (to_jsonb(new) ->> tg_argv[1])::uuid;
  v_store uuid;
begin
  if v_parent_id is null then
    return new;
  end if;
  execute format('select store_id from public.%I where id = $1', tg_argv[0]) into v_store using v_parent_id;
  if v_store is not null then
    new.store_id := v_store;
  end if;
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('product_images', 'products', 'product_id'),
      ('product_categories', 'products', 'product_id'),
      ('product_variants', 'products', 'product_id'),
      ('inventory_movements', 'product_variants', 'variant_id'),
      ('price_changes', 'product_variants', 'variant_id'),
      ('coupon_redemptions', 'coupons', 'coupon_id'),
      ('order_items', 'orders', 'order_id'),
      ('order_events', 'orders', 'order_id'),
      ('order_payments', 'orders', 'order_id'),
      ('page_drafts', 'pages', 'page_id'),
      ('import_items', 'import_jobs', 'job_id')
    ) as x(tbl, parent, col)
  loop
    execute format('drop trigger if exists %I on public.%I', r.tbl || '_inherit_store', r.tbl);
    execute format(
      'create trigger %I before insert or update of store_id, %I on public.%I for each row execute function private.inherit_store_id(%L, %L)',
      r.tbl || '_inherit_store', r.col, r.tbl, r.parent, r.col
    );
  end loop;
end;
$$;

-- =====================================================================
-- 6. Helpers de autorización
-- =====================================================================
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_platform_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- Tiendas donde el usuario actual es miembro ACTIVO (cualquier rol).
-- Las policies lo usan como `store_id = any ((select public.admin_store_ids())::uuid[])`
-- para que se evalúe una sola vez por consulta.
create or replace function public.admin_store_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.store_id), '{}')
    from public.store_members m
   where m.user_id = auth.uid() and m.is_active;
$$;

-- Miembro (activo o no) de la tienda, o superadmin.
create or replace function public.is_store_member(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.store_members m where m.store_id = p_store_id and m.user_id = auth.uid()
  );
$$;

-- Miembro activo (owner/admin/staff) o superadmin: puede operar la tienda.
create or replace function public.is_store_admin(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.store_members m
     where m.store_id = p_store_id and m.user_id = auth.uid() and m.is_active
  );
$$;

-- Dueño activo o superadmin: equipo, invitaciones.
create or replace function public.is_store_owner(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.store_members m
     where m.store_id = p_store_id and m.user_id = auth.uid() and m.is_active and m.role = 'owner'
  );
$$;

-- La tienda está publicada (lectura pública del storefront).
create or replace function public.store_is_active(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.stores s where s.id = p_store_id and s.status = 'active');
$$;

-- Storage: `media/<store_id>/…` sólo lo gestionan los miembros activos de esa tienda.
create or replace function public.can_manage_media(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_store uuid;
begin
  if public.is_platform_admin() then
    return true;
  end if;
  begin
    v_store := (storage.foldername(p_name))[1]::uuid;
  exception when others then
    return false;
  end;
  return v_store = any (public.admin_store_ids());
end;
$$;

-- =====================================================================
-- 7. Alta de usuario: el perfil ya no lleva rol
-- =====================================================================
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- La guardia de owners vive ahora en store_members.
drop trigger if exists profiles_guard_owner on public.profiles;
drop function if exists private.guard_profile_owner();

create or replace function private.guard_store_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_owner boolean := old.role = 'owner' and old.is_active;
  v_new_owner boolean;
begin
  if tg_op = 'DELETE' then
    v_new_owner := false;
  else
    v_new_owner := new.role = 'owner' and new.is_active;
  end if;

  if tg_op = 'UPDATE' and auth.uid() is not null and old.user_id = auth.uid()
     and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    raise exception 'No podés cambiar tu propio rol ni desactivar tu cuenta';
  end if;

  -- Si la tienda se está borrando (cascade) no hay nada que proteger.
  if v_old_owner and not v_new_owner
     and exists (select 1 from public.stores s where s.id = old.store_id) then
    perform pg_advisory_xact_lock(hashtext('ecommy.store_owner.' || old.store_id::text));
    if not exists (
      select 1 from public.store_members m
       where m.store_id = old.store_id and m.user_id <> old.user_id and m.role = 'owner' and m.is_active
    ) then
      raise exception 'La tienda tiene que tener al menos un dueño activo';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists store_members_guard_owner on public.store_members;
create trigger store_members_guard_owner
  before update or delete on public.store_members
  for each row execute function private.guard_store_owner();

-- La home no se puede borrar… salvo que se esté borrando la tienda entera.
create or replace function private.protect_home_page()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.slug = 'home' and exists (select 1 from public.stores s where s.id = old.store_id) then
    raise exception 'La página de inicio no se puede borrar';
  end if;
  return old;
end;
$$;

-- =====================================================================
-- 8. Funciones que cambian de firma (se borran las viejas)
-- =====================================================================
drop function if exists public.validate_coupon(text, numeric, jsonb, text);
drop function if exists public.hit_redirect(text);
drop function if exists public.expire_unpaid_orders();
drop function if exists public.admin_sales_series(timestamptz, timestamptz, text, text);
drop function if exists public.admin_top_products(timestamptz, timestamptz, int);
drop function if exists public.inventory_summary();
drop function if exists public.reorder_categories(jsonb);
drop function if exists public.pricing_scope_variants(jsonb);
drop function if exists public.pricing_scope_facets();
drop function if exists public.apply_price_changes(uuid, jsonb);
drop function if exists public.undo_price_batch(uuid);
drop function if exists public.admin_list_users();
drop function if exists private.promo_floor_price(uuid, numeric);

-- ---------------------------------------------------------------------
-- Inventario
-- ---------------------------------------------------------------------
create or replace function private.adjust_stock(
  p_variant_id uuid,
  p_delta int,
  p_reason text,
  p_note text default null,
  p_order_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_after int;
  v_store uuid;
begin
  update public.product_variants
     set stock = stock + p_delta
   where id = p_variant_id
  returning stock, store_id into v_after, v_store;

  if not found then
    raise exception 'La variante no existe';
  end if;

  insert into public.inventory_movements (store_id, variant_id, delta, stock_after, reason, note, order_id, created_by)
  values (v_store, p_variant_id, p_delta, v_after, p_reason, p_note, p_order_id, auth.uid());

  return v_after;
end;
$$;

create or replace function public.adjust_stock(
  p_variant_id uuid,
  p_delta int,
  p_reason text,
  p_note text default null,
  p_order_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store uuid;
begin
  select store_id into v_store from public.product_variants where id = p_variant_id;
  if v_store is null or not public.is_store_admin(v_store) then
    raise exception 'No autorizado';
  end if;
  if p_order_id is not null and not exists (
    select 1 from public.orders where id = p_order_id and store_id = v_store
  ) then
    raise exception 'El pedido no es de esta tienda';
  end if;
  return private.adjust_stock(p_variant_id, p_delta, p_reason, p_note, p_order_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Vencimiento de reservas
-- ---------------------------------------------------------------------
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
      from public.store_settings where store_id = new.store_id;
    if coalesce(v_hours, 48) > 0 then
      new.expires_at := now() + make_interval(hours => coalesce(v_hours, 48));
    end if;
  end if;
  return new;
end;
$$;

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

create or replace function public.expire_unpaid_orders(p_store_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_store_id is null or not public.is_store_admin(p_store_id) then
    raise exception 'No autorizado';
  end if;
  return private.expire_unpaid_orders(p_store_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Cupones (público)
-- ---------------------------------------------------------------------
create or replace function public.validate_coupon(
  p_store_id uuid,
  p_code text,
  p_subtotal numeric,
  p_items jsonb default '[]'::jsonb,
  p_email text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.coupons;
  v_email text := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_eligible numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_uses int;
begin
  select * into c from public.coupons
   where store_id = p_store_id and code = upper(trim(coalesce(p_code, '')));
  if not found or not c.is_active or not public.store_is_active(p_store_id) then
    return jsonb_build_object('valid', false, 'reason', 'El cupón no existe o no está activo');
  end if;
  if c.starts_at is not null and c.starts_at > now() then
    return jsonb_build_object('valid', false, 'reason', 'El cupón todavía no está vigente');
  end if;
  if c.ends_at is not null and c.ends_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'El cupón está vencido');
  end if;
  if c.max_uses is not null and c.uses_count >= c.max_uses then
    return jsonb_build_object('valid', false, 'reason', 'El cupón alcanzó su límite de usos');
  end if;
  if c.min_subtotal is not null and coalesce(p_subtotal, 0) < c.min_subtotal then
    return jsonb_build_object(
      'valid', false,
      'reason', format('El cupón requiere una compra mínima de $ %s', to_char(c.min_subtotal, 'FM999G999G990'))
    );
  end if;
  if v_email is not null and c.max_uses_per_customer is not null then
    select count(*) into v_uses from public.coupon_redemptions
     where coupon_id = c.id and customer_email = v_email;
    if v_uses >= c.max_uses_per_customer then
      return jsonb_build_object('valid', false, 'reason', 'Ya usaste este cupón');
    end if;
  end if;
  if v_email is not null and c.first_order_only then
    if exists (
      select 1 from public.orders o
       where o.store_id = p_store_id and lower(o.customer ->> 'email') = v_email and o.status <> 'cancelled'
    ) then
      return jsonb_build_object('valid', false, 'reason', 'El cupón es sólo para la primera compra');
    end if;
  end if;

  select coalesce(sum((i ->> 'unit_price')::numeric * (i ->> 'qty')::int), 0)
    into v_eligible
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
   where c.scope = 'all'
      or (c.scope = 'products' and (i ->> 'product_id')::uuid = any (c.product_ids))
      or (c.scope = 'categories' and exists (
            select 1 from public.product_categories pc
             where pc.product_id = (i ->> 'product_id')::uuid
               and pc.category_id = any (c.category_ids)
          ));

  if c.scope = 'all' and v_eligible = 0 then
    v_eligible := coalesce(p_subtotal, 0);
  end if;

  if c.type <> 'free_shipping' and v_eligible <= 0 then
    return jsonb_build_object('valid', false, 'reason', 'El cupón no aplica a los productos del carrito');
  end if;

  if c.type = 'percent' then
    v_discount := round(v_eligible * least(c.value, 100) / 100, 2);
  elsif c.type = 'fixed' then
    v_discount := least(c.value, v_eligible);
  end if;

  return jsonb_build_object(
    'valid', true,
    'id', c.id,
    'code', c.code,
    'type', c.type,
    'value', c.value,
    'scope', c.scope,
    'category_ids', to_jsonb(c.category_ids),
    'product_ids', to_jsonb(c.product_ids),
    'min_subtotal', c.min_subtotal,
    'eligible_subtotal', v_eligible,
    'discount', v_discount,
    'free_shipping', c.type = 'free_shipping'
  );
exception
  when invalid_text_representation then
    return jsonb_build_object('valid', false, 'reason', 'Datos del carrito inválidos');
end;
$$;

-- Piso de precio con promociones vigentes DE LA TIENDA (ver 0001).
create or replace function private.promo_floor_price(p_store_id uuid, p_product_id uuid, p_price numeric)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v numeric(12, 2) := p_price;
  v_cats uuid[];
  r record;
begin
  select coalesce(array_agg(category_id), '{}') into v_cats
    from public.product_categories where product_id = p_product_id;
  for r in
    select type, value from public.promotions
     where store_id = p_store_id and is_active and value > 0
       and (starts_at is null or starts_at <= now())
       and (ends_at is null or ends_at >= now())
       and (scope = 'all'
            or (scope = 'products' and p_product_id = any (product_ids))
            or (scope = 'categories' and category_ids && v_cats))
     order by priority desc
  loop
    if r.type = 'percent' then
      v := v - round(v * least(r.value, 100) / 100, 2);
    else
      v := v - least(r.value, v);
    end if;
  end loop;
  return greatest(v, 0);
end;
$$;

-- ---------------------------------------------------------------------
-- create_order (público): la tienda se deriva de las variantes.
-- ---------------------------------------------------------------------
create or replace function public.create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer jsonb := coalesce(payload -> 'customer', '{}'::jsonb);
  v_email text := lower(trim(coalesce(v_customer ->> 'email', '')));
  v_name text := trim(coalesce(v_customer ->> 'name', ''));
  v_phone text := nullif(trim(coalesce(v_customer ->> 'phone', '')), '');
  v_doc text := nullif(trim(coalesce(v_customer ->> 'doc', '')), '');
  v_fulfillment text := coalesce(payload ->> 'fulfillment', 'delivery');
  v_store uuid;
  v_settings public.store_settings;
  v_pm public.payment_methods;
  v_coupon public.coupons;
  v_zone public.shipping_zones;
  v_pickup_id uuid;
  v_zone_id uuid;
  v_zone_name text;
  v_item record;
  v_variant record;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_unit numeric(12, 2);
  v_image text;
  v_subtotal numeric(12, 2) := 0;
  v_promo numeric(12, 2) := 0;
  v_coupon_code text := nullif(upper(trim(coalesce(payload ->> 'coupon_code', ''))), '');
  v_coupon_discount numeric(12, 2) := 0;
  v_free_shipping boolean := false;
  v_base numeric(12, 2);
  v_payment_pct numeric(5, 2);
  v_payment_discount numeric(12, 2);
  v_shipping numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_customer_id uuid;
  v_order_id uuid;
  v_number bigint;
  v_token text;
  v_count int := 0;
begin
  if v_name = '' then
    raise exception 'Ingresá tu nombre';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ingresá un email válido';
  end if;
  if v_fulfillment not in ('delivery', 'pickup') then
    raise exception 'Elegí un método de entrega';
  end if;
  if jsonb_typeof(payload -> 'items') is distinct from 'array' or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'El carrito está vacío';
  end if;
  if jsonb_array_length(payload -> 'items') > 100 then
    raise exception 'El pedido tiene demasiados productos';
  end if;

  -- ---------- Tienda: la de las variantes (todas de la misma) ----------
  begin
    select min(v.store_id::text)::uuid, count(distinct v.store_id)
      into v_store, v_count
      from jsonb_array_elements(payload -> 'items') e
      join public.product_variants v on v.id = (e ->> 'variant_id')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'El pedido tiene datos inválidos';
  end;
  if v_store is null then
    raise exception 'Un producto del carrito ya no está disponible';
  end if;
  if v_count > 1 then
    raise exception 'El carrito tiene productos de otra tienda';
  end if;
  if nullif(payload ->> 'store_id', '') is not null and (payload ->> 'store_id')::uuid <> v_store then
    raise exception 'El carrito tiene productos de otra tienda';
  end if;
  if not public.store_is_active(v_store) then
    raise exception 'La tienda no está disponible';
  end if;
  v_count := 0;

  select * into v_settings from public.store_settings where store_id = v_store;
  if coalesce((v_settings.checkout ->> 'require_phone')::boolean, false) and v_phone is null then
    raise exception 'Ingresá tu teléfono';
  end if;

  select * into v_pm from public.payment_methods
   where store_id = v_store and code = payload ->> 'payment_method_code' and is_active;
  if not found then
    raise exception 'El método de pago elegido no está disponible';
  end if;

  begin
    for v_item in
      select (e ->> 'variant_id')::uuid as variant_id, sum((e ->> 'qty')::int)::int as qty
        from jsonb_array_elements(payload -> 'items') e
       group by 1
    loop
      if v_item.qty is null or v_item.qty <= 0 or v_item.qty > 999 then
        raise exception 'Cantidad inválida en el carrito';
      end if;

      select v.id, v.product_id, v.title, v.sku, v.price, v.stock, v.track_inventory, v.allow_backorder,
             v.is_active, v.image_id, p.name, p.status
        into v_variant
        from public.product_variants v
        join public.products p on p.id = v.product_id
       where v.id = v_item.variant_id and v.store_id = v_store
         for update of v;

      if not found or not v_variant.is_active or v_variant.status <> 'active' then
        raise exception 'Un producto del carrito ya no está disponible';
      end if;
      if v_variant.track_inventory and not v_variant.allow_backorder and v_variant.stock < v_item.qty then
        if v_variant.stock <= 0 then
          raise exception 'Sin stock de "%"', v_variant.name;
        end if;
        raise exception 'Sin stock suficiente para "%" (quedan %)', v_variant.name, v_variant.stock;
      end if;

      select (l ->> 'unit_price')::numeric into v_unit
        from jsonb_array_elements(coalesce(payload -> 'lines', '[]'::jsonb)) l
       where (l ->> 'variant_id')::uuid = v_item.variant_id
       limit 1;
      v_unit := greatest(
        private.promo_floor_price(v_store, v_variant.product_id, v_variant.price),
        least(coalesce(v_unit, v_variant.price), v_variant.price)
      );

      select coalesce(
               (select url from public.product_images where id = v_variant.image_id),
               (select url from public.product_images where product_id = v_variant.product_id
                 order by position, created_at limit 1)
             ) into v_image;

      v_lines := v_lines || jsonb_build_object(
        'product_id', v_variant.product_id,
        'variant_id', v_variant.id,
        'name', v_variant.name,
        'variant_title', case when v_variant.title = 'Default' then null else v_variant.title end,
        'sku', v_variant.sku,
        'image_url', v_image,
        'unit_price', v_unit,
        'list_price', v_variant.price,
        'qty', v_item.qty,
        'track', v_variant.track_inventory
      );
      v_subtotal := v_subtotal + v_variant.price * v_item.qty;
      v_promo := v_promo + (v_variant.price - v_unit) * v_item.qty;
      v_count := v_count + 1;
    end loop;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'El pedido tiene datos inválidos';
  end;

  if v_coupon_code is not null then
    select * into v_coupon from public.coupons where store_id = v_store and code = v_coupon_code for update;
    if not found or not v_coupon.is_active
       or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
       or (v_coupon.ends_at is not null and v_coupon.ends_at < now())
       or (v_coupon.max_uses is not null and v_coupon.uses_count >= v_coupon.max_uses)
       or (v_coupon.min_subtotal is not null and (v_subtotal - v_promo) < v_coupon.min_subtotal) then
      raise exception 'El cupón % ya no es válido', v_coupon_code;
    end if;
    if v_coupon.max_uses_per_customer is not null and (
      select count(*) from public.coupon_redemptions where coupon_id = v_coupon.id and customer_email = v_email
    ) >= v_coupon.max_uses_per_customer then
      raise exception 'Ya usaste el cupón %', v_coupon_code;
    end if;
    if v_coupon.first_order_only and exists (
      select 1 from public.orders o
       where o.store_id = v_store and lower(o.customer ->> 'email') = v_email and o.status <> 'cancelled'
    ) then
      raise exception 'El cupón % es sólo para la primera compra', v_coupon_code;
    end if;
    v_free_shipping := v_coupon.type = 'free_shipping';
    v_coupon_discount := greatest(0, least(
      coalesce((payload -> 'totals' ->> 'coupon_discount')::numeric, 0),
      v_subtotal - v_promo,
      case when v_coupon.type = 'fixed' then v_coupon.value
           when v_coupon.type = 'percent' then round((v_subtotal - v_promo) * least(v_coupon.value, 100) / 100, 2)
           else 0 end
    ));
  end if;

  v_base := v_subtotal - v_promo - v_coupon_discount;

  if v_fulfillment = 'pickup' then
    v_pickup_id := nullif(payload ->> 'pickup_location_id', '')::uuid;
    if v_pickup_id is not null and not exists (
      select 1 from public.pickup_locations where id = v_pickup_id and store_id = v_store and is_active
    ) then
      raise exception 'El punto de retiro elegido no está disponible';
    end if;
    v_shipping := 0;
  else
    v_zone_id := nullif(payload ->> 'shipping_zone_id', '')::uuid;
    if v_zone_id is not null then
      select * into v_zone from public.shipping_zones where id = v_zone_id and store_id = v_store and is_active;
      if not found then
        raise exception 'La zona de envío ya no está disponible';
      end if;
      v_zone_name := v_zone.name;
      v_shipping := case
        when v_free_shipping then 0
        when v_zone.free_over is not null and v_base >= v_zone.free_over then 0
        else v_zone.cost
      end;
    else
      v_zone_name := nullif(payload ->> 'shipping_zone_name', '');
      v_shipping := case when v_free_shipping then 0
                         else greatest(0, coalesce((payload ->> 'shipping_cost')::numeric, 0)) end;
    end if;
  end if;

  v_payment_pct := coalesce(v_pm.discount_percent, 0);
  v_payment_discount := round(v_base * v_payment_pct / 100, 2);
  v_total := v_base - v_payment_discount + v_shipping;

  if coalesce((v_settings.checkout ->> 'min_order_total')::numeric, 0) > 0
     and v_base < (v_settings.checkout ->> 'min_order_total')::numeric then
    raise exception 'El pedido mínimo es de $ %', to_char((v_settings.checkout ->> 'min_order_total')::numeric, 'FM999G999G990');
  end if;

  insert into public.customers (store_id, email, name, phone, doc_number, default_address)
  values (
    v_store, v_email, v_name, v_phone, v_doc,
    case when v_fulfillment = 'delivery' then payload -> 'shipping_address' else null end
  )
  on conflict (store_id, email) do update
     set name = excluded.name,
         phone = coalesce(excluded.phone, public.customers.phone),
         doc_number = coalesce(excluded.doc_number, public.customers.doc_number),
         default_address = coalesce(excluded.default_address, public.customers.default_address)
  returning id into v_customer_id;

  -- Número correlativo por tienda (fila bloqueada hasta el commit).
  update public.stores
     set next_order_number = next_order_number + 1
   where id = v_store
  returning next_order_number - 1 into v_number;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  insert into public.orders (
    store_id, number, public_token, customer_id, customer, payment_method_code, payment_discount_percent,
    payment_discount, fulfillment, shipping_zone_id, shipping_zone_name, shipping_cost, shipping_address,
    pickup_location_id, subtotal, promo_total, coupon_code, coupon_discount, discount_total, total, currency,
    notes, source
  ) values (
    v_store, v_number, v_token, v_customer_id,
    jsonb_build_object('name', v_name, 'email', v_email, 'phone', v_phone, 'doc', v_doc),
    v_pm.code, v_payment_pct, v_payment_discount,
    v_fulfillment, v_zone_id, v_zone_name, v_shipping,
    case when v_fulfillment = 'delivery' then payload -> 'shipping_address' else null end,
    v_pickup_id,
    v_subtotal, v_promo, v_coupon_code, v_coupon_discount, v_promo + v_coupon_discount + v_payment_discount,
    v_total, coalesce(v_settings.currency, 'ARS'),
    nullif(left(trim(coalesce(payload ->> 'notes', '')), 2000), ''),
    'web'
  )
  returning id into v_order_id;

  insert into public.order_items (
    store_id, order_id, product_id, variant_id, name, variant_title, sku, image_url, unit_price, list_price, qty, total
  )
  select v_store, v_order_id,
         (l ->> 'product_id')::uuid,
         (l ->> 'variant_id')::uuid,
         l ->> 'name',
         l ->> 'variant_title',
         l ->> 'sku',
         l ->> 'image_url',
         (l ->> 'unit_price')::numeric,
         (l ->> 'list_price')::numeric,
         (l ->> 'qty')::int,
         (l ->> 'unit_price')::numeric * (l ->> 'qty')::int
    from jsonb_array_elements(v_lines) l;

  insert into public.order_events (store_id, order_id, type, message, data, visible_to_customer)
  values (
    v_store, v_order_id, 'created', 'Recibimos tu pedido',
    jsonb_build_object('payment_method', v_pm.code, 'total', v_total, 'items', v_count),
    true
  );

  if coalesce(v_settings.inventory_policy, 'on_order') = 'on_order' then
    for v_line in select * from jsonb_array_elements(v_lines) loop
      if (v_line ->> 'track')::boolean then
        perform private.adjust_stock(
          (v_line ->> 'variant_id')::uuid, -((v_line ->> 'qty')::int), 'sale', 'Pedido #' || v_number, v_order_id
        );
      end if;
    end loop;
  end if;

  if v_coupon_code is not null then
    update public.coupons set uses_count = uses_count + 1 where id = v_coupon.id;
    insert into public.coupon_redemptions (store_id, coupon_id, order_id, customer_email)
    values (v_store, v_coupon.id, v_order_id, v_email);
  end if;

  return jsonb_build_object('id', v_order_id, 'number', v_number, 'public_token', v_token, 'store_id', v_store);
end;
$$;

-- ---------------------------------------------------------------------
-- get_order_by_token (público): configuración de la tienda del pedido.
-- ---------------------------------------------------------------------
create or replace function public.get_order_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.orders;
  s public.store_settings;
  v_slug text;
  v_pm jsonb;
  v_pickup jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;

  select * into o from public.orders where public_token = p_token;
  if not found then
    return null;
  end if;

  select * into s from public.store_settings where store_id = o.store_id;
  select slug into v_slug from public.stores where id = o.store_id;

  select jsonb_build_object(
           'code', pm.code, 'name', pm.name, 'type', pm.type,
           'discount_percent', pm.discount_percent, 'instructions_md', pm.instructions_md
         )
    into v_pm
    from public.payment_methods pm
   where pm.store_id = o.store_id and pm.code = o.payment_method_code;

  if o.pickup_location_id is not null then
    select jsonb_build_object(
             'id', pl.id, 'name', pl.name, 'address', pl.address, 'hours_text', pl.hours_text,
             'instructions_md', pl.instructions_md, 'lat', pl.lat, 'lng', pl.lng
           )
      into v_pickup
      from public.pickup_locations pl
     where pl.id = o.pickup_location_id;
  end if;

  return jsonb_build_object(
    'order', to_jsonb(o) - 'internal_notes' - 'customer_id',
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'product_id', i.product_id, 'variant_id', i.variant_id, 'name', i.name,
               'variant_title', i.variant_title, 'sku', i.sku, 'image_url', i.image_url,
               'unit_price', i.unit_price, 'list_price', i.list_price, 'qty', i.qty, 'total', i.total
             ) order by i.created_at, i.id)
        from public.order_items i
       where i.order_id = o.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'type', e.type, 'message', e.message, 'created_at', e.created_at
             ) order by e.created_at)
        from public.order_events e
       where e.order_id = o.id and e.visible_to_customer
    ), '[]'::jsonb),
    'payment_method', v_pm,
    'pickup_location', v_pickup,
    'checkout', jsonb_build_object(
      'transfer', s.checkout -> 'transfer',
      'whatsapp', s.checkout -> 'whatsapp'
    ),
    'store', jsonb_build_object(
      'id', o.store_id,
      'slug', v_slug,
      'name', s.name,
      'whatsapp_phone', s.whatsapp_phone,
      'contact_email', s.contact_email,
      'currency', s.currency,
      'locale', s.locale,
      'timezone', s.timezone
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Arrepentimiento (público)
-- ---------------------------------------------------------------------
create or replace function public.create_withdrawal_request(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store uuid;
  v_name text := trim(coalesce(payload ->> 'name', ''));
  v_contact text := trim(coalesce(payload ->> 'contact', ''));
  v_reason text := nullif(trim(coalesce(payload ->> 'reason', '')), '');
  v_number bigint;
  v_order_id uuid;
  v_code text;
  v_recent int;
begin
  begin
    v_store := nullif(payload ->> 'store_id', '')::uuid;
    v_number := nullif(payload ->> 'order_number', '')::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Datos inválidos';
  end;
  if v_store is null or not public.store_is_active(v_store) then
    raise exception 'La tienda no está disponible';
  end if;
  if length(v_name) < 2 then
    raise exception 'Ingresá tu nombre';
  end if;
  if length(v_contact) < 5 then
    raise exception 'Ingresá un email o teléfono de contacto';
  end if;

  select count(*) into v_recent from public.withdrawal_requests
   where store_id = v_store and contact = v_contact and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'Demasiadas solicitudes. Probá de nuevo más tarde.';
  end if;

  if v_number is not null then
    select id into v_order_id from public.orders where store_id = v_store and number = v_number;
  end if;

  v_code := 'ARR-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));

  insert into public.withdrawal_requests (store_id, code, order_number, order_id, name, contact, reason)
  values (v_store, v_code, v_number, v_order_id, v_name, v_contact, v_reason);

  if v_order_id is not null then
    insert into public.order_events (order_id, type, message, data, visible_to_customer)
    values (v_order_id, 'withdrawal_requested',
      format('Solicitud de arrepentimiento %s', v_code),
      jsonb_build_object('code', v_code, 'contact', v_contact), true);
  end if;

  return jsonb_build_object('code', v_code, 'order_found', v_order_id is not null);
end;
$$;

-- ---------------------------------------------------------------------
-- Redirecciones (público)
-- ---------------------------------------------------------------------
create or replace function public.hit_redirect(p_store_id uuid, p_from_path text)
returns text
language sql
security definer
set search_path = ''
as $$
  update public.redirects set hits = hits + 1
   where store_id = p_store_id and from_path = p_from_path
  returning to_path;
$$;

-- ---------------------------------------------------------------------
-- Vistas del admin (security_invoker) con store_id
-- ---------------------------------------------------------------------
drop view if exists public.low_stock_variants;
create view public.low_stock_variants
with (security_invoker = true) as
select
  v.store_id,
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
join public.store_settings s on s.store_id = v.store_id
where v.track_inventory
  and v.is_active
  and p.status <> 'archived'
  and v.stock <= coalesce(v.low_stock_threshold, s.low_stock_threshold);

drop view if exists public.admin_products;
create view public.admin_products
with (security_invoker = true) as
select
  p.id,
  p.store_id,
  p.name,
  p.slug,
  p.status,
  p.brand,
  p.source,
  p.source_url,
  p.featured,
  p.created_at,
  p.updated_at,
  coalesce(v.variant_count, 0)::int as variant_count,
  v.min_price,
  v.max_price,
  coalesce(v.total_stock, 0)::int as total_stock,
  coalesce(v.tracked, false) as tracked,
  coalesce(v.out_count, 0)::int as out_count,
  coalesce(v.low_count, 0)::int as low_count,
  coalesce(v.skus, '') as skus,
  v.first_variant_id,
  img.url as image_url,
  coalesce(c.category_ids, '{}'::uuid[]) as category_ids,
  case
    when not coalesce(v.tracked, false) then 'untracked'
    when coalesce(v.total_stock, 0) <= 0 then 'out'
    when coalesce(v.low_count, 0) > 0 then 'low'
    else 'ok'
  end as stock_state
from public.products p
left join lateral (
  select
    count(*) as variant_count,
    min(pv.price) as min_price,
    max(pv.price) as max_price,
    sum(pv.stock) filter (where pv.track_inventory) as total_stock,
    bool_or(pv.track_inventory) as tracked,
    count(*) filter (where pv.track_inventory and pv.stock <= 0) as out_count,
    count(*) filter (
      where pv.track_inventory
        and pv.stock <= coalesce(pv.low_stock_threshold, (select s.low_stock_threshold from public.store_settings s where s.store_id = p.store_id))
    ) as low_count,
    string_agg(coalesce(pv.sku, '') || ' ' || coalesce(pv.barcode, ''), ' ') as skus,
    (array_agg(pv.id order by pv.position, pv.created_at))[1] as first_variant_id
  from public.product_variants pv
  where pv.product_id = p.id
) v on true
left join lateral (
  select pi.url from public.product_images pi
  where pi.product_id = p.id
  order by pi.position, pi.created_at
  limit 1
) img on true
left join lateral (
  select array_agg(pc.category_id) as category_ids
  from public.product_categories pc
  where pc.product_id = p.id
) c on true;

drop view if exists public.admin_inventory;
create view public.admin_inventory
with (security_invoker = true) as
select
  pv.store_id,
  pv.id as variant_id,
  pv.product_id,
  p.name as product_name,
  p.slug as product_slug,
  p.status as product_status,
  pv.title as variant_title,
  pv.sku,
  pv.stock,
  pv.cost,
  pv.track_inventory,
  pv.is_active,
  pv.low_stock_threshold,
  coalesce(pv.low_stock_threshold, s.low_stock_threshold) as threshold,
  pv.position,
  pv.updated_at,
  coalesce(vi.url, img.url) as image_url,
  coalesce(c.category_ids, '{}'::uuid[]) as category_ids,
  case
    when not pv.track_inventory then 'untracked'
    when pv.stock <= 0 then 'out'
    when pv.stock <= coalesce(pv.low_stock_threshold, s.low_stock_threshold) then 'low'
    else 'ok'
  end as stock_state
from public.product_variants pv
join public.products p on p.id = pv.product_id
join public.store_settings s on s.store_id = pv.store_id
left join public.product_images vi on vi.id = pv.image_id
left join lateral (
  select pi.url from public.product_images pi
  where pi.product_id = p.id
  order by pi.position, pi.created_at
  limit 1
) img on true
left join lateral (
  select array_agg(pc.category_id) as category_ids
  from public.product_categories pc
  where pc.product_id = p.id
) c on true;

drop view if exists public.price_batch_list;
create view public.price_batch_list
with (security_invoker = true) as
select
  g.store_id,
  g.batch_id,
  coalesce(b.created_at, g.created_at) as created_at,
  g.variant_count,
  coalesce(b.created_by, g.created_by) as created_by,
  coalesce(b.created_by_email, p.email) as created_by_email,
  coalesce(b.source, 'other') as source,
  b.rule,
  coalesce(b.rule_summary, '') as rule_summary,
  coalesce(b.scope_summary, '') as scope_summary,
  b.undone_at,
  b.undo_result
from (
  select store_id, batch_id, min(created_at) as created_at, count(*)::int as variant_count,
         (array_agg(created_by))[1] as created_by
    from public.price_changes
   group by store_id, batch_id
) g
left join public.price_batches b on b.id = g.batch_id
left join public.profiles p on p.id = g.created_by;

revoke all on public.admin_products, public.admin_inventory, public.price_batch_list, public.low_stock_variants from anon;
grant select on public.admin_products, public.admin_inventory, public.price_batch_list, public.low_stock_variants to authenticated;

-- ---------------------------------------------------------------------
-- Funciones del admin (security invoker + membresía)
-- ---------------------------------------------------------------------
create or replace function public.inventory_summary(p_store_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_store_admin(p_store_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'low', count(*) filter (where pv.track_inventory and pv.is_active and p.status <> 'archived'
        and pv.stock > 0 and pv.stock <= coalesce(pv.low_stock_threshold, s.low_stock_threshold)),
      'out', count(*) filter (where pv.track_inventory and pv.is_active and p.status <> 'archived' and pv.stock <= 0),
      'tracked', count(*) filter (where pv.track_inventory),
      'value_at_cost', coalesce(sum(pv.cost * pv.stock) filter (where pv.cost is not null and pv.stock > 0 and p.status <> 'archived'), 0),
      'with_cost', count(*) filter (where pv.cost is not null)
    )
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    join public.store_settings s on s.store_id = pv.store_id
    where pv.store_id = p_store_id
  );
end;
$$;

create or replace function public.reorder_categories(p_store_id uuid, items jsonb)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int := 0;
  v_item jsonb;
begin
  if not public.is_store_admin(p_store_id) then
    raise exception 'No autorizado';
  end if;

  for v_item in select * from jsonb_array_elements(items)
  loop
    if nullif(v_item ->> 'parent_id', '') is not null and not exists (
      select 1 from public.categories where id = (v_item ->> 'parent_id')::uuid and store_id = p_store_id
    ) then
      raise exception 'Categoría padre inválida';
    end if;
    update public.categories
       set parent_id = nullif(v_item ->> 'parent_id', '')::uuid,
           position = (v_item ->> 'position')::int
     where id = (v_item ->> 'id')::uuid
       and store_id = p_store_id
       and (parent_id is distinct from nullif(v_item ->> 'parent_id', '')::uuid
            or position is distinct from (v_item ->> 'position')::int);
    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  if exists (
    with recursive walk as (
      select id, parent_id, array[id] as path, false as cycle from public.categories where store_id = p_store_id
      union all
      select w.id, c.parent_id, w.path || c.id, c.id = any (w.path)
      from walk w join public.categories c on c.id = w.parent_id
      where not w.cycle
    )
    select 1 from walk where cycle
  ) then
    raise exception 'El orden deja una categoría dentro de sí misma';
  end if;

  return v_count;
end;
$$;

create or replace function public.admin_sales_series(
  p_store_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket text default 'day',
  p_tz text default 'America/Argentina/Buenos_Aires'
)
returns table (bucket timestamp, orders bigint, sales numeric)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_store_admin(p_store_id) then
    raise exception 'No autorizado';
  end if;
  if p_bucket not in ('hour', 'day') then
    raise exception 'Intervalo inválido';
  end if;

  return query
    select date_trunc(p_bucket, o.created_at at time zone p_tz) as bucket,
           count(*)::bigint as orders,
           coalesce(sum(o.total), 0)::numeric as sales
      from public.orders o
     where o.store_id = p_store_id
       and o.created_at >= p_from
       and o.created_at < p_to
       and o.status <> 'cancelled'
     group by 1
     order by 1;
end;
$$;

create or replace function public.admin_top_products(
  p_store_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_limit int default 5
)
returns table (product_id uuid, name text, image_url text, qty bigint, revenue numeric)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_store_admin(p_store_id) then
    raise exception 'No autorizado';
  end if;

  return query
    select i.product_id,
           max(i.name) as name,
           max(i.image_url) as image_url,
           sum(i.qty)::bigint as qty,
           coalesce(sum(i.total), 0)::numeric as revenue
      from public.order_items i
      join public.orders o on o.id = i.order_id
     where o.store_id = p_store_id
       and o.created_at >= p_from
       and o.created_at < p_to
       and o.status <> 'cancelled'
     group by i.product_id, case when i.product_id is null then i.name end
     order by 4 desc, 5 desc
     limit greatest(1, least(coalesce(p_limit, 5), 50));
end;
$$;

create or replace function public.pricing_scope_variants(p_store_id uuid, p_scope jsonb)
returns table (
  variant_id uuid,
  product_id uuid,
  product_name text,
  product_slug text,
  product_status text,
  variant_title text,
  sku text,
  price numeric,
  compare_at_price numeric,
  cost numeric,
  stock int,
  track_inventory boolean,
  image_url text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_kind text := coalesce(p_scope ->> 'kind', 'all');
  v_children boolean := coalesce((p_scope ->> 'include_children')::boolean, true);
  v_in_stock boolean := coalesce((p_scope ->> 'in_stock_only')::boolean, false);
  v_cat_ids uuid[] := coalesce(
    (select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_scope -> 'category_ids', '[]'::jsonb)) x), '{}');
  v_product_ids uuid[] := coalesce(
    (select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_scope -> 'product_ids', '[]'::jsonb)) x), '{}');
  v_brand text := lower(nullif(trim(coalesce(p_scope ->> 'brand', '')), ''));
  v_tag text := nullif(trim(coalesce(p_scope ->> 'tag', '')), '');
  v_min numeric := nullif(p_scope ->> 'min_price', '')::numeric;
  v_max numeric := nullif(p_scope ->> 'max_price', '')::numeric;
  v_all_cats uuid[];
begin
  if not public.is_store_admin(p_store_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if v_kind = 'categories' then
    with recursive tree as (
      select c.id from public.categories c where c.store_id = p_store_id and c.id = any (v_cat_ids)
      union
      select c.id from public.categories c join tree t on c.parent_id = t.id where v_children
    )
    select coalesce(array_agg(id), '{}') into v_all_cats from tree;
  end if;

  return query
  select
    v.id,
    p.id,
    p.name,
    p.slug,
    p.status,
    v.title,
    v.sku,
    v.price,
    v.compare_at_price,
    v.cost,
    v.stock,
    v.track_inventory,
    (select i.url from public.product_images i where i.product_id = p.id order by i.position limit 1)
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where p.store_id = p_store_id
    and p.status <> 'archived'
    and case v_kind
      when 'all' then true
      when 'categories' then exists (
        select 1 from public.product_categories pc
         where pc.product_id = p.id and pc.category_id = any (v_all_cats))
      when 'products' then p.id = any (v_product_ids)
      when 'brand' then v_brand is not null and lower(p.brand) = v_brand
      when 'tag' then v_tag is not null and v_tag = any (p.tags)
      when 'price_range' then (v_min is null or v.price >= v_min) and (v_max is null or v.price <= v_max)
      else false
    end
    and (not v_in_stock or not v.track_inventory or v.stock > 0)
  order by p.name, v.position;
end;
$$;

create or replace function public.pricing_scope_facets(p_store_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_store_admin(p_store_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'brands', coalesce((
      select jsonb_agg(jsonb_build_object('value', brand, 'count', n) order by brand)
        from (select trim(brand) as brand, count(*) as n from public.products
               where store_id = p_store_id and status <> 'archived' and nullif(trim(brand), '') is not null
               group by trim(brand)) b), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object('value', tag, 'count', n) order by tag)
        from (select t as tag, count(*) as n from public.products, unnest(tags) t
               where store_id = p_store_id and status <> 'archived'
               group by t) x), '[]'::jsonb)
  );
end;
$$;

create or replace function public.apply_price_changes(p_store_id uuid, p_batch_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total int := jsonb_array_length(coalesce(p_changes, '[]'::jsonb));
  v_applied int;
begin
  if not public.is_store_admin(p_store_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_batch_id is null then
    raise exception 'Falta el batch' using errcode = '22023';
  end if;

  with input as (
    select distinct on (x.variant_id) x.*
      from jsonb_to_recordset(coalesce(p_changes, '[]'::jsonb)) as x(
        variant_id uuid, old_price numeric, old_compare_at numeric, new_price numeric, new_compare_at numeric)
     where x.variant_id is not null and x.new_price is not null and x.new_price >= 0
       and (x.new_compare_at is null or x.new_compare_at >= 0)
  ),
  upd as (
    update public.product_variants v
       set price = i.new_price,
           compare_at_price = i.new_compare_at
      from input i
     where v.id = i.variant_id
       and v.store_id = p_store_id
       and v.price = i.old_price
       and v.compare_at_price is not distinct from i.old_compare_at
    returning v.id, i.old_price, i.old_compare_at, i.new_price, i.new_compare_at
  ),
  ins as (
    insert into public.price_changes (store_id, batch_id, variant_id, old_price, old_compare_at, new_price, new_compare_at, created_by)
    select p_store_id, p_batch_id, u.id, u.old_price, u.old_compare_at, u.new_price, u.new_compare_at, auth.uid() from upd u
    returning 1
  )
  select count(*)::int into v_applied from ins;

  return jsonb_build_object('applied', v_applied, 'skipped', v_total - v_applied);
end;
$$;

create or replace function public.undo_price_batch(p_store_id uuid, p_batch_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total int;
  v_restored int;
begin
  if not public.is_store_admin(p_store_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if exists (select 1 from public.price_batches where id = p_batch_id and store_id = p_store_id and undone_at is not null) then
    return jsonb_build_object('ok', false, 'reason', 'already_undone');
  end if;

  select count(*)::int into v_total from public.price_changes where batch_id = p_batch_id and store_id = p_store_id;
  if v_total = 0 then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  with upd as (
    update public.product_variants v
       set price = pc.old_price,
           compare_at_price = pc.old_compare_at
      from public.price_changes pc
     where pc.batch_id = p_batch_id
       and pc.store_id = p_store_id
       and v.id = pc.variant_id
       and pc.old_price is not null
       and v.price = pc.new_price
       and v.compare_at_price is not distinct from pc.new_compare_at
    returning v.id
  )
  select count(*)::int into v_restored from upd;

  insert into public.price_batches (id, store_id, source, variant_count, created_at)
  select p_batch_id, p_store_id, 'other', v_total, min(created_at)
    from public.price_changes where batch_id = p_batch_id and store_id = p_store_id
  on conflict (id) do nothing;

  update public.price_batches
     set undone_at = now(),
         undone_by = auth.uid(),
         undo_result = jsonb_build_object('restored', v_restored, 'skipped', v_total - v_restored)
   where id = p_batch_id and store_id = p_store_id;

  return jsonb_build_object('ok', true, 'total', v_total, 'restored', v_restored, 'skipped', v_total - v_restored);
end;
$$;

-- ---------------------------------------------------------------------
-- Equipo de la tienda
-- ---------------------------------------------------------------------
create or replace function public.admin_list_users(p_store_id uuid)
returns table (
  id uuid,
  email text,
  name text,
  role text,
  is_active boolean,
  last_seen_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_store_admin(p_store_id) then
    raise exception 'No autorizado';
  end if;
  return query
    select p.id, p.email, p.name, m.role, m.is_active, p.last_seen_at, u.last_sign_in_at, m.created_at
      from public.store_members m
      join public.profiles p on p.id = m.user_id
      left join auth.users u on u.id = m.user_id
     where m.store_id = p_store_id
     order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at;
end;
$$;

-- Invita por email: si ya tiene cuenta lo suma directo; si no, deja una
-- invitación con token (el link se comparte a mano en v0.1).
create or replace function public.invite_store_member(p_store_id uuid, p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user uuid;
  v_token text;
begin
  if not public.is_store_owner(p_store_id) then
    raise exception 'Sólo el dueño de la tienda puede invitar';
  end if;
  if p_role not in ('admin', 'staff') then
    raise exception 'Rol inválido';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ingresá un email válido';
  end if;

  select id into v_user from public.profiles where email = v_email;
  if v_user is not null then
    if exists (select 1 from public.store_members where store_id = p_store_id and user_id = v_user) then
      raise exception 'Esa persona ya es parte del equipo';
    end if;
    insert into public.store_members (store_id, user_id, role, is_active, invited_by)
    values (p_store_id, v_user, p_role, true, auth.uid());
    delete from public.store_invites where store_id = p_store_id and email = v_email;
    return jsonb_build_object('status', 'added', 'user_id', v_user);
  end if;

  insert into public.store_invites (store_id, email, role, invited_by)
  values (p_store_id, v_email, p_role, auth.uid())
  on conflict (store_id, email) do update
     set role = excluded.role,
         token = encode(extensions.gen_random_bytes(24), 'hex'),
         expires_at = now() + interval '7 days',
         invited_by = excluded.invited_by
  returning token into v_token;
  return jsonb_build_object('status', 'invited', 'token', v_token);
end;
$$;

-- Datos mínimos de una invitación (para /invitacion/<token>).
create or replace function public.get_store_invite(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'store_name', s.name, 'store_slug', s.slug, 'email', i.email, 'role', i.role,
           'expired', i.expires_at < now()
         )
    from public.store_invites i
    join public.stores s on s.id = i.store_id
   where i.token = p_token;
$$;

create or replace function public.accept_store_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.store_invites;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para aceptar la invitación';
  end if;
  select * into v_inv from public.store_invites where token = p_token;
  if not found then
    raise exception 'La invitación no existe o ya se usó';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'La invitación venció. Pedí una nueva.';
  end if;
  select email into v_email from public.profiles where id = auth.uid();
  if v_email is distinct from v_inv.email then
    raise exception 'La invitación es para %', v_inv.email;
  end if;
  insert into public.store_members (store_id, user_id, role, is_active, invited_by)
  values (v_inv.store_id, auth.uid(), v_inv.role, true, v_inv.invited_by)
  on conflict (store_id, user_id) do update set is_active = true;
  delete from public.store_invites where id = v_inv.id;
  return v_inv.store_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Tiendas: slug, alta, plan
-- ---------------------------------------------------------------------
-- Espejo en TS: src/lib/tenant/slug.ts (RESERVED_STORE_SLUGS).
create or replace function public.check_store_slug(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_slug is not null
     and p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     and length(p_slug) between 3 and 40
     and p_slug not in ('www', 'app', 'admin', 'api', 'mail', 'ecommy', 'platform', 'static', 'cdn', 'demo',
                        's', 'login', 'registro', 'planes', 'auth', 'invitacion', 'soporte', 'ayuda', 'blog')
     and not exists (select 1 from public.stores s where s.slug = p_slug);
$$;

create or replace function public.create_store(
  p_name text,
  p_slug text,
  p_kind text default 'otro',
  p_whatsapp text default null,
  p_options jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_wa text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  v_opt jsonb := coalesce(p_options, '{}'::jsonb);
  v_tr jsonb := coalesce(p_options -> 'transfer', '{}'::jsonb);
  v_preset text;
  v_currency text := upper(coalesce(nullif(p_options ->> 'currency', ''), 'ARS'));
  v_address text;
  v_store uuid;
  v_transfer_on boolean := coalesce((p_options ->> 'transfer_enabled')::boolean, true);
  v_wa_on boolean := coalesce((p_options ->> 'whatsapp_enabled')::boolean, true);
  v_discount numeric := least(greatest(coalesce((v_tr ->> 'discount_percent')::numeric, 10), 0), 50);
  v_home jsonb;
begin
  if v_uid is null then
    raise exception 'Iniciá sesión para crear una tienda';
  end if;
  if length(v_name) < 2 or length(v_name) > 60 then
    raise exception 'Ingresá un nombre de 2 a 60 caracteres';
  end if;
  if not public.check_store_slug(v_slug) then
    raise exception 'Esa dirección no está disponible';
  end if;
  if v_currency not in ('ARS', 'USD', 'UYU', 'CLP') then
    v_currency := 'ARS';
  end if;
  if not v_transfer_on and not v_wa_on then
    raise exception 'Elegí al menos una forma de cobro';
  end if;

  perform pg_advisory_xact_lock(hashtext('ecommy.create_store.' || v_uid::text));
  if not public.is_platform_admin() and (
    select count(*) from public.stores where owner_id = v_uid and status <> 'deleted'
  ) >= 3 then
    raise exception 'Llegaste al máximo de 3 tiendas por cuenta';
  end if;

  v_preset := case p_kind
    when 'moda' then 'atelier'
    when 'artesanias' then 'mercado'
    when 'tecnologia' then 'nordico'
    when 'marca' then 'editorial'
    when 'gaming' then 'neon'
    else 'nordico'
  end;
  v_address := nullif(concat_ws(', ', nullif(trim(coalesce(p_options ->> 'city', '')), ''),
                                      nullif(trim(coalesce(p_options ->> 'province', '')), '')), '');

  insert into public.stores (slug, name, owner_id, onboarding)
  values (v_slug, v_name, v_uid, jsonb_build_object('kind', coalesce(p_kind, 'otro')))
  returning id into v_store;

  insert into public.store_members (store_id, user_id, role, is_active)
  values (v_store, v_uid, 'owner', true);

  insert into public.store_settings (
    store_id, name, tagline, whatsapp_phone, address, currency, locale, timezone, social, seo, announcement,
    theme, checkout, inventory_policy, low_stock_threshold, policies, header, footer, maintenance
  ) values (
    v_store, v_name, null, v_wa, v_address, v_currency, 'es-AR', 'America/Argentina/Buenos_Aires',
    '{"instagram": "", "facebook": "", "tiktok": "", "x": "", "youtube": ""}',
    jsonb_build_object('title', v_name, 'description', '', 'og_image_url', ''),
    case when v_transfer_on and v_discount > 0 then
      jsonb_build_object('enabled', true, 'text', format('%s %% de descuento pagando por transferencia', trim(trailing '.' from to_char(v_discount, 'FM990.##'))),
                         'href', '/productos', 'bg', '', 'fg', '')
    else '{"enabled": false, "text": "", "href": "", "bg": "", "fg": ""}'::jsonb end,
    jsonb_build_object('preset', v_preset),
    jsonb_build_object(
      'transfer', jsonb_build_object(
        'enabled', v_transfer_on,
        'discount_percent', v_discount,
        'bank_name', coalesce(v_tr ->> 'bank_name', ''),
        'holder', coalesce(v_tr ->> 'holder', ''),
        'cbu', coalesce(v_tr ->> 'cbu', ''),
        'alias', coalesce(v_tr ->> 'alias', ''),
        'cuit', coalesce(v_tr ->> 'cuit', ''),
        'instructions_md', 'Transferí el total indicado y envianos el comprobante por WhatsApp con el número de pedido.'
      ),
      'whatsapp', jsonb_build_object(
        'enabled', v_wa_on,
        'message_template', E'Hola! Hice el pedido #{number} en {store}.\n\n{items}\n\nTotal: {total}\n{delivery}\n\nNombre: {name}'
      ),
      'require_phone', true,
      'require_address_for_pickup', false,
      'order_notes_enabled', true,
      'min_order_total', 0,
      'reservation_hours', 48
    ),
    'on_order', 5,
    '{"shipping_md": "", "returns_md": "", "privacy_md": "", "terms_md": ""}',
    '{}', '{}',
    '{"enabled": false, "message": "Estamos haciendo mejoras. Volvemos en un rato."}'
  );

  insert into public.payment_methods (store_id, code, name, type, discount_percent, instructions_md, is_active, position) values
    (v_store, 'transfer', 'Transferencia bancaria', 'transfer', v_discount,
     'Transferí el total a la cuenta indicada y envianos el comprobante por WhatsApp.', v_transfer_on, 0),
    (v_store, 'whatsapp', 'Acordar con el vendedor', 'whatsapp', 0,
     'Te contactamos por WhatsApp para coordinar el pago y la entrega.', v_wa_on, 1);

  insert into public.menus (store_id, handle, items) values
    (v_store, 'header', '[
      {"label": "Inicio", "href": "/", "children": []},
      {"label": "Productos", "href": "/productos", "children": []},
      {"label": "Cómo comprar", "href": "/#como-comprar", "children": []}
    ]'),
    (v_store, 'footer', '[
      {"label": "Tienda", "href": "/productos", "children": [
        {"label": "Todos los productos", "href": "/productos", "children": []},
        {"label": "Carrito", "href": "/carrito", "children": []}
      ]},
      {"label": "Ayuda", "href": "/#como-comprar", "children": [
        {"label": "Cómo comprar", "href": "/#como-comprar", "children": []}
      ]}
    ]');

  v_home := jsonb_build_array(
    jsonb_build_object(
      'id', 'home-hero', 'type', 'hero',
      'style', jsonb_build_object('background', 'default', 'paddingY', 'none', 'container', 'full'),
      'settings', jsonb_build_object(
        'title', v_name,
        'subtitle', case when v_transfer_on and v_discount > 0
                         then format('Comprá online y pagá por transferencia con %s %% de descuento.', trim(trailing '.' from to_char(v_discount, 'FM990.##')))
                         else 'Comprá online y coordinamos el pago y la entrega por WhatsApp.' end,
        'imageUrl', '', 'overlay', 0, 'align', 'left', 'height', 'md',
        'cta', jsonb_build_object('label', 'Ver productos', 'href', '/productos'),
        'cta2', jsonb_build_object('label', 'Cómo comprar', 'href', '#como-comprar')
      )
    ),
    jsonb_build_object(
      'id', 'home-newest', 'type', 'product_slider',
      'style', jsonb_build_object('background', 'default', 'paddingY', 'md', 'container', 'normal'),
      'settings', jsonb_build_object(
        'title', 'Recién llegados', 'subtitle', 'Lo último que sumamos.',
        'source', jsonb_build_object('kind', 'newest', 'limit', 12),
        'viewAllHref', '/productos', 'cardsPerView', 4
      )
    ),
    jsonb_build_object(
      'id', 'home-features', 'type', 'features',
      'style', jsonb_build_object('background', 'surface', 'paddingY', 'md', 'container', 'normal'),
      'settings', jsonb_build_object(
        'columns', 3,
        'items', jsonb_build_array(
          jsonb_build_object('icon', 'Truck', 'title', 'Envíos', 'text', 'Coordinamos la entrega o retirás sin cargo.'),
          jsonb_build_object('icon', 'Landmark', 'title', 'Transferencia', 'text', 'Pagá por transferencia y ahorrá.'),
          jsonb_build_object('icon', 'MessageCircle', 'title', 'Atención directa', 'text', 'Te respondemos por WhatsApp.')
        )
      )
    ),
    jsonb_build_object(
      'id', 'home-como-comprar', 'type', 'rich_text',
      'style', jsonb_build_object('background', 'default', 'paddingY', 'lg', 'container', 'normal'),
      'settings', jsonb_build_object(
        'align', 'left', 'maxWidth', 'narrow',
        'html', '<h2 id="como-comprar">Cómo comprar</h2><ol><li><strong>Armá tu carrito</strong> con los productos que quieras.</li><li><strong>Elegí cómo pagar</strong> y cómo recibir tu pedido.</li><li><strong>Confirmá</strong>: el pedido queda registrado y te mostramos los pasos para completar el pago.</li></ol><p>¿Dudas? Escribinos por WhatsApp.</p>'
      )
    )
  );

  insert into public.pages (store_id, title, slug, type, status, blocks, seo, published_at, show_in_menu)
  values (v_store, 'Inicio', 'home', 'home', 'published', v_home, '{"title": "", "description": ""}', now(), false);

  insert into public.subscriptions (store_id, plan_code, status, trial_ends_at, current_period_start, provider)
  values (v_store, 'pro', 'trialing', now() + interval '14 days', now(), 'manual');

  return v_store;
end;
$$;

-- Plan efectivo de una tienda (un trial vencido cuenta como Free aunque el
-- barrido todavía no haya corrido).
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
    'features', v_plan.features,
    'limits', v_plan.limits
  );
end;
$$;

create or replace function public.expire_trials()
returns int
language sql
security definer
set search_path = ''
as $$
  with upd as (
    update public.subscriptions
       set plan_code = 'free',
           status = 'active',
           trial_ends_at = null,
           notes = trim(coalesce(notes, '') || ' Trial vencido el ' || to_char(now(), 'YYYY-MM-DD') || '.')
     where status = 'trialing' and trial_ends_at is not null and trial_ends_at < now()
    returning 1
  )
  select count(*)::int from upd;
$$;

-- Barrido diario (cron): trials vencidos + reservas impagas de TODAS las
-- tiendas. No recibe parámetros y sólo aplica reglas que ya correspondían:
-- es seguro exponerla (la app no tiene service-role key).
create or replace function public.run_daily_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trials int;
  v_orders int;
begin
  v_trials := public.expire_trials();
  v_orders := private.expire_unpaid_orders(null);
  return jsonb_build_object('trials_expired', v_trials, 'orders_expired', v_orders, 'ran_at', now());
end;
$$;

-- ---------------------------------------------------------------------
-- Superadmin
-- ---------------------------------------------------------------------
create or replace function public.platform_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'No autorizado';
  end if;
  return jsonb_build_object(
    'stores', (select count(*) from public.stores where status <> 'deleted'),
    'stores_active', (select count(*) from public.stores where status = 'active'),
    'stores_new_7d', (select count(*) from public.stores where created_at > now() - interval '7 days'),
    'users', (select count(*) from public.profiles),
    'orders_30d', (select count(*) from public.orders where created_at > now() - interval '30 days' and status <> 'cancelled'),
    'gmv_30d', (select coalesce(sum(total), 0) from public.orders where created_at > now() - interval '30 days' and status <> 'cancelled'),
    'by_plan', coalesce((
      select jsonb_object_agg(plan_code, n) from (
        select s.plan_code, count(*) as n from public.subscriptions s group by s.plan_code
      ) x), '{}'::jsonb),
    'trialing', (select count(*) from public.subscriptions where status = 'trialing')
  );
end;
$$;

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
  created_at timestamptz
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
           s.created_at
      from public.stores s
      left join public.profiles p on p.id = s.owner_id
      left join public.subscriptions sub on sub.store_id = s.id
     order by s.created_at desc;
end;
$$;

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
         provider = coalesce(public.subscriptions.provider, 'manual');
end;
$$;

create or replace function public.platform_set_store_status(p_store_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'No autorizado';
  end if;
  if p_status not in ('active', 'suspended', 'deleted') then
    raise exception 'Estado inválido';
  end if;
  update public.stores set status = p_status where id = p_store_id;
end;
$$;

-- =====================================================================
-- 9. Policies (se reescriben todas)
-- =====================================================================
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
     where schemaname = 'public'
        or (schemaname = 'storage' and tablename = 'objects' and policyname like 'media:%')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end;
$$;

-- Ahora sí se pueden borrar los helpers y columnas del modelo viejo.
drop function if exists public.is_admin();
drop function if exists public.is_owner();
drop function if exists public.has_owner();
drop index if exists public.profiles_role_idx;
alter table public.profiles drop column if exists role;
alter table public.profiles drop column if exists is_active;

alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.store_invites enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;

-- Expresión "admin de la fila" (miembro activo de la tienda o superadmin).
-- `(select …)` hace que se evalúe una vez por consulta (initplan).
do $$
declare
  adm constant text := '(store_id = any ((select public.admin_store_ids())::uuid[]) or (select public.is_platform_admin()))';
  pub constant text := 'public.store_is_active(store_id)';
  t text;
begin
  -- Escritura de admin en todas las tablas de tienda con lectura pública.
  foreach t in array array[
    'store_settings', 'menus', 'categories', 'products', 'product_images', 'product_categories',
    'product_variants', 'promotions', 'payment_methods', 'shipping_zones', 'pickup_locations', 'pages',
    'redirects'
  ] loop
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || ': admin inserta', t, adm);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || ': admin modifica', t, adm, adm);
    if t <> 'store_settings' then
      execute format('create policy %I on public.%I for delete to authenticated using (%s)', t || ': admin borra', t, adm);
    end if;
  end loop;

  -- Lecturas públicas (tienda activa + publicado/activo) o admin.
  execute format('create policy "store_settings: tienda activa o admin" on public.store_settings for select to anon, authenticated using (%s or %s)', pub, adm);
  execute format('create policy "menus: tienda activa o admin" on public.menus for select to anon, authenticated using (%s or %s)', pub, adm);
  execute format('create policy "categories: visibles o admin" on public.categories for select to anon, authenticated using ((is_visible and %s) or %s)', pub, adm);
  execute format('create policy "products: activos o admin" on public.products for select to anon, authenticated using ((status = ''active'' and %s) or %s)', pub, adm);
  execute format($p$create policy "product_images: de productos activos o admin" on public.product_images for select to anon, authenticated using (%s or exists (select 1 from public.products p where p.id = product_id and p.status = 'active' and public.store_is_active(p.store_id)))$p$, adm);
  execute format('create policy "product_categories: tienda activa o admin" on public.product_categories for select to anon, authenticated using (%s or %s)', pub, adm);
  execute format($p$create policy "product_variants: activas de productos activos o admin" on public.product_variants for select to anon, authenticated using (%s or (is_active and exists (select 1 from public.products p where p.id = product_id and p.status = 'active' and public.store_is_active(p.store_id))))$p$, adm);
  execute format('create policy "promotions: activas o admin" on public.promotions for select to anon, authenticated using ((is_active and %s) or %s)', pub, adm);
  execute format('create policy "payment_methods: activos o admin" on public.payment_methods for select to anon, authenticated using ((is_active and %s) or %s)', pub, adm);
  execute format('create policy "shipping_zones: activas o admin" on public.shipping_zones for select to anon, authenticated using ((is_active and %s) or %s)', pub, adm);
  execute format('create policy "pickup_locations: activos o admin" on public.pickup_locations for select to anon, authenticated using ((is_active and %s) or %s)', pub, adm);
  execute format('create policy "pages: publicadas o admin" on public.pages for select to anon, authenticated using ((status = ''published'' and %s) or %s)', pub, adm);
  execute format('create policy "redirects: tienda activa o admin" on public.redirects for select to anon, authenticated using (%s or %s)', pub, adm);

  -- Tablas sólo admin (todas las operaciones).
  foreach t in array array[
    'inventory_movements', 'price_changes', 'price_batches', 'coupons', 'coupon_redemptions', 'customers',
    'orders', 'order_items', 'order_events', 'order_payments', 'import_jobs', 'import_items', 'page_drafts'
  ] loop
    execute format('create policy %I on public.%I for all to authenticated using (%s) with check (%s)', t || ': sólo admin', t, adm, adm);
  end loop;

  -- Arrepentimiento: el alta es por RPC pública; el admin lee/gestiona.
  execute format('create policy "withdrawal_requests: admin lee" on public.withdrawal_requests for select to authenticated using (%s)', adm);
  execute format('create policy "withdrawal_requests: admin modifica" on public.withdrawal_requests for update to authenticated using (%s) with check (%s)', adm, adm);
  execute format('create policy "withdrawal_requests: admin borra" on public.withdrawal_requests for delete to authenticated using (%s)', adm);

  -- Auditoría: admin lee; inserta sólo a su nombre; nadie modifica ni borra.
  execute format('create policy "audit_log: admin lee" on public.audit_log for select to authenticated using (%s)', adm);
  execute format('create policy "audit_log: admin inserta" on public.audit_log for insert to authenticated with check (%s and actor_id = (select auth.uid()))', adm);
end;
$$;

-- app_meta: cualquiera logueado lee (versión del esquema); escribe el superadmin.
create policy "app_meta: lectura" on public.app_meta
  for select to authenticated using (true);
create policy "app_meta: superadmin escribe" on public.app_meta
  for all to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

-- profiles: el propio, los del equipo de mis tiendas, o superadmin.
create policy "profiles: propio, equipo o superadmin" on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or (select public.is_platform_admin())
    or exists (
      select 1 from public.store_members m
       where m.user_id = profiles.id and m.store_id = any ((select public.admin_store_ids())::uuid[])
    )
  );
create policy "profiles: superadmin modifica" on public.profiles
  for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

-- stores: públicas si están activas; el equipo ve la suya; cambios limitados por columnas.
create policy "stores: activas, propias o superadmin" on public.stores
  for select to anon, authenticated using (
    status = 'active'
    or id = any ((select public.admin_store_ids())::uuid[])
    or (select public.is_platform_admin())
  );
create policy "stores: admin modifica" on public.stores
  for update to authenticated
  using (id = any ((select public.admin_store_ids())::uuid[]) or (select public.is_platform_admin()))
  with check (id = any ((select public.admin_store_ids())::uuid[]) or (select public.is_platform_admin()));
create policy "stores: superadmin borra" on public.stores
  for delete to authenticated using ((select public.is_platform_admin()));

revoke all on public.stores from anon, authenticated;
grant select (id, slug, name, status, custom_domain, custom_domain_verified, created_at) on public.stores to anon;
grant select on public.stores to authenticated;
grant update (name, onboarding, custom_domain) on public.stores to authenticated;
grant delete on public.stores to authenticated;

-- store_members: me veo a mí y al equipo de mis tiendas; el dueño gestiona.
create policy "store_members: propio o equipo" on public.store_members
  for select to authenticated using (
    user_id = (select auth.uid())
    or store_id = any ((select public.admin_store_ids())::uuid[])
    or (select public.is_platform_admin())
  );
create policy "store_members: dueño agrega" on public.store_members
  for insert to authenticated with check (public.is_store_owner(store_id));
create policy "store_members: dueño modifica" on public.store_members
  for update to authenticated using (public.is_store_owner(store_id)) with check (public.is_store_owner(store_id));
create policy "store_members: dueño quita" on public.store_members
  for delete to authenticated using (public.is_store_owner(store_id) and user_id <> (select auth.uid()));

create policy "store_invites: dueño lee" on public.store_invites
  for select to authenticated using (public.is_store_owner(store_id));
create policy "store_invites: dueño borra" on public.store_invites
  for delete to authenticated using (public.is_store_owner(store_id));
revoke all on public.store_invites from anon;

-- plans: públicos para todos; el superadmin edita.
create policy "plans: públicos o superadmin" on public.plans
  for select to anon, authenticated using (is_public or (select public.is_platform_admin()));
create policy "plans: superadmin inserta" on public.plans
  for insert to authenticated with check ((select public.is_platform_admin()));
create policy "plans: superadmin modifica" on public.plans
  for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

-- subscriptions: el equipo la ve; sólo el superadmin (o funciones) la cambia.
create policy "subscriptions: equipo o superadmin" on public.subscriptions
  for select to authenticated using (
    store_id = any ((select public.admin_store_ids())::uuid[]) or (select public.is_platform_admin())
  );
create policy "subscriptions: superadmin modifica" on public.subscriptions
  for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
revoke all on public.subscriptions from anon;

-- ---------------------------------------------------------------------
-- Storage: media/<store_id>/…
-- ---------------------------------------------------------------------
create policy "media: tienda lista" on storage.objects
  for select to authenticated using (bucket_id = 'media' and public.can_manage_media(name));
create policy "media: tienda sube" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.can_manage_media(name));
create policy "media: tienda modifica" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.can_manage_media(name))
  with check (bucket_id = 'media' and public.can_manage_media(name));
create policy "media: tienda borra" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.can_manage_media(name));

-- =====================================================================
-- 10. Permisos de funciones
-- =====================================================================
revoke execute on all functions in schema private from public, anon, authenticated;

do $$
declare
  f text;
begin
  -- Públicas (storefront / registro / cron).
  foreach f in array array[
    'public.create_order(jsonb)',
    'public.get_order_by_token(text)',
    'public.validate_coupon(uuid, text, numeric, jsonb, text)',
    'public.create_withdrawal_request(jsonb)',
    'public.hit_redirect(uuid, text)',
    'public.check_store_slug(text)',
    'public.get_store_invite(text)',
    'public.run_daily_maintenance()',
    'public.is_platform_admin()',
    'public.admin_store_ids()',
    'public.is_store_member(uuid)',
    'public.is_store_admin(uuid)',
    'public.is_store_owner(uuid)',
    'public.store_is_active(uuid)',
    'public.can_manage_media(text)'
  ] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;

  -- Sólo usuarios logueados (validan permisos adentro).
  foreach f in array array[
    'public.adjust_stock(uuid, int, text, text, uuid)',
    'public.expire_unpaid_orders(uuid)',
    'public.inventory_summary(uuid)',
    'public.reorder_categories(uuid, jsonb)',
    'public.admin_sales_series(uuid, timestamptz, timestamptz, text, text)',
    'public.admin_top_products(uuid, timestamptz, timestamptz, int)',
    'public.pricing_scope_variants(uuid, jsonb)',
    'public.pricing_scope_facets(uuid)',
    'public.apply_price_changes(uuid, uuid, jsonb)',
    'public.undo_price_batch(uuid, uuid)',
    'public.admin_list_users(uuid)',
    'public.invite_store_member(uuid, text, text)',
    'public.accept_store_invite(text)',
    'public.create_store(text, text, text, text, jsonb)',
    'public.current_plan(uuid)',
    'public.expire_trials()',
    'public.platform_stats()',
    'public.platform_list_stores()',
    'public.platform_set_plan(uuid, text, text, timestamptz)',
    'public.platform_set_store_status(uuid, text)',
    'public.update_my_profile(text)',
    'public.touch_last_seen()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- =====================================================================
-- 11. Datos: URLs de media → media/<demo_id>/…
-- (los objetos se mueven con scripts/move-media-to-store.mts)
-- =====================================================================
do $$
declare
  v_demo text := (select id::text from public.stores where slug = 'demo');
  v_re constant text := '/storage/v1/object/public/media/(?![0-9a-f]{8}-[0-9a-f]{4}-)';
  v_to text := '/storage/v1/object/public/media/' || v_demo || '/';
begin
  update public.product_images set url = regexp_replace(url, v_re, v_to, 'g')
   where store_id = v_demo::uuid and url ~ v_re;
  update public.categories set image_url = regexp_replace(image_url, v_re, v_to, 'g')
   where store_id = v_demo::uuid and image_url ~ v_re;
  update public.order_items set image_url = regexp_replace(image_url, v_re, v_to, 'g')
   where store_id = v_demo::uuid and image_url ~ v_re;
  update public.products set description_html = regexp_replace(description_html, v_re, v_to, 'g')
   where store_id = v_demo::uuid and description_html ~ v_re;
  update public.store_settings
     set logo_url = regexp_replace(logo_url, v_re, v_to, 'g'),
         favicon_url = regexp_replace(favicon_url, v_re, v_to, 'g'),
         seo = regexp_replace(seo::text, v_re, v_to, 'g')::jsonb,
         legal = regexp_replace(legal::text, v_re, v_to, 'g')::jsonb
   where store_id = v_demo::uuid;
  update public.pages
     set blocks = regexp_replace(blocks::text, v_re, v_to, 'g')::jsonb,
         seo = regexp_replace(seo::text, v_re, v_to, 'g')::jsonb
   where store_id = v_demo::uuid and (blocks::text ~ v_re or seo::text ~ v_re);
  update public.page_drafts set data = regexp_replace(data::text, v_re, v_to, 'g')::jsonb
   where store_id = v_demo::uuid and data::text ~ v_re;
  update public.order_payments set receipt_url = regexp_replace(receipt_url, v_re, v_to, 'g')
   where store_id = v_demo::uuid and receipt_url ~ v_re;
end;
$$;

-- =====================================================================
-- 12. Versión del esquema
-- =====================================================================
insert into public.app_meta (key, value) values ('schema_version', '4'::jsonb)
  on conflict (key) do update set value = '4'::jsonb, updated_at = now();

-- =====================================================================
-- 13. Número de pedido automático (pedidos manuales del admin)
--     Aplicado como `0011_multitenant_order_number`. Si el insert no trae
--     número (0 por defecto), se toma de stores.next_order_number.
-- =====================================================================
create or replace function private.assign_order_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.number is null or new.number <= 0 then
    update public.stores
       set next_order_number = next_order_number + 1
     where id = new.store_id
    returning next_order_number - 1 into new.number;
    if new.number is null then
      raise exception 'La tienda del pedido no existe';
    end if;
  end if;
  return new;
end;
$$;

alter table public.orders alter column number set default 0;
drop trigger if exists orders_assign_number on public.orders;
create trigger orders_assign_number
  before insert on public.orders
  for each row execute function private.assign_order_number();
revoke execute on function private.assign_order_number() from public, anon, authenticated;

-- =====================================================================
-- 14. (Aplicado como `0011_multitenant_hero_default`) la portada de
--     create_store() ya nace con fondo "default" (ver arriba); corrige las
--     tiendas creadas antes de este ajuste.
-- =====================================================================
update public.pages p
   set blocks = jsonb_set(p.blocks, '{0,style,background}', '"default"')
 where p.slug = 'home'
   and p.blocks -> 0 ->> 'id' = 'home-hero'
   and p.blocks -> 0 -> 'style' ->> 'background' = 'primary'
   and p.store_id in (select id from public.stores where slug <> 'demo');

-- (Aplicado como `0011_multitenant_demo_onboarding`) la demo ya estaba armada:
-- sus pasos manuales del checklist cuentan como hechos.
update public.stores set onboarding = onboarding || '{"appearance": true, "shared": true}'::jsonb where slug = 'demo';
