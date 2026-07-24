-- B4 · Buscador de terreno franco. Dado un área de interés (AOI, GeoJSON 4326),
-- devuelve los polígonos LIBRES de concesión actual (vigente o en trámite),
-- filtrados por superficie mínima útil. Diferencia geométrica en PostGIS sobre
-- catastro_concesiones (poblado por el ETL de B2). Este es el algoritmo que
-- diferencia el producto de un simple visor.
--
-- Nota de cache (§B4.1): el front debe cachear por AOI (no recalcular por
-- request); esta función es el cómputo, la política de cache va en la app.
-- PostGIS sin calificar (search_path: public/extensions).

CREATE OR REPLACE FUNCTION public.tenencia_terreno_franco(
  p_aoi jsonb,
  p_min_ha numeric DEFAULT 0,
  p_estados text[] DEFAULT NULL  -- NULL = toda concesión ACTUAL ocupa (vigente + trámite)
)
RETURNS TABLE (geom_geojson jsonb, area_ha numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH aoi AS (
    SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(p_aoi::text), 4326)) AS g
  ),
  ocupado AS (
    SELECT ST_Union(ST_MakeValid(mc.geom)) AS g
    FROM public.catastro_concesiones mc, aoi
    WHERE mc.valid_to IS NULL
      AND (p_estados IS NULL OR mc.estado = ANY (p_estados))
      AND ST_Intersects(mc.geom, aoi.g)
  ),
  libre AS (
    SELECT CASE WHEN o.g IS NULL OR ST_IsEmpty(o.g) THEN a.g
                ELSE ST_Difference(a.g, o.g) END AS g
    FROM aoi a LEFT JOIN ocupado o ON true
  ),
  parts AS (
    SELECT (ST_Dump(g)).geom AS g
    FROM libre
    WHERE g IS NOT NULL AND NOT ST_IsEmpty(g)
  )
  SELECT ST_AsGeoJSON(g)::jsonb AS geom_geojson,
         ROUND((ST_Area(g::geography) / 10000)::numeric, 2) AS area_ha
  FROM parts
  WHERE ST_Dimension(g) = 2  -- solo polígonos (descarta slivers de línea/punto)
    AND ST_Area(g::geography) / 10000 >= COALESCE(p_min_ha, 0)
  ORDER BY area_ha DESC;
$$;

REVOKE ALL ON FUNCTION public.tenencia_terreno_franco(jsonb, numeric, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tenencia_terreno_franco(jsonb, numeric, text[])
  TO authenticated, service_role;

COMMENT ON FUNCTION public.tenencia_terreno_franco IS
  'B4: dado un AOI (GeoJSON 4326) devuelve los polígonos libres de concesión actual (AOI menos la unión de concesiones vigentes/en trámite), con área en ha, filtrados por p_min_ha.';
