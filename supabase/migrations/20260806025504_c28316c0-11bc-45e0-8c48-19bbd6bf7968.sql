CREATE TABLE public.trade_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('buyer','seller','broker','advisor','observer','geocapitals')),
  name text,
  company text,
  email text NOT NULL,
  can_view_ficha boolean NOT NULL DEFAULT true,
  can_view_documents boolean NOT NULL DEFAULT true,
  can_negotiate boolean NOT NULL DEFAULT false,
  can_upload boolean NOT NULL DEFAULT false,
  token_hash text,
  token_prefix text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  invited_by uuid,
  invited_at timestamptz,
  revoked_at timestamptz,
  last_access_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX trade_participants_token_hash_key ON public.trade_participants(token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX trade_participants_trade_idx ON public.trade_participants(trade_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_participants TO authenticated;
GRANT ALL ON public.trade_participants TO service_role;
ALTER TABLE public.trade_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trade_participants_select" ON public.trade_participants
FOR SELECT TO authenticated
USING (
  public.is_gc_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_id AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  )
);

CREATE POLICY "trade_participants_insert" ON public.trade_participants
FOR INSERT TO authenticated
WITH CHECK (
  public.is_gc_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_id AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  )
);

CREATE POLICY "trade_participants_update" ON public.trade_participants
FOR UPDATE TO authenticated
USING (
  public.is_gc_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_id AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  )
)
WITH CHECK (
  public.is_gc_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_id AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  )
);

CREATE POLICY "trade_participants_delete" ON public.trade_participants
FOR DELETE TO authenticated
USING (public.is_gc_staff(auth.uid()));

CREATE TRIGGER trade_participants_updated_at
BEFORE UPDATE ON public.trade_participants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.trade_kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  party text NOT NULL CHECK (party IN ('buyer','seller')),
  doc_key text NOT NULL,
  label text,
  file_url text,
  file_name text,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','in_review','approved','observed')),
  review_note text,
  expires_at date,
  uploaded_by uuid,
  uploaded_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trade_id, party, doc_key)
);

CREATE INDEX trade_kyc_documents_trade_idx ON public.trade_kyc_documents(trade_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_kyc_documents TO authenticated;
GRANT ALL ON public.trade_kyc_documents TO service_role;
ALTER TABLE public.trade_kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trade_kyc_select" ON public.trade_kyc_documents
FOR SELECT TO authenticated
USING (
  public.is_gc_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_id AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  )
);

CREATE POLICY "trade_kyc_insert" ON public.trade_kyc_documents
FOR INSERT TO authenticated
WITH CHECK (
  public.is_gc_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_id AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  )
);

CREATE POLICY "trade_kyc_update" ON public.trade_kyc_documents
FOR UPDATE TO authenticated
USING (
  public.is_gc_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_id AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  )
)
WITH CHECK (
  public.is_gc_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_id AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  )
);

CREATE POLICY "trade_kyc_delete" ON public.trade_kyc_documents
FOR DELETE TO authenticated
USING (public.is_gc_staff(auth.uid()));

CREATE TRIGGER trade_kyc_documents_updated_at
BEFORE UPDATE ON public.trade_kyc_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();