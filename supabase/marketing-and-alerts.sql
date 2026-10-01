-- Square Peg Connect — campaign archive, seasonal prompt memory, staff photo email alerts
-- Run once in Supabase → SQL Editor. Safe to run again.
begin;

-- 1) Archive for marketing campaigns
alter table public.marketing_campaigns add column if not exists archived_at timestamptz;

-- 2) Custom seasonal prompts (recurring yearly reminders), now able to remember the campaign they came from
create table if not exists public.custom_seasonal_prompts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  month integer not null,   -- 0 = January … 11 = December
  day integer not null,
  created_at timestamptz not null default now()
);
alter table public.custom_seasonal_prompts add column if not exists notes text;
alter table public.custom_seasonal_prompts add column if not exists source_campaign_id uuid;
alter table public.custom_seasonal_prompts enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='custom_seasonal_prompts' loop
    execute format('drop policy %I on public.custom_seasonal_prompts', r.policyname);
  end loop;
end $$;
create policy "Team members: full access" on public.custom_seasonal_prompts
  for all to authenticated using (public.is_team_member()) with check (public.is_team_member());

-- 3) Who gets which email alerts (editable in the app by admins)
create table if not exists public.notification_settings (
  key text primary key,
  recipients text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.notification_settings enable row level security;
drop policy if exists "Admins: notification settings" on public.notification_settings;
create policy "Admins: notification settings" on public.notification_settings
  for all to authenticated using (public.is_team_admin()) with check (public.is_team_admin());
insert into public.notification_settings (key, recipients)
  values ('staff_photos', array['brian@brianhardy.com'])
  on conflict (key) do nothing;

-- 4) Mark each staff photo submission once its alert email is sent (prevents duplicate/spam sends)
alter table public.staff_photo_submissions add column if not exists alert_sent_at timestamptz;

commit;
