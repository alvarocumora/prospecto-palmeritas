-- Capa financiera del trade: cronograma de pagos de una operación (anticipo,
-- contra embarque, contra entrega, balance, comisión). Cada pago tiene monto,
-- vencimiento, instrumento y estado. Visible/editable solo por las contrapartes
-- del trade (mismo criterio que trade_shipments / trade_documents).

create table if not exists public.trade_payments (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.commodity_trades(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  -- anticipo | contra_embarque | contra_entrega | balance | comision | otro
  kind text not null default 'otro',
  label text,
  amount_usd numeric,
  currency text not null default 'USD',
  -- Instrumento: sblc_mt760 | dlc | tt | escrow | otro
  instrument text,
  reference text,
  due_date date,
  -- programado | pagado | cancelado
  status text not null default 'programado',
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trade_payments_trade_idx on public.trade_payments (trade_id);
create index if not exists trade_payments_status_idx on public.trade_payments (status);

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
