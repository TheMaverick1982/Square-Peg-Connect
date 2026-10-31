-- Check the catering inbox every 5 minutes (runs inside Supabase).
-- 1) Replace PASTE_INBOX_SYNC_SECRET_HERE with the same value you put in Vercel as INBOX_SYNC_SECRET.
-- 2) Run this once in the SQL Editor.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('check-catering-inbox') where exists (select 1 from cron.job where jobname = 'check-catering-inbox');
select cron.schedule(
  'check-catering-inbox',
  '*/5 * * * *',
  $$ select net.http_get(url := 'https://connect.squarepegpizzeria.com/api/inbox-sync?key=PASTE_INBOX_SYNC_SECRET_HERE', timeout_milliseconds := 60000); $$
);
