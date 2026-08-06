-- OPERACIONES · Ficha pública de una operación (una sola llamada, 100% segura).
--
-- Devuelve SOLO lo que puede ver la contraparte/el público: commodity, specs del
-- producto y PRECIO DE VENTA. NUNCA base, margen ni reparto (esos viven en
-- trade_pricing/trade_commission_splits, gated a staff). Es el único punto de entrada
-- de la ficha pública: evita que la UI consulte trade_pricing directo y filtre el margen.
--
-- Depende de commodity_trades, trade_pricing, trade_products (ya existen).

CREATE OR REPLACE FUNCTION public.get_trade_public_ficha(p_trade_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'trade_id', t.id,
    'commodity', t.commodity,
    'reference', t.reference,
    'pricing', (
      SELECT to_jsonb(pp) FROM (
        SELECT unit, sale_price, currency, iva_pct, qty_per_order, order_frequency, contract_months
        FROM public.trade_pricing WHERE trade_id = p_trade_id
      ) pp),
    'products', (
      SELECT COALESCE(jsonb_agg(to_jsonb(pr) ORDER BY pr.product_name), '[]'::jsonb) FROM (
        SELECT product_name, presentation, hs_code, purity, grade_value, grade_unit,
               tonnage_total_t, tonnage_monthly_t, packaging, origin_country, origin_region, incoterm
        FROM public.trade_products WHERE trade_id = p_trade_id
      ) pr)
  )
  FROM public.commodity_trades t WHERE t.id = p_trade_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_trade_public_ficha(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_trade_public_ficha(uuid) IS
  'Ficha pública segura: commodity + specs + precio de VENTA. Nunca base/margen/reparto. Único punto de entrada de la ficha pública.';
