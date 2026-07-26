-- OPERACIONES (spine Trades) · Productos por operación.
--
-- El proveedor sube sus productos DENTRO de la operación. Hoy no existe: los modelos
-- de producto cuelgan de otros dominios (supplier_offers -> suppliers, rfq_products
-- -> rfqs, commodity_lots -> marketplace), ninguno ligado a commodity_trades. Esta
-- tabla es el line-item del trade, y puede referenciar su ORIGEN (una supplier_offer
-- del vendedor o un rfq_product del comprador) para reconciliar sin duplicar.
--
-- Depende de commodity_trades (Lovable). Los FKs a supplier_offers/rfq_products son
-- opcionales y ON DELETE SET NULL para no acoplar el ciclo de vida.

CREATE TABLE IF NOT EXISTS public.trade_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  source_supplier_offer_id uuid,          -- FK lógico a supplier_offers (origen vendedor)
  source_rfq_product_id uuid,             -- FK lógico a rfq_products (origen requerimiento)
  product_name text NOT NULL,
  presentation text,                      -- cátodo, concentrado, cátodo LME grado A, ...
  hs_code text,
  purity text,
  grade_value numeric,
  grade_unit text,
  tonnage_total_t numeric,
  tonnage_monthly_t numeric,
  packaging text,
  origin_country text,
  origin_region text,
  incoterm text,
  price_usd numeric,
  price_note text,                        -- p.ej. "LME - 5%" cuando el precio no es numérico
  status text NOT NULL DEFAULT 'offered'
    CHECK (status IN ('offered','accepted','rejected','withdrawn')),
  added_by_role text NOT NULL DEFAULT 'seller'
    CHECK (added_by_role IN ('buyer','seller','geocapitals')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_products_trade ON public.trade_products (trade_id);

ALTER TABLE public.trade_products ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trade_products' AND policyname='trade_products_read') THEN
    CREATE POLICY "trade_products_read" ON public.trade_products FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.trade_products TO authenticated;
GRANT ALL ON public.trade_products TO service_role;

COMMENT ON TABLE public.trade_products IS
  'Line-items de producto por operación (commodity_trades). El proveedor los sube; pueden referenciar su origen (supplier_offers / rfq_products) para reconciliar.';

-- Lectura de los productos de una operación (para la UI y la War Room vía service fn).
CREATE OR REPLACE FUNCTION public.get_trade_products(p_trade_id uuid)
RETURNS TABLE (
  id uuid, product_name text, presentation text, hs_code text, purity text,
  grade_value numeric, grade_unit text, tonnage_total_t numeric, tonnage_monthly_t numeric,
  packaging text, origin_country text, origin_region text, incoterm text,
  price_usd numeric, price_note text, status text, added_by_role text,
  source_supplier_offer_id uuid, source_rfq_product_id uuid, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, product_name, presentation, hs_code, purity, grade_value, grade_unit,
         tonnage_total_t, tonnage_monthly_t, packaging, origin_country, origin_region,
         incoterm, price_usd, price_note, status, added_by_role,
         source_supplier_offer_id, source_rfq_product_id, created_at
  FROM public.trade_products WHERE trade_id = p_trade_id
  ORDER BY created_at;
$$;
GRANT EXECUTE ON FUNCTION public.get_trade_products(uuid) TO authenticated, service_role;

-- Reconciliación: copia una supplier_offer existente como producto de la operación,
-- mapeando sus campos y dejando el vínculo al origen. No duplica el assay (vive en
-- offer_elements, alcanzable por el source_supplier_offer_id).
CREATE OR REPLACE FUNCTION public.import_supplier_offer_to_trade(p_trade_id uuid, p_supplier_offer_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.trade_products (
    trade_id, source_supplier_offer_id, product_name, presentation,
    grade_value, grade_unit, tonnage_total_t, tonnage_monthly_t,
    origin_region, incoterm, price_note, added_by_role, created_by
  )
  SELECT p_trade_id, o.id, o.product, o.presentation,
         o.grade_value, o.grade_unit, o.tonnage_available_t, o.tonnage_monthly_t,
         o.region, o.incoterm, o.price_ask, 'seller', auth.uid()
  FROM public.supplier_offers o
  WHERE o.id = p_supplier_offer_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'supplier_offer % no existe', p_supplier_offer_id;
  END IF;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.import_supplier_offer_to_trade(uuid, uuid) TO authenticated, service_role;
