-- OPERACIONES (spine Trades) · Puente requerimiento -> productos del trade.
--
-- El ciclo del requerimiento YA existe y está cableado (sourcing_requests +
-- sourcing_submissions + convertSubmissionToTrade, que crea el commodity_trade). El
-- único gap: al convertir una propuesta de proveedor en trade, NO se llenaban los
-- trade_products con la oferta (precio/cantidad/grado/packaging). Este puente lo
-- cierra sin duplicar el lifecycle: Lovable llama al RPC desde convertSubmissionToTrade.
--
-- Depende de sourcing_submissions / sourcing_requests (Lovable) y trade_products.

-- Vínculo al origen "propuesta de sourcing" (además de supplier_offer / rfq_product).
ALTER TABLE public.trade_products ADD COLUMN IF NOT EXISTS source_submission_id uuid;

-- Recrear get_trade_products para exponer también el nuevo vínculo (cambia el
-- RETURNS TABLE, así que hay que DROP + CREATE).
DROP FUNCTION IF EXISTS public.get_trade_products(uuid);
CREATE FUNCTION public.get_trade_products(p_trade_id uuid)
RETURNS TABLE (
  id uuid, product_name text, presentation text, hs_code text, purity text,
  grade_value numeric, grade_unit text, tonnage_total_t numeric, tonnage_monthly_t numeric,
  packaging text, origin_country text, origin_region text, incoterm text,
  price_usd numeric, price_note text, status text, added_by_role text, notes text,
  source_supplier_offer_id uuid, source_rfq_product_id uuid, source_submission_id uuid,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, product_name, presentation, hs_code, purity, grade_value, grade_unit,
         tonnage_total_t, tonnage_monthly_t, packaging, origin_country, origin_region,
         incoterm, price_usd, price_note, status, added_by_role, notes,
         source_supplier_offer_id, source_rfq_product_id, source_submission_id, created_at
  FROM public.trade_products WHERE trade_id = p_trade_id
  ORDER BY created_at;
$$;
GRANT EXECUTE ON FUNCTION public.get_trade_products(uuid) TO authenticated, service_role;

-- Copia una propuesta de sourcing como producto del trade (mapeo de la oferta del
-- proveedor). El nombre del producto sale del commodity del requerimiento.
CREATE OR REPLACE FUNCTION public.import_submission_to_trade_products(p_trade_id uuid, p_submission_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.trade_products (
    trade_id, source_submission_id, product_name, purity, tonnage_total_t,
    packaging, origin_country, incoterm, price_usd, notes, added_by_role, created_by
  )
  SELECT p_trade_id, s.id,
         COALESCE(r.commodity, 'Producto'),
         s.quality_grade, s.offer_quantity_t, s.packaging, s.supplier_country,
         s.incoterm, s.offer_price_usd_t,
         NULLIF(trim(concat_ws(' | ',
           s.specs,
           CASE WHEN s.port_loading IS NOT NULL THEN 'Puerto carga: ' || s.port_loading END,
           s.payment_terms)), ''),
         'seller', auth.uid()
  FROM public.sourcing_submissions s
  LEFT JOIN public.sourcing_requests r ON r.id = s.request_id
  WHERE s.id = p_submission_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'sourcing_submission % no existe', p_submission_id;
  END IF;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.import_submission_to_trade_products(uuid, uuid) TO authenticated, service_role;
