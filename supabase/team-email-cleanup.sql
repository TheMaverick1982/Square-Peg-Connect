-- Square Peg Connect: fix "No access yet" for people who ARE on the team list.
-- Cause: a saved email with a stray space or capital letter, or two entries for the same email.
-- Safe to run more than once.
begin;

-- 1) Clean every saved team email (trim spaces, lowercase). Skips the old Vendasta entries that have no real email.
update public.employee_profiles
   set email = lower(trim(email))
 where email like '%@%' and email <> lower(trim(email));

-- 2) Make the access check itself ignore spaces and capitals from now on.
create or replace function public.is_team_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employee_profiles
    where lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(status, 'approved') <> 'disabled'
  );
$$;

create or replace function public.is_team_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employee_profiles
    where lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and role = 'admin'
      and coalesce(status, 'approved') <> 'disabled'
  );
$$;

commit;

-- 3) Show anyone listed more than once, plus Arvin's entries, so we can see what was wrong.
select email, count(*) as entries, string_agg(role || ' / ' || coalesce(status, 'no status'), ', ') as role_and_status
  from public.employee_profiles
 group by email
having count(*) > 1 or email ilike '%arvin%'
 order by email;
