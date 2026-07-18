create table if not exists public.trade_payments (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.commodity_trades(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  kind text not null default 'otro',
  label text,
  amount_usd numeric,
  currency text not null default 'USD',
  instrument text,
  reference text,
  due_date date,
  status text not null default 'programado',
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trade_payments_trade_idx on public.trade_payments (trade_id);
create index if not exists trade_payments_status_idx on public.trade_payments (status);

grant select, insert, update, delete on public.trade_payments to authenticated;
grant all on public.trade_payments to service_role;

alter table public.trade_payments enable row level security;

drop policy if exists "Trade parties manage payments" on public.trade_payments;
create policy "Trade parties manage payments"
  on public.trade_payments for all to authenticated
  using (
    exists (
      select 1 from public.commodity_trades t
      where t.id = trade_payments.trade_id
        and (t.buyer_user_id = auth.uid() or t.seller_user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.commodity_trades t
      where t.id = trade_payments.trade_id
        and (t.buyer_user_id = auth.uid() or t.seller_user_id = auth.uid())
    )
  );

drop trigger if exists trg_trade_payments_updated_at on public.trade_payments;
create trigger trg_trade_payments_updated_at
  before update on public.trade_payments
  for each row execute function public.update_updated_at_column();