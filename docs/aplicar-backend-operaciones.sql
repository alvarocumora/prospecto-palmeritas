-- ============================================================================
-- GeoCapitals · APLICAR TODO EL BACKEND DE OPERACIONES (una sola pasada)
-- ============================================================================
-- Pega este archivo COMPLETO en el SQL editor de Supabase y córrelo UNA vez.
-- Es idempotente (IF NOT EXISTS / CREATE OR REPLACE): re-correrlo no rompe nada.
-- Asume que las tablas base de Lovable ya existen en la cloud (commodity_trades,
-- operations, operation_documents, trade_documents, sourcing_*, supplier_offers,
-- subscriptions, billing_plans) y las funciones is_gc_staff / auth.uid.
--
-- Incluye, en orden: checklist REICON (multi-commodity), screening, productos,
-- puente propuesta->productos, accesos, negociación (+ por link), módulos SaaS,
-- margen/reparto y ficha pública. Tras correrlo, el flujo real funciona.
-- Generado desde supabase/migrations (fuente de verdad).
-- ============================================================================


-- ========== 20260725210000_operation_document_checklist ==========
-- OPERACIONES · Checklist de documentos requeridos (estructura GeoCapitals).
--
-- Define, de forma VERSIONADA y EDITABLE, qué documentos debe subir cada parte por
-- etapa/tipo de commodity, y expone por RPC su estado (falta/subido/aprobado/
-- observado/firmado) cruzando contra operation_documents. Esto es "la app dice qué
-- documentos faltan bajo la estructura operada por GeoCapitals".
--
-- La base para 'copper_cathode' se sembró FIEL al marco entregado por el comprador:
-- "REICON – KYC & Supplier Due Diligence Framework – Copper Cathode & Mineral
-- Suppliers". No es una lista inventada. Se marca verificado_por='Comprador (REICON)
-- — marco de precalificación' / fecha_verificacion NULL hasta que GeoCapitals la
-- adopte formalmente como canónica (queda editable sin tocar código).
--
-- doc_kind es el VOCABULARIO CANÓNICO: el front debe usar estos slugs como
-- operation_documents.kind para que el cruce del checklist funcione.
--
-- Depende de tablas de Lovable (public.operations, public.operation_documents) que
-- ya existen en la base; el RPC las referencia (no las crea).

CREATE TABLE IF NOT EXISTS public.operation_document_structure (
  commodity text NOT NULL,                 -- 'copper_cathode' | '*' (genérico)
  doc_kind text NOT NULL,                  -- slug canónico == operation_documents.kind
  section_no integer NOT NULL,
  section text NOT NULL,
  title text NOT NULL,
  description text,
  obligation text NOT NULL DEFAULT 'mandatory'
    CHECK (obligation IN ('mandatory', 'conditional', 'if_available')),
  condition text,                          -- aplica solo si obligation='conditional'
  required_from_role text NOT NULL DEFAULT 'seller'
    CHECK (required_from_role IN ('buyer', 'seller', 'geocapitals')),
  sequence integer NOT NULL DEFAULT 0,
  fuente text,
  verificado_por text,
  fecha_verificacion date,                 -- NULL => estructura por confirmar
  PRIMARY KEY (commodity, doc_kind)
);

ALTER TABLE public.operation_document_structure ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='operation_document_structure' AND policyname='operation_document_structure_read') THEN
    CREATE POLICY "operation_document_structure_read" ON public.operation_document_structure FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.operation_document_structure TO authenticated;
GRANT ALL ON public.operation_document_structure TO service_role;

COMMENT ON TABLE public.operation_document_structure IS
  'Estructura GeoCapitals de documentos requeridos por commodity/etapa. Base copper_cathode = marco REICON (comprador). Editable; fecha_verificacion NULL = por confirmar. doc_kind == operation_documents.kind.';

-- ============================================================================
-- Seed: copper_cathode (marco REICON). Fuente y estado marcados por confirmar.
-- ============================================================================
INSERT INTO public.operation_document_structure
  (commodity, doc_kind, section_no, section, title, description, obligation, condition, required_from_role, sequence, fuente, verificado_por)
