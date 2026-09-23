-- =====================================================================
-- 0013 · Presets nuevos del tema (botica, recreo, lapacho, galpon, bodega)
--
-- create_store() mapea el rubro del alta (`p_kind`) al preset inicial del
-- tema. Se suman cinco rubros, espejo de src/lib/tenant/kinds.ts:
--   farmacia → botica · libreria → recreo · muebles → lapacho
--   mayorista → galpon · gourmet → bodega
-- `kind` no tiene enum ni check en la DB (va en stores.onboarding jsonb), así
-- que no hay constraint que ampliar. Cuerpo idéntico al de 0011 salvo el
-- `case`. CREATE OR REPLACE conserva owner y grants (execute sólo para
-- authenticated, ver 0011 §grants), igual se reafirman abajo.
--
-- Orden de deploy: primero la app (que ya conoce los presets), después esta
-- migración. Si corre antes, parseTheme() cae a DEFAULT_THEME (nordico) para
-- las tiendas nuevas de esos rubros: no rompe, sólo pierde el estilo.
-- =====================================================================

create or replace function public.create_store(
  p_name text,
  p_slug text,
  p_kind text default 'otro',
  p_whatsapp text default null,
  p_options jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_wa text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  v_opt jsonb := coalesce(p_options, '{}'::jsonb);
  v_tr jsonb := coalesce(p_options -> 'transfer', '{}'::jsonb);
  v_preset text;
  v_currency text := upper(coalesce(nullif(p_options ->> 'currency', ''), 'ARS'));
  v_address text;
  v_store uuid;
  v_transfer_on boolean := coalesce((p_options ->> 'transfer_enabled')::boolean, true);
  v_wa_on boolean := coalesce((p_options ->> 'whatsapp_enabled')::boolean, true);
  v_discount numeric := least(greatest(coalesce((v_tr ->> 'discount_percent')::numeric, 10), 0), 50);
  v_home jsonb;
begin
  if v_uid is null then
    raise exception 'Iniciá sesión para crear una tienda';
  end if;
  if length(v_name) < 2 or length(v_name) > 60 then
    raise exception 'Ingresá un nombre de 2 a 60 caracteres';
  end if;
  if not public.check_store_slug(v_slug) then
    raise exception 'Esa dirección no está disponible';
  end if;
  if v_currency not in ('ARS', 'USD', 'UYU', 'CLP') then
    v_currency := 'ARS';
  end if;
  if not v_transfer_on and not v_wa_on then
    raise exception 'Elegí al menos una forma de cobro';
  end if;

  perform pg_advisory_xact_lock(hashtext('ecommy.create_store.' || v_uid::text));
  if not public.is_platform_admin() and (
    select count(*) from public.stores where owner_id = v_uid and status <> 'deleted'
  ) >= 3 then
    raise exception 'Llegaste al máximo de 3 tiendas por cuenta';
  end if;

  v_preset := case p_kind
    when 'moda' then 'atelier'
    when 'artesanias' then 'mercado'
    when 'tecnologia' then 'nordico'
    when 'marca' then 'editorial'
    when 'gaming' then 'neon'
    when 'farmacia' then 'botica'
    when 'libreria' then 'recreo'
    when 'muebles' then 'lapacho'
    when 'mayorista' then 'galpon'
    when 'gourmet' then 'bodega'
    else 'nordico'
  end;
  v_address := nullif(concat_ws(', ', nullif(trim(coalesce(p_options ->> 'city', '')), ''),
                                      nullif(trim(coalesce(p_options ->> 'province', '')), '')), '');

  insert into public.stores (slug, name, owner_id, onboarding)
  values (v_slug, v_name, v_uid, jsonb_build_object('kind', coalesce(p_kind, 'otro')))
  returning id into v_store;

  insert into public.store_members (store_id, user_id, role, is_active)
  values (v_store, v_uid, 'owner', true);

  insert into public.store_settings (
    store_id, name, tagline, whatsapp_phone, address, currency, locale, timezone, social, seo, announcement,
    theme, checkout, inventory_policy, low_stock_threshold, policies, header, footer, maintenance
  ) values (
    v_store, v_name, null, v_wa, v_address, v_currency, 'es-AR', 'America/Argentina/Buenos_Aires',
    '{"instagram": "", "facebook": "", "tiktok": "", "x": "", "youtube": ""}',
    jsonb_build_object('title', v_name, 'description', '', 'og_image_url', ''),
    case when v_transfer_on and v_discount > 0 then
      jsonb_build_object('enabled', true, 'text', format('%s %% de descuento pagando por transferencia', trim(trailing '.' from to_char(v_discount, 'FM990.##'))),
                         'href', '/productos', 'bg', '', 'fg', '')
    else '{"enabled": false, "text": "", "href": "", "bg": "", "fg": ""}'::jsonb end,
    jsonb_build_object('preset', v_preset),
    jsonb_build_object(
      'transfer', jsonb_build_object(
        'enabled', v_transfer_on,
        'discount_percent', v_discount,
        'bank_name', coalesce(v_tr ->> 'bank_name', ''),
        'holder', coalesce(v_tr ->> 'holder', ''),
        'cbu', coalesce(v_tr ->> 'cbu', ''),
        'alias', coalesce(v_tr ->> 'alias', ''),
        'cuit', coalesce(v_tr ->> 'cuit', ''),
        'instructions_md', 'Transferí el total indicado y envianos el comprobante por WhatsApp con el número de pedido.'
      ),
      'whatsapp', jsonb_build_object(
        'enabled', v_wa_on,
        'message_template', E'Hola! Hice el pedido #{number} en {store}.\n\n{items}\n\nTotal: {total}\n{delivery}\n\nNombre: {name}'
      ),
      'require_phone', true,
      'require_address_for_pickup', false,
      'order_notes_enabled', true,
      'min_order_total', 0,
      'reservation_hours', 48
    ),
    'on_order', 5,
    '{"shipping_md": "", "returns_md": "", "privacy_md": "", "terms_md": ""}',
    '{}', '{}',
    '{"enabled": false, "message": "Estamos haciendo mejoras. Volvemos en un rato."}'
  );

  insert into public.payment_methods (store_id, code, name, type, discount_percent, instructions_md, is_active, position) values
    (v_store, 'transfer', 'Transferencia bancaria', 'transfer', v_discount,
     'Transferí el total a la cuenta indicada y envianos el comprobante por WhatsApp.', v_transfer_on, 0),
    (v_store, 'whatsapp', 'Acordar con el vendedor', 'whatsapp', 0,
     'Te contactamos por WhatsApp para coordinar el pago y la entrega.', v_wa_on, 1);

  insert into public.menus (store_id, handle, items) values
    (v_store, 'header', '[
      {"label": "Inicio", "href": "/", "children": []},
      {"label": "Productos", "href": "/productos", "children": []},
      {"label": "Cómo comprar", "href": "/#como-comprar", "children": []}
    ]'),
    (v_store, 'footer', '[
      {"label": "Tienda", "href": "/productos", "children": [
        {"label": "Todos los productos", "href": "/productos", "children": []},
        {"label": "Carrito", "href": "/carrito", "children": []}
      ]},
      {"label": "Ayuda", "href": "/#como-comprar", "children": [
        {"label": "Cómo comprar", "href": "/#como-comprar", "children": []}
      ]}
    ]');

  v_home := jsonb_build_array(
    jsonb_build_object(
      'id', 'home-hero', 'type', 'hero',
      'style', jsonb_build_object('background', 'default', 'paddingY', 'none', 'container', 'full'),
      'settings', jsonb_build_object(
        'title', v_name,
        'subtitle', case when v_transfer_on and v_discount > 0
                         then format('Comprá online y pagá por transferencia con %s %% de descuento.', trim(trailing '.' from to_char(v_discount, 'FM990.##')))
                         else 'Comprá online y coordinamos el pago y la entrega por WhatsApp.' end,
        'imageUrl', '', 'overlay', 0, 'align', 'left', 'height', 'md',
        'cta', jsonb_build_object('label', 'Ver productos', 'href', '/productos'),
        'cta2', jsonb_build_object('label', 'Cómo comprar', 'href', '#como-comprar')
      )
    ),
    jsonb_build_object(
      'id', 'home-newest', 'type', 'product_slider',
      'style', jsonb_build_object('background', 'default', 'paddingY', 'md', 'container', 'normal'),
      'settings', jsonb_build_object(
        'title', 'Recién llegados', 'subtitle', 'Lo último que sumamos.',
        'source', jsonb_build_object('kind', 'newest', 'limit', 12),
        'viewAllHref', '/productos', 'cardsPerView', 4
      )
    ),
    jsonb_build_object(
      'id', 'home-features', 'type', 'features',
      'style', jsonb_build_object('background', 'surface', 'paddingY', 'md', 'container', 'normal'),
      'settings', jsonb_build_object(
        'columns', 3,
        'items', jsonb_build_array(
          jsonb_build_object('icon', 'Truck', 'title', 'Envíos', 'text', 'Coordinamos la entrega o retirás sin cargo.'),
          jsonb_build_object('icon', 'Landmark', 'title', 'Transferencia', 'text', 'Pagá por transferencia y ahorrá.'),
          jsonb_build_object('icon', 'MessageCircle', 'title', 'Atención directa', 'text', 'Te respondemos por WhatsApp.')
        )
      )
    ),
    jsonb_build_object(
      'id', 'home-como-comprar', 'type', 'rich_text',
      'style', jsonb_build_object('background', 'default', 'paddingY', 'lg', 'container', 'normal'),
      'settings', jsonb_build_object(
        'align', 'left', 'maxWidth', 'narrow',
        'html', '<h2 id="como-comprar">Cómo comprar</h2><ol><li><strong>Armá tu carrito</strong> con los productos que quieras.</li><li><strong>Elegí cómo pagar</strong> y cómo recibir tu pedido.</li><li><strong>Confirmá</strong>: el pedido queda registrado y te mostramos los pasos para completar el pago.</li></ol><p>¿Dudas? Escribinos por WhatsApp.</p>'
      )
    )
  );

  insert into public.pages (store_id, title, slug, type, status, blocks, seo, published_at, show_in_menu)
  values (v_store, 'Inicio', 'home', 'home', 'published', v_home, '{"title": "", "description": ""}', now(), false);

  insert into public.subscriptions (store_id, plan_code, status, trial_ends_at, current_period_start, provider)
  values (v_store, 'pro', 'trialing', now() + interval '14 days', now(), 'manual');

  return v_store;
end;
$$;

revoke execute on function public.create_store(text, text, text, text, jsonb) from public, anon;
grant execute on function public.create_store(text, text, text, text, jsonb) to authenticated;
