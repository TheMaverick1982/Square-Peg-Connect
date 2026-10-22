-- Kids Pizza Classes: same fields as Large Reservations, in its own table.
create table if not exists public.kids_classes (like public.large_reservations including all);
alter table public.kids_classes add column if not exists lead_source text;
alter table public.kids_classes add column if not exists attribution jsonb;
alter table public.kids_classes add column if not exists alert_sent_at timestamptz;

alter table public.kids_classes enable row level security;
drop policy if exists "Team members: full access" on public.kids_classes;
create policy "Team members: full access" on public.kids_classes
  for all to authenticated using (public.is_team_member()) with check (public.is_team_member());
drop policy if exists "Public form: submit kids class" on public.kids_classes;
create policy "Public form: submit kids class" on public.kids_classes
  for insert to anon with check (true);

grant select, insert, update, delete on public.kids_classes to authenticated;
grant insert on public.kids_classes to anon;
notify pgrst, 'reload schema';
