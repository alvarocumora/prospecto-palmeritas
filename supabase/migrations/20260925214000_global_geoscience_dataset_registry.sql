-- Global Geoscience Dataset Registry v1
-- One metadata/provenance registry for geophysics, geochemistry, drilling, DEM,
-- remote sensing, geology/structures and derived 3D models.

CREATE TABLE IF NOT EXISTS public.geoscience_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  dataset_type text NOT NULL CHECK (dataset_type IN (
    'geophysics','geochemistry','drilling','dem','remote_sensing',
    'geology','structure','assay','model_3d','block_model'
  )),
  name text NOT NULL,
  method text,
  source_system text,
  source_ref text,
  crs text,
  vertical_datum text,
  geometry_type text,
  units jsonb NOT NULL DEFAULT '{}'::jsonb,
  bbox_wgs84 jsonb,
  provenance text NOT NULL CHECK (provenance IN (
    'OFFICIAL','CERTIFIED','DOCUMENTARY','DECLARED','DERIVED','INTERPRETED'
  )),
  qa_status text NOT NULL DEFAULT 'unreviewed' CHECK (qa_status IN (
    'unreviewed','passed','warning','failed','synthetic'
  )),
  qa_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  acquisition_start timestamptz,
  acquisition_end timestamptz,
  resolution jsonb NOT NULL DEFAULT '{}'::jsonb,
  version text NOT NULL DEFAULT '1',
  content_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, dataset_type, name, version)
);

CREATE INDEX IF NOT EXISTS idx_geoscience_datasets_project_type
  ON public.geoscience_datasets(project_id, dataset_type);
CREATE INDEX IF NOT EXISTS idx_geoscience_datasets_provenance
  ON public.geoscience_datasets(provenance, qa_status);

ALTER TABLE public.geoscience_datasets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view geoscience datasets" ON public.geoscience_datasets;
CREATE POLICY "Members view geoscience datasets"
  ON public.geoscience_datasets FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members manage geoscience datasets" ON public.geoscience_datasets;
CREATE POLICY "Members manage geoscience datasets"
  ON public.geoscience_datasets FOR ALL TO authenticated
  USING (public.is_project_member(project_id, auth.uid()))
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

COMMENT ON TABLE public.geoscience_datasets IS
  'Global registry of geoscientific datasets. Domain tables retain measurements; this table stores identity, CRS, units, provenance, QA/QC and version metadata.';
