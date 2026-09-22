-- =====================================================================
-- 0003 · Catálogo (agente A): vistas y funciones de apoyo del admin
-- =====================================================================
-- Todo es `security_invoker` / `security invoker`: corre con los permisos
-- del usuario (RLS). Sólo lo usa el admin; se revoca a `anon`.

-- ---------------------------------------------------------------------
-- Listado de productos del admin: agregados por producto para filtrar,
-- ordenar y paginar en el server (precio mín/máx, stock total, estado de
-- stock, SKUs para búsqueda, categorías, miniatura).
-- ---------------------------------------------------------------------
create or replace view public.admin_products
with (security_invoker = true) as
select
  p.id,
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
        and pv.stock <= coalesce(pv.low_stock_threshold, (select s.low_stock_threshold from public.store_settings s where s.id = 1))
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

revoke all on public.admin_products from anon;
grant select on public.admin_products to authenticated;

-- ---------------------------------------------------------------------
-- Inventario por variante (estado ok / low / out / untracked).
-- ---------------------------------------------------------------------
create or replace view public.admin_inventory
with (security_invoker = true) as
select
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
cross join public.store_settings s
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
) c on true
where s.id = 1;

revoke all on public.admin_inventory from anon;
grant select on public.admin_inventory to authenticated;

-- ---------------------------------------------------------------------
-- Resumen de inventario (franja de métricas).
-- ---------------------------------------------------------------------
create or replace function public.inventory_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
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
  cross join public.store_settings s
  where s.id = 1;
$$;

revoke execute on function public.inventory_summary() from public, anon;
grant execute on function public.inventory_summary() to authenticated;

-- ---------------------------------------------------------------------
-- Reordenar / anidar categorías en una sola transacción.
-- items: [{ "id": uuid, "parent_id": uuid|null, "position": int }]
-- ---------------------------------------------------------------------
create or replace function public.reorder_categories(items jsonb)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int := 0;
  v_item jsonb;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  for v_item in select * from jsonb_array_elements(items)
  loop
    update public.categories
       set parent_id = nullif(v_item ->> 'parent_id', '')::uuid,
           position = (v_item ->> 'position')::int
     where id = (v_item ->> 'id')::uuid
       and (parent_id is distinct from nullif(v_item ->> 'parent_id', '')::uuid
            or position is distinct from (v_item ->> 'position')::int);
    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  -- Evitar ciclos (una categoría no puede ser ancestro de sí misma).
  if exists (
    with recursive walk as (
      select id, parent_id, array[id] as path, false as cycle from public.categories
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

revoke execute on function public.reorder_categories(jsonb) from public, anon;
grant execute on function public.reorder_categories(jsonb) to authenticated;
