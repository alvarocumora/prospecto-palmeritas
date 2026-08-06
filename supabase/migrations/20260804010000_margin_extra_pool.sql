-- OPERACIONES · Pool extra en el reparto (además del margen).
--
-- Ajuste: la base a repartir puede ser el margen (sobreprecio) MÁS un pool fijo extra
-- que sale del valor del pedido (p.ej. $5.000.000 por pedido). Así "los 5 millones más
-- el sobreprecio se reparten en 4" cuadra: distributable = margin + extra_pool, y el
-- remanente = distributable - distribuido.

ALTER TABLE public.trade_pricing ADD COLUMN IF NOT EXISTS extra_pool_per_order numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.get_trade_margin_split(p_trade_id uuid, p_order_qty numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.trade_pricing%ROWTYPE;
  v_qty numeric; v_order_value numeric; v_seller_cost numeric; v_margin numeric;
  v_extra numeric; v_distributable numeric;
  v_dist jsonb; v_distributed numeric;
BEGIN
  IF NOT public.is_gc_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Reparto confidencial: solo staff GeoCapitals';
  END IF;
  SELECT * INTO p FROM public.trade_pricing WHERE trade_id = p_trade_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sin pricing para el trade %', p_trade_id; END IF;

  v_qty := COALESCE(p_order_qty, p.qty_per_order, 0);
  v_order_value := p.sale_price * v_qty;
  v_seller_cost := p.base_price * v_qty;
  v_margin := (p.sale_price - p.base_price) * v_qty;
  v_extra := COALESCE(p.extra_pool_per_order, 0);
  v_distributable := v_margin + v_extra;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'type', s.beneficiary_type, 'name', s.beneficiary_name,
           'share_kind', s.share_kind, 'share_value', s.share_value,
           'amount', round(CASE s.share_kind
             WHEN 'pct_of_margin'   THEN v_distributable * s.share_value / 100.0
             WHEN 'per_unit'        THEN s.share_value * v_qty
             WHEN 'fixed_per_order' THEN s.share_value END, 2)) ORDER BY s.sort), '[]'::jsonb),
         COALESCE(sum(round(CASE s.share_kind
             WHEN 'pct_of_margin'   THEN v_distributable * s.share_value / 100.0
             WHEN 'per_unit'        THEN s.share_value * v_qty
             WHEN 'fixed_per_order' THEN s.share_value END, 2)), 0)
    INTO v_dist, v_distributed
  FROM public.trade_commission_splits s WHERE s.trade_id = p_trade_id;

  RETURN jsonb_build_object(
    'unit', p.unit, 'currency', p.currency, 'qty', v_qty,
    'base_price', p.base_price, 'sale_price', p.sale_price,
    'order_value', v_order_value, 'seller_cost', v_seller_cost, 'margin', v_margin,
    'extra_pool', v_extra, 'distributable', v_distributable,
    'distribution', v_dist, 'distributed', v_distributed,
    'remaining', round(v_distributable - v_distributed, 2)
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_trade_margin_split(uuid, numeric) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_trade_margin_split(uuid, numeric) IS
  'Reparto interno (staff GC): distributable = margen + extra_pool_per_order; ahora pct_of_margin se calcula sobre distributable. Público solo ve get_trade_public_price.';
