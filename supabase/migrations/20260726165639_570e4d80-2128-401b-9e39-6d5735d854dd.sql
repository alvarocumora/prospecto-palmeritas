-- Tenencia · consolidación espacial de mining_concessions.
ALTER TABLE public.mining_concessions
  ADD COLUMN IF NOT EXISTS geom extensions.geometry(Geometry, 4326);

CREATE OR REPLACE FUNCTION public.mining_concessions_sync_geom()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF NEW.geometry_geojson IS NOT NULL THEN
    BEGIN
      NEW.geom := extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(NEW.geometry_geojson::text), 4326);
      IF NOT extensions.ST_IsValid(NEW.geom) THEN NEW.geom := extensions.ST_MakeValid(NEW.geom); END IF;
    EXCEPTION WHEN others THEN NEW.geom := NULL; END;
  ELSE NEW.geom := NULL; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mining_concessions_sync_geom ON public.mining_concessions;
CREATE TRIGGER trg_mining_concessions_sync_geom
  BEFORE INSERT OR UPDATE OF geometry_geojson ON public.mining_concessions
  FOR EACH ROW EXECUTE FUNCTION public.mining_concessions_sync_geom();

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id, geometry_geojson FROM public.mining_concessions WHERE geom IS NULL AND geometry_geojson IS NOT NULL LOOP
    BEGIN
      UPDATE public.mining_concessions SET geom = extensions.ST_MakeValid(
        extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(r.geometry_geojson::text), 4326)) WHERE id = r.id;
    EXCEPTION WHEN others THEN NULL; END;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_mining_concessions_geom ON public.mining_concessions USING gist (geom);

