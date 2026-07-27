-- OPERACIONES · Habilita negociación por LINK público (WhatsApp / portal sin cuenta).
--
-- Una contraparte que entra por un link tokenizado no tiene sesión: el server fn de
-- Lovable valida el token y llama a estos RPC vía service client (sin auth.uid()).
-- Antes propose/respond exigían auth.uid() y rompían ese flujo. Se relaja: se registra
-- auth.uid() si existe (usuario logueado) y se permite null (flujo por token, donde el
-- server fn ya validó el enlace). El grant sigue siendo authenticated/service_role
-- (nunca anon): el gatekeeper del token es el server fn.
--
-- record_trade_screening NO se toca: el screening lo hace staff GC autenticado.

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
  IF p_party NOT IN ('buyer','seller','geocapitals') THEN
    RAISE EXCEPTION 'parte inválida: %', p_party;
  END IF;
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
     p_replies_to, auth.uid())            -- null en flujo por token (server fn ya validó)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.propose_trade_terms(uuid,text,numeric,numeric,text,text,text,date,date,text,text,date,text,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.respond_trade_terms(
  p_offer_id uuid, p_action text, p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.trade_negotiations%ROWTYPE;
BEGIN
  IF p_action NOT IN ('accept','reject') THEN RAISE EXCEPTION 'acción inválida: %', p_action; END IF;
  SELECT * INTO r FROM public.trade_negotiations WHERE id = p_offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'propuesta % no existe', p_offer_id; END IF;
  IF r.status <> 'proposed' THEN RAISE EXCEPTION 'la propuesta ya no está abierta (estado %)', r.status; END IF;

  IF p_action = 'reject' THEN
    UPDATE public.trade_negotiations SET status = 'rejected', message = COALESCE(p_note, message) WHERE id = p_offer_id;
    RETURN;
  END IF;

  UPDATE public.trade_negotiations SET status = 'accepted', message = COALESCE(p_note, message) WHERE id = p_offer_id;
  UPDATE public.trade_negotiations SET status = 'superseded'
   WHERE trade_id = r.trade_id AND id <> p_offer_id AND status = 'proposed';
  UPDATE public.commodity_trades
     SET unit_price_usd     = COALESCE(r.price_usd_t, unit_price_usd),
         quantity_t         = COALESCE(r.quantity_t, quantity_t),
         incoterm           = COALESCE(r.incoterm, incoterm),
         payment_instrument = COALESCE(r.payment_terms, payment_instrument),
         updated_at         = now()
   WHERE id = r.trade_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.respond_trade_terms(uuid,text,text) TO authenticated, service_role;
