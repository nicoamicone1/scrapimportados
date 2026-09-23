-- =====================================================================
-- 0017 · Promos por cantidad: "Llevá X, pagá Y" (3x2, 2x1, 4x3) y
--        "N.ª unidad al Z %" (2.ª al 50 %)
--
-- Idempotente (`add column if not exists`, `drop constraint if exists`,
-- `create or replace`, `drop trigger if exists`).
--
-- 1. promotions.config jsonb: parámetros de las promos por cantidad.
--      bxgy             → {"buy": X, "pay": Y}   (enteros, 1 ≤ Y < X ≤ 99; value = 0)
--      nth_unit_percent → {"nth": N}              (entero 2..99; value = Z %, 1..100)
--    `type` suma 'bxgy' y 'nth_unit_percent'.
-- 2. private.promo_floor_price(): el piso por línea de create_order ahora
--    contempla las promos por cantidad (con un 3x2 cualquier unidad del
--    alcance puede salir gratis → piso 0; con la N.ª al Z % se aplica el Z %).
--    Las promos % y fijas siguen igual que en 0011. Nueva
--    private.promo_unit_floor_price(): el piso SÓLO con promos % y fijas.
-- 3. Como el piso por línea ya no alcanza, un trigger sobre order_items
--    (private.check_order_quantity_promos) acota el descuento TOTAL de un
--    pedido web recién creado: Σ descuento por unidad (piso 0011) + por cada
--    promo por cantidad vigente, lo que valen las unidades que puede bonificar
--    (floor(n / X) × (X − Y) unidades, o floor(n / N) × Z %) tomando las más
--    caras del alcance. Es una cota superior segura (el motor TS bonifica las
--    más baratas): nunca rechaza un pedido legítimo y un llamado directo a
--    create_order no puede declarar más descuento que eso. Sólo mira pedidos
--    `source = 'web'` creados en la misma transacción y tiendas con promos por
--    cantidad vigentes; create_order NO se modifica.
--
-- El motor de precios (src/lib/pricing/engine.ts) manda en `lines` un
-- precio unitario por línea = promedio de la línea con la promo por cantidad
-- (redondeado hacia abajo al centavo).
--
-- Orden de deploy: da igual. Sin esta migración el panel no puede guardar
-- promos de estos tipos (muestra un error claro) y la tienda funciona igual;
-- las lecturas usan `select *`, así que la columna nueva no rompe nada.
-- =====================================================================

alter table public.promotions add column if not exists config jsonb not null default '{}'::jsonb;

-- El check de 0001 se llama promotions_type_check (nombre por defecto de Postgres).
alter table public.promotions drop constraint if exists promotions_type_check;
alter table public.promotions add constraint promotions_type_check
  check (type in ('percent', 'fixed', 'bxgy', 'nth_unit_percent'));

-- Parámetros válidos por tipo (CASE: los casts sólo se evalúan si el tipo JSON es número).
alter table public.promotions drop constraint if exists promotions_config_check;
alter table public.promotions add constraint promotions_config_check check (
  case type
    when 'bxgy' then
      case when jsonb_typeof(config -> 'buy') = 'number' and jsonb_typeof(config -> 'pay') = 'number' then
        (config ->> 'buy')::numeric = trunc((config ->> 'buy')::numeric)
        and (config ->> 'pay')::numeric = trunc((config ->> 'pay')::numeric)
        and (config ->> 'pay')::numeric >= 1
        and (config ->> 'buy')::numeric > (config ->> 'pay')::numeric
        and (config ->> 'buy')::numeric <= 99
      else false end
    when 'nth_unit_percent' then
      case when jsonb_typeof(config -> 'nth') = 'number' then
        (config ->> 'nth')::numeric = trunc((config ->> 'nth')::numeric)
        and (config ->> 'nth')::numeric between 2 and 99
        and value > 0 and value <= 100
      else false end
    else true
  end
);

-- ---------------------------------------------------------------------
-- Piso por línea SÓLO con promos por unidad (% y fijas): el de 0011.
-- ---------------------------------------------------------------------
create or replace function private.promo_unit_floor_price(p_store_id uuid, p_product_id uuid, p_price numeric)
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
       and type in ('percent', 'fixed')
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
-- Piso por línea que usa create_order (misma firma que 0011).
-- ---------------------------------------------------------------------
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
     where store_id = p_store_id and is_active
       and (value > 0 or type = 'bxgy')
       and type in ('percent', 'fixed', 'bxgy', 'nth_unit_percent')
       and (starts_at is null or starts_at <= now())
       and (ends_at is null or ends_at >= now())
       and (scope = 'all'
            or (scope = 'products' and p_product_id = any (product_ids))
            or (scope = 'categories' and category_ids && v_cats))
     order by priority desc
  loop
    if r.type = 'bxgy' then
      -- Con "Llevá X, pagá Y" una unidad del alcance puede salir gratis: el tope
      -- real lo pone el trigger de order_items sobre el total del pedido.
      return 0;
    elsif r.type in ('percent', 'nth_unit_percent') then
      v := v - round(v * least(r.value, 100) / 100, 2);
    else
      v := v - least(r.value, v);
    end if;
  end loop;
  return greatest(v, 0);
end;
$$;

-- ---------------------------------------------------------------------
-- Tope del descuento total de un pedido web con promos por cantidad.
-- ---------------------------------------------------------------------
create or replace function private.check_order_quantity_promos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
  q record;
  v_allowed numeric;
  v_units numeric[];
  v_n int;
  v_k int;
  v_qty int;
begin
  for o in
    select ord.id, ord.store_id, ord.promo_total
      from public.orders ord
     where ord.id in (select distinct ni.order_id from new_items ni)
       and ord.source = 'web'
       -- Sólo el pedido que se está creando (create_order inserta orden e ítems
       -- en la misma transacción); editar ítems después no pasa por acá.
       and ord.created_at = now()
  loop
    if not exists (
      select 1 from public.promotions p
       where p.store_id = o.store_id and p.is_active
         and p.type in ('bxgy', 'nth_unit_percent')
         and (p.starts_at is null or p.starts_at <= now())
         and (p.ends_at is null or p.ends_at >= now())
    ) then
      continue; -- sin promos por cantidad, el piso por línea de siempre ya alcanza
    end if;

    -- Promos por unidad: lo máximo que pueden descontar (cascada completa).
    select coalesce(sum((i.list_price - private.promo_unit_floor_price(o.store_id, i.product_id, i.list_price)) * i.qty), 0),
           coalesce(sum(i.qty), 0)
      into v_allowed, v_qty
      from public.order_items i
     where i.order_id = o.id;

    -- Promos por cantidad: el valor de las unidades que puede bonificar cada
    -- una, tomando las MÁS CARAS de su alcance (cota superior).
    for q in
      select p.type, p.value, p.config, p.scope, p.category_ids, p.product_ids
        from public.promotions p
       where p.store_id = o.store_id and p.is_active
         and p.type in ('bxgy', 'nth_unit_percent')
         and (p.starts_at is null or p.starts_at <= now())
         and (p.ends_at is null or p.ends_at >= now())
    loop
      select array_agg(u.price order by u.price desc) into v_units
        from (
          select i.list_price as price
            from public.order_items i
            cross join lateral generate_series(1, i.qty)
           where i.order_id = o.id
             and (q.scope = 'all'
                  or (q.scope = 'products' and i.product_id = any (q.product_ids))
                  or (q.scope = 'categories' and exists (
                        select 1 from public.product_categories pc
                         where pc.product_id = i.product_id and pc.category_id = any (q.category_ids))))
        ) u;
      v_n := coalesce(array_length(v_units, 1), 0);
      if v_n = 0 then
        continue;
      end if;
      if q.type = 'bxgy' then
        v_k := (v_n / greatest((q.config ->> 'buy')::int, 1))
               * greatest((q.config ->> 'buy')::int - (q.config ->> 'pay')::int, 0);
        v_allowed := v_allowed + coalesce((select sum(x) from unnest(v_units[1:v_k]) x), 0);
      else
        v_k := v_n / greatest((q.config ->> 'nth')::int, 1);
        v_allowed := v_allowed
          + coalesce((select sum(x) from unnest(v_units[1:v_k]) x), 0) * least(q.value, 100) / 100;
      end if;
    end loop;

    -- Tolerancia: 1 centavo por unidad (promedios por línea y redondeos).
    if o.promo_total > v_allowed + 0.01 * v_qty then
      raise exception 'Las promociones cambiaron mientras comprabas. Revisá el carrito y volvé a confirmar.';
    end if;
  end loop;
  return null;
end;
$$;

revoke execute on function private.check_order_quantity_promos() from public, anon, authenticated;
revoke execute on function private.promo_unit_floor_price(uuid, uuid, numeric) from public, anon, authenticated;

drop trigger if exists order_items_quantity_promos_check on public.order_items;
create trigger order_items_quantity_promos_check
  after insert on public.order_items
  referencing new table as new_items
  for each statement execute function private.check_order_quantity_promos();

-- Versión del esquema que espera el código (src/lib/version.ts → SCHEMA_VERSION).
-- `greatest`: aplicarla fuera de orden no baja la versión (como 0015).
insert into public.app_meta (key, value) values ('schema_version', '8'::jsonb)
  on conflict (key) do update
     set value = to_jsonb(greatest(coalesce((public.app_meta.value #>> '{}')::int, 0), 8)),
         updated_at = now();
