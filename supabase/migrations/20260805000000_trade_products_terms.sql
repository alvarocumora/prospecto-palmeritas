-- OPERACIONES · Términos por producto en la ficha (doré + bullion en una operación).
--
-- Una operación de oro puede ofrecer varios PRODUCTOS con términos distintos (doré
-- 92-94% 36 meses vs bullion 99,9% 12 meses), mismo precio por gramo. Cada
-- trade_product lleva ahora su cantidad/frecuencia/plazo, y la ficha pública los expone
-- por producto para mostrar AMBOS.

ALTER TABLE public.trade_products ADD COLUMN IF NOT EXISTS qty_per_order numeric;
ALTER TABLE public.trade_products ADD COLUMN IF NOT EXISTS order_frequency text;
ALTER TABLE public.trade_products ADD COLUMN IF NOT EXISTS contract_months integer;

-- Ficha pública con términos por producto (sigue sin exponer base/margen/reparto).
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
               tonnage_total_t, tonnage_monthly_t, packaging, origin_country, origin_region,
               incoterm, qty_per_order, order_frequency, contract_months
        FROM public.trade_products WHERE trade_id = p_trade_id
      ) pr)
  )
  FROM public.commodity_trades t WHERE t.id = p_trade_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_trade_public_ficha(uuid) TO authenticated, service_role;
