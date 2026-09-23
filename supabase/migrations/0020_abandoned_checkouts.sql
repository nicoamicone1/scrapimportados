-- =====================================================================
-- 0020 · Recuperación de carritos abandonados
--
-- Idempotente (`if not exists`, `create or replace`, `drop policy if exists`).
-- Requiere 0015 (suscripciones con `provider`): la frena con un error claro
-- si falta.
--
-- 1. checkout_sessions: el carrito de quien llegó al checkout, dejó su email
--    en "Tus datos" y TILDÓ "Avisame por mail si dejo el pedido sin
--    terminar" (el tilde nace desmarcado: sin consentimiento no se guarda
--    nada, y destildarlo después borra la sesión). `token` (48 hex, 192 bits,
--    lo genera la base) es el secreto de los links del mail: restaurar el
--    carrito y darse de baja. Nombre y precio de cada ítem salen de la base,
--    nunca del navegador (el mail no puede llevar texto tipeado por un
--    tercero salvo el nombre de pila, que la plantilla filtra).
-- 2. RPC públicas (security definer, patrón 0016):
--      · checkout_reminders_enabled(store): ¿la tienda tiene la función
--        prendida (Configuración › Pagos y checkout) y su plan la incluye?
--        El checkout muestra el tilde sólo si es true.
--      · upsert_checkout_session(): crea o actualiza por token. Cupos (sólo
--        al CREAR, con advisory lock por tienda): 10 por email y tienda por
--        día, 30 por IP (hash de la action) y tienda por día, 500 por tienda
--        por día. Un email que se dio de baja en la tienda no vuelve a
--        guardarse (la baja la pudo pedir la dueña real de la casilla).
--      · get_checkout_session(token): ítems y nombre (sin email) para
--        reponer el carrito desde el link del mail.
--      · checkout_session_unsubscribe(token): baja de los avisos de ESA
--        tienda para ese email (todas sus sesiones) y borra los ítems.
--      · mark_checkout_recovered(token, order_token): al confirmar el pedido
--        (lo llama la app, `create_order` NO cambia). Valida que el pedido
--        exista, sea de la misma tienda y del mismo email.
-- 3. RPC del cron (sólo service_role):
--      · abandoned_checkout_candidates(limit): marca como recuperadas las
--        sesiones cuyo email ya compró en la tienda después de abrirlas
--        (otro dispositivo, o la marca de la app falló) y devuelve las que
--        están para avisar: con consentimiento, sin pedido, sin aviso, sin
--        baja, `updated_at` entre 3 y 48 h atrás, tienda activa con la
--        función habilitada. La app decide con pickAbandonedNotices() y
--        reclama cada una con un update condicional de `reminded_at`.
--      · purge_checkout_sessions(): borra las sesiones de más de 30 días (las
--        de baja se guardan un año, sin ítems, como lista de supresión).
-- 4. RLS: el equipo de la tienda LEE (sin `token` ni `ip_hash`). Nadie
--    escribe directo: sólo por RPC. anon no toca la tabla.
--
-- Plan: `plans.features -> 'marketing.abandoned'`; si la clave no está (plan
-- que nadie editó desde /platform), default de src/lib/plans/features.ts:
-- todos menos Free. El plan efectivo sale de private.store_plan_code(), COPIA
-- de las ramas de public.current_plan() (0015) sin el chequeo de miembro: si
-- cambian las de current_plan, cambiá ésta.
--
-- Orden de deploy: después de 0015. Sin esta migración el checkout no
-- muestra el tilde, el link del mail no existe, la bandeja del admin avisa
-- que falta y el cron no manda nada.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'provider'
  ) then
    raise exception '0020 necesita 0015_billing.sql: aplicá esa migración primero.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Tabla
-- ---------------------------------------------------------------------
create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  token text not null unique check (token ~ '^[0-9a-f]{48}$'),
  email text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  name text check (name is null or char_length(name) <= 120),
  -- [{variant_id, qty, name, price}] con nombre y precio de lista de la base.
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  consent boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recovered_order_id uuid references public.orders (id) on delete set null,
  reminded_at timestamptz,
  unsubscribed_at timestamptz,
  -- sha256 truncado de día + tienda + IP (lo calcula la server action); sólo para el cupo.
  ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{16,64}$')
);

