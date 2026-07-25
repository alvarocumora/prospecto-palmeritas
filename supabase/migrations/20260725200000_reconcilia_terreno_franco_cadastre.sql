-- RECONCILIACIÓN (B) · Retargetea la RPC de terreno franco al catastro CANÓNICO
-- de Lovable (cadastre_national), en vez del store paralelo catastro_concesiones
-- (B2, no consumido por el front). Misma firma y misma forma de salida: es un
-- drop-in que el front puede invocar con supabase.rpc('tenencia_terreno_franco').
--
-- Vocabulario REAL de cadastre_national (verificado en supabase/functions/_shared/
-- sernageomin.ts, mapStatus): status ∈ {vigente, en_tramite, vencida, cancelada}.
-- Ocupan terreno las VIGENTES y EN TRÁMITE; las extinguidas (vencida/cancelada)
-- lo liberan. Filas vigentes del catastro = archived_at IS NULL. No se inventó
-- ningún valor: se leyó del normalizador oficial del sync.
--
-- NOTA: re-aplicado tras que un sync de Lovable descartara de main el PR #188.

CREATE OR REPLACE FUNCTION public.tenencia_terreno_franco(
  p_aoi jsonb,
  p_min_ha numeric DEFAULT 0,
  p_estados text[] DEFAULT ARRAY['vigente', 'en_tramite']
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
    SELECT ST_Union(ST_MakeValid(c.geom)) AS g
    FROM public.cadastre_national c, aoi
    WHERE c.archived_at IS NULL
      AND c.geom IS NOT NULL
      AND (p_estados IS NULL OR c.status = ANY (p_estados))
      AND ST_Intersects(c.geom, aoi.g)
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

GRANT EXECUTE ON FUNCTION public.tenencia_terreno_franco(jsonb, numeric, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenencia_terreno_franco(jsonb, numeric, text[]) TO service_role;

COMMENT ON FUNCTION public.tenencia_terreno_franco(jsonb, numeric, text[]) IS
  'Terreno franco = AOI menos la unión de concesiones ocupantes de cadastre_national (default: status vigente/en_tramite, archived_at IS NULL). Devuelve polígonos libres con su área en ha. Reconciliado sobre el catastro canónico de Lovable.';
