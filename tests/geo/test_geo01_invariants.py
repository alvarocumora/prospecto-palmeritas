"""GEO-01 delta · invariantes de aislamiento por proyecto.

Aplica supabase/migrations/20260928221833_geo01_project_scope_invariants.sql
TAL CUAL (el archivo real, no una copia) contra un esquema sintético que
replica las columnas reales de exploration_targets, satellite_anomalies,
satellite_evidence, geophysics_anomalies, mining_asset_nodes y
mining_asset_edges (verificadas contra src/integrations/supabase/types.ts;
ver docs/geoscience-evidence-foundation.md).

No es un replay de las ~210 migraciones históricas de esas tablas — igual
que test_terreno_franco_cadastre.py, arma un esquema mínimo autocontenido y
aplica ahí la migración bajo prueba. Objetivo: probar que la migración
GEO-01 delta corre sin error y que efectivamente impide (a nivel de FK
compuesto, no solo de RLS) que evidencia/scores/edges de un proyecto
referencien un target/nodo de otro proyecto.

Requiere DATABASE_URL con Postgres; se salta si no (se corre en CI con el
service container de .github/workflows/datum.yml).
"""

import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIG_GEO01_DELTA = ROOT / "supabase/migrations/20260928221833_geo01_project_scope_invariants.sql"

BASE_SCHEMA = """
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);

CREATE TABLE public.exploration_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  target_type text NOT NULL,
  priority text NOT NULL DEFAULT 'media',
  stage text NOT NULL DEFAULT 'proposed',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.satellite_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
);

CREATE TABLE public.satellite_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  run_id uuid NOT NULL,
  index_code text NOT NULL,
  severity text NOT NULL,
  score numeric NOT NULL,
  geometry jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.satellite_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  bbox numeric[] NOT NULL,
  confidence_score numeric NOT NULL,
  source jsonb NOT NULL,
  target_id uuid REFERENCES public.satellite_targets(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disclaimer text NOT NULL DEFAULT '',
  qp_validation_status text NOT NULL DEFAULT 'unverified'
);

CREATE TABLE public.geophysics_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL,
  code text NOT NULL,
  anomaly_type text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  target_id uuid REFERENCES public.exploration_targets(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.data_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  dataset_code TEXT NOT NULL,
  kind TEXT NOT NULL,
  redistribution_allowed BOOLEAN NOT NULL DEFAULT false,
  commercial_use_allowed BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, dataset_code)
);

ALTER TABLE public.satellite_anomalies
  ADD COLUMN source_id UUID REFERENCES public.data_sources(id) ON DELETE SET NULL,
  ADD COLUMN sensor TEXT,
  ADD COLUMN scene_id TEXT,
  ADD COLUMN method TEXT,
  ADD COLUMN method_version TEXT,
  ADD COLUMN strength NUMERIC,
  ADD COLUMN confidence NUMERIC,
  ADD COLUMN feature_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN processing_parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN raster_asset_id TEXT,
  ADD COLUMN target_id UUID REFERENCES public.exploration_targets(id) ON DELETE SET NULL;

ALTER TABLE public.satellite_evidence
  ADD COLUMN exploration_target_id UUID REFERENCES public.exploration_targets(id) ON DELETE SET NULL;

CREATE TABLE public.target_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.exploration_targets(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  score_total NUMERIC NOT NULL,
  confidence NUMERIC NOT NULL,
  completeness NUMERIC NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.mining_asset_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  node_type text NOT NULL CHECK (node_type IN (
    'project','concession','target','geological_body','sample','assay','drillhole',
    'geophysics_dataset','geochemistry_dataset','interpretation','resource_model',
    'economic_model','investment_asset','production_batch','commodity_lot','mineral_passport'
  )),
  canonical_key text NOT NULL,
  label text NOT NULL,
  provenance text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, node_type, canonical_key)
);

CREATE TABLE public.mining_asset_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  from_node_id uuid NOT NULL REFERENCES public.mining_asset_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES public.mining_asset_nodes(id) ON DELETE CASCADE,
  relation text NOT NULL,
  provenance text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_node_id, to_node_id, relation)
);
"""

PROJECT_A = "11111111-1111-1111-1111-111111111111"
PROJECT_B = "22222222-2222-2222-2222-222222222222"
USER_A = "00000000-0000-0000-0000-0000000000a1"
TARGET_A = "aaaaaaaa-0000-0000-0000-000000000001"
TARGET_B = "bbbbbbbb-0000-0000-0000-000000000001"


