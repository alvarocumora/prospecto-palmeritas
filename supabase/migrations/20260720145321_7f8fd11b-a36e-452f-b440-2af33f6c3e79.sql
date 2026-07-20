-- Panel espejo de contraparte: token público por parte del trade
ALTER TABLE public.commodity_trades
  ADD COLUMN IF NOT EXISTS counterparty_seller_token_hash text UNIQUE,
  ADD COLUMN IF NOT EXISTS counterparty_buyer_token_hash text UNIQUE,
  ADD COLUMN IF NOT EXISTS counterparty_seller_token_prefix text,
  ADD COLUMN IF NOT EXISTS counterparty_buyer_token_prefix text,
  ADD COLUMN IF NOT EXISTS counterparty_seller_email text,
  ADD COLUMN IF NOT EXISTS counterparty_buyer_email text;

CREATE INDEX IF NOT EXISTS idx_commodity_trades_seller_token ON public.commodity_trades (counterparty_seller_token_hash);
CREATE INDEX IF NOT EXISTS idx_commodity_trades_buyer_token ON public.commodity_trades (counterparty_buyer_token_hash);
