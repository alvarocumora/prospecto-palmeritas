-- ============================================================================
-- Unificación Cholqui = Franco: función de cruce catastral project-neutral
-- ----------------------------------------------------------------------------
-- `franco_match_pertenencia(jsonb, text)` cruza un polígono GeoJSON contra
-- `mining_concessions` y devuelve las concesiones intersectadas con métricas de
-- overlap. Es GENÉRICA (no depende del proyecto): el nombre "franco" es herencia
-- del nombre anterior del Proyecto Cholqui ("Distrito Franco / Gianfranco").
--
-- Esta migración crea la función genérica `match_concessions_by_geometry` con el
-- MISMO cuerpo y convierte `franco_match_pertenencia` en un wrapper de
-- compatibilidad que delega en ella. Así:
--   - Existe UNA sola fuente de verdad del cruce.
--   - El código /src puede migrar del nombre "franco" al genérico sin romperse
--     (la RPC vieja sigue funcionando mientras Lovable actualiza la UI).
-- Territorio: /supabase/migrations (mío). No toca /src.
-- ============================================================================

-- ------------------------------------------------- función genérica (canónica)
CREATE OR REPLACE FUNCTION public.match_concessions_by_geometry(p_geom jsonb, p_name text)
RETURNS TABLE (
  concession_id uuid,
  code text,
  name text,
  holder text,
  concession_type text,
  status text,
  area_ha numeric,
  commune text,
  region text,
  overlap_ha numeric,
  pct_of_kml numeric,
  pct_of_concession numeric,
  match_kind text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH kml AS (
    SELECT extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(p_geom::text), 4326) AS g
  )
  SELECT
    mc.id,
    mc.code,
    mc.name,
    mc.holder,
    mc.concession_type,
    mc.status,
    mc.area_ha,
    mc.commune,
    mc.region,
    ROUND((extensions.ST_Area(extensions.ST_Intersection(mc.geom::extensions.geometry, kml.g)::extensions.geography) / 10000)::numeric, 2) AS overlap_ha,
    ROUND((extensions.ST_Area(extensions.ST_Intersection(mc.geom::extensions.geometry, kml.g)::extensions.geography)
           / NULLIF(extensions.ST_Area(kml.g::extensions.geography), 0) * 100)::numeric, 1) AS pct_of_kml,
    ROUND((extensions.ST_Area(extensions.ST_Intersection(mc.geom::extensions.geometry, kml.g)::extensions.geography)
           / NULLIF(extensions.ST_Area(mc.geom::extensions.geography), 0) * 100)::numeric, 1) AS pct_of_concession,
    CASE
      WHEN LOWER(TRIM(mc.name)) = LOWER(TRIM(p_name)) THEN 'EXACT'
      WHEN LOWER(mc.name) LIKE LOWER('%' || split_part(TRIM(p_name), ' ', 1) || '%') THEN 'NAME~'
      ELSE 'GEOM'
    END AS match_kind
  FROM public.mining_concessions mc, kml
  WHERE mc.geom IS NOT NULL
    AND extensions.ST_Intersects(mc.geom::extensions.geometry, kml.g)
  ORDER BY overlap_ha DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.match_concessions_by_geometry(jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.match_concessions_by_geometry(jsonb, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.match_concessions_by_geometry IS
  'Cruce espacial de un polígono GeoJSON contra mining_concessions, con métricas '
  'de overlap. Project-neutral. Reemplaza a franco_match_pertenencia (que ahora '
  'delega aquí). Usar este nombre en el código nuevo.';

-- ------------------------------------------- wrapper de compatibilidad (franco)
-- Se mantiene para no romper el código /src que aún llama franco_match_pertenencia.
-- Delega en la función genérica: una sola lógica.
CREATE OR REPLACE FUNCTION public.franco_match_pertenencia(p_geom jsonb, p_name text)
RETURNS TABLE (
  concession_id uuid,
  code text,
  name text,
  holder text,
  concession_type text,
  status text,
  area_ha numeric,
  commune text,
  region text,
  overlap_ha numeric,
  pct_of_kml numeric,
  pct_of_concession numeric,
  match_kind text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT * FROM public.match_concessions_by_geometry(p_geom, p_name);
$$;

REVOKE ALL ON FUNCTION public.franco_match_pertenencia(jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.franco_match_pertenencia(jsonb, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.franco_match_pertenencia IS
  'DEPRECADO — wrapper de compatibilidad. Usar match_concessions_by_geometry. '
  'Se mantiene mientras /src migra el nombre del proyecto (Franco -> Cholqui).';
