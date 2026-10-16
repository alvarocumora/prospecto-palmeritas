CREATE TABLE public.investment_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code text NOT NULL UNIQUE DEFAULT ('TCK-' || to_char(now(),'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  investor_user_id uuid NOT NULL,
  spv_id uuid REFERENCES public.spv_entities(id) ON DELETE RESTRICT,
  listing_ref text,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','CLP','UF')),
  share_price numeric(18,6),
  shares_allocated numeric(18,6),
  instrument_type text NOT NULL DEFAULT 'equity_spv' CHECK (instrument_type IN ('equity_spv','convertible_note','royalty_npr','colateral_fixed')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_kyc','contract_pending','signed','payment_pending','settled','cancelled')),
  risk_disclosure_accepted_at timestamptz,
  contract_hash text,
  contract_pdf_url text,
  signed_at timestamptz,
  investor_signature_name text,
  signature_ip text,
  payment_proof_url text,
  payment_submitted_at timestamptz,
  payment_verified_at timestamptz,
  payment_verified_by uuid,
  spv_position_id uuid REFERENCES public.spv_positions(id) ON DELETE SET NULL,
  cancel_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (spv_id IS NOT NULL OR listing_ref IS NOT NULL)
);
CREATE INDEX ON public.investment_tickets(investor_user_id);
CREATE INDEX ON public.investment_tickets(spv_id);
CREATE INDEX ON public.investment_tickets(status);

CREATE TABLE public.investment_ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.investment_tickets(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_user_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.investment_ticket_events(ticket_id);

GRANT SELECT, INSERT ON public.investment_tickets TO authenticated;
GRANT UPDATE ON public.investment_tickets TO authenticated;
GRANT ALL ON public.investment_tickets TO service_role;
GRANT SELECT ON public.investment_ticket_events TO authenticated;
GRANT ALL ON public.investment_ticket_events TO service_role;

ALTER TABLE public.investment_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_ticket_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select_own_or_staff" ON public.investment_tickets FOR SELECT TO authenticated
  USING (investor_user_id = auth.uid() OR public.is_geocapitals_staff(auth.uid()));
CREATE POLICY "tickets_insert_own_draft" ON public.investment_tickets FOR INSERT TO authenticated
  WITH CHECK (investor_user_id = auth.uid() AND status = 'draft' AND contract_hash IS NULL AND signed_at IS NULL AND payment_verified_at IS NULL AND spv_position_id IS NULL);
CREATE POLICY "tickets_update_staff" ON public.investment_tickets FOR UPDATE TO authenticated
  USING (public.is_geocapitals_staff(auth.uid())) WITH CHECK (public.is_geocapitals_staff(auth.uid()));
CREATE POLICY "ticket_events_select" ON public.investment_ticket_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.investment_tickets t WHERE t.id = ticket_id AND (t.investor_user_id = auth.uid() OR public.is_geocapitals_staff(auth.uid()))));

-- Shares calc + updated_at + status machine
CREATE OR REPLACE FUNCTION public.investment_tickets_before()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE allowed text[];
BEGIN
  IF TG_OP = 'INSERT' AND NEW.spv_id IS NOT NULL THEN
    SELECT share_price INTO NEW.share_price FROM public.spv_entities WHERE id = NEW.spv_id;
  END IF;
  IF NEW.share_price IS NOT NULL AND NEW.share_price > 0 THEN
    NEW.shares_allocated := round(NEW.amount / NEW.share_price, 6);
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    IF NEW.status <> OLD.status THEN
      allowed := CASE OLD.status
        WHEN 'draft' THEN ARRAY['pending_kyc','contract_pending','cancelled']
        WHEN 'pending_kyc' THEN ARRAY['contract_pending','cancelled']
        WHEN 'contract_pending' THEN ARRAY['signed','cancelled']
        WHEN 'signed' THEN ARRAY['payment_pending','cancelled']
        WHEN 'payment_pending' THEN ARRAY['settled','cancelled']
        ELSE ARRAY[]::text[] END;
      IF NOT (NEW.status = ANY(allowed)) THEN
        RAISE EXCEPTION 'Transición de ticket inválida: % -> %', OLD.status, NEW.status;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER investment_tickets_before BEFORE INSERT OR UPDATE ON public.investment_tickets
  FOR EACH ROW EXECUTE FUNCTION public.investment_tickets_before();

CREATE OR REPLACE FUNCTION public.investment_tickets_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.investment_ticket_events(ticket_id,from_status,to_status,actor_user_id,note) VALUES (NEW.id,NULL,NEW.status,auth.uid(),'Ticket creado');
  ELSIF NEW.status <> OLD.status THEN
    INSERT INTO public.investment_ticket_events(ticket_id,from_status,to_status,actor_user_id) VALUES (NEW.id,OLD.status,NEW.status,auth.uid());
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.investment_tickets_log() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER investment_tickets_log AFTER INSERT OR UPDATE ON public.investment_tickets
  FOR EACH ROW EXECUTE FUNCTION public.investment_tickets_log();

-- Investor actions
CREATE OR REPLACE FUNCTION public.ticket_sign_contract(_ticket_id uuid, _signature_name text, _contract_hash text, _contract_pdf_url text DEFAULT NULL)
RETURNS public.investment_tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.investment_tickets;
BEGIN
  SELECT * INTO t FROM public.investment_tickets WHERE id = _ticket_id FOR UPDATE;
  IF t.id IS NULL OR t.investor_user_id <> auth.uid() THEN RAISE EXCEPTION 'Ticket no encontrado'; END IF;
  IF t.status <> 'contract_pending' THEN RAISE EXCEPTION 'El contrato no está disponible para firma'; END IF;
  IF length(coalesce(trim(_signature_name),'')) < 3 OR length(coalesce(_contract_hash,'')) < 32 THEN RAISE EXCEPTION 'Firma o hash inválido'; END IF;
  UPDATE public.investment_tickets SET status='signed', investor_signature_name=trim(_signature_name), contract_hash=_contract_hash,
    contract_pdf_url=coalesce(_contract_pdf_url, contract_pdf_url), signed_at=now(), risk_disclosure_accepted_at=now()
  WHERE id=_ticket_id RETURNING * INTO t;
  UPDATE public.investment_tickets SET status='payment_pending' WHERE id=_ticket_id RETURNING * INTO t;
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.ticket_submit_payment(_ticket_id uuid, _proof_url text)
RETURNS public.investment_tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.investment_tickets;
BEGIN
  SELECT * INTO t FROM public.investment_tickets WHERE id=_ticket_id FOR UPDATE;
  IF t.id IS NULL OR t.investor_user_id <> auth.uid() THEN RAISE EXCEPTION 'Ticket no encontrado'; END IF;
  IF t.status <> 'payment_pending' THEN RAISE EXCEPTION 'El ticket no espera comprobante'; END IF;
  UPDATE public.investment_tickets SET payment_proof_url=_proof_url, payment_submitted_at=now() WHERE id=_ticket_id RETURNING * INTO t;
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.ticket_cancel(_ticket_id uuid, _reason text DEFAULT NULL)
RETURNS public.investment_tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.investment_tickets; staff boolean := public.is_geocapitals_staff(auth.uid());
BEGIN
  SELECT * INTO t FROM public.investment_tickets WHERE id=_ticket_id FOR UPDATE;
  IF t.id IS NULL OR (t.investor_user_id <> auth.uid() AND NOT staff) THEN RAISE EXCEPTION 'Ticket no encontrado'; END IF;
  IF NOT staff AND t.status NOT IN ('draft','pending_kyc','contract_pending') THEN RAISE EXCEPTION 'Solo staff puede cancelar un ticket firmado'; END IF;
  UPDATE public.investment_tickets SET status='cancelled', cancel_reason=_reason WHERE id=_ticket_id RETURNING * INTO t;
  RETURN t;
END $$;

-- Staff: settle and issue SPV position
CREATE OR REPLACE FUNCTION public.ticket_settle(_ticket_id uuid)
RETURNS public.investment_tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.investment_tickets; pos_id uuid; p_name text; p_email text;
BEGIN
  IF NOT public.is_geocapitals_staff(auth.uid()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO t FROM public.investment_tickets WHERE id=_ticket_id FOR UPDATE;
  IF t.id IS NULL OR t.status <> 'payment_pending' THEN RAISE EXCEPTION 'El ticket no está pendiente de pago'; END IF;
  IF t.payment_proof_url IS NULL THEN RAISE EXCEPTION 'Falta comprobante de pago'; END IF;
  IF t.spv_id IS NOT NULL THEN
    SELECT u.email INTO p_email FROM auth.users u WHERE u.id = t.investor_user_id;
    INSERT INTO public.spv_positions(spv_id, investor_user_id, investor_name, investor_email, shares, amount_paid, currency, instrument, subscribed_on, status, notes, created_by)
    VALUES (t.spv_id, t.investor_user_id, t.investor_signature_name, p_email, coalesce(t.shares_allocated,0), t.amount, t.currency, t.instrument_type, current_date, 'active', 'Emitida desde ticket ' || t.ticket_code, auth.uid())
    RETURNING id INTO pos_id;
  END IF;
  UPDATE public.investment_tickets SET status='settled', payment_verified_at=now(), payment_verified_by=auth.uid(), spv_position_id=pos_id
  WHERE id=_ticket_id RETURNING * INTO t;
  RETURN t;
END $$;

REVOKE EXECUTE ON FUNCTION public.ticket_sign_contract(uuid,text,text,text), public.ticket_submit_payment(uuid,text), public.ticket_cancel(uuid,text), public.ticket_settle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_sign_contract(uuid,text,text,text), public.ticket_submit_payment(uuid,text), public.ticket_cancel(uuid,text), public.ticket_settle(uuid) TO authenticated;