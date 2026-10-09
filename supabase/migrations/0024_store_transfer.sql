-- =====================================================================
-- 0024 · Pasar la tienda a otra persona (cambio de titular)
--
-- Idempotente (`if not exists`, `create or replace`, `drop … if exists`).
--
-- Modelo: una tienda puede tener varios dueños (store_members.role =
-- 'owner'), pero UNA sola persona la tiene a su nombre: `stores.owner_id`
-- (el titular). El titular es quien cuenta para el máximo de 3 tiendas por
-- cuenta (create_store), quien recibe los mails de cuenta (bienvenida,
-- prueba, cobro del plan) y quien aparece en /platform/tiendas.
--
-- 1. store_transfers: historial de traspasos y el pendiente (uno por
--    tienda) con su token para `/invitacion/tienda/<token>`.
--    RLS: los dueños de la tienda leen; nadie escribe directo (sólo RPCs).
-- 2. guard_store_owner(): además de lo de 0011,
--    - al titular no se le puede cambiar el rol, desactivar ni quitar del
--      equipo desde el panel: primero se pasa la tienda (antes un co-dueño
--      podía dejar al titular como staff o sacarlo, y `owner_id` quedaba
--      apuntando a alguien sin acceso);
--    - durante un traspaso (`ecommy.store_transfer` = id de la tienda, sólo
--      lo fija private.apply_store_transfer) el titular anterior puede
--      pasar a administrador aunque sea quien ejecuta la operación.
-- 3. private.apply_store_transfer(): hace el cambio (nuevo dueño activo,
--    owner_id, anterior → admin o fuera del equipo), desconecta la cuenta
--    de Mercado Pago de VENTAS (la plata de los pedidos tiene que ir a la
--    cuenta del nuevo dueño) y, la primera vez que la tienda cambia de
--    titular, si nunca se pagó un plan, arranca 14 días de Pro desde hoy
--    (lo mismo que tendría el nuevo dueño si la creara él).
-- 4. transfer_store(store, email, keep_previous): sólo el titular (o el
--    superadmin). Si el email es de alguien del equipo, pasa ya; si no,
--    deja un traspaso pendiente con link (7 días). Bloquea si la tienda
--    tiene un débito automático de Mercado Pago del plan (está a nombre de
--    quien paga hoy) o si quien recibe ya tiene 3 tiendas a su nombre.
--    cancel_store_transfer(store): anula el pendiente.
--    get_store_transfer(token) (anon) y accept_store_transfer(token).
--    Todo queda en audit_log (lo escribe la base: si el anterior se va del
--    equipo ya no podría insertar en la auditoría de la tienda).
-- 5. schema_version = 15 (con greatest).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. store_transfers
-- ---------------------------------------------------------------------
create table if not exists public.store_transfers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  from_user_id uuid references auth.users (id) on delete set null,
  to_email text not null check (to_email = lower(to_email)),
  to_user_id uuid references auth.users (id) on delete set null,
  keep_previous boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  token text unique default encode(extensions.gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default now() + interval '7 days',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  -- Fin de la prueba de Pro que arrancó con este traspaso (null si no arrancó ninguna).
  trial_ends_at timestamptz
);
create unique index if not exists store_transfers_one_pending on public.store_transfers (store_id) where status = 'pending';
create index if not exists store_transfers_store_idx on public.store_transfers (store_id, created_at desc);
create index if not exists store_transfers_from_idx on public.store_transfers (from_user_id);
create index if not exists store_transfers_to_idx on public.store_transfers (to_user_id);
create index if not exists store_transfers_created_by_idx on public.store_transfers (created_by);

alter table public.store_transfers enable row level security;
drop policy if exists "store_transfers: dueño lee" on public.store_transfers;
create policy "store_transfers: dueño lee" on public.store_transfers
  for select to authenticated using (public.is_store_owner(store_id));
revoke all on public.store_transfers from anon, authenticated;
grant select on public.store_transfers to authenticated;

-- ---------------------------------------------------------------------
-- 2. Guardia de dueños (reemplaza la de 0011)
-- ---------------------------------------------------------------------
create or replace function private.guard_store_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_owner boolean := old.role = 'owner' and old.is_active;
  v_new_owner boolean;
  v_transfer boolean := coalesce(current_setting('ecommy.store_transfer', true), '') = old.store_id::text;
