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
