-- Landschaft CRM — Settings → History gets its own permission.
--
-- History is now a module in the permission matrix (Settings → Roles &
-- Permissions → History → View), so it is given role by role rather than
-- following Settings. The matrix saved before then has no History row: the
-- CEO and Super Admin start with it, as with every module; the other roles without it.
-- The Super Admin always holds everything (app.can).

update public.settings
set data = jsonb_set(
  data, '{permissions}',
  (
    select coalesce(jsonb_object_agg(
      role,
      case when rows ? 'History' then rows
        else rows || jsonb_build_object('History', jsonb_build_object(
          'view', role in ('ceo', 'super_admin'), 'create', false, 'edit', false, 'delete', false))
      end
    ), '{}'::jsonb)
    from jsonb_each(data -> 'permissions') as p(role, rows)
  )
)
where id = 'main' and data ? 'permissions';

drop policy "history readers" on public.change_log;
create policy "history readers" on public.change_log for select to authenticated
  using ((select app.can('History', 'view')));
