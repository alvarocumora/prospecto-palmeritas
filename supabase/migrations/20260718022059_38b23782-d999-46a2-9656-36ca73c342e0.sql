
-- Column-level privilege revoke on the Chilean national ID (RUT) columns.
-- RLS keeps the row-level access; column privileges hide the RUT from general authenticated users.

-- cadastre_national.holder_rut
REVOKE SELECT ON public.cadastre_national FROM authenticated;
GRANT SELECT (
  id, external_id, origen, rol, name, tipo, status, area_ha, region, commune, provincia,
  holder_name, constituted_at, last_patent_year, datum, geom, geometry_geojson,
  metadata, source, fetched_at, archived_at, created_at, updated_at, geom_3857
) ON public.cadastre_national TO authenticated;

-- public_holders.rut
REVOKE SELECT ON public.public_holders FROM authenticated;
GRANT SELECT (
  id, holder_name, holder_slug, total_concessions, total_area_ha, regions, last_updated, created_at
) ON public.public_holders TO authenticated;

-- public_concessions_cache.rut
REVOKE SELECT ON public.public_concessions_cache FROM authenticated;
GRANT SELECT (
  id, code, concession_type, name, holder, area_ha, status, granted_at, expires_at,
  region, region_slug, commune, province, datum, geometry, centroid, raw_attrs,
  last_synced_at, created_at, updated_at
) ON public.public_concessions_cache TO authenticated;

-- service_role retains full access (already granted via GRANT ALL patterns; ensure it stays)
GRANT ALL ON public.cadastre_national TO service_role;
GRANT ALL ON public.public_holders TO service_role;
GRANT ALL ON public.public_concessions_cache TO service_role;