-- Bandeja del admin y cupo por tienda.
create index if not exists checkout_sessions_store_created_idx
  on public.checkout_sessions (store_id, created_at desc);
-- Cupo por email, baja por email y "ya se le avisó esta semana".
create index if not exists checkout_sessions_store_email_idx
  on public.checkout_sessions (store_id, email, created_at desc);
-- Cupo por IP.
create index if not exists checkout_sessions_store_ip_idx
  on public.checkout_sessions (store_id, ip_hash, created_at desc) where ip_hash is not null;
-- Candidatas del cron.
create index if not exists checkout_sessions_due_idx
  on public.checkout_sessions (updated_at)
  where consent and recovered_order_id is null and reminded_at is null and unsubscribed_at is null;

alter table public.checkout_sessions enable row level security;

drop policy if exists "checkout_sessions: admin lee" on public.checkout_sessions;
create policy "checkout_sessions: admin lee" on public.checkout_sessions
  for select to authenticated
  using (store_id = any ((select public.admin_store_ids())::uuid[]) or (select public.is_platform_admin()));

-- Sólo lectura para el equipo y sin el token (restaura el carrito y da de baja
-- en nombre del comprador) ni el hash de IP. Las escrituras son por RPC.
revoke all on public.checkout_sessions from anon;
revoke all on public.checkout_sessions from authenticated;
grant select (
  id, store_id, email, name, items, subtotal, consent, created_at, updated_at,
  recovered_order_id, reminded_at, unsubscribed_at
) on public.checkout_sessions to authenticated;

-- ---------------------------------------------------------------------
-- 2. ¿La tienda recuerda carritos? (plan + configuración)
-- ---------------------------------------------------------------------

