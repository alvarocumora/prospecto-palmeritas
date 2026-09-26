-- ============================================================================
-- Cadastre reconciliation — persistencia auditable de corridas de due diligence
-- ----------------------------------------------------------------------------
-- Lovable construyó el motor de reconciliación catastral (proyecto vs registro
-- oficial SERNAGEOMIN) 100% en el cliente: estados EXACT_MATCH / INTERSECTS /
-- NEIGHBOR / UNMATCHED y hallazgos de due diligence, todo en memoria y efímero.
-- Una due diligence que no queda registrada no es defendible: aquí se guarda
-- cada corrida con su snapshot de entrada, para que sea auditable y reproducible.
--
-- Territorio: /supabase/migrations (mío). No toca /src ni objetos de Lovable;
-- reutiliza el helper public.is_gc_staff (creado por el backend de operaciones).
-- Idempotente (IF NOT EXISTS) por el drift histórico del proyecto.
-- ============================================================================

-- ----------------------------------------------------------------- runs -----
CREATE TABLE IF NOT EXISTS public.cadastre_reconciliation_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid,                         -- sin FK dura (drift-safe)
  source                text NOT NULL DEFAULT 'SERNAGEOMIN',
  neighbor_km           numeric NOT NULL DEFAULT 5,
  generated_at          timestamptz NOT NULL DEFAULT now(),
  summary               jsonb  NOT NULL DEFAULT '{}'::jsonb,  -- conteos por estado
  project_feature_count integer NOT NULL DEFAULT 0,
  official_feature_count integer NOT NULL DEFAULT 0,
  project_fc            jsonb,                        -- snapshot de entrada (proyecto)
  official_fc           jsonb,                        -- snapshot de entrada (oficial)
  result_geojson        jsonb,                        -- salida anotada (reconciliationGeoJSON)
  note                  text,
  created_by            uuid NOT NULL DEFAULT auth.uid(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cadastre_recon_runs_project
  ON public.cadastre_reconciliation_runs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cadastre_recon_runs_creator
  ON public.cadastre_reconciliation_runs (created_by, created_at DESC);

COMMENT ON TABLE public.cadastre_reconciliation_runs IS
  'Corridas de reconciliación catastral (proyecto vs registro oficial). Guarda el '
  'snapshot de entrada y la salida anotada para auditar y reproducir la due diligence. '
  'El motor de cálculo vive en el cliente (src/lib/cadastre); esto lo hace persistente.';

-- ------------------------------------------------------------- findings -----
CREATE TABLE IF NOT EXISTS public.cadastre_reconciliation_findings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid NOT NULL REFERENCES public.cadastre_reconciliation_runs(id) ON DELETE CASCADE,
  severity    text NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO','REVIEW','HIGH')),
  code        text NOT NULL,
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cadastre_recon_findings_run
  ON public.cadastre_reconciliation_findings (run_id, severity);

COMMENT ON TABLE public.cadastre_reconciliation_findings IS
  'Hallazgos de due diligence derivados de una corrida (buildCadastreDueDiligence). '
  'severity: INFO | REVIEW | HIGH.';

-- ------------------------------------------------------------------ RLS -----
ALTER TABLE public.cadastre_reconciliation_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadastre_reconciliation_findings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='cadastre_reconciliation_runs'
                 AND policyname='cadastre_recon_runs_read') THEN
    CREATE POLICY cadastre_recon_runs_read ON public.cadastre_reconciliation_runs
      FOR SELECT TO authenticated
      USING (public.is_gc_staff(auth.uid()) OR created_by = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='cadastre_reconciliation_findings'
                 AND policyname='cadastre_recon_findings_read') THEN
    CREATE POLICY cadastre_recon_findings_read ON public.cadastre_reconciliation_findings
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.cadastre_reconciliation_runs r
        WHERE r.id = cadastre_reconciliation_findings.run_id
          AND (public.is_gc_staff(auth.uid()) OR r.created_by = auth.uid())
      ));
  END IF;
END $$;

-- La escritura es solo por RPC (SECURITY DEFINER) o service_role.
GRANT SELECT ON public.cadastre_reconciliation_runs     TO authenticated;
GRANT SELECT ON public.cadastre_reconciliation_findings TO authenticated;
GRANT ALL    ON public.cadastre_reconciliation_runs     TO service_role;
GRANT ALL    ON public.cadastre_reconciliation_findings TO service_role;

