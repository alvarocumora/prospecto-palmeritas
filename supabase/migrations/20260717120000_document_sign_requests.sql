-- =========================================================
-- document_sign_requests: firma electrónica de documentos del
-- editor (NDA, term sheets, data sheets…) por contrapartes
-- EXTERNAS vía link tokenizado — complementa a
-- signature_envelopes (firmantes internos por proyecto).
--
-- Seguridad: del token solo se persiste su hash SHA-256
-- (mismo patrón que api_keys); el snapshot del documento y su
-- doc_hash quedan congelados al solicitar la firma, y al
-- firmar se registra signature_hash = sha256(doc_hash | nombre
-- | timestamp | token_hash) como evidencia de integridad.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.document_sign_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  template_id text NOT NULL,
  reference text NOT NULL,
  title text NOT NULL,
  doc jsonb NOT NULL,                   -- snapshot GeneratedDoc congelado
  doc_hash text NOT NULL,               -- sha256 del snapshot canónico
  signer_name_expected text,            -- a quién se le pide firmar (opcional)
  signer_email text,
  token_prefix text NOT NULL,           -- para display (gcsign_ab12…)
  token_hash text NOT NULL UNIQUE,      -- sha256 del token completo
  status text NOT NULL DEFAULT 'pending', -- pending | signed | void
  signed_by_name text,
  signed_at timestamptz,
  signature_hash text,                  -- evidencia de integridad de la firma
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_sign_requests_owner ON public.document_sign_requests(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_sign_requests_token ON public.document_sign_requests(token_hash) WHERE status = 'pending';

ALTER TABLE public.document_sign_requests ENABLE ROW LEVEL SECURITY;

-- El solicitante gestiona las suyas. El flujo público (página /firmar/$token)
-- opera vía service role validando el token por hash — sin política pública.
CREATE POLICY "Owner views own sign requests"
  ON public.document_sign_requests FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Owner creates own sign requests"
  ON public.document_sign_requests FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owner updates own sign requests"
  ON public.document_sign_requests FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE TRIGGER trg_doc_sign_requests_updated
  BEFORE UPDATE ON public.document_sign_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
