-- B4 · Fix de correctitud de terreno franco. Los estados reales de SERNAGEOMIN
-- (SITUACION_CONCESION) son CONSTITUIDA / EN TRAMITE / ELIMINADA. Una concesión
-- ELIMINADA NO ocupa terreno (lo libera). El default anterior (toda concesión
-- actual ocupa) contaba ELIMINADA como ocupante — incorrecto.
--
-- Nuevo default: ocupan CONSTITUIDA (vigente) + EN TRAMITE (solicitud), que es
-- justo "libre de concesión vigente y de solicitud en trámite" (§B4.1). Son
-- valores de ESTADO del dato (no parámetros legales); verificados contra el
-- FeatureServer oficial. p_estados=NULL sigue disponible para "todas".

CREATE OR REPLACE FUNCTION public.tenencia_terreno_franco(
  p_aoi jsonb,
  p_min_ha numeric DEFAULT 0,
  p_estados text[] DEFAULT ARRAY['CONSTITUIDA', 'EN TRAMITE']
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
  WHERE ST_Dimension(g) = 2
    AND ST_Area(g::geography) / 10000 >= COALESCE(p_min_ha, 0)
  ORDER BY area_ha DESC;
$$;
