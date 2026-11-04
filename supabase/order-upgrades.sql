-- Catering / reservation upgrades: pickup time, type of event, paid by invoice, deposit, attachments,
-- and "already emailed" markers for the new store/team alerts. Safe to run more than once.

alter table public.catering_requests add column if not exists pickup_time text;
alter table public.catering_requests add column if not exists event_type text;
alter table public.catering_requests add column if not exists paid_by_invoice boolean not null default false;
alter table public.catering_requests add column if not exists deposit_amount numeric;
alter table public.catering_requests add column if not exists deposit_paid boolean not null default false;
alter table public.catering_requests add column if not exists attachments jsonb;
alter table public.catering_requests add column if not exists alert_sent_at timestamptz;

alter table public.large_reservations add column if not exists event_type text;
alter table public.large_reservations add column if not exists paid_by_invoice boolean not null default false;
alter table public.large_reservations add column if not exists attachments jsonb;
alter table public.large_reservations add column if not exists alert_sent_at timestamptz;

alter table public.fundraisers  add column if not exists alert_sent_at timestamptz;
alter table public.kids_classes add column if not exists alert_sent_at timestamptz;

-- Files staff attach to catering orders / reservations (team only can upload).
insert into storage.buckets (id, name, public, file_size_limit)
values ('order-files', 'order-files', true, 26214400)
on conflict (id) do update set public = true, file_size_limit = 26214400;
drop policy if exists "Team: upload order files" on storage.objects;
create policy "Team: upload order files" on storage.objects
  for insert to authenticated with check (bucket_id = 'order-files' and public.is_team_member());

notify pgrst, 'reload schema';
