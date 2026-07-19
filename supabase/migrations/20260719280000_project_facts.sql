-- =========================================================
-- Ficha de datos del proyecto con PROCEDENCIA por dato.
--
-- GeoCapitals es una plataforma de certificación: no puede mezclar lo probado
-- con lo informado por el dueño. Cada dato (superficie, ley, reserva, titular…)
-- se carga con uno de tres estados de procedencia:
--   certificado  → verificado por tercero / QP / estándar (NI 43-101, JORC…)
--   declarado    → informado por el dueño, con fuente pero sin verificación
--   a_verificar  → pendiente de confirmación (entra al checklist de due diligence)
--
-- Una fila por dato. RLS: miembros del proyecto leen; owner/admin editan (se
-- refuerza en la capa de server fn). Aditivo: el módulo degrada si no existe.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.project_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  section text NOT NULL DEFAULT 'otro',   -- activo|geologia|oro|tierras_raras|economico|catastro|legal|otro
  label text NOT NULL,
  value text,
  unit text,
  provenance text NOT NULL DEFAULT 'a_verificar',  -- certificado|declarado|a_verificar
  source text,                            -- quién certifica/declara (lab, QP, boletín…)
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_facts_project ON public.project_facts(project_id);

ALTER TABLE public.project_facts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view facts" ON public.project_facts;
CREATE POLICY "Members view facts"
  ON public.project_facts FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members insert facts" ON public.project_facts;
CREATE POLICY "Members insert facts"
  ON public.project_facts FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Members update facts" ON public.project_facts;
CREATE POLICY "Members update facts"
  ON public.project_facts FOR UPDATE TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members delete facts" ON public.project_facts;
CREATE POLICY "Members delete facts"
  ON public.project_facts FOR DELETE TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_project_facts_updated ON public.project_facts;
CREATE TRIGGER trg_project_facts_updated
  BEFORE UPDATE ON public.project_facts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
