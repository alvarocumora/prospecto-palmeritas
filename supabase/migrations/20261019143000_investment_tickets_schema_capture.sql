-- Captura retroactiva del esquema real de investment_tickets, su bitácora
-- de eventos, el trigger que fuerza la máquina de estados y las 5 RPCs
-- SECURITY DEFINER que mutan tickets. Ninguna de estas piezas tenía
-- migración en el repo pese a estar en producción desde hace meses — se
-- crearon directo en el proyecto Supabase. Esta migración documenta el
-- estado real (introspeccionado el 2026-10-19 vía SQL Editor) para que el
-- esquema vuelva a ser reproducible desde el repo.
--
-- `ON CONFLICT DO NOTHING` / `CREATE ... IF NOT EXISTS` en todo el archivo:
-- en el proyecto donde esto ya existe, esta migración es un no-op; en un
-- proyecto nuevo, la crea desde cero.

CREATE TABLE IF NOT EXISTS public.investment_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_code text NOT NULL DEFAULT
    (('TCK-'::text || to_char(now(), 'YYYY'::text)) || '-'::text) ||
    upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 8)),
  investor_user_id uuid NOT NULL,
  spv_id uuid,
  listing_ref text,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD'::text,
  share_price numeric(18,6),
  shares_allocated numeric(18,6),
  instrument_type text NOT NULL DEFAULT 'equity_spv'::text,
  status text NOT NULL DEFAULT 'draft'::text,
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
  spv_position_id uuid,
  cancel_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT investment_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT investment_tickets_ticket_code_key UNIQUE (ticket_code),
  CONSTRAINT investment_tickets_spv_id_fkey FOREIGN KEY (spv_id)
    REFERENCES public.spv_entities(id) ON DELETE RESTRICT,
  CONSTRAINT investment_tickets_spv_position_id_fkey FOREIGN KEY (spv_position_id)
    REFERENCES public.spv_positions(id) ON DELETE SET NULL,
  CONSTRAINT investment_tickets_amount_check CHECK (amount > 0::numeric),
  CONSTRAINT investment_tickets_spv_or_listing_check
    CHECK (spv_id IS NOT NULL OR listing_ref IS NOT NULL),
  CONSTRAINT investment_tickets_currency_check
    CHECK (currency = ANY (ARRAY['USD'::text, 'CLP'::text, 'UF'::text])),
  CONSTRAINT investment_tickets_instrument_type_check CHECK (instrument_type = ANY (ARRAY[
    'equity_spv'::text, 'convertible_note'::text, 'royalty_npr'::text, 'colateral_fixed'::text
  ])),
  CONSTRAINT investment_tickets_status_check CHECK (status = ANY (ARRAY[
    'draft'::text, 'pending_kyc'::text, 'contract_pending'::text, 'signed'::text,
    'payment_pending'::text, 'settled'::text, 'cancelled'::text
  ]))
);

CREATE INDEX IF NOT EXISTS investment_tickets_investor_user_id_idx
  ON public.investment_tickets USING btree (investor_user_id);
CREATE INDEX IF NOT EXISTS investment_tickets_spv_id_idx
  ON public.investment_tickets USING btree (spv_id);
CREATE INDEX IF NOT EXISTS investment_tickets_status_idx
  ON public.investment_tickets USING btree (status);

GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON public.investment_tickets TO authenticated;
GRANT SELECT, INSERT, REFERENCES, TRIGGER, TRUNCATE
  ON public.investment_tickets TO anon;
GRANT SELECT, INSERT ON public.investment_tickets TO sandbox_exec;
GRANT ALL ON public.investment_tickets TO service_role;

ALTER TABLE public.investment_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tickets_insert_own_draft ON public.investment_tickets;
CREATE POLICY tickets_insert_own_draft ON public.investment_tickets FOR INSERT TO authenticated
  WITH CHECK (
    investor_user_id = auth.uid()
    AND status = 'draft'
    AND contract_hash IS NULL
    AND signed_at IS NULL
    AND payment_verified_at IS NULL
    AND spv_position_id IS NULL
  );

DROP POLICY IF EXISTS tickets_select_own_or_staff ON public.investment_tickets;
CREATE POLICY tickets_select_own_or_staff ON public.investment_tickets FOR SELECT TO authenticated
  USING (investor_user_id = auth.uid() OR public.is_geocapitals_staff(auth.uid()));

DROP POLICY IF EXISTS tickets_update_staff ON public.investment_tickets;
CREATE POLICY tickets_update_staff ON public.investment_tickets FOR UPDATE TO authenticated
  USING (public.is_geocapitals_staff(auth.uid()))
  WITH CHECK (public.is_geocapitals_staff(auth.uid()));