CREATE OR REPLACE FUNCTION public.tenencia_overlaps(p_geom jsonb, p_exclude_project uuid DEFAULT NULL)
RETURNS TABLE (concession_id uuid, project_id uuid, code text, name text, holder text, concession_type text,
  status text, area_ha numeric, commune text, region text, expires_at timestamptz,
  overlap_ha numeric, pct_of_aoi numeric, pct_of_concession numeric, severity text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  WITH aoi AS (SELECT extensions.ST_MakeValid(extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(p_geom::text), 4326)) AS g)
  SELECT mc.id, mc.project_id, mc.code, mc.name, mc.holder, mc.concession_type, mc.status, mc.area_ha, mc.commune, mc.region, mc.expires_at,
    ROUND((extensions.ST_Area(extensions.ST_Intersection(mc.geom::extensions.geometry, aoi.g)::extensions.geography)/10000)::numeric, 2) AS overlap_ha,
    ROUND((extensions.ST_Area(extensions.ST_Intersection(mc.geom::extensions.geometry, aoi.g)::extensions.geography)/NULLIF(extensions.ST_Area(aoi.g::extensions.geography),0)*100)::numeric, 1) AS pct_of_aoi,
    ROUND((extensions.ST_Area(extensions.ST_Intersection(mc.geom::extensions.geometry, aoi.g)::extensions.geography)/NULLIF(extensions.ST_Area(mc.geom::extensions.geography),0)*100)::numeric, 1) AS pct_of_concession,
    CASE WHEN mc.status='vigente' THEN 'blocking' WHEN mc.status='en_tramite' THEN 'warning' ELSE 'info' END AS severity
  FROM public.mining_concessions mc, aoi
  WHERE mc.geom IS NOT NULL AND (p_exclude_project IS NULL OR mc.project_id IS DISTINCT FROM p_exclude_project)
    AND extensions.ST_Intersects(mc.geom::extensions.geometry, aoi.g)
  ORDER BY overlap_ha DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.tenencia_overlaps(jsonb, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tenencia_overlaps(jsonb, uuid) TO authenticated, service_role;

-- OPERACIONES · Catálogo REICON
CREATE TABLE IF NOT EXISTS public.operation_document_structure (
  commodity text NOT NULL, doc_kind text NOT NULL, section_no integer NOT NULL, section text NOT NULL,
  title text NOT NULL, description text,
  obligation text NOT NULL DEFAULT 'mandatory' CHECK (obligation IN ('mandatory','conditional','if_available')),
  condition text,
  required_from_role text NOT NULL DEFAULT 'seller' CHECK (required_from_role IN ('buyer','seller','geocapitals')),
  sequence integer NOT NULL DEFAULT 0, fuente text, verificado_por text, fecha_verificacion date,
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

INSERT INTO public.operation_document_structure
  (commodity, doc_kind, section_no, section, title, description, obligation, condition, required_from_role, sequence, fuente, verificado_por)
VALUES
  ('copper_cathode','mining_permit',1,'Legalidad upstream & derechos mineros','Permiso / derechos mineros vigentes','Permiso minero emitido por la autoridad competente a nombre de quien posee los derechos; si el proveedor no es dueño de la mina, contrato con la cooperativa/dueño.','mandatory',NULL,'seller',1,'REICON','REICON'),
  ('copper_cathode','upstream_invoice',1,'Legalidad upstream & derechos mineros','Factura comercial upstream','Factura auténtica emitida por la mina productora.','mandatory',NULL,'seller',2,'REICON','REICON'),
  ('copper_cathode','export_authorization',1,'Legalidad upstream & derechos mineros','Autorización de exportación','Licencia vigente del país de origen.','mandatory',NULL,'seller',3,'REICON','REICON'),
  ('copper_cathode','certificate_of_origin',1,'Legalidad upstream & derechos mineros','Certificado de origen (COO)','Cámara de comercio o autoridad competente.','mandatory',NULL,'seller',4,'REICON','REICON'),
  ('copper_cathode','mandate_letter',1,'Legalidad upstream & derechos mineros','Carta de autorización (mandato)','Para intermediario/broker.','conditional','intermediario_o_broker','seller',5,'REICON','REICON'),
  ('copper_cathode','business_license',2,'KYC legal & corporativo','Licencia comercial (versión en inglés)',NULL,'mandatory',NULL,'seller',1,'REICON','REICON'),
  ('copper_cathode','articles_of_association',2,'KYC legal & corporativo','Estatutos / escritura de constitución',NULL,'mandatory',NULL,'seller',2,'REICON','REICON'),
  ('copper_cathode','trade_license',2,'KYC legal & corporativo','Certificado de licencia de comercio',NULL,'mandatory',NULL,'seller',3,'REICON','REICON'),
  ('copper_cathode','mining_authority_registration',2,'KYC legal & corporativo','Registro ante autoridad minera','Licencia minera, RCCM o equivalente.','mandatory',NULL,'seller',4,'REICON','REICON'),
  ('copper_cathode','operational_address_proof',2,'KYC legal & corporativo','Prueba de domicilio operativo','Escritura o arriendo.','mandatory',NULL,'seller',5,'REICON','REICON'),
  ('copper_cathode','directors_shareholders_id',2,'KYC legal & corporativo','ID directores y accionistas',NULL,'mandatory',NULL,'seller',6,'REICON','REICON'),
  ('copper_cathode','ubo_declaration',2,'KYC legal & corporativo','Declaración de beneficiario final (UBO)',NULL,'mandatory',NULL,'seller',7,'REICON','REICON'),
  ('copper_cathode','corporate_org_chart',2,'KYC legal & corporativo','Organigrama corporativo',NULL,'mandatory',NULL,'seller',8,'REICON','REICON'),
  ('copper_cathode','bank_reference_letter',3,'Due diligence financiera','Carta de referencia bancaria','< 6 meses.','mandatory',NULL,'seller',1,'REICON','REICON'),
  ('copper_cathode','banking_coordinates',3,'Due diligence financiera','Coordenadas bancarias',NULL,'mandatory',NULL,'seller',2,'REICON','REICON'),
  ('copper_cathode','audited_financials',3,'Due diligence financiera','Estados financieros auditados','Últimos 2 ejercicios.','if_available',NULL,'seller',3,'REICON','REICON'),
  ('copper_cathode','tax_compliance_certificates',3,'Due diligence financiera','Certificados de cumplimiento tributario',NULL,'if_available',NULL,'seller',4,'REICON','REICON'),
  ('copper_cathode','trade_references',3,'Due diligence financiera','Referencias comerciales',NULL,'if_available',NULL,'seller',5,'REICON','REICON'),
  ('copper_cathode','production_capacity_statement',4,'Calidad, producción & ESG','Declaración de capacidad de producción',NULL,'mandatory',NULL,'seller',1,'REICON','REICON'),
  ('copper_cathode','refining_process_description',4,'Calidad, producción & ESG','Descripción del proceso de refinación',NULL,'mandatory',NULL,'seller',2,'REICON','REICON'),
  ('copper_cathode','annual_production_volume',4,'Calidad, producción & ESG','Volumen de producción anual',NULL,'mandatory',NULL,'seller',3,'REICON','REICON'),
  ('copper_cathode','typical_lot_size',4,'Calidad, producción & ESG','Tamaño típico de lote de embarque',NULL,'mandatory',NULL,'seller',4,'REICON','REICON'),
  ('copper_cathode','iso_certifications',4,'Calidad, producción & ESG','Certificaciones ISO','9001/14001/45001.','if_available',NULL,'seller',5,'REICON','REICON'),
  ('copper_cathode','lme_compliance',4,'Calidad, producción & ESG','Cumplimiento LME',NULL,'if_available',NULL,'seller',6,'REICON','REICON'),
  ('copper_cathode','esg_policy',4,'Calidad, producción & ESG','Política ESG',NULL,'if_available',NULL,'seller',7,'REICON','REICON'),
  ('copper_cathode','environmental_management',4,'Calidad, producción & ESG','Gestión ambiental',NULL,'if_available',NULL,'seller',8,'REICON','REICON'),
  ('copper_cathode','community_engagement_policy',4,'Calidad, producción & ESG','Relacionamiento comunitario',NULL,'if_available',NULL,'seller',9,'REICON','REICON'),
  ('copper_cathode','governance_ethics_framework',4,'Calidad, producción & ESG','Gobernanza y ética',NULL,'if_available',NULL,'seller',10,'REICON','REICON'),
  ('copper_cathode','conflict_free_certificate',5,'Compliance, sanciones & ética','Certificado libre de conflicto (ICGLR)',NULL,'conditional','si_aplica','seller',1,'REICON','REICON'),
  ('copper_cathode','traceability_documentation',5,'Compliance, sanciones & ética','Documentación de trazabilidad','ITSCI o equivalente.','conditional','donde_aplique','seller',2,'REICON','REICON'),
  ('copper_cathode','sanctions_declaration',5,'Compliance, sanciones & ética','Declaración anti-sanciones','Origen fuera de regiones sancionadas/conflicto.','mandatory',NULL,'seller',3,'REICON','REICON'),
  ('copper_cathode','sanctions_screening',5,'Compliance, sanciones & ética','Screening OFAC/UN/EU/UK','Lo ejecuta GeoCapitals.','mandatory',NULL,'geocapitals',4,'REICON','REICON'),
  ('copper_cathode','anticorruption_policy',5,'Compliance, sanciones & ética','Política anticorrupción',NULL,'if_available',NULL,'seller',5,'REICON','REICON'),
  ('copper_cathode','code_of_conduct',5,'Compliance, sanciones & ética','Código de conducta',NULL,'if_available',NULL,'seller',6,'REICON','REICON'),
  ('copper_cathode','labor_law_compliance',5,'Compliance, sanciones & ética','Cumplimiento laboral',NULL,'if_available',NULL,'seller',7,'REICON','REICON'),
  ('copper_cathode','human_rights_policy',5,'Compliance, sanciones & ética','Política de derechos humanos',NULL,'if_available',NULL,'seller',8,'REICON','REICON'),
  ('copper_cathode','previous_contracts',6,'Historial contractual & desempeño','Contratos internacionales previos',NULL,'if_available',NULL,'seller',1,'REICON','REICON'),
  ('copper_cathode','export_logistics_docs',6,'Historial contractual & desempeño','Docs logística de exportación',NULL,'if_available',NULL,'seller',2,'REICON','REICON'),
  ('copper_cathode','bl_samples',6,'Historial contractual & desempeño','Muestras de BL','Bills of Lading; versión redactada OK.','if_available',NULL,'seller',3,'REICON','REICON'),
  ('copper_cathode','prior_buyer_references',6,'Historial contractual & desempeño','Referencias de compradores previos',NULL,'if_available',NULL,'seller',4,'REICON','REICON')
ON CONFLICT (commodity, doc_kind) DO NOTHING;

CREATE OR REPLACE FUNCTION public.operation_documents_checklist(p_operation_id uuid)
RETURNS TABLE (section_no integer, section text, doc_kind text, title text, description text,
  obligation text, condition text, required_from_role text, sequence integer,
  status text, document_id uuid, version integer, uploaded_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH op AS (SELECT id, CASE WHEN lower(coalesce(commodity,'')) ~ '(cathode|c[aá]todo|copper|cobre)' THEN 'copper_cathode' ELSE lower(coalesce(commodity,'')) END AS ckey FROM public.operations WHERE id = p_operation_id),
  latest AS (SELECT DISTINCT ON (kind) kind, id, version, review_status, is_frozen, created_at FROM public.operation_documents WHERE operation_id = p_operation_id ORDER BY kind, version DESC, created_at DESC)
  SELECT s.section_no, s.section, s.doc_kind, s.title, s.description, s.obligation, s.condition, s.required_from_role, s.sequence,
    CASE WHEN l.kind IS NULL THEN 'falta' WHEN l.is_frozen THEN 'firmado' WHEN l.review_status='approved' THEN 'aprobado'
      WHEN l.review_status IN ('rejected','needs_revision') THEN 'observado' ELSE 'subido' END,
    l.id, l.version, l.created_at
  FROM public.operation_document_structure s JOIN op ON s.commodity=op.ckey OR s.commodity='*'
  LEFT JOIN latest l ON l.kind = s.doc_kind ORDER BY s.section_no, s.sequence;
$$;
GRANT EXECUTE ON FUNCTION public.operation_documents_checklist(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.operation_documents_readiness(p_operation_id uuid)
RETURNS TABLE (mandatory_total integer, mandatory_ok integer, mandatory_missing integer, optional_total integer, ready boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (SELECT * FROM public.operation_documents_checklist(p_operation_id))
  SELECT count(*) FILTER (WHERE obligation='mandatory')::int,
    count(*) FILTER (WHERE obligation='mandatory' AND status IN ('subido','aprobado','firmado'))::int,
    count(*) FILTER (WHERE obligation='mandatory' AND status IN ('falta','observado'))::int,
    count(*) FILTER (WHERE obligation<>'mandatory')::int,
    (count(*) FILTER (WHERE obligation='mandatory' AND status IN ('falta','observado')) = 0)
  FROM c;
$$;
GRANT EXECUTE ON FUNCTION public.operation_documents_readiness(uuid) TO authenticated, service_role;

-- TRADES · Checklist reusando el catálogo REICON
CREATE OR REPLACE FUNCTION public.trade_documents_checklist(p_trade_id uuid)
RETURNS TABLE (section_no integer, section text, doc_kind text, title text, description text,
  obligation text, condition text, required_from_role text, sequence integer,
  status text, document_id uuid, uploaded_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH tr AS (SELECT id, CASE WHEN lower(coalesce(commodity,'')) ~ '(cathode|c[aá]todo|copper|cobre)' THEN 'copper_cathode' ELSE lower(coalesce(commodity,'')) END AS ckey FROM public.commodity_trades WHERE id = p_trade_id),
  latest AS (SELECT DISTINCT ON (doc_type) doc_type, id, status, signed_at, updated_at FROM public.trade_documents WHERE trade_id = p_trade_id ORDER BY doc_type, updated_at DESC)
  SELECT s.section_no, s.section, s.doc_kind, s.title, s.description, s.obligation, s.condition, s.required_from_role, s.sequence,
    CASE WHEN l.doc_type IS NULL THEN 'falta'
      WHEN l.signed_at IS NOT NULL OR l.status='signed' THEN 'firmado'
      WHEN l.status='verified' THEN 'aprobado'
      WHEN l.status IN ('rejected','cancelled') THEN 'observado'
      ELSE 'subido' END,
    l.id, l.updated_at
  FROM public.operation_document_structure s JOIN tr ON s.commodity=tr.ckey OR s.commodity='*'
  LEFT JOIN latest l ON l.doc_type = s.doc_kind ORDER BY s.section_no, s.sequence;
$$;
GRANT EXECUTE ON FUNCTION public.trade_documents_checklist(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trade_documents_readiness(p_trade_id uuid)
RETURNS TABLE (mandatory_total integer, mandatory_ok integer, mandatory_missing integer, optional_total integer, ready boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (SELECT * FROM public.trade_documents_checklist(p_trade_id))
  SELECT count(*) FILTER (WHERE obligation='mandatory')::int,
    count(*) FILTER (WHERE obligation='mandatory' AND status IN ('subido','aprobado','firmado'))::int,
    count(*) FILTER (WHERE obligation='mandatory' AND status IN ('falta','observado'))::int,
    count(*) FILTER (WHERE obligation<>'mandatory')::int,
    (count(*) FILTER (WHERE obligation='mandatory' AND status IN ('falta','observado')) = 0)
  FROM c;
$$;
GRANT EXECUTE ON FUNCTION public.trade_documents_readiness(uuid) TO authenticated, service_role;