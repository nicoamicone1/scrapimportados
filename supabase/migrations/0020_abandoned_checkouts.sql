-- =====================================================================
-- 0020 · Recuperación de carritos abandonados
--
-- Idempotente (`if not exists`, `create or replace`, `drop … if exists`).
-- Requiere 0015 (suscripciones con `provider`): la frena con un error claro
-- si falta.
--
-- 1. Tablas
--    · checkout_sessions: el carrito de quien llegó al checkout, dejó su
--      email en "Tus datos" y TILDÓ "Avisame por mail si dejo el pedido sin
--      terminar" (el tilde nace desmarcado: sin consentimiento no se guarda
--      nada). `token` (48 hex, 192 bits, lo genera la base) es el secreto de
--      los links del mail: restaurar el carrito y darse de baja. Nombre y
--      precio de cada ítem salen de la base, nunca del navegador.
--      Destildar (o vaciar el carrito, o cambiar de email) BORRA la sesión,
--      salvo que ya tenga aviso o baja: ahí se vacía (`consent = false`,
--      sin ítems ni nombre) y la fila queda, así quien tiene el token no
--      puede borrar el rastro del aviso ni de la baja.
--    · checkout_unsubscribes: lista de supresión (tienda + email). La escribe
--      SÓLO `checkout_session_unsubscribe` y no la borra nadie (ni la purga):
--      un tercero que conoce un token no puede deshacer la baja de otro.
--    · checkout_session_events: registro de altas ('created', con el hash de
--      IP) y avisos ('reminded'). Lo escriben las RPC; el visitante no lo
--      puede tocar. De acá salen los cupos (por email, IP y tienda) y la regla
--      "un aviso por email y tienda cada 7 días". Se purga a los 30 días.
-- 2. RPC públicas (security definer, patrón 0016):
--      · checkout_reminders_enabled(store): ¿la tienda tiene la función
--        prendida (Configuración › Pagos y checkout) y su plan la incluye?
--        El checkout muestra el tilde sólo si es true (y si salen mails).
--      · upsert_checkout_session(): crea o actualiza por token. `p_ip_hash`
--        es obligatorio (HMAC de la action). Cupos al CREAR (con advisory
--        lock por tienda, contados en checkout_session_events): 10 por email
--        y tienda por día, 30 por IP y tienda por día, 500 por tienda por
--        día. Un email en checkout_unsubscribes no se vuelve a guardar.
--      · get_checkout_session(token): tienda e ítems (sin email ni nombre)
--        para reponer el carrito desde el link del mail.
--      · checkout_session_unsubscribe(token, store): anota la baja en
--        checkout_unsubscribes y vacía las sesiones de ese email en la tienda.
--        Con `p_store_id` (el storefront) no hace nada si el token es de otra
--        tienda; sin él (baja en un clic del encabezado del mail) vale el token.
--      · mark_checkout_recovered(token, order_token): al confirmar el pedido
--        (lo llama la app, `create_order` NO cambia). Valida que el pedido
--        exista, sea de la misma tienda y del mismo email.
-- 3. RPC del cron (sólo service_role):
--      · abandoned_checkout_candidates(limit): marca como recuperadas las
--        sesiones cuyo email compró en la tienda después de abrirlas (sin
--        aviso: dentro de la ventana de 48 h; avisadas: hasta 7 días después
--        del aviso) y devuelve las que están para avisar: con consentimiento,
--        sin pedido, sin aviso, sin baja, `updated_at` entre 3 y 48 h atrás,
--        tienda activa con la función habilitada, hasta 200 por tienda y
--        repartidas entre tiendas. La app decide con pickAbandonedNotices().
--      · claim_checkout_reminder(id, at) / release_checkout_reminder(id, at):
--        reclamar la sesión antes de mandar (re-chequea baja y "7 días" con un
--        lock por email y anota el evento 'reminded') y liberarla si Resend
--        no aceptó el mail.
--      · purge_checkout_sessions(): borra sesiones y eventos de más de 30 días.
-- 4. RLS: el equipo de la tienda LEE checkout_sessions (sin `token`). Nadie
--    escribe directo: sólo por RPC. anon/authenticated no tocan las tablas de
--    supresión ni de eventos.
--
-- Plan: `plans.features -> 'marketing.abandoned'`; si la clave no está (plan
-- que nadie editó desde /platform), default de src/lib/plans/features.ts:
-- todos menos Free. El plan efectivo sale de private.store_plan_code(), COPIA
-- de las ramas de public.current_plan() (0015/0019) sin el chequeo de miembro: si
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
-- 1. Tablas
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
  unsubscribed_at timestamptz
);

