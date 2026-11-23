-- Guest confirmation emails + 8am morning-of reminders to each store. Safe to run more than once.

-- 1) Remember when the guest was emailed (so Connect can warn before sending twice).
alter table public.catering_requests  add column if not exists guest_emailed_at timestamptz;
alter table public.fundraisers        add column if not exists guest_emailed_at timestamptz;
alter table public.large_reservations add column if not exists guest_emailed_at timestamptz;
alter table public.kids_classes       add column if not exists guest_emailed_at timestamptz;

-- 2) Morning reminders: runs at 12:00 and 13:00 UTC; the app only sends at the one that is 8am in Connecticut.
--    Reuses the secret from the inbox job you already set up.
do $do$
declare k text;
begin
  select substring(command from 'key=([^''&]+)') into k from cron.job where jobname = 'check-catering-inbox';
  if k is null then raise exception 'Set up the check-catering-inbox schedule first (inbox-schedule.sql).'; end if;
  perform cron.unschedule('store-morning-reminders') where exists (select 1 from cron.job where jobname = 'store-morning-reminders');
  perform cron.schedule('store-morning-reminders', '0 12,13 * * *',
    format($f$ select net.http_get(url := 'https://connect.squarepegpizzeria.com/api/lead-email?key=%s', timeout_milliseconds := 60000); $f$, k));
end $do$;

notify pgrst, 'reload schema';
