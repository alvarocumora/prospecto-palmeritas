-- Firmas ordenadas: agrupa múltiples solicitudes (una por firmante) en un
-- mismo flujo, con orden estricto (Position 1 → 2 → 3) y capacidad de
-- reintento cuando falta información del firmante.

ALTER TABLE public.document_sign_requests
  ADD COLUMN IF NOT EXISTS flow_id uuid,
  ADD COLUMN IF NOT EXISTS sign_order integer,
  ADD COLUMN IF NOT EXISTS signer_role text;

CREATE INDEX IF NOT EXISTS idx_doc_sign_requests_flow
  ON public.document_sign_requests (flow_id, sign_order);

-- Impide que un firmante posterior firme antes que uno anterior del mismo flujo.
CREATE OR REPLACE FUNCTION public.enforce_sign_flow_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_before int;
BEGIN
  -- Sólo aplica cuando se está marcando como firmado dentro de un flujo.
  IF NEW.status = 'signed'
     AND OLD.status IS DISTINCT FROM 'signed'
     AND NEW.flow_id IS NOT NULL
     AND NEW.sign_order IS NOT NULL
  THEN
    SELECT count(*) INTO pending_before
    FROM public.document_sign_requests
    WHERE flow_id = NEW.flow_id
      AND sign_order < NEW.sign_order
      AND status <> 'signed';
    IF pending_before > 0 THEN
      RAISE EXCEPTION 'Debe firmar primero el firmante anterior del flujo (%).', pending_before;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_sign_flow_order ON public.document_sign_requests;
CREATE TRIGGER trg_enforce_sign_flow_order
  BEFORE UPDATE ON public.document_sign_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sign_flow_order();