CREATE TABLE IF NOT EXISTS public.document_sign_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  template_id text NOT NULL,
  reference text NOT NULL,
  title text NOT NULL,
  doc jsonb NOT NULL,
  doc_hash text NOT NULL,
  signer_name_expected text,
  signer_email text,
  token_prefix text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  signed_by_name text,
  signed_at timestamptz,
  signature_hash text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_sign_requests_owner ON public.document_sign_requests(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_sign_requests_token ON public.document_sign_requests(token_hash) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.document_sign_requests TO authenticated;
GRANT ALL ON public.document_sign_requests TO service_role;

ALTER TABLE public.document_sign_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner views own sign requests" ON public.document_sign_requests;
CREATE POLICY "Owner views own sign requests"
  ON public.document_sign_requests FOR SELECT TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Owner creates own sign requests" ON public.document_sign_requests;
CREATE POLICY "Owner creates own sign requests"
  ON public.document_sign_requests FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Owner updates own sign requests" ON public.document_sign_requests;
CREATE POLICY "Owner updates own sign requests"
  ON public.document_sign_requests FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

DROP TRIGGER IF EXISTS trg_doc_sign_requests_updated ON public.document_sign_requests;
CREATE TRIGGER trg_doc_sign_requests_updated
  BEFORE UPDATE ON public.document_sign_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();