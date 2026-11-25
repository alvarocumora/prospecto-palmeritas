-- Restrict SELECT on precios_metales, freight_rates, and commodity_prices
-- from USING (true) to verified platform users via public.is_platform_user(auth.uid())

DROP POLICY IF EXISTS "precios_metales: authenticated read" ON public.precios_metales;
CREATE POLICY "precios_metales: authenticated read"
  ON public.precios_metales
  FOR SELECT
  TO authenticated
  USING (public.is_platform_user(auth.uid()));

REVOKE ALL ON public.precios_metales FROM anon, authenticated;
GRANT SELECT ON public.precios_metales TO authenticated;
GRANT ALL ON public.precios_metales TO service_role;

DROP POLICY IF EXISTS "freight read" ON public.freight_rates;
CREATE POLICY "freight read"
  ON public.freight_rates
  FOR SELECT
  TO authenticated
  USING (public.is_platform_user(auth.uid()));

REVOKE ALL ON public.freight_rates FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.freight_rates TO authenticated;
GRANT ALL ON public.freight_rates TO service_role;

DROP POLICY IF EXISTS "commodity_prices_public_read" ON public.commodity_prices;
CREATE POLICY "commodity_prices_platform_read"
  ON public.commodity_prices
  FOR SELECT
  TO authenticated
  USING (public.is_platform_user(auth.uid()));

REVOKE ALL ON public.commodity_prices FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commodity_prices TO authenticated;
GRANT ALL ON public.commodity_prices TO service_role;