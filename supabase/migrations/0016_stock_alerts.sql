-- =====================================================================
-- 0016 · "Avisame cuando haya stock"
--
-- Idempotente (`if not exists`, `create or replace`, `drop policy if exists`).
--
-- 1. stock_alerts: un pedido de aviso por email para una variante agotada
--    (`variant_id`) o para el producto entero (`variant_id` null: producto
--    agotado sin opción elegida). Sólo puede haber UN aviso pendiente por
--    email y variante (o producto); una vez avisado (`notified_at`) la persona
--    puede volver a anotarse si se agota de nuevo.
-- 2. create_stock_alert(): alta PÚBLICA desde la ficha de producto (security
--    definer). Valida tienda activa, producto publicado y que de verdad esté
--    sin stock. Cupos: 5 avisos por email y tienda por hora, 20 por IP (hash
--    que calcula la server action, `p_ip_hash`) y tienda por día, 200 por
--    tienda por día. Los cupos se cuentan con un advisory lock por tienda
--    (dos altas simultáneas no pasan las dos con el último lugar).
--    Devuelve {ok, duplicate}.
-- 3. RLS: el equipo de la tienda (is_store_admin) lee, marca como avisado y
--    borra. Nadie inserta directo: sólo por el RPC.
--
-- La DETECCIÓN (la variante pasó de 0 a > 0) la hace la app al ajustar stock
-- desde el panel (src/lib/admin/inventory-alerts.ts): busca los avisos
-- pendientes de las variantes que ahora se pueden comprar, los marca con
-- `notified_at` (update condicional: no hay doble envío) y manda los mails con
-- `after()`. No hay trigger que mande mails desde la base.
--
-- Orden de deploy: da igual. Sin esta migración la ficha muestra el formulario
-- pero el alta responde "no pudimos anotarte", la bandeja del admin avisa que
-- falta activar la función y el ajuste de stock sigue igual (no avisa).
-- =====================================================================

create table if not exists public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  -- sha256 truncado de la IP + día (lo calcula la server action); sólo para el cupo.
  ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{16,64}$')
);
alter table public.stock_alerts add column if not exists ip_hash text
  check (ip_hash is null or ip_hash ~ '^[0-9a-f]{16,64}$');

-- Un solo aviso PENDIENTE por email y variante / por email y producto.
create unique index if not exists stock_alerts_pending_variant_uniq
  on public.stock_alerts (variant_id, email) where variant_id is not null and notified_at is null;
create unique index if not exists stock_alerts_pending_product_uniq
  on public.stock_alerts (product_id, email) where variant_id is null and notified_at is null;

-- Bandeja del admin y cupo por tienda.
create index if not exists stock_alerts_store_created_idx on public.stock_alerts (store_id, created_at desc);
-- Cupo por email.
create index if not exists stock_alerts_store_email_created_idx on public.stock_alerts (store_id, email, created_at desc);
-- Cupo por IP.
create index if not exists stock_alerts_store_ip_created_idx
  on public.stock_alerts (store_id, ip_hash, created_at desc) where ip_hash is not null;
-- Pendientes por producto (la detección busca por variante y por producto).
create index if not exists stock_alerts_pending_product_idx
  on public.stock_alerts (product_id) where notified_at is null;

-- store_id = el del producto (mismo trigger que las tablas hijas de 0011).
drop trigger if exists stock_alerts_inherit_store on public.stock_alerts;
create trigger stock_alerts_inherit_store
  before insert or update of store_id, product_id on public.stock_alerts
  for each row execute function private.inherit_store_id('products', 'product_id');

alter table public.stock_alerts enable row level security;

drop policy if exists "stock_alerts: admin lee" on public.stock_alerts;
drop policy if exists "stock_alerts: admin marca avisado" on public.stock_alerts;
drop policy if exists "stock_alerts: admin borra" on public.stock_alerts;
create policy "stock_alerts: admin lee" on public.stock_alerts
  for select to authenticated
  using (store_id = any ((select public.admin_store_ids())::uuid[]) or (select public.is_platform_admin()));
create policy "stock_alerts: admin marca avisado" on public.stock_alerts
  for update to authenticated
  using (store_id = any ((select public.admin_store_ids())::uuid[]) or (select public.is_platform_admin()))
  with check (store_id = any ((select public.admin_store_ids())::uuid[]) or (select public.is_platform_admin()));
create policy "stock_alerts: admin borra" on public.stock_alerts
  for delete to authenticated
  using (store_id = any ((select public.admin_store_ids())::uuid[]) or (select public.is_platform_admin()));

