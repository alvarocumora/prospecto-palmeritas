-- Sourcing→Trade: preserve external counterparty identity.
-- When a sourcing submission is converted into a trade, the request owner is the
-- buyer and the supplier (usually external, no auth account) must be visible as
-- seller. Allow NULL seller_user_id and add supplier_* columns; update RLS so
-- the request owner still governs those trades when seller is external.

ALTER TABLE public.commodity_trades
  ALTER COLUMN seller_user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS counterparty_name text,
  ADD COLUMN IF NOT EXISTS counterparty_company text,
  ADD COLUMN IF NOT EXISTS counterparty_country text,
  ADD COLUMN IF NOT EXISTS counterparty_email text,
  ADD COLUMN IF NOT EXISTS counterparty_phone text,
  ADD COLUMN IF NOT EXISTS counterparty_role text; -- 'buyer' | 'seller'

DROP POLICY IF EXISTS "Parties view trade" ON public.commodity_trades;
CREATE POLICY "Parties view trade"
  ON public.commodity_trades FOR SELECT TO authenticated
  USING (
    buyer_user_id = auth.uid()
    OR seller_user_id = auth.uid()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Party creates trade" ON public.commodity_trades;
CREATE POLICY "Party creates trade"
  ON public.commodity_trades FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      buyer_user_id = auth.uid()
      OR seller_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Parties update trade" ON public.commodity_trades;
CREATE POLICY "Parties update trade"
  ON public.commodity_trades FOR UPDATE TO authenticated
  USING (
    buyer_user_id = auth.uid()
    OR seller_user_id = auth.uid()
    OR created_by = auth.uid()
  );