
CREATE TABLE public.trade_pack_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('ficha','loi','ncnda','icpo','spa')),
  version_number INT NOT NULL,
  terms_hash TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  ctx_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trade_id, doc_type, version_number)
);

CREATE INDEX trade_pack_versions_trade_doc_idx
  ON public.trade_pack_versions (trade_id, doc_type, version_number DESC);

GRANT SELECT, INSERT ON public.trade_pack_versions TO authenticated;
GRANT ALL ON public.trade_pack_versions TO service_role;

ALTER TABLE public.trade_pack_versions ENABLE ROW LEVEL SECURITY;

-- Solo participantes del trade pueden leer/insertar versiones
CREATE POLICY "pack_versions_select_participants"
  ON public.trade_pack_versions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_pack_versions.trade_id
      AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  ));

CREATE POLICY "pack_versions_insert_participants"
  ON public.trade_pack_versions FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_pack_versions.trade_id
      AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  ));
