-- "Intake by": who entered each request (blank = Web lead). Safe to run more than once.
alter table public.catering_requests  add column if not exists intake_by text;
alter table public.fundraisers        add column if not exists intake_by text;
alter table public.large_reservations add column if not exists intake_by text;
alter table public.kids_classes       add column if not exists intake_by text;
notify pgrst, 'reload schema';
