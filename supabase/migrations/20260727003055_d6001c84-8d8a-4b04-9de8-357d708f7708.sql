-- ==================== 20260725240000_trade_products ====================
CREATE TABLE IF NOT EXISTS public.trade_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  source_supplier_offer_id uuid,
  source_rfq_product_id uuid,
  product_name text NOT NULL,
  presentation text,
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
  price_note text,
  status text NOT NULL DEFAULT 'offered' CHECK (status IN ('offered','accepted','rejected','withdrawn')),
  added_by_role text NOT NULL DEFAULT 'seller' CHECK (added_by_role IN ('buyer','seller','geocapitals')),
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

-- ==================== 20260725250000_trade_products_from_submission ====================
ALTER TABLE public.trade_products ADD COLUMN IF NOT EXISTS source_submission_id uuid;

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
  IF v_id IS NULL THEN RAISE EXCEPTION 'supplier_offer % no existe', p_supplier_offer_id; END IF;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.import_supplier_offer_to_trade(uuid, uuid) TO authenticated, service_role;

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
  IF v_id IS NULL THEN RAISE EXCEPTION 'sourcing_submission % no existe', p_submission_id; END IF;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.import_submission_to_trade_products(uuid, uuid) TO authenticated, service_role;

-- ==================== 20260726000000_checklist_multicommodity ====================
CREATE OR REPLACE FUNCTION public._commodity_key(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(coalesce(p,'')) ~ '(cathode|c[aá]todo|copper|cobre)'   THEN 'copper_cathode'
    WHEN lower(coalesce(p,'')) ~ '(gold|\yoro\y|\yau\y)'              THEN 'gold'
    WHEN lower(coalesce(p,'')) ~ '(silver|plata|\yag\y)'              THEN 'silver'
    WHEN lower(coalesce(p,'')) ~ '(antimony|antimonio|stibnite|estibina|\ysb\y)' THEN 'antimony'
    WHEN lower(coalesce(p,'')) ~ '(lithium|litio)'                    THEN 'lithium'
    WHEN lower(coalesce(p,'')) ~ '(cobalt|cobalto)'                   THEN 'cobalt'
    WHEN lower(coalesce(p,'')) ~ '(zinc|cinc)'                        THEN 'zinc'
    WHEN lower(coalesce(p,'')) ~ '(\ylead\y|plomo)'                   THEN 'lead'
    WHEN lower(coalesce(p,'')) ~ '(\ytin\y|esta[ñn]o)'                THEN 'tin'
    WHEN lower(coalesce(p,'')) ~ '(nickel|n[ií]quel)'                 THEN 'nickel'
    ELSE lower(coalesce(p,''))
  END;
$$;

INSERT INTO public.operation_document_structure
  (commodity, doc_kind, section_no, section, title, description, obligation, condition, required_from_role, sequence, fuente, verificado_por)
SELECT '*', doc_kind, section_no, section, title, description, obligation, condition,
       required_from_role, sequence, 'REICON KYC Framework (base genérica)', verificado_por
FROM public.operation_document_structure
WHERE commodity = 'copper_cathode'
ON CONFLICT (commodity, doc_kind) DO NOTHING;

INSERT INTO public.operation_document_structure
  (commodity, doc_kind, section_no, section, title, description, obligation, condition, required_from_role, sequence, fuente, verificado_por)
VALUES
  ('gold','gold_responsible_sourcing',7,'Requisitos específicos del commodity','Debida diligencia de oro responsable','Declaración de abastecimiento responsable conforme a la Guía OCDE y LBMA Responsible Gold, con cadena de custodia del origen.','mandatory',NULL,'seller',1,'OCDE / LBMA Responsible Gold','IA — por confirmar'),
  ('gold','gold_refiner_accreditation',7,'Requisitos específicos del commodity','Acreditación de refinería (LBMA Good Delivery)','Acreditación de la refinería en la lista LBMA Good Delivery o equivalente, cuando aplique.','if_available',NULL,'seller',2,'LBMA','IA — por confirmar'),
  ('gold','kimberley_provenance',7,'Requisitos específicos del commodity','Declaración de procedencia y no financiamiento de conflicto','Declaración de que el oro no financia conflictos armados ni proviene de minería ilegal.','mandatory',NULL,'seller',3,'OCDE Anexo II','IA — por confirmar'),
  ('antimony','end_use_statement',7,'Requisitos específicos del commodity','Declaración de uso final y no desvío','Declaración del uso final del antimonio y compromiso de no desvío a usos militares no autorizados.','mandatory',NULL,'seller',1,'Control de minerales estratégicos','IA — por confirmar'),
  ('antimony','export_control_declaration',7,'Requisitos específicos del commodity','Declaración de control de exportaciones / doble uso','Cumplimiento de controles de exportación aplicables a minerales críticos y de doble uso.','conditional','si_aplica','seller',2,'Régimen de control de exportaciones','IA — por confirmar'),
  ('tin','3tg_traceability',7,'Requisitos específicos del commodity','Trazabilidad 3TG reforzada','Trazabilidad conforme a esquemas 3TG (ITSCI o equivalente) por ser mineral de zonas de conflicto.','mandatory',NULL,'seller',1,'OCDE 3TG / ITSCI','IA — por confirmar'),
  ('cobalt','battery_supply_chain_dd',7,'Requisitos específicos del commodity','Debida diligencia de cadena de suministro de cobalto','Debida diligencia de cadena de suministro conforme a la Guía OCDE (trabajo infantil / minería artesanal).','mandatory',NULL,'seller',1,'OCDE Minerales','IA — por confirmar'),
  ('lithium','battery_grade_spec',7,'Requisitos específicos del commodity','Especificación grado batería','Certificado de especificación grado batería (p.ej. Li2CO3 / LiOH) y hoja de datos técnica.','if_available',NULL,'seller',1,'Especificación técnica','IA — por confirmar')
ON CONFLICT (commodity, doc_kind) DO NOTHING;

CREATE OR REPLACE FUNCTION public.trade_documents_checklist(p_trade_id uuid)
RETURNS TABLE (
  section_no integer, section text, doc_kind text, title text, description text,
  obligation text, condition text, required_from_role text, sequence integer,
  status text, document_id uuid, uploaded_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH tr AS (
    SELECT id, public._commodity_key(commodity) AS ckey
    FROM public.commodity_trades WHERE id = p_trade_id
  ),
  struct AS (
    SELECT DISTINCT ON (s.doc_kind) s.*
    FROM public.operation_document_structure s, tr
    WHERE s.commodity = tr.ckey OR s.commodity = '*'
    ORDER BY s.doc_kind, (s.commodity <> '*') DESC
  ),
  latest AS (
    SELECT DISTINCT ON (doc_type) doc_type, id, status, signed_at, updated_at
    FROM public.trade_documents WHERE trade_id = p_trade_id
    ORDER BY doc_type, updated_at DESC
  )
  SELECT s.section_no, s.section, s.doc_kind, s.title, s.description,
         s.obligation, s.condition, s.required_from_role, s.sequence,
         CASE
           WHEN l.doc_type IS NULL THEN 'falta'
           WHEN l.signed_at IS NOT NULL OR l.status = 'signed' THEN 'firmado'
           WHEN l.status = 'verified' THEN 'aprobado'
           WHEN l.status IN ('rejected','cancelled') THEN 'observado'
           ELSE 'subido'
         END AS status,
         l.id, l.updated_at
  FROM struct s
  LEFT JOIN latest l ON l.doc_type = s.doc_kind
  ORDER BY s.section_no, s.sequence;
$$;
GRANT EXECUTE ON FUNCTION public.trade_documents_checklist(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.operation_documents_checklist(p_operation_id uuid)
RETURNS TABLE (
  section_no integer, section text, doc_kind text, title text, description text,
  obligation text, condition text, required_from_role text, sequence integer,
  status text, document_id uuid, version integer, uploaded_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH op AS (
    SELECT id, public._commodity_key(commodity) AS ckey
    FROM public.operations WHERE id = p_operation_id
  ),
  struct AS (
    SELECT DISTINCT ON (s.doc_kind) s.*
    FROM public.operation_document_structure s, op
    WHERE s.commodity = op.ckey OR s.commodity = '*'
    ORDER BY s.doc_kind, (s.commodity <> '*') DESC
  ),
  latest AS (
    SELECT DISTINCT ON (kind) kind, id, version, review_status, is_frozen, created_at
    FROM public.operation_documents WHERE operation_id = p_operation_id
    ORDER BY kind, version DESC, created_at DESC
  )
  SELECT s.section_no, s.section, s.doc_kind, s.title, s.description,
         s.obligation, s.condition, s.required_from_role, s.sequence,
         CASE
           WHEN l.kind IS NULL THEN 'falta'
           WHEN l.is_frozen THEN 'firmado'
           WHEN l.review_status = 'approved' THEN 'aprobado'
           WHEN l.review_status IN ('rejected','needs_revision') THEN 'observado'
           ELSE 'subido'
         END AS status,
         l.id, l.version, l.created_at
  FROM struct s
  LEFT JOIN latest l ON l.kind = s.doc_kind
  ORDER BY s.section_no, s.sequence;
$$;
GRANT EXECUTE ON FUNCTION public.operation_documents_checklist(uuid) TO authenticated, service_role;

-- ==================== 20260726010000_trade_negotiation ====================
CREATE TABLE IF NOT EXISTS public.trade_negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  party text NOT NULL CHECK (party IN ('buyer','seller','geocapitals')),
  price_usd_t numeric,
  quantity_t numeric,
  incoterm text,
  port_loading text,
  port_discharge text,
  delivery_from date,
  delivery_to date,
  payment_terms text,
  shipping_notes text,
  valid_until date,
  message text,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','accepted','rejected','countered','withdrawn','superseded')),
  replies_to uuid REFERENCES public.trade_negotiations(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_negotiations_trade ON public.trade_negotiations (trade_id, created_at);
ALTER TABLE public.trade_negotiations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trade_negotiations' AND policyname='trade_negotiations_read') THEN
    CREATE POLICY "trade_negotiations_read" ON public.trade_negotiations FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.trade_negotiations TO authenticated;
GRANT ALL ON public.trade_negotiations TO service_role;

CREATE OR REPLACE FUNCTION public.propose_trade_terms(
  p_trade_id uuid, p_party text,
  p_price_usd_t numeric DEFAULT NULL, p_quantity_t numeric DEFAULT NULL,
  p_incoterm text DEFAULT NULL, p_port_loading text DEFAULT NULL, p_port_discharge text DEFAULT NULL,
  p_delivery_from date DEFAULT NULL, p_delivery_to date DEFAULT NULL,
  p_payment_terms text DEFAULT NULL, p_shipping_notes text DEFAULT NULL,
  p_valid_until date DEFAULT NULL, p_message text DEFAULT NULL,
  p_replies_to uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'requiere usuario autenticado'; END IF;
  IF p_replies_to IS NOT NULL THEN
    UPDATE public.trade_negotiations SET status = 'countered'
     WHERE id = p_replies_to AND trade_id = p_trade_id AND status = 'proposed';
  END IF;
  INSERT INTO public.trade_negotiations
    (trade_id, party, price_usd_t, quantity_t, incoterm, port_loading, port_discharge,
     delivery_from, delivery_to, payment_terms, shipping_notes, valid_until, message,
     replies_to, created_by)
  VALUES
    (p_trade_id, p_party, p_price_usd_t, p_quantity_t, p_incoterm, p_port_loading, p_port_discharge,
     p_delivery_from, p_delivery_to, p_payment_terms, p_shipping_notes, p_valid_until, p_message,
     p_replies_to, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.propose_trade_terms(uuid,text,numeric,numeric,text,text,text,date,date,text,text,date,text,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.respond_trade_terms(
  p_offer_id uuid, p_action text, p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.trade_negotiations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'requiere usuario autenticado'; END IF;
  IF p_action NOT IN ('accept','reject') THEN RAISE EXCEPTION 'acción inválida: %', p_action; END IF;
  SELECT * INTO r FROM public.trade_negotiations WHERE id = p_offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'propuesta % no existe', p_offer_id; END IF;
  IF r.status <> 'proposed' THEN RAISE EXCEPTION 'la propuesta ya no está abierta (estado %)', r.status; END IF;
  IF p_action = 'reject' THEN
    UPDATE public.trade_negotiations SET status = 'rejected', message = COALESCE(p_note, message) WHERE id = p_offer_id;
    RETURN;
  END IF;
  UPDATE public.trade_negotiations SET status = 'accepted', message = COALESCE(p_note, message) WHERE id = p_offer_id;
  UPDATE public.trade_negotiations SET status = 'superseded'
   WHERE trade_id = r.trade_id AND id <> p_offer_id AND status = 'proposed';
  UPDATE public.commodity_trades
     SET unit_price_usd    = COALESCE(r.price_usd_t, unit_price_usd),
         quantity_t        = COALESCE(r.quantity_t, quantity_t),
         incoterm          = COALESCE(r.incoterm, incoterm),
         payment_instrument = COALESCE(r.payment_terms, payment_instrument),
         updated_at        = now()
   WHERE id = r.trade_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.respond_trade_terms(uuid,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_trade_negotiation(p_trade_id uuid)
RETURNS TABLE (
  id uuid, party text, price_usd_t numeric, quantity_t numeric, incoterm text,
  port_loading text, port_discharge text, delivery_from date, delivery_to date,
  payment_terms text, shipping_notes text, valid_until date, message text,
  status text, replies_to uuid, created_by uuid, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, party, price_usd_t, quantity_t, incoterm, port_loading, port_discharge,
         delivery_from, delivery_to, payment_terms, shipping_notes, valid_until, message,
         status, replies_to, created_by, created_at
  FROM public.trade_negotiations WHERE trade_id = p_trade_id
  ORDER BY created_at;
$$;
GRANT EXECUTE ON FUNCTION public.get_trade_negotiation(uuid) TO authenticated, service_role;

-- ==================== 20260726020000_saas_modules ====================
CREATE TABLE IF NOT EXISTS public.modules_catalog (
  key text PRIMARY KEY,
  name_es text NOT NULL,
  name_en text NOT NULL,
  description_es text,
  description_en text,
  icon text,
  display_order integer NOT NULL DEFAULT 0,
  gated boolean NOT NULL DEFAULT true
);
INSERT INTO public.modules_catalog (key, name_es, name_en, description_es, description_en, icon, display_order, gated) VALUES
  ('catastro','Exploración, Certificación y Catastro','Exploration, Certification & Cadastre','Tenencia minera, catastro, boletín y exploración (geofísica, sondajes, NI 43-101).','Mining tenure, cadastre, bulletin and exploration (geophysics, drilling, NI 43-101).','pickaxe',1,true),
  ('commodities','Commodities, Trading y Envíos','Commodities, Trading & Shipping','Intermediación de metales: mesa de operaciones, sourcing, marketplace, compliance, negociación, logística.','Metals intermediation: trade desk, sourcing, marketplace, compliance, negotiation, logistics.','ship',2,true),
  ('capital','Capital y Deals de Minas','Capital & Mining Deals','Venta de proyectos, inversión y deals de minas.','Project sales, investment and mining deals.','landmark',3,true),
  ('core','General','General','Inicio, analítica, perfil y administración (transversal).','Home, analytics, profile and administration (shared).','layout-dashboard',0,false)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.modules_catalog ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='modules_catalog' AND policyname='modules_catalog_read') THEN
    CREATE POLICY "modules_catalog_read" ON public.modules_catalog FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.modules_catalog TO authenticated;
GRANT ALL ON public.modules_catalog TO service_role;

CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  plan_code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('module','feature')),
  key text NOT NULL,
  PRIMARY KEY (plan_code, kind, key)
);
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plan_entitlements' AND policyname='plan_entitlements_read') THEN
    CREATE POLICY "plan_entitlements_read" ON public.plan_entitlements FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.plan_entitlements TO authenticated;
GRANT ALL ON public.plan_entitlements TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_modules()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_has_modules boolean;
  v_modules jsonb;
  v_features jsonb;
BEGIN
  SELECT COALESCE(
    (SELECT COALESCE(bp.code, s.plan)
       FROM public.subscriptions s
       LEFT JOIN public.billing_plans bp ON (bp.id::text = s.plan)
      WHERE s.user_id = v_uid AND s.status IN ('active','trialing')
      ORDER BY s.current_period_end DESC NULLS LAST LIMIT 1),
    (SELECT code FROM public.billing_plans WHERE is_default ORDER BY display_order LIMIT 1)
  ) INTO v_code;

  SELECT EXISTS (SELECT 1 FROM public.plan_entitlements WHERE plan_code = v_code AND kind = 'module')
    INTO v_has_modules;

  IF v_has_modules THEN
    SELECT jsonb_agg(to_jsonb(m) ORDER BY m.display_order) INTO v_modules FROM (
      SELECT key, name_es, name_en, description_es, description_en, icon, display_order
      FROM public.modules_catalog
      WHERE gated AND key IN (SELECT key FROM public.plan_entitlements WHERE plan_code = v_code AND kind = 'module')
    ) m;
  ELSE
    SELECT jsonb_agg(to_jsonb(m) ORDER BY m.display_order) INTO v_modules FROM (
      SELECT key, name_es, name_en, description_es, description_en, icon, display_order
      FROM public.modules_catalog WHERE gated
    ) m;
  END IF;

  SELECT COALESCE(jsonb_agg(key ORDER BY key), '[]'::jsonb) INTO v_features
  FROM public.plan_entitlements WHERE plan_code = v_code AND kind = 'feature';

  RETURN jsonb_build_object(
    'plan_code', v_code,
    'unrestricted', NOT v_has_modules,
    'modules', COALESCE(v_modules, '[]'::jsonb),
    'features', v_features
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_my_modules() TO authenticated, service_role;