-- Versiones previas de esta migración (sólo entornos de desarrollo) guardaban
-- el hash de IP en la sesión: ahora vive en checkout_session_events.
drop index if exists public.checkout_sessions_store_ip_idx;
alter table public.checkout_sessions drop column if exists ip_hash;

-- Bandeja del admin.
create index if not exists checkout_sessions_store_created_idx
  on public.checkout_sessions (store_id, created_at desc);
-- Baja por email y auto-recupero.
create index if not exists checkout_sessions_store_email_idx
  on public.checkout_sessions (store_id, email, created_at desc);
-- Candidatas del cron.
create index if not exists checkout_sessions_due_idx
  on public.checkout_sessions (updated_at)
  where consent and recovered_order_id is null and reminded_at is null and unsubscribed_at is null;
-- Auto-recupero de las avisadas y purga.
create index if not exists checkout_sessions_reminded_idx
  on public.checkout_sessions (reminded_at) where reminded_at is not null and recovered_order_id is null;
create index if not exists checkout_sessions_updated_idx
  on public.checkout_sessions (updated_at);

alter table public.checkout_sessions enable row level security;

drop policy if exists "checkout_sessions: admin lee" on public.checkout_sessions;
create policy "checkout_sessions: admin lee" on public.checkout_sessions
  for select to authenticated
  using (store_id = any ((select public.admin_store_ids())::uuid[]) or (select public.is_platform_admin()));

-- Sólo lectura para el equipo y sin el token (restaura el carrito y da de baja
-- en nombre del comprador). Las escrituras son por RPC.
revoke all on public.checkout_sessions from anon;
revoke all on public.checkout_sessions from authenticated;
grant select (
  id, store_id, email, name, items, subtotal, consent, created_at, updated_at,
  recovered_order_id, reminded_at, unsubscribed_at
) on public.checkout_sessions to authenticated;

-- Lista de supresión: la escribe sólo checkout_session_unsubscribe; nadie la borra.
create table if not exists public.checkout_unsubscribes (
  store_id uuid not null references public.stores (id) on delete cascade,
  email_lower text not null check (char_length(email_lower) between 3 and 254 and email_lower = lower(email_lower)),
  created_at timestamptz not null default now(),
  primary key (store_id, email_lower)
);

alter table public.checkout_unsubscribes enable row level security;
revoke all on public.checkout_unsubscribes from anon;
revoke all on public.checkout_unsubscribes from authenticated;

