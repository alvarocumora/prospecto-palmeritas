-- Detalle estructurado de la ficha de proveedor: reemplaza los bloques
-- hardcodeados del renderer por datos en la base. Guarda intro, tablas
-- (detalle del mineral, leyes/precios, análisis, etc.) y cláusulas como JSONB,
-- para que el PDF y la página pública los lean de forma genérica.
ALTER TABLE public.sourcing_submissions
  ADD COLUMN IF NOT EXISTS ficha_detail jsonb;

COMMENT ON COLUMN public.sourcing_submissions.ficha_detail IS
  'Detalle estructurado de la ficha: { intro?: string, tables?: [{ title?, columns[], rows[][] }], clauses?: string[] }';