-- Plan efectivo: COPIA de las ramas de public.current_plan() (0015).
create or replace function private.store_plan_code(p_store_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  select * into v_sub from public.subscriptions where store_id = p_store_id;
  if not found then
    return 'free';
  elsif v_sub.status = 'trialing' and v_sub.trial_ends_at is not null and v_sub.trial_ends_at < now() then
    return 'free';
  elsif v_sub.status = 'cancelled' then
    return 'free';
  elsif v_sub.cancel_at_period_end and v_sub.status in ('active', 'past_due')
        and v_sub.current_period_end is not null and v_sub.current_period_end < now() then
    return 'free';
  elsif v_sub.provider = 'mercadopago' and v_sub.provider_status = 'authorized_unpaid' and v_sub.status in ('active', 'past_due')
        and v_sub.current_period_end is not null and v_sub.current_period_end < now() then
    return 'free';
  elsif v_sub.provider = 'mercadopago' and v_sub.status in ('active', 'past_due')
        and v_sub.current_period_end is not null and v_sub.current_period_end < now() - interval '7 days' then
    return 'free';
  end if;
  return v_sub.plan_code;
end;
$$;

create or replace function private.checkout_reminders_on(p_store_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_flag jsonb;
begin
  if p_store_id is null or not public.store_is_active(p_store_id) then
    return false;
  end if;
  if not exists (
    select 1 from public.store_settings ss
     where ss.store_id = p_store_id and ss.checkout -> 'abandoned_reminders' = 'true'::jsonb
  ) then
    return false;
  end if;
  v_code := private.store_plan_code(p_store_id);
  select p.features -> 'marketing.abandoned' into v_flag from public.plans p where p.code = v_code;
  if v_flag is not null and jsonb_typeof(v_flag) = 'boolean' then
    return v_flag = 'true'::jsonb;
  end if;
  -- Clave ausente: default de src/lib/plans/features.ts (Starter en adelante).
  return v_code is distinct from 'free';
end;
$$;

revoke execute on function private.store_plan_code(uuid) from public, anon, authenticated;
revoke execute on function private.checkout_reminders_on(uuid) from public, anon, authenticated;

create or replace function public.checkout_reminders_enabled(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.checkout_reminders_on(p_store_id);
$$;

revoke execute on function public.checkout_reminders_enabled(uuid) from public;
grant execute on function public.checkout_reminders_enabled(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. upsert_checkout_session (público)
-- ---------------------------------------------------------------------
create or replace function public.upsert_checkout_session(
  p_store_id uuid,
  p_token text,
  p_email text,
  p_name text,
  p_items jsonb,
  p_consent boolean,
  p_ip_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := nullif(left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 120), '');
  v_token text := nullif(lower(trim(coalesce(p_token, ''))), '');
  v_ip text := nullif(lower(trim(coalesce(p_ip_hash, ''))), '');
  v_row public.checkout_sessions;
  v_found boolean := false;
  v_items jsonb := '[]'::jsonb;
  v_subtotal numeric(12, 2) := 0;
  v_email_day int;
  v_ip_day int;
  v_store_day int;
  v_new_token text;
begin
  if v_token is not null and v_token !~ '^[0-9a-f]{48}$' then
    v_token := null;
  end if;
  if v_ip is not null and v_ip !~ '^[0-9a-f]{16,64}$' then
    v_ip := null;
  end if;
  if p_store_id is null or not public.store_is_active(p_store_id) then
    raise exception 'La tienda no está disponible.';
  end if;

  if v_token is not null then
    select * into v_row from public.checkout_sessions
     where token = v_token and store_id = p_store_id
       for update;
    v_found := found;
  end if;

  -- Sin consentimiento no se guarda nada; si había una sesión abierta, se borra.
  if not coalesce(p_consent, false) then
    if v_found and v_row.recovered_order_id is null then
      delete from public.checkout_sessions where id = v_row.id;
    end if;
    return jsonb_build_object('ok', true, 'token', null, 'saved', false);
  end if;

  if not private.checkout_reminders_on(p_store_id) then
    return jsonb_build_object('ok', true, 'token', null, 'saved', false);
  end if;

  if char_length(v_email) > 254 or v_email !~ '^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$' then
    raise exception 'Revisá el email.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'El carrito tiene datos inválidos.';
  end if;

  -- Ítems: nombre y precio de lista de la base (variantes activas de productos
  -- publicados de ESTA tienda). Lo que no existe se descarta.
  begin
    select coalesce(jsonb_agg(
             jsonb_build_object('variant_id', x.variant_id, 'qty', x.qty, 'name', x.name, 'price', x.price)
             order by x.ord
           ), '[]'::jsonb),
           coalesce(sum(x.price * x.qty), 0)
      into v_items, v_subtotal
      from (
        select v.id as variant_id,
               least(greatest(e.qty, 1), 999)::int as qty,
               left(p.name || case when v.title = 'Default' then '' else ' · ' || v.title end, 300) as name,
               v.price,
               e.ord
          from (
            select (t.el ->> 'variant_id')::uuid as variant_id,
                   sum((t.el ->> 'qty')::int) as qty,
                   min(t.ord) as ord
              from jsonb_array_elements(p_items) with ordinality as t(el, ord)
             group by 1
          ) e
          join public.product_variants v on v.id = e.variant_id and v.store_id = p_store_id and v.is_active
          join public.products p on p.id = v.product_id and p.status = 'active'
      ) x;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'El carrito tiene datos inválidos.';
  end;

  -- Carrito vacío: no hay nada que recordar.
  if jsonb_array_length(v_items) = 0 then
    if v_found and v_row.recovered_order_id is null then
      delete from public.checkout_sessions where id = v_row.id;
    end if;
    return jsonb_build_object('ok', true, 'token', null, 'saved', false);
  end if;

  -- La misma sesión (mismo email, sin pedido): se actualiza. Si ya se mandó
  -- el aviso, `reminded_at` queda: nunca sale un segundo mail por sesión.
  if v_found and v_row.recovered_order_id is null and v_row.unsubscribed_at is null and v_row.email = v_email then
    update public.checkout_sessions
       set items = v_items, subtotal = v_subtotal, name = v_name, consent = true, updated_at = now()
     where id = v_row.id;
    return jsonb_build_object('ok', true, 'token', v_row.token, 'saved', true);
  end if;

  -- Cambió el email (se corrigió un error de tipeo): la sesión vieja se descarta.
  if v_found and v_row.recovered_order_id is null and v_row.email <> v_email then
    delete from public.checkout_sessions where id = v_row.id;
  end if;

  -- Email dado de baja en esta tienda: no se vuelve a guardar.
  if exists (
    select 1 from public.checkout_sessions s
     where s.store_id = p_store_id and s.email = v_email and s.unsubscribed_at is not null
  ) then
    return jsonb_build_object('ok', true, 'token', null, 'saved', false);
  end if;

  -- Cupos atómicos por tienda: las altas de una misma tienda se cuentan de a una.
  perform pg_advisory_xact_lock(hashtext('checkout_sessions:' || p_store_id::text));

  select count(*) into v_email_day from public.checkout_sessions
   where store_id = p_store_id and email = v_email and created_at > now() - interval '1 day';
  if v_email_day >= 10 then
    raise exception 'Ya guardamos varios carritos con este email hoy.';
  end if;

  if v_ip is not null then
    select count(*) into v_ip_day from public.checkout_sessions
     where store_id = p_store_id and ip_hash = v_ip and created_at > now() - interval '1 day';
    if v_ip_day >= 30 then
      raise exception 'Ya guardamos varios carritos hoy.';
    end if;
  end if;

  select count(*) into v_store_day from public.checkout_sessions
   where store_id = p_store_id and created_at > now() - interval '1 day';
  if v_store_day >= 500 then
    raise exception 'Hoy no podemos guardar más carritos en esta tienda.';
  end if;

  v_new_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.checkout_sessions (store_id, token, email, name, items, subtotal, consent, ip_hash)
  values (p_store_id, v_new_token, v_email, v_name, v_items, v_subtotal, true, v_ip);

  return jsonb_build_object('ok', true, 'token', v_new_token, 'saved', true);
end;
$$;

revoke execute on function public.upsert_checkout_session(uuid, text, text, text, jsonb, boolean, text) from public;
grant execute on function public.upsert_checkout_session(uuid, text, text, text, jsonb, boolean, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Restaurar, dar de baja y marcar recuperada (públicas, por token)
-- ---------------------------------------------------------------------
create or replace function public.get_checkout_session(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'store_id', s.store_id,
           'name', s.name,
           'recovered', s.recovered_order_id is not null,
           'items', coalesce((
             select jsonb_agg(jsonb_build_object('variant_id', e -> 'variant_id', 'qty', e -> 'qty', 'name', e -> 'name'))
               from jsonb_array_elements(s.items) e
           ), '[]'::jsonb)
         )
    from public.checkout_sessions s
   where s.token = lower(trim(coalesce(p_token, '')))
     and lower(trim(coalesce(p_token, ''))) ~ '^[0-9a-f]{48}$';
$$;

revoke execute on function public.get_checkout_session(text) from public;
grant execute on function public.get_checkout_session(text) to anon, authenticated;

create or replace function public.checkout_session_unsubscribe(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := lower(trim(coalesce(p_token, '')));
  v_store uuid;
  v_email text;
begin
  if v_token !~ '^[0-9a-f]{48}$' then
    return jsonb_build_object('ok', false);
  end if;
  select store_id, email into v_store, v_email from public.checkout_sessions where token = v_token;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  -- Baja de TODAS las sesiones de ese email en la tienda; sin pedido, se borran ítems y nombre.
  update public.checkout_sessions
     set unsubscribed_at = coalesce(unsubscribed_at, now()),
         items = case when recovered_order_id is null then '[]'::jsonb else items end,
         subtotal = case when recovered_order_id is null then 0 else subtotal end,
         name = case when recovered_order_id is null then null else name end
   where store_id = v_store and email = v_email;
  return jsonb_build_object('ok', true, 'store_id', v_store);
end;
$$;

revoke execute on function public.checkout_session_unsubscribe(text) from public;
grant execute on function public.checkout_session_unsubscribe(text) to anon, authenticated;

create or replace function public.mark_checkout_recovered(p_token text, p_order_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := lower(trim(coalesce(p_token, '')));
  v_row public.checkout_sessions;
  v_order uuid;
begin
  if v_token !~ '^[0-9a-f]{48}$' or coalesce(p_order_token, '') = '' then
    return jsonb_build_object('ok', false);
  end if;
  select * into v_row from public.checkout_sessions where token = v_token for update;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  if v_row.recovered_order_id is not null then
    return jsonb_build_object('ok', true);
  end if;
  select o.id into v_order
    from public.orders o
   where o.public_token = p_order_token
     and o.store_id = v_row.store_id
     and lower(o.customer ->> 'email') = v_row.email;
  if v_order is null then
    return jsonb_build_object('ok', false);
  end if;
  update public.checkout_sessions set recovered_order_id = v_order where id = v_row.id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.mark_checkout_recovered(text, text) from public;
grant execute on function public.mark_checkout_recovered(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Cron (sólo service_role)
-- ---------------------------------------------------------------------
create or replace function public.abandoned_checkout_candidates(p_limit int default 300)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  -- Compró igual (otro dispositivo, o la marca de la app no llegó): recuperada.
  -- 10 minutos de margen: la sesión se pudo guardar un instante después del pedido.
  update public.checkout_sessions s
     set recovered_order_id = (
           select o.id from public.orders o
            where o.store_id = s.store_id
              and lower(o.customer ->> 'email') = s.email
              and o.created_at >= s.created_at - interval '10 minutes'
            order by o.created_at
            limit 1
         )
   where s.consent
     and s.recovered_order_id is null
     and s.reminded_at is null
     and s.unsubscribed_at is null
     and s.updated_at > now() - interval '48 hours'
     and exists (
       select 1 from public.orders o
        where o.store_id = s.store_id
          and lower(o.customer ->> 'email') = s.email
          and o.created_at >= s.created_at - interval '10 minutes'
     );

  select coalesce(jsonb_agg(to_jsonb(c) order by c.updated_at), '[]'::jsonb) into v_out
    from (
      select s.id, s.store_id, s.token, s.email, s.name, s.items, s.subtotal, s.consent,
             s.created_at, s.updated_at, s.recovered_order_id, s.reminded_at, s.unsubscribed_at,
             (st.status = 'active') as store_active,
             true as enabled,
             exists (
               select 1 from public.checkout_sessions o
                where o.store_id = s.store_id and o.email = s.email and o.id <> s.id
                  and o.reminded_at > now() - interval '7 days'
             ) as recently_reminded
        from public.checkout_sessions s
        join public.stores st on st.id = s.store_id
       where s.consent
         and s.recovered_order_id is null
         and s.reminded_at is null
         and s.unsubscribed_at is null
         and s.updated_at <= now() - interval '3 hours'
         and s.updated_at > now() - interval '48 hours'
         and private.checkout_reminders_on(s.store_id)
       order by s.updated_at
       limit greatest(1, least(coalesce(p_limit, 300), 1000))
    ) c;
  return v_out;
end;
$$;

create or replace function public.purge_checkout_sessions()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  delete from public.checkout_sessions
   where (unsubscribed_at is null and updated_at < now() - interval '30 days')
      or (unsubscribed_at is not null and unsubscribed_at < now() - interval '365 days');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.abandoned_checkout_candidates(int) from public, anon, authenticated;
grant execute on function public.abandoned_checkout_candidates(int) to service_role;
revoke execute on function public.purge_checkout_sessions() from public, anon, authenticated;
grant execute on function public.purge_checkout_sessions() to service_role;

-- Versión del esquema que espera el código (src/lib/version.ts → SCHEMA_VERSION).
-- `greatest`: aplicarla fuera de orden no baja la versión.
insert into public.app_meta (key, value) values ('schema_version', '11'::jsonb)
  on conflict (key) do update
     set value = to_jsonb(greatest(coalesce((public.app_meta.value #>> '{}')::int, 0), 11)),
         updated_at = now();
