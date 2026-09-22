-- =====================================================================
-- 0009 · Importador (agente G)
-- =====================================================================
-- * import_jobs.adapter suma 'csv' (importación desde planilla, P0-04).
-- * import_items: unique (job_id, external_id) para que la fase "fetch"
--   sea idempotente (reintentar una página no duplica ítems).
-- * Índice para buscar productos importados por external_id sin importar
--   el `source` (el importador trata 'import' y 'scrape' como equivalentes
--   y desempata por el host de source_url).
-- La fase del job, el lock y el cursor del adaptador viven en
-- import_jobs.cursor (jsonb); no hacen falta columnas nuevas.
-- =====================================================================

alter table public.import_jobs drop constraint if exists import_jobs_adapter_check;
alter table public.import_jobs
  add constraint import_jobs_adapter_check
  check (adapter in ('woocommerce', 'shopify', 'generic', 'jsonld', 'csv'));

alter table public.import_items drop constraint if exists import_items_job_external_key;
alter table public.import_items
  add constraint import_items_job_external_key unique (job_id, external_id);

create index if not exists products_external_id_idx on public.products (external_id)
  where external_id is not null;