VALUES
  -- SECCIÓN I — Legalidad upstream & derechos mineros
  ('copper_cathode','mining_permit',1,'Legalidad upstream & derechos mineros','Permiso / derechos mineros vigentes','Permiso minero emitido por la autoridad competente a nombre de quien posee los derechos; si el proveedor no es dueño de la mina, contrato con la cooperativa/dueño.','mandatory',NULL,'seller',1,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','upstream_invoice',1,'Legalidad upstream & derechos mineros','Factura comercial upstream','Factura auténtica emitida por la mina productora que confirma la venta de mineral a la entidad procesadora/refinadora.','mandatory',NULL,'seller',2,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','export_authorization',1,'Legalidad upstream & derechos mineros','Autorización de exportación','Licencia o autorización de exportación vigente de la autoridad del país de origen.','mandatory',NULL,'seller',3,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','certificate_of_origin',1,'Legalidad upstream & derechos mineros','Certificado de origen (COO)','Emitido por una Cámara de Comercio autorizada o autoridad competente.','mandatory',NULL,'seller',4,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','mandate_letter',1,'Legalidad upstream & derechos mineros','Carta de autorización (mandato)','Si actúa como intermediario/broker: carta de la mina productora, en papel membretado, firmada, con alcance y duración de la representación.','conditional','intermediario_o_broker','seller',5,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),

  -- SECCIÓN II — KYC legal & corporativo
  ('copper_cathode','business_license',2,'KYC legal & corporativo','Licencia comercial (versión en inglés)',NULL,'mandatory',NULL,'seller',1,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','articles_of_association',2,'KYC legal & corporativo','Estatutos / escritura de constitución',NULL,'mandatory',NULL,'seller',2,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','trade_license',2,'KYC legal & corporativo','Certificado de licencia de comercio',NULL,'mandatory',NULL,'seller',3,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','mining_authority_registration',2,'KYC legal & corporativo','Registro ante autoridad minera','Licencia minera, RCCM o equivalente.','mandatory',NULL,'seller',4,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','operational_address_proof',2,'KYC legal & corporativo','Prueba de domicilio operativo','Escritura de propiedad o contrato de arriendo.','mandatory',NULL,'seller',5,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','directors_shareholders_id',2,'KYC legal & corporativo','Identificación de directores y accionistas principales',NULL,'mandatory',NULL,'seller',6,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','ubo_declaration',2,'KYC legal & corporativo','Declaración de beneficiario final (UBO)',NULL,'mandatory',NULL,'seller',7,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','corporate_org_chart',2,'KYC legal & corporativo','Organigrama corporativo',NULL,'mandatory',NULL,'seller',8,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),

  -- SECCIÓN III — Due diligence financiera
  ('copper_cathode','bank_reference_letter',3,'Due diligence financiera','Carta de referencia bancaria','Emitida dentro de los últimos 6 meses.','mandatory',NULL,'seller',1,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','banking_coordinates',3,'Due diligence financiera','Coordenadas bancarias completas',NULL,'mandatory',NULL,'seller',2,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','audited_financials',3,'Due diligence financiera','Estados financieros auditados','Últimos 2 ejercicios.','if_available',NULL,'seller',3,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','tax_compliance_certificates',3,'Due diligence financiera','Certificados de cumplimiento tributario',NULL,'if_available',NULL,'seller',4,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','trade_references',3,'Due diligence financiera','Referencias comerciales','Bancos o socios comerciales.','if_available',NULL,'seller',5,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),

  -- SECCIÓN IV — Calidad, producción & ESG
  ('copper_cathode','production_capacity_statement',4,'Calidad, producción & ESG','Declaración de capacidad de producción',NULL,'mandatory',NULL,'seller',1,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','refining_process_description',4,'Calidad, producción & ESG','Descripción del proceso de refinación',NULL,'mandatory',NULL,'seller',2,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','annual_production_volume',4,'Calidad, producción & ESG','Volumen de producción anual',NULL,'mandatory',NULL,'seller',3,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','typical_lot_size',4,'Calidad, producción & ESG','Tamaño típico de lote de embarque',NULL,'mandatory',NULL,'seller',4,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','iso_certifications',4,'Calidad, producción & ESG','Certificaciones ISO','ISO 9001, 14001, 45001.','if_available',NULL,'seller',5,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','lme_compliance',4,'Calidad, producción & ESG','Documentación de cumplimiento LME',NULL,'if_available',NULL,'seller',6,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','esg_policy',4,'Calidad, producción & ESG','Política ESG / sostenibilidad',NULL,'if_available',NULL,'seller',7,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','environmental_management',4,'Calidad, producción & ESG','Prácticas de gestión ambiental',NULL,'if_available',NULL,'seller',8,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','community_engagement_policy',4,'Calidad, producción & ESG','Política de relacionamiento comunitario',NULL,'if_available',NULL,'seller',9,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','governance_ethics_framework',4,'Calidad, producción & ESG','Marco de gobernanza y ética',NULL,'if_available',NULL,'seller',10,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),

  -- SECCIÓN V — Compliance, sanciones & ética
  ('copper_cathode','conflict_free_certificate',5,'Compliance, sanciones & ética','Certificado libre de conflicto (ICGLR)','Certificado de origen del producto / ICGLR, si aplica.','conditional','si_aplica','seller',1,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','traceability_documentation',5,'Compliance, sanciones & ética','Documentación de trazabilidad','Tags ITSCI o equivalente, donde aplique.','conditional','donde_aplique','seller',2,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','sanctions_declaration',5,'Compliance, sanciones & ética','Declaración anti-sanciones/conflicto','Declaración escrita de que el material no proviene de regiones sancionadas o en conflicto.','mandatory',NULL,'seller',3,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','sanctions_screening',5,'Compliance, sanciones & ética','Screening de sanciones (OFAC/UN/EU/UK)','Screening independiente contra listas OFAC, ONU, UE, UK y otras watchlists. Lo ejecuta GeoCapitals.','mandatory',NULL,'geocapitals',4,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','anticorruption_policy',5,'Compliance, sanciones & ética','Política anticorrupción y antisoborno',NULL,'if_available',NULL,'seller',5,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','code_of_conduct',5,'Compliance, sanciones & ética','Código de conducta',NULL,'if_available',NULL,'seller',6,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','labor_law_compliance',5,'Compliance, sanciones & ética','Certificación de cumplimiento laboral',NULL,'if_available',NULL,'seller',7,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','human_rights_policy',5,'Compliance, sanciones & ética','Política de derechos humanos',NULL,'if_available',NULL,'seller',8,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),

  -- SECCIÓN VI — Historial contractual & desempeño
  ('copper_cathode','previous_contracts',6,'Historial contractual & desempeño','Contratos internacionales previos',NULL,'if_available',NULL,'seller',1,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','export_logistics_docs',6,'Historial contractual & desempeño','Documentación de logística de exportación',NULL,'if_available',NULL,'seller',2,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','bl_samples',6,'Historial contractual & desempeño','Muestras de BL','Bills of Lading; versión redactada es aceptable.','if_available',NULL,'seller',3,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación'),
  ('copper_cathode','prior_buyer_references',6,'Historial contractual & desempeño','Referencias de compradores previos',NULL,'if_available',NULL,'seller',4,'REICON KYC Framework — Copper Cathode','Comprador (REICON) — marco de precalificación')
ON CONFLICT (commodity, doc_kind) DO NOTHING;

-- ============================================================================
-- RPC: checklist con estado por documento requerido de una operación.
-- Normaliza el commodity de la operación (cobre/cátodo -> copper_cathode) y cruza
-- contra la última versión de cada operation_documents.kind.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.operation_documents_checklist(p_operation_id uuid)
RETURNS TABLE (
  section_no integer, section text, doc_kind text, title text, description text,
  obligation text, condition text, required_from_role text, sequence integer,
  status text, document_id uuid, version integer, uploaded_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH op AS (
    SELECT id,
           CASE WHEN lower(coalesce(commodity,'')) ~ '(cathode|c[aá]todo|copper|cobre)'
                THEN 'copper_cathode' ELSE lower(coalesce(commodity,'')) END AS ckey
    FROM public.operations WHERE id = p_operation_id
  ),
  latest AS (
    SELECT DISTINCT ON (kind) kind, id, version, review_status, is_frozen, created_at
    FROM public.operation_documents
    WHERE operation_id = p_operation_id
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
  FROM public.operation_document_structure s
  JOIN op ON s.commodity = op.ckey OR s.commodity = '*'
  LEFT JOIN latest l ON l.kind = s.doc_kind
  ORDER BY s.section_no, s.sequence;
$$;

GRANT EXECUTE ON FUNCTION public.operation_documents_checklist(uuid) TO authenticated, service_role;

-- ============================================================================
-- RPC: readiness — resumen para "puede pasar a evaluación comercial".
-- El marco exige que TODO lo obligatorio esté al menos entregado (no observado).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.operation_documents_readiness(p_operation_id uuid)
RETURNS TABLE (mandatory_total integer, mandatory_ok integer, mandatory_missing integer,
               optional_total integer, ready boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (SELECT * FROM public.operation_documents_checklist(p_operation_id))
  SELECT
    count(*) FILTER (WHERE obligation = 'mandatory')::int,
    count(*) FILTER (WHERE obligation = 'mandatory' AND status IN ('subido','aprobado','firmado'))::int,
    count(*) FILTER (WHERE obligation = 'mandatory' AND status IN ('falta','observado'))::int,
    count(*) FILTER (WHERE obligation <> 'mandatory')::int,
    (count(*) FILTER (WHERE obligation = 'mandatory' AND status IN ('falta','observado')) = 0)
  FROM c;
$$;

GRANT EXECUTE ON FUNCTION public.operation_documents_readiness(uuid) TO authenticated, service_role;


-- ========== 20260725220000_trade_documents_checklist ==========
-- OPERACIONES (spine = Trades) · Checklist de documentos requeridos sobre el
-- sistema CABLEADO al menú (commodity_trades / trade_documents), reusando el mismo
-- catálogo operation_document_structure (marco REICON). Ver docs/plan-mejoras-
-- operaciones.md: el sistema que la gente alcanza es Trades; aquí se le lleva el
-- control de compliance que hoy solo tenía el sistema huérfano "Operaciones".
--
-- doc_type de trade_documents == doc_kind del catálogo: el front debe ofrecer estos
-- slugs como docType para que el cruce funcione. Vocabulario de status verificado en
-- src/lib/tradeOps.functions.ts: pending | uploaded | verified | rejected | signed
-- (+ cancelled). Filas vigentes = última por doc_type.
--
-- Depende de tablas de Lovable (commodity_trades, trade_documents) y de
-- operation_document_structure (migración 20260725210000). No las crea.

CREATE OR REPLACE FUNCTION public.trade_documents_checklist(p_trade_id uuid)
RETURNS TABLE (
  section_no integer, section text, doc_kind text, title text, description text,
  obligation text, condition text, required_from_role text, sequence integer,
  status text, document_id uuid, uploaded_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH tr AS (
    SELECT id,
           CASE WHEN lower(coalesce(commodity,'')) ~ '(cathode|c[aá]todo|copper|cobre)'
                THEN 'copper_cathode' ELSE lower(coalesce(commodity,'')) END AS ckey
    FROM public.commodity_trades WHERE id = p_trade_id
  ),
  latest AS (
    SELECT DISTINCT ON (doc_type) doc_type, id, status, signed_at, updated_at
    FROM public.trade_documents
    WHERE trade_id = p_trade_id
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
  FROM public.operation_document_structure s
  JOIN tr ON s.commodity = tr.ckey OR s.commodity = '*'
  LEFT JOIN latest l ON l.doc_type = s.doc_kind
  ORDER BY s.section_no, s.sequence;
$$;

GRANT EXECUTE ON FUNCTION public.trade_documents_checklist(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trade_documents_readiness(p_trade_id uuid)
RETURNS TABLE (mandatory_total integer, mandatory_ok integer, mandatory_missing integer,
               optional_total integer, ready boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (SELECT * FROM public.trade_documents_checklist(p_trade_id))
  SELECT
    count(*) FILTER (WHERE obligation = 'mandatory')::int,
    count(*) FILTER (WHERE obligation = 'mandatory' AND status IN ('subido','aprobado','firmado'))::int,
    count(*) FILTER (WHERE obligation = 'mandatory' AND status IN ('falta','observado'))::int,
    count(*) FILTER (WHERE obligation <> 'mandatory')::int,
    (count(*) FILTER (WHERE obligation = 'mandatory' AND status IN ('falta','observado')) = 0)
  FROM c;
$$;

GRANT EXECUTE ON FUNCTION public.trade_documents_readiness(uuid) TO authenticated, service_role;


-- ========== 20260725230000_trade_screening ==========
-- OPERACIONES (spine Trades) · Registro de screening de sanciones (OFAC/UN/EU/UK).
--
-- Destraba el gate 'ready': la fila 'sanctions_screening' del checklist REICON es
-- mandatory y required_from_role='geocapitals', pero la War Room solo permite subir
-- documentos de la CONTRAPARTE, así que ese ítem nunca se satisfacía y el botón
-- "Pasar a evaluación comercial" quedaba bloqueado para siempre.
--
-- Aquí GC registra el screening (estructurado y auditable). El RPC actualiza un
-- marcador en trade_documents(doc_type='sanctions_screening') para que el checklist
-- y el readiness ya existentes lo reflejen sin cambios:
--   * algún 'hit'                  -> marcador 'rejected'  -> checklist 'observado' (bloquea)
--   * todos 'clear' (sin pending)  -> marcador 'verified'  -> checklist 'aprobado' (satisface)
--   * aún 'pending'                -> sin marcador         -> checklist 'falta' (bloquea)
--
-- Depende de tablas de Lovable (commodity_trades, trade_documents) que ya existen.

CREATE TABLE IF NOT EXISTS public.trade_screenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL,
  subject_name text NOT NULL,
  subject_type text NOT NULL DEFAULT 'company' CHECK (subject_type IN ('company','ubo','individual')),
  lists_checked text[] NOT NULL DEFAULT '{}',           -- p.ej. {OFAC,UN,EU,UK}
  outcome text NOT NULL CHECK (outcome IN ('clear','hit','pending')),
  matched_details text,
  notes text,
  screened_by uuid,
  screened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_screenings_trade ON public.trade_screenings (trade_id, screened_at DESC);

ALTER TABLE public.trade_screenings ENABLE ROW LEVEL SECURITY;
-- Lectura para autenticados; la escritura va solo por el RPC (SECURITY DEFINER).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trade_screenings' AND policyname='trade_screenings_read') THEN
    CREATE POLICY "trade_screenings_read" ON public.trade_screenings FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.trade_screenings TO authenticated;
GRANT ALL ON public.trade_screenings TO service_role;

COMMENT ON TABLE public.trade_screenings IS
  'Screening de sanciones (OFAC/UN/EU/UK) por operación. Satisface la fila sanctions_screening del checklist REICON vía un marcador en trade_documents.';

-- Registra un screening y recomputa el marcador de trade_documents.
CREATE OR REPLACE FUNCTION public.record_trade_screening(
  p_trade_id uuid,
  p_subject_name text,
  p_subject_type text DEFAULT 'company',
  p_lists text[] DEFAULT '{}',
  p_outcome text DEFAULT 'pending',
  p_matched_details text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  n_hit int; n_pending int; n_clear int;
  v_status text;
  v_existing uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'record_trade_screening requiere un usuario autenticado';
  END IF;

  INSERT INTO public.trade_screenings
    (trade_id, subject_name, subject_type, lists_checked, outcome, matched_details, notes, screened_by)
  VALUES
    (p_trade_id, p_subject_name, COALESCE(p_subject_type,'company'), COALESCE(p_lists,'{}'),
     p_outcome, p_matched_details, p_notes, v_uid)
  RETURNING id INTO v_id;

  SELECT count(*) FILTER (WHERE outcome='hit'),
         count(*) FILTER (WHERE outcome='pending'),
         count(*) FILTER (WHERE outcome='clear')
    INTO n_hit, n_pending, n_clear
  FROM public.trade_screenings WHERE trade_id = p_trade_id;

  IF n_hit > 0 THEN
    v_status := 'rejected';
  ELSIF n_pending = 0 AND n_clear > 0 THEN
    v_status := 'verified';
  ELSE
    v_status := NULL;                 -- aún pendiente: no satisface
  END IF;

  SELECT id INTO v_existing FROM public.trade_documents
   WHERE trade_id = p_trade_id AND doc_type = 'sanctions_screening'
   ORDER BY updated_at DESC LIMIT 1;

  IF v_status IS NULL THEN
    IF v_existing IS NOT NULL THEN
      DELETE FROM public.trade_documents WHERE id = v_existing;
    END IF;
  ELSIF v_existing IS NULL THEN
    INSERT INTO public.trade_documents (trade_id, doc_type, status, created_by)
    VALUES (p_trade_id, 'sanctions_screening', v_status, v_uid);
  ELSE
    UPDATE public.trade_documents SET status = v_status, updated_at = now() WHERE id = v_existing;
  END IF;

  RETURN v_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.record_trade_screening(uuid,text,text,text[],text,text,text) TO authenticated, service_role;

-- Lista los screenings de una operación (para la UI de GC).
CREATE OR REPLACE FUNCTION public.get_trade_screenings(p_trade_id uuid)
RETURNS TABLE (id uuid, subject_name text, subject_type text, lists_checked text[],
               outcome text, matched_details text, notes text, screened_by uuid, screened_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, subject_name, subject_type, lists_checked, outcome, matched_details, notes, screened_by, screened_at
  FROM public.trade_screenings WHERE trade_id = p_trade_id ORDER BY screened_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_trade_screenings(uuid) TO authenticated, service_role;


-- ========== 20260725240000_trade_products ==========
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


-- ========== 20260725250000_trade_products_from_submission ==========
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


-- ========== 20260725260000_trade_access_links ==========
-- OPERACIONES (spine Trades) · Gobernanza de accesos (parte backend del paso 4).
--
-- Consolidar invitaciones = deprecar los sistemas duplicados (operation_invitations,
-- invitation_links) en /src y quedarse con el mecanismo del spine: token HASHEADO de
-- contraparte en commodity_trades (counterparty_{buyer,seller}_token_hash/prefix).
-- Eso es trabajo de Lovable. La parte de datos que aporto: una vista única para que
-- GeoCapitals audite qué contraparte tiene link ACTIVO por operación, SIN exponer
-- nunca el hash (solo el prefix y un booleano). Link governance para operar en serio.
--
-- Depende de commodity_trades (Lovable). No la crea.

CREATE OR REPLACE FUNCTION public.get_trade_access_links(p_trade_id uuid)
RETURNS TABLE (party text, email text, token_prefix text, active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'buyer'::text, t.counterparty_buyer_email, t.counterparty_buyer_token_prefix,
         (t.counterparty_buyer_token_hash IS NOT NULL)
  FROM public.commodity_trades t WHERE t.id = p_trade_id
  UNION ALL
  SELECT 'seller'::text, t.counterparty_seller_email, t.counterparty_seller_token_prefix,
         (t.counterparty_seller_token_hash IS NOT NULL)
  FROM public.commodity_trades t WHERE t.id = p_trade_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_trade_access_links(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_trade_access_links(uuid) IS
  'Gobernanza de accesos: link activo (buyer/seller) por operación, con prefix y estado. Nunca expone el token_hash.';


-- ========== 20260726000000_checklist_multicommodity ==========
-- OPERACIONES · Checklist de compliance multi-commodity (oro, antimonio, y demás).
--
-- Antes el catálogo estaba solo para 'copper_cathode'. En vez de duplicar 40 docs por
-- metal, se crea una BASE GENÉRICA ('*') que aplica a cualquier commodity (el marco
-- REICON es esencialmente genérico para metales) + EXTRAS específicos por commodity
-- donde hay requisitos distintos (p.ej. oro: abastecimiento responsable LBMA/OCDE;
-- antimonio: uso final / control de exportaciones por ser mineral estratégico).
--
-- Normalización ES/EN de commodity -> clave canónica, y precedencia: una fila del
-- commodity específico gana sobre la genérica con el mismo doc_kind (sin duplicar).

-- 1) Clave canónica de commodity (sinónimos ES/EN). Reutilizable por los RPC.
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

-- 2) Base genérica '*' = copia del set REICON (sin re-tipear). Aplica a TODO commodity.
INSERT INTO public.operation_document_structure
  (commodity, doc_kind, section_no, section, title, description, obligation, condition, required_from_role, sequence, fuente, verificado_por)
SELECT '*', doc_kind, section_no, section, title, description, obligation, condition,
       required_from_role, sequence, 'REICON KYC Framework (base genérica)', verificado_por
FROM public.operation_document_structure
WHERE commodity = 'copper_cathode'
ON CONFLICT (commodity, doc_kind) DO NOTHING;

-- 3) Extras específicos por commodity (sección 7). Marcados por confirmar.
INSERT INTO public.operation_document_structure
  (commodity, doc_kind, section_no, section, title, description, obligation, condition, required_from_role, sequence, fuente, verificado_por)
VALUES
  -- Oro: cadena de custodia y abastecimiento responsable (LBMA / OCDE)
  ('gold','gold_responsible_sourcing',7,'Requisitos específicos del commodity','Debida diligencia de oro responsable','Declaración de abastecimiento responsable conforme a la Guía OCDE y LBMA Responsible Gold, con cadena de custodia del origen.','mandatory',NULL,'seller',1,'OCDE / LBMA Responsible Gold','IA — por confirmar'),
  ('gold','gold_refiner_accreditation',7,'Requisitos específicos del commodity','Acreditación de refinería (LBMA Good Delivery)','Acreditación de la refinería en la lista LBMA Good Delivery o equivalente, cuando aplique.','if_available',NULL,'seller',2,'LBMA','IA — por confirmar'),
  ('gold','kimberley_provenance',7,'Requisitos específicos del commodity','Declaración de procedencia y no financiamiento de conflicto','Declaración de que el oro no financia conflictos armados ni proviene de minería ilegal.','mandatory',NULL,'seller',3,'OCDE Anexo II','IA — por confirmar'),
  -- Antimonio: mineral estratégico / crítico
  ('antimony','end_use_statement',7,'Requisitos específicos del commodity','Declaración de uso final y no desvío','Declaración del uso final del antimonio y compromiso de no desvío a usos militares no autorizados.','mandatory',NULL,'seller',1,'Control de minerales estratégicos','IA — por confirmar'),
  ('antimony','export_control_declaration',7,'Requisitos específicos del commodity','Declaración de control de exportaciones / doble uso','Cumplimiento de controles de exportación aplicables a minerales críticos y de doble uso.','conditional','si_aplica','seller',2,'Régimen de control de exportaciones','IA — por confirmar'),
  -- Estaño (conflict mineral 3TG): trazabilidad reforzada
  ('tin','3tg_traceability',7,'Requisitos específicos del commodity','Trazabilidad 3TG reforzada','Trazabilidad conforme a esquemas 3TG (ITSCI o equivalente) por ser mineral de zonas de conflicto.','mandatory',NULL,'seller',1,'OCDE 3TG / ITSCI','IA — por confirmar'),
  -- Metales de batería (litio/cobalto): due diligence de cadena de suministro
  ('cobalt','battery_supply_chain_dd',7,'Requisitos específicos del commodity','Debida diligencia de cadena de suministro de cobalto','Debida diligencia de cadena de suministro conforme a la Guía OCDE (trabajo infantil / minería artesanal).','mandatory',NULL,'seller',1,'OCDE Minerales','IA — por confirmar'),
  ('lithium','battery_grade_spec',7,'Requisitos específicos del commodity','Especificación grado batería','Certificado de especificación grado batería (p.ej. Li2CO3 / LiOH) y hoja de datos técnica.','if_available',NULL,'seller',1,'Especificación técnica','IA — por confirmar')
ON CONFLICT (commodity, doc_kind) DO NOTHING;

-- 4) Recrear los checklist para usar la clave canónica + base '*' con precedencia
--    (lo específico gana sobre lo genérico para el mismo doc_kind).
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


-- ========== 20260726010000_trade_negotiation ==========
-- OPERACIONES (spine Trades) · Negociación estructurada de términos.
--
-- Falta la capa de oferta/contraoferta: hoy la negociación es texto libre
-- (commodity_inquiry_messages) y los términos finales quedan sueltos en
-- commodity_trades. Esta tabla estructura la negociación: cada fila es una PROPUESTA
-- de términos (precio, cantidad, Incoterm, fechas, puertos, pago, envío) de una parte,
-- con estado y cadena de contraofertas. Al ACEPTAR, se vuelcan los términos al trade.
-- Así "negociar precio/fecha/tipo de contrato CIF/FOB/detalles de envío" queda todo
-- trazado en plataforma.
--
-- Depende de commodity_trades (Lovable). Escritura vía RPC (SECURITY DEFINER).

CREATE TABLE IF NOT EXISTS public.trade_negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.commodity_trades(id) ON DELETE CASCADE,
  party text NOT NULL CHECK (party IN ('buyer','seller','geocapitals')),
  price_usd_t numeric,
  quantity_t numeric,
  incoterm text,                 -- CIF | FOB | CFR | DAP | DDP ...
  port_loading text,
  port_discharge text,
  delivery_from date,
  delivery_to date,
  payment_terms text,            -- p.ej. "DLC irrevocable a la vista"
  shipping_notes text,           -- detalles de envío / logística
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

COMMENT ON TABLE public.trade_negotiations IS
  'Negociación estructurada de términos por operación: oferta/contraoferta (precio, cantidad, Incoterm, fechas, puertos, pago, envío). Al aceptar, se vuelcan los términos a commodity_trades.';

-- Proponer términos (oferta o contraoferta). Si p_replies_to apunta a una propuesta
-- abierta, la marca 'countered'.
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

-- Responder una propuesta: aceptar o rechazar. Al aceptar, vuelca los términos al
-- trade y marca el resto de propuestas abiertas como 'superseded'.
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

  -- accept
  UPDATE public.trade_negotiations SET status = 'accepted', message = COALESCE(p_note, message) WHERE id = p_offer_id;
  UPDATE public.trade_negotiations
     SET status = 'superseded'
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

-- Hilo de negociación de una operación (para la UI).
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


-- ========== 20260726020000_saas_modules ==========
-- SAAS MODULAR · Catálogo de módulos + entitlements por plan + get_my_modules().
--
-- 3 módulos vendibles por separado (por planes): Catastro/Exploración/Certificación,
-- Commodities/Trading/Envíos, Capital/Deals de minas. Un plan (billing_plans.code)
-- habilita módulos y features (p.ej. bilingual_docs) vía plan_entitlements. El front
-- llama get_my_modules() para armar el selector de módulo y gatear rutas.
--
-- Resolución (modelo real de Lovable): user -> subscriptions(user_id).plan ->
-- billing_plans.code -> plan_entitlements. Solo LEE subscriptions/billing_plans; no
-- las modifica. Compatibilidad: si un plan no tiene módulos configurados, se devuelven
-- TODOS (unrestricted) para no romper usuarios existentes; la restricción es opt-in.

-- Catálogo de módulos (bilingüe ES/EN). 'gated' = módulo vendible; core siempre activo.
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

-- Entitlements por plan: qué módulos y features incluye cada billing_plans.code.
-- Se puebla con los códigos de plan reales (admin). Vacío => unrestricted (ver RPC).
CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  plan_code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('module','feature')),
  key text NOT NULL,               -- module: catastro|commodities|capital ; feature: p.ej. bilingual_docs
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

COMMENT ON TABLE public.plan_entitlements IS
  'Módulos y features por plan (billing_plans.code). Vacío para un plan => acceso a todos los módulos (unrestricted). Feature bilingual_docs habilita generación bilingüe ES/EN.';

-- Resuelve los módulos/features del usuario actual según su plan.
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
  -- Plan del usuario (suscripción activa) o el plan por defecto.
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


-- ========== 20260726030000_negociacion_por_link ==========
-- OPERACIONES · Habilita negociación por LINK público (WhatsApp / portal sin cuenta).
--
-- Una contraparte que entra por un link tokenizado no tiene sesión: el server fn de
-- Lovable valida el token y llama a estos RPC vía service client (sin auth.uid()).
-- Antes propose/respond exigían auth.uid() y rompían ese flujo. Se relaja: se registra
-- auth.uid() si existe (usuario logueado) y se permite null (flujo por token, donde el
-- server fn ya validó el enlace). El grant sigue siendo authenticated/service_role
-- (nunca anon): el gatekeeper del token es el server fn.
--
-- record_trade_screening NO se toca: el screening lo hace staff GC autenticado.

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
  IF p_party NOT IN ('buyer','seller','geocapitals') THEN
    RAISE EXCEPTION 'parte inválida: %', p_party;
  END IF;
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
     p_replies_to, auth.uid())            -- null en flujo por token (server fn ya validó)
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
     SET unit_price_usd     = COALESCE(r.price_usd_t, unit_price_usd),
         quantity_t         = COALESCE(r.quantity_t, quantity_t),
         incoterm           = COALESCE(r.incoterm, incoterm),
         payment_instrument = COALESCE(r.payment_terms, payment_instrument),
         updated_at         = now()
   WHERE id = r.trade_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.respond_trade_terms(uuid,text,text) TO authenticated, service_role;


-- ========== 20260804000000_trade_margin_split ==========
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


-- ========== 20260804010000_margin_extra_pool ==========
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


-- ========== 20260804020000_public_ficha ==========
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

