
-- 1) Public registry for issued documents (institutional / special / ad-hoc)
CREATE TABLE IF NOT EXISTS public.document_registry (
  reference text PRIMARY KEY,
  title text NOT NULL,
  template_id text,
  doc_type text,
  issuer text DEFAULT 'Geocapitals',
  status text NOT NULL DEFAULT 'issued', -- issued | void
  issued_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.document_registry TO anon, authenticated;
GRANT ALL ON public.document_registry TO service_role;

ALTER TABLE public.document_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read of document registry"
  ON public.document_registry FOR SELECT
  USING (true);

CREATE POLICY "Service role manages registry"
  ON public.document_registry FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 2) Seed known references currently referenced by the app
INSERT INTO public.document_registry (reference, title, template_id, doc_type, metadata) VALUES
  ('GC-NDA-AU-202607-9001',
   'NDA — Proyecto Aurífero 4,0 Moz Au (NI 43-101)',
   'nda-au-9001', 'NDA', '{"source":"specialDocs"}'::jsonb),
  ('GC-FICHA-AU-202607-9001',
   'Ficha de Consulta — Proyecto Aurífero 4,0 Moz Au (NI 43-101)',
   'ficha-au-9001', 'FICHA', '{"source":"specialDocs"}'::jsonb),
  ('GC-ADENDA-REE-TRENTO-202607-1',
   'Adenda REE — Trento Mining SpA',
   'adenda-ree-trento', 'ADENDA', '{"source":"specialDocs"}'::jsonb),
  ('GC-FICHA-REE-TRENTO-MB-202607-1',
   'Ficha REE Monacita/Bastnasita — Trento Mining SpA',
   'ficha-ree-trento-mb', 'FICHA', '{"source":"specialDocs"}'::jsonb),
  ('GC-NCNDA-SGX-ZBA-202607-1',
   'NCNDA — Geocapitals · SingularX · ZBALA LATAM',
   'ncnda-sgx-zba', 'NCNDA', '{"source":"specialDocs"}'::jsonb),
  ('GC-FICHA-SB-BRENA-202607-1',
   'Ficha Antimonio — Corporación Minera A&D (Breña, Honduras)',
   'ficha-sb-brena', 'FICHA', '{"source":"specialDocs"}'::jsonb),
  ('GC-CHQ-202607-001',
   'Informe Ejecutivo — Proyecto Cholqui (Financiamiento ENAMI Jul-2026)',
   'informe-cholqui', 'INFORME', '{"source":"executive-report"}'::jsonb)
ON CONFLICT (reference) DO UPDATE
  SET title = EXCLUDED.title,
      template_id = EXCLUDED.template_id,
      doc_type = EXCLUDED.doc_type,
      updated_at = now();

-- 3) Extend verify_document to fall back to trade_documents and document_registry
CREATE OR REPLACE FUNCTION public.verify_document(p_ref text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft record;
  v_req record;
  v_td record;
  v_reg record;
  v_status text := 'not_found';
  v_signer_masked text := NULL;
BEGIN
  IF p_ref IS NULL OR length(trim(p_ref)) = 0 THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- (a) Sign requests (in-app signature flow)
  SELECT template_id, reference, title, status, signed_by_name, signed_at,
         created_at, updated_at, expires_at
    INTO v_req
    FROM public.document_sign_requests
   WHERE reference = p_ref
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND THEN
    IF v_req.status = 'signed' THEN
      v_status := 'signed';
    ELSIF v_req.status = 'void' THEN
      v_status := 'void';
    ELSIF v_req.expires_at < now() THEN
      v_status := 'expired';
    ELSE
      v_status := 'pending_signature';
    END IF;

    IF v_req.signed_by_name IS NOT NULL AND length(v_req.signed_by_name) > 0 THEN
      v_signer_masked := left(v_req.signed_by_name, 1) ||
        repeat('•', greatest(length(v_req.signed_by_name) - 2, 1)) ||
        right(v_req.signed_by_name, 1);
    END IF;

    RETURN jsonb_build_object(
      'status', v_status, 'reference', v_req.reference, 'title', v_req.title,
      'template_id', v_req.template_id, 'created_at', v_req.created_at,
      'updated_at', v_req.updated_at, 'signed_at', v_req.signed_at,
      'expires_at', v_req.expires_at, 'signer', v_signer_masked
    );
  END IF;

  -- (b) Editor drafts
  SELECT template_id, reference, created_at, updated_at
    INTO v_draft
    FROM public.document_drafts
   WHERE reference = p_ref
   ORDER BY updated_at DESC
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'draft', 'reference', v_draft.reference,
      'template_id', v_draft.template_id,
      'created_at', v_draft.created_at, 'updated_at', v_draft.updated_at
    );
  END IF;

  -- (c) Trade documents (LOI/NCNDA/ICPO/SPA emitidos por Trade Desk)
  SELECT doc_type, reference, status, signed_at, created_at, updated_at, issuer
    INTO v_td
    FROM public.trade_documents
   WHERE reference = p_ref
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND THEN
    v_status := CASE
      WHEN v_td.status IN ('signed','verified') THEN 'signed'
      WHEN v_td.status = 'rejected' THEN 'void'
      ELSE 'pending_signature'
    END;
    RETURN jsonb_build_object(
      'status', v_status, 'reference', v_td.reference,
      'title', coalesce(v_td.issuer,'') || ' · ' || upper(v_td.doc_type),
      'template_id', v_td.doc_type,
      'created_at', v_td.created_at, 'updated_at', v_td.updated_at,
      'signed_at', v_td.signed_at
    );
  END IF;

  -- (d) Institutional / ad-hoc registry (informes ejecutivos, fichas oficiales)
  SELECT reference, title, template_id, doc_type, status, issued_at, updated_at
    INTO v_reg
    FROM public.document_registry
   WHERE reference = p_ref
   LIMIT 1;

  IF FOUND THEN
    v_status := CASE WHEN v_reg.status = 'void' THEN 'void' ELSE 'signed' END;
    RETURN jsonb_build_object(
      'status', v_status, 'reference', v_reg.reference,
      'title', v_reg.title, 'template_id', v_reg.template_id,
      'created_at', v_reg.issued_at, 'updated_at', v_reg.updated_at,
      'signed_at', v_reg.issued_at, 'signer', 'Geocapitals'
    );
  END IF;

  RETURN jsonb_build_object('status', 'not_found', 'reference', p_ref);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_document(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_document(text) TO anon, authenticated, service_role;
