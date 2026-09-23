-- =====================================================================
-- 0018 · Promos por cantidad a nivel pedido (sin centavos en los totales)
--
-- Idempotente (`add column if not exists`, `drop constraint if exists`,
-- `create or replace`, `drop ... if exists`). Requiere 0017 (la frena con
-- un error claro si falta).
--
-- Hasta 0017 el descuento de un 3x2 viajaba metido en el precio unitario de
-- la línea (promedio redondeado hacia abajo al centavo) y dejaba centavos:
-- 3 × $ 100 con 3x2 → $ 66,66 c/u = $ 199,98. Además, el tope del trigger de
-- 0017 tomaba las unidades MÁS CARAS y sumaba el máximo de cada promo: con
-- 1 × $ 100.000 + 2 × $ 1 y un 3x2, un POST directo a create_order con la
-- línea cara en $ 0 pasaba el control. Desde acá:
--
-- 1. orders.bundle_discount numeric(12,2) not null default 0: descuento de
--    las promos por cantidad del pedido. Es un DESGLOSE de `promo_total`
--    (promo_total = promos por unidad en las líneas + bundle_discount), así
--    `discount_total`, `otherDiscount()` del panel, exportaciones y reportes
--    siguen sumando igual. Las pantallas muestran "Promociones" (promo_total
--    − bundle_discount) y "Promociones por cantidad" (bundle_discount).
-- 2. private.compute_bundle_discount(store_id, items): el MISMO cálculo que
--    computeCart() de src/lib/pricing/engine.ts, en SQL:
--      · promos por unidad (% y fijas): gana la de mayor prioridad (empate:
--        la que más descuenta sobre la lista, luego id); si es acumulable se
--        le suman las demás acumulables, en cascada, con el redondeo de la
--        moneda de la tienda (hacia arriba al peso en ARS);
--      · promos por cantidad: unidades del alcance ordenadas de mayor a menor
--        precio, en grupos de X (o N) consecutivos; en cada grupo completo se
--        bonifican las X − Y más baratas (o la última con Z %). Cada unidad
--        entra en UNA sola promo por cantidad (elección golosa: prioridad,
--        luego ahorro neto, luego id); con promo por unidad se suman sólo si
--        las dos son acumulables; si no, gana la de mayor prioridad y a igual
--        prioridad la que más ahorra. Una línea que sólo suma unidades (no le
--        toca ninguna bonificada) conserva su promo por unidad.
--    Devuelve {"bundle": …, "promo_total": …}. Helpers: private.round_price,
--    private.promo_applies, private.bundle_units.
-- 3. create_order(): COPIA ENTERA de 0014 (con notify_customer) + los
--    agregados marcados "0018":
--      · acepta `bundle_discount` (>= 0) en el payload; la línea vuelve a
--        llevar su precio unitario real (lista o con promo por unidad) y las
--        unidades bonificadas van sólo en bundle_discount;
--      · si la tienda tiene promos por cantidad vigentes, recalcula con
--        compute_bundle_discount y rechaza el pedido si bundle_discount, o el
--        descuento total por promos (líneas + bundle), supera lo recalculado
--        (tolerancia: 1 centavo por unidad, por el precio promedio del
--        payload viejo). Sin promos por cantidad, bundle_discount tiene que
--        ser 0;
--      · lo guarda en orders.bundle_discount, lo suma a promo_total y el
--        cupón, el pedido mínimo, el envío gratis, el medio de pago y el total
--        se calculan sobre la mercadería ya con ese descuento (igual que el
--        motor);
--      · devuelve además `bundle_discount`.
--    Sin `bundle_discount` en el payload (app anterior) funciona como antes:
--    precio promedio por línea, con el mismo control total.
-- 4. Se derogan el trigger order_items_quantity_promos_check y la función
--    private.check_order_quantity_promos de 0017: create_order ya valida,
--    con la regla exacta, antes de insertar (no se valida dos veces).
-- 5. public.get_schema_version(): versión del esquema para el storefront
--    (anon no lee app_meta). La app sólo manda bundle_discount si es >= 9.
-- 6. get_order_by_token() NO cambia: devuelve `to_jsonb(orders)`, así que el
--    campo nuevo sale solo en `order.bundle_discount`.
--
-- Orden de deploy: después de 0017. La app nueva funciona con o sin esta
-- migración (lee get_schema_version(); si falta o es < 9 manda el payload
-- viejo con el precio promedio).
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'promotions' and column_name = 'config'
  ) then
    raise exception '0018 necesita 0017_promotions_bxgy.sql: aplicá esa migración primero.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. orders.bundle_discount
