-- =====================================================================
-- Ecommy v0 — 0001_foundation
-- Esquema completo (spec §3), funciones, triggers, RLS, storage y seed base.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Schema privado: funciones internas que NO se exponen por la API REST.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Helpers genéricos
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- 3.1 Identidad
-- =====================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'pending' check (role in ('owner', 'admin', 'staff', 'pending')),
  is_active boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active
      and role in ('owner', 'admin', 'staff')
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role = 'owner'
  );
$$;

-- ¿Ya existe un owner? Lo usa /admin/setup (público).
create or replace function public.has_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where role = 'owner');
$$;

-- Alta de perfil al crear un usuario de auth. El primero (mientras no haya
-- owner) queda como owner activo; el resto, pendiente de aprobación.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_first boolean;
begin
  -- Serializa altas concurrentes para que no haya dos owners.
  perform pg_advisory_xact_lock(hashtext('ecommy.profiles.owner'));
  v_is_first := not exists (select 1 from public.profiles where role = 'owner');

  insert into public.profiles (id, email, name, role, is_active)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    case when v_is_first then 'owner' else 'pending' end,
    v_is_first
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- =====================================================================
-- 3.2 Configuración
-- =====================================================================

create table public.store_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'Ecommy',
  tagline text,
  logo_url text,
  favicon_url text,
  contact_email text,
  contact_phone text,
  whatsapp_phone text,
  address text,
  currency text not null default 'ARS',
  locale text not null default 'es-AR',
  timezone text not null default 'America/Argentina/Buenos_Aires',
  social jsonb not null default '{}'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  announcement jsonb not null default '{"enabled": false}'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  checkout jsonb not null default '{}'::jsonb,
  inventory_policy text not null default 'on_order' check (inventory_policy in ('on_order', 'on_paid')),
  low_stock_threshold int not null default 5,
  policies jsonb not null default '{}'::jsonb,
  header jsonb not null default '{}'::jsonb,
  footer jsonb not null default '{}'::jsonb,
  maintenance jsonb not null default '{"enabled": false, "message": ""}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 3.3 Catálogo
-- =====================================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  parent_id uuid references public.categories (id) on delete set null,
  position int not null default 0,
  is_visible boolean not null default true,
  seo jsonb not null default '{}'::jsonb,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index categories_parent_idx on public.categories (parent_id);
alter table public.categories add constraint categories_external_id_key unique (external_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description_html text,
  short_description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  brand text,
  tags text[] not null default '{}',
  featured boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  source text not null default 'manual' check (source in ('manual', 'import', 'scrape')),
  source_url text,
  external_id text,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_status_idx on public.products (status);
create index products_created_at_idx on public.products (created_at desc);
create index products_tags_idx on public.products using gin (tags);
alter table public.products add constraint products_source_external_id_key unique (source, external_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  alt text,
  position int not null default 0,
  width int,
  height int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, position);

create table public.product_categories (
  product_id uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  position int not null default 0,
  primary key (product_id, category_id)
);
create index product_categories_category_idx on public.product_categories (category_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  title text not null default 'Default',
  option_values jsonb not null default '{}'::jsonb,
  sku text,
  barcode text,
  price numeric(12, 2) not null check (price >= 0),
  compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price >= 0),
  cost numeric(12, 2) check (cost is null or cost >= 0),
  stock int not null default 0,
  track_inventory boolean not null default true,
  allow_backorder boolean not null default false,
  low_stock_threshold int,
  weight_grams int,
  image_id uuid references public.product_images (id) on delete set null,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, option_values)
);
create index product_variants_product_idx on public.product_variants (product_id, position);
create index product_variants_sku_idx on public.product_variants (sku);
create index product_variants_image_idx on public.product_variants (image_id);

-- =====================================================================
-- 3.4 Precios y promociones
-- =====================================================================

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type text not null check (type in ('transfer', 'whatsapp', 'cash', 'other')),
  discount_percent numeric(5, 2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  instructions_md text,
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('percent', 'fixed')),
  value numeric(12, 2) not null check (value >= 0),
  scope text not null default 'all' check (scope in ('all', 'categories', 'products')),
  category_ids uuid[] not null default '{}',
  product_ids uuid[] not null default '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  priority int not null default 0,
  badge_label text,
  stackable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index promotions_active_idx on public.promotions (is_active, priority desc);

