-- Global Mining Asset Graph + Mineral Passport Core v1
-- Additive foundation: connects exploration, investment and commodity traceability
-- without replacing existing project, cadastre, assay, trade or 3D domain tables.

CREATE TABLE IF NOT EXISTS public.mining_asset_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  node_type text NOT NULL CHECK (node_type IN (
    'project','concession','target','geological_body','sample','assay','drillhole',
    'geophysics_dataset','geochemistry_dataset','interpretation','resource_model',
    'economic_model','investment_asset','production_batch','commodity_lot','mineral_passport'
  )),
  canonical_key text NOT NULL,
  entity_id uuid,
  label text NOT NULL,
  commodity text,
  provenance text NOT NULL CHECK (provenance IN (
    'OFFICIAL','CERTIFIED','DOCUMENTARY','DECLARED','DERIVED','INTERPRETED'
  )),
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  status text NOT NULL DEFAULT 'active',
  source_ref text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, node_type, canonical_key)
);

CREATE INDEX IF NOT EXISTS idx_mining_asset_nodes_project ON public.mining_asset_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_mining_asset_nodes_entity ON public.mining_asset_nodes(node_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_mining_asset_nodes_commodity ON public.mining_asset_nodes(commodity);

CREATE TABLE IF NOT EXISTS public.mining_asset_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  from_node_id uuid NOT NULL REFERENCES public.mining_asset_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES public.mining_asset_nodes(id) ON DELETE CASCADE,
  relation text NOT NULL,
  provenance text NOT NULL CHECK (provenance IN (
    'OFFICIAL','CERTIFIED','DOCUMENTARY','DECLARED','DERIVED','INTERPRETED'
  )),
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_node_id, to_node_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_mining_asset_edges_project ON public.mining_asset_edges(project_id);
CREATE INDEX IF NOT EXISTS idx_mining_asset_edges_from ON public.mining_asset_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_mining_asset_edges_to ON public.mining_asset_edges(to_node_id);

CREATE TABLE IF NOT EXISTS public.mineral_passports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  passport_code text NOT NULL UNIQUE,
  commodity text NOT NULL,
  material_form text,
  status text NOT NULL DEFAULT 'created',
  origin_country text,
  origin_node_id uuid REFERENCES public.mining_asset_nodes(id) ON DELETE SET NULL,
  current_lot_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mineral_passports_project ON public.mineral_passports(project_id);
CREATE INDEX IF NOT EXISTS idx_mineral_passports_commodity ON public.mineral_passports(commodity);

CREATE TABLE IF NOT EXISTS public.mineral_traceability_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_id uuid NOT NULL REFERENCES public.mineral_passports(id) ON DELETE RESTRICT,
  sequence_no bigint NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  actor_name text,
  facility_name text,
  country_code text,
  quantity numeric,
  unit text,
  input_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  output_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload_hash text NOT NULL,
  previous_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(passport_id, sequence_no),
  UNIQUE(passport_id, payload_hash)
);

CREATE INDEX IF NOT EXISTS idx_traceability_events_passport
  ON public.mineral_traceability_events(passport_id, sequence_no);

ALTER TABLE public.mining_asset_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_asset_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mineral_passports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mineral_traceability_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view asset nodes" ON public.mining_asset_nodes;
CREATE POLICY "Members view asset nodes" ON public.mining_asset_nodes FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));
DROP POLICY IF EXISTS "Members manage asset nodes" ON public.mining_asset_nodes;
CREATE POLICY "Members manage asset nodes" ON public.mining_asset_nodes FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()))
WITH CHECK (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members view asset edges" ON public.mining_asset_edges;
CREATE POLICY "Members view asset edges" ON public.mining_asset_edges FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));
DROP POLICY IF EXISTS "Members manage asset edges" ON public.mining_asset_edges;
CREATE POLICY "Members manage asset edges" ON public.mining_asset_edges FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()))
WITH CHECK (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members view mineral passports" ON public.mineral_passports;
CREATE POLICY "Members view mineral passports" ON public.mineral_passports FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));
DROP POLICY IF EXISTS "Members create mineral passports" ON public.mineral_passports;
CREATE POLICY "Members create mineral passports" ON public.mineral_passports FOR INSERT TO authenticated
WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());
DROP POLICY IF EXISTS "Members update mineral passports" ON public.mineral_passports;
CREATE POLICY "Members update mineral passports" ON public.mineral_passports FOR UPDATE TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members view traceability events" ON public.mineral_traceability_events;
CREATE POLICY "Members view traceability events" ON public.mineral_traceability_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.mineral_passports p
  WHERE p.id = passport_id AND public.is_project_member(p.project_id, auth.uid())
));
DROP POLICY IF EXISTS "Members append traceability events" ON public.mineral_traceability_events;
CREATE POLICY "Members append traceability events" ON public.mineral_traceability_events FOR INSERT TO authenticated
WITH CHECK (
  recorded_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.mineral_passports p
    WHERE p.id = passport_id AND public.is_project_member(p.project_id, auth.uid())
  )
);

COMMENT ON TABLE public.mining_asset_nodes IS 'Canonical graph nodes spanning mineral rights, exploration evidence, models, investment and produced material.';
COMMENT ON TABLE public.mining_asset_edges IS 'Typed provenance-aware relationships between Mining Asset Graph nodes.';
COMMENT ON TABLE public.mineral_passports IS 'Commodity-neutral digital identity for produced mineral/material lots.';
COMMENT ON TABLE public.mineral_traceability_events IS 'Append-only chain-of-custody and transformation event ledger; updates/deletes are intentionally not granted by RLS.';
