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

REVOKE ALL ON FUNCTION public.franco_match_pertenencia(jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.franco_match_pertenencia(jsonb, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.franco_match_pertenencia IS
  'Cruce espacial KMZ × catastro: dado un polígono GeoJSON y nombre, devuelve concesiones intersectadas con métricas de overlap.';