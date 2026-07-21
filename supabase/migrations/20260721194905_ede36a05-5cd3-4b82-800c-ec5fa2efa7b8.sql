create table if not exists public.sourcing_dispatches (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  submission_id uuid not null references public.sourcing_submissions(id) on delete cascade,
  request_id uuid not null references public.sourcing_requests(id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  recipient_company text,
  partner_id uuid references public.business_partners(id) on delete set null,
  ncnda_ref text,
  message_id text,
  status text not null default 'sent',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists sourcing_dispatches_owner_idx
  on public.sourcing_dispatches(owner_user_id, created_at desc);
create index if not exists sourcing_dispatches_submission_idx
  on public.sourcing_dispatches(submission_id, created_at desc);

grant select, insert, update, delete on public.sourcing_dispatches to authenticated;
grant all on public.sourcing_dispatches to service_role;

alter table public.sourcing_dispatches enable row level security;

drop policy if exists "own dispatches select" on public.sourcing_dispatches;
create policy "own dispatches select" on public.sourcing_dispatches
  for select to authenticated using (owner_user_id = auth.uid());

drop policy if exists "own dispatches insert" on public.sourcing_dispatches;
create policy "own dispatches insert" on public.sourcing_dispatches
  for insert to authenticated with check (owner_user_id = auth.uid());

drop policy if exists "own dispatches update" on public.sourcing_dispatches;
create policy "own dispatches update" on public.sourcing_dispatches
  for update to authenticated using (owner_user_id = auth.uid());

drop policy if exists "own dispatches delete" on public.sourcing_dispatches;
create policy "own dispatches delete" on public.sourcing_dispatches
  for delete to authenticated using (owner_user_id = auth.uid());