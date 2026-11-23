-- Explee leads stay in the Explee list until they book. Safe to run more than once.

-- 1) When anyone books (catering / fundraiser / reservation / kids class), find their Explee lead by email or phone,
--    mark it Booked, link it to the new customer record, and credit Explee as where the customer came from.
create or replace function public.mark_outreach_booked() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(new);
  v_email text := nullif(lower(trim(coalesce(j->>'email', ''))), '');
  v_digits text := nullif(right(regexp_replace(coalesce(j->>'phone', ''), '\D', '', 'g'), 10), '');
  v_lead record;
begin
  if v_digits is not null and length(v_digits) < 10 then v_digits := null; end if;
  if v_email is null and v_digits is null and new.customer_id is null then return null; end if;
  for v_lead in
    select id, campaign_name from outreach_leads
     where status <> 'booked'
       and ((v_email is not null and lower(email) = v_email)
         or (v_digits is not null and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = v_digits)
         or (new.customer_id is not null and customer_id = new.customer_id))
  loop
    update outreach_leads
       set status = 'booked', booked_at = now(), customer_id = coalesce(new.customer_id, customer_id),
           booked_ref = tg_table_name || ':' || (j->>'id')
     where id = v_lead.id;
    if new.customer_id is not null then
      update customers set first_source = 'Explee' || coalesce(': ' || v_lead.campaign_name, '')
       where id = new.customer_id and coalesce(first_source, '') not like 'Explee%';
    end if;
  end loop;
  return null;
end $$;

-- 2) Remove the customer records the first sync made for Explee leads who haven't booked anything.
update public.outreach_leads o set customer_id = null
 where status <> 'booked' and customer_id is not null
   and not exists (select 1 from catering_requests x where x.customer_id = o.customer_id)
   and not exists (select 1 from fundraisers x where x.customer_id = o.customer_id)
   and not exists (select 1 from large_reservations x where x.customer_id = o.customer_id)
   and not exists (select 1 from kids_classes x where x.customer_id = o.customer_id);
delete from public.customers c
 where c.first_source like 'Explee%'
   and not exists (select 1 from catering_requests x where x.customer_id = c.id)
   and not exists (select 1 from fundraisers x where x.customer_id = c.id)
   and not exists (select 1 from large_reservations x where x.customer_id = c.id)
   and not exists (select 1 from kids_classes x where x.customer_id = c.id)
   and not exists (select 1 from outreach_leads o where o.customer_id = c.id);

-- 3) Explee leads who already booked before this: mark them Booked now.
update public.outreach_leads o set status = 'booked', booked_at = coalesce(o.booked_at, now()), customer_id = c.id
  from public.customers c
 where o.status <> 'booked' and o.email is not null and lower(c.email) = lower(o.email)
   and (exists (select 1 from catering_requests x where x.customer_id = c.id)
     or exists (select 1 from fundraisers x where x.customer_id = c.id)
     or exists (select 1 from large_reservations x where x.customer_id = c.id)
     or exists (select 1 from kids_classes x where x.customer_id = c.id));

notify pgrst, 'reload schema';
