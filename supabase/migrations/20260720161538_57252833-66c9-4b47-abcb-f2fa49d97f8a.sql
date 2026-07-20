-- 1) Añadir columnas de metadatos y asociaciones (nullable, no rompe filas existentes).
ALTER TABLE public.document_drafts
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trade_id uuid REFERENCES public.commodity_trades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inquiry_id uuid REFERENCES public.sourcing_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','signed','archived'));

-- 2) Quitar la restricción de un único borrador por plantilla: ahora se guarda uno por cliente/operación.
ALTER TABLE public.document_drafts
  DROP CONSTRAINT IF EXISTS document_drafts_user_id_template_id_key;

-- 3) Índices para el listado por usuario ordenado por fecha y para los filtros de asociación.
CREATE INDEX IF NOT EXISTS document_drafts_user_updated_idx
  ON public.document_drafts (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS document_drafts_user_template_idx
  ON public.document_drafts (user_id, template_id);
CREATE INDEX IF NOT EXISTS document_drafts_project_idx
  ON public.document_drafts (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS document_drafts_trade_idx
  ON public.document_drafts (trade_id) WHERE trade_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS document_drafts_inquiry_idx
  ON public.document_drafts (inquiry_id) WHERE inquiry_id IS NOT NULL;