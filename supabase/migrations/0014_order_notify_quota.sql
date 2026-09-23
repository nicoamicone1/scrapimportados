-- =====================================================================
-- 0014 · Cupos de avisos por email y fin de prueba sin borrar la fecha
--
-- Revisión de seguridad (2026-09-23). Idempotente: sólo `create or replace`,
-- `create index if not exists` y `revoke`. Los cuerpos son COPIA de 0011 con
-- los agregados marcados "0014". CREATE OR REPLACE conserva owner y grants.
--
-- 1. create_order(): devuelve además `notify_customer` (boolean). El pedido
--    se crea siempre; la app sólo manda "Recibimos tu pedido" al comprador si
--    es true (el aviso al vendedor sale igual). Cupos: 3 pedidos por email por
--    hora (en cualquier tienda), 30 por tienda cada 10 minutos y, si la tienda
--    todavía no tiene ningún pedido pagado, 50 por día.
-- 2. create_withdrawal_request(): devuelve además `notify_seller` (menos de
--    20 solicitudes de la tienda en la última hora). La solicitud se registra
--    siempre (requisito legal); la app sólo manda el mail si es true.
-- 3. expire_trials(): ya NO pone `trial_ends_at = null` (sólo pasa a Free y
--    `active`), así el cron puede juntar el aviso "tu prueba terminó" por
--    fecha aunque alguien haya corrido el mantenimiento antes. La app sólo
--    lee `trial_ends_at` cuando `status = 'trialing'` (current_plan,
--    getPlanChip, trialBannerState). Deja de ser ejecutable por usuarios
--    logueados: sólo la llama run_daily_maintenance() (security definer).
--
-- Orden de deploy: da igual. La app trata `notify_customer`/`notify_seller`
-- ausentes como true (comportamiento anterior) mientras esto no se aplique.
-- =====================================================================

-- Índices para los conteos (el de tienda ya existe desde 0011).
create index if not exists orders_customer_email_created_idx
  on public.orders ((lower(customer ->> 'email')), created_at desc);
create index if not exists orders_store_created_idx on public.orders (store_id, created_at desc);
create index if not exists withdrawal_requests_store_created_idx
  on public.withdrawal_requests (store_id, created_at desc);

-- ---------------------------------------------------------------------
-- create_order (público) + notify_customer
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
    'notify_customer', v_notify
  );
end;
$$;

revoke execute on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Arrepentimiento (público) + notify_seller
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
  -- 0014: cupo de avisos al vendedor (la solicitud se registra igual).
  v_store_hour int;
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

  -- 0014: solicitudes de la tienda en la última hora (antes de insertar ésta).
  select count(*) into v_store_hour from public.withdrawal_requests
   where store_id = v_store and created_at > now() - interval '1 hour';

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

  return jsonb_build_object('code', v_code, 'order_found', v_order_id is not null, 'notify_seller', v_store_hour < 20);
end;
$$;

revoke execute on function public.create_withdrawal_request(jsonb) from public;
grant execute on function public.create_withdrawal_request(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- expire_trials: sin borrar trial_ends_at; sólo desde el mantenimiento
-- ---------------------------------------------------------------------
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
           notes = trim(coalesce(notes, '') || ' Trial vencido el ' || to_char(now(), 'YYYY-MM-DD') || '.')
     where status = 'trialing' and trial_ends_at is not null and trial_ends_at < now()
    returning 1
  )
  select count(*)::int from upd;
$$;

revoke execute on function public.expire_trials() from public, anon, authenticated;
