
-- 1) Vincular sign requests a trades
alter table public.document_sign_requests
  add column if not exists trade_id uuid references public.commodity_trades(id) on delete set null;

create index if not exists document_sign_requests_trade_idx
  on public.document_sign_requests (trade_id)
  where trade_id is not null;

-- 2) Comisiones de asociados por deal
create table if not exists public.deal_commissions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references public.business_partners(id) on delete cascade,
  trade_id uuid references public.commodity_trades(id) on delete set null,
  listing_id uuid references public.property_listings(id) on delete set null,
  deal_value_usd numeric,
  commission_pct numeric,
  commission_usd numeric,
  status text not null default 'pendiente',
  notes text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.deal_commissions to authenticated;
grant all on public.deal_commissions to service_role;

create index if not exists deal_commissions_owner_idx
  on public.deal_commissions (owner_user_id, status);
create index if not exists deal_commissions_partner_idx
  on public.deal_commissions (partner_id);
create index if not exists deal_commissions_trade_idx
  on public.deal_commissions (trade_id) where trade_id is not null;

alter table public.deal_commissions enable row level security;

drop policy if exists "Owner manages own commissions" on public.deal_commissions;
create policy "Owner manages own commissions"
  on public.deal_commissions for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop trigger if exists trg_deal_commissions_updated_at on public.deal_commissions;
create trigger trg_deal_commissions_updated_at
  before update on public.deal_commissions
  for each row execute function public.update_updated_at_column();

-- 3) Sourcing de commodities
create table if not exists public.sourcing_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  reference text not null,
  commodity text not null,
  form text,
  quantity_t numeric,
  incoterm text,
  destination text,
  target_price_usd_t numeric,
  specs text,
  notes text,
  status text not null default 'abierto',
  submit_token_prefix text not null,
  submit_token_hash text not null,
  expires_at timestamptz not null default (now() + interval '60 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.sourcing_requests to authenticated;
grant all on public.sourcing_requests to service_role;

create unique index if not exists sourcing_requests_submit_token_hash_idx
  on public.sourcing_requests (submit_token_hash);
create index if not exists sourcing_requests_owner_idx
  on public.sourcing_requests (owner_user_id, status);

create table if not exists public.sourcing_submissions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.sourcing_requests(id) on delete cascade,
  supplier_name text not null,
  supplier_company text,
  supplier_country text,
  contact_email text,
  contact_phone text,
  offer_price_usd_t numeric,
  offer_quantity_t numeric,
  incoterm text,
  lead_time text,
  specs text,
  notes text,
  documents jsonb not null default '[]'::jsonb,
  status text not null default 'recibida',
  share_token_prefix text,
  share_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.sourcing_submissions to authenticated;
grant all on public.sourcing_submissions to service_role;

create index if not exists sourcing_submissions_request_idx
  on public.sourcing_submissions (request_id);
create unique index if not exists sourcing_submissions_share_token_hash_idx
  on public.sourcing_submissions (share_token_hash) where share_token_hash is not null;

alter table public.sourcing_requests enable row level security;
alter table public.sourcing_submissions enable row level security;

drop policy if exists "Owner manages sourcing requests" on public.sourcing_requests;
create policy "Owner manages sourcing requests"
  on public.sourcing_requests for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "Owner manages sourcing submissions" on public.sourcing_submissions;
create policy "Owner manages sourcing submissions"
  on public.sourcing_submissions for all to authenticated
  using (
    exists (
      select 1 from public.sourcing_requests r
      where r.id = sourcing_submissions.request_id
        and r.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.sourcing_requests r
      where r.id = sourcing_submissions.request_id
        and r.owner_user_id = auth.uid()
    )
  );

drop trigger if exists trg_sourcing_requests_updated_at on public.sourcing_requests;
create trigger trg_sourcing_requests_updated_at
  before update on public.sourcing_requests
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_sourcing_submissions_updated_at on public.sourcing_submissions;
create trigger trg_sourcing_submissions_updated_at
  before update on public.sourcing_submissions
  for each row execute function public.update_updated_at_column();
