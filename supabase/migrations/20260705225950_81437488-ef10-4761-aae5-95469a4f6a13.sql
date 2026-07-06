GRANT SELECT ON public.commodity_lots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.commodity_lots TO authenticated;
GRANT ALL ON public.commodity_lots TO service_role;

GRANT SELECT ON public.commodity_lot_certifications TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.commodity_lot_certifications TO authenticated;
GRANT ALL ON public.commodity_lot_certifications TO service_role;

GRANT SELECT ON public.commodity_certifications TO anon, authenticated;
GRANT ALL ON public.commodity_certifications TO service_role;