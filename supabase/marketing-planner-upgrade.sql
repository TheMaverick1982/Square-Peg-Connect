-- Square Peg Connect: Marketing Planner upgrade
-- (multi-day campaigns, recap notes, request alerts, email alert lists). Safe to run more than once.
begin;

alter table public.marketing_campaigns add column if not exists end_date date;
alter table public.marketing_campaigns add column if not exists recap_results text;
alter table public.marketing_campaigns add column if not exists recap_worked text;
alter table public.marketing_campaigns add column if not exists recap_improve text;

alter table public.marketing_support_requests add column if not exists alert_sent_at timestamptz;

insert into public.notification_settings (key, recipients) values
  ('marketing_requests', array['brian@brianhardy.com']),
  ('social_approvals',   array['brian@brianhardy.com']),
  ('social_team',        array[]::text[])
on conflict (key) do nothing;

commit;
