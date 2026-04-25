CREATE TABLE public.signature_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_ref_id uuid,
  document_title text NOT NULL,
  document_hash text NOT NULL,
  document_storage_path text,
  status text NOT NULL DEFAULT 'pending',
  required_signers integer NOT NULL DEFAULT 1,
  completed_signers integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE public.document_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id uuid NOT NULL REFERENCES public.signature_envelopes(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  signer_user_id uuid NOT NULL,
  signer_name text NOT NULL,
  signer_role text NOT NULL,
  signer_email text,
  signing_order integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  signature_hmac text,
  signed_document_hash text,
  signed_at timestamptz,
  rejection_reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (envelope_id, signer_user_id)
);

CREATE TABLE public.signature_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id uuid NOT NULL REFERENCES public.signature_envelopes(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_user_id uuid,
  actor_name text,
  payload jsonb DEFAULT '{}'::jsonb,
  hash_chain text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_envelopes_project ON public.signature_envelopes(project_id, status);
CREATE INDEX idx_envelopes_doc ON public.signature_envelopes(document_type, document_ref_id);
CREATE INDEX idx_signatures_envelope ON public.document_signatures(envelope_id);
CREATE INDEX idx_signatures_signer ON public.document_signatures(signer_user_id, status);
CREATE INDEX idx_audit_envelope ON public.signature_audit_trail(envelope_id, created_at DESC);

ALTER TABLE public.signature_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "envelope_select" ON public.signature_envelopes FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "envelope_insert" ON public.signature_envelopes FOR INSERT
  WITH CHECK (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','chief_geologist']::project_role[]) AND created_by = auth.uid());
CREATE POLICY "envelope_update" ON public.signature_envelopes FOR UPDATE
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','chief_geologist']::project_role[]));
CREATE POLICY "envelope_delete" ON public.signature_envelopes FOR DELETE
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner']::project_role[]));

CREATE POLICY "sig_select" ON public.document_signatures FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "sig_insert" ON public.document_signatures FOR INSERT
  WITH CHECK (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','chief_geologist']::project_role[]));
CREATE POLICY "sig_update_own" ON public.document_signatures FOR UPDATE
  USING (signer_user_id = auth.uid() AND public.is_project_member(project_id, auth.uid()));

CREATE POLICY "audit_select" ON public.signature_audit_trail FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "audit_insert" ON public.signature_audit_trail FOR INSERT
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

CREATE TRIGGER trg_envelopes_updated_at BEFORE UPDATE ON public.signature_envelopes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_signature_envelope()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending','partial','complete','rejected','expired') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.document_type NOT IN ('qp_certificate','ni43101_report','compliance_report') THEN
    RAISE EXCEPTION 'Invalid document_type: %', NEW.document_type;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_envelope BEFORE INSERT OR UPDATE ON public.signature_envelopes
  FOR EACH ROW EXECUTE FUNCTION public.validate_signature_envelope();

CREATE OR REPLACE FUNCTION public.validate_document_signature()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending','signed','rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.signer_role NOT IN ('qp','reviewer','approver','auditor') THEN
    RAISE EXCEPTION 'Invalid signer_role: %', NEW.signer_role;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_signature BEFORE INSERT OR UPDATE ON public.document_signatures
  FOR EACH ROW EXECUTE FUNCTION public.validate_document_signature();

CREATE OR REPLACE FUNCTION public.on_signature_signed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  current_completed integer;
  required integer;
BEGIN
  IF NEW.status = 'signed' AND (OLD.status IS DISTINCT FROM 'signed') THEN
    SELECT completed_signers, required_signers INTO current_completed, required
      FROM public.signature_envelopes WHERE id = NEW.envelope_id;
    UPDATE public.signature_envelopes
    SET completed_signers = current_completed + 1,
        status = CASE WHEN current_completed + 1 >= required THEN 'complete' ELSE 'partial' END,
        completed_at = CASE WHEN current_completed + 1 >= required THEN now() ELSE completed_at END
    WHERE id = NEW.envelope_id;

    INSERT INTO public.signature_audit_trail (envelope_id, project_id, action, actor_user_id, actor_name, payload)
    VALUES (NEW.envelope_id, NEW.project_id, 'signed', NEW.signer_user_id, NEW.signer_name,
      jsonb_build_object('hmac', NEW.signature_hmac, 'role', NEW.signer_role));
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    UPDATE public.signature_envelopes SET status = 'rejected' WHERE id = NEW.envelope_id;
    INSERT INTO public.signature_audit_trail (envelope_id, project_id, action, actor_user_id, actor_name, payload)
    VALUES (NEW.envelope_id, NEW.project_id, 'rejected', NEW.signer_user_id, NEW.signer_name,
      jsonb_build_object('reason', NEW.rejection_reason));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_on_signature_signed AFTER UPDATE ON public.document_signatures
  FOR EACH ROW EXECUTE FUNCTION public.on_signature_signed();