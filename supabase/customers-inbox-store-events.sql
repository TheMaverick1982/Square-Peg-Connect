-- =====================================================================
-- Customers (one record per customer), Catering inbox, Store event form
-- Safe to run more than once.
-- =====================================================================

-- ---------- 1) Customers ----------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  phone_digits text,
  organization text,
  first_source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customers_email_key on public.customers (lower(email)) where email is not null and email <> '';
create index if not exists customers_phone_idx on public.customers (phone_digits);

create table if not exists public.customer_activities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  kind text not null,              -- catering | fundraiser | large_reservation | kids_class | email | note
  title text,
  body text,
  ref_table text,
  ref_id text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists customer_activities_customer_idx on public.customer_activities (customer_id, created_at desc);

alter table public.catering_requests  add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.fundraisers        add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.large_reservations add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.kids_classes       add column if not exists customer_id uuid references public.customers(id) on delete set null;

-- Find a customer by email, then by phone (last 10 digits); create one if none. Fills in blanks on a match.
create or replace function public.find_or_create_customer(p_email text, p_phone text, p_name text, p_org text, p_source text, p_when timestamptz default now())
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_digits text := nullif(right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10), '');
  v_id uuid;
begin
  if v_digits is not null and length(v_digits) < 10 then v_digits := null; end if;
  if v_email is not null then select id into v_id from customers where lower(email) = v_email limit 1; end if;
  if v_id is null and v_digits is not null then select id into v_id from customers where phone_digits = v_digits order by created_at limit 1; end if;
  if v_id is null and v_email is null and v_digits is null then return null; end if;
  if v_id is null then
    insert into customers (name, email, phone, phone_digits, organization, first_source, created_at)
    values (nullif(trim(p_name), ''), v_email, nullif(trim(p_phone), ''), v_digits, nullif(trim(p_org), ''), nullif(p_source, ''), coalesce(p_when, now()))
    returning id into v_id;
  else
    update customers set
      name = coalesce(name, nullif(trim(p_name), '')),
      email = coalesce(email, v_email),
      phone = coalesce(phone, nullif(trim(p_phone), '')),
      phone_digits = coalesce(phone_digits, v_digits),
      organization = coalesce(organization, nullif(trim(p_org), '')),
      first_source = coalesce(first_source, nullif(p_source, '')),
      updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end $$;

-- Runs on every new catering request / fundraiser / reservation / kids class (forms, manual adds, inbox).
create or replace function public.link_customer() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(new);
  v_kind text := case tg_table_name when 'catering_requests' then 'catering' when 'fundraisers' then 'fundraiser'
                   when 'large_reservations' then 'large_reservation' else 'kids_class' end;
  v_label text := case tg_table_name when 'catering_requests' then 'Catering request' when 'fundraisers' then 'Tuesday fundraiser request'
                   when 'large_reservations' then 'Large reservation request' else 'Kids pizza class request' end;
  v_org text := coalesce(j->>'company', j->>'organization');
  v_title text;
begin
  if new.customer_id is null then
    new.customer_id := find_or_create_customer(j->>'email', j->>'phone', j->>'name', v_org,
      coalesce(j->>'lead_source', nullif('Told us: ' || coalesce(j->>'heard_about_us', ''), 'Told us: ')), coalesce(nullif(j->>'created_at', '')::timestamptz, now()));
  end if;
  if new.customer_id is not null then
    v_title := v_label
      || coalesce(' · ' || to_char(nullif(j->>'event_date', '')::date, 'Mon FMDD, YYYY'), '')
      || coalesce(' · ' || nullif(j->>'guest_count', '0') || ' guests', '');
    insert into customer_activities (customer_id, kind, title, body, ref_table, ref_id, created_at)
    values (new.customer_id, v_kind, v_title, nullif(j->>'notes', ''), tg_table_name, j->>'id', coalesce(nullif(j->>'created_at', '')::timestamptz, now()));
  end if;
  return new;
end $$;

drop trigger if exists link_customer on public.catering_requests;
create trigger link_customer before insert on public.catering_requests  for each row execute function public.link_customer();
drop trigger if exists link_customer on public.fundraisers;
create trigger link_customer before insert on public.fundraisers        for each row execute function public.link_customer();
drop trigger if exists link_customer on public.large_reservations;
create trigger link_customer before insert on public.large_reservations for each row execute function public.link_customer();
drop trigger if exists link_customer on public.kids_classes;
create trigger link_customer before insert on public.kids_classes       for each row execute function public.link_customer();

-- Backfill: link everything already in Connect (oldest first), one customer per email/phone.
do $$
declare r record; v uuid; t text;
begin
  foreach t in array array['catering_requests','fundraisers','large_reservations','kids_classes'] loop
    for r in execute format('select id::text as id, to_jsonb(x) j from public.%I x where customer_id is null order by created_at', t) loop
      v := find_or_create_customer(r.j->>'email', r.j->>'phone', r.j->>'name', coalesce(r.j->>'company', r.j->>'organization'),
             coalesce(r.j->>'lead_source', nullif('Told us: ' || coalesce(r.j->>'heard_about_us', ''), 'Told us: ')), nullif(r.j->>'created_at', '')::timestamptz);
      if v is not null then
        execute format('update public.%I set customer_id = $1 where id::text = $2', t) using v, r.id;
        insert into customer_activities (customer_id, kind, title, body, ref_table, ref_id, created_at)
        values (v, case t when 'catering_requests' then 'catering' when 'fundraisers' then 'fundraiser' when 'large_reservations' then 'large_reservation' else 'kids_class' end,
          case t when 'catering_requests' then 'Catering request' when 'fundraisers' then 'Tuesday fundraiser request' when 'large_reservations' then 'Large reservation request' else 'Kids pizza class request' end
            || coalesce(' · ' || to_char(nullif(r.j->>'event_date', '')::date, 'Mon FMDD, YYYY'), ''),
          nullif(r.j->>'notes', ''), t, r.id, coalesce(nullif(r.j->>'created_at', '')::timestamptz, now()));
      end if;
    end loop;
  end loop;
end $$;

-- Totals per customer (bookings + revenue). Revenue: catering confirmed/completed quote, others' entered sales.
create or replace view public.customer_summary with (security_invoker = true) as
select c.*,
  (select count(*) from catering_requests x where x.customer_id = c.id) as catering_count,
  (select count(*) from fundraisers x where x.customer_id = c.id and x.deleted_at is null) as fundraiser_count,
  (select count(*) from large_reservations x where x.customer_id = c.id and x.deleted_at is null) as reservation_count,
  (select count(*) from kids_classes x where x.customer_id = c.id and x.deleted_at is null) as kids_class_count,
  coalesce((select sum(coalesce(nullif(x.quote_total::text, '')::numeric, 0)) from catering_requests x where x.customer_id = c.id and x.status in ('Confirmed','Completed')), 0)
  + coalesce((select sum(coalesce(nullif(x.total_sales::text, '')::numeric, 0)) from fundraisers x where x.customer_id = c.id and x.deleted_at is null and coalesce(x.status, '') <> 'Cancelled'), 0)
  + coalesce((select sum(coalesce(nullif(x.total_sales::text, '')::numeric, 0)) from large_reservations x where x.customer_id = c.id and x.deleted_at is null and coalesce(x.status, '') <> 'Cancelled'), 0)
  + coalesce((select sum(coalesce(nullif(x.total_sales::text, '')::numeric, 0)) from kids_classes x where x.customer_id = c.id and x.deleted_at is null and coalesce(x.status, '') <> 'Cancelled'), 0) as lifetime_revenue,
  (select max(a.created_at) from customer_activities a where a.customer_id = c.id) as last_activity_at
from public.customers c;

alter table public.customers enable row level security;
alter table public.customer_activities enable row level security;
drop policy if exists "Team members: full access" on public.customers;
create policy "Team members: full access" on public.customers for all to authenticated using (public.is_team_member()) with check (public.is_team_member());
drop policy if exists "Team members: full access" on public.customer_activities;
create policy "Team members: full access" on public.customer_activities for all to authenticated using (public.is_team_member()) with check (public.is_team_member());
grant select, insert, update, delete on public.customers, public.customer_activities to authenticated;
grant select on public.customer_summary to authenticated;
revoke execute on function public.find_or_create_customer(text, text, text, text, text, timestamptz) from anon;

-- ---------- 2) Catering inbox (Gmail) ----------
-- Connection + token: server only (no policies = no access from the app; the server uses the secret key).
create table if not exists public.mailbox_connections (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  refresh_token text not null,
  connected_by text,
  connected_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_error text
);
alter table public.mailbox_connections enable row level security;

-- Team can see which inbox is connected (never the token).
create or replace function public.mailbox_status()
returns table (email text, connected_by text, connected_at timestamptz, last_checked_at timestamptz, last_error text)
language sql security definer set search_path = public as $$
  select email, connected_by, connected_at, last_checked_at, last_error from mailbox_connections where public.is_team_member();
$$;
grant execute on function public.mailbox_status() to authenticated;

create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  mailbox text not null,
  gmail_id text not null unique,
  thread_id text,
  from_email text,
  from_name text,
  subject text,
  received_at timestamptz,
  snippet text,
  body text,
  category text,          -- catering | fundraiser | large_reservation | kids_class | existing_customer | other
  ai jsonb,               -- what the AI pulled out (name, phone, date, guests, summary…)
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'new',   -- new | applied | ignored
  applied_note text,
  handled_by text,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists inbox_items_status_idx on public.inbox_items (status, received_at desc);
alter table public.inbox_items enable row level security;
drop policy if exists "Team members: full access" on public.inbox_items;
create policy "Team members: full access" on public.inbox_items for all to authenticated using (public.is_team_member()) with check (public.is_team_member());
grant select, insert, update, delete on public.inbox_items to authenticated;

-- ---------- 3) Store event submissions → Store Promotions ----------
alter table public.marketing_campaigns add column if not exists attachments jsonb;
alter table public.marketing_campaigns add column if not exists submitted_by text;
alter table public.marketing_campaigns add column if not exists source text;

-- File uploads (photos, videos, flyers) for the store event form. Public can upload into uploads/ only.
insert into storage.buckets (id, name, public, file_size_limit)
values ('store-event-files', 'store-event-files', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;
drop policy if exists "Public form: upload store event files" on storage.objects;
create policy "Public form: upload store event files" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'store-event-files' and (storage.foldername(name))[1] = 'uploads');

notify pgrst, 'reload schema';
