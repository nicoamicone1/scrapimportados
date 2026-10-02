-- =====================================================================
-- 0022 · Apps de Ecommy (módulos) + App "Taller 3D" (impresión 3D FDM)
--        Spec: docs/modules/TALLER-3D.md §1.1, §2 y §3.
--
-- Idempotente (`if not exists`, `create or replace`, `drop … if exists`,
-- `on conflict do nothing`). Requiere 0021 (la frena con un error claro si
-- falta): print3d_checkout_quote copia la parte de cliente/entrega/pago de
-- create_order (0021).
--
-- 1. Apps (fase 0)
--    · modules: catálogo de apps (seed: 'print3d' · Taller 3D). Lectura para
--      todos; escribe el superadmin.
--    · store_modules: qué app tiene cada tienda (active / trial / disabled,
--      vencimiento opcional y nota interna). La lee el equipo de la tienda;
--      la escribe sólo el superadmin (desde /platform).
--    · store_has_module(store, code): fila active/trial vigente. anon y
--      authenticated (la usan el storefront, las policies y las RPC).
--    · Al activar 'print3d' se crea print3d_settings de la tienda con los
--      valores por defecto (trigger en store_modules + relleno de las que ya
--      la tenían).
-- 2. Taller 3D — tablas print3d_* (todas con store_id y RLS):
--      settings, printers, materials, colors, spools, qualities, calibration,
--      quotes, quote_items, product_specs, jobs.
--    RLS: el equipo activo de la tienda (o el superadmin) lee todo y escribe
--    sólo si la tienda tiene la app vigente. anon no toca ninguna tabla:
--    todo lo público pasa por RPC.
--    Integridad multi-tienda: colors/spools/quote_items heredan store_id del
--    padre (private.inherit_store_id, como 0011) y un trigger
--    (private.print3d_same_store) rechaza referencias a filas de otra tienda
--    y colores que no son del material elegido.
--    Unicidad de specs de producto con índice sobre
--    (product_id, coalesce(variant_id, 0…0)): variant_id null = todas.
--    Pedido cancelado (a mano o vencido sin pago) → sus trabajos que todavía
--    estaban 'queued' pasan a 'cancelled' y la cotización vuelve a 'priced'
--    (order_id = null) si sigue vigente (trigger en orders).
-- 3. Storage: bucket privado `print3d-files` (100 MB, STL/3MF).
--    Ruta `<store_id>/q/<uuid>/<archivo>.<stl|3mf>`. Sube anon/authenticated
--    si la tienda está activa, con la app vigente y el cotizador prendido
--    (public.print3d_can_upload, con cupo de 200 archivos por hora por
--    tienda); lee y borra el equipo
--    (public.can_manage_media, 0011). Nadie hace UPDATE.
-- 4. Motor en SQL (espejo EXACTO de src/lib/print3d, §3.2, §3.3, §3.7):
--      · private.print3d_geometry_plausible(geometry)
--      · private.print3d_ceil_to(x, r)
--      · private.print3d_price_item(store, V, A, material, quality, infill,
--        supports, qty) → {raw_grams, raw_minutes, grams, minutes,
--        unit_price, total}. Orden de redondeo: raw_* = round(·, 2) sólo
--        para guardar; grams = round(raw_grams_sin_redondear · grams_factor, 2);
--        minutes = round(raw_min_sin_redondear · time_factor, 2) (raw_min se
--        calcula con los gramos SIN redondear); el precio usa grams/minutes
--        ya redondeados. Cada "round(·, 2)" es round(round(·, 8), 2) y el
--        ceilTo usa round(x, 8): igual que round2/ceilMultiple de round.ts
--        (la división de numeric no es exacta).
--      · private.print3d_fits(bbox, bed): 6 rotaciones = ordenar las 3
--        medidas de pieza y de cama y comparar componente a componente (<=).
-- 5. RPC (security definer, search_path = ''):
--      · print3d_public_config(store) — anon. Nunca devuelve costos.
--      · print3d_submit_quote(store, ip_hash, payload) — anon. Recalcula todo.
--      · print3d_get_quote(token) — anon. Sin ip_hash, file_path ni costos.
--      · print3d_checkout_quote(token, payload) — anon. Cotización → pedido.
--      · print3d_finish_job(job, gramos, minutos, bobina, post) — equipo.
--      · print3d_fail_job(job, gramos perdidos, motivo, reimprimir) — equipo.
-- 6. schema_version = 13 (con greatest).
--
-- Orden de deploy: después de 0021. Sin esta migración las pantallas del
-- Taller 3D y /admin/apps no tienen de dónde leer.
-- =====================================================================

do $$
begin
  if to_regprocedure('private.tier_price(uuid, integer, numeric)') is null
     or not exists (
       select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'bundle_discount'
     ) then
    raise exception '0022 necesita 0021_price_tiers.sql: aplicá esa migración primero.';
  end if;
end;
$$;

create schema if not exists private;

-- =====================================================================
-- 1. Apps (módulos)
-- =====================================================================
create table if not exists public.modules (
  code text primary key check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  tagline text not null,
  description_md text not null default '',
  price_monthly numeric(12, 2) check (price_monthly is null or price_monthly >= 0),
  is_public boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.store_modules (
  store_id uuid not null references public.stores (id) on delete cascade,
  module_code text not null references public.modules (code) on delete cascade,
  status text not null default 'active' check (status in ('active', 'trial', 'disabled')),
  activated_at timestamptz not null default now(),
  expires_at timestamptz,
  notes text,
  activated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_id, module_code)
);
create index if not exists store_modules_module_idx on public.store_modules (module_code);
create index if not exists store_modules_activated_by_idx on public.store_modules (activated_by);

drop trigger if exists store_modules_set_updated_at on public.store_modules;
create trigger store_modules_set_updated_at
  before update on public.store_modules
  for each row execute function public.set_updated_at();

create or replace function public.store_has_module(p_store_id uuid, p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.store_modules sm
     where sm.store_id = p_store_id
       and sm.module_code = p_code
       and sm.status in ('active', 'trial')
       and (sm.expires_at is null or sm.expires_at > now())
  );
$$;

revoke all on function public.store_has_module(uuid, text) from public;
grant execute on function public.store_has_module(uuid, text) to anon, authenticated;

alter table public.modules enable row level security;
alter table public.store_modules enable row level security;

drop policy if exists "modules: lectura" on public.modules;
drop policy if exists "modules: superadmin inserta" on public.modules;
drop policy if exists "modules: superadmin modifica" on public.modules;
drop policy if exists "modules: superadmin borra" on public.modules;
create policy "modules: lectura" on public.modules
  for select to anon, authenticated using (true);
create policy "modules: superadmin inserta" on public.modules
  for insert to authenticated with check ((select public.is_platform_admin()));
create policy "modules: superadmin modifica" on public.modules
  for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
create policy "modules: superadmin borra" on public.modules
  for delete to authenticated using ((select public.is_platform_admin()));

drop policy if exists "store_modules: equipo lee" on public.store_modules;
drop policy if exists "store_modules: superadmin inserta" on public.store_modules;
drop policy if exists "store_modules: superadmin modifica" on public.store_modules;
drop policy if exists "store_modules: superadmin borra" on public.store_modules;
create policy "store_modules: equipo lee" on public.store_modules
  for select to authenticated using (public.is_store_member(store_id));
create policy "store_modules: superadmin inserta" on public.store_modules
  for insert to authenticated with check ((select public.is_platform_admin()));
create policy "store_modules: superadmin modifica" on public.store_modules
  for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
create policy "store_modules: superadmin borra" on public.store_modules
  for delete to authenticated using ((select public.is_platform_admin()));
revoke all on public.store_modules from anon;

insert into public.modules (code, name, tagline, description_md, price_monthly, is_public, position) values (
  'print3d',
  'Taller 3D',
  'Cotizador de STL, cola de impresoras y stock de filamento',
  E'Para talleres de impresión 3D FDM con varias impresoras.\n\n'
  || E'- **Cotizador en tu tienda**: el cliente sube su STL o 3MF, elige material, color, calidad y relleno, y ve al instante el precio y cuándo lo tiene listo.\n'
  || E'- **Cola por impresora**: tablero con los trabajos de cada máquina, reimpresiones y fallas (warping, atasco, despegue).\n'
  || E'- **Filamento en gramos**: bobinas por material y color, se descuentan solas al terminar cada trabajo.\n'
  || E'- **Costo real**: material, luz, amortización y post-proceso de cada pedido, y el margen que te deja.\n'
  || E'- **Calibración**: los gramos y minutos reales ajustan las próximas cotizaciones.',
  24999,
  true,
  0
)
on conflict (code) do nothing;

