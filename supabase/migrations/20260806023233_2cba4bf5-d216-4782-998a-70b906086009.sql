CREATE TABLE IF NOT EXISTS public.trade_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('buyer','seller','geocapitals','broker','advisor','observer')),
  email text NOT NULL,
  full_name text,
  company text,
  token_hash text NOT NULL,
  token_prefix text NOT NULL,
  can_upload boolean NOT NULL DEFAULT false,
  can_negotiate boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_access_at timestamptz,
  access_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS trade_access_links_token_hash_key ON public.trade_access_links(token_hash);
CREATE INDEX IF NOT EXISTS trade_access_links_trade_idx ON public.trade_access_links(trade_id);

GRANT SELECT ON public.trade_access_links TO authenticated;
GRANT ALL ON public.trade_access_links TO service_role;

ALTER TABLE public.trade_access_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trade_access_links_read_staff_or_party"
ON public.trade_access_links FOR SELECT TO authenticated
USING (
  public.is_gc_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_access_links.trade_id
      AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid() OR t.created_by = auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.trade_access_links_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_trade_access_links_touch ON public.trade_access_links;
CREATE TRIGGER trg_trade_access_links_touch
BEFORE UPDATE ON public.trade_access_links
FOR EACH ROW EXECUTE FUNCTION public.trade_access_links_touch();

CREATE OR REPLACE FUNCTION public.get_trade_access_links(p_trade_id uuid)
RETURNS TABLE(party text, email text, token_prefix text, active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
  SELECT 'buyer'::text, t.counterparty_buyer_email, t.counterparty_buyer_token_prefix,
         (t.counterparty_buyer_token_hash IS NOT NULL)
  FROM public.commodity_trades t WHERE t.id = p_trade_id
  UNION ALL
  SELECT 'seller'::text, t.counterparty_seller_email, t.counterparty_seller_token_prefix,
         (t.counterparty_seller_token_hash IS NOT NULL)
  FROM public.commodity_trades t WHERE t.id = p_trade_id
  UNION ALL
  SELECT l.role, l.email, l.token_prefix,
         (l.revoked_at IS NULL AND (l.expires_at IS NULL OR l.expires_at > now()))
  FROM public.trade_access_links l WHERE l.trade_id = p_trade_id;
$function$;