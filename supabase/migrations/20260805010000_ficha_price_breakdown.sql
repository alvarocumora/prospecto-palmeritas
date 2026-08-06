-- OPERACIONES · Ficha pública con DESGLOSE de precio opcional (por trade).
--
-- Cuando la operación se presenta con precio transparente (productor + comisión/DD ->
-- final), la ficha pública puede mostrar el desglose. Es OPT-IN por trade
-- (show_price_breakdown): si es false, la ficha sigue mostrando solo el precio final y
-- oculta la base (comportamiento por defecto). El REPARTO interno entre operadores
-- (trade_commission_splits) NUNCA se expone acá — sigue siendo solo de staff.

ALTER TABLE public.trade_pricing ADD COLUMN IF NOT EXISTS show_price_breakdown boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_trade_public_ficha(p_trade_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'trade_id', t.id,
    'commodity', t.commodity,
    'reference', t.reference,
    'pricing', (
      SELECT jsonb_build_object(
        'unit', unit, 'sale_price', sale_price, 'currency', currency, 'iva_pct', iva_pct,
        'qty_per_order', qty_per_order, 'order_frequency', order_frequency, 'contract_months', contract_months,
        'show_breakdown', show_price_breakdown,
        -- Desglose solo si el trade lo habilita; si no, null (base oculta).
        'producer_price', CASE WHEN show_price_breakdown THEN base_price END,
        'platform_fee',   CASE WHEN show_price_breakdown THEN (sale_price - base_price) END
      )
      FROM public.trade_pricing WHERE trade_id = p_trade_id),
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
