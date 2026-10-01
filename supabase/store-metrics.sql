-- Square Peg Connect — Store Metrics (weekly loyalty + AOV numbers per location)
-- Run once in Supabase → SQL Editor. Safe to run again.
-- Admin-only: only Super Admins can read or write these tables.

begin;

-- One row per store per week.
create table if not exists public.store_metrics_weekly (
  id uuid primary key default gen_random_uuid(),
  location_id text not null,
  week_ending date not null,
  loyalty_visits integer not null default 0,
  non_loyalty_visits integer not null default 0,
  new_loyalty_members integer not null default 0,
  loyalty_aov numeric(10,2),
  non_loyalty_aov numeric(10,2),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, week_ending)
);

-- Starting loyalty member total per store (before the first week entered).
-- Total Loyalty Members for any week = starting total + all new members up to that week.
create table if not exists public.store_metrics_baseline (
  location_id text primary key,
  starting_loyalty_members integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Who receives the weekly report (single row, id = 1).
create table if not exists public.store_metrics_settings (
  id integer primary key default 1 check (id = 1),
  recipients text[] not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.store_metrics_settings (id) values (1) on conflict (id) do nothing;

alter table public.store_metrics_weekly   enable row level security;
alter table public.store_metrics_baseline enable row level security;
alter table public.store_metrics_settings enable row level security;

drop policy if exists "Admins: store metrics" on public.store_metrics_weekly;
drop policy if exists "Admins: store metrics baseline" on public.store_metrics_baseline;
drop policy if exists "Admins: store metrics settings" on public.store_metrics_settings;

create policy "Admins: store metrics" on public.store_metrics_weekly
  for all to authenticated using (public.is_team_admin()) with check (public.is_team_admin());
create policy "Admins: store metrics baseline" on public.store_metrics_baseline
  for all to authenticated using (public.is_team_admin()) with check (public.is_team_admin());
create policy "Admins: store metrics settings" on public.store_metrics_settings
  for all to authenticated using (public.is_team_admin()) with check (public.is_team_admin());

commit;

-- Added later: manager name shown on the weekly report (Store Metrics → Store setup)
alter table public.store_metrics_baseline add column if not exists manager_name text;
