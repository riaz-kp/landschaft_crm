-- The materials library: materials added by hand from the Materials page,
-- with the projects they are used on. (The page also lists every item found
-- on a BOQ or quotation; those stay in the quotations table.)
--
-- Same shape and access as the other office collections: one jsonb record per
-- row, read and written by office staff, not by foremen or the anon role.

create table public.materials (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.materials enable row level security;
create trigger stamp before update on public.materials for each row execute function app.stamp();
create index materials_created_at on public.materials (created_at);
alter publication supabase_realtime add table public.materials;
revoke all on public.materials from anon;

create policy "office read" on public.materials for select to authenticated using ((select app.is_office()));
create policy "office insert" on public.materials for insert to authenticated with check ((select app.is_office()));
create policy "office update" on public.materials for update to authenticated
  using ((select app.is_office())) with check ((select app.is_office()));
create policy "office delete" on public.materials for delete to authenticated using ((select app.is_office()));
