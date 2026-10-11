-- =====================================================================
-- 0026 · Borrar una tienda para siempre
--
-- Hasta ahora una tienda sólo se podía "marcar como borrada"
-- (stores.status = 'deleted'): dejaba de verse pero los datos quedaban.
-- `purge_store` la elimina de verdad: `delete from stores` y todo lo que
-- cuelga de ella cae por `on delete cascade` (productos, pedidos, clientes,
-- páginas, equipo, suscripción…; billing_events queda con store_id null).
-- Las fotos del bucket `media/<store_id>/…` las borra el servidor con la
-- API de Storage (Supabase no deja borrar storage.objects por SQL).
--
-- Quién puede: el superadmin, o quien tiene la tienda a su nombre
-- (stores.owner_id). Hay que escribir la dirección (slug) para confirmar.
-- No se puede si el plan se paga con débito automático de Mercado Pago que
-- todavía puede cobrar (primero se cancela la renovación), ni con `demo`
-- (la usan las vistas previas de estilos).
--
-- Queda constancia en `store_purges` (audit_log se borra con la tienda).
-- No cambia schema_version: el código detecta la función por el error.
-- =====================================================================

create table if not exists public.store_purges (
  id bigint generated always as identity primary key,
  store_id uuid not null,
  slug text not null,
  name text not null,
  owner_id uuid,
  purged_by uuid references auth.users (id) on delete set null,
  purged_by_email text,
  as_platform_admin boolean not null default false,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.store_purges enable row level security;

drop policy if exists store_purges_platform_read on public.store_purges;
create policy store_purges_platform_read on public.store_purges
  for select to authenticated
  using ((select public.is_platform_admin()));

create index if not exists store_purges_purged_by_idx on public.store_purges (purged_by);

create or replace function public.purge_store(p_store_id uuid, p_confirm text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := public.is_platform_admin();
  v_store public.stores%rowtype;
  v_sub record;
  v_stats jsonb;
begin
  if v_uid is null then
    raise exception 'Iniciá sesión para borrar una tienda';
  end if;

  select * into v_store from public.stores where id = p_store_id for update;
  if not found then
    raise exception 'Esa tienda no existe';
  end if;

  if not v_admin and v_store.owner_id is distinct from v_uid then
    raise exception 'Sólo quien tiene la tienda a su nombre puede borrarla';
  end if;

  if v_store.slug = 'demo' then
    raise exception 'La tienda demo de la plataforma no se puede borrar';
  end if;

  if lower(trim(coalesce(p_confirm, ''))) <> v_store.slug then
    raise exception 'Escribí la dirección de la tienda (%) para confirmar', v_store.slug;
  end if;

  select provider, provider_ref, provider_status into v_sub
    from public.subscriptions where store_id = p_store_id;
  if found and v_sub.provider = 'mercadopago' and v_sub.provider_ref is not null
     and v_sub.provider_status in ('pending', 'authorized', 'authorized_unpaid', 'paused') then
    raise exception 'El plan se paga con débito automático de Mercado Pago. Cancelá la renovación antes de borrar la tienda';
  end if;

  v_stats := jsonb_build_object(
    'products', (select count(*) from public.products where store_id = p_store_id),
    'orders', (select count(*) from public.orders where store_id = p_store_id),
    'customers', (select count(*) from public.customers where store_id = p_store_id),
    'members', (select count(*) from public.store_members where store_id = p_store_id),
    'status', v_store.status,
    'created_at', v_store.created_at
  );

  insert into public.store_purges (store_id, slug, name, owner_id, purged_by, purged_by_email, as_platform_admin, stats)
  values (
    v_store.id, v_store.slug, v_store.name, v_store.owner_id, v_uid,
    (select email from auth.users where id = v_uid),
    v_admin and v_store.owner_id is distinct from v_uid,
    v_stats
  );

  delete from public.stores where id = p_store_id;

  return jsonb_build_object('store_id', v_store.id, 'slug', v_store.slug, 'name', v_store.name, 'stats', v_stats);
end;
$$;

revoke execute on function public.purge_store(uuid, text) from public, anon;
grant execute on function public.purge_store(uuid, text) to authenticated;
