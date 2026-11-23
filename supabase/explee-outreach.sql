-- Explee cold-outreach leads (positive replies) → Carla's follow-up list. Safe to run more than once.
create table if not exists public.outreach_leads (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'explee',
  external_id text not null,
  campaign_id bigint,
  campaign_name text,
  name text, email text, phone text, job_title text, company text, company_domain text, linkedin_url text,
  reply text,
  replied_at timestamptz,
  ai jsonb,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'new',        -- new | contacted | booked | not_interested
  follow_up_on date,
  notes text,
  booked_at timestamptz,
  booked_ref text,
  updated_by text,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);
create index if not exists outreach_leads_status_idx on public.outreach_leads (status, follow_up_on);
create index if not exists outreach_leads_customer_idx on public.outreach_leads (customer_id);

alter table public.outreach_leads enable row level security;
drop policy if exists "Team members: full access" on public.outreach_leads;
create policy "Team members: full access" on public.outreach_leads for all to authenticated
  using (public.is_team_member()) with check (public.is_team_member());
grant select, insert, update, delete on public.outreach_leads to authenticated;

-- When an outreach lead's customer books anything, mark them Booked automatically.
create or replace function public.mark_outreach_booked() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is not null then
    update outreach_leads
       set status = 'booked', booked_at = now(), booked_ref = tg_table_name || ':' || (to_jsonb(new)->>'id')
     where customer_id = new.customer_id and status <> 'booked';
  end if;
  return null;
end $$;
drop trigger if exists mark_outreach_booked on public.catering_requests;
create trigger mark_outreach_booked after insert on public.catering_requests  for each row execute function public.mark_outreach_booked();
drop trigger if exists mark_outreach_booked on public.fundraisers;
create trigger mark_outreach_booked after insert on public.fundraisers        for each row execute function public.mark_outreach_booked();
drop trigger if exists mark_outreach_booked on public.large_reservations;
create trigger mark_outreach_booked after insert on public.large_reservations for each row execute function public.mark_outreach_booked();
drop trigger if exists mark_outreach_booked on public.kids_classes;
create trigger mark_outreach_booked after insert on public.kids_classes       for each row execute function public.mark_outreach_booked();

notify pgrst, 'reload schema';
