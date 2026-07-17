-- Convertir una propuesta de proveedor preseleccionada en un trade del Trade
-- Desk: al hacerlo, la operación queda vinculada y toda la trazabilidad
-- (documentos, procedencia, contratos, comisiones, envío) vive en el trade.

alter table public.sourcing_submissions
  add column if not exists trade_id uuid references public.commodity_trades(id) on delete set null;

create index if not exists sourcing_submissions_trade_idx
  on public.sourcing_submissions (trade_id) where trade_id is not null;
