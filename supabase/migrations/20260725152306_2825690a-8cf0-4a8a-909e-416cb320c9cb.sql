
-- Public read of published RFQs (marketplace)
CREATE POLICY "rfqs_public_read_published"
ON public.rfqs
FOR SELECT
TO anon, authenticated
USING (is_public = true AND status IN ('publicado','en_evaluacion'));

CREATE POLICY "rfq_products_public_read_published"
ON public.rfq_products
FOR SELECT
TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_products.rfq_id AND r.is_public = true AND r.status IN ('publicado','en_evaluacion')));

GRANT SELECT ON public.rfqs TO anon;
GRANT SELECT ON public.rfq_products TO anon;

-- Suppliers can see applications where they applied (owner already covered) — no change needed.

-- Compute a supplier risk score from filled data + documents
CREATE OR REPLACE FUNCTION public.compute_supplier_risk_score(_supplier_id uuid)
RETURNS TABLE(
  mining_score numeric,
  corporate_score numeric,
  financial_score numeric,
  esg_score numeric,
  compliance_score numeric,
  risk_score numeric,
  risk_band text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offers_filled int := 0;
  v_offers_total int := 0;
  v_docs_valid int := 0;
  v_docs_total int := 0;
  v_has_concession numeric := 0;
  v_has_export numeric := 0;
  v_has_chain numeric := 0;
  v_mining numeric := 0;
  v_corporate numeric := 0;
  v_financial numeric := 0;
  v_esg numeric := 0;
  v_compliance numeric := 0;
  v_risk numeric := 0;
  v_band text;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE product IS NOT NULL AND grade_value IS NOT NULL AND tonnage_available_t IS NOT NULL),
    COUNT(*),
    AVG(CASE WHEN concession_ref IS NOT NULL AND concession_ref <> '' THEN 1 ELSE 0 END),
    AVG(CASE WHEN has_export_permit = 'si' THEN 1 WHEN has_export_permit = 'en_tramite' THEN 0.5 ELSE 0 END),
    AVG(CASE WHEN chain_of_custody IS NOT NULL AND chain_of_custody <> '' THEN 1 ELSE 0 END)
  INTO v_offers_filled, v_offers_total, v_has_concession, v_has_export, v_has_chain
  FROM public.supplier_offers WHERE supplier_id = _supplier_id;

  SELECT
    COUNT(*) FILTER (WHERE review_status = 'valido'),
    COUNT(*)
  INTO v_docs_valid, v_docs_total
  FROM public.supplier_documents WHERE supplier_id = _supplier_id;

  v_mining := ROUND(LEAST(1, COALESCE(v_has_concession,0) * 0.5 + COALESCE(v_has_chain,0) * 0.5) * 100, 1);
  v_corporate := ROUND(LEAST(1, CASE WHEN v_offers_total > 0 THEN v_offers_filled::numeric / v_offers_total ELSE 0 END) * 100, 1);
  v_financial := 50;
  v_esg := 40;
  v_compliance := ROUND(LEAST(1,
    (CASE WHEN v_docs_total > 0 THEN v_docs_valid::numeric / v_docs_total ELSE 0 END) * 0.6
    + COALESCE(v_has_export,0) * 0.4
  ) * 100, 1);

  v_risk := ROUND((v_mining + v_corporate + v_financial + v_esg + v_compliance) / 5, 1);

  v_band := CASE
    WHEN v_risk >= 75 THEN 'bajo'
    WHEN v_risk >= 50 THEN 'medio'
    WHEN v_risk >= 25 THEN 'alto'
    ELSE 'critico'
  END;

  RETURN QUERY SELECT v_mining, v_corporate, v_financial, v_esg, v_compliance, v_risk, v_band;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_supplier_risk_score(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compute_supplier_risk_score(uuid) TO authenticated, service_role;
