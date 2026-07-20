-- Allow external buyer counterparty (mirror of migration 20260718020542 that
-- allowed external seller). With this, a seller-side user can register a trade
-- whose buyer has no Geocapitals account.
ALTER TABLE public.commodity_trades
  ALTER COLUMN buyer_user_id DROP NOT NULL;

-- Ensure trade always has at least one identified party (creator on either side)
ALTER TABLE public.commodity_trades
  DROP CONSTRAINT IF EXISTS commodity_trades_party_present;
ALTER TABLE public.commodity_trades
  ADD CONSTRAINT commodity_trades_party_present
  CHECK (buyer_user_id IS NOT NULL OR seller_user_id IS NOT NULL);