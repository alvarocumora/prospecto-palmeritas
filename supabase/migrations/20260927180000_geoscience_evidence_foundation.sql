-- Geoscience Evidence Foundation v1
-- Consolida la capa de evidencia geocientífica (satelital + geofísica) sobre el
-- modelo de proyecto existente, sin reemplazar tablas vigentes. Alcance:
--   1) data_sources: registro canónico de proveedores/licencias por dataset.
--   2) satellite_anomalies: columnas aditivas para trazabilidad (sensor, escena,
--      método, target_id canónico) — no se tocan las columnas existentes.
--   3) exploration_targets como target canónico: satellite_evidence gana
--      target_id_canonical -> exploration_targets, sin romper el vínculo legacy
--      a satellite_targets (que queda marcado deprecated en comentario).
--   4) target_scores + target_score_sources: scoring versionado con
--      strength/confidence/completeness separados, por modelo y versión.
--
-- Ver docs/geoscience-evidence-foundation.md para el contrato completo y el
-- audit previo (columnas reales vs. propuestas) que motivó este alcance.

-- ============================================================
-- 1) data_sources
-- ============================================================
CREATE TABLE IF NOT EXISTS public.data_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  dataset_code TEXT NOT NULL,
  collection TEXT,
  kind TEXT NOT NULL CHECK (kind IN (
    'satellite','sar','dem','magnetic','gravity','geochemistry','geology',
    'cadastre','other'
  )),
  access_url TEXT,
  license_id TEXT,
  license_url TEXT,
  redistribution_allowed BOOLEAN NOT NULL DEFAULT false,
  commercial_use_allowed BOOLEAN NOT NULL DEFAULT false,
  derived_product_rules TEXT,
  attribution_text TEXT,
  terms_checked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, dataset_code)
);

CREATE INDEX IF NOT EXISTS idx_data_sources_kind ON public.data_sources(kind);

ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view data sources"
  ON public.data_sources FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert data sources"
  ON public.data_sources FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update data sources"
  ON public.data_sources FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE TRIGGER trg_data_sources_updated
  BEFORE UPDATE ON public.data_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: fuentes abiertas usadas hoy por el pipeline Sentinel-2/EMAG2.
INSERT INTO public.data_sources (provider, dataset_code, collection, kind, access_url, license_id, redistribution_allowed, commercial_use_allowed, attribution_text)
VALUES
  ('ESA/Copernicus', 'sentinel-2-l2a', 'sentinel-2-l2a', 'satellite', 'https://dataspace.copernicus.eu', 'copernicus-data-legal-notice', true, true, 'Contains modified Copernicus Sentinel data'),
  ('ESA/Copernicus', 'sentinel-1-grd', 'sentinel-1-grd', 'sar', 'https://dataspace.copernicus.eu', 'copernicus-data-legal-notice', true, true, 'Contains modified Copernicus Sentinel data'),
  ('NOAA/NCEI', 'emag2-v3', 'emag2', 'magnetic', 'https://www.ncei.noaa.gov', 'public-domain', true, true, 'NOAA/NCEI EMAG2'),
  ('NASA/USGS', 'srtm-1arcsec', 'srtm', 'dem', 'https://earthexplorer.usgs.gov', 'public-domain', true, true, 'NASA/USGS SRTM')
ON CONFLICT (provider, dataset_code) DO NOTHING;

-- ============================================================
-- 2) satellite_anomalies — columnas aditivas de trazabilidad
-- ============================================================
ALTER TABLE public.satellite_anomalies
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.data_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sensor TEXT,
  ADD COLUMN IF NOT EXISTS scene_id TEXT,
  ADD COLUMN IF NOT EXISTS method TEXT,
  ADD COLUMN IF NOT EXISTS method_version TEXT,
  ADD COLUMN IF NOT EXISTS strength NUMERIC,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  ADD COLUMN IF NOT EXISTS feature_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS processing_parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS raster_asset_id TEXT,
  ADD COLUMN IF NOT EXISTS target_id UUID REFERENCES public.exploration_targets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_satellite_anomalies_target ON public.satellite_anomalies(target_id);
CREATE INDEX IF NOT EXISTS idx_satellite_anomalies_source ON public.satellite_anomalies(source_id);

COMMENT ON COLUMN public.satellite_anomalies.strength IS
  'Cuán anómalo es el fenómeno detectado (0..1). Distinto de confidence: strength no implica certeza de la observación.';
COMMENT ON COLUMN public.satellite_anomalies.confidence IS
  'Confianza en la observación/procesamiento (0..1). No confundir con strength.';
COMMENT ON COLUMN public.satellite_anomalies.target_id IS
  'Vínculo directo y canónico a exploration_targets. Preferir sobre el enlace indirecto vía satellite_evidence.target_id -> satellite_targets (legacy).';

-- ============================================================
-- 3) satellite_evidence — puente hacia el target canónico
-- ============================================================
ALTER TABLE public.satellite_evidence
  ADD COLUMN IF NOT EXISTS exploration_target_id UUID REFERENCES public.exploration_targets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_satellite_evidence_exploration_target ON public.satellite_evidence(exploration_target_id);

COMMENT ON COLUMN public.satellite_evidence.target_id IS
  'DEPRECATED: legacy FK a satellite_targets. Usar exploration_target_id (-> exploration_targets) para todo target nuevo. satellite_targets se mantiene solo por compatibilidad histórica.';
COMMENT ON TABLE public.satellite_targets IS
  'DEPRECATED: target canónico de la plataforma es exploration_targets. Esta tabla se conserva por compatibilidad con evidencia satelital histórica; no crear targets nuevos aquí.';

-- ============================================================
-- 4) target_scores + target_score_sources
-- ============================================================
CREATE TABLE IF NOT EXISTS public.target_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.exploration_targets(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  score_total NUMERIC NOT NULL CHECK (score_total >= 0 AND score_total <= 100),
  score_satellite NUMERIC,
  score_magnetic NUMERIC,
  score_geochemistry NUMERIC,
  score_structural NUMERIC,
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  completeness NUMERIC NOT NULL CHECK (completeness >= 0 AND completeness <= 1),
  feature_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  code_commit_sha TEXT,
  created_by UUID,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_target_scores_target ON public.target_scores(target_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_target_scores_project ON public.target_scores(project_id);

COMMENT ON TABLE public.target_scores IS
  'Historial versionado de scoring. Nunca se sobrescribe: cada cómputo crea una fila nueva; la UI muestra la más reciente por target_id y puede comparar históricas.';

ALTER TABLE public.target_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view target scores"
  ON public.target_scores FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can insert target scores"
  ON public.target_scores FOR INSERT
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.target_score_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_score_id UUID NOT NULL REFERENCES public.target_scores(id) ON DELETE CASCADE,
  data_source_id UUID REFERENCES public.data_sources(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  weight NUMERIC NOT NULL CHECK (weight >= 0 AND weight <= 1),
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE INDEX IF NOT EXISTS idx_target_score_sources_score ON public.target_score_sources(target_score_id);

ALTER TABLE public.target_score_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view target score sources"
  ON public.target_score_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.target_scores ts
      WHERE ts.id = target_score_sources.target_score_id
        AND public.is_project_member(ts.project_id, auth.uid())
    )
  );

CREATE POLICY "Project members can insert target score sources"
  ON public.target_score_sources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.target_scores ts
      WHERE ts.id = target_score_sources.target_score_id
        AND public.is_project_member(ts.project_id, auth.uid())
    )
  );
