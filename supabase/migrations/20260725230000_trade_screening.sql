-- OPERACIONES (spine Trades) · Registro de screening de sanciones (OFAC/UN/EU/UK).
--
-- Destraba el gate 'ready': la fila 'sanctions_screening' del checklist REICON es
-- mandatory y required_from_role='geocapitals', pero la War Room solo permite subir
-- documentos de la CONTRAPARTE, así que ese ítem nunca se satisfacía y el botón
-- "Pasar a evaluación comercial" quedaba bloqueado para siempre.
--
-- Aquí GC registra el screening (estructurado y auditable). El RPC actualiza un
-- marcador en trade_documents(doc_type='sanctions_screening') para que el checklist
-- y el readiness ya existentes lo reflejen sin cambios:
--   * algún 'hit'                  -> marcador 'rejected'  -> checklist 'observado' (bloquea)
--   * todos 'clear' (sin pending)  -> marcador 'verified'  -> checklist 'aprobado' (satisface)
--   * aún 'pending'                -> sin marcador         -> checklist 'falta' (bloquea)
--
-- Depende de tablas de Lovable (commodity_trades, trade_documents) que ya existen.

CREATE TABLE IF NOT EXISTS public.trade_screenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL,
  subject_name text NOT NULL,
  subject_type text NOT NULL DEFAULT 'company' CHECK (subject_type IN ('company','ubo','individual')),
  lists_checked text[] NOT NULL DEFAULT '{}',           -- p.ej. {OFAC,UN,EU,UK}
  outcome text NOT NULL CHECK (outcome IN ('clear','hit','pending')),
  matched_details text,
  notes text,
  screened_by uuid,
  screened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_screenings_trade ON public.trade_screenings (trade_id, screened_at DESC);

ALTER TABLE public.trade_screenings ENABLE ROW LEVEL SECURITY;
-- Lectura para autenticados; la escritura va solo por el RPC (SECURITY DEFINER).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trade_screenings' AND policyname='trade_screenings_read') THEN
    CREATE POLICY "trade_screenings_read" ON public.trade_screenings FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.trade_screenings TO authenticated;
GRANT ALL ON public.trade_screenings TO service_role;

COMMENT ON TABLE public.trade_screenings IS
  'Screening de sanciones (OFAC/UN/EU/UK) por operación. Satisface la fila sanctions_screening del checklist REICON vía un marcador en trade_documents.';

-- Registra un screening y recomputa el marcador de trade_documents.
CREATE OR REPLACE FUNCTION public.record_trade_screening(
  p_trade_id uuid,
  p_subject_name text,
  p_subject_type text DEFAULT 'company',
  p_lists text[] DEFAULT '{}',
  p_outcome text DEFAULT 'pending',
  p_matched_details text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  n_hit int; n_pending int; n_clear int;
  v_status text;
  v_existing uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'record_trade_screening requiere un usuario autenticado';
  END IF;

  INSERT INTO public.trade_screenings
    (trade_id, subject_name, subject_type, lists_checked, outcome, matched_details, notes, screened_by)
  VALUES
    (p_trade_id, p_subject_name, COALESCE(p_subject_type,'company'), COALESCE(p_lists,'{}'),
     p_outcome, p_matched_details, p_notes, v_uid)
  RETURNING id INTO v_id;

  SELECT count(*) FILTER (WHERE outcome='hit'),
         count(*) FILTER (WHERE outcome='pending'),
         count(*) FILTER (WHERE outcome='clear')
    INTO n_hit, n_pending, n_clear
  FROM public.trade_screenings WHERE trade_id = p_trade_id;

  IF n_hit > 0 THEN
    v_status := 'rejected';
  ELSIF n_pending = 0 AND n_clear > 0 THEN
    v_status := 'verified';
  ELSE
    v_status := NULL;                 -- aún pendiente: no satisface
  END IF;

  SELECT id INTO v_existing FROM public.trade_documents
   WHERE trade_id = p_trade_id AND doc_type = 'sanctions_screening'
   ORDER BY updated_at DESC LIMIT 1;

  IF v_status IS NULL THEN
    IF v_existing IS NOT NULL THEN
      DELETE FROM public.trade_documents WHERE id = v_existing;
    END IF;
  ELSIF v_existing IS NULL THEN
    INSERT INTO public.trade_documents (trade_id, doc_type, status, created_by)
    VALUES (p_trade_id, 'sanctions_screening', v_status, v_uid);
  ELSE
    UPDATE public.trade_documents SET status = v_status, updated_at = now() WHERE id = v_existing;
  END IF;

  RETURN v_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.record_trade_screening(uuid,text,text,text[],text,text,text) TO authenticated, service_role;

-- Lista los screenings de una operación (para la UI de GC).
CREATE OR REPLACE FUNCTION public.get_trade_screenings(p_trade_id uuid)
RETURNS TABLE (id uuid, subject_name text, subject_type text, lists_checked text[],
               outcome text, matched_details text, notes text, screened_by uuid, screened_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, subject_name, subject_type, lists_checked, outcome, matched_details, notes, screened_by, screened_at
  FROM public.trade_screenings WHERE trade_id = p_trade_id ORDER BY screened_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_trade_screenings(uuid) TO authenticated, service_role;
