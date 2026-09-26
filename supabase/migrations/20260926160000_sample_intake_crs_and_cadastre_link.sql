-- ============================================================================
-- Fase 1 — Intake de muestras: CRS declarado + enlace muestra↔concesión
-- ----------------------------------------------------------------------------
-- Problema: sampling_results guarda easting/northing pero NO el CRS/huso -> no
-- se puede ubicar ni enlazar a catastro sin adivinar (prohibido). Se agrega una
-- columna de CRS DECLARADO (NULL = sin declarar) y una función de intake que:
--   - reporta cobertura de posición/CRS y problemas,
--   - reproyecta (solo si el CRS está declarado y es válido) a WGS84,
--   - enlaza cada muestra a la(s) concesión(es) que la contienen (marco catastral).
--
-- Regla: NO se inventa CRS. Muestra con posición pero sin CRS declarado -> se
-- reporta como problema, no se ubica.
-- Territorio: /supabase/migrations (mío). ALTER aditivo idempotente.
-- ============================================================================

-- CRS declarado del easting/northing (EPSG). NULL = sin declarar (no se adivina).
ALTER TABLE public.sampling_results ADD COLUMN IF NOT EXISTS crs_epsg integer;
COMMENT ON COLUMN public.sampling_results.crs_epsg IS
  'EPSG del easting/northing declarado por quien cargó la muestra (p.ej. 24879 PSAD56/UTM19S, '
  '32719 WGS84/UTM19S). NULL = sin declarar: la muestra no se ubica ni se enlaza a catastro.';

CREATE OR REPLACE FUNCTION public.sample_intake(p_project_id uuid, p_limit integer DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  n_total int; n_pos int; n_crs int; n_placeable int; n_bad_crs int;
  n_inside int; n_outside int;
  v_links jsonb; v_crs jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'sample_intake requiere usuario autenticado';
  END IF;
  IF NOT (public.is_gc_staff(v_uid) OR public.is_project_member(p_project_id, v_uid)) THEN
    RAISE EXCEPTION 'sin acceso al proyecto';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE easting IS NOT NULL AND northing IS NOT NULL),
    count(*) FILTER (WHERE crs_epsg IS NOT NULL),
    count(*) FILTER (WHERE easting IS NOT NULL AND northing IS NOT NULL AND crs_epsg IS NOT NULL
                       AND crs_epsg IN (SELECT srid FROM extensions.spatial_ref_sys)),
    count(*) FILTER (WHERE crs_epsg IS NOT NULL
                       AND crs_epsg NOT IN (SELECT srid FROM extensions.spatial_ref_sys))
  INTO n_total, n_pos, n_crs, n_placeable, n_bad_crs
  FROM public.sampling_results WHERE project_id = p_project_id;

  -- Reproyección + enlace catastral (solo muestras ubicables con CRS válido).
  WITH pts AS (
    SELECT sr.id, sr.sample_code, sr.crs_epsg,
           extensions.ST_Transform(
             extensions.ST_SetSRID(extensions.ST_MakePoint(sr.easting, sr.northing), sr.crs_epsg),
             4326) AS g
    FROM public.sampling_results sr
    WHERE sr.project_id = p_project_id
      AND sr.easting IS NOT NULL AND sr.northing IS NOT NULL
      AND sr.crs_epsg IS NOT NULL
      AND sr.crs_epsg IN (SELECT srid FROM extensions.spatial_ref_sys)
  ),
  linked AS (
    SELECT p.id, p.sample_code, p.crs_epsg,
           extensions.ST_X(p.g) AS lon, extensions.ST_Y(p.g) AS lat,
           mc.code AS concession_code, mc.name AS concession_name
    FROM pts p
    LEFT JOIN public.mining_concessions mc
      ON mc.geom IS NOT NULL
     AND extensions.ST_Contains(mc.geom::extensions.geometry, p.g)
  )
  SELECT
    count(*) FILTER (WHERE concession_code IS NOT NULL),
    count(*) FILTER (WHERE concession_code IS NULL),
    COALESCE(jsonb_agg(jsonb_build_object(
      'sample_code', sample_code, 'crs_epsg', crs_epsg,
      'lon', round(lon::numeric, 6), 'lat', round(lat::numeric, 6),
      'concession_code', concession_code, 'concession_name', concession_name)
      ORDER BY sample_code) FILTER (WHERE true), '[]'::jsonb)
  INTO n_inside, n_outside, v_links
  FROM (SELECT * FROM linked LIMIT GREATEST(1, LEAST(COALESCE(p_limit,500), 2000))) l;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('crs_epsg', crs_epsg, 'n', n) ORDER BY n DESC), '[]'::jsonb)
  INTO v_crs
  FROM (SELECT crs_epsg, count(*) n FROM public.sampling_results
        WHERE project_id = p_project_id AND crs_epsg IS NOT NULL GROUP BY crs_epsg) c;

  RETURN jsonb_build_object(
    'project_id', p_project_id,
    'totals', jsonb_build_object(
      'samples', n_total, 'with_position', n_pos, 'with_crs', n_crs,
      'placeable', n_placeable, 'invalid_crs', n_bad_crs,
      'position_without_crs', n_pos - n_crs),
    'crs_breakdown', v_crs,
    'spatial', jsonb_build_object(
      'inside_concession', n_inside, 'outside_concession', n_outside),
    'issues', (
      SELECT COALESCE(jsonb_agg(msg), '[]'::jsonb) FROM (
        SELECT 'Muestras con posición pero SIN CRS declarado: ' || (n_pos - n_crs)::text AS msg
          WHERE (n_pos - n_crs) > 0
        UNION ALL SELECT 'Muestras con CRS EPSG inválido (no está en spatial_ref_sys): ' || n_bad_crs::text
          WHERE n_bad_crs > 0
        UNION ALL SELECT 'Muestras ubicables FUERA de toda concesión del catastro: ' || n_outside::text
          WHERE n_outside > 0
      ) q),
    'links', v_links);
END $$;

REVOKE ALL ON FUNCTION public.sample_intake(uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sample_intake(uuid, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.sample_intake IS
  'Fase 1 — intake de muestras: cobertura de posición/CRS, reproyección a WGS84 '
  '(solo con CRS declarado y válido) y enlace muestra↔concesión (marco catastral). '
  'No adivina CRS: posición sin CRS declarado se reporta como problema.';