begin
  if tg_op = 'DELETE' then
    v_new_owner := false;
  else
    v_new_owner := new.role = 'owner' and new.is_active;
  end if;

  if tg_op = 'UPDATE' and not v_transfer and auth.uid() is not null and old.user_id = auth.uid()
     and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    raise exception 'No podés cambiar tu propio rol ni desactivar tu cuenta';
  end if;

  -- 0024: el titular sólo deja de ser dueño pasando la tienda. Sin sesión
  -- (service role: borrar una cuenta, scripts) no se exige.
  if v_old_owner and not v_new_owner and not v_transfer and auth.uid() is not null
     and exists (select 1 from public.stores s where s.id = old.store_id and s.owner_id = old.user_id) then
    raise exception 'Esa persona tiene la tienda a su nombre. Para cambiarle el rol, primero pasale la tienda a otra persona';
  end if;

  -- Si la tienda se está borrando (cascade) no hay nada que proteger.
  if v_old_owner and not v_new_owner
     and exists (select 1 from public.stores s where s.id = old.store_id) then
    perform pg_advisory_xact_lock(hashtext('ecommy.store_owner.' || old.store_id::text));
    if not exists (
      select 1 from public.store_members m
       where m.store_id = old.store_id and m.user_id <> old.user_id and m.role = 'owner' and m.is_active
    ) then
      raise exception 'La tienda tiene que tener al menos un dueño activo';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Helpers privados
-- ---------------------------------------------------------------------

