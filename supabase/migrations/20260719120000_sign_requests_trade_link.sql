-- Vincula las solicitudes de firma electrónica a un trade (opcional): al
-- firmarse un NDA/SPA/Data Sheet generado desde una operación, el evento
-- queda en la trazabilidad del trade (trade_events → timeline unificado).

alter table public.document_sign_requests
  add column if not exists trade_id uuid references public.commodity_trades(id) on delete set null;

create index if not exists document_sign_requests_trade_idx
  on public.document_sign_requests (trade_id)
  where trade_id is not null;