-- Nota: no hay policy de DELETE para anon/authenticated — las filas solo se
-- borran con service_role. Los GRANT DELETE/UPDATE a anon y authenticated de
-- arriba son los que ya existían en producción; quedan tal cual para que esta
-- migración sea un no-op ahí. Vale la pena que el equipo revise si `anon`
-- necesita de verdad ese grant de tabla (RLS lo bloquea hoy, pero es
-- superficie de más de lo necesario).

-- Bitácora de transiciones de estado (poblada por el trigger
-- investment_tickets_log). Esta tabla no se pudo introspeccionar en el SQL
-- Editor (no se pidió su DDL), así que sus columnas vienen de
-- src/integrations/supabase/types.ts y su RLS es una reconstrucción
-- razonable, no una copia verificada de producción.
CREATE TABLE IF NOT EXISTS public.investment_ticket_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.investment_tickets(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_user_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT investment_ticket_events_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS investment_ticket_events_ticket_id_idx
  ON public.investment_ticket_events USING btree (ticket_id);

GRANT SELECT, INSERT ON public.investment_ticket_events TO authenticated;
GRANT ALL ON public.investment_ticket_events TO service_role;
ALTER TABLE public.investment_ticket_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investment_ticket_events_own_read ON public.investment_ticket_events;
CREATE POLICY investment_ticket_events_own_read ON public.investment_ticket_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.investment_tickets t
    WHERE t.id = investment_ticket_events.ticket_id AND t.investor_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS investment_ticket_events_staff_all ON public.investment_ticket_events;
CREATE POLICY investment_ticket_events_staff_all ON public.investment_ticket_events
  FOR ALL TO authenticated
  USING (public.is_geocapitals_staff(auth.uid()))
  WITH CHECK (public.is_geocapitals_staff(auth.uid()));

-- Trigger: calcula shares_allocated y fuerza la máquina de estados.
CREATE OR REPLACE FUNCTION public.investment_tickets_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  allowed text[];
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
        WHEN 'draft' THEN ARRAY['pending_kyc', 'contract_pending', 'cancelled']
        WHEN 'pending_kyc' THEN ARRAY['contract_pending', 'cancelled']
        WHEN 'contract_pending' THEN ARRAY['signed', 'cancelled']
        WHEN 'signed' THEN ARRAY['payment_pending', 'cancelled']
        WHEN 'payment_pending' THEN ARRAY['settled', 'cancelled']
        ELSE ARRAY[]::text[]
      END;
      IF NOT (NEW.status = ANY(allowed)) THEN
        RAISE EXCEPTION 'Transición de ticket inválida: % -> %', OLD.status, NEW.status;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

-- Trigger: registra cada transición en investment_ticket_events.
CREATE OR REPLACE FUNCTION public.investment_tickets_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.investment_ticket_events(ticket_id, from_status, to_status, actor_user_id, note)
    VALUES (NEW.id, NULL, NEW.status, auth.uid(), 'Ticket creado');
  ELSIF NEW.status <> OLD.status THEN
    INSERT INTO public.investment_ticket_events(ticket_id, from_status, to_status, actor_user_id)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS investment_tickets_before ON public.investment_tickets;
CREATE TRIGGER investment_tickets_before
  BEFORE INSERT OR UPDATE ON public.investment_tickets
  FOR EACH ROW EXECUTE FUNCTION public.investment_tickets_before();

DROP TRIGGER IF EXISTS investment_tickets_log ON public.investment_tickets;
CREATE TRIGGER investment_tickets_log
  AFTER INSERT OR UPDATE ON public.investment_tickets
  FOR EACH ROW EXECUTE FUNCTION public.investment_tickets_log();

-- RPCs SECURITY DEFINER que mutan tickets (investor_user_id = auth.uid() o
-- staff, según el caso; el trigger de arriba sigue validando la transición).

CREATE OR REPLACE FUNCTION public.ticket_submit_for_review(_ticket_id uuid)
RETURNS public.investment_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.investment_tickets;
  s public.spv_entities;
BEGIN
  SELECT * INTO t FROM public.investment_tickets WHERE id = _ticket_id FOR UPDATE;
  IF t.id IS NULL OR t.investor_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Ticket no encontrado';
  END IF;
  IF t.status <> 'draft' THEN
    RAISE EXCEPTION 'El ticket ya fue enviado';
  END IF;
  SELECT * INTO s FROM public.spv_entities WHERE id = t.spv_id;
  IF s.id IS NULL OR NOT s.tickets_open THEN
    RAISE EXCEPTION 'La ronda no está abierta';
  END IF;
  IF s.min_ticket IS NOT NULL AND t.amount < s.min_ticket THEN
    RAISE EXCEPTION 'Monto bajo el ticket mínimo';
  END IF;
  UPDATE public.investment_tickets
    SET status = 'pending_kyc', risk_disclosure_accepted_at = now()
    WHERE id = _ticket_id
    RETURNING * INTO t;
  RETURN t;
END
$function$;

CREATE OR REPLACE FUNCTION public.ticket_sign_contract(
  _ticket_id uuid, _signature_name text, _contract_hash text, _contract_pdf_url text DEFAULT NULL::text
)
RETURNS public.investment_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.investment_tickets;
BEGIN
  SELECT * INTO t FROM public.investment_tickets WHERE id = _ticket_id FOR UPDATE;
  IF t.id IS NULL OR t.investor_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Ticket no encontrado';
  END IF;
  IF t.status <> 'contract_pending' THEN
    RAISE EXCEPTION 'El contrato no está disponible para firma';
  END IF;
  IF length(coalesce(trim(_signature_name), '')) < 3 OR length(coalesce(_contract_hash, '')) < 32 THEN
    RAISE EXCEPTION 'Firma o hash inválido';
  END IF;
  UPDATE public.investment_tickets
    SET status = 'signed',
        investor_signature_name = trim(_signature_name),
        contract_hash = _contract_hash,
        contract_pdf_url = coalesce(_contract_pdf_url, contract_pdf_url),
        signed_at = now(),
        risk_disclosure_accepted_at = now()
    WHERE id = _ticket_id
    RETURNING * INTO t;
  UPDATE public.investment_tickets SET status = 'payment_pending' WHERE id = _ticket_id RETURNING * INTO t;
  RETURN t;
END
$function$;

CREATE OR REPLACE FUNCTION public.ticket_submit_payment(_ticket_id uuid, _proof_url text)
RETURNS public.investment_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.investment_tickets;
BEGIN
  SELECT * INTO t FROM public.investment_tickets WHERE id = _ticket_id FOR UPDATE;
  IF t.id IS NULL OR t.investor_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Ticket no encontrado';
  END IF;
  IF t.status <> 'payment_pending' THEN
    RAISE EXCEPTION 'El ticket no espera comprobante';
  END IF;
  UPDATE public.investment_tickets
    SET payment_proof_url = _proof_url, payment_submitted_at = now()
    WHERE id = _ticket_id
    RETURNING * INTO t;
  RETURN t;
END
$function$;

CREATE OR REPLACE FUNCTION public.ticket_cancel(_ticket_id uuid, _reason text DEFAULT NULL::text)
RETURNS public.investment_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.investment_tickets;
  staff boolean := public.is_geocapitals_staff(auth.uid());
BEGIN
  SELECT * INTO t FROM public.investment_tickets WHERE id = _ticket_id FOR UPDATE;
  IF t.id IS NULL OR (t.investor_user_id <> auth.uid() AND NOT staff) THEN
    RAISE EXCEPTION 'Ticket no encontrado';
  END IF;
  IF NOT staff AND t.status NOT IN ('draft', 'pending_kyc', 'contract_pending') THEN
    RAISE EXCEPTION 'Solo staff puede cancelar un ticket firmado';
  END IF;
  UPDATE public.investment_tickets
    SET status = 'cancelled', cancel_reason = _reason
    WHERE id = _ticket_id
    RETURNING * INTO t;
  RETURN t;
END
$function$;

CREATE OR REPLACE FUNCTION public.ticket_settle(_ticket_id uuid)
RETURNS public.investment_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.investment_tickets;
  pos_id uuid;
  p_email text;
BEGIN
  IF NOT public.is_geocapitals_staff(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  SELECT * INTO t FROM public.investment_tickets WHERE id = _ticket_id FOR UPDATE;
  IF t.id IS NULL OR t.status <> 'payment_pending' THEN
    RAISE EXCEPTION 'El ticket no está pendiente de pago';
  END IF;
  IF t.payment_proof_url IS NULL THEN
    RAISE EXCEPTION 'Falta comprobante de pago';
  END IF;
  IF t.spv_id IS NOT NULL THEN
    SELECT u.email INTO p_email FROM auth.users u WHERE u.id = t.investor_user_id;
    INSERT INTO public.spv_positions(
      spv_id, investor_user_id, investor_name, investor_email, shares, amount_paid,
      currency, instrument, subscribed_on, status, notes, created_by
    )
    VALUES (
      t.spv_id, t.investor_user_id, t.investor_signature_name, p_email,
      coalesce(t.shares_allocated, 0), t.amount, t.currency, t.instrument_type,
      current_date, 'active', 'Emitida desde ticket ' || t.ticket_code, auth.uid()
    )
    RETURNING id INTO pos_id;
  END IF;
  UPDATE public.investment_tickets
    SET status = 'settled', payment_verified_at = now(), payment_verified_by = auth.uid(), spv_position_id = pos_id
    WHERE id = _ticket_id
    RETURNING * INTO t;
  RETURN t;
END
$function$;