create table public.price_changes (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  old_price numeric(12, 2),
  old_compare_at numeric(12, 2),
  new_price numeric(12, 2),
  new_compare_at numeric(12, 2),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index price_changes_batch_idx on public.price_changes (batch_id);
create index price_changes_variant_idx on public.price_changes (variant_id);
create index price_changes_created_by_idx on public.price_changes (created_by);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and length(code) between 2 and 40),
  type text not null check (type in ('percent', 'fixed', 'free_shipping')),
  value numeric(12, 2) not null default 0 check (value >= 0),
  min_subtotal numeric(12, 2),
  max_uses int,
  uses_count int not null default 0,
  max_uses_per_customer int,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  scope text not null default 'all' check (scope in ('all', 'categories', 'products')),
  category_ids uuid[] not null default '{}',
  product_ids uuid[] not null default '{}',
  first_order_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 3.6 Envíos (antes que orders por las FKs)
-- =====================================================================

create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('polygon', 'provinces', 'postal_prefixes', 'everywhere')),
  geometry jsonb,
  provinces text[] not null default '{}',
  postal_prefixes text[] not null default '{}',
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  free_over numeric(12, 2),
  eta_text text,
  is_active boolean not null default true,
  position int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipping_zones_position_idx on public.shipping_zones (is_active, position);

create table public.pickup_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  hours_text text,
  lat double precision,
  lng double precision,
  is_active boolean not null default true,
  instructions_md text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 3.5 Clientes y pedidos
-- =====================================================================

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  name text,
  phone text,
  doc_number text,
  default_address jsonb,
  notes text,
  orders_count int not null default 0,
  total_spent numeric(12, 2) not null default 0,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.order_number_seq start with 1000 increment by 1 minvalue 1000;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.order_number_seq'),
  public_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  customer_id uuid references public.customers (id) on delete set null,
  customer jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'partial', 'refunded')),
  payment_method_code text,
  payment_discount_percent numeric(5, 2) not null default 0,
  payment_discount numeric(12, 2) not null default 0,
  fulfillment text not null default 'delivery' check (fulfillment in ('delivery', 'pickup')),
  shipping_zone_id uuid references public.shipping_zones (id) on delete set null,
  shipping_zone_name text,
  shipping_cost numeric(12, 2) not null default 0,
  shipping_address jsonb,
  pickup_location_id uuid references public.pickup_locations (id) on delete set null,
  subtotal numeric(12, 2) not null default 0,
  discount_total numeric(12, 2) not null default 0,
  promo_total numeric(12, 2) not null default 0,
  coupon_code text,
  coupon_discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  currency text not null default 'ARS',
  notes text,
  internal_notes text,
  source text not null default 'web' check (source in ('web', 'manual', 'whatsapp')),
  tracking_carrier text,
  tracking_number text,
  tracking_url text,
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  whatsapp_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter sequence public.order_number_seq owned by public.orders.number;
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_customer_idx on public.orders (customer_id);
create index orders_shipping_zone_idx on public.orders (shipping_zone_id);
create index orders_pickup_location_idx on public.orders (pickup_location_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  name text not null,
  variant_title text,
  sku text,
  image_url text,
  unit_price numeric(12, 2) not null,
  list_price numeric(12, 2) not null,
  qty int not null check (qty > 0),
  total numeric(12, 2) not null,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);
create index order_items_variant_idx on public.order_items (variant_id);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  type text not null check (type in (
    'created', 'status_changed', 'payment_status_changed', 'payment_added', 'note', 'shipped',
    'tracking_updated', 'whatsapp_opened', 'stock_adjusted', 'cancelled'
  )),
  message text,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  visible_to_customer boolean not null default false,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);
create index order_events_created_by_idx on public.order_events (created_by);

create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount numeric(12, 2) not null,
  method_code text,
  reference text,
  receipt_url text,
  paid_at timestamptz not null default now(),
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_payments_order_idx on public.order_payments (order_id);
create index order_payments_created_by_idx on public.order_payments (created_by);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  customer_email text not null,
  created_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id, customer_email);
create index coupon_redemptions_order_idx on public.coupon_redemptions (order_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  delta int not null,
  stock_after int not null,
  reason text not null check (reason in ('sale', 'cancel', 'restock', 'adjustment', 'return', 'import', 'correction')),
  note text,
  order_id uuid references public.orders (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);
create index inventory_movements_order_idx on public.inventory_movements (order_id);
create index inventory_movements_created_by_idx on public.inventory_movements (created_by);

-- =====================================================================
-- 3.7 Contenido
-- =====================================================================

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and (slug = 'home' or slug not in (
      'productos', 'producto', 'categoria', 'carrito', 'checkout', 'pedido', 'admin', 'api', 'buscar', '_next'
    ))
  ),
  type text not null default 'custom' check (type in ('home', 'landing', 'legal', 'custom')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  blocks jsonb not null default '[]'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  show_in_menu boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- La home no se puede borrar.
create or replace function private.protect_home_page()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.slug = 'home' then
    raise exception 'La página de inicio no se puede borrar';
  end if;
  return old;
end;
$$;

create trigger pages_protect_home
  before delete on public.pages
  for each row execute function private.protect_home_page();

-- =====================================================================
-- 3.8 Importación / scraping
-- =====================================================================

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  adapter text not null check (adapter in ('woocommerce', 'shopify', 'generic', 'jsonld')),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
  options jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{"found":0,"created":0,"updated":0,"skipped":0,"images":0,"errors":0}'::jsonb,
  log jsonb[] not null default '{}',
  cursor jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index import_jobs_created_at_idx on public.import_jobs (created_at desc);
create index import_jobs_created_by_idx on public.import_jobs (created_by);

create table public.import_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.import_jobs (id) on delete cascade,
  external_id text,
  name text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'imported', 'updated', 'skipped', 'error')),
  product_id uuid references public.products (id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index import_items_job_idx on public.import_items (job_id, status);
create index import_items_product_idx on public.import_items (product_id);

-- =====================================================================
-- 3.9 Sistema
-- =====================================================================

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text,
  action text not null,
  entity text,
  entity_id text,
  summary text,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_actor_idx on public.audit_log (actor_id);

create table public.app_meta (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- Triggers updated_at
-- =====================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'store_settings', 'menus', 'categories', 'products', 'product_images', 'product_variants',
    'payment_methods', 'promotions', 'coupons', 'shipping_zones', 'pickup_locations', 'customers', 'orders',
    'pages', 'import_jobs', 'import_items', 'app_meta'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end;
$$;

-- =====================================================================
-- Inventario: adjust_stock
-- =====================================================================

-- Interna (sin chequeo de permisos): la usan create_order y adjust_stock.
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
begin
  update public.product_variants
     set stock = stock + p_delta
   where id = p_variant_id
  returning stock into v_after;

  if not found then
    raise exception 'La variante no existe';
  end if;

  insert into public.inventory_movements (variant_id, delta, stock_after, reason, note, order_id, created_by)
  values (p_variant_id, p_delta, v_after, p_reason, p_note, p_order_id, auth.uid());

  return v_after;
end;
$$;

-- Pública para admins (RPC). Nunca hacer `update stock` a mano.
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
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  return private.adjust_stock(p_variant_id, p_delta, p_reason, p_note, p_order_id);
end;
$$;

-- =====================================================================
-- Pagos → payment_status
-- =====================================================================

create or replace function private.recalc_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid := coalesce(new.order_id, old.order_id);
  v_paid numeric(12, 2);
  v_total numeric(12, 2);
  v_current text;
  v_next text;
begin
  select total, payment_status into v_total, v_current from public.orders where id = v_order_id for update;
  if not found then
    return null;
  end if;

  select coalesce(sum(amount), 0) into v_paid from public.order_payments where order_id = v_order_id;

  if v_current = 'refunded' and v_paid <= 0 then
    v_next := 'refunded';
  elsif v_paid >= v_total and v_total > 0 then
    v_next := 'paid';
  elsif v_paid > 0 then
    v_next := 'partial';
  else
    v_next := 'pending';
  end if;

  if v_next is distinct from v_current then
    update public.orders
       set payment_status = v_next,
           paid_at = case when v_next = 'paid' then coalesce(paid_at, now()) else null end
     where id = v_order_id;
  end if;
  return null;
end;
$$;

create trigger order_payments_recalc
  after insert or update or delete on public.order_payments
  for each row execute function private.recalc_payment_status();

-- =====================================================================
-- Clientes: orders_count / total_spent
--   orders_count = pedidos no cancelados; total_spent = suma de pedidos pagados.
-- =====================================================================

create or replace function private.refresh_customer_stats(p_customer_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.customers c
     set orders_count = s.cnt,
         total_spent = s.spent
    from (
      select count(*) filter (where status <> 'cancelled') as cnt,
             coalesce(sum(total) filter (where status <> 'cancelled' and payment_status = 'paid'), 0) as spent
        from public.orders
       where customer_id = p_customer_id
    ) s
   where c.id = p_customer_id;
$$;

create or replace function private.orders_customer_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.customer_id is not null then
    perform private.refresh_customer_stats(new.customer_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.customer_id is not null
     and (tg_op = 'DELETE' or old.customer_id is distinct from new.customer_id) then
    perform private.refresh_customer_stats(old.customer_id);
  end if;
  return null;
end;
$$;

create trigger orders_customer_stats
  after insert or delete or update of customer_id, status, payment_status, total on public.orders
  for each row execute function private.orders_customer_stats();

-- =====================================================================
-- Cupones: validate_coupon (público)
--   p_items: [{ product_id, variant_id?, qty, unit_price }]
--   Devuelve { valid, reason?, code, type, value, scope, discount, free_shipping, eligible_subtotal }
-- =====================================================================

create or replace function public.validate_coupon(
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
  select * into c from public.coupons where code = upper(trim(coalesce(p_code, '')));
  if not found or not c.is_active then
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
       where lower(o.customer ->> 'email') = v_email and o.status <> 'cancelled'
    ) then
      return jsonb_build_object('valid', false, 'reason', 'El cupón es sólo para la primera compra');
    end if;
  end if;

  -- Subtotal elegible según alcance.
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

-- Piso de precio con promociones: el precio de lista con TODAS las promos
-- vigentes que aplican al producto, en cascada por prioridad. Es una cota
-- inferior segura (ninguna combinación legítima descuenta más), así un
-- llamado directo a create_order no puede pagar menos que eso.
create or replace function private.promo_floor_price(p_product_id uuid, p_price numeric)
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
     where is_active and value > 0
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

-- =====================================================================
-- create_order (público): ÚNICA vía de escritura del storefront.
-- El checkout calcula en TS (motor src/lib/pricing); acá se valida, se
-- recalculan los totales con precios de lista reales y el % del método de
-- pago, y se inserta todo atómicamente.
-- =====================================================================

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
  -- ---------- Datos del cliente ----------
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

  select * into v_settings from public.store_settings where id = 1;
  if coalesce((v_settings.checkout ->> 'require_phone')::boolean, false) and v_phone is null then
    raise exception 'Ingresá tu teléfono';
  end if;

  -- ---------- Método de pago ----------
  select * into v_pm from public.payment_methods
   where code = payload ->> 'payment_method_code' and is_active;
  if not found then
    raise exception 'El método de pago elegido no está disponible';
  end if;

  -- ---------- Ítems ----------
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
       where v.id = v_item.variant_id
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

      -- Precio unitario con promo calculado en TS; se acota a
      -- [piso con promos vigentes, precio de lista].
      select (l ->> 'unit_price')::numeric into v_unit
        from jsonb_array_elements(coalesce(payload -> 'lines', '[]'::jsonb)) l
       where (l ->> 'variant_id')::uuid = v_item.variant_id
       limit 1;
      v_unit := greatest(
        private.promo_floor_price(v_variant.product_id, v_variant.price),
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

  -- ---------- Cupón ----------
  if v_coupon_code is not null then
    select * into v_coupon from public.coupons where code = v_coupon_code for update;
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
      select 1 from public.orders o where lower(o.customer ->> 'email') = v_email and o.status <> 'cancelled'
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

  -- ---------- Envío / retiro ----------
  if v_fulfillment = 'pickup' then
    v_pickup_id := nullif(payload ->> 'pickup_location_id', '')::uuid;
    if v_pickup_id is not null and not exists (
      select 1 from public.pickup_locations where id = v_pickup_id and is_active
    ) then
      raise exception 'El punto de retiro elegido no está disponible';
    end if;
    v_shipping := 0;
  else
    v_zone_id := nullif(payload ->> 'shipping_zone_id', '')::uuid;
    if v_zone_id is not null then
      select * into v_zone from public.shipping_zones where id = v_zone_id and is_active;
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
      -- Sin zona (ej. "a coordinar por WhatsApp"): costo informado, nunca negativo.
      v_zone_name := nullif(payload ->> 'shipping_zone_name', '');
      v_shipping := case when v_free_shipping then 0
                         else greatest(0, coalesce((payload ->> 'shipping_cost')::numeric, 0)) end;
    end if;
  end if;

  -- ---------- Totales ----------
  v_payment_pct := coalesce(v_pm.discount_percent, 0);
  v_payment_discount := round(v_base * v_payment_pct / 100, 2);
  v_total := v_base - v_payment_discount + v_shipping;

  if coalesce((v_settings.checkout ->> 'min_order_total')::numeric, 0) > 0
     and v_base < (v_settings.checkout ->> 'min_order_total')::numeric then
    raise exception 'El pedido mínimo es de $ %', to_char((v_settings.checkout ->> 'min_order_total')::numeric, 'FM999G999G990');
  end if;

  -- ---------- Cliente ----------
  insert into public.customers (email, name, phone, doc_number, default_address)
  values (
    v_email, v_name, v_phone, v_doc,
    case when v_fulfillment = 'delivery' then payload -> 'shipping_address' else null end
  )
  on conflict (email) do update
     set name = excluded.name,
         phone = coalesce(excluded.phone, public.customers.phone),
         doc_number = coalesce(excluded.doc_number, public.customers.doc_number),
         default_address = coalesce(excluded.default_address, public.customers.default_address)
  returning id into v_customer_id;

  -- ---------- Pedido ----------
  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  insert into public.orders (
    public_token, customer_id, customer, payment_method_code, payment_discount_percent, payment_discount,
    fulfillment, shipping_zone_id, shipping_zone_name, shipping_cost, shipping_address, pickup_location_id,
    subtotal, promo_total, coupon_code, coupon_discount, discount_total, total, currency, notes, source
  ) values (
    v_token, v_customer_id,
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
  returning id, number into v_order_id, v_number;

  insert into public.order_items (
    order_id, product_id, variant_id, name, variant_title, sku, image_url, unit_price, list_price, qty, total
  )
  select v_order_id,
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

  insert into public.order_events (order_id, type, message, data, visible_to_customer)
  values (
    v_order_id, 'created', 'Recibimos tu pedido',
    jsonb_build_object('payment_method', v_pm.code, 'total', v_total, 'items', v_count),
    true
  );

  -- ---------- Stock ----------
  if coalesce(v_settings.inventory_policy, 'on_order') = 'on_order' then
    for v_line in select * from jsonb_array_elements(v_lines) loop
      if (v_line ->> 'track')::boolean then
        perform private.adjust_stock(
          (v_line ->> 'variant_id')::uuid, -((v_line ->> 'qty')::int), 'sale', 'Pedido #' || v_number, v_order_id
        );
      end if;
    end loop;
  end if;

  -- ---------- Cupón usado ----------
  if v_coupon_code is not null then
    update public.coupons set uses_count = uses_count + 1 where id = v_coupon.id;
    insert into public.coupon_redemptions (coupon_id, order_id, customer_email)
    values (v_coupon.id, v_order_id, v_email);
  end if;

  return jsonb_build_object('id', v_order_id, 'number', v_number, 'public_token', v_token);
end;
$$;

-- =====================================================================
-- get_order_by_token (público): pedido + ítems + eventos visibles + pago.
-- =====================================================================

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

  select * into s from public.store_settings where id = 1;

  select jsonb_build_object(
           'code', pm.code, 'name', pm.name, 'type', pm.type,
           'discount_percent', pm.discount_percent, 'instructions_md', pm.instructions_md
         )
    into v_pm
    from public.payment_methods pm
   where pm.code = o.payment_method_code;

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

-- =====================================================================
-- Permisos de funciones
-- =====================================================================

-- Por defecto Postgres da EXECUTE a PUBLIC: lo sacamos y otorgamos explícito.
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.adjust_stock(uuid, int, text, text, uuid) from public, anon;
revoke execute on function public.create_order(jsonb) from public;
revoke execute on function public.get_order_by_token(text) from public;
revoke execute on function public.validate_coupon(text, numeric, jsonb, text) from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_owner() from public;
revoke execute on function public.has_owner() from public;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_owner() to anon, authenticated;
grant execute on function public.has_owner() to anon, authenticated;
grant execute on function public.adjust_stock(uuid, int, text, text, uuid) to authenticated;
grant execute on function public.create_order(jsonb) to anon, authenticated;
grant execute on function public.get_order_by_token(text) to anon, authenticated;
grant execute on function public.validate_coupon(text, numeric, jsonb, text) to anon, authenticated;

grant usage, select on sequence public.order_number_seq to authenticated;

-- El costo de las variantes no se expone al público: anon sólo puede leer
-- estas columnas (las queries del storefront deben listar columnas, no `*`).
revoke select on public.product_variants from anon;
grant select (
  id, product_id, title, option_values, sku, barcode, price, compare_at_price, stock, track_inventory,
  allow_backorder, low_stock_threshold, weight_grams, image_id, position, is_active, created_at, updated_at
) on public.product_variants to anon;

-- =====================================================================
-- RLS (spec §3.10)
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.store_settings enable row level security;
alter table public.menus enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.payment_methods enable row level security;
alter table public.promotions enable row level security;
alter table public.price_changes enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.order_payments enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.pickup_locations enable row level security;
alter table public.pages enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_items enable row level security;
alter table public.audit_log enable row level security;
alter table public.app_meta enable row level security;

-- ---------- profiles ----------
create policy "profiles: ver el propio o admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: owner inserta" on public.profiles
  for insert to authenticated
  with check ((select public.is_owner()));
create policy "profiles: owner modifica" on public.profiles
  for update to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));
create policy "profiles: owner borra" on public.profiles
  for delete to authenticated
  using ((select public.is_owner()) and id <> (select auth.uid()));

-- ---------- Tablas de lectura pública + admin total ----------
-- Patrón: una policy SELECT pública (filtrada) y policies de escritura sólo
-- para admin. Para SELECT, el admin ve todo vía el OR dentro de la misma
-- policy (evita múltiples policies permisivas por acción).

-- store_settings
create policy "store_settings: lectura pública" on public.store_settings
  for select to anon, authenticated using (true);
create policy "store_settings: admin inserta" on public.store_settings
  for insert to authenticated with check ((select public.is_admin()));
create policy "store_settings: admin modifica" on public.store_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- menus
create policy "menus: lectura pública" on public.menus
  for select to anon, authenticated using (true);
create policy "menus: admin inserta" on public.menus
  for insert to authenticated with check ((select public.is_admin()));
create policy "menus: admin modifica" on public.menus
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "menus: admin borra" on public.menus
  for delete to authenticated using ((select public.is_admin()));

-- categories
create policy "categories: visibles o admin" on public.categories
  for select to anon, authenticated using (is_visible or (select public.is_admin()));
create policy "categories: admin inserta" on public.categories
  for insert to authenticated with check ((select public.is_admin()));
create policy "categories: admin modifica" on public.categories
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "categories: admin borra" on public.categories
  for delete to authenticated using ((select public.is_admin()));

-- products
create policy "products: activos o admin" on public.products
  for select to anon, authenticated using (status = 'active' or (select public.is_admin()));
create policy "products: admin inserta" on public.products
  for insert to authenticated with check ((select public.is_admin()));
create policy "products: admin modifica" on public.products
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "products: admin borra" on public.products
  for delete to authenticated using ((select public.is_admin()));

-- product_images
create policy "product_images: de productos activos o admin" on public.product_images
  for select to anon, authenticated using (
    (select public.is_admin())
    or exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
  );
create policy "product_images: admin inserta" on public.product_images
  for insert to authenticated with check ((select public.is_admin()));
create policy "product_images: admin modifica" on public.product_images
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "product_images: admin borra" on public.product_images
  for delete to authenticated using ((select public.is_admin()));

-- product_categories
create policy "product_categories: lectura pública" on public.product_categories
  for select to anon, authenticated using (true);
create policy "product_categories: admin inserta" on public.product_categories
  for insert to authenticated with check ((select public.is_admin()));
create policy "product_categories: admin modifica" on public.product_categories
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "product_categories: admin borra" on public.product_categories
  for delete to authenticated using ((select public.is_admin()));

-- product_variants
create policy "product_variants: activas de productos activos o admin" on public.product_variants
  for select to anon, authenticated using (
    (select public.is_admin())
    or (is_active and exists (select 1 from public.products p where p.id = product_id and p.status = 'active'))
  );
create policy "product_variants: admin inserta" on public.product_variants
  for insert to authenticated with check ((select public.is_admin()));
create policy "product_variants: admin modifica" on public.product_variants
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "product_variants: admin borra" on public.product_variants
  for delete to authenticated using ((select public.is_admin()));

-- promotions
create policy "promotions: activas o admin" on public.promotions
  for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy "promotions: admin inserta" on public.promotions
  for insert to authenticated with check ((select public.is_admin()));
create policy "promotions: admin modifica" on public.promotions
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "promotions: admin borra" on public.promotions
  for delete to authenticated using ((select public.is_admin()));

-- payment_methods
create policy "payment_methods: activos o admin" on public.payment_methods
  for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy "payment_methods: admin inserta" on public.payment_methods
  for insert to authenticated with check ((select public.is_admin()));
create policy "payment_methods: admin modifica" on public.payment_methods
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "payment_methods: admin borra" on public.payment_methods
  for delete to authenticated using ((select public.is_admin()));

-- shipping_zones
create policy "shipping_zones: activas o admin" on public.shipping_zones
  for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy "shipping_zones: admin inserta" on public.shipping_zones
  for insert to authenticated with check ((select public.is_admin()));
create policy "shipping_zones: admin modifica" on public.shipping_zones
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "shipping_zones: admin borra" on public.shipping_zones
  for delete to authenticated using ((select public.is_admin()));

-- pickup_locations
create policy "pickup_locations: activos o admin" on public.pickup_locations
  for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy "pickup_locations: admin inserta" on public.pickup_locations
  for insert to authenticated with check ((select public.is_admin()));
create policy "pickup_locations: admin modifica" on public.pickup_locations
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "pickup_locations: admin borra" on public.pickup_locations
  for delete to authenticated using ((select public.is_admin()));

-- pages
create policy "pages: publicadas o admin" on public.pages
  for select to anon, authenticated using (status = 'published' or (select public.is_admin()));
create policy "pages: admin inserta" on public.pages
  for insert to authenticated with check ((select public.is_admin()));
create policy "pages: admin modifica" on public.pages
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "pages: admin borra" on public.pages
  for delete to authenticated using ((select public.is_admin()));

-- ---------- Tablas sólo admin ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'inventory_movements', 'price_changes', 'coupons', 'coupon_redemptions', 'customers', 'orders',
    'order_items', 'order_events', 'order_payments', 'import_jobs', 'import_items', 'app_meta'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
      t || ': sólo admin', t
    );
  end loop;
end;
$$;

-- audit_log: admin lee; admin inserta sólo a su nombre; nadie modifica ni borra.
create policy "audit_log: admin lee" on public.audit_log
  for select to authenticated using ((select public.is_admin()));
create policy "audit_log: admin inserta" on public.audit_log
  for insert to authenticated
  with check ((select public.is_admin()) and actor_id = (select auth.uid()));

-- =====================================================================
-- Storage: bucket público `media`
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml', 'video/mp4', 'application/pdf']
)
on conflict (id) do update set public = excluded.public;

-- Lectura: el bucket es público (URLs /object/public/…); no hace falta policy
-- SELECT para anon (evita que se pueda listar el bucket). Admin sí lista.
create policy "media: admin lista" on storage.objects
  for select to authenticated using (bucket_id = 'media' and (select public.is_admin()));
create policy "media: admin sube" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and (select public.is_admin()));
create policy "media: admin modifica" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));
create policy "media: admin borra" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and (select public.is_admin()));

-- =====================================================================
-- Seed base
-- =====================================================================

insert into public.store_settings (
  id, name, tagline, whatsapp_phone, currency, locale, timezone, social, seo, announcement, theme, checkout,
  inventory_policy, low_stock_threshold, policies, header, footer, maintenance
) values (
  1,
  'Ecommy',
  'Tu tienda online',
  '5493816173548',
  'ARS',
  'es-AR',
  'America/Argentina/Buenos_Aires',
  '{"instagram": "", "facebook": "", "tiktok": "", "x": "", "youtube": ""}',
  '{"title": "Ecommy", "description": "Comprá online y pagá por transferencia o coordiná con nosotros por WhatsApp.", "og_image_url": ""}',
  '{"enabled": true, "text": "10 % de descuento pagando por transferencia", "href": "/productos", "bg": "", "fg": ""}',
  '{"preset":"nordico","colors":{"background":"#F4F5F6","surface":"#FFFFFF","text":"#16181C","textMuted":"#5B616B","primary":"#1E3A5F","primaryText":"#FFFFFF","secondary":"#E6E9ED","accent":"#B42318","border":"#DADDE2","success":"#1F7A4D","danger":"#9F1D1D"},"fonts":{"heading":"sora","body":"manrope","headingWeight":600,"bodyWeight":400,"headingTransform":"none","headingTracking":"tight","baseSize":15},"radius":"sm","buttons":{"style":"solid","shape":"radius","uppercase":false},"cards":{"style":"bordered","imageRatio":"1:1","hover":"zoom","showSku":true,"showBrand":true},"header":{"layout":"logo-left","sticky":true,"transparentOnHome":false,"showSearch":true},"layout":{"density":"compact","containerWidth":"wide","gridColumns":{"mobile":2,"desktop":5}},"footer":{"style":"columns","showSocial":true,"showPayments":true},"effects":{"shadows":"none","dividers":true,"imageFilter":"none"}}',
  '{
    "transfer": {
      "enabled": true,
      "discount_percent": 10,
      "bank_name": "",
      "holder": "",
      "cbu": "",
      "alias": "",
      "cuit": "",
      "instructions_md": "Transferí el total indicado y envianos el comprobante por WhatsApp con el número de pedido."
    },
    "whatsapp": {
      "enabled": true,
      "message_template": "Hola! Hice el pedido #{number} en {store}.\n\n{items}\n\nTotal: {total}\n{delivery}\n\nNombre: {name}"
    },
    "require_phone": true,
    "require_address_for_pickup": false,
    "order_notes_enabled": true,
    "min_order_total": 0
  }',
  'on_order',
  5,
  '{"shipping_md": "", "returns_md": "", "privacy_md": "", "terms_md": ""}',
  '{}',
  '{}',
  '{"enabled": false, "message": "Estamos haciendo mejoras. Volvemos en un rato."}'
)
on conflict (id) do nothing;