-- Los visitantes no tocan la tabla (el alta es por RPC). El equipo sólo puede
-- cambiar `notified_at` (marcar / desmarcar el aviso) y no ve `ip_hash`.
revoke all on public.stock_alerts from anon;
revoke select, insert, update, truncate, references, trigger on public.stock_alerts from authenticated;
grant select (id, store_id, product_id, variant_id, email, created_at, notified_at) on public.stock_alerts to authenticated;
grant delete on public.stock_alerts to authenticated;
grant update (notified_at) on public.stock_alerts to authenticated;

-- ---------------------------------------------------------------------
-- create_stock_alert (público)
-- ---------------------------------------------------------------------
-- La firma cambió (p_ip_hash): se borra la anterior por si se aplicó un borrador.
drop function if exists public.create_stock_alert(uuid, uuid, text, uuid);

create or replace function public.create_stock_alert(
  p_store_id uuid,
  p_variant_id uuid,
  p_email text,
  p_product_id uuid default null,
  p_ip_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_product uuid;
  v_available boolean;
  v_recent int;
  v_store_day int;
  v_ip_day int;
  v_ip text := nullif(lower(trim(coalesce(p_ip_hash, ''))), '');
begin
  if v_ip is not null and v_ip !~ '^[0-9a-f]{16,64}$' then
    v_ip := null;
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$' then
    raise exception 'Revisá el email.';
  end if;
  if p_store_id is null or not public.store_is_active(p_store_id) then
    raise exception 'La tienda no está disponible.';
  end if;

  if p_variant_id is not null then
    select v.product_id,
           (not v.track_inventory or v.allow_backorder or v.stock > 0)
      into v_product, v_available
      from public.product_variants v
      join public.products p on p.id = v.product_id
     where v.id = p_variant_id and v.store_id = p_store_id and v.is_active and p.status = 'active';
    if v_product is null or (p_product_id is not null and p_product_id <> v_product) then
      raise exception 'Este producto ya no está disponible.';
    end if;
  else
    select p.id,
           exists (
             select 1 from public.product_variants v
              where v.product_id = p.id and v.is_active
                and (not v.track_inventory or v.allow_backorder or v.stock > 0)
           )
      into v_product, v_available
      from public.products p
     where p.id = p_product_id and p.store_id = p_store_id and p.status = 'active';
    if v_product is null then
      raise exception 'Este producto ya no está disponible.';
    end if;
  end if;

  if v_available then
    raise exception 'Ya hay stock: recargá la página para comprarlo.';
  end if;

  -- Ya anotado (pendiente): no suma al cupo.
  if exists (
    select 1 from public.stock_alerts a
     where a.email = v_email and a.notified_at is null
       and ((p_variant_id is not null and a.variant_id = p_variant_id)
         or (p_variant_id is null and a.variant_id is null and a.product_id = v_product))
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  -- Cupos atómicos por tienda: las altas de una misma tienda se cuentan de a una.
  perform pg_advisory_xact_lock(hashtext('stock_alerts:' || p_store_id::text));

  select count(*) into v_recent from public.stock_alerts
   where store_id = p_store_id and email = v_email and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'Ya pediste varios avisos con este email. Probá de nuevo en un rato.';
  end if;

  if v_ip is not null then
    select count(*) into v_ip_day from public.stock_alerts
     where store_id = p_store_id and ip_hash = v_ip and created_at > now() - interval '1 day';
    if v_ip_day >= 20 then
      raise exception 'Ya pediste varios avisos hoy. Probá de nuevo mañana.';
    end if;
  end if;

  select count(*) into v_store_day from public.stock_alerts
   where store_id = p_store_id and created_at > now() - interval '1 day';
  if v_store_day >= 200 then
    raise exception 'Hoy no podemos tomar más avisos. Probá mañana o escribinos.';
  end if;

  begin
    insert into public.stock_alerts (store_id, product_id, variant_id, email, ip_hash)
    values (p_store_id, v_product, p_variant_id, v_email, v_ip);
  exception
    when unique_violation then
      return jsonb_build_object('ok', true, 'duplicate', true);
  end;

  return jsonb_build_object('ok', true, 'duplicate', false);
end;
$$;

revoke execute on function public.create_stock_alert(uuid, uuid, text, uuid, text) from public;
grant execute on function public.create_stock_alert(uuid, uuid, text, uuid, text) to anon, authenticated;

-- Versión del esquema que espera el código (src/lib/version.ts → SCHEMA_VERSION).
-- Sólo sube: si ya se aplicó una migración posterior (8), no la pisa.
insert into public.app_meta (key, value) values ('schema_version', '7'::jsonb)
  on conflict (key) do update set value = excluded.value, updated_at = now()
  where coalesce((public.app_meta.value #>> '{}')::int, 0) < 7;
