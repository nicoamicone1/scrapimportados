-- =====================================================================
-- 0004 · Pedidos, clientes y dashboard (agente B)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Clientes sin email: las ventas por WhatsApp o en el local muchas veces
-- sólo tienen nombre y teléfono. El email sigue siendo único (y en
-- minúsculas) cuando existe; create_order lo sigue exigiendo.
-- ---------------------------------------------------------------------
alter table public.customers alter column email drop not null;

create index if not exists customers_phone_idx on public.customers (phone);
create index if not exists order_items_sku_idx on public.order_items (sku);

-- ---------------------------------------------------------------------
-- Realtime: aviso de pedidos nuevos en el admin (P0-07). Las filas sólo
-- llegan a quien pasa la RLS de `orders` (is_admin()).
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
     ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Dashboard: series de ventas y productos más vendidos.
-- security invoker: corren bajo la RLS del admin que las llama.
-- ---------------------------------------------------------------------
create or replace function public.admin_sales_series(
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
  if not public.is_admin() then
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
     where o.created_at >= p_from
       and o.created_at < p_to
       and o.status <> 'cancelled'
     group by 1
     order by 1;
end;
$$;

create or replace function public.admin_top_products(
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
  if not public.is_admin() then
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
     where o.created_at >= p_from
       and o.created_at < p_to
       and o.status <> 'cancelled'
     group by i.product_id, case when i.product_id is null then i.name end
     order by 4 desc, 5 desc
     limit greatest(1, least(coalesce(p_limit, 5), 50));
end;
$$;

revoke execute on function public.admin_sales_series(timestamptz, timestamptz, text, text) from public, anon;
revoke execute on function public.admin_top_products(timestamptz, timestamptz, int) from public, anon;
grant execute on function public.admin_sales_series(timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.admin_top_products(timestamptz, timestamptz, int) to authenticated;
