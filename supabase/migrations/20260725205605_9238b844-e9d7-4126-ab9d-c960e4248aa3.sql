
-- ============================================================================
-- Firma de documentos vinculada a operaciones + versiones inmutables
-- ============================================================================

-- 1) Vincular envelopes a operaciones y persistir el operation_document firmado
ALTER TABLE public.signature_envelopes
  ADD COLUMN IF NOT EXISTS operation_id uuid REFERENCES public.operations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS operation_document_id uuid REFERENCES public.operation_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signed_document_id uuid REFERENCES public.operation_documents(id) ON DELETE SET NULL,
  ALTER COLUMN project_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_envelopes_operation ON public.signature_envelopes(operation_id, status);

-- 2) Token por firmante para el link individual /firmar/operacion/$token
ALTER TABLE public.document_signatures
  ADD COLUMN IF NOT EXISTS access_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS emailed_at timestamptz,
  ALTER COLUMN signer_user_id DROP NOT NULL;

-- 3) Trigger: prevenir mutación del binario cuando el documento está frozen
CREATE OR REPLACE FUNCTION public.prevent_frozen_operation_document_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_frozen = true THEN
    IF NEW.storage_path IS DISTINCT FROM OLD.storage_path
       OR NEW.sha256 IS DISTINCT FROM OLD.sha256
       OR NEW.file_size IS DISTINCT FROM OLD.file_size
       OR NEW.content_type IS DISTINCT FROM OLD.content_type
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.parent_document_id IS DISTINCT FROM OLD.parent_document_id
       OR NEW.is_frozen = false THEN
      RAISE EXCEPTION 'operation_documents % está congelado; crea una nueva versión hija en lugar de modificarlo', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_frozen_op_doc ON public.operation_documents;
CREATE TRIGGER trg_prevent_frozen_op_doc
  BEFORE UPDATE ON public.operation_documents
  FOR EACH ROW EXECUTE FUNCTION public.prevent_frozen_operation_document_mutation();

-- 4) Trigger: auto-incrementar version cuando se inserta un hijo
CREATE OR REPLACE FUNCTION public.bump_operation_document_version_on_child()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_version int;
BEGIN
  IF NEW.parent_document_id IS NOT NULL THEN
    SELECT version INTO parent_version FROM public.operation_documents WHERE id = NEW.parent_document_id;
    IF parent_version IS NOT NULL THEN
      NEW.version := parent_version + 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_op_doc_version ON public.operation_documents;
CREATE TRIGGER trg_bump_op_doc_version
  BEFORE INSERT ON public.operation_documents
  FOR EACH ROW EXECUTE FUNCTION public.bump_operation_document_version_on_child();

-- 5) Auto-generar access_token por firmante
CREATE OR REPLACE FUNCTION public.set_document_signature_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.access_token IS NULL THEN
    NEW.access_token := 'sig_' || encode(gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_signature_token ON public.document_signatures;
CREATE TRIGGER trg_set_signature_token
  BEFORE INSERT ON public.document_signatures
  FOR EACH ROW EXECUTE FUNCTION public.set_document_signature_token();

-- 6) RLS: permitir a participantes de la operación leer sus envelopes y firmas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='signature_envelopes' AND policyname='envelopes_operation_participants_read') THEN
    CREATE POLICY envelopes_operation_participants_read
      ON public.signature_envelopes FOR SELECT
      TO authenticated
      USING (
        operation_id IS NOT NULL
        AND (public.is_operation_participant(operation_id, auth.uid()) OR public.is_gc_staff(auth.uid()))
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='document_signatures' AND policyname='signatures_operation_participants_read') THEN
    CREATE POLICY signatures_operation_participants_read
      ON public.document_signatures FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.signature_envelopes e
          WHERE e.id = document_signatures.envelope_id
            AND e.operation_id IS NOT NULL
            AND (public.is_operation_participant(e.operation_id, auth.uid()) OR public.is_gc_staff(auth.uid()))
        )
      );
  END IF;
END $$;

-- 7) Vista de estado de firmas por operación
CREATE OR REPLACE VIEW public.operation_signature_status AS
SELECT
  e.id                    AS envelope_id,
  e.operation_id,
  e.operation_document_id,
  d.kind                  AS document_kind,
  d.title                 AS document_title,
  d.version               AS document_version,
  d.sha256                AS document_sha256,
  e.document_type,
  e.status,
  e.required_signers,
  e.completed_signers,
  e.expires_at,
  e.created_at,
  e.completed_at,
  e.signed_document_id
FROM public.signature_envelopes e
LEFT JOIN public.operation_documents d ON d.id = e.operation_document_id
WHERE e.operation_id IS NOT NULL;

GRANT SELECT ON public.operation_signature_status TO authenticated, service_role;
