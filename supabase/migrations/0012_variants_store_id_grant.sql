-- =====================================================================
-- 0012 · anon puede leer product_variants.store_id
--
-- 0001 dejó a anon con grants POR COLUMNA en product_variants (para no
-- exponer `cost`). 0011 agregó `store_id` pero no lo sumó a esa lista, así
-- que cualquier query pública que filtre `store_id=eq.…` (getFreshVariants:
-- validar carrito, cupón y create_order) fallaba con 42501 → 401 y el
-- checkout mostraba "Algo salió mal" en todas las tiendas.
-- =====================================================================

grant select (store_id) on public.product_variants to anon;
