-- Landschaft CRM — initial schema.
--
-- Every collection the app keeps (projects, tasks, daily reports…) is a table
-- of JSON records: `id` plus the record itself in `data`, exactly as the
-- frontend's domain types describe it (frontend/src/domain/types.ts).
--
-- Access rules:
--   * Nothing is readable without signing in as an employee whose login is
--     linked and active (public.app_users). The anon key on its own sees nothing.
--   * Foremen live in the field app, so they read only the collections it uses
--     and write only their own reports, issues, remarks and profile.
--   * Pay records follow the screens: your own, or everyone's for Accounts and
--     anyone who can edit Employees.
--   * Settings and the fields on an employee that grant access or pay are
--     guarded by triggers, so nobody can hand themselves more rights.

create schema if not exists app;
grant usage on schema app to authenticated;

-- ---------------------------------------------------------------- logins

-- Links a Supabase Auth user to the employee record they sign in as.
-- Written only by the staff-accounts Edge Function (service role).
create table public.app_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  employee_id text not null unique,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.app_users enable row level security;

-- ---------------------------------------------------------------- collections

create function app.stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'employees', 'workers', 'leads', 'clients', 'site_visits', 'projects', 'site_assignments', 'tasks',
    'reports', 'issues', 'quotations', 'payment_requests', 'payments', 'maintenance', 'documents',
    'calendar_events', 'clarifications', 'chat_messages', 'follow_ups', 'consultations', 'attendance',
    'project_messages', 'pay_records', 'reminders', 'project_log', 'chat_reads', 'settings'
  ] loop
    execute format($f$
      create table public.%I (
        id text primary key,
        data jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        updated_by uuid default auth.uid()
      )$f$, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger stamp before update on public.%I for each row execute function app.stamp()', t);
    execute format('create index %I on public.%I (created_at)', t || '_created_at', t);
    execute format('alter publication supabase_realtime add table public.%I', t);
    -- Signed-in staff go through RLS; the anon role gets nothing at all.
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

revoke all on public.app_users from anon;

-- ---------------------------------------------------------------- who is asking

-- The employee the signed-in user is, or null when they have no active login.
create function app.employee_id() returns text
language sql stable security definer set search_path = '' as $$
  select employee_id from public.app_users where user_id = auth.uid() and active
$$;

create function app.role() returns text
language sql stable security definer set search_path = '' as $$
  select e.data ->> 'role' from public.employees e where e.id = app.employee_id()
$$;

create function app.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.role() is not null
$$;

/** Everyone who works in the main CRM, i.e. staff other than foremen. */
create function app.is_office() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.role() <> 'foreman', false)
$$;

create function app.is_foreman() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.role() = 'foreman', false)
$$;

create function app.is_top() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.role() in ('super_admin', 'ceo'), false)
$$;

-- Mirrors hasPermission() in frontend/src/domain/roles.ts: the super admin holds
-- everything, foremen hold no module, and any action needs view as well.
create function app.can(module text, action text) returns boolean
language sql stable security definer set search_path = '' as $$
  with me as (select app.role() as r),
  perm as (
    select s.data -> 'permissions' -> me.r -> module as p
    from me left join public.settings s on s.id = 'main'
  )
  select case
    when me.r = 'super_admin' then true
    when me.r is null or me.r = 'foreman' then false
    else coalesce((perm.p ->> 'view')::boolean, false)
      and (action = 'view' or coalesce((perm.p ->> action)::boolean, false))
  end
  from me, perm
$$;

grant execute on all functions in schema app to authenticated;

-- ---------------------------------------------------------------- policies

-- Collections anyone in the office reads and writes. Foremen read the ones
-- marked here because the field app needs them.
do $$
declare
  t text;
  foreman_reads text[] := array[
    'employees', 'workers', 'projects', 'site_assignments', 'reports', 'issues', 'attendance',
    'project_messages', 'chat_reads', 'settings'
  ];
begin
  foreach t in array array[
    'workers', 'leads', 'clients', 'site_visits', 'projects', 'site_assignments', 'tasks',
    'reports', 'issues', 'quotations', 'payment_requests', 'payments', 'maintenance', 'documents',
    'calendar_events', 'clarifications', 'chat_messages', 'follow_ups', 'consultations', 'attendance',
    'project_messages', 'reminders', 'project_log', 'chat_reads'
  ] loop
    if t = any (foreman_reads) then
      execute format('create policy "staff read" on public.%I for select to authenticated using ((select app.is_staff()))', t);
    else
      execute format('create policy "office read" on public.%I for select to authenticated using ((select app.is_office()))', t);
    end if;
    execute format('create policy "office insert" on public.%I for insert to authenticated with check ((select app.is_office()))', t);
    execute format('create policy "office update" on public.%I for update to authenticated using ((select app.is_office())) with check ((select app.is_office()))', t);
    execute format('create policy "office delete" on public.%I for delete to authenticated using ((select app.is_office()))', t);
  end loop;
end;
$$;

-- What a foreman writes from the field app.
create policy "foreman own reports" on public.reports for insert to authenticated
  with check ((select app.is_foreman()) and data ->> 'foremanId' = (select app.employee_id()));
create policy "foreman edit own reports" on public.reports for update to authenticated
  using ((select app.is_foreman()) and data ->> 'foremanId' = (select app.employee_id()))
  with check ((select app.is_foreman()) and data ->> 'foremanId' = (select app.employee_id()));
create policy "foreman raise issues" on public.issues for insert to authenticated
  with check ((select app.is_foreman()) and data ->> 'raisedBy' = (select app.employee_id()));
