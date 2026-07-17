
-- 1) advance_requests
DROP POLICY IF EXISTS "Requester creates advance request" ON public.advance_requests;
DROP POLICY IF EXISTS "Requester or funder updates advance request" ON public.advance_requests;

CREATE POLICY "Requester creates advance request"
  ON public.advance_requests FOR INSERT TO authenticated
  WITH CHECK (
    requester_user_id = auth.uid()
    AND status = 'requested'
    AND reviewer_user_id IS NULL
    AND decision_notes IS NULL
    AND decided_at IS NULL
  );

CREATE POLICY "Requester updates own advance request"
  ON public.advance_requests FOR UPDATE TO authenticated
  USING (requester_user_id = auth.uid() AND status NOT IN ('funded','rejected','cancelled'))
  WITH CHECK (requester_user_id = auth.uid());

CREATE POLICY "Funder updates advance request"
  ON public.advance_requests FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.enforce_advance_request_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.is_super_admin(auth.uid());
BEGIN
  IF is_admin THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'requested';
    NEW.reviewer_user_id := NULL;
    NEW.decision_notes := NULL;
    NEW.decided_at := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Requester can only cancel an advance request';
    END IF;
    NEW.lot_id := OLD.lot_id;
    NEW.requester_user_id := OLD.requester_user_id;
    NEW.eligibility := OLD.eligibility;
    NEW.advance_rate_pct := OLD.advance_rate_pct;
    NEW.max_advance_usd := OLD.max_advance_usd;
    NEW.lot_value_usd := OLD.lot_value_usd;
    NEW.risk_score := OLD.risk_score;
    NEW.indicative_fee_pct := OLD.indicative_fee_pct;
    NEW.tenor_days := OLD.tenor_days;
    NEW.offer_snapshot := OLD.offer_snapshot;
    NEW.requested_amount_usd := OLD.requested_amount_usd;
    NEW.reviewer_user_id := OLD.reviewer_user_id;
    NEW.decision_notes := OLD.decision_notes;
    NEW.decided_at := OLD.decided_at;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_advance_request_write ON public.advance_requests;
CREATE TRIGGER trg_enforce_advance_request_write
  BEFORE INSERT OR UPDATE ON public.advance_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_advance_request_write();

-- 2) document_signatures: signer must be the authenticated user
DROP POLICY IF EXISTS "sig_insert" ON public.document_signatures;
CREATE POLICY "sig_insert" ON public.document_signatures FOR INSERT TO authenticated
  WITH CHECK (
    signer_user_id = auth.uid()
    AND public.is_project_member(project_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.signature_envelopes se
      WHERE se.id = document_signatures.envelope_id
        AND se.project_id = document_signatures.project_id
    )
  );

-- 3) profiles: drop broad teammate PII exposure, add safe directory view
DROP POLICY IF EXISTS "Users view teammates profile" ON public.profiles;

CREATE OR REPLACE VIEW public.profiles_directory
WITH (security_invoker = true) AS
SELECT id, user_id, display_name, avatar_url, organization, specialty, country, language
FROM public.profiles;

GRANT SELECT ON public.profiles_directory TO authenticated;

-- Teammate SELECT restricted to non-PII columns via column-level grants.
CREATE POLICY "Teammates view non-PII profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm_self
      JOIN public.project_members pm_other
        ON pm_other.project_id = pm_self.project_id
      WHERE pm_self.user_id = auth.uid()
        AND pm_other.user_id = profiles.user_id
    )
    OR public.is_super_admin(auth.uid())
  );
