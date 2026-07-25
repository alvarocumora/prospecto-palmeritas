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
