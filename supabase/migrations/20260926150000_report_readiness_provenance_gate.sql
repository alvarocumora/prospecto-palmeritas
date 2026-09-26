-- ============================================================================
-- Fase 0 — Gate de procedencia para informes (report_readiness)
-- ----------------------------------------------------------------------------
-- Clasifica los datos de un proyecto por NIVEL DE EVIDENCIA y decide si un
-- informe puede afirmarse sobre "dato real". Regla inviolable: un informe nunca
-- presenta dato sintético/modelado como medido.
--
-- Niveles de evidencia:
--   measured   — medido/certificado en terreno (assay con lab+certificado; estación no sintética)
--   declared   — dato real pero sin verificar (assay sin certificado)
--   modeled    — derivado/regional (p.ej. mag_targets EMAG2v3, inversión)
--   synthetic  — marcado sintético (is_synthetic = true) -> NO entra a informe entregable
--
-- Señales de procedencia (columnas REALES del esquema, no inventadas):
--   sampling_results:   certificate, lab, assays (au_gpt/ag_gpt/cu_pct/...)
--   geophysics_stations: is_synthetic, lecturas (mag_nt/ip_*)
--   exploration_targets: validated_at, confidence_pct
--   mag_targets:         source (EMAG2v3 = regional)
--
-- Territorio: /supabase/migrations (mío). Solo lee tablas existentes.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.report_readiness(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  -- geoquímica / muestras
  s_measured  int := 0;  s_declared int := 0;  s_incomplete int := 0;  s_total int := 0;
  -- geofísica
  g_real int := 0;  g_synth int := 0;  g_surveys int := 0;
  -- targets (interpretación)
  t_validated int := 0;  t_candidate int := 0;  t_total int := 0;
  -- mag targets (regional/modelado)
  m_total int := 0;
  v_has_real boolean;
  v_ready boolean;
  v_level text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'report_readiness requiere usuario autenticado';
  END IF;
  IF NOT (public.is_gc_staff(v_uid) OR public.is_project_member(p_project_id, v_uid)) THEN
    RAISE EXCEPTION 'sin acceso al proyecto';
  END IF;

  -- ---- Geoquímica: medido = assay + lab + certificado; declarado = assay sin certificado
  SELECT
    count(*) FILTER (WHERE has_assay AND lab IS NOT NULL AND certificate IS NOT NULL),
    count(*) FILTER (WHERE has_assay AND (lab IS NULL OR certificate IS NULL)),
    count(*) FILTER (WHERE NOT has_assay),
    count(*)
  INTO s_measured, s_declared, s_incomplete, s_total
  FROM (
    SELECT lab, certificate,
           (au_gpt IS NOT NULL OR ag_gpt IS NOT NULL OR cu_pct IS NOT NULL
            OR mo_ppm IS NOT NULL OR pb_ppm IS NOT NULL OR zn_ppm IS NOT NULL) AS has_assay
    FROM public.sampling_results WHERE project_id = p_project_id
  ) sr;

  -- ---- Geofísica: estaciones reales (no sintéticas) con lectura vs sintéticas
  SELECT
    count(*) FILTER (WHERE is_synthetic IS NOT TRUE AND (mag_nt IS NOT NULL OR ip_chargeability_mvv IS NOT NULL OR ip_resistivity_ohmm IS NOT NULL)),
    count(*) FILTER (WHERE is_synthetic IS TRUE)
  INTO g_real, g_synth
  FROM public.geophysics_stations WHERE project_id = p_project_id;

  SELECT count(*) INTO g_surveys FROM public.geophysics_surveys WHERE project_id = p_project_id;

  -- ---- Targets: validados vs candidatos (interpretación, nunca "medido")
  SELECT
    count(*) FILTER (WHERE validated_at IS NOT NULL),
    count(*) FILTER (WHERE validated_at IS NULL),
    count(*)
  INTO t_validated, t_candidate, t_total
  FROM public.exploration_targets WHERE project_id = p_project_id;

  -- ---- Mag targets: regional/modelado
  SELECT count(*) INTO m_total FROM public.mag_targets WHERE project_id = p_project_id;

  -- Un informe puede afirmar "dato real" si hay al menos algo MEDIDO
  -- (assay certificado o estación geofísica real). Lo sintético/regional NO cuenta.
  v_has_real := (s_measured > 0) OR (g_real > 0);
  v_ready := v_has_real;
  v_level := CASE
    WHEN s_measured > 0 AND g_real > 0 THEN 'measured'          -- geoquímica + geofísica reales
    WHEN v_has_real THEN 'partial_measured'                     -- solo un dominio medido
    WHEN s_declared > 0 THEN 'declared_only'                    -- dato real sin certificar
    WHEN (g_synth > 0 OR m_total > 0 OR t_total > 0) THEN 'synthetic_or_modeled'
    ELSE 'empty'
  END;

  RETURN jsonb_build_object(
    'project_id', p_project_id,
    'geochem', jsonb_build_object(
      'measured', s_measured, 'declared', s_declared,
      'incomplete', s_incomplete, 'total', s_total,
      'ready', s_measured > 0),
    'geophysics', jsonb_build_object(
      'real_stations', g_real, 'synthetic_stations', g_synth,
      'surveys', g_surveys, 'ready', g_real > 0),
    'targets', jsonb_build_object(
      'validated', t_validated, 'candidates', t_candidate, 'total', t_total,
      'note', 'interpretación, no dato medido'),
    'mag_targets', jsonb_build_object(
      'total', m_total, 'note', 'regional/modelado (EMAG2v3), no medición de terreno'),
    'overall', jsonb_build_object(
      'has_real_data', v_has_real,
      'report_ready', v_ready,
      'level', v_level,
      'note', CASE
        WHEN v_ready THEN 'Hay dato medido: el informe puede afirmar sobre dato real, rotulando cada sección por procedencia.'
        WHEN v_level = 'declared_only' THEN 'Solo dato declarado sin certificar: el informe debe marcar todo como "por verificar".'
        WHEN v_level = 'synthetic_or_modeled' THEN 'Solo dato sintético/modelado: NO generar informe entregable como si fuera real.'
        ELSE 'Sin datos cargados para el proyecto.'
      END)
  );
END $$;

REVOKE ALL ON FUNCTION public.report_readiness(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.report_readiness(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.report_readiness IS
  'Fase 0 — gate de procedencia. Clasifica los datos de un proyecto por nivel de '
  'evidencia (measured/declared/modeled/synthetic) y decide si un informe puede '
  'afirmarse sobre dato real. Lo sintético/modelado nunca se presenta como medido.';
