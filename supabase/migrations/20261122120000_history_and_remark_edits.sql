-- Landschaft CRM — change history, and foremen editing their own remarks.
--
--   change_log   one row for every record created, changed or deleted in any
--                collection, with who did it and, for a change, each field's
--                value before and after. Written only by the triggers below, so
--                nobody can edit or remove an entry from the app. Read from
--                Settings → History by a Super Admin, the CEO, or anyone who can
--                edit Settings.
--
-- Read markers (chat_reads) are left out: they change every time someone opens
-- a thread and say nothing about the work. Long embedded images ("data:…") are
-- stored as "[image]" so the log stays small.

-- ---------------------------------------------------------------- remarks

-- Office staff already update any row; a foreman may now change his own remarks.
create policy "foreman edit own remarks" on public.project_messages for update to authenticated
  using ((select app.is_foreman()) and data ->> 'authorId' = (select app.employee_id()))
  with check ((select app.is_foreman()) and data ->> 'authorId' = (select app.employee_id()));

-- ---------------------------------------------------------------- history

create table public.change_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  collection text not null,
  record_id text not null,
  op text not null check (op in ('create', 'update', 'delete')),
  -- The employee who made the change; null for the system (Edge Functions, migrations).
  actor text,
  -- create: the new record; delete: the record as it was; update: {field: {"from": …, "to": …}}.
  changes jsonb not null default '{}'::jsonb
);
create index change_log_at on public.change_log (at desc);
create index change_log_record on public.change_log (collection, record_id, at desc);
create index change_log_actor on public.change_log (actor, at desc);
alter table public.change_log enable row level security;
revoke all on public.change_log from anon, authenticated;
grant select on public.change_log to authenticated;

create policy "history readers" on public.change_log for select to authenticated
  using ((select app.is_top()) or (select app.can('Settings', 'edit')));

-- Embedded images are replaced by a marker; everything else is kept as it is.
create function app.log_trim(value jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when value is null then null
    else regexp_replace(value::text, '"data:[^"]{200,}"', '"[image]"', 'g')::jsonb end
$$;

create function app.record_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  diff jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.change_log (collection, record_id, op, actor, changes)
    values (tg_table_name, new.id, 'create', app.employee_id(), app.log_trim(new.data));
  elsif tg_op = 'DELETE' then
    insert into public.change_log (collection, record_id, op, actor, changes)
    values (tg_table_name, old.id, 'delete', app.employee_id(), app.log_trim(old.data));
  else
    select coalesce(jsonb_object_agg(k, jsonb_build_object('from', old.data -> k, 'to', new.data -> k)), '{}'::jsonb)
      into diff
    from (select jsonb_object_keys(old.data) as k union select jsonb_object_keys(new.data)) keys
    where (old.data -> k) is distinct from (new.data -> k);
    -- A save that changed nothing is not history.
    if diff = '{}'::jsonb then return null; end if;
    insert into public.change_log (collection, record_id, op, actor, changes)
    values (tg_table_name, new.id, 'update', app.employee_id(), app.log_trim(diff));
  end if;
  return null;
end;
$$;

do $$
declare
  t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'data' and c.data_type = 'jsonb'
      and tb.table_type = 'BASE TABLE'
      and c.table_name not in ('chat_reads', 'change_log')
  loop
    execute format('create trigger record_change after insert or update or delete on public.%I for each row execute function app.record_change()', t);
  end loop;
end;
$$;
