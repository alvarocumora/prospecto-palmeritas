
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
  v_status text := 'not_found';
  v_signer_masked text := NULL;
BEGIN
  IF p_ref IS NULL OR length(trim(p_ref)) = 0 THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

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
      'status', v_status,
      'reference', v_req.reference,
      'title', v_req.title,
      'template_id', v_req.template_id,
      'created_at', v_req.created_at,
      'updated_at', v_req.updated_at,
      'signed_at', v_req.signed_at,
      'expires_at', v_req.expires_at,
      'signer', v_signer_masked
    );
  END IF;

  SELECT template_id, reference, created_at, updated_at
    INTO v_draft
    FROM public.document_drafts
   WHERE reference = p_ref
   ORDER BY updated_at DESC
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'draft',
      'reference', v_draft.reference,
      'template_id', v_draft.template_id,
      'created_at', v_draft.created_at,
      'updated_at', v_draft.updated_at
    );
  END IF;

  RETURN jsonb_build_object('status', 'not_found', 'reference', p_ref);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_document(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_document(text) TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_doc_sign_requests_reference
  ON public.document_sign_requests (reference);
CREATE INDEX IF NOT EXISTS idx_document_drafts_reference
  ON public.document_drafts (reference);
