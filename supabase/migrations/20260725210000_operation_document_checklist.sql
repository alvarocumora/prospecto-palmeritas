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
