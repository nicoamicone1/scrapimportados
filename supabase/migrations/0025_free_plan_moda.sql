-- =====================================================================
-- 0025 · Free más chico: 25 productos, remitos y Responder desde Starter
--        Decisión: docs/gtm/PLAN-GTM.md §7 (Oferta) y §11 (Conversión).
--        Con 50 productos y variantes, una marca de ropa chica vivía
--        gratis para siempre.
--
-- Idempotente: sólo `update` con valores fijos y `||` sobre el jsonb
-- (correrla dos veces deja lo mismo).
--
-- 1. plans 'free': limits.products = 25 (era 50), features.orders.print =
--    false (remitos desde Starter) y features.orders.replies = false
--    (Responder desde Starter). Pisa lo que tenga la fila free: es la
--    decisión de plan, no un default. Si después querés otro número,
--    cambialo en /platform/planes.
-- 2. plans 'starter', 'pro', 'business': features.orders.replies = true,
--    sólo si la clave no está (no pisa una edición hecha desde /platform).
-- 3. schema_version = 16 (con greatest).
--
-- Espejo en código: PLAN_DEFAULTS de src/lib/plans/features.ts. Lo que
-- excede Free no se borra ni se oculta: los productos cargados siguen a la
-- venta y lo que pasa el tope queda bloqueado para crear (assertUsage).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Free
-- ---------------------------------------------------------------------
update public.plans
   set limits = coalesce(limits, '{}'::jsonb) || '{"products":25}'::jsonb,
       features = coalesce(features, '{}'::jsonb) || '{"orders.print":false,"orders.replies":false}'::jsonb
 where code = 'free';

-- ---------------------------------------------------------------------
-- 2. Responder en los planes pagos
-- ---------------------------------------------------------------------
update public.plans
   set features = coalesce(features, '{}'::jsonb) || '{"orders.replies":true}'::jsonb
 where code in ('starter', 'pro', 'business')
   and not (coalesce(features, '{}'::jsonb) ? 'orders.replies');

-- ---------------------------------------------------------------------
-- 3. schema_version = 16 (`greatest`: aplicarla fuera de orden no baja la versión)
-- ---------------------------------------------------------------------
insert into public.app_meta (key, value) values ('schema_version', '16'::jsonb)
  on conflict (key) do update
     set value = to_jsonb(greatest(coalesce((public.app_meta.value #>> '{}')::int, 0), 16)),
         updated_at = now();
