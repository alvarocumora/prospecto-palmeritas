-- OPERACIONES · Margen y repartición de comisiones (intermediación).
--
-- Separa PÚBLICO de INTERNO:
--  * trade_pricing: precio base del vendedor + precio de venta (público) + cantidad,
--    frecuencia y plazo. El público/contraparte solo puede ver el PRECIO DE VENTA
--    (get_trade_public_price) — nunca la base ni el margen.
--  * trade_commission_splits: reparto del margen entre operadores / pool interno.
--    Confidencial: solo staff GeoCapitals (is_gc_staff). get_trade_margin_split
--    calcula por pedido cuánto recibe cada beneficiario.
--
-- Depende de commodity_trades y is_gc_staff (Lovable). No las crea.

CREATE TABLE IF NOT EXISTS public.trade_pricing (
  trade_id uuid PRIMARY KEY REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  unit text NOT NULL DEFAULT 'g',            -- g | kg | oz | MT ...
  base_price numeric NOT NULL,               -- costo del vendedor (INTERNO)
  sale_price numeric NOT NULL,               -- precio de venta / factura (PÚBLICO)
  currency text NOT NULL DEFAULT 'CLP',
  iva_pct numeric,                           -- IVA aplicable (Chile 19), informativo
  qty_per_order numeric,                     -- p.ej. 5000 g por pedido semanal
  order_frequency text,                      -- weekly | monthly | spot ...
  contract_months integer,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trade_pricing ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trade_pricing' AND policyname='trade_pricing_staff') THEN
    CREATE POLICY "trade_pricing_staff" ON public.trade_pricing FOR SELECT TO authenticated
      USING (public.is_gc_staff(auth.uid()));   -- base/margen: solo staff GC
  END IF;
END $$;
GRANT SELECT ON public.trade_pricing TO authenticated;
GRANT ALL ON public.trade_pricing TO service_role;

CREATE TABLE IF NOT EXISTS public.trade_commission_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  beneficiary_type text NOT NULL CHECK (beneficiary_type IN ('operator','internal_pool','house','other')),
  beneficiary_name text NOT NULL,
  share_kind text NOT NULL CHECK (share_kind IN ('pct_of_margin','per_unit','fixed_per_order')),
  share_value numeric NOT NULL,              -- % del margen | monto por unidad | monto fijo por pedido
  sort integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_splits_trade ON public.trade_commission_splits (trade_id, sort);
ALTER TABLE public.trade_commission_splits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trade_commission_splits' AND policyname='trade_splits_staff') THEN
    CREATE POLICY "trade_splits_staff" ON public.trade_commission_splits FOR SELECT TO authenticated
      USING (public.is_gc_staff(auth.uid()));   -- reparto: solo staff GC
  END IF;
END $$;
GRANT SELECT ON public.trade_commission_splits TO authenticated;
GRANT ALL ON public.trade_commission_splits TO service_role;

COMMENT ON TABLE public.trade_commission_splits IS
  'Reparto CONFIDENCIAL del margen entre operadores/pool interno. Nunca se expone a la contraparte; el público solo ve el precio de venta (get_trade_public_price).';

-- PÚBLICO: solo el precio de venta y condiciones. NUNCA base ni margen.
CREATE OR REPLACE FUNCTION public.get_trade_public_price(p_trade_id uuid)
RETURNS TABLE (unit text, sale_price numeric, currency text, iva_pct numeric,
               qty_per_order numeric, order_frequency text, contract_months integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT unit, sale_price, currency, iva_pct, qty_per_order, order_frequency, contract_months
  FROM public.trade_pricing WHERE trade_id = p_trade_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_trade_public_price(uuid) TO authenticated, service_role;

-- INTERNO (solo staff GC): margen por pedido + reparto entre beneficiarios.
CREATE OR REPLACE FUNCTION public.get_trade_margin_split(p_trade_id uuid, p_order_qty numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.trade_pricing%ROWTYPE;
  v_qty numeric;
  v_order_value numeric; v_seller_cost numeric; v_margin numeric;
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'type', s.beneficiary_type, 'name', s.beneficiary_name,
           'share_kind', s.share_kind, 'share_value', s.share_value,
           'amount', round(CASE s.share_kind
             WHEN 'pct_of_margin'  THEN v_margin * s.share_value / 100.0
             WHEN 'per_unit'       THEN s.share_value * v_qty
             WHEN 'fixed_per_order' THEN s.share_value
           END, 2)) ORDER BY s.sort), '[]'::jsonb),
         COALESCE(sum(round(CASE s.share_kind
             WHEN 'pct_of_margin'  THEN v_margin * s.share_value / 100.0
             WHEN 'per_unit'       THEN s.share_value * v_qty
             WHEN 'fixed_per_order' THEN s.share_value END, 2)), 0)
    INTO v_dist, v_distributed
  FROM public.trade_commission_splits s WHERE s.trade_id = p_trade_id;

  RETURN jsonb_build_object(
    'unit', p.unit, 'currency', p.currency, 'qty', v_qty,
    'base_price', p.base_price, 'sale_price', p.sale_price,
    'order_value', v_order_value, 'seller_cost', v_seller_cost, 'margin', v_margin,
    'distribution', v_dist, 'distributed', v_distributed,
    'remaining', round(v_margin - v_distributed, 2)
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_trade_margin_split(uuid, numeric) TO authenticated, service_role;
