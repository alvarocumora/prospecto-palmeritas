-- Tenencia · consolidación espacial de mining_concessions.
-- Generaliza la base que hoy está fragmentada: (1) mantiene la columna PostGIS
-- geom sincronizada desde geometry_geojson (JSONB) con trigger + backfill, (2)
-- índice GiST para que el traslape escale, (3) RPC de traslape project-agnóstico
-- (generaliza franco_match_pertenencia, que estaba cableado a un flujo puntual).
-- Idempotente. PostGIS vive en el schema `extensions` (patrón Supabase).

-- 1) Columna geom (4326). IF NOT EXISTS: si ya existe, se conserva su tipo.
ALTER TABLE public.mining_concessions
  ADD COLUMN IF NOT EXISTS geom extensions.geometry(Geometry, 4326);

-- 2) Sincronización geometry_geojson -> geom (tolerante a GeoJSON inválido: nunca
--    bloquea el insert/update; deja geom NULL y sigue).
CREATE OR REPLACE FUNCTION public.mining_concessions_sync_geom()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.geometry_geojson IS NOT NULL THEN
    BEGIN
      NEW.geom := extensions.ST_SetSRID(
        extensions.ST_GeomFromGeoJSON(NEW.geometry_geojson::text), 4326);
      IF NOT extensions.ST_IsValid(NEW.geom) THEN
        NEW.geom := extensions.ST_MakeValid(NEW.geom);
      END IF;
    EXCEPTION WHEN others THEN
      NEW.geom := NULL;
    END;
  ELSE
    NEW.geom := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mining_concessions_sync_geom ON public.mining_concessions;
CREATE TRIGGER trg_mining_concessions_sync_geom
  BEFORE INSERT OR UPDATE OF geometry_geojson ON public.mining_concessions
  FOR EACH ROW EXECUTE FUNCTION public.mining_concessions_sync_geom();

-- 2b) Backfill de filas existentes sin geom (per-row, saltando GeoJSON inválido).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id, geometry_geojson
    FROM public.mining_concessions
    WHERE geom IS NULL AND geometry_geojson IS NOT NULL
  LOOP
    BEGIN
      UPDATE public.mining_concessions
        SET geom = extensions.ST_MakeValid(
          extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(r.geometry_geojson::text), 4326))
        WHERE id = r.id;
    EXCEPTION WHEN others THEN
      NULL; -- GeoJSON inválido: se deja geom NULL
    END;
  END LOOP;
END $$;

-- 3) Índice espacial GiST (escala del traslape).
CREATE INDEX IF NOT EXISTS idx_mining_concessions_geom
  ON public.mining_concessions USING gist (geom);

-- 4) RPC de traslape project-agnóstico. Dado un polígono GeoJSON (WGS84 4326),
--    devuelve las concesiones intersectadas con métricas de solape y severidad.
--    p_exclude_project permite excluir las concesiones del propio proyecto para
--    detectar SOLO conflictos con terceros.
CREATE OR REPLACE FUNCTION public.tenencia_overlaps(
  p_geom jsonb,
  p_exclude_project uuid DEFAULT NULL
)
RETURNS TABLE (
  concession_id uuid,
  project_id uuid,
  code text,
  name text,
  holder text,
  concession_type text,
  status text,
  area_ha numeric,
  commune text,
  region text,
  expires_at timestamptz,
  overlap_ha numeric,
  pct_of_aoi numeric,
  pct_of_concession numeric,
  severity text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH aoi AS (
    SELECT extensions.ST_MakeValid(
             extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(p_geom::text), 4326)
           ) AS g
  )
  SELECT
    mc.id,
    mc.project_id,
    mc.code,
    mc.name,
    mc.holder,
    mc.concession_type,
    mc.status,
    mc.area_ha,
    mc.commune,
    mc.region,
    mc.expires_at,
    ROUND((extensions.ST_Area(
      extensions.ST_Intersection(mc.geom::extensions.geometry, aoi.g)::extensions.geography
    ) / 10000)::numeric, 2) AS overlap_ha,
    ROUND((extensions.ST_Area(
      extensions.ST_Intersection(mc.geom::extensions.geometry, aoi.g)::extensions.geography
    ) / NULLIF(extensions.ST_Area(aoi.g::extensions.geography), 0) * 100)::numeric, 1) AS pct_of_aoi,
    ROUND((extensions.ST_Area(
      extensions.ST_Intersection(mc.geom::extensions.geometry, aoi.g)::extensions.geography
    ) / NULLIF(extensions.ST_Area(mc.geom::extensions.geography), 0) * 100)::numeric, 1)
      AS pct_of_concession,
    CASE
      WHEN mc.status = 'vigente' THEN 'blocking'
      WHEN mc.status = 'en_tramite' THEN 'warning'
      ELSE 'info'
    END AS severity
  FROM public.mining_concessions mc, aoi
  WHERE mc.geom IS NOT NULL
    AND (p_exclude_project IS NULL OR mc.project_id IS DISTINCT FROM p_exclude_project)
    AND extensions.ST_Intersects(mc.geom::extensions.geometry, aoi.g)
  ORDER BY overlap_ha DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.tenencia_overlaps(jsonb, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tenencia_overlaps(jsonb, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.tenencia_overlaps IS
  'Traslape project-agnóstico: dado un polígono GeoJSON (4326), devuelve concesiones intersectadas con overlap_ha, % del AOI y de la concesión, y severidad. p_exclude_project excluye las del propio proyecto (solo conflictos de terceros).';
