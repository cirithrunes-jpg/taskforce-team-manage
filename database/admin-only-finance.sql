-- TaskForce admin-only finance extension. Existing records are preserved.
create table public.team_admin_fees (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  operator_key text not null check (operator_key ~ '^(user|record):[0-9a-f-]{36}$'),
  operator_name text not null check (length(btrim(operator_name)) between 1 and 160),
  reference_month date not null check (extract(day from reference_month) = 1),
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','paid')),
  payment_date date,
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_admin_fees_one_per_month unique(team_id,operator_key,reference_month),
  constraint team_admin_fees_due_month check (due_date >= reference_month and due_date < reference_month + interval '1 month'),
  constraint team_admin_fees_paid_date check ((status = 'paid' and payment_date is not null) or (status = 'pending' and payment_date is null))
);
alter table public.team_admin_fees enable row level security;
revoke all on public.team_admin_fees from anon, public;
grant select,insert,update on public.team_admin_fees to authenticated;
create policy admin_fees_read on public.team_admin_fees for select to authenticated using (private.team_admin(team_id));
create policy admin_fees_insert on public.team_admin_fees for insert to authenticated with check (private.team_admin(team_id));
create policy admin_fees_update on public.team_admin_fees for update to authenticated using (private.team_admin(team_id)) with check (private.team_admin(team_id));
create index team_admin_fees_team_month on public.team_admin_fees(team_id,reference_month);
-- No change to legacy authentication, profiles, memberships, or payments.
