-- Landschaft CRM — usernames for staff logins, and the client portal.
--
-- * Staff sign in with a username. Auth still keys a login by email, so the
--   staff-accounts function gives each username an address on a domain that
--   never receives mail; the username itself is kept here. Logins made before
--   this have none until an admin sets one, and sign in with their email.
-- * Clients fill in the landscape requirement checklist through a link, with
--   no login. The client-portal Edge Function (service role) writes their
--   answers to client_briefs, one row per project; the office reads them.
--   The AMC report link reads maintenance and projects through the same
--   function, so neither table is opened to the anon role.

alter table public.app_users
  add column username text unique
  constraint username_format check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');

create table public.client_briefs (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.client_briefs enable row level security;
create trigger stamp before update on public.client_briefs for each row execute function app.stamp();
create index client_briefs_created_at on public.client_briefs (created_at);
alter publication supabase_realtime add table public.client_briefs;
revoke all on public.client_briefs from anon;

create policy "office read" on public.client_briefs for select to authenticated using ((select app.is_office()));
create policy "office insert" on public.client_briefs for insert to authenticated with check ((select app.is_office()));
create policy "office update" on public.client_briefs for update to authenticated
  using ((select app.is_office())) with check ((select app.is_office()));
create policy "office delete" on public.client_briefs for delete to authenticated using ((select app.is_office()));