-- --------------------------------------------------------- RPC: guardar -----
-- Persiste una corrida completa + sus hallazgos en una transacción. Sella
-- created_by con auth.uid(). p_findings es el arreglo JSON de buildCadastreDueDiligence.
CREATE OR REPLACE FUNCTION public.save_cadastre_reconciliation(
  p_summary          jsonb,
  p_result_geojson   jsonb   DEFAULT NULL,
  p_project_fc       jsonb   DEFAULT NULL,
  p_official_fc      jsonb   DEFAULT NULL,
  p_findings         jsonb   DEFAULT '[]'::jsonb,
  p_source           text    DEFAULT 'SERNAGEOMIN',
  p_neighbor_km      numeric DEFAULT 5,
  p_project_id       uuid    DEFAULT NULL,
  p_note             text    DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_run uuid;
  v_f   jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'save_cadastre_reconciliation requiere un usuario autenticado';
  END IF;

  INSERT INTO public.cadastre_reconciliation_runs
    (project_id, source, neighbor_km, summary,
     project_feature_count, official_feature_count,
     project_fc, official_fc, result_geojson, note, created_by)
  VALUES
    (p_project_id, COALESCE(p_source,'SERNAGEOMIN'), COALESCE(p_neighbor_km,5),
     COALESCE(p_summary,'{}'::jsonb),
     COALESCE(jsonb_array_length(p_project_fc -> 'features'), 0),
     COALESCE(jsonb_array_length(p_official_fc -> 'features'), 0),
     p_project_fc, p_official_fc, p_result_geojson, p_note, v_uid)
  RETURNING id INTO v_run;

  IF p_findings IS NOT NULL AND jsonb_typeof(p_findings) = 'array' THEN
    FOR v_f IN SELECT * FROM jsonb_array_elements(p_findings) LOOP
      INSERT INTO public.cadastre_reconciliation_findings (run_id, severity, code, message)
      VALUES (
        v_run,
        CASE WHEN upper(COALESCE(v_f->>'severity','INFO')) IN ('INFO','REVIEW','HIGH')
             THEN upper(v_f->>'severity') ELSE 'INFO' END,
        COALESCE(v_f->>'code','UNSPECIFIED'),
        COALESCE(v_f->>'message',''));
    END LOOP;
  END IF;

  RETURN v_run;
END $$;

REVOKE ALL ON FUNCTION public.save_cadastre_reconciliation(
  jsonb,jsonb,jsonb,jsonb,jsonb,text,numeric,uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.save_cadastre_reconciliation(
  jsonb,jsonb,jsonb,jsonb,jsonb,text,numeric,uuid,text) TO authenticated, service_role;

-- --------------------------------------------------------- RPC: obtener -----
CREATE OR REPLACE FUNCTION public.get_cadastre_reconciliation(p_run_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'run', to_jsonb(r) - 'project_fc' - 'official_fc',   -- metadatos, sin los FC pesados
    'has_snapshots', (r.project_fc IS NOT NULL AND r.official_fc IS NOT NULL),
    'findings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'severity', f.severity, 'code', f.code, 'message', f.message)
               ORDER BY CASE f.severity WHEN 'HIGH' THEN 0 WHEN 'REVIEW' THEN 1 ELSE 2 END)
      FROM public.cadastre_reconciliation_findings f WHERE f.run_id = r.id), '[]'::jsonb)
  )
  FROM public.cadastre_reconciliation_runs r
  WHERE r.id = p_run_id
    AND (public.is_gc_staff(auth.uid()) OR r.created_by = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_cadastre_reconciliation(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_cadastre_reconciliation(uuid) TO authenticated, service_role;

-- --------------------------------------------------------- RPC: listar ------
CREATE OR REPLACE FUNCTION public.list_cadastre_reconciliations(
  p_project_id uuid DEFAULT NULL,
  p_limit      integer DEFAULT 50
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
    SELECT r.id, r.project_id, r.source, r.neighbor_km, r.summary,
           r.project_feature_count, r.official_feature_count,
           r.generated_at, r.created_at, r.created_by,
           (SELECT count(*) FROM public.cadastre_reconciliation_findings f
              WHERE f.run_id = r.id AND f.severity = 'HIGH') AS high_findings
    FROM public.cadastre_reconciliation_runs r
    WHERE (public.is_gc_staff(auth.uid()) OR r.created_by = auth.uid())
      AND (p_project_id IS NULL OR r.project_id = p_project_id)
    ORDER BY r.created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit,50), 200))
  ) t;
$$;

REVOKE ALL ON FUNCTION public.list_cadastre_reconciliations(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.list_cadastre_reconciliations(uuid, integer) TO authenticated, service_role;
