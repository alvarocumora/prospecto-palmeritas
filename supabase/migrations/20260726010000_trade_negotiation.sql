-- OPERACIONES (spine Trades) · Negociación estructurada de términos.
--
-- Falta la capa de oferta/contraoferta: hoy la negociación es texto libre
-- (commodity_inquiry_messages) y los términos finales quedan sueltos en
-- commodity_trades. Esta tabla estructura la negociación: cada fila es una PROPUESTA
-- de términos (precio, cantidad, Incoterm, fechas, puertos, pago, envío) de una parte,
-- con estado y cadena de contraofertas. Al ACEPTAR, se vuelcan los términos al trade.
-- Así "negociar precio/fecha/tipo de contrato CIF/FOB/detalles de envío" queda todo
-- trazado en plataforma.
--
-- Depende de commodity_trades (Lovable). Escritura vía RPC (SECURITY DEFINER).

CREATE TABLE IF NOT EXISTS public.trade_negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  party text NOT NULL CHECK (party IN ('buyer','seller','geocapitals')),
  price_usd_t numeric,
  quantity_t numeric,
  incoterm text,                 -- CIF | FOB | CFR | DAP | DDP ...
  port_loading text,
  port_discharge text,
  delivery_from date,
  delivery_to date,
  payment_terms text,            -- p.ej. "DLC irrevocable a la vista"
  shipping_notes text,           -- detalles de envío / logística
  valid_until date,
  message text,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','accepted','rejected','countered','withdrawn','superseded')),
  replies_to uuid REFERENCES public.trade_negotiations(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_negotiations_trade ON public.trade_negotiations (trade_id, created_at);

ALTER TABLE public.trade_negotiations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trade_negotiations' AND policyname='trade_negotiations_read') THEN
    CREATE POLICY "trade_negotiations_read" ON public.trade_negotiations FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.trade_negotiations TO authenticated;
GRANT ALL ON public.trade_negotiations TO service_role;

COMMENT ON TABLE public.trade_negotiations IS
  'Negociación estructurada de términos por operación: oferta/contraoferta (precio, cantidad, Incoterm, fechas, puertos, pago, envío). Al aceptar, se vuelcan los términos a commodity_trades.';

-- Proponer términos (oferta o contraoferta). Si p_replies_to apunta a una propuesta
-- abierta, la marca 'countered'.
CREATE OR REPLACE FUNCTION public.propose_trade_terms(
  p_trade_id uuid, p_party text,
  p_price_usd_t numeric DEFAULT NULL, p_quantity_t numeric DEFAULT NULL,
  p_incoterm text DEFAULT NULL, p_port_loading text DEFAULT NULL, p_port_discharge text DEFAULT NULL,
  p_delivery_from date DEFAULT NULL, p_delivery_to date DEFAULT NULL,
  p_payment_terms text DEFAULT NULL, p_shipping_notes text DEFAULT NULL,
  p_valid_until date DEFAULT NULL, p_message text DEFAULT NULL,
  p_replies_to uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'requiere usuario autenticado'; END IF;
  IF p_replies_to IS NOT NULL THEN
    UPDATE public.trade_negotiations SET status = 'countered'
     WHERE id = p_replies_to AND trade_id = p_trade_id AND status = 'proposed';
  END IF;
  INSERT INTO public.trade_negotiations
    (trade_id, party, price_usd_t, quantity_t, incoterm, port_loading, port_discharge,
     delivery_from, delivery_to, payment_terms, shipping_notes, valid_until, message,
     replies_to, created_by)
  VALUES
    (p_trade_id, p_party, p_price_usd_t, p_quantity_t, p_incoterm, p_port_loading, p_port_discharge,
     p_delivery_from, p_delivery_to, p_payment_terms, p_shipping_notes, p_valid_until, p_message,
     p_replies_to, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.propose_trade_terms(uuid,text,numeric,numeric,text,text,text,date,date,text,text,date,text,uuid) TO authenticated, service_role;

-- Responder una propuesta: aceptar o rechazar. Al aceptar, vuelca los términos al
-- trade y marca el resto de propuestas abiertas como 'superseded'.
CREATE OR REPLACE FUNCTION public.respond_trade_terms(
  p_offer_id uuid, p_action text, p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.trade_negotiations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'requiere usuario autenticado'; END IF;
  IF p_action NOT IN ('accept','reject') THEN RAISE EXCEPTION 'acción inválida: %', p_action; END IF;

  SELECT * INTO r FROM public.trade_negotiations WHERE id = p_offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'propuesta % no existe', p_offer_id; END IF;
  IF r.status <> 'proposed' THEN RAISE EXCEPTION 'la propuesta ya no está abierta (estado %)', r.status; END IF;

  IF p_action = 'reject' THEN
    UPDATE public.trade_negotiations SET status = 'rejected', message = COALESCE(p_note, message) WHERE id = p_offer_id;
    RETURN;
  END IF;

  -- accept
  UPDATE public.trade_negotiations SET status = 'accepted', message = COALESCE(p_note, message) WHERE id = p_offer_id;
  UPDATE public.trade_negotiations
     SET status = 'superseded'
   WHERE trade_id = r.trade_id AND id <> p_offer_id AND status = 'proposed';
  UPDATE public.commodity_trades
     SET unit_price_usd    = COALESCE(r.price_usd_t, unit_price_usd),
         quantity_t        = COALESCE(r.quantity_t, quantity_t),
         incoterm          = COALESCE(r.incoterm, incoterm),
         payment_instrument = COALESCE(r.payment_terms, payment_instrument),
         updated_at        = now()
   WHERE id = r.trade_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.respond_trade_terms(uuid,text,text) TO authenticated, service_role;

-- Hilo de negociación de una operación (para la UI).
CREATE OR REPLACE FUNCTION public.get_trade_negotiation(p_trade_id uuid)
RETURNS TABLE (
  id uuid, party text, price_usd_t numeric, quantity_t numeric, incoterm text,
  port_loading text, port_discharge text, delivery_from date, delivery_to date,
  payment_terms text, shipping_notes text, valid_until date, message text,
  status text, replies_to uuid, created_by uuid, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, party, price_usd_t, quantity_t, incoterm, port_loading, port_discharge,
         delivery_from, delivery_to, payment_terms, shipping_notes, valid_until, message,
         status, replies_to, created_by, created_at
  FROM public.trade_negotiations WHERE trade_id = p_trade_id
  ORDER BY created_at;
$$;
GRANT EXECUTE ON FUNCTION public.get_trade_negotiation(uuid) TO authenticated, service_role;
