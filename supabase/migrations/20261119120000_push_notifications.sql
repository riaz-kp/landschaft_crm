-- Push notifications: reminders, site visits and consultations in the device's
-- notification panel (see supabase/functions/push).
--
--   push_subscriptions  one row per browser or installed app that turned
--                       notifications on, linked to the employee signed in there.
--                       Written only through push_subscribe / push_unsubscribe.
--   push_sent           what has gone to whom, so nothing is sent twice.
--   Vault               the key pair push services check our messages against
--                       (made by the push function on first use), the secret
--                       pg_cron calls it with, and the project URL.
--   pg_cron             calls the push function every minute.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------- devices

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  employee_id text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_id on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create table public.push_sent (
  key text primary key,
  sent_at timestamptz not null default now()
);
create index push_sent_sent_at on public.push_sent (sent_at);
alter table public.push_sent enable row level security;
revoke all on public.push_sent from anon, authenticated;

-- This device now notifies the employee signed in on it. A shared computer
-- moves to whoever turned notifications on last.
create function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me text := app.employee_id();
begin
  if me is null then
    raise exception 'Sign in to turn on notifications.' using errcode = '42501';
  end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1024
     or coalesce(length(p_p256dh), 0) not between 80 and 120 or coalesce(length(p_auth), 0) not between 16 and 40 then
    raise exception 'That is not a push subscription.' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, employee_id, p256dh, auth, user_agent)
  values (p_endpoint, auth.uid(), me, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update set
    user_id = excluded.user_id, employee_id = excluded.employee_id, p256dh = excluded.p256dh,
    auth = excluded.auth, user_agent = excluded.user_agent, updated_at = now();
end;
$$;

-- Stops notifications to this device (turned off, or signing out).
create function public.push_unsubscribe(p_endpoint text)
returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;

-- What browsers subscribe with. Null until the push function has run once.
create function public.push_public_key()
returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_public' and app.is_staff()
$$;

revoke all on function public.push_subscribe(text, text, text, text) from public, anon;
revoke all on function public.push_unsubscribe(text) from public, anon;
revoke all on function public.push_public_key() from public, anon;
grant execute on function public.push_subscribe(text, text, text, text) to authenticated;
grant execute on function public.push_unsubscribe(text) to authenticated;
grant execute on function public.push_public_key() to authenticated;

-- ---------------------------------------------------------------- the push function's secrets

create function public.push_config()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
  from vault.decrypted_secrets
  where name in ('push_vapid_public', 'push_vapid_private', 'push_cron_secret')
$$;

-- Keeps the key pair the push function made, unless another run kept one first.
create function public.push_init(p_public text, p_private text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_vapid_private') then
    perform vault.create_secret(p_public, 'push_vapid_public', 'Web Push (VAPID) public key');
    perform vault.create_secret(p_private, 'push_vapid_private', 'Web Push (VAPID) private key');
  end if;
  return public.push_config();
exception when unique_violation then
  return public.push_config();
end;
$$;

revoke all on function public.push_config() from public, anon, authenticated;
revoke all on function public.push_init(text, text) from public, anon, authenticated;
grant execute on function public.push_config() to service_role;
grant execute on function public.push_init(text, text) to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_cron_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'push_cron_secret',
      'Sent by pg_cron to the push function');
  end if;
  if not exists (select 1 from vault.secrets where name = 'project_url') then
    perform vault.create_secret('https://crcnhsvloczzaqjjouky.supabase.co', 'project_url', 'This Supabase project''s URL');
  end if;
end;
$$;

-- ---------------------------------------------------------------- every minute

select cron.schedule('push-due', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := '{"action":"run"}'::jsonb,
    timeout_milliseconds := 25000
  )
$job$);

-- pg_cron logs every run; keep three days of it.
select cron.schedule('push-cron-log-cleanup', '17 3 * * *', $job$
  delete from cron.job_run_details where end_time < now() - interval '3 days'
$job$);
