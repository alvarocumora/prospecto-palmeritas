
CREATE OR REPLACE FUNCTION public.score_cadastre_candidates(
  _limit integer DEFAULT 200,
  _region text DEFAULT NULL,
  _min_area numeric DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  region text,
  commune text,
  area_ha numeric,
  holder_name text,
  holder_rut text,
  last_patent_year integer,
  status text,
  deposit_id uuid,
  deposit_name text,
  deposit_commodity text,
  dist_km numeric,
  anomaly_count bigint,
  holder_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH base AS (
    SELECT c.id, c.name, c.region, c.commune, c.area_ha, c.holder_name, c.holder_rut,
           c.last_patent_year, c.status, c.geom
    FROM public.cadastre_national c
    WHERE c.archived_at IS NULL
      AND c.geom IS NOT NULL
      AND (_region IS NULL OR c.region = _region)
      AND (_min_area IS NULL OR c.area_ha >= _min_area)
    ORDER BY c.area_ha DESC NULLS LAST
    LIMIT _limit
  ),
  nearest AS (
    SELECT b.id AS concession_id,
           d.id AS deposit_id,
           d.name AS deposit_name,
           d.primary_commodity AS commodity,
           (extensions.ST_Distance(b.geom::extensions.geography, d.geom::extensions.geography)/1000.0)::numeric AS dist_km
    FROM base b
    CROSS JOIN LATERAL (
      SELECT md.id, md.name, md.primary_commodity, md.geom
      FROM public.mineral_deposits md
      WHERE md.geom IS NOT NULL
      ORDER BY md.geom <-> b.geom
      LIMIT 1
    ) d
  ),
  anomalies AS (
    SELECT b.id AS concession_id, COUNT(*)::bigint AS cnt
    FROM base b
    JOIN public.satellite_anomalies sa
      ON extensions.ST_Intersects(b.geom, extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(sa.geometry::text), 4326))
    GROUP BY b.id
  ),
  holders AS (
    SELECT cn.holder_rut, COUNT(*)::bigint AS holder_count
    FROM public.cadastre_national cn
    WHERE cn.holder_rut IS NOT NULL
    GROUP BY cn.holder_rut
  )
  SELECT b.id, b.name, b.region, b.commune, b.area_ha, b.holder_name, b.holder_rut,
         b.last_patent_year, b.status,
         n.deposit_id, n.deposit_name, n.commodity AS deposit_commodity, n.dist_km,
         COALESCE(a.cnt, 0) AS anomaly_count,
         COALESCE(h.holder_count, 1) AS holder_count
  FROM base b
  LEFT JOIN nearest n ON n.concession_id = b.id
  LEFT JOIN anomalies a ON a.concession_id = b.id
  LEFT JOIN holders h ON h.holder_rut = b.holder_rut;
$$;

REVOKE ALL ON FUNCTION public.score_cadastre_candidates(integer, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.score_cadastre_candidates(integer, text, numeric) TO service_role;