-- Tiendas a nombre de una cuenta (mismo criterio que create_store).
create or replace function private.owned_store_count(p_user uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.stores where owner_id = p_user and status <> 'deleted';
$$;

-- Bloqueos comunes a ofrecer y a aceptar un traspaso.
create or replace function private.assert_store_transferable(p_store_id uuid, p_to uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Débito automático del PLAN en MP: está a nombre de quien paga hoy.
  if exists (
    select 1 from public.subscriptions
     where store_id = p_store_id and provider = 'mercadopago' and provider_ref is not null
       and provider_status in ('authorized', 'authorized_unpaid', 'paused')
  ) then
    raise exception 'La tienda tiene un débito automático del plan con Mercado Pago. Cancelá la renovación en Plan y después pasala';
  end if;
  if p_to is not null
     and not exists (select 1 from public.profiles p where p.id = p_to and p.is_platform_admin)
     and private.owned_store_count(p_to) >= 3 then
    raise exception 'Esa cuenta ya tiene 3 tiendas a su nombre, el máximo por cuenta';
  end if;
end;
$$;

create or replace function private.audit_store_transfer(
  p_store_id uuid, p_action text, p_entity_id text, p_summary text, p_diff jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (store_id, actor_id, actor_email, action, entity, entity_id, summary, diff)
  values (
    p_store_id, auth.uid(), (select email from public.profiles where id = auth.uid()),
    p_action, 'store', p_entity_id, p_summary, p_diff
  );
$$;

-- Hace el cambio de titular. Devuelve el fin de la prueba de Pro si arrancó una.
create or replace function private.apply_store_transfer(p_store_id uuid, p_from uuid, p_to uuid, p_keep_previous boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_trial timestamptz;
begin
  perform set_config('ecommy.store_transfer', p_store_id::text, true);

  insert into public.store_members (store_id, user_id, role, is_active, invited_by)
  values (p_store_id, p_to, 'owner', true, auth.uid())
  on conflict (store_id, user_id) do update set role = 'owner', is_active = true;

  update public.stores set owner_id = p_to where id = p_store_id;

  if p_from is not null and p_from <> p_to then
    if p_keep_previous then
      update public.store_members set role = 'admin' where store_id = p_store_id and user_id = p_from;
    else
      delete from public.store_members where store_id = p_store_id and user_id = p_from;
    end if;
  end if;

  -- Cobro de pedidos con Mercado Pago: la cuenta conectada es de otra persona.
  if exists (
    select 1 from public.store_payment_accounts
     where store_id = p_store_id and provider = 'mercadopago' and status <> 'disconnected'
  ) then
    update public.payment_methods set is_active = false where store_id = p_store_id and code = 'mercadopago';
    update public.store_payment_accounts
       set status = 'disconnected', access_token_enc = null, refresh_token_enc = null, token_expires_at = null,
           last_error = 'Se desconectó al pasar la tienda a otro dueño. Conectá tu cuenta para cobrar con tarjeta.',
           updated_at = now()
     where store_id = p_store_id and provider = 'mercadopago';
  end if;

  -- Prueba de Pro: una sola vez por tienda (primer cambio de titular) y
  -- sólo si nunca se pagó un plan.
  select * into v_sub from public.subscriptions where store_id = p_store_id for update;
  if found
     and not exists (select 1 from public.store_transfers t where t.store_id = p_store_id and t.status = 'accepted')
     and v_sub.last_payment_at is null
     and coalesce(v_sub.provider, 'manual') <> 'mercadopago'
     and (v_sub.status = 'trialing' or v_sub.plan_code = 'free') then
    v_trial := greatest(
      case when v_sub.status = 'trialing' then v_sub.trial_ends_at end,
      now() + interval '14 days'
    );
    update public.subscriptions
       set plan_code = 'pro', status = 'trialing', trial_ends_at = v_trial, current_period_start = now(),
           notes = trim(coalesce(notes, '') || ' Prueba de Pro al pasar la tienda (' || to_char(now(), 'YYYY-MM-DD') || ').')
     where store_id = p_store_id;
  end if;

  perform set_config('ecommy.store_transfer', '', true);
  return v_trial;
end;
$$;

revoke execute on function private.owned_store_count(uuid) from public, anon, authenticated;
revoke execute on function private.assert_store_transferable(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.audit_store_transfer(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function private.apply_store_transfer(uuid, uuid, uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. RPCs
-- ---------------------------------------------------------------------

-- Pasa la tienda (miembro del equipo) o deja el traspaso pendiente con link.
create or replace function public.transfer_store(p_store_id uuid, p_email text, p_keep_previous boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_keep boolean := coalesce(p_keep_previous, true);
  v_store public.stores;
  v_to uuid;
  v_trial timestamptz;
  v_row public.store_transfers;
begin
  if v_uid is null then
    raise exception 'No autorizado';
  end if;
  select * into v_store from public.stores where id = p_store_id for update;
  if not found or v_store.status = 'deleted' then
    raise exception 'La tienda no existe';
  end if;
  if not (
    public.is_platform_admin()
    or (v_store.owner_id = v_uid and exists (
      select 1 from public.store_members m
       where m.store_id = p_store_id and m.user_id = v_uid and m.role = 'owner' and m.is_active
    ))
  ) then
    raise exception 'Sólo quien tiene la tienda a su nombre puede pasarla';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ingresá un email válido';
  end if;

  select id into v_to from public.profiles where email = v_email;
  if v_to is not null and v_to = v_store.owner_id then
    raise exception 'Esa persona ya tiene la tienda a su nombre';
  end if;
  perform private.assert_store_transferable(p_store_id, v_to);

  -- Cualquier link anterior deja de servir.
  update public.store_transfers set status = 'cancelled' where store_id = p_store_id and status = 'pending';

  if v_to is not null and exists (select 1 from public.store_members m where m.store_id = p_store_id and m.user_id = v_to) then
    v_trial := private.apply_store_transfer(p_store_id, v_store.owner_id, v_to, v_keep);
    insert into public.store_transfers (store_id, from_user_id, to_email, to_user_id, keep_previous, status, token, created_by, accepted_at, trial_ends_at)
    values (p_store_id, v_store.owner_id, v_email, v_to, v_keep, 'accepted', null, v_uid, now(), v_trial)
    returning * into v_row;
    perform private.audit_store_transfer(
      p_store_id, 'store.transfer', v_row.id::text,
      'Pasó la tienda a ' || v_email
        || case when v_store.owner_id is null then '' when v_keep then ' y el dueño anterior quedó como administrador' else ' y el dueño anterior salió del equipo' end,
      jsonb_build_object('owner_id', jsonb_build_array(v_store.owner_id, v_to), 'trial_ends_at', v_trial)
    );
    return jsonb_build_object('status', 'transferred', 'id', v_row.id, 'user_id', v_to, 'trial_ends_at', v_trial);
  end if;

  insert into public.store_transfers (store_id, from_user_id, to_email, keep_previous, created_by)
  values (p_store_id, v_store.owner_id, v_email, v_keep, v_uid)
  returning * into v_row;
  perform private.audit_store_transfer(
    p_store_id, 'store.transfer_offer', v_row.id::text,
    'Ofreció pasar la tienda a ' || v_email || ' (link de 7 días)', null
  );
  return jsonb_build_object('status', 'pending', 'id', v_row.id, 'token', v_row.token, 'expires_at', v_row.expires_at, 'has_account', v_to is not null);
end;
$$;

create or replace function public.cancel_store_transfer(p_store_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.store_transfers;
begin
  if not (
    public.is_platform_admin()
    or exists (select 1 from public.stores s where s.id = p_store_id and s.owner_id = auth.uid())
  ) then
    raise exception 'Sólo quien tiene la tienda a su nombre puede anular el traspaso';
  end if;
  update public.store_transfers set status = 'cancelled'
   where store_id = p_store_id and status = 'pending'
  returning * into v_row;
  if not found then
    return false;
  end if;
  perform private.audit_store_transfer(p_store_id, 'store.transfer_cancel', v_row.id::text, 'Anuló el traspaso a ' || v_row.to_email, null);
  return true;
end;
$$;

-- Datos mínimos del link (para /invitacion/tienda/<token>).
create or replace function public.get_store_transfer(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'store_name', s.name,
           'store_slug', s.slug,
           'email', t.to_email,
           'from_name', coalesce(nullif(p.name, ''), split_part(p.email, '@', 1)),
           'keep_previous', t.keep_previous,
           'status', t.status,
           'expired', t.expires_at < now()
         )
    from public.store_transfers t
    join public.stores s on s.id = t.store_id and s.status <> 'deleted'
    left join public.profiles p on p.id = t.from_user_id
   where t.token = p_token;
$$;

create or replace function public.accept_store_transfer(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.store_transfers;
  v_store public.stores;
  v_email text;
  v_trial timestamptz;
begin
  if v_uid is null then
    raise exception 'Iniciá sesión para recibir la tienda';
  end if;
  -- Mismo orden de bloqueo que transfer_store (tienda → traspaso).
  select * into v_row from public.store_transfers where token = p_token;
  if found then
    perform 1 from public.stores where id = v_row.store_id for update;
    select * into v_row from public.store_transfers where id = v_row.id for update;
  end if;
  if not found or v_row.status = 'cancelled' then
    raise exception 'El link no existe o lo anularon. Pedí uno nuevo';
  end if;
  if v_row.status = 'accepted' then
    raise exception 'Este link ya se usó';
  end if;
  if v_row.expires_at < now() then
    raise exception 'El link venció. Pedí uno nuevo';
  end if;
  select email into v_email from public.profiles where id = v_uid;
  if v_email is distinct from v_row.to_email then
    raise exception 'El link es para %', v_row.to_email;
  end if;

  select * into v_store from public.stores where id = v_row.store_id for update;
  if not found or v_store.status = 'deleted' then
    raise exception 'La tienda ya no existe';
  end if;
  if v_store.owner_id is distinct from v_row.from_user_id then
    raise exception 'La tienda cambió de dueño después de este link. Pedí uno nuevo';
  end if;
  perform private.assert_store_transferable(v_store.id, v_uid);

  v_trial := private.apply_store_transfer(v_store.id, v_store.owner_id, v_uid, v_row.keep_previous);
  update public.store_transfers
     set status = 'accepted', to_user_id = v_uid, accepted_at = now(), trial_ends_at = v_trial
   where id = v_row.id;
  perform private.audit_store_transfer(
    v_store.id, 'store.transfer_accept', v_row.id::text,
    'Recibió la tienda'
      || case when v_store.owner_id is null then '' when v_row.keep_previous then '; el dueño anterior quedó como administrador' else '; el dueño anterior salió del equipo' end,
    jsonb_build_object('owner_id', jsonb_build_array(v_store.owner_id, v_uid), 'trial_ends_at', v_trial)
  );
  return jsonb_build_object('store_id', v_store.id, 'trial_ends_at', v_trial);
end;
$$;

revoke execute on function public.transfer_store(uuid, text, boolean) from public, anon;
revoke execute on function public.cancel_store_transfer(uuid) from public, anon;
revoke execute on function public.accept_store_transfer(text) from public, anon;
revoke execute on function public.get_store_transfer(text) from public;
grant execute on function public.transfer_store(uuid, text, boolean) to authenticated;
grant execute on function public.cancel_store_transfer(uuid) to authenticated;
grant execute on function public.accept_store_transfer(text) to authenticated;
grant execute on function public.get_store_transfer(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. schema_version = 15 (`greatest`: aplicarla fuera de orden no baja la versión)
-- ---------------------------------------------------------------------
insert into public.app_meta (key, value) values ('schema_version', '15'::jsonb)
  on conflict (key) do update
     set value = to_jsonb(greatest(coalesce((public.app_meta.value #>> '{}')::int, 0), 15)),
         updated_at = now();
