-- =====================================================================
-- 0005_pricing — Agente C: precios masivos con historial y deshacer.
--
-- * price_batches: cabecera de cada cambio masivo (regla y alcance
--   resumidos, quién, cuándo, si se deshizo). `price_changes.batch_id`
--   NO tiene FK a esta tabla: otros flujos (importador CSV de G) pueden
--   loguear en price_changes sin crear cabecera; el historial los muestra
--   igual (vista price_batch_list, source = 'other').
-- * pricing_scope_variants(scope): variantes alcanzadas por un alcance.
-- * pricing_scope_facets(): marcas y etiquetas existentes (para selects).
-- * apply_price_changes(batch, changes): aplica un lote (chunk) de cambios
--   de forma atómica y loguea en price_changes. Sólo pisa las variantes
--   cuyo precio sigue siendo el que se previsualizó.
-- * undo_price_batch(batch): restaura old_price/old_compare_at en las
--   variantes cuyo precio actual sigue siendo el new_* del batch.
--
-- Todas las funciones son SECURITY INVOKER (corren bajo RLS como el admin)
-- y además exigen is_admin().
-- =====================================================================

create table if not exists public.price_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'bulk' check (source in ('bulk', 'import', 'other')),
  rule jsonb not null default '{}'::jsonb,
  rule_summary text not null default '',
  scope jsonb not null default '{}'::jsonb,
  scope_summary text not null default '',
  variant_count int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by uuid references auth.users (id) on delete set null,
  undo_result jsonb
);
create index if not exists price_batches_created_at_idx on public.price_batches (created_at desc);
create index if not exists price_batches_created_by_idx on public.price_batches (created_by);
create index if not exists price_batches_undone_by_idx on public.price_batches (undone_by);

alter table public.price_batches enable row level security;

create policy "price_batches: admin lee" on public.price_batches
  for select to authenticated using ((select public.is_admin()));
create policy "price_batches: admin inserta" on public.price_batches
  for insert to authenticated with check ((select public.is_admin()));
create policy "price_batches: admin modifica" on public.price_batches
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "price_batches: admin borra" on public.price_batches
  for delete to authenticated using ((select public.is_admin()));

-- Historial: un renglón por batch_id de price_changes (+ cabecera si existe).
create or replace view public.price_batch_list
with (security_invoker = true) as
select
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
  select batch_id, min(created_at) as created_at, count(*)::int as variant_count, (array_agg(created_by))[1] as created_by
    from public.price_changes
   group by batch_id
) g
left join public.price_batches b on b.id = g.batch_id
left join public.profiles p on p.id = g.created_by;

-- ---------------------------------------------------------------------
-- Alcance → variantes.
--   p_scope: { kind: 'all'|'categories'|'products'|'brand'|'tag'|'price_range',
--              category_ids: uuid[], include_children: bool, product_ids: uuid[],
--              brand: text, tag: text, min_price: numeric, max_price: numeric,
--              in_stock_only: bool }
--   Excluye productos archivados.
-- ---------------------------------------------------------------------
create or replace function public.pricing_scope_variants(p_scope jsonb)
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
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if v_kind = 'categories' then
    with recursive tree as (
      select c.id from public.categories c where c.id = any (v_cat_ids)
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
  where p.status <> 'archived'
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

-- Marcas y etiquetas existentes (productos no archivados), con conteo.
create or replace function public.pricing_scope_facets()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'brands', coalesce((
      select jsonb_agg(jsonb_build_object('value', brand, 'count', n) order by brand)
        from (select trim(brand) as brand, count(*) as n from public.products
               where status <> 'archived' and nullif(trim(brand), '') is not null
               group by trim(brand)) b), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object('value', tag, 'count', n) order by tag)
        from (select t as tag, count(*) as n from public.products, unnest(tags) t
               where status <> 'archived'
               group by t) x), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Aplicar un lote (chunk) de cambios. p_changes:
--   [{ variant_id, old_price, old_compare_at, new_price, new_compare_at }]
-- Sólo actualiza si el precio y el tachado actuales siguen siendo los
-- "old" (evita pisar cambios hechos entre la vista previa y el aplicar).
-- ---------------------------------------------------------------------
create or replace function public.apply_price_changes(p_batch_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total int := jsonb_array_length(coalesce(p_changes, '[]'::jsonb));
  v_applied int;
begin
  if not public.is_admin() then
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
       and v.price = i.old_price
       and v.compare_at_price is not distinct from i.old_compare_at
    returning v.id, i.old_price, i.old_compare_at, i.new_price, i.new_compare_at
  ),
  ins as (
    insert into public.price_changes (batch_id, variant_id, old_price, old_compare_at, new_price, new_compare_at, created_by)
    select p_batch_id, u.id, u.old_price, u.old_compare_at, u.new_price, u.new_compare_at, auth.uid() from upd u
    returning 1
  )
  select count(*)::int into v_applied from ins;

  return jsonb_build_object('applied', v_applied, 'skipped', v_total - v_applied);
end;
$$;

-- ---------------------------------------------------------------------
-- Deshacer un batch. Restaura sólo las variantes cuyo precio Y tachado
-- actuales siguen siendo los new_* del batch (si alguien las tocó después,
-- no se pisan). Marca el batch como deshecho.
-- ---------------------------------------------------------------------
create or replace function public.undo_price_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total int;
  v_restored int;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if exists (select 1 from public.price_batches where id = p_batch_id and undone_at is not null) then
    return jsonb_build_object('ok', false, 'reason', 'already_undone');
  end if;

  select count(*)::int into v_total from public.price_changes where batch_id = p_batch_id;
  if v_total = 0 then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  with upd as (
    update public.product_variants v
       set price = pc.old_price,
           compare_at_price = pc.old_compare_at
      from public.price_changes pc
     where pc.batch_id = p_batch_id
       and v.id = pc.variant_id
       and pc.old_price is not null
       and v.price = pc.new_price
       and v.compare_at_price is not distinct from pc.new_compare_at
    returning v.id
  )
  select count(*)::int into v_restored from upd;

  insert into public.price_batches (id, source, variant_count, created_at)
  select p_batch_id, 'other', v_total, min(created_at) from public.price_changes where batch_id = p_batch_id
  on conflict (id) do nothing;

  update public.price_batches
     set undone_at = now(),
         undone_by = auth.uid(),
         undo_result = jsonb_build_object('restored', v_restored, 'skipped', v_total - v_restored)
   where id = p_batch_id;

  return jsonb_build_object('ok', true, 'total', v_total, 'restored', v_restored, 'skipped', v_total - v_restored);
end;
$$;

revoke execute on function public.pricing_scope_variants(jsonb) from public, anon;
revoke execute on function public.pricing_scope_facets() from public, anon;
revoke execute on function public.apply_price_changes(uuid, jsonb) from public, anon;
revoke execute on function public.undo_price_batch(uuid) from public, anon;
grant execute on function public.pricing_scope_variants(jsonb) to authenticated;
grant execute on function public.pricing_scope_facets() to authenticated;
grant execute on function public.apply_price_changes(uuid, jsonb) to authenticated;
grant execute on function public.undo_price_batch(uuid) to authenticated;

revoke all on public.price_batch_list from anon;
grant select on public.price_batch_list to authenticated;
