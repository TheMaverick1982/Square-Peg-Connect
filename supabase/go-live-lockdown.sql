-- Square Peg Connect — go-live security lockdown
-- Run ONCE in Supabase → SQL Editor, the same day connect.squarepegpizzeria.com is pointed at Vercel.
-- After this:
--   • Signed-in people on the team list (employee_profiles) → full access to Connect data
--   • Only Super Admins can change the team list (add/remove/roles/locations)
--   • The public forms can SUBMIT, but nobody without a login can READ anything
--   • Loyalty Member Lookup is unaffected (it has no tables here); `unsubscribes` is left as-is
-- To reverse: run supabase/go-live-UNDO.sql

begin;

-- Helpers: is the signed-in user on the team list? are they an admin?
create or replace function public.is_team_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employee_profiles
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and coalesce(status, 'approved') <> 'disabled'
  );
$$;

create or replace function public.is_team_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employee_profiles
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and role = 'admin'
      and coalesce(status, 'approved') <> 'disabled'
  );
$$;

revoke all on function public.is_team_member() from public;
revoke all on function public.is_team_admin() from public;
grant execute on function public.is_team_member() to authenticated;
grant execute on function public.is_team_admin() to authenticated;

-- 1) Remove every existing policy on Connect's tables (they are all open to the public today).
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in (
        'admin_settings','automation_logs','b2b_activities','b2b_contacts','campaigns',
        'catering_requests','employee_profiles','events','fundraisers','guest_bounce_backs',
        'large_reservations','marketing_campaigns','marketing_support_requests','marketing_tasks',
        'nurture_templates','reminders','social_posts','staff_photo_submissions','store_events'
      )
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 2) Team members: full access to everything except the team list itself.
do $$
declare t text;
begin
  foreach t in array array[
    'admin_settings','automation_logs','b2b_activities','b2b_contacts','campaigns',
    'catering_requests','events','fundraisers','guest_bounce_backs',
    'large_reservations','marketing_campaigns','marketing_support_requests','marketing_tasks',
    'nurture_templates','reminders','social_posts','staff_photo_submissions','store_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Team members: full access" on public.%I for all to authenticated using (public.is_team_member()) with check (public.is_team_member())', t);
  end loop;
end $$;

-- 3) Team list: members can read it; only admins can change it.
alter table public.employee_profiles enable row level security;
create policy "Team members: read team list" on public.employee_profiles
  for select to authenticated using (public.is_team_member());
create policy "Admins: manage team list" on public.employee_profiles
  for all to authenticated using (public.is_team_admin()) with check (public.is_team_admin());

-- 4) Public forms: submit only (no reading).
create policy "Public form: submit catering request"     on public.catering_requests          for insert to anon with check (true);
create policy "Public form: submit fundraiser"           on public.fundraisers                for insert to anon with check (true);
create policy "Public form: submit large reservation"    on public.large_reservations         for insert to anon with check (true);
create policy "Public form: add reservation contact"     on public.b2b_contacts               for insert to anon with check (true);
create policy "Public form: submit marketing campaign"   on public.marketing_campaigns        for insert to anon with check (true);
create policy "Public form: submit marketing request"    on public.marketing_support_requests for insert to anon with check (true);
create policy "Public form: submit staff photos"         on public.staff_photo_submissions    for insert to anon with check (true);

-- 5) Fundraiser form shows which dates are already booked: the public may see
--    ONLY the date + location columns, nothing else about the fundraiser.
create policy "Public form: see booked fundraiser dates" on public.fundraisers for select to anon using (true);
revoke select on public.fundraisers from anon;
grant select (event_date, location) on public.fundraisers to anon;

commit;

-- Added later: tolerate stray spaces/capitals in saved team emails (run supabase/team-email-cleanup.sql).