create policy "foreman post remarks" on public.project_messages for insert to authenticated
  with check ((select app.is_foreman()) and data ->> 'authorId' = (select app.employee_id()));
create policy "foreman delete own remarks" on public.project_messages for delete to authenticated
  using ((select app.is_foreman()) and data ->> 'authorId' = (select app.employee_id()));
-- Read markers are keyed "employeeId:projectId".
create policy "foreman mark read" on public.chat_reads for insert to authenticated
  with check ((select app.is_foreman()) and split_part(id, ':', 1) = (select app.employee_id()));
create policy "foreman update read" on public.chat_reads for update to authenticated
  using ((select app.is_foreman()) and split_part(id, ':', 1) = (select app.employee_id()))
  with check ((select app.is_foreman()) and split_part(id, ':', 1) = (select app.employee_id()));

-- Employees: everyone sees the directory; the Employees permission manages it,
-- and anyone may edit their own profile (the guard below keeps role and pay fixed).
create policy "staff read" on public.employees for select to authenticated using ((select app.is_staff()));
create policy "manage insert" on public.employees for insert to authenticated
  with check ((select app.can('Employees', 'create')));
create policy "manage or self update" on public.employees for update to authenticated
  using ((select app.can('Employees', 'edit')) or id = (select app.employee_id()))
  with check ((select app.can('Employees', 'edit')) or id = (select app.employee_id()));
create policy "manage delete" on public.employees for delete to authenticated
  using (
    (select app.can('Employees', 'delete'))
    and ((data ->> 'role') not in ('super_admin', 'ceo') or (select app.is_top()))
  );

-- Pay: your own, or everyone's for Accounts and Employees managers — as the screens show it.
create policy "own or pay viewers" on public.pay_records for select to authenticated
  using (
    (select app.can('Accounts', 'view')) or (select app.can('Employees', 'edit'))
    or (data ->> 'kind' = 'employee' and data ->> 'personId' = (select app.employee_id()))
  );
create policy "pay managers insert" on public.pay_records for insert to authenticated
  with check ((select app.can('Accounts', 'create')) or (select app.can('Employees', 'edit')));
create policy "pay managers update" on public.pay_records for update to authenticated
  using ((select app.can('Accounts', 'create')) or (select app.can('Employees', 'edit')))
  with check ((select app.can('Accounts', 'create')) or (select app.can('Employees', 'edit')));
create policy "pay managers delete" on public.pay_records for delete to authenticated
  using ((select app.can('Accounts', 'create')) or (select app.can('Employees', 'edit')));

-- Settings: one row, id 'main'. The office updates it (adding a worker skill or
-- a holiday touches it); the guard below keeps everything else to Settings editors.
create policy "staff read" on public.settings for select to authenticated using ((select app.is_staff()));
create policy "top insert" on public.settings for insert to authenticated
  with check (id = 'main' and ((select app.is_top()) or (select app.can('Settings', 'edit'))));
create policy "office update" on public.settings for update to authenticated
  using ((select app.is_office())) with check (id = 'main' and (select app.is_office()));

create policy "staff read" on public.app_users for select to authenticated using ((select app.is_staff()));

-- ---------------------------------------------------------------- guards

create function app.guard_employee() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  changed boolean;
begin
  -- The service role (Edge Functions, migrations) is not a signed-in employee.
  if auth.uid() is null then return new; end if;

  -- Only the super admin or the CEO hands out, or takes away, the top two roles.
  if not app.is_top() then
    if tg_op = 'INSERT' then
      changed := (new.data ->> 'role') in ('super_admin', 'ceo');
    else
      changed := (old.data ->> 'role') is distinct from (new.data ->> 'role')
        and ((old.data ->> 'role') in ('super_admin', 'ceo') or (new.data ->> 'role') in ('super_admin', 'ceo'));
    end if;
    if coalesce(changed, false) then
      raise exception 'Only a Super Admin or the CEO can give or change that role.' using errcode = '42501';
    end if;
  end if;

  -- Editing your own profile: what sets your access, place and pay stays as it was.
  if tg_op = 'UPDATE' and not app.can('Employees', 'edit') then
    select bool_or((new.data -> k) is distinct from (old.data -> k)) into changed
    from unnest(array['role', 'department', 'designation', 'reportsTo', 'monthlySalary', 'responsibilities', 'joinedOn']) k;
    if changed then
      raise exception 'Your role, department, reporting line and salary are set by an Employees manager.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard before insert or update on public.employees
  for each row execute function app.guard_employee();

create function app.guard_settings() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or app.can('Settings', 'edit') then return new; end if;
  -- Worker skills grow from the worker form and holidays from the attendance register;
  -- everything else in Settings — permissions above all — needs Settings edit.
  if (new.data - 'workerSkills' - 'holidays') is distinct from (old.data - 'workerSkills' - 'holidays') then
    raise exception 'Only someone who can edit Settings can change this.' using errcode = '42501';
  end if;
  if (new.data -> 'holidays') is distinct from (old.data -> 'holidays') and not app.can('Attendance', 'edit') then
    raise exception 'Only someone who can edit Attendance can change holidays.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard before update on public.settings
  for each row execute function app.guard_settings();

-- ---------------------------------------------------------------- files

-- Site photos, profile photos, remark photos and documents. Private: the app
-- shows them through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 52428800)
on conflict (id) do nothing;

create policy "staff read files" on storage.objects for select to authenticated
  using (bucket_id = 'files' and (select app.is_staff()));
create policy "staff upload files" on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and (select app.is_staff()));
create policy "office delete files" on storage.objects for delete to authenticated
  using (bucket_id = 'files' and (select app.is_office()));
