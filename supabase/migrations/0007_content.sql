-- =====================================================================
-- 0007 · Contenido (agente E): borradores de páginas publicadas
-- =====================================================================
-- Una página publicada se puede seguir editando sin tocar lo que ve el
-- público: el editor guarda el borrador acá y "Publicar" lo copia a
-- `pages` (y borra el borrador). Tabla aparte (y no una columna en `pages`)
-- para que `anon` —que puede leer las páginas publicadas— nunca vea
-- contenido sin publicar.

create table if not exists public.page_drafts (
  page_id uuid primary key references public.pages (id) on delete cascade,
  -- { title, slug, show_in_menu, seo, blocks }
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.page_drafts enable row level security;

create policy "page_drafts: admin lee" on public.page_drafts
  for select to authenticated using ((select public.is_admin()));
create policy "page_drafts: admin inserta" on public.page_drafts
  for insert to authenticated with check ((select public.is_admin()));
create policy "page_drafts: admin modifica" on public.page_drafts
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "page_drafts: admin borra" on public.page_drafts
  for delete to authenticated using ((select public.is_admin()));

revoke all on public.page_drafts from anon;
grant select, insert, update, delete on public.page_drafts to authenticated;

create index if not exists page_drafts_updated_by_idx on public.page_drafts (updated_by);
