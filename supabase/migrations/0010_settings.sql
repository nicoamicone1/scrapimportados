-- =====================================================================
-- 0010 · Configuración, usuarios y auditoría (agente H)
-- =====================================================================
-- - admin_list_users(): perfiles + último ingreso de auth.users (sólo admin).
-- - update_my_profile(): cualquier usuario activo cambia SU nombre (la RLS
--   de profiles sólo deja modificar al owner).
-- - touch_last_seen(): marca el último acceso del usuario actual.
-- - Guardia de owners: no se puede quitar/desactivar al último owner activo
--   ni cambiarse el propio rol o desactivarse a sí mismo.
-- - schema_version = 3.

-- ---------------------------------------------------------------------
-- Listado de usuarios con último ingreso
-- ---------------------------------------------------------------------
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  name text,
  role text,
  is_active boolean,
  last_seen_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  return query
    select p.id, p.email, p.name, p.role, p.is_active, p.last_seen_at, u.last_sign_in_at, p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by
      case p.role when 'pending' then 0 when 'owner' then 1 when 'admin' then 2 else 3 end,
      p.created_at;
end;
$$;

revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- ---------------------------------------------------------------------
-- Mi cuenta: cambiar el propio nombre
-- ---------------------------------------------------------------------
create or replace function public.update_my_profile(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(trim(coalesce(p_name, '')), '');
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;
  if v_name is null or length(v_name) > 80 then
    raise exception 'Ingresá un nombre de hasta 80 caracteres';
  end if;
  update public.profiles set name = v_name where id = auth.uid();
end;
$$;

revoke execute on function public.update_my_profile(text) from public, anon;
grant execute on function public.update_my_profile(text) to authenticated;

-- ---------------------------------------------------------------------
-- Último acceso (llamar al cargar el panel; se actualiza cada 5 min como mucho)
-- ---------------------------------------------------------------------
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
    set last_seen_at = now()
    where id = auth.uid()
      and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
$$;

revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

-- ---------------------------------------------------------------------
-- Guardia de owners
-- ---------------------------------------------------------------------
create or replace function private.guard_profile_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_owner boolean := old.role = 'owner' and old.is_active;
  v_new_owner boolean;
begin
  if tg_op = 'DELETE' then
    v_new_owner := false;
  else
    v_new_owner := new.role = 'owner' and new.is_active;
  end if;

  -- Nadie cambia su propio rol ni se desactiva a sí mismo desde la app.
  if tg_op = 'UPDATE' and auth.uid() is not null and old.id = auth.uid()
     and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    raise exception 'No podés cambiar tu propio rol ni desactivar tu cuenta';
  end if;

  if v_old_owner and not v_new_owner then
    perform pg_advisory_xact_lock(hashtext('ecommy.profiles.owner'));
    if not exists (
      select 1 from public.profiles
      where id <> old.id and role = 'owner' and is_active
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

drop trigger if exists profiles_guard_owner on public.profiles;
create trigger profiles_guard_owner
  before update or delete on public.profiles
  for each row execute function private.guard_profile_owner();

-- ---------------------------------------------------------------------
-- Versión del esquema
-- ---------------------------------------------------------------------
insert into public.app_meta (key, value) values ('schema_version', '3'::jsonb)
  on conflict (key) do update set value = '3'::jsonb, updated_at = now();
