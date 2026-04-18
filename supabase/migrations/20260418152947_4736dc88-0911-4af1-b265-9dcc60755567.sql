
-- Allow public read access to geological reference data (no PII; these are scientific reference tables)
DROP POLICY IF EXISTS "Authenticated can view lithology_units" ON public.lithology_units;
DROP POLICY IF EXISTS "Authenticated can view alteration_zones" ON public.alteration_zones;
DROP POLICY IF EXISTS "Authenticated can view mineralogy" ON public.mineralogy;
DROP POLICY IF EXISTS "Authenticated can view geological_features" ON public.geological_features;
DROP POLICY IF EXISTS "Authenticated can view geo_references" ON public.geo_references;

CREATE POLICY "Public can view lithology_units" ON public.lithology_units FOR SELECT USING (true);
CREATE POLICY "Public can view alteration_zones" ON public.alteration_zones FOR SELECT USING (true);
CREATE POLICY "Public can view mineralogy" ON public.mineralogy FOR SELECT USING (true);
CREATE POLICY "Public can view geological_features" ON public.geological_features FOR SELECT USING (true);
CREATE POLICY "Public can view geo_references" ON public.geo_references FOR SELECT USING (true);