@pytest.fixture()
def cur():
    url = os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip("sin DATABASE_URL (Postgres) — se corre en CI con el service container")
    psycopg = pytest.importorskip("psycopg")
    conn = psycopg.connect(url, autocommit=True)
    c = conn.cursor()
    c.execute(
        "DROP TABLE IF EXISTS public.mining_asset_edges, public.mining_asset_nodes, "
        "public.target_scores, public.data_sources, public.geophysics_anomalies, "
        "public.satellite_evidence, public.satellite_anomalies, public.satellite_targets, "
        "public.exploration_targets, public.projects CASCADE"
    )
    c.execute(BASE_SCHEMA)
    c.execute(MIG_GEO01_DELTA.read_text())

    c.execute("INSERT INTO public.projects (id, name) VALUES (%s, 'A'), (%s, 'B')", (PROJECT_A, PROJECT_B))
    c.execute(
        "INSERT INTO public.exploration_targets (id, project_id, code, name, target_type, created_by) "
        "VALUES (%s, %s, 'A-T01', 'Target A1', 'geochem', %s), "
        "(%s, %s, 'B-T01', 'Target B1', 'geochem', %s)",
        (TARGET_A, PROJECT_A, USER_A, TARGET_B, PROJECT_B, USER_A),
    )
    yield c
    conn.close()


def test_migration_applies_clean(cur):
    # Si llegamos acá, el fixture ya corrió el archivo de migración real sin error.
    cur.execute("SELECT conname FROM pg_constraint WHERE conname = 'satellite_anomalies_target_project_fk'")
    assert cur.fetchone() is not None


def test_satellite_anomaly_same_project_ok(cur):
    cur.execute(
        "INSERT INTO public.satellite_anomalies "
        "(project_id, run_id, index_code, severity, score, geometry, target_id, created_by) "
        "VALUES (%s, gen_random_uuid(), 'IRON_OXIDE', 'alta', 0.9, '{}'::jsonb, %s, %s)",
        (PROJECT_A, TARGET_A, USER_A),
    )


def test_satellite_anomaly_cross_project_rejected(cur):
    with pytest.raises(Exception, match="satellite_anomalies_target_project_fk"):
        cur.execute(
            "INSERT INTO public.satellite_anomalies "
            "(project_id, run_id, index_code, severity, score, geometry, target_id, created_by) "
            "VALUES (%s, gen_random_uuid(), 'IRON_OXIDE', 'alta', 0.9, '{}'::jsonb, %s, %s)",
            (PROJECT_A, TARGET_B, USER_A),
        )


def test_satellite_evidence_cross_project_rejected(cur):
    with pytest.raises(Exception, match="satellite_evidence_target_project_fk"):
        cur.execute(
            "INSERT INTO public.satellite_evidence "
            "(project_id, kind, title, bbox, confidence_score, source, exploration_target_id, created_by) "
            "VALUES (%s, 'sat', 'ev', ARRAY[0,0,1,1]::numeric[], 0.5, '{}'::jsonb, %s, %s)",
            (PROJECT_A, TARGET_B, USER_A),
        )


def test_target_score_cross_project_rejected(cur):
    with pytest.raises(Exception, match="target_scores_target_project_fk"):
        cur.execute(
            "INSERT INTO public.target_scores "
            "(project_id, target_id, model_name, model_version, score_total, confidence, completeness) "
            "VALUES (%s, %s, 'm1', 'v1', 50, 0.5, 0.5)",
            (PROJECT_A, TARGET_B),
        )


def test_target_score_same_project_ok(cur):
    cur.execute(
        "INSERT INTO public.target_scores "
        "(project_id, target_id, model_name, model_version, score_total, confidence, completeness) "
        "VALUES (%s, %s, 'm1', 'v1', 50, 0.5, 0.5)",
        (PROJECT_A, TARGET_A),
    )


def test_mining_asset_edge_cross_project_rejected(cur):
    node_a = "cccccccc-0000-0000-0000-000000000001"
    node_b = "dddddddd-0000-0000-0000-000000000001"
    cur.execute(
        "INSERT INTO public.mining_asset_nodes (id, project_id, node_type, canonical_key, label, provenance) "
        "VALUES (%s, %s, 'target', 'a-1', 'Node A1', 'DERIVED'), "
        "(%s, %s, 'target', 'b-1', 'Node B1', 'DERIVED')",
        (node_a, PROJECT_A, node_b, PROJECT_B),
    )
    with pytest.raises(Exception, match="mining_asset_edges_to_project_fk"):
        cur.execute(
            "INSERT INTO public.mining_asset_edges (project_id, from_node_id, to_node_id, relation, provenance) "
            "VALUES (%s, %s, %s, 'supports', 'DERIVED')",
            (PROJECT_A, node_a, node_b),
        )


def test_mining_asset_node_accepts_new_evidence_types(cur):
    for node_type in ("remote_sensing_dataset", "anomaly", "evidence"):
        cur.execute(
            "INSERT INTO public.mining_asset_nodes "
            "(project_id, node_type, canonical_key, label, provenance) "
            "VALUES (%s, %s, %s, %s, 'DERIVED')",
            (PROJECT_A, node_type, f"a-{node_type}", node_type),
        )


def test_mining_asset_node_still_rejects_invalid_type(cur):
    with pytest.raises(Exception, match="mining_asset_nodes_node_type_check"):
        cur.execute(
            "INSERT INTO public.mining_asset_nodes "
            "(project_id, node_type, canonical_key, label, provenance) "
            "VALUES (%s, 'not_a_real_type', 'a-bad', 'Bad', 'DERIVED')",
            (PROJECT_A,),
        )
