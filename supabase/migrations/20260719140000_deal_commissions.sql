-- Comisiones de asociados por deal: registra qué asociado (vendedor/gestor/
-- broker de business_partners) trajo o intermedió un trade, con su comisión
-- pactada y estado de liquidación. Cada usuario administra las comisiones de
-- sus propios deals (RLS owner-only).

create table if not exists public.deal_commissions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references public.business_partners(id) on delete cascade,
  -- Deal de origen: un trade de commodities (opcional un listing de venta de mina).
  trade_id uuid references public.commodity_trades(id) on delete set null,
  listing_id uuid references public.property_listings(id) on delete set null,
  -- Base y comisión.
  deal_value_usd numeric,
  commission_pct numeric,
  commission_usd numeric,
  -- pendiente | por_cobrar | liquidada | cancelada
  status text not null default 'pendiente',
  notes text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
