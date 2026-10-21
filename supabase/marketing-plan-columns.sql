-- Columns the campaign "Open Details" panel saves. Safe to run more than once.
alter table public.marketing_campaigns
  add column if not exists drinks_plan text,     add column if not exists drinks_due_date date,   add column if not exists drinks_assigned_to text,
  add column if not exists menu_plan text,       add column if not exists menu_due_date date,     add column if not exists menu_assigned_to text,
  add column if not exists activity_plan text,   add column if not exists activity_due_date date, add column if not exists activity_assigned_to text,
  add column if not exists instore_plan text,    add column if not exists instore_due_date date,  add column if not exists instore_assigned_to text,
  add column if not exists promo_social boolean default false, add column if not exists promo_como boolean default false,
  add column if not exists promo_email boolean default false,  add column if not exists promo_in_store boolean default false,
  add column if not exists promo_notes text, add column if not exists promo_due_date date, add column if not exists promo_assigned_to text,
  add column if not exists social_email text,
  add column if not exists como_notes text,     add column if not exists como_assigned_to text,
  add column if not exists email_notes text,    add column if not exists email_assigned_to text,
  add column if not exists in_store_notes text, add column if not exists in_store_assigned_to text,
  add column if not exists end_date date, add column if not exists planning_date date,
  add column if not exists event_dates date[], add column if not exists plan_status text;
notify pgrst, 'reload schema';
