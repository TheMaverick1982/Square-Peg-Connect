-- EMERGENCY UNDO for go-live-lockdown.sql
-- Puts Connect's tables back to "open to everyone" (how they were under Vendasta).
-- Only use this if something breaks after the lockdown — then tell Claude what broke.

begin;

do $$
declare r record; t text;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and (policyname like 'Team members:%' or policyname like 'Admins:%' or policyname like 'Public form:%')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;

  foreach t in array array[
    'admin_settings','automation_logs','b2b_activities','b2b_contacts','campaigns',
    'catering_requests','employee_profiles','events','fundraisers','guest_bounce_backs',
    'large_reservations','marketing_campaigns','marketing_support_requests','marketing_tasks',
    'nurture_templates','reminders','social_posts','staff_photo_submissions','store_events'
  ] loop
    execute format('create policy "TEMP open access (undo)" on public.%I for all to public using (true) with check (true)', t);
  end loop;
end $$;

grant select on public.fundraisers to anon;

commit;
