-- Monthly Leads & Events Report + hr@ on the all-stores report. Safe to run more than once.

-- 1) hr@ gets the all-stores report (weekly and monthly), keeping anyone already on the list.
insert into public.notification_settings (key, recipients)
values ('leads_report', array['hr@squarepegpizzeria.com'])
on conflict (key) do update
  set recipients = (select array_agg(distinct e) from unnest(coalesce(notification_settings.recipients, '{}') || array['hr@squarepegpizzeria.com']) e);

-- 2) Monthly run: the 1st of each month at 12:30 UTC (8:30am Eastern / 7:30am in winter). Reuses the inbox job's secret.
do $do$
declare k text;
begin
  select substring(command from 'key=([^''&]+)') into k from cron.job where jobname = 'check-catering-inbox';
  if k is null then raise exception 'Set up the check-catering-inbox schedule first (inbox-schedule.sql).'; end if;
  perform cron.unschedule('monthly-leads-report') where exists (select 1 from cron.job where jobname = 'monthly-leads-report');
  perform cron.schedule('monthly-leads-report', '30 12 1 * *',
    format($f$ select net.http_get(url := 'https://connect.squarepegpizzeria.com/api/leads-report?period=month&key=%s', timeout_milliseconds := 60000); $f$, k));
end $do$;

select key, recipients from public.notification_settings where key = 'leads_report';
