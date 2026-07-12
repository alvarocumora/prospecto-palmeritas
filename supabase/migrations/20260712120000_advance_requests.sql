-- =========================================================
-- advance_requests: registro y workflow de solicitudes de anticipo.
--
-- El productor (vendedor del lote) solicita un anticipo contra su lote
-- verificado; el motor de underwriting guarda un snapshot de la oferta
-- pre-aprobada al momento de solicitar. El financista (super admin) revisa y
-- avanza el estado (en revisión → aprobado → desembolsado / rechazado).
-- Es gestión de estado y trazabilidad; NO mueve dinero (el escrow es aparte).
-- =========================================================
CREATE TABLE IF NOT EXISTS public.advance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES public.commodity_lots(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL,
  -- Snapshot de la oferta del motor de underwriting al solicitar.
  eligibility text NOT NULL,               -- eligible | conditional
  advance_rate_pct integer NOT NULL,
  max_advance_usd numeric NOT NULL,
  lot_value_usd numeric,
  risk_score integer,
  indicative_fee_pct numeric,
  tenor_days integer,
  offer_snapshot jsonb,                     -- factores + condiciones del motor
  -- Solicitud del productor.
  requested_amount_usd numeric NOT NULL,
  purpose text,
  status text NOT NULL DEFAULT 'requested', -- requested|under_review|approved|funded|rejected|cancelled
  -- Decisión del financista.
  reviewer_user_id uuid,
  decision_notes text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advance_requests_requester ON public.advance_requests(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_advance_requests_lot ON public.advance_requests(lot_id);
CREATE INDEX IF NOT EXISTS idx_advance_requests_status ON public.advance_requests(status, created_at DESC);

ALTER TABLE public.advance_requests ENABLE ROW LEVEL SECURITY;

-- El solicitante ve las suyas; el super admin (financista) ve todas.
CREATE POLICY "Requester or funder views advance requests"
  ON public.advance_requests FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid() OR is_super_admin(auth.uid()));

-- El solicitante crea su propia solicitud.
CREATE POLICY "Requester creates advance request"
  ON public.advance_requests FOR INSERT TO authenticated
  WITH CHECK (requester_user_id = auth.uid());

-- El solicitante actualiza las suyas (para cancelar); el super admin cualquiera
-- (para avanzar la revisión). La validez de la transición se controla en la app.
CREATE POLICY "Requester or funder updates advance request"
  ON public.advance_requests FOR UPDATE TO authenticated
  USING (requester_user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE TRIGGER trg_advance_requests_updated
  BEFORE UPDATE ON public.advance_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
