-- =========================================================
-- Catastro enriquecido: matrículas catastrales de la concesión/pertenencia.
--
-- mining_concessions ya modela expediente (code), superficie (area_ha),
-- titular (holder), vigencia (granted_at/expires_at) y polígono
-- (geometry_geojson). Falta la referencia a las matrículas catastrales de la
-- propiedad (ej. "224, 461"). Aditivo y nullable.
-- =========================================================
ALTER TABLE public.mining_concessions
  ADD COLUMN IF NOT EXISTS parcel_ids text;
