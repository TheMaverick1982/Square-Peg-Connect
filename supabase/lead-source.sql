-- Lead source tracking: where each form submission came from (Google, Meta ad, etc.)
alter table public.catering_requests  add column if not exists lead_source text, add column if not exists attribution jsonb;
alter table public.fundraisers        add column if not exists lead_source text, add column if not exists attribution jsonb;
alter table public.large_reservations add column if not exists lead_source text, add column if not exists attribution jsonb;
notify pgrst, 'reload schema';