-- =====================================================================
-- 2. Taller 3D — tablas
-- =====================================================================
create table if not exists public.print3d_settings (
  store_id uuid primary key references public.stores (id) on delete cascade,
  enabled boolean not null default true,
  hour_rate numeric(12, 2) not null default 1500 check (hour_rate >= 0),
  min_piece_price numeric(12, 2) not null default 1500 check (min_piece_price >= 0),
  min_order_price numeric(12, 2) not null default 5000 check (min_order_price >= 0),
  setup_fee numeric(12, 2) not null default 0 check (setup_fee >= 0),
  post_process_fee numeric(12, 2) not null default 0 check (post_process_fee >= 0),
  support_extra_pct numeric(5, 2) not null default 25 check (support_extra_pct >= 0),
  round_to numeric(12, 2) not null default 100 check (round_to >= 0),
  max_auto_hours numeric(6, 2) not null default 24 check (max_auto_hours > 0),
  max_file_mb int not null default 50 check (max_file_mb between 1 and 100),
  quote_valid_days int not null default 7 check (quote_valid_days between 1 and 365),
  kwh_price numeric(12, 2) not null default 150 check (kwh_price >= 0),
  labor_hour_cost numeric(12, 2) not null default 4000 check (labor_hour_cost >= 0),
  daily_print_hours numeric(4, 1) not null default 18 check (daily_print_hours > 0 and daily_print_hours <= 24),
  post_process_days int not null default 1 check (post_process_days between 0 and 60),
  buffer_days int not null default 0 check (buffer_days between 0 and 60),
  working_days int[] not null default '{1,2,3,4,5}'
    check (cardinality(working_days) between 1 and 7 and working_days <@ array[1, 2, 3, 4, 5, 6, 7]),
  intro_md text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.print3d_printers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  brand text,
  model text,
  bed_x numeric(6, 1) not null check (bed_x > 0),
  bed_y numeric(6, 1) not null check (bed_y > 0),
  bed_z numeric(6, 1) not null check (bed_z > 0),
  nozzle_mm numeric(3, 2) not null default 0.4 check (nozzle_mm > 0),
  materials text[] not null default '{PLA,PETG}'
    check (materials <@ array['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'NYLON', 'PC', 'OTRO']),
  watts numeric(7, 1) not null default 150 check (watts >= 0),
  purchase_price numeric(12, 2) not null default 0 check (purchase_price >= 0),
  lifetime_hours int not null default 5000 check (lifetime_hours > 0),
  hours_used numeric(10, 2) not null default 0 check (hours_used >= 0),
  status text not null default 'active' check (status in ('active', 'maintenance', 'inactive')),
  color text not null default '#E86A33' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists print3d_printers_store_idx on public.print3d_printers (store_id, position);

create table if not exists public.print3d_materials (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  type text not null check (type in ('PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'NYLON', 'PC', 'OTRO')),
  name text not null check (char_length(trim(name)) between 1 and 80),
  brand text,
  density numeric(4, 2) not null default 1.24 check (density > 0),
  price_per_gram numeric(10, 2) not null check (price_per_gram >= 0),
  speed_factor numeric(4, 2) not null default 1 check (speed_factor > 0),
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists print3d_materials_store_idx on public.print3d_materials (store_id, position);

create table if not exists public.print3d_colors (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  material_id uuid not null references public.print3d_materials (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  hex text not null default '#999999' check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists print3d_colors_store_idx on public.print3d_colors (store_id);
create index if not exists print3d_colors_material_idx on public.print3d_colors (material_id, position);

create table if not exists public.print3d_spools (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  color_id uuid not null references public.print3d_colors (id) on delete restrict,
  brand text,
  net_grams int not null default 1000 check (net_grams > 0),
  remaining_grams numeric(8, 1) not null check (remaining_grams >= 0),
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  status text not null default 'sealed' check (status in ('sealed', 'open', 'empty')),
  purchased_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists print3d_spools_store_idx on public.print3d_spools (store_id);
create index if not exists print3d_spools_color_idx on public.print3d_spools (color_id, status);

create table if not exists public.print3d_qualities (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  code text not null check (char_length(trim(code)) between 1 and 40),
  name text not null check (char_length(trim(name)) between 1 and 60),
  layer_height numeric(4, 2) not null check (layer_height > 0),
  wall_mm numeric(4, 2) not null default 1.2 check (wall_mm >= 0),
  throughput_g_h numeric(6, 2) not null check (throughput_g_h > 0),
  price_multiplier numeric(4, 2) not null default 1 check (price_multiplier > 0),
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, code)
);

create table if not exists public.print3d_calibration (
  store_id uuid not null references public.stores (id) on delete cascade,
  material_id uuid not null references public.print3d_materials (id) on delete cascade,
  quality_id uuid not null references public.print3d_qualities (id) on delete cascade,
  grams_factor numeric(6, 3) not null default 1 check (grams_factor > 0),
  time_factor numeric(6, 3) not null default 1 check (time_factor > 0),
  samples int not null default 0 check (samples >= 0),
  updated_at timestamptz not null default now(),
  primary key (store_id, material_id, quality_id)
);
create index if not exists print3d_calibration_material_idx on public.print3d_calibration (material_id);
create index if not exists print3d_calibration_quality_idx on public.print3d_calibration (quality_id);

create table if not exists public.print3d_quotes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  -- 32 hex (128 bits), como orders.public_token. Es el secreto del link público.
  token text not null unique check (token ~ '^[0-9a-f]{32}$'),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'priced', 'ordered', 'expired', 'rejected')),
  contact jsonb not null default '{}'::jsonb check (jsonb_typeof(contact) = 'object'),
  notes text,
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  setup_fee numeric(12, 2) not null default 0 check (setup_fee >= 0),
  min_adjustment numeric(12, 2) not null default 0 check (min_adjustment >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  estimated_ready_date date,
  expires_at timestamptz not null,
  order_id uuid references public.orders (id) on delete set null,
  ip_hash text not null check (char_length(ip_hash) between 1 and 128),
  review_note text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists print3d_quotes_store_created_idx on public.print3d_quotes (store_id, created_at desc);
create index if not exists print3d_quotes_store_status_idx on public.print3d_quotes (store_id, status);
create index if not exists print3d_quotes_store_ip_idx on public.print3d_quotes (store_id, ip_hash, created_at desc);
create index if not exists print3d_quotes_order_idx on public.print3d_quotes (order_id);
create index if not exists print3d_quotes_reviewed_by_idx on public.print3d_quotes (reviewed_by);

create table if not exists public.print3d_quote_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  quote_id uuid not null references public.print3d_quotes (id) on delete cascade,
  file_path text not null,
  file_name text,
  file_size int check (file_size is null or file_size >= 0),
  format text check (format is null or format in ('stl', '3mf')),
  -- Geometry (§3.1) ya escalada a mm: {volume_mm3, area_mm2, bbox: [x,y,z], triangles, manifold}.
  geometry jsonb not null check (jsonb_typeof(geometry) = 'object'),
  material_id uuid not null references public.print3d_materials (id) on delete restrict,
  color_id uuid not null references public.print3d_colors (id) on delete restrict,
  quality_id uuid not null references public.print3d_qualities (id) on delete restrict,
  infill_pct int not null check (infill_pct between 0 and 100),
  supports boolean not null default false,
  qty int not null default 1 check (qty between 1 and 500),
  raw_grams numeric(10, 2),
  raw_minutes numeric(10, 2),
  grams numeric(10, 2),
  minutes numeric(10, 2),
  unit_price numeric(12, 2) check (unit_price is null or unit_price >= 0),
  total numeric(12, 2) check (total is null or total >= 0),
  needs_review boolean not null default false,
  review_reasons text[] not null default '{}',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists print3d_quote_items_store_idx on public.print3d_quote_items (store_id);
create index if not exists print3d_quote_items_quote_idx on public.print3d_quote_items (quote_id, position);
create index if not exists print3d_quote_items_material_idx on public.print3d_quote_items (material_id);
create index if not exists print3d_quote_items_color_idx on public.print3d_quote_items (color_id);
create index if not exists print3d_quote_items_quality_idx on public.print3d_quote_items (quality_id);

create table if not exists public.print3d_product_specs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  -- null = todas las variantes del producto.
  variant_id uuid references public.product_variants (id) on delete cascade,
  material_id uuid not null references public.print3d_materials (id) on delete restrict,
  color_id uuid references public.print3d_colors (id) on delete restrict,
  quality_id uuid not null references public.print3d_qualities (id) on delete restrict,
  grams_per_unit numeric(10, 2) not null check (grams_per_unit >= 0),
  minutes_per_unit numeric(10, 2) not null check (minutes_per_unit >= 0),
  units_per_plate int not null default 1 check (units_per_plate >= 1),
  post_minutes numeric(8, 2) not null default 0 check (post_minutes >= 0),
  made_to_order boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- unique (product_id, variant_id) con null = "todas": índice con coalesce.
-- (PostgREST no puede usarlo como onConflict: el upsert se hace en dos pasos.)
create unique index if not exists print3d_product_specs_product_variant_key
  on public.print3d_product_specs (product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists print3d_product_specs_store_idx on public.print3d_product_specs (store_id);
create index if not exists print3d_product_specs_variant_idx on public.print3d_product_specs (variant_id);
create index if not exists print3d_product_specs_material_idx on public.print3d_product_specs (material_id);
create index if not exists print3d_product_specs_color_idx on public.print3d_product_specs (color_id);
create index if not exists print3d_product_specs_quality_idx on public.print3d_product_specs (quality_id);

create table if not exists public.print3d_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  order_item_id uuid references public.order_items (id) on delete set null,
  quote_item_id uuid references public.print3d_quote_items (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  parent_job_id uuid references public.print3d_jobs (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 300),
  qty int not null default 1 check (qty >= 1),
  printer_id uuid references public.print3d_printers (id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'printing', 'post', 'done', 'failed', 'cancelled')),
  position int not null default 0,
  material_id uuid references public.print3d_materials (id) on delete set null,
  color_id uuid references public.print3d_colors (id) on delete set null,
  quality_id uuid references public.print3d_qualities (id) on delete set null,
  spool_id uuid references public.print3d_spools (id) on delete set null,
  -- TOTAL del trabajo (todas las piezas), calibrado / sin calibrar / real.
  est_grams numeric(10, 2) check (est_grams is null or est_grams >= 0),
  est_minutes numeric(10, 2) check (est_minutes is null or est_minutes >= 0),
  raw_grams numeric(10, 2) check (raw_grams is null or raw_grams >= 0),
  raw_minutes numeric(10, 2) check (raw_minutes is null or raw_minutes >= 0),
  actual_grams numeric(10, 2) check (actual_grams is null or actual_grams >= 0),
  actual_minutes numeric(10, 2) check (actual_minutes is null or actual_minutes >= 0),
  wasted_grams numeric(10, 2) not null default 0 check (wasted_grams >= 0),
  post_minutes numeric(8, 2) not null default 0 check (post_minutes >= 0),
  failure_reason text
    check (failure_reason is null or failure_reason in ('warping', 'atasco', 'despegue', 'corte_luz', 'filamento', 'capa', 'otro')),
  started_at timestamptz,
  finished_at timestamptz,
  due_date date,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists print3d_jobs_board_idx on public.print3d_jobs (store_id, status, printer_id, position);
create index if not exists print3d_jobs_calibration_idx
  on public.print3d_jobs (store_id, material_id, quality_id, finished_at desc) where status = 'done';
create index if not exists print3d_jobs_order_idx on public.print3d_jobs (order_id);
create index if not exists print3d_jobs_order_item_idx on public.print3d_jobs (order_item_id);
create index if not exists print3d_jobs_quote_item_idx on public.print3d_jobs (quote_item_id);
create index if not exists print3d_jobs_product_idx on public.print3d_jobs (product_id);
create index if not exists print3d_jobs_variant_idx on public.print3d_jobs (variant_id);
create index if not exists print3d_jobs_parent_idx on public.print3d_jobs (parent_job_id);
create index if not exists print3d_jobs_printer_idx on public.print3d_jobs (printer_id);
create index if not exists print3d_jobs_material_idx on public.print3d_jobs (material_id);
create index if not exists print3d_jobs_color_idx on public.print3d_jobs (color_id);
create index if not exists print3d_jobs_quality_idx on public.print3d_jobs (quality_id);
create index if not exists print3d_jobs_spool_idx on public.print3d_jobs (spool_id);
create index if not exists print3d_jobs_created_by_idx on public.print3d_jobs (created_by);

-- updated_at
do $$
declare
  t text;
begin
  foreach t in array array[
    'print3d_settings', 'print3d_printers', 'print3d_materials', 'print3d_colors', 'print3d_spools',
    'print3d_qualities', 'print3d_calibration', 'print3d_quotes', 'print3d_quote_items',
    'print3d_product_specs', 'print3d_jobs'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Integridad multi-tienda
-- ---------------------------------------------------------------------
-- store_id de las hijas = el del padre (función de 0011).
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('print3d_colors', 'print3d_materials', 'material_id'),
      ('print3d_spools', 'print3d_colors', 'color_id'),
      ('print3d_quote_items', 'print3d_quotes', 'quote_id')
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

-- Referencias a filas de OTRA tienda → error. Argumentos: pares (columna,
-- tabla). Además, si la fila tiene material_id y color_id, el color tiene que
-- ser de ese material. Corre después de *_inherit_store (orden alfabético).
create or replace function private.print3d_same_store()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_id uuid;
  v_store uuid;
  i int := 0;
begin
  while i + 1 < tg_nargs loop
    v_id := (v_row ->> tg_argv[i])::uuid;
    if v_id is not null then
      v_store := null;
      execute format('select store_id from public.%I where id = $1', tg_argv[i + 1]) into v_store using v_id;
      if v_store is not null and v_store is distinct from new.store_id then
        raise exception 'Los datos elegidos no son de esta tienda.';
      end if;
    end if;
    i := i + 2;
  end loop;

  if v_row ? 'material_id' and v_row ? 'color_id'
     and (v_row ->> 'material_id') is not null and (v_row ->> 'color_id') is not null
     and not exists (
       select 1 from public.print3d_colors c
        where c.id = (v_row ->> 'color_id')::uuid and c.material_id = (v_row ->> 'material_id')::uuid
     ) then
    raise exception 'El color elegido no es de ese material.';
  end if;
  return new;
end;
$$;

do $$
declare
  r record;
  v_cols text;
  v_args text;
begin
  for r in
    select * from (values
      ('print3d_calibration', array['material_id', 'print3d_materials', 'quality_id', 'print3d_qualities']),
      ('print3d_quotes', array['order_id', 'orders']),
      ('print3d_quote_items', array['material_id', 'print3d_materials', 'color_id', 'print3d_colors',
                                    'quality_id', 'print3d_qualities']),
      ('print3d_product_specs', array['product_id', 'products', 'variant_id', 'product_variants',
                                      'material_id', 'print3d_materials', 'color_id', 'print3d_colors',
                                      'quality_id', 'print3d_qualities']),
      ('print3d_jobs', array['order_id', 'orders', 'order_item_id', 'order_items',
                             'quote_item_id', 'print3d_quote_items', 'product_id', 'products',
                             'variant_id', 'product_variants', 'parent_job_id', 'print3d_jobs',
                             'printer_id', 'print3d_printers', 'material_id', 'print3d_materials',
                             'color_id', 'print3d_colors', 'quality_id', 'print3d_qualities',
                             'spool_id', 'print3d_spools'])
    ) as x(tbl, args)
  loop
    select 'store_id, ' || string_agg(quote_ident(u.a), ', ' order by u.n)
      into v_cols
      from unnest(r.args) with ordinality as u(a, n)
     where u.n % 2 = 1;
    select string_agg(quote_literal(u.a), ', ' order by u.n)
      into v_args
      from unnest(r.args) with ordinality as u(a, n);
    execute format('drop trigger if exists %I on public.%I', r.tbl || '_same_store', r.tbl);
    execute format(
      'create trigger %I before insert or update of %s on public.%I for each row execute function private.print3d_same_store(%s)',
      r.tbl || '_same_store', v_cols, r.tbl, v_args
    );
  end loop;
end;
$$;

-- Al activar la app se crea la configuración con los valores por defecto.
create or replace function private.print3d_on_store_module()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.module_code = 'print3d' then
    insert into public.print3d_settings (store_id) values (new.store_id)
    on conflict (store_id) do nothing;
  end if;
  return null;
end;
$$;

drop trigger if exists store_modules_print3d_settings on public.store_modules;
create trigger store_modules_print3d_settings
  after insert or update of status, module_code on public.store_modules
  for each row execute function private.print3d_on_store_module();

insert into public.print3d_settings (store_id)
select sm.store_id from public.store_modules sm where sm.module_code = 'print3d'
on conflict (store_id) do nothing;

-- Pedido cancelado (a mano o vencido sin pago): lo que no se empezó a imprimir
-- sale de la cola, y la cotización vuelve a 'priced' (sin pedido) si sigue
-- vigente, para que el cliente la pueda volver a comprar.
create or replace function private.print3d_cancel_order_jobs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.print3d_jobs
     set status = 'cancelled'
   where order_id = new.id and status = 'queued';
  update public.print3d_quotes
     set status = 'priced', order_id = null
   where order_id = new.id and status = 'ordered' and expires_at > now();
  return null;
end;
$$;

drop trigger if exists orders_print3d_cancel_jobs on public.orders;
create trigger orders_print3d_cancel_jobs
  after update of status on public.orders
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function private.print3d_cancel_order_jobs();

-- ---------------------------------------------------------------------
-- RLS: el equipo lee; escribe sólo con la app vigente. anon, nada.
-- ---------------------------------------------------------------------
do $$
declare
  adm constant text := '(store_id = any ((select public.admin_store_ids())::uuid[]) or (select public.is_platform_admin()))';
  app constant text := 'public.store_has_module(store_id, ''print3d'')';
  t text;
begin
  foreach t in array array[
    'print3d_settings', 'print3d_printers', 'print3d_materials', 'print3d_colors', 'print3d_spools',
    'print3d_qualities', 'print3d_calibration', 'print3d_quotes', 'print3d_quote_items',
    'print3d_product_specs', 'print3d_jobs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || ': equipo lee', t);
    execute format('drop policy if exists %I on public.%I', t || ': equipo inserta', t);
    execute format('drop policy if exists %I on public.%I', t || ': equipo modifica', t);
    execute format('drop policy if exists %I on public.%I', t || ': equipo borra', t);
    execute format('create policy %I on public.%I for select to authenticated using (%s)', t || ': equipo lee', t, adm);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s and %s)', t || ': equipo inserta', t, adm, app);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s and %s)', t || ': equipo modifica', t, adm, adm, app);
    execute format('create policy %I on public.%I for delete to authenticated using (%s and %s)', t || ': equipo borra', t, adm, app);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

-- =====================================================================
-- 3. Storage: print3d-files/<store_id>/q/<uuid>/<archivo>.<stl|3mf>
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'print3d-files', 'print3d-files', false, 104857600,
  array[
    'model/stl', 'application/sla', 'application/vnd.ms-pki.stl', 'application/octet-stream',
    'model/3mf', 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml', 'application/zip'
  ]
)
on conflict (id) do update
   set file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- ¿Se puede subir este archivo? Ruta exacta, tienda activa, app vigente y cotizador prendido.
create or replace function public.print3d_can_upload(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_parts text[];
  v_store uuid;
begin
  if p_name is null or char_length(p_name) > 400 then
    return false;
  end if;
  v_parts := string_to_array(p_name, '/');
  if cardinality(v_parts) <> 4
     or v_parts[1] !~ v_uuid or v_parts[2] <> 'q' or v_parts[3] !~ v_uuid
     or char_length(v_parts[4]) not between 5 and 200
     or lower(v_parts[4]) !~ '\.(stl|3mf)$' then
    return false;
  end if;
  v_store := v_parts[1]::uuid;
  if not (public.store_is_active(v_store)
          and public.store_has_module(v_store, 'print3d')
          and exists (select 1 from public.print3d_settings s where s.store_id = v_store and s.enabled)) then
    return false;
  end if;
  -- Cupo: 200 archivos por hora por tienda (el bucket es público para subir).
  return (
    select count(*) from storage.objects o
     where o.bucket_id = 'print3d-files'
       and o.name like v_store::text || '/q/%'
       and o.created_at > now() - interval '1 hour'
  ) < 200;
end;
$$;

revoke all on function public.print3d_can_upload(text) from public;
grant execute on function public.print3d_can_upload(text) to anon, authenticated;

drop policy if exists "print3d-files: cotizador sube" on storage.objects;
drop policy if exists "print3d-files: equipo lee" on storage.objects;
drop policy if exists "print3d-files: equipo borra" on storage.objects;
create policy "print3d-files: cotizador sube" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'print3d-files' and public.print3d_can_upload(name));
create policy "print3d-files: equipo lee" on storage.objects
  for select to authenticated
  using (bucket_id = 'print3d-files' and public.can_manage_media(name));
create policy "print3d-files: equipo borra" on storage.objects
  for delete to authenticated
  using (bucket_id = 'print3d-files' and public.can_manage_media(name));

-- =====================================================================
-- 4. Motor en SQL (espejo de src/lib/print3d)
-- =====================================================================

-- §3.2 geometryIsPlausible: todo finito y > 0; V <= bx·by·bz·1.001;
-- A >= (36π·V²)^(1/3)·0.99; triángulos >= 4; mayor medida <= 2000 mm.
-- En double precision, como el navegador.
create or replace function private.print3d_geometry_plausible(p_g jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v float8;
  a float8;
  x float8;
  y float8;
  z float8;
  t float8;
begin
  if jsonb_typeof(p_g) is distinct from 'object'
     or jsonb_typeof(p_g -> 'volume_mm3') is distinct from 'number'
     or jsonb_typeof(p_g -> 'area_mm2') is distinct from 'number'
     or jsonb_typeof(p_g -> 'triangles') is distinct from 'number'
     or jsonb_typeof(p_g -> 'bbox') is distinct from 'array'
     or jsonb_array_length(p_g -> 'bbox') <> 3
     or jsonb_typeof(p_g -> 'bbox' -> 0) is distinct from 'number'
     or jsonb_typeof(p_g -> 'bbox' -> 1) is distinct from 'number'
     or jsonb_typeof(p_g -> 'bbox' -> 2) is distinct from 'number' then
    return false;
  end if;
  v := (p_g ->> 'volume_mm3')::float8;
  a := (p_g ->> 'area_mm2')::float8;
  t := (p_g ->> 'triangles')::float8;
  x := (p_g -> 'bbox' ->> 0)::float8;
  y := (p_g -> 'bbox' ->> 1)::float8;
  z := (p_g -> 'bbox' ->> 2)::float8;
  if not (v > 0 and a > 0 and t > 0 and x > 0 and y > 0 and z > 0) then
    return false;
  end if;
  if greatest(x, y, z) > 2000 then
    return false;
  end if;
  if v > x * y * z * 1.001 then
    return false;
  end if;
  if a < cbrt(36 * pi() * v * v) * 0.99 then
    return false;
  end if;
  if t < 4 then
    return false;
  end if;
  return true;
exception
  when others then
    return false;
end;
$$;

-- ceilTo(x, r) = r > 0 ? ceil(x / r) · r : round(x, 2)
-- Primero round(x, 8), como ceilMultiple/round2 de round.ts: la división de
-- numeric no es exacta (40.00/60 = 0.66666666666666666667) y sin esto
-- 1500.000000000000000005 saltaba a 1600.
create or replace function private.print3d_ceil_to(p_x numeric, p_r numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(p_r, 0) > 0
              then round(ceil(round(p_x, 8) / p_r) * p_r, 2)
              else round(round(p_x, 8), 2) end;
$$;

-- fitsPrinter: 6 rotaciones = ordenar las medidas de la pieza y de la cama
-- y comparar componente a componente.
create or replace function private.print3d_fits(p_bbox numeric[], p_bed numeric[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when cardinality(p_bbox) = 3 and cardinality(p_bed) = 3 then coalesce((
      select bool_and(b.v <= d.v)
        from (select u.v, row_number() over (order by u.v) as i from unnest(p_bbox) as u(v)) b
        join (select u.v, row_number() over (order by u.v) as i from unnest(p_bed) as u(v)) d on d.i = b.i
    ), false)
    else false
  end;
$$;

-- Σ gramos de las bobinas no vacías del color (available_grams).
create or replace function private.print3d_available_grams(p_color_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(sp.remaining_grams), 0)
    from public.print3d_spools sp
   where sp.color_id = p_color_id and sp.status <> 'empty';
$$;

-- "Hoy" en la zona de la tienda.
create or replace function private.print3d_store_today(p_store_id uuid)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  select nullif(trim(s.timezone), '') into v_tz from public.store_settings s where s.store_id = p_store_id;
  begin
    return (now() at time zone coalesce(v_tz, 'America/Argentina/Buenos_Aires'))::date;
  exception
    when others then
      return (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  end;
end;
$$;

-- §3.3 priceItem (por unidad, geometría en mm). IDÉNTICA al motor TS.
create or replace function private.print3d_price_item(
  p_store_id uuid,
  p_volume numeric,
  p_area numeric,
  p_material_id uuid,
  p_quality_id uuid,
  p_infill_pct int,
  p_supports boolean,
  p_qty int
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_s public.print3d_settings;
  v_m public.print3d_materials;
  v_q public.print3d_qualities;
  v_gf numeric;
  v_tf numeric;
  v_shell numeric;
  v_mat numeric;
  v_raw_g numeric;
  v_raw_m numeric;
  v_grams numeric;
  v_minutes numeric;
  v_base numeric;
  v_unit numeric;
begin
  select * into v_s from public.print3d_settings where store_id = p_store_id;
  if not found then
    raise exception 'El cotizador no está disponible.';
  end if;
  select * into v_m from public.print3d_materials where id = p_material_id and store_id = p_store_id;
  if not found then
    raise exception 'El material elegido ya no está disponible.';
  end if;
  select * into v_q from public.print3d_qualities where id = p_quality_id and store_id = p_store_id;
  if not found then
    raise exception 'La calidad elegida ya no está disponible.';
  end if;
  select c.grams_factor, c.time_factor into v_gf, v_tf
    from public.print3d_calibration c
   where c.store_id = p_store_id and c.material_id = p_material_id and c.quality_id = p_quality_id;
  v_gf := coalesce(v_gf, 1);
  v_tf := coalesce(v_tf, 1);

  v_shell := least(p_volume, p_area * v_q.wall_mm);
  v_mat := v_shell + (p_volume - v_shell) * p_infill_pct / 100;
  if p_supports then
    v_mat := v_mat * (1 + v_s.support_extra_pct / 100);
  end if;
  v_raw_g := v_mat / 1000 * v_m.density;
  v_raw_m := v_raw_g / (v_q.throughput_g_h * v_m.speed_factor) * 60;
  -- Gramos y minutos a 2 decimales ANTES de los precios. round(·, 8) primero,
  -- como round2() de round.ts (la división de numeric no es exacta).
  v_grams := round(round(v_raw_g * v_gf, 8), 2);
  v_minutes := round(round(v_raw_m * v_tf, 8), 2);
  v_base := (v_grams * v_m.price_per_gram + v_minutes / 60 * v_s.hour_rate) * v_q.price_multiplier + v_s.post_process_fee;
  v_unit := private.print3d_ceil_to(greatest(v_s.min_piece_price, v_base), v_s.round_to);

  return jsonb_build_object(
    'raw_grams', round(round(v_raw_g, 8), 2),
    'raw_minutes', round(round(v_raw_m, 8), 2),
    'grams', v_grams,
    'minutes', v_minutes,
    'unit_price', v_unit,
    'total', round(v_unit * p_qty, 2)
  );
end;
$$;

revoke all on function private.print3d_same_store() from public, anon, authenticated;
revoke all on function private.print3d_on_store_module() from public, anon, authenticated;
revoke all on function private.print3d_cancel_order_jobs() from public, anon, authenticated;
revoke all on function private.print3d_geometry_plausible(jsonb) from public, anon, authenticated;
revoke all on function private.print3d_ceil_to(numeric, numeric) from public, anon, authenticated;
revoke all on function private.print3d_fits(numeric[], numeric[]) from public, anon, authenticated;
revoke all on function private.print3d_available_grams(uuid) from public, anon, authenticated;
revoke all on function private.print3d_store_today(uuid) from public, anon, authenticated;
revoke all on function private.print3d_price_item(uuid, numeric, numeric, uuid, uuid, int, boolean, int)
  from public, anon, authenticated;

-- =====================================================================
-- 5. RPC
-- =====================================================================

-- ---------------------------------------------------------------------
-- 5.1 Configuración pública del cotizador (sin costos)
-- ---------------------------------------------------------------------
create or replace function public.print3d_public_config(p_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_s public.print3d_settings;
  v_active int;
  v_unassigned numeric;
  v_share numeric := 0;
begin
  if p_store_id is null
     or not public.store_is_active(p_store_id)
     or not public.store_has_module(p_store_id, 'print3d') then
    return null;
  end if;
  select * into v_s from public.print3d_settings where store_id = p_store_id;
  if not found or not v_s.enabled then
    return null;
  end if;

  -- Cola: minutos que faltan (lo que ya se imprimió de un trabajo en curso no
  -- cuenta). Los no asignados se reparten en partes iguales entre las activas.
  select count(*) into v_active
    from public.print3d_printers p
   where p.store_id = p_store_id and p.status = 'active';
  select coalesce(sum(greatest(0, coalesce(j.est_minutes, 0)
           - case when j.status = 'printing' and j.started_at is not null
                  then extract(epoch from (now() - j.started_at)) / 60 else 0 end)), 0)
    into v_unassigned
    from public.print3d_jobs j
   where j.store_id = p_store_id and j.printer_id is null and j.status in ('queued', 'printing');
  if v_active > 0 then
    v_share := v_unassigned / v_active;
  end if;

  return jsonb_build_object(
    'settings', jsonb_build_object(
      'hour_rate', v_s.hour_rate,
      'min_piece_price', v_s.min_piece_price,
      'min_order_price', v_s.min_order_price,
      'setup_fee', v_s.setup_fee,
      'post_process_fee', v_s.post_process_fee,
      'support_extra_pct', v_s.support_extra_pct,
      'round_to', v_s.round_to,
      'max_auto_hours', v_s.max_auto_hours,
      'max_file_mb', v_s.max_file_mb,
      'quote_valid_days', v_s.quote_valid_days,
      'daily_print_hours', v_s.daily_print_hours,
      'post_process_days', v_s.post_process_days,
      'buffer_days', v_s.buffer_days,
      'working_days', to_jsonb(v_s.working_days),
      'intro_md', v_s.intro_md
    ),
    'materials', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'type', m.type,
               'name', m.name,
               'density', m.density,
               'price_per_gram', m.price_per_gram,
               'speed_factor', m.speed_factor,
               'colors', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', c.id,
                          'name', c.name,
                          'hex', c.hex,
                          'available_grams', private.print3d_available_grams(c.id)
                        ) order by c.position, c.name)
                   from public.print3d_colors c
                  where c.material_id = m.id and c.is_active
               ), '[]'::jsonb)
             ) order by m.position, m.name)
        from public.print3d_materials m
       where m.store_id = p_store_id and m.is_active
    ), '[]'::jsonb),
    'qualities', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id,
               'code', q.code,
               'name', q.name,
               'layer_height', q.layer_height,
               'wall_mm', q.wall_mm,
               'throughput_g_h', q.throughput_g_h,
               'price_multiplier', q.price_multiplier
             ) order by q.position, q.name)
        from public.print3d_qualities q
       where q.store_id = p_store_id and q.is_active
    ), '[]'::jsonb),
    'calibration', coalesce((
      select jsonb_agg(jsonb_build_object(
               'material_id', cb.material_id,
               'quality_id', cb.quality_id,
               'grams_factor', cb.grams_factor,
               'time_factor', cb.time_factor,
               'samples', cb.samples
             ))
        from public.print3d_calibration cb
       where cb.store_id = p_store_id
    ), '[]'::jsonb),
    'printers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'bed', jsonb_build_array(p.bed_x, p.bed_y, p.bed_z),
               'materials', to_jsonb(p.materials),
               'backlog_minutes', round(coalesce(b.minutes, 0) + v_share, 2)
             ) order by p.position, p.name)
        from public.print3d_printers p
        left join lateral (
          select sum(greatest(0, coalesce(j.est_minutes, 0)
                   - case when j.status = 'printing' and j.started_at is not null
                          then extract(epoch from (now() - j.started_at)) / 60 else 0 end)) as minutes
            from public.print3d_jobs j
           where j.printer_id = p.id and j.status in ('queued', 'printing')
        ) b on true
       where p.store_id = p_store_id and p.status = 'active'
    ), '[]'::jsonb),
    'made_to_order', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_id', ps.product_id,
               'variant_id', ps.variant_id,
               'minutes_per_unit', ps.minutes_per_unit,
               'units_per_plate', ps.units_per_plate,
               'material_type', m.type
             ))
        from public.print3d_product_specs ps
        join public.products pr on pr.id = ps.product_id and pr.status = 'active'
        join public.print3d_materials m on m.id = ps.material_id
       where ps.store_id = p_store_id and ps.made_to_order
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5.2 Pedir una cotización (público)
-- ---------------------------------------------------------------------
create or replace function public.print3d_submit_quote(p_store_id uuid, p_ip_hash text, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip text := lower(trim(coalesce(p_ip_hash, '')));
  v_s public.print3d_settings;
  v_m public.print3d_materials;
  v_c public.print3d_colors;
  v_q public.print3d_qualities;
  v_prefix text := p_store_id::text || '/q/';
  v_ip_day int;
  v_store_day int;
  r record;
  v_path text;
  v_name text;
  v_format text;
  v_size bigint;
  v_geo jsonb;
  v_vol numeric;
  v_area numeric;
  v_bbox numeric[];
  v_manifold boolean;
  v_n numeric;
  v_infill int;
  v_qty int;
  v_supports boolean;
  v_price jsonb;
  v_grams numeric;
  v_minutes numeric;
  v_reasons text[];
  v_items jsonb := '[]'::jsonb;
  v_review boolean := false;
  v_subtotal numeric(12, 2) := 0;
  v_setup numeric(12, 2);
  v_min_adj numeric(12, 2);
  v_total numeric(12, 2);
  v_contact_in jsonb;
  v_c_name text;
  v_c_email text;
  v_c_phone text;
  v_status text;
  v_today date;
  v_min_date date;
  v_date date;
  v_token text;
  v_quote_id uuid;
begin
  -- El hash de IP es obligatorio (lo arma la server action): sin él no hay cupo por IP.
  if v_ip !~ '^[0-9a-f]{16,64}$' then
    raise exception 'La cotización tiene datos inválidos.';
  end if;
  if p_store_id is null
     or not public.store_is_active(p_store_id)
     or not public.store_has_module(p_store_id, 'print3d') then
    raise exception 'El cotizador no está disponible.';
  end if;
  select * into v_s from public.print3d_settings where store_id = p_store_id;
  if not found or not v_s.enabled then
    raise exception 'El cotizador no está disponible.';
  end if;

  if jsonb_typeof(payload) is distinct from 'object'
     or jsonb_typeof(payload -> 'items') is distinct from 'array'
     or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'Subí al menos una pieza para cotizar.';
  end if;
  if jsonb_array_length(payload -> 'items') > 20 then
    raise exception 'Podés cotizar hasta 20 piezas por vez.';
  end if;

  -- Cupos atómicos por tienda: 10 por IP y 300 por tienda en las últimas 24 h.
  perform pg_advisory_xact_lock(hashtext('print3d_quotes:' || p_store_id::text));
  select count(*) into v_ip_day from public.print3d_quotes
   where store_id = p_store_id and ip_hash = v_ip and created_at > now() - interval '1 day';
  select count(*) into v_store_day from public.print3d_quotes
   where store_id = p_store_id and created_at > now() - interval '1 day';
  if v_ip_day >= 10 or v_store_day >= 300 then
    raise exception 'Llegaste al máximo de cotizaciones por hoy. Escribinos por WhatsApp.';
  end if;

  begin
    for r in
      select t.e as el, t.pos::int as pos
        from jsonb_array_elements(payload -> 'items') with ordinality as t(e, pos)
       order by t.pos
    loop
      if jsonb_typeof(r.el) is distinct from 'object' then
        raise exception 'La cotización tiene datos inválidos.';
      end if;

      -- Archivo: tiene que estar subido en print3d-files bajo <store_id>/q/.
      v_path := trim(coalesce(r.el ->> 'file_path', ''));
      if char_length(v_path) > 400 or left(v_path, char_length(v_prefix)) <> v_prefix then
        raise exception 'Uno de los archivos no se subió bien. Volvé a intentarlo.';
      end if;
      select coalesce((o.metadata ->> 'size')::bigint, 0) into v_size
        from storage.objects o
       where o.bucket_id = 'print3d-files' and o.name = v_path;
      if not found then
        raise exception 'Uno de los archivos no se subió bien. Volvé a intentarlo.';
      end if;
      v_name := nullif(left(trim(coalesce(r.el ->> 'file_name', '')), 200), '');
      v_name := coalesce(v_name, regexp_replace(v_path, '^.*/', ''));
      if v_size > v_s.max_file_mb::bigint * 1024 * 1024 then
        raise exception 'El archivo "%" pesa más de % MB.', v_name, v_s.max_file_mb;
      end if;
      -- El formato sale de la extensión de la ruta (no del navegador).
      v_format := lower(substring(v_path from '\.([A-Za-z0-9]+)$'));
      if v_format is null or v_format not in ('stl', '3mf') then
        raise exception 'Sólo aceptamos archivos STL o 3MF.';
      end if;

      -- Geometría (§3.2): si no es plausible se rechaza (no va a revisión).
      v_geo := r.el -> 'geometry';
      if not private.print3d_geometry_plausible(v_geo) then
        raise exception 'No pudimos leer bien la pieza "%". Revisá el archivo y volvé a subirlo.', v_name;
      end if;
      v_vol := (v_geo ->> 'volume_mm3')::numeric;
      v_area := (v_geo ->> 'area_mm2')::numeric;
      v_bbox := array[(v_geo -> 'bbox' ->> 0)::numeric, (v_geo -> 'bbox' ->> 1)::numeric, (v_geo -> 'bbox' ->> 2)::numeric];
      v_manifold := coalesce(v_geo -> 'manifold' = 'true'::jsonb, false);

      -- Material, color y calidad: activos, de esta tienda, color del material.
      select * into v_m from public.print3d_materials
       where id = (r.el ->> 'material_id')::uuid and store_id = p_store_id and is_active;
      if not found then
        raise exception 'El material elegido para "%" ya no está disponible.', v_name;
      end if;
      select * into v_c from public.print3d_colors
       where id = (r.el ->> 'color_id')::uuid and store_id = p_store_id and material_id = v_m.id and is_active;
      if not found then
        raise exception 'El color elegido para "%" ya no está disponible.', v_name;
      end if;
      select * into v_q from public.print3d_qualities
       where id = (r.el ->> 'quality_id')::uuid and store_id = p_store_id and is_active;
      if not found then
        raise exception 'La calidad elegida para "%" ya no está disponible.', v_name;
      end if;

      v_n := (r.el ->> 'infill_pct')::numeric;
      if v_n is null or v_n <> trunc(v_n) or v_n < 0 or v_n > 100 then
        raise exception 'El relleno tiene que ir de 0 a 100 %%.';
      end if;
      v_infill := v_n::int;
      v_n := (r.el ->> 'qty')::numeric;
      if v_n is null or v_n <> trunc(v_n) or v_n < 1 or v_n > 500 then
        raise exception 'La cantidad tiene que ir de 1 a 500.';
      end if;
      v_qty := v_n::int;
      v_supports := coalesce(r.el -> 'supports' = 'true'::jsonb, false);

      -- Precio recalculado acá (nunca el del navegador).
      v_price := private.print3d_price_item(p_store_id, v_vol, v_area, v_m.id, v_q.id, v_infill, v_supports, v_qty);
      v_grams := (v_price ->> 'grams')::numeric;
      v_minutes := (v_price ->> 'minutes')::numeric;
      -- Topes de las columnas numeric(10,2)/(12,2): mejor un mensaje claro
      -- que un "numeric field overflow" al guardar.
      if v_grams * v_qty > 99999999 or v_minutes * v_qty > 99999999
         or (v_price ->> 'raw_grams')::numeric * v_qty > 99999999
         or (v_price ->> 'raw_minutes')::numeric * v_qty > 99999999
         or (v_price ->> 'total')::numeric > 9999999999 then
        raise exception 'La pieza "%" es demasiado grande para cotizar automático. Escribinos por WhatsApp.', v_name;
      end if;

      -- §3.4 revisión manual (mismo orden que REVIEW_REASONS).
      v_reasons := '{}';
      if not exists (
        select 1 from public.print3d_printers p
         where p.store_id = p_store_id and p.status = 'active'
           and v_m.type = any (p.materials)
           and private.print3d_fits(v_bbox, array[p.bed_x, p.bed_y, p.bed_z]::numeric[])
      ) then
        v_reasons := array_append(v_reasons, 'no_fit');
      end if;
      if v_minutes / 60 > v_s.max_auto_hours then
        v_reasons := array_append(v_reasons, 'too_long');
      end if;
      if not v_manifold then
        v_reasons := array_append(v_reasons, 'open_mesh');
      end if;
      if v_vol < 50 then
        v_reasons := array_append(v_reasons, 'too_small');
      end if;
      if private.print3d_available_grams(v_c.id) < v_grams * v_qty * 1.1 then
        v_reasons := array_append(v_reasons, 'no_stock');
      end if;
      if cardinality(v_reasons) > 0 then
        v_review := true;
      end if;

      v_subtotal := v_subtotal + (v_price ->> 'total')::numeric;
      v_items := v_items || jsonb_build_object(
        'file_path', v_path,
        'file_name', v_name,
        'file_size', least(v_size, 2147483647),
        'format', v_format,
        'geometry', jsonb_build_object(
          'volume_mm3', v_geo -> 'volume_mm3',
          'area_mm2', v_geo -> 'area_mm2',
          'bbox', v_geo -> 'bbox',
          'triangles', v_geo -> 'triangles',
          'manifold', v_manifold
        ),
        'material_id', v_m.id,
        'color_id', v_c.id,
        'quality_id', v_q.id,
        'infill_pct', v_infill,
        'supports', v_supports,
        'qty', v_qty,
        'raw_grams', v_price -> 'raw_grams',
        'raw_minutes', v_price -> 'raw_minutes',
        'grams', v_price -> 'grams',
        'minutes', v_price -> 'minutes',
        'unit_price', v_price -> 'unit_price',
        'total', v_price -> 'total',
        'needs_review', cardinality(v_reasons) > 0,
        'review_reasons', to_jsonb(v_reasons),
        'position', r.pos - 1
      );
    end loop;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'La cotización tiene datos inválidos.';
  end;

  -- Totales (quoteTotals).
  v_setup := v_s.setup_fee;
  v_min_adj := greatest(0, v_s.min_order_price - (v_subtotal + v_setup));
  v_total := v_subtotal + v_setup + v_min_adj;

  -- Contacto: obligatorio si algo queda en revisión.
  v_contact_in := case when jsonb_typeof(payload -> 'contact') = 'object' then payload -> 'contact' else '{}'::jsonb end;
  v_c_name := nullif(left(regexp_replace(trim(coalesce(v_contact_in ->> 'name', '')), '\s+', ' ', 'g'), 120), '');
  v_c_email := nullif(lower(trim(coalesce(v_contact_in ->> 'email', ''))), '');
  v_c_phone := nullif(left(trim(coalesce(v_contact_in ->> 'phone', '')), 40), '');
  if v_c_email is not null
     and (char_length(v_c_email) > 254 or v_c_email !~ '^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$') then
    raise exception 'Revisá el email.';
  end if;
  v_status := case when v_review then 'pending_review' else 'priced' end;
  if v_review and (v_c_name is null or (v_c_email is null and v_c_phone is null)) then
    raise exception 'Dejanos tu nombre y un email o teléfono: te avisamos cuando revisemos las piezas.';
  end if;

  -- Fecha estimada (la calcula la app, §3.5): nunca antes de hoy + post-proceso + 1.
  v_today := private.print3d_store_today(p_store_id);
  v_min_date := v_today + v_s.post_process_days + 1;
  begin
    v_date := nullif(trim(coalesce(payload ->> 'estimated_ready_date', '')), '')::date;
  exception
    when others then
      v_date := null;
  end;
  if v_date is not null then
    v_date := least(greatest(v_date, v_min_date), v_today + 365);
  end if;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  insert into public.print3d_quotes (
    store_id, token, status, contact, notes, subtotal, setup_fee, min_adjustment, total,
    estimated_ready_date, expires_at, ip_hash
  ) values (
    p_store_id, v_token, v_status,
    jsonb_strip_nulls(jsonb_build_object('name', v_c_name, 'email', v_c_email, 'phone', v_c_phone)),
    nullif(left(trim(coalesce(payload ->> 'notes', '')), 2000), ''),
    v_subtotal, v_setup, v_min_adj, v_total,
    v_date, now() + make_interval(days => v_s.quote_valid_days), v_ip
  )
  returning id into v_quote_id;

  insert into public.print3d_quote_items (
    store_id, quote_id, file_path, file_name, file_size, format, geometry, material_id, color_id, quality_id,
    infill_pct, supports, qty, raw_grams, raw_minutes, grams, minutes, unit_price, total, needs_review,
    review_reasons, position
  )
  select p_store_id, v_quote_id,
         i ->> 'file_path',
         i ->> 'file_name',
         (i ->> 'file_size')::int,
         i ->> 'format',
         i -> 'geometry',
         (i ->> 'material_id')::uuid,
         (i ->> 'color_id')::uuid,
         (i ->> 'quality_id')::uuid,
         (i ->> 'infill_pct')::int,
         (i ->> 'supports')::boolean,
         (i ->> 'qty')::int,
         (i ->> 'raw_grams')::numeric,
         (i ->> 'raw_minutes')::numeric,
         (i ->> 'grams')::numeric,
         (i ->> 'minutes')::numeric,
         (i ->> 'unit_price')::numeric,
         (i ->> 'total')::numeric,
         (i ->> 'needs_review')::boolean,
         array(select jsonb_array_elements_text(i -> 'review_reasons')),
         (i ->> 'position')::int
    from jsonb_array_elements(v_items) i;

  return jsonb_build_object('token', v_token, 'status', v_status, 'total', v_total);
end;
$$;

-- ---------------------------------------------------------------------
-- 5.3 Ver una cotización por token (público)
-- ---------------------------------------------------------------------
-- Sin ip_hash, file_path ni costos. Una cotización 'priced' vencida pasa a
-- 'expired' al vuelo (las que esperan revisión quedan: le toca al taller).
create or replace function public.print3d_get_quote(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := lower(trim(coalesce(p_token, '')));
  v_quote public.print3d_quotes;
  v_order jsonb;
begin
  if v_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;
  select * into v_quote from public.print3d_quotes where token = v_token;
  if not found or not public.store_is_active(v_quote.store_id) then
    return null;
  end if;

  if v_quote.status = 'priced' and v_quote.expires_at < now() then
    update public.print3d_quotes set status = 'expired' where id = v_quote.id
    returning * into v_quote;
  end if;

  if v_quote.order_id is not null then
    select jsonb_build_object('number', o.number, 'public_token', o.public_token, 'status', o.status)
      into v_order
      from public.orders o where o.id = v_quote.order_id;
  end if;

  return jsonb_build_object(
    'id', v_quote.id,
    'token', v_quote.token,
    'store_id', v_quote.store_id,
    'status', v_quote.status,
    -- Sólo el nombre: el link se comparte por WhatsApp (sin email ni teléfono).
    'contact', jsonb_strip_nulls(jsonb_build_object('name', v_quote.contact -> 'name')),
    'notes', v_quote.notes,
    'subtotal', v_quote.subtotal,
    'setup_fee', v_quote.setup_fee,
    'min_adjustment', v_quote.min_adjustment,
    'total', v_quote.total,
    'estimated_ready_date', v_quote.estimated_ready_date,
    'expires_at', v_quote.expires_at,
    'review_note', v_quote.review_note,
    'created_at', v_quote.created_at,
    'order', v_order,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', qi.id,
               'file_name', qi.file_name,
               'format', qi.format,
               'geometry', qi.geometry,
               'material', jsonb_build_object('id', m.id, 'type', m.type, 'name', m.name),
               'color', jsonb_build_object('id', c.id, 'name', c.name, 'hex', c.hex),
               'quality', jsonb_build_object('id', q.id, 'code', q.code, 'name', q.name, 'layer_height', q.layer_height),
               'infill_pct', qi.infill_pct,
               'supports', qi.supports,
               'qty', qi.qty,
               'grams', qi.grams,
               'minutes', qi.minutes,
               'unit_price', qi.unit_price,
               'total', qi.total,
               'needs_review', qi.needs_review,
               'review_reasons', to_jsonb(qi.review_reasons),
               'position', qi.position
             ) order by qi.position, qi.created_at)
        from public.print3d_quote_items qi
        join public.print3d_materials m on m.id = qi.material_id
        join public.print3d_colors c on c.id = qi.color_id
        join public.print3d_qualities q on q.id = qi.quality_id
       where qi.quote_id = v_quote.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5.4 Cotización → pedido (público)
-- ---------------------------------------------------------------------
-- Cliente, entrega, envío y medio de pago: COPIA de create_order (0021) sin
-- cupones, promos, tramos ni stock. Una línea por pieza + "Preparación del
-- pedido" y "Ajuste a pedido mínimo" si corresponden. Un trabajo 'queued'
-- sin impresora por pieza.
create or replace function public.print3d_checkout_quote(p_token text, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_in text := lower(trim(coalesce(p_token, '')));
  v_quote public.print3d_quotes;
  v_customer jsonb := coalesce(payload -> 'customer', '{}'::jsonb);
  v_email text := lower(trim(coalesce(v_customer ->> 'email', '')));
  v_name text := trim(coalesce(v_customer ->> 'name', ''));
  v_phone text := nullif(trim(coalesce(v_customer ->> 'phone', '')), '');
  v_doc text := nullif(trim(coalesce(v_customer ->> 'doc', '')), '');
  v_fulfillment text := coalesce(payload ->> 'fulfillment', 'delivery');
  v_store uuid;
  v_settings public.store_settings;
  v_pm public.payment_methods;
  v_zone public.shipping_zones;
  v_pickup_id uuid;
  v_zone_id uuid;
  v_zone_name text;
  v_item record;
  v_subtotal numeric(12, 2) := 0;
  v_base numeric(12, 2);
  v_payment_pct numeric(5, 2);
  v_payment_discount numeric(12, 2);
  v_shipping numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_customer_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
  v_number bigint;
  v_token text;
  v_count int := 0;
  v_position int;
  -- 0014: cupo de avisos al comprador (el pedido se crea igual).
  v_recent int;
  v_store_recent int;
  v_store_day int;
  v_notify boolean;
begin
  if v_token_in !~ '^[0-9a-f]{32}$' then
    raise exception 'La cotización no existe.';
  end if;
  select * into v_quote from public.print3d_quotes where token = v_token_in for update;
  if not found then
    raise exception 'La cotización no existe.';
  end if;
  if v_quote.status = 'ordered' then
    raise exception 'Esta cotización ya es un pedido.';
  end if;
  if v_quote.status = 'pending_review' then
    raise exception 'El taller todavía está revisando esta cotización.';
  end if;
  if v_quote.status = 'rejected' then
    raise exception 'El taller no pudo tomar esta cotización.';
  end if;
  -- (El paso a 'expired' lo hace print3d_get_quote: acá el raise lo desharía.)
  if v_quote.status = 'expired' or v_quote.expires_at < now() then
    raise exception 'La cotización venció. Volvé a cotizar las piezas.';
  end if;

  v_store := v_quote.store_id;
  begin
    if nullif(payload ->> 'store_id', '') is not null and (payload ->> 'store_id')::uuid <> v_store then
      raise exception 'La cotización es de otra tienda';
    end if;
  exception
    when invalid_text_representation then
      raise exception 'El pedido tiene datos inválidos';
  end;
  if not public.store_is_active(v_store) or not public.store_has_module(v_store, 'print3d') then
    raise exception 'La tienda no está disponible';
  end if;

  if v_name = '' then
    raise exception 'Ingresá tu nombre';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ingresá un email válido';
  end if;
  if v_fulfillment not in ('delivery', 'pickup') then
    raise exception 'Elegí un método de entrega';
  end if;

  select * into v_settings from public.store_settings where store_id = v_store;
  if coalesce((v_settings.checkout ->> 'require_phone')::boolean, false) and v_phone is null then
    raise exception 'Ingresá tu teléfono';
  end if;

  select * into v_pm from public.payment_methods
   where store_id = v_store and code = payload ->> 'payment_method_code' and is_active;
  if not found then
    raise exception 'El método de pago elegido no está disponible';
  end if;

  if not exists (select 1 from public.print3d_quote_items qi where qi.quote_id = v_quote.id) then
    raise exception 'La cotización no tiene piezas.';
  end if;

  -- Subtotal = piezas + preparación + ajuste a mínimo (= total de la cotización).
  select coalesce(sum(qi.total), 0) into v_subtotal
    from public.print3d_quote_items qi where qi.quote_id = v_quote.id;
  v_subtotal := v_subtotal + v_quote.setup_fee + v_quote.min_adjustment;
  v_base := v_subtotal;

  begin
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
          when v_zone.free_over is not null and v_base >= v_zone.free_over then 0
          else v_zone.cost
        end;
      else
        v_zone_name := nullif(payload ->> 'shipping_zone_name', '');
        v_shipping := greatest(0, coalesce((payload ->> 'shipping_cost')::numeric, 0));
      end if;
    end if;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'El pedido tiene datos inválidos';
  end;

  v_payment_pct := coalesce(v_pm.discount_percent, 0);
  v_payment_discount := round(v_base * v_payment_pct / 100, 2);
  v_total := v_base - v_payment_discount + v_shipping;

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
    notes, source, bundle_discount
  ) values (
    v_store, v_number, v_token, v_customer_id,
    jsonb_build_object('name', v_name, 'email', v_email, 'phone', v_phone, 'doc', v_doc),
    v_pm.code, v_payment_pct, v_payment_discount,
    v_fulfillment, v_zone_id, v_zone_name, v_shipping,
    case when v_fulfillment = 'delivery' then payload -> 'shipping_address' else null end,
    v_pickup_id,
    v_subtotal, 0, null, 0, v_payment_discount,
    v_total, coalesce(v_settings.currency, 'ARS'),
    nullif(left(trim(coalesce(payload ->> 'notes', '')), 2000), ''),
    'web', 0
  )
  returning id into v_order_id;

  -- Trabajos nuevos: al final de la columna "Sin asignar".
  select coalesce(max(j.position), -1) + 1 into v_position
    from public.print3d_jobs j
   where j.store_id = v_store and j.printer_id is null and j.status in ('queued', 'printing');

  for v_item in
    select qi.*, m.name as material_name, c.name as color_name, q.name as quality_name
      from public.print3d_quote_items qi
      join public.print3d_materials m on m.id = qi.material_id
      join public.print3d_colors c on c.id = qi.color_id
      join public.print3d_qualities q on q.id = qi.quality_id
     where qi.quote_id = v_quote.id
     order by qi.position, qi.created_at
  loop
    insert into public.order_items (
      store_id, order_id, product_id, variant_id, name, variant_title, sku, image_url, unit_price, list_price, qty, total
    ) values (
      v_store, v_order_id, null, null,
      'Impresión 3D · ' || coalesce(v_item.file_name, 'pieza'),
      format('%s %s · %s · %s %% relleno%s',
             v_item.material_name, v_item.color_name, v_item.quality_name, v_item.infill_pct,
             case when v_item.supports then ' · con soportes' else '' end),
      null, null,
      coalesce(v_item.unit_price, 0), coalesce(v_item.unit_price, 0), v_item.qty,
      coalesce(v_item.total, round(coalesce(v_item.unit_price, 0) * v_item.qty, 2))
    )
    returning id into v_order_item_id;

    insert into public.print3d_jobs (
      store_id, order_id, order_item_id, quote_item_id, title, qty, status, position,
      material_id, color_id, quality_id, est_grams, est_minutes, raw_grams, raw_minutes, due_date, created_by
    ) values (
      v_store, v_order_id, v_order_item_id, v_item.id,
      left(coalesce(v_item.file_name, 'Pieza'), 300), v_item.qty, 'queued', v_position,
      v_item.material_id, v_item.color_id, v_item.quality_id,
      round(v_item.grams * v_item.qty, 2), round(v_item.minutes * v_item.qty, 2),
      round(v_item.raw_grams * v_item.qty, 2), round(v_item.raw_minutes * v_item.qty, 2),
      v_quote.estimated_ready_date, auth.uid()
    );

    v_position := v_position + 1;
    v_count := v_count + 1;
  end loop;

  if v_quote.setup_fee > 0 then
    insert into public.order_items (store_id, order_id, name, unit_price, list_price, qty, total)
    values (v_store, v_order_id, 'Preparación del pedido', v_quote.setup_fee, v_quote.setup_fee, 1, v_quote.setup_fee);
  end if;
  if v_quote.min_adjustment > 0 then
    insert into public.order_items (store_id, order_id, name, unit_price, list_price, qty, total)
    values (v_store, v_order_id, 'Ajuste a pedido mínimo', v_quote.min_adjustment, v_quote.min_adjustment, 1, v_quote.min_adjustment);
  end if;

  insert into public.order_events (store_id, order_id, type, message, data, visible_to_customer)
  values (
    v_store, v_order_id, 'created', 'Recibimos tu pedido',
    jsonb_build_object('payment_method', v_pm.code, 'total', v_total, 'items', v_count, 'print3d_quote_id', v_quote.id),
    true
  );

  update public.print3d_quotes
     set status = 'ordered', order_id = v_order_id
   where id = v_quote.id;

  -- ---------- 0014: ¿se le manda "Recibimos tu pedido" al comprador? ----------
  -- Mismos cupos que create_order: mismo email en la última hora < 3; misma
  -- tienda en 10 minutos < 30; tienda sin pedidos pagados, 24 h < 50.
  select count(*) into v_recent
    from public.orders o
   where lower(o.customer ->> 'email') = v_email
     and o.created_at > now() - interval '1 hour'
     and o.id <> v_order_id;

  select count(*) into v_store_recent
    from public.orders o
   where o.store_id = v_store
     and o.created_at > now() - interval '10 minutes'
     and o.id <> v_order_id;

  v_notify := v_recent < 3 and v_store_recent < 30;

  if v_notify then
    select count(*) into v_store_day
      from public.orders o
     where o.store_id = v_store
       and o.created_at > now() - interval '24 hours'
       and o.id <> v_order_id;
    if v_store_day >= 50 and not exists (
      select 1 from public.orders o where o.store_id = v_store and o.payment_status = 'paid'
    ) then
      v_notify := false;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_order_id, 'number', v_number, 'public_token', v_token, 'store_id', v_store,
    'notify_customer', v_notify
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5.5 Terminar un trabajo (equipo)
-- ---------------------------------------------------------------------
-- → 'done', reales, descuenta la bobina, suma horas a la impresora y
-- recalibra (material, calidad): mediana de real/estimado-sin-calibrar de los
-- últimos 20 trabajos 'done' del par, acotada a [0.5, 2]; con < 3 muestras, 1.
create or replace function public.print3d_finish_job(
  p_job_id uuid,
  p_actual_grams numeric,
  p_actual_minutes numeric,
  p_spool_id uuid default null,
  p_post_minutes numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.print3d_jobs;
  v_spool public.print3d_spools;
  v_spool_id uuid;
  v_n int := 0;
  v_gmed float8;
  v_tmed float8;
  v_gf numeric := 1;
  v_tf numeric := 1;
  v_recalibrated boolean := false;
begin
  select * into v_job from public.print3d_jobs where id = p_job_id for update;
  if not found then
    raise exception 'El trabajo no existe.';
  end if;
  if not public.is_store_admin(v_job.store_id) then
    raise exception 'No autorizado';
  end if;
  if not public.store_has_module(v_job.store_id, 'print3d') then
    raise exception 'Esta app no está activa en tu tienda.';
  end if;
  if v_job.status not in ('queued', 'printing', 'post') then
    raise exception 'Este trabajo ya está cerrado.';
  end if;
  if p_actual_grams is null or p_actual_grams < 0 or p_actual_grams > 99999999 then
    raise exception 'Revisá los gramos reales.';
  end if;
  if p_actual_minutes is null or p_actual_minutes < 0 or p_actual_minutes > 99999999 then
    raise exception 'Revisá los minutos reales.';
  end if;
  if p_post_minutes is not null and (p_post_minutes < 0 or p_post_minutes > 999999) then
    raise exception 'Revisá los minutos de post-proceso.';
  end if;

  v_spool_id := coalesce(p_spool_id, v_job.spool_id);
  if v_spool_id is not null then
    select * into v_spool from public.print3d_spools
     where id = v_spool_id and store_id = v_job.store_id
       for update;
    if not found then
      raise exception 'La bobina elegida no es de esta tienda.';
    end if;
    if v_job.color_id is not null and v_spool.color_id <> v_job.color_id then
      raise exception 'Esa bobina es de otro color que el del trabajo.';
    end if;
    if v_spool.status = 'empty' then
      raise exception 'Esa bobina está marcada como vacía. Elegí otra.';
    end if;
    update public.print3d_spools
       set remaining_grams = greatest(0, remaining_grams - round(p_actual_grams, 1)),
           status = case
             when greatest(0, remaining_grams - round(p_actual_grams, 1)) = 0 then 'empty'
             when status = 'sealed' then 'open'
             else status
           end
     where id = v_spool_id;
  end if;

  update public.print3d_jobs
     set status = 'done',
         actual_grams = round(p_actual_grams, 2),
         actual_minutes = round(p_actual_minutes, 2),
         spool_id = v_spool_id,
         post_minutes = coalesce(round(p_post_minutes, 2), post_minutes),
         finished_at = now()
   where id = v_job.id;

  if v_job.printer_id is not null then
    update public.print3d_printers
       set hours_used = hours_used + round(p_actual_minutes / 60, 2)
     where id = v_job.printer_id and store_id = v_job.store_id;
  end if;

  if v_job.material_id is not null and v_job.quality_id is not null
     and (coalesce(v_job.raw_grams, 0) > 0 or coalesce(v_job.raw_minutes, 0) > 0) then
    select count(*),
           percentile_cont(0.5) within group (order by s.g_ratio),
           percentile_cont(0.5) within group (order by s.t_ratio)
      into v_n, v_gmed, v_tmed
      from (
        select (j.actual_grams / j.raw_grams)::float8 as g_ratio,
               (j.actual_minutes / j.raw_minutes)::float8 as t_ratio
          from public.print3d_jobs j
         where j.store_id = v_job.store_id
           and j.material_id = v_job.material_id
           and j.quality_id = v_job.quality_id
           and j.status = 'done'
           and j.raw_grams > 0 and j.raw_minutes > 0
           and j.actual_grams is not null and j.actual_minutes is not null
         order by j.finished_at desc nulls last, j.id
         limit 20
      ) s;
    if v_n >= 3 then
      v_gf := round(least(2, greatest(0.5, v_gmed))::numeric, 3);
      v_tf := round(least(2, greatest(0.5, v_tmed))::numeric, 3);
    end if;
    insert into public.print3d_calibration (store_id, material_id, quality_id, grams_factor, time_factor, samples)
    values (v_job.store_id, v_job.material_id, v_job.quality_id, v_gf, v_tf, v_n)
    on conflict (store_id, material_id, quality_id) do update
       set grams_factor = excluded.grams_factor,
           time_factor = excluded.time_factor,
           samples = excluded.samples;
    v_recalibrated := true;
  end if;

  return jsonb_build_object(
    'job_id', v_job.id,
    'status', 'done',
    'spool_id', v_spool_id,
    'calibration', case when v_recalibrated then
      jsonb_build_object('grams_factor', v_gf, 'time_factor', v_tf, 'samples', v_n) end
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5.6 Trabajo fallado (equipo)
-- ---------------------------------------------------------------------
-- → 'failed' + gramos perdidos descontados de la bobina del trabajo. Con
-- p_requeue, crea un hijo 'queued' (parent_job_id) en la misma impresora, al
-- final de su columna.
create or replace function public.print3d_fail_job(
  p_job_id uuid,
  p_wasted_grams numeric,
  p_reason text,
  p_requeue boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.print3d_jobs;
  v_spool public.print3d_spools;
  v_wasted numeric := round(coalesce(p_wasted_grams, 0), 2);
  v_new_id uuid;
  v_position int;
  v_spool_ok boolean := false;
begin
  select * into v_job from public.print3d_jobs where id = p_job_id for update;
  if not found then
    raise exception 'El trabajo no existe.';
  end if;
  if not public.is_store_admin(v_job.store_id) then
    raise exception 'No autorizado';
  end if;
  if not public.store_has_module(v_job.store_id, 'print3d') then
    raise exception 'Esta app no está activa en tu tienda.';
  end if;
  if v_job.status not in ('queued', 'printing', 'post') then
    raise exception 'Este trabajo ya está cerrado.';
  end if;
  if p_reason is null or p_reason not in ('warping', 'atasco', 'despegue', 'corte_luz', 'filamento', 'capa', 'otro') then
    raise exception 'Elegí qué pasó con la impresión.';
  end if;
  if v_wasted < 0 or v_wasted > 99999999 then
    raise exception 'Revisá los gramos perdidos.';
  end if;

  if v_job.spool_id is not null then
    select * into v_spool from public.print3d_spools
     where id = v_job.spool_id and store_id = v_job.store_id
       for update;
    if found then
      update public.print3d_spools
         set remaining_grams = greatest(0, remaining_grams - round(v_wasted, 1)),
             status = case
               when greatest(0, remaining_grams - round(v_wasted, 1)) = 0 then 'empty'
               when status = 'sealed' then 'open'
               else status
             end
       where id = v_spool.id
      returning status <> 'empty' into v_spool_ok;
    end if;
  end if;

  update public.print3d_jobs
     set status = 'failed',
         wasted_grams = v_wasted,
         failure_reason = p_reason,
         finished_at = now()
   where id = v_job.id;

  if coalesce(p_requeue, false) then
    select coalesce(max(j.position), -1) + 1 into v_position
      from public.print3d_jobs j
     where j.store_id = v_job.store_id
       and j.printer_id is not distinct from v_job.printer_id
       and j.status in ('queued', 'printing');

    insert into public.print3d_jobs (
      store_id, order_id, order_item_id, quote_item_id, product_id, variant_id, parent_job_id, title, qty,
      printer_id, status, position, material_id, color_id, quality_id, spool_id, est_grams, est_minutes,
      raw_grams, raw_minutes, post_minutes, due_date, notes, created_by
    ) values (
      v_job.store_id, v_job.order_id, v_job.order_item_id, v_job.quote_item_id, v_job.product_id, v_job.variant_id,
      v_job.id, v_job.title, v_job.qty,
      v_job.printer_id, 'queued', v_position, v_job.material_id, v_job.color_id, v_job.quality_id,
      case when v_spool_ok then v_job.spool_id end,
      v_job.est_grams, v_job.est_minutes, v_job.raw_grams, v_job.raw_minutes, v_job.post_minutes,
      v_job.due_date, v_job.notes, auth.uid()
    )
    returning id into v_new_id;
  end if;

  return jsonb_build_object('requeued_job_id', v_new_id);
end;
$$;

-- Permisos: 1–4 públicas; 5–6 sólo logueados (validan is_store_admin adentro).
revoke all on function public.print3d_public_config(uuid) from public;
revoke all on function public.print3d_submit_quote(uuid, text, jsonb) from public;
revoke all on function public.print3d_get_quote(text) from public;
revoke all on function public.print3d_checkout_quote(text, jsonb) from public;
grant execute on function public.print3d_public_config(uuid) to anon, authenticated;
grant execute on function public.print3d_submit_quote(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.print3d_get_quote(text) to anon, authenticated;
grant execute on function public.print3d_checkout_quote(text, jsonb) to anon, authenticated;

revoke all on function public.print3d_finish_job(uuid, numeric, numeric, uuid, numeric) from public, anon;
revoke all on function public.print3d_fail_job(uuid, numeric, text, boolean) from public, anon;
grant execute on function public.print3d_finish_job(uuid, numeric, numeric, uuid, numeric) to authenticated;
grant execute on function public.print3d_fail_job(uuid, numeric, text, boolean) to authenticated;

-- =====================================================================
-- 6. Versión del esquema que espera el código (src/lib/version.ts → SCHEMA_VERSION).
-- `greatest`: aplicarla fuera de orden no baja la versión.
-- =====================================================================
insert into public.app_meta (key, value) values ('schema_version', '13'::jsonb)
  on conflict (key) do update
     set value = to_jsonb(greatest(coalesce((public.app_meta.value #>> '{}')::int, 0), 13)),
         updated_at = now();