insert into public.payment_methods (code, name, type, discount_percent, instructions_md, is_active, position) values
  ('transfer', 'Transferencia bancaria', 'transfer', 10,
   'Transferí el total a la cuenta indicada y envianos el comprobante por WhatsApp.', true, 0),
  ('whatsapp', 'Acordar con el vendedor', 'whatsapp', 0,
   'Te contactamos por WhatsApp para coordinar el pago y la entrega.', true, 1)
on conflict (code) do nothing;

insert into public.menus (handle, items) values
  ('header', '[
    {"label": "Inicio", "href": "/", "children": []},
    {"label": "Productos", "href": "/productos", "children": []},
    {"label": "Cómo comprar", "href": "/#como-comprar", "children": []}
  ]'),
  ('footer', '[
    {"label": "Tienda", "href": "/productos", "children": [
      {"label": "Todos los productos", "href": "/productos", "children": []},
      {"label": "Carrito", "href": "/carrito", "children": []}
    ]},
    {"label": "Ayuda", "href": "/#como-comprar", "children": [
      {"label": "Cómo comprar", "href": "/#como-comprar", "children": []}
    ]}
  ]')
on conflict (handle) do nothing;

insert into public.pages (title, slug, type, status, blocks, seo, published_at, show_in_menu) values (
  'Inicio', 'home', 'home', 'published',
  '[{"id":"home-hero","type":"hero","style":{"background":"default","paddingY":"none","container":"full"},"settings":{"title":"Todo para tu casa, en un solo lugar","subtitle":"Hogar, cocina, tecnología y más. 10 % off pagando por transferencia.","imageUrl":"https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=2000&q=70","overlay":45,"align":"left","height":"lg","cta":{"label":"Ver productos","href":"/productos"},"cta2":{"label":"Cómo comprar","href":"#como-comprar"}}},{"id":"home-newest","type":"product_slider","style":{"background":"default","paddingY":"md","container":"normal"},"settings":{"title":"Recién llegados","subtitle":"Lo último que sumamos al catálogo.","source":{"kind":"newest","limit":12},"viewAllHref":"/productos","cardsPerView":4}},{"id":"home-banners","type":"banner_grid","style":{"background":"default","paddingY":"md","container":"normal"},"settings":{"columns":2,"ratio":"16:9","gap":"md","items":[{"imageUrl":"https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1400&q=70","title":"Cocina","subtitle":"Pequeños electros y bazar","cta":{"label":"Ver cocina","href":"/productos?cat=cocina"},"href":"/productos?cat=cocina","align":"left","overlay":35,"textColor":"light"},{"imageUrl":"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1400&q=70","title":"Audio","subtitle":"Auriculares y parlantes","cta":{"label":"Ver audio","href":"/productos?cat=audio"},"href":"/productos?cat=audio","align":"left","overlay":35,"textColor":"light"}]}},{"id":"home-como-comprar","type":"rich_text","style":{"background":"surface","paddingY":"lg","container":"normal"},"settings":{"align":"left","maxWidth":"narrow","html":"<h2 id=\"como-comprar\">Cómo comprar</h2><ol><li><strong>Armá tu carrito</strong> con los productos que quieras.</li><li><strong>Elegí cómo pagar</strong>: transferencia bancaria (con 10 % de descuento) o acordá con nosotros por WhatsApp.</li><li><strong>Confirmá el pedido</strong>: queda registrado y te mostramos los pasos para completar el pago.</li></ol><p>¿Dudas? Escribinos por WhatsApp y te ayudamos.</p>"}}]',
  '{"title": "", "description": ""}',
  now(),
  false
)
on conflict (slug) do nothing;

insert into public.app_meta (key, value) values
  ('schema_version', '1'::jsonb)
on conflict (key) do update set value = excluded.value;

-- =====================================================================
-- Ajustes por advisors de seguridad
-- =====================================================================
-- `rls_auto_enable()` es la función del event trigger `ensure_rls` que crea
-- la plataforma; no tiene sentido como RPC. Los event triggers no chequean
-- EXECUTE, así que revocarlo es seguro.
-- Warnings aceptados (intencionales): create_order, get_order_by_token,
-- validate_coupon y has_owner son RPC públicas por diseño; is_admin/is_owner
-- deben ser ejecutables por anon/authenticated porque las usan las policies;
-- adjust_stock valida is_admin() adentro.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'rls_auto_enable' and pronamespace = 'public'::regnamespace) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