-- Registro de altas y avisos (cupos y "7 días"). Sin FK a la sesión: sobrevive
-- a que la sesión se borre.
create table if not exists public.checkout_session_events (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  email_lower text not null check (char_length(email_lower) between 3 and 254 and email_lower = lower(email_lower)),
  -- HMAC truncado de día + tienda + IP (lo calcula la server action); sólo en 'created'.
  ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{16,64}$'),
  kind text not null check (kind in ('created', 'reminded')),
  session_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists checkout_session_events_email_idx
  on public.checkout_session_events (store_id, email_lower, kind, created_at desc);
create index if not exists checkout_session_events_ip_idx
  on public.checkout_session_events (store_id, ip_hash, created_at desc) where ip_hash is not null;
create index if not exists checkout_session_events_store_idx
  on public.checkout_session_events (store_id, kind, created_at desc);
create index if not exists checkout_session_events_created_idx
  on public.checkout_session_events (created_at);
create index if not exists checkout_session_events_session_idx
  on public.checkout_session_events (session_id) where session_id is not null;

alter table public.checkout_session_events enable row level security;
revoke all on public.checkout_session_events from anon;
revoke all on public.checkout_session_events from authenticated;

-- ---------------------------------------------------------------------
-- 2. ¿La tienda recuerda carritos? (plan + configuración)
-- ---------------------------------------------------------------------

-- Plan efectivo: COPIA de las ramas de public.current_plan() (0015/0019).
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
  -- MercadoPago sin cobro 7 días después del período, salvo un checkout
  -- pendiente (0019: un anual manual que abandonó un checkout de MP no es Free).
  elsif v_sub.provider = 'mercadopago' and v_sub.status in ('active', 'past_due')
        and v_sub.provider_status is distinct from 'pending'
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

-- Cierra una sesión sin pedido: la borra, salvo que ya tenga aviso o baja
-- (ahí la vacía y la deja, para que quien tiene el token no borre ese rastro).
create or replace function private.close_checkout_session(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.checkout_sessions
   where id = p_id and recovered_order_id is null and reminded_at is null and unsubscribed_at is null;
  if not found then
    update public.checkout_sessions
       set consent = false, items = '[]'::jsonb, subtotal = 0, name = null, updated_at = now()
     where id = p_id and recovered_order_id is null;
  end if;
end;
$$;

revoke execute on function private.close_checkout_session(uuid) from public, anon, authenticated;

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
  v_ip text := lower(trim(coalesce(p_ip_hash, '')));
  v_row public.checkout_sessions;
  v_found boolean := false;
  v_items jsonb := '[]'::jsonb;
  v_subtotal numeric(12, 2) := 0;
  v_email_day int;
  v_ip_day int;
  v_store_day int;
  v_new_id uuid;
  v_new_token text;
begin
  if v_token is not null and v_token !~ '^[0-9a-f]{48}$' then
    v_token := null;
  end if;
  -- El hash de IP es obligatorio (la action siempre lo manda): sin él no hay cupo por IP.
  if v_ip !~ '^[0-9a-f]{16,64}$' then
    raise exception 'El carrito tiene datos inválidos.';
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

  -- Sin consentimiento no se guarda nada; si había una sesión abierta, se cierra
  -- (el email no hace falta: alcanza con el token).
  if not coalesce(p_consent, false) then
    if v_found then
      perform private.close_checkout_session(v_row.id);
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
    if v_found then
      perform private.close_checkout_session(v_row.id);
    end if;
    return jsonb_build_object('ok', true, 'token', null, 'saved', false);
  end if;

  -- Email dado de baja en esta tienda: no se vuelve a guardar (ni se actualiza).
  if exists (
    select 1 from public.checkout_unsubscribes u
     where u.store_id = p_store_id and u.email_lower = v_email
  ) then
    if v_found then
      perform private.close_checkout_session(v_row.id);
    end if;
    return jsonb_build_object('ok', true, 'token', null, 'saved', false);
  end if;

  -- La misma sesión (mismo email, sin pedido ni baja): se actualiza. Si ya se
  -- mandó el aviso, `reminded_at` queda: nunca sale un segundo mail por sesión.
  if v_found and v_row.recovered_order_id is null and v_row.unsubscribed_at is null and v_row.email = v_email then
    update public.checkout_sessions
       set items = v_items, subtotal = v_subtotal, name = v_name, consent = true, updated_at = now()
     where id = v_row.id;
    return jsonb_build_object('ok', true, 'token', v_row.token, 'saved', true);
  end if;

  -- Cambió el email (se corrigió un error de tipeo): la sesión vieja se cierra.
  if v_found and v_row.email <> v_email then
    perform private.close_checkout_session(v_row.id);
  end if;

  -- Cupos atómicos por tienda, contados en el registro (que el visitante no puede borrar).
  perform pg_advisory_xact_lock(hashtext('checkout_sessions:' || p_store_id::text));

  select count(*) into v_email_day from public.checkout_session_events
   where store_id = p_store_id and email_lower = v_email and kind = 'created' and created_at > now() - interval '1 day';
  if v_email_day >= 10 then
    raise exception 'Ya guardamos varios carritos con este email hoy.';
  end if;

  select count(*) into v_ip_day from public.checkout_session_events
   where store_id = p_store_id and ip_hash = v_ip and created_at > now() - interval '1 day';
  if v_ip_day >= 30 then
    raise exception 'Ya guardamos varios carritos hoy.';
  end if;

  select count(*) into v_store_day from public.checkout_session_events
   where store_id = p_store_id and kind = 'created' and created_at > now() - interval '1 day';
  if v_store_day >= 500 then
    raise exception 'Hoy no podemos guardar más carritos en esta tienda.';
  end if;

  v_new_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.checkout_sessions (store_id, token, email, name, items, subtotal, consent)
  values (p_store_id, v_new_token, v_email, v_name, v_items, v_subtotal, true)
  returning id into v_new_id;
  insert into public.checkout_session_events (store_id, email_lower, ip_hash, kind, session_id)
  values (p_store_id, v_email, v_ip, 'created', v_new_id);

  return jsonb_build_object('ok', true, 'token', v_new_token, 'saved', true);
end;
$$;

revoke execute on function public.upsert_checkout_session(uuid, text, text, text, jsonb, boolean, text) from public;
grant execute on function public.upsert_checkout_session(uuid, text, text, text, jsonb, boolean, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Restaurar, dar de baja y marcar recuperada (públicas, por token)
-- ---------------------------------------------------------------------

-- Sin email ni nombre: quien tiene el link sólo ve lo que había en el carrito.
create or replace function public.get_checkout_session(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'store_id', s.store_id,
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

-- La firma cambió (se agregó p_store_id): sin esto quedaría una sobrecarga ambigua.
drop function if exists public.checkout_session_unsubscribe(text);

create or replace function public.checkout_session_unsubscribe(p_token text, p_store_id uuid default null)
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
  if not found or (p_store_id is not null and p_store_id <> v_store) then
    return jsonb_build_object('ok', false);
  end if;
  -- La baja queda en la lista de supresión (nadie la borra) …
  insert into public.checkout_unsubscribes (store_id, email_lower) values (v_store, v_email)
    on conflict (store_id, email_lower) do nothing;
  -- … y TODAS las sesiones de ese email en la tienda se marcan; sin pedido, se borran ítems y nombre.
  update public.checkout_sessions
     set unsubscribed_at = coalesce(unsubscribed_at, now()),
         items = case when recovered_order_id is null then '[]'::jsonb else items end,
         subtotal = case when recovered_order_id is null then 0 else subtotal end,
         name = case when recovered_order_id is null then null else name end
   where store_id = v_store and email = v_email;
  return jsonb_build_object('ok', true, 'store_id', v_store);
end;
$$;

revoke execute on function public.checkout_session_unsubscribe(text, uuid) from public;
grant execute on function public.checkout_session_unsubscribe(text, uuid) to anon, authenticated;

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
  -- Compró igual (otro dispositivo, la marca de la app no llegó o volvió por el
  -- mail y destildó): recuperada. Pedido del mismo email y tienda desde que se
  -- abrió la sesión; si ya se avisó, hasta 7 días después del aviso.
  update public.checkout_sessions s
     set recovered_order_id = (
           select o.id from public.orders o
            where o.store_id = s.store_id
              and lower(o.customer ->> 'email') = s.email
              and o.created_at >= s.created_at
              and (s.reminded_at is null or o.created_at <= s.reminded_at + interval '7 days')
            order by o.created_at
            limit 1
         )
   where s.recovered_order_id is null
     and (
       (s.reminded_at is null and s.consent and s.unsubscribed_at is null and s.updated_at > now() - interval '48 hours')
       or s.reminded_at > now() - interval '8 days'
     )
     and exists (
       select 1 from public.orders o
        where o.store_id = s.store_id
          and lower(o.customer ->> 'email') = s.email
          and o.created_at >= s.created_at
          and (s.reminded_at is null or o.created_at <= s.reminded_at + interval '7 days')
     );

  -- Hasta 200 por tienda y repartidas entre tiendas (la primera de cada una,
  -- después la segunda…): una tienda con muchos carritos no tapa a las demás.
  select coalesce(jsonb_agg(to_jsonb(c) - 'rn' order by c.rn, c.updated_at), '[]'::jsonb) into v_out
    from (
      select *
        from (
          select s.id, s.store_id, s.token, s.email, s.name, s.items, s.subtotal, s.consent,
                 s.created_at, s.updated_at, s.recovered_order_id, s.reminded_at, s.unsubscribed_at,
                 (st.status = 'active') as store_active,
                 coalesce(sub.status = 'trialing', false) as store_trialing,
                 true as enabled,
                 exists (
                   select 1 from public.checkout_session_events e
                    where e.store_id = s.store_id and e.email_lower = s.email and e.kind = 'reminded'
                      and e.created_at > now() - interval '7 days'
                 ) as recently_reminded,
                 row_number() over (partition by s.store_id order by s.updated_at, s.id) as rn
            from public.checkout_sessions s
            join public.stores st on st.id = s.store_id
            left join public.subscriptions sub on sub.store_id = s.store_id
           where s.consent
             and s.recovered_order_id is null
             and s.reminded_at is null
             and s.unsubscribed_at is null
             and s.updated_at <= now() - interval '3 hours'
             and s.updated_at > now() - interval '48 hours'
             and not exists (
               select 1 from public.checkout_unsubscribes u
                where u.store_id = s.store_id and u.email_lower = s.email
             )
             and private.checkout_reminders_on(s.store_id)
        ) ranked
       where ranked.rn <= 200
       order by ranked.rn, ranked.updated_at
       limit greatest(1, least(coalesce(p_limit, 300), 1000))
    ) c;
  return v_out;
end;
$$;

-- Reclama la sesión antes de mandar: re-chequea (con lock por email y tienda)
-- la baja y el "un aviso cada 7 días", fija `reminded_at` y anota el evento.
create or replace function public.claim_checkout_reminder(p_id uuid, p_at timestamptz default now())
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store uuid;
  v_email text;
  v_at timestamptz := coalesce(p_at, now());
begin
  select store_id, email into v_store, v_email from public.checkout_sessions where id = p_id;
  if not found then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext('checkout_reminder:' || v_store::text || ':' || v_email));
  if exists (select 1 from public.checkout_unsubscribes u where u.store_id = v_store and u.email_lower = v_email) then
    return false;
  end if;
  if exists (
    select 1 from public.checkout_session_events e
     where e.store_id = v_store and e.email_lower = v_email and e.kind = 'reminded'
       and e.created_at > now() - interval '7 days'
  ) then
    return false;
  end if;
  update public.checkout_sessions
     set reminded_at = v_at
   where id = p_id
     and consent
     and reminded_at is null
     and recovered_order_id is null
     and unsubscribed_at is null
     and jsonb_array_length(items) > 0;
  if not found then
    return false;
  end if;
  insert into public.checkout_session_events (store_id, email_lower, kind, session_id, created_at)
  values (v_store, v_email, 'reminded', p_id, v_at);
  return true;
end;
$$;

-- Resend no aceptó el mail: la sesión vuelve a quedar pendiente y el aviso no cuenta.
create or replace function public.release_checkout_reminder(p_id uuid, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.checkout_sessions set reminded_at = null where id = p_id and reminded_at = p_at;
  delete from public.checkout_session_events where session_id = p_id and kind = 'reminded' and created_at = p_at;
end;
$$;

-- Sesiones y eventos de más de 30 días. La lista de supresión no se purga.
create or replace function public.purge_checkout_sessions()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  delete from public.checkout_sessions where updated_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  delete from public.checkout_session_events where created_at < now() - interval '30 days';
  return v_count;
end;
$$;

revoke execute on function public.abandoned_checkout_candidates(int) from public, anon, authenticated;
grant execute on function public.abandoned_checkout_candidates(int) to service_role;
revoke execute on function public.claim_checkout_reminder(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_checkout_reminder(uuid, timestamptz) to service_role;
revoke execute on function public.release_checkout_reminder(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.release_checkout_reminder(uuid, timestamptz) to service_role;
revoke execute on function public.purge_checkout_sessions() from public, anon, authenticated;
grant execute on function public.purge_checkout_sessions() to service_role;

-- Versión del esquema que espera el código (src/lib/version.ts → SCHEMA_VERSION).
-- `greatest`: aplicarla fuera de orden no baja la versión.
insert into public.app_meta (key, value) values ('schema_version', '11'::jsonb)
  on conflict (key) do update
     set value = to_jsonb(greatest(coalesce((public.app_meta.value #>> '{}')::int, 0), 11)),
         updated_at = now();
