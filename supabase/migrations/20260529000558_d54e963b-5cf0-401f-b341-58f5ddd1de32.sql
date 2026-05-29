CREATE TABLE IF NOT EXISTS public.synthetic_drillholes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  hole_code TEXT NOT NULL,
  collar_x_utm DOUBLE PRECISION NOT NULL,
  collar_y_utm DOUBLE PRECISION NOT NULL,
  collar_z_m DOUBLE PRECISION NOT NULL,
  utm_zone INT NOT NULL DEFAULT 19,
  azimuth_deg DOUBLE PRECISION NOT NULL,
  dip_deg DOUBLE PRECISION NOT NULL,
  depth_m DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai_target_v1',
  generated_from_kind TEXT,
  generated_from_id UUID,
  is_conceptual BOOLEAN NOT NULL DEFAULT true,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_synth_dh_project ON public.synthetic_drillholes(project_id);

CREATE TABLE IF NOT EXISTS public.synthetic_assays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hole_id UUID NOT NULL REFERENCES public.synthetic_drillholes(id) ON DELETE CASCADE,
  from_m DOUBLE PRECISION NOT NULL,
  to_m DOUBLE PRECISION NOT NULL,
  cu_pct DOUBLE PRECISION,
  au_gpt DOUBLE PRECISION,
  ag_gpt DOUBLE PRECISION,
  mo_pct DOUBLE PRECISION,
  lithology TEXT,
  alteration TEXT,
  mineralized BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_synth_assay_hole ON public.synthetic_assays(hole_id);

CREATE TABLE IF NOT EXISTS public.synthetic_block_model (
  id BIGSERIAL PRIMARY KEY,
  project_id UUID NOT NULL,
  x_utm DOUBLE PRECISION NOT NULL,
  y_utm DOUBLE PRECISION NOT NULL,
  z_m DOUBLE PRECISION NOT NULL,
  size_x DOUBLE PRECISION NOT NULL DEFAULT 10,
  size_y DOUBLE PRECISION NOT NULL DEFAULT 10,
  size_z DOUBLE PRECISION NOT NULL DEFAULT 5,
  cu_eq_pct DOUBLE PRECISION NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  domain TEXT,
  method TEXT NOT NULL DEFAULT 'idw',
  version INT NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_synth_bm_project ON public.synthetic_block_model(project_id);
CREATE INDEX IF NOT EXISTS idx_synth_bm_grade ON public.synthetic_block_model(project_id, cu_eq_pct);

CREATE TABLE IF NOT EXISTS public.pit_shells (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  revenue_factor DOUBLE PRECISION NOT NULL,
  tonnage_mt DOUBLE PRECISION,
  grade_avg_cu_eq DOUBLE PRECISION,
  strip_ratio DOUBLE PRECISION,
  npv_usd DOUBLE PRECISION,
  mesh_positions JSONB NOT NULL,
  mesh_indices JSONB NOT NULL,
  bounds JSONB,
  method TEXT NOT NULL DEFAULT 'floating_cone',
  is_conceptual BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pitshells_project ON public.pit_shells(project_id);

GRANT SELECT ON public.synthetic_drillholes TO anon, authenticated;
GRANT ALL ON public.synthetic_drillholes TO service_role;
GRANT SELECT ON public.synthetic_assays TO anon, authenticated;
GRANT ALL ON public.synthetic_assays TO service_role;
GRANT SELECT ON public.synthetic_block_model TO anon, authenticated;
GRANT ALL ON public.synthetic_block_model TO service_role;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.synthetic_block_model_id_seq TO service_role;
GRANT SELECT ON public.pit_shells TO anon, authenticated;
GRANT ALL ON public.pit_shells TO service_role;

ALTER TABLE public.synthetic_drillholes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synthetic_assays     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synthetic_block_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pit_shells           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "synthetic_drillholes public read" ON public.synthetic_drillholes;
CREATE POLICY "synthetic_drillholes public read"
  ON public.synthetic_drillholes FOR SELECT USING (true);
DROP POLICY IF EXISTS "synthetic_assays public read" ON public.synthetic_assays;
CREATE POLICY "synthetic_assays public read"
  ON public.synthetic_assays FOR SELECT USING (true);
DROP POLICY IF EXISTS "synthetic_block_model public read" ON public.synthetic_block_model;
CREATE POLICY "synthetic_block_model public read"
  ON public.synthetic_block_model FOR SELECT USING (true);
DROP POLICY IF EXISTS "pit_shells public read" ON public.pit_shells;
CREATE POLICY "pit_shells public read"
  ON public.pit_shells FOR SELECT USING (true);