-- ---------------------------------------------------------------------
alter table public.orders add column if not exists bundle_discount numeric(12, 2) not null default 0;

alter table public.orders drop constraint if exists orders_bundle_discount_check;
alter table public.orders add constraint orders_bundle_discount_check
  check (bundle_discount >= 0 and bundle_discount <= promo_total);

comment on column public.orders.bundle_discount is
  'Descuento de promos por cantidad (3x2, N.ª unidad) a nivel pedido. Ya incluido en promo_total.';

-- ---------------------------------------------------------------------
-- 2. Cálculo exacto de las promos (espejo de computeCart)
-- ---------------------------------------------------------------------

-- roundPrice() de src/lib/money.ts: hacia arriba al peso (monedas sin
-- centavos: ARS, CLP, COP, PYG, JPY, KRW, HUF, VND) o al centavo.
create or replace function private.round_price(p_value numeric, p_whole boolean)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when p_whole then greatest(0, ceil(p_value)) else greatest(0, ceil(p_value * 100) / 100) end;
$$;

-- matchesScope() del motor.
create or replace function private.promo_applies(p_scope text, p_category_ids uuid[], p_product_ids uuid[], p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_scope
    when 'products' then coalesce(p_product_id = any (p_product_ids), false)
    when 'categories' then exists (
      select 1 from public.product_categories pc
       where pc.product_id = p_product_id and pc.category_id = any (coalesce(p_category_ids, '{}'))
    )
    else true
  end;
$$;

-- bundleDiscount() del motor: miembros en orden (p_idx = línea, p_base =
-- precio por unidad, p_qty = unidades). Unidades de mayor a menor precio (a
-- igual precio, en el orden de los miembros), grupos de p_size; en cada grupo
-- completo se bonifican las posiciones >= p_from (bxgy: Y; nth: N − 1).
-- Devuelve, por línea con alguna unidad bonificada, unidades y descuento.
create or replace function private.bundle_units(
  p_type text, p_value numeric, p_size int, p_from int, p_whole boolean,
  p_idx int[], p_base numeric[], p_qty int[]
)
returns table (idx int, units int, discount numeric)
language sql
immutable
set search_path = ''
as $$
  with m as (
    select t.idx, t.base, t.qty, t.pos
      from unnest(p_idx, p_base, p_qty) with ordinality as t(idx, base, qty, pos)
  ), u as (
    select m.idx, m.base,
           (row_number() over (order by m.base desc, m.pos asc) - 1)::int as k,
           count(*) over () as n
      from m
      cross join lateral generate_series(1, greatest(m.qty, 0))
  ), d as (
    select u.idx,
           case when p_type = 'bxgy' then u.base
                else round(u.base - private.round_price(u.base * (100 - least(p_value, 100)) / 100, p_whole), 2)
           end as disc
      from u
     where u.k < (u.n / p_size) * p_size
       and u.k % p_size >= p_from
  )
  select d.idx, count(*)::int, sum(d.disc)
    from d
   where d.disc > 0
   group by d.idx;
$$;

-- computeCart() sin cupón ni medio de pago. p_items: [{product_id, price
-- (lista), qty, ord (orden del carrito)}]. Devuelve {"bundle", "promo_total"}.
create or replace function private.compute_bundle_discount(p_store_id uuid, p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_whole boolean;
  n int := 0;
  a_prod uuid[] := '{}';
  a_list numeric[] := '{}';
  a_qty int[] := '{}';
  a_unit numeric[] := '{}';
  a_wprio int[] := '{}';
  a_wstack boolean[] := '{}';
  a_claimed boolean[] := '{}';
  a_drop boolean[] := '{}';
  a_units int[] := '{}';
  a_disc numeric[] := '{}';
  it record;
  r record;
  q record;
  i int;
  k int;
  v_list numeric;
  v_price numeric;
  v_raw numeric;
  v_next numeric;
  v_first_stack boolean;
  v_pending uuid[];
  v_qid uuid;
  v_size int;
  v_from int;
  keep int[];
  joinl int[];
  tiel int[];
  v_opt int;
  o_idx int[];
  o_drop boolean[];
  o_base numeric[];
  o_qty int[];
  e_idx int[];
  e_units int[];
  e_disc numeric[];
  e_total numeric;
  e_gain numeric;
  c_idx int[];
  c_drop boolean[];
  c_eidx int[];
  c_eunits int[];
  c_edisc numeric[];
  c_total numeric;
  c_gain numeric;
  b_id uuid;
  b_prio int;
  b_gain numeric;
  b_idx int[];
  b_drop boolean[];
  b_eidx int[];
  b_eunits int[];
  b_edisc numeric[];
  v_line_total numeric;
  v_amount numeric;
  v_bundle numeric := 0;
  v_unit_disc numeric := 0;
begin
  select upper(coalesce(s.currency, 'ARS')) in ('ARS', 'CLP', 'COP', 'PYG', 'JPY', 'KRW', 'HUF', 'VND')
    into v_whole
    from public.store_settings s where s.store_id = p_store_id;
  v_whole := coalesce(v_whole, true);

  if jsonb_typeof(p_items) is distinct from 'array' then
    return jsonb_build_object('bundle', 0, 'promo_total', 0);
  end if;

  -- ---------- Líneas en el orden del carrito + promos por unidad ----------
  for it in
    select (t.e ->> 'product_id')::uuid as product_id,
           round((t.e ->> 'price')::numeric, 2) as price,
           (t.e ->> 'qty')::int as qty
      from jsonb_array_elements(p_items) with ordinality as t(e, pos)
     order by coalesce((t.e ->> 'ord')::numeric, t.pos), t.pos
  loop
    if it.qty is null or it.qty <= 0 or it.price is null then
      continue;
    end if;
    n := n + 1;
    v_list := it.price;
    a_prod[n] := it.product_id;
    a_list[n] := v_list;
    a_qty[n] := it.qty;
    a_wprio[n] := null;
    a_wstack[n] := null;
    a_claimed[n] := false;
    a_drop[n] := false;
    a_units[n] := 0;
    a_disc[n] := 0;

    -- Gana la de mayor prioridad (empate: más descuento sobre la lista, luego
    -- id); si es acumulable se le suman las demás acumulables, en cascada.
    v_price := v_list;
    v_first_stack := null;
    for r in
      select p.type, p.value, p.priority, p.stackable
        from public.promotions p
       where p.store_id = p_store_id and p.is_active and p.value > 0
         and p.type in ('percent', 'fixed')
         and (p.starts_at is null or p.starts_at <= now())
         and (p.ends_at is null or p.ends_at >= now())
         and private.promo_applies(p.scope, p.category_ids, p.product_ids, it.product_id)
       order by p.priority desc,
                round(least(greatest(case when p.type = 'percent' then v_list * least(p.value, 100) / 100 else p.value end, 0), v_list), 2) desc,
                p.id::text collate "C"
    loop
      if v_first_stack is null then
        v_first_stack := r.stackable;
      elsif not (v_first_stack and r.stackable) then
        continue;
      end if;
      v_raw := round(least(greatest(case when r.type = 'percent' then v_price * least(r.value, 100) / 100 else r.value end, 0), v_price), 2);
      if v_raw <= 0 then
        continue;
      end if;
      v_next := private.round_price(v_price - v_raw, v_whole);
      if round(v_price - v_next, 2) <= 0 then
        continue;
      end if;
      v_price := v_next;
      if a_wprio[n] is null then
        a_wprio[n] := r.priority;
        a_wstack[n] := r.stackable;
      end if;
    end loop;
    a_unit[n] := v_price;
  end loop;

  -- ---------- Promos por cantidad (elección golosa, como el motor) ----------
  select coalesce(array_agg(p.id), '{}') into v_pending
    from public.promotions p
   where p.store_id = p_store_id and p.is_active
     and p.type in ('bxgy', 'nth_unit_percent')
     and (p.starts_at is null or p.starts_at <= now())
     and (p.ends_at is null or p.ends_at >= now());

  while n > 0 and cardinality(v_pending) > 0 loop
    b_id := null;
    foreach v_qid in array v_pending loop
      select p.id, p.type, p.value, p.priority, p.stackable, p.scope, p.category_ids, p.product_ids,
             case when jsonb_typeof(p.config -> 'buy') = 'number' then (p.config ->> 'buy')::numeric::int end as buy,
             case when jsonb_typeof(p.config -> 'pay') = 'number' then (p.config ->> 'pay')::numeric::int end as pay,
             case when jsonb_typeof(p.config -> 'nth') = 'number' then (p.config ->> 'nth')::numeric::int end as nth
        into q
        from public.promotions p where p.id = v_qid;
      if q.type = 'bxgy' then
        if q.buy is null or q.pay is null or q.pay < 1 or q.buy <= q.pay then
          continue;
        end if;
        v_size := q.buy;
        v_from := q.pay;
      else
        if q.nth is null or q.nth < 2 or q.value <= 0 or q.value > 100 then
          continue;
        end if;
        v_size := q.nth;
        v_from := q.nth - 1;
      end if;

      keep := '{}';
      joinl := '{}';
      tiel := '{}';
      for i in 1..n loop
        if a_claimed[i] or not private.promo_applies(q.scope, q.category_ids, q.product_ids, a_prod[i]) then
          continue;
        end if;
        if a_wprio[i] is null or (a_wstack[i] and q.stackable) then
          keep := keep || i;
        elsif a_wprio[i] < q.priority then
          joinl := joinl || i;
        elsif a_wprio[i] = q.priority then
          tiel := tiel || i;
        end if;
      end loop;

      -- Opción A: keep + join (dejan su promo por unidad); B: además los empates.
      c_total := null;
      for v_opt in 1..(case when cardinality(tiel) > 0 then 2 else 1 end) loop
        o_idx := keep || joinl || (case when v_opt = 2 then tiel else '{}'::int[] end);
        o_drop := '{}';
        o_base := '{}';
        o_qty := '{}';
        for k in 1..cardinality(o_idx) loop
          i := o_idx[k];
          o_drop := o_drop || (k > cardinality(keep));
          o_base := o_base || (case when k > cardinality(keep) then a_list[i] else a_unit[i] end);
          o_qty := o_qty || a_qty[i];
        end loop;
        select coalesce(array_agg(b.idx), '{}'), coalesce(array_agg(b.units), '{}'), coalesce(array_agg(b.discount), '{}'),
               coalesce(sum(b.discount), 0)
          into e_idx, e_units, e_disc, e_total
          from private.bundle_units(q.type, q.value, v_size, v_from, v_whole, o_idx, o_base, o_qty) b;
        -- Ahorro neto: menos la promo por unidad que pierden las líneas que
        -- entran al grupo Y reciben alguna unidad bonificada.
        select round(e_total - coalesce(sum((a_list[x.i] - a_unit[x.i]) * a_qty[x.i]), 0), 2)
          into e_gain
          from unnest(e_idx) as x(i)
         where x.i = any (o_idx[cardinality(keep) + 1:]);
        -- A igual prioridad gana la que más descuenta; empate → queda la promo por unidad (A).
        if c_total is null or e_gain > c_gain then
          c_idx := o_idx;
          c_drop := o_drop;
          c_eidx := e_idx;
          c_eunits := e_units;
          c_edisc := e_disc;
          c_total := e_total;
          c_gain := e_gain;
        end if;
      end loop;

      if c_total is null or c_total <= 0 then
        continue;
      end if;
      if b_id is null
         or q.priority > b_prio
         or (q.priority = b_prio and (c_gain > b_gain or (c_gain = b_gain and q.id::text collate "C" < b_id::text collate "C"))) then
        b_id := q.id;
        b_prio := q.priority;
        b_gain := c_gain;
        b_idx := c_idx;
        b_drop := c_drop;
        b_eidx := c_eidx;
        b_eunits := c_eunits;
        b_edisc := c_edisc;
      end if;
    end loop;

    exit when b_id is null;

    for k in 1..cardinality(b_idx) loop
      a_claimed[b_idx[k]] := true;
    end loop;
    for k in 1..cardinality(b_eidx) loop
      a_units[b_eidx[k]] := b_eunits[k];
      a_disc[b_eidx[k]] := b_edisc[k];
    end loop;
    -- Pierde la promo por unidad sólo la línea que recibe unidades bonificadas.
    for k in 1..cardinality(b_idx) loop
      a_drop[b_idx[k]] := b_drop[k] and a_units[b_idx[k]] > 0;
    end loop;
    v_pending := array_remove(v_pending, b_id);
  end loop;

  -- ---------- Totales ----------
  for i in 1..n loop
    v_price := case when a_drop[i] then a_list[i] else a_unit[i] end;
    v_line_total := round(v_price * a_qty[i], 2);
    v_amount := round(least(greatest(a_disc[i], 0), v_line_total), 2);
    v_bundle := v_bundle + v_amount;
    v_unit_disc := v_unit_disc + (a_list[i] * a_qty[i] - v_line_total);
  end loop;

  return jsonb_build_object('bundle', round(v_bundle, 2), 'promo_total', round(v_unit_disc + v_bundle, 2));
end;
$$;

revoke execute on function private.round_price(numeric, boolean) from public, anon, authenticated;
revoke execute on function private.promo_applies(text, uuid[], uuid[], uuid) from public, anon, authenticated;
revoke execute on function private.bundle_units(text, numeric, int, int, boolean, int[], numeric[], int[]) from public, anon, authenticated;
revoke execute on function private.compute_bundle_discount(uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. create_order (público): 0014 + bundle_discount
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
  -- 0014: cupo de avisos al comprador (el pedido se crea igual).
  v_recent int;
  v_store_recent int;
  v_store_day int;
  v_notify boolean;
  -- 0018: promos por cantidad (3x2, 2.ª al 50 %) a nivel pedido.
  v_bundle numeric(12, 2) := 0;
  v_has_qty boolean;
  v_calc jsonb;
  v_units int := 0;
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

  -- ---------- 0018: descuento por cantidad declarado por la app ----------
  -- Ausente (app anterior): 0 y la línea trae el precio promedio, como en 0017.
  begin
    v_bundle := coalesce(nullif(payload ->> 'bundle_discount', '')::numeric, 0);
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'El pedido tiene datos inválidos';
  end;
  if v_bundle is null or v_bundle < 0 or v_bundle = 'NaN'::numeric then
    raise exception 'El pedido tiene datos inválidos';
  end if;
  v_has_qty := exists (
    select 1 from public.promotions p
     where p.store_id = v_store and p.is_active
       and p.type in ('bxgy', 'nth_unit_percent')
       and (p.starts_at is null or p.starts_at <= now())
       and (p.ends_at is null or p.ends_at >= now())
  );

  begin
    for v_item in
      select (e ->> 'variant_id')::uuid as variant_id, sum((e ->> 'qty')::int)::int as qty,
             min(pos)::int as ord -- 0018: orden del carrito (desempates del motor)
        from jsonb_array_elements(payload -> 'items') with ordinality as t(e, pos)
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
        'track', v_variant.track_inventory,
        'ord', v_item.ord
      );
      v_subtotal := v_subtotal + v_variant.price * v_item.qty;
      v_promo := v_promo + (v_variant.price - v_unit) * v_item.qty;
      v_count := v_count + 1;
      v_units := v_units + v_item.qty; -- 0018
    end loop;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'El pedido tiene datos inválidos';
  end;

  -- ---------- 0018: promos por cantidad a nivel pedido ----------
  -- Con promos por cantidad vigentes se recalcula TODO lo que descuentan las
  -- promos con la regla del motor (compute_bundle_discount) y se rechaza el
  -- pedido si bundle_discount o el descuento total por promos (líneas +
  -- bundle) lo superan. Tolerancia: 1 centavo por unidad (el payload viejo
  -- manda el precio promedio por línea redondeado hacia abajo al centavo).
  -- Sin promos por cantidad, bundle_discount tiene que ser 0.
  if v_bundle > 0 or v_has_qty then
    if not v_has_qty then
      raise exception 'Las promociones cambiaron mientras comprabas. Revisá el carrito y volvé a confirmar.';
    end if;
    v_calc := private.compute_bundle_discount(v_store, (
      select jsonb_agg(jsonb_build_object('product_id', l -> 'product_id', 'price', l -> 'list_price', 'qty', l -> 'qty', 'ord', l -> 'ord'))
        from jsonb_array_elements(v_lines) l
    ));
    if v_bundle > (v_calc ->> 'bundle')::numeric + 0.01 * v_units
       or v_promo + v_bundle > (v_calc ->> 'promo_total')::numeric + 0.01 * v_units then
      raise exception 'Las promociones cambiaron mientras comprabas. Revisá el carrito y volvé a confirmar.';
    end if;
    v_bundle := least(v_bundle, v_subtotal - v_promo);
    -- promo_total = promos por unidad (en las líneas) + por cantidad (bundle_discount).
    -- Desde acá, cupón, mínimo, envío gratis y medio de pago miran el total ya con el bundle.
    v_promo := v_promo + v_bundle;
  end if;

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
    notes, source, bundle_discount
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
    'web', v_bundle
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

  -- ---------- 0014: ¿se le manda "Recibimos tu pedido" al comprador? ----------
  -- El checkout es público: sin cupo, cualquiera puede usarlo para mandar
  -- mails a direcciones ajenas con el remitente de la tienda. Se cuentan los
  -- pedidos ANTERIORES a éste (no el recién creado):
  --   · mismo email en cualquier tienda, última hora: menos de 3;
  --   · misma tienda, últimos 10 minutos: menos de 30;
  --   · tienda sin ningún pedido pagado (nueva o en prueba), últimas 24 h: menos de 50.
  -- El aviso al vendedor sale siempre (lo decide la app).
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
    'notify_customer', v_notify, 'bundle_discount', v_bundle
  );
end;
$$;

revoke execute on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Sin el trigger de 0017 (create_order ya valida el tope)
-- ---------------------------------------------------------------------
drop trigger if exists order_items_quantity_promos_check on public.order_items;
drop function if exists private.check_order_quantity_promos();

-- ---------------------------------------------------------------------
-- 5. Versión del esquema para el storefront
-- ---------------------------------------------------------------------
create or replace function public.get_schema_version()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case when m.value #>> '{}' ~ '^[0-9]{1,6}$' then (m.value #>> '{}')::int end
      from public.app_meta m
     where m.key = 'schema_version'
  ), 0);
$$;

revoke execute on function public.get_schema_version() from public;
grant execute on function public.get_schema_version() to anon, authenticated;

-- Versión del esquema que espera el código (src/lib/version.ts → SCHEMA_VERSION).
-- `greatest`: aplicarla fuera de orden no baja la versión (como 0015 y 0017).
insert into public.app_meta (key, value) values ('schema_version', '9'::jsonb)
  on conflict (key) do update
     set value = to_jsonb(greatest(coalesce((public.app_meta.value #>> '{}')::int, 0), 9)),
         updated_at = now();
