-- BASELINE (drift) · Versiona el CREATE de tablas base que hoy viven SOLO en la
-- base cloud de Lovable y que migraciones posteriores (y el front) asumen ya
-- creadas: cadastre_national, cadastre_sync_runs, bulletin_sync_runs.
--
-- Reconstruido FIEL a la fuente autoritativa src/integrations/supabase/types.ts
-- (generado por Lovable desde la base viva) + los fragmentos de policy/FK que ya
-- viven en migraciones. Timestamp temprano a propósito: debe correr ANTES de la
-- primera migración que referencia estas tablas (20260514035146...).
--
-- 100% idempotente (CREATE TABLE/INDEX IF NOT EXISTS): en la base de Lovable, donde
-- las tablas YA existen, es un no-op; en CI / entornos nuevos, las crea.
--
-- SUPUESTOS DECLARADOS (no verificados contra la definición real de la cloud):
--  * geom / geom_3857 se declaran como geometry genérico (subtipo y SRID exactos
--    NO confirmados; genérico acepta lo que haya, no rechaza datos).
--  * columnas *_at => timestamptz; constituted_at podría ser date (sin confirmar).
--  * Los DEFAULT de columnas "opcionales en Insert" se infieren; como el baseline
--    se salta en la cloud (tabla existente), solo afectan a bases nuevas.
--  * No se agregan UNIQUE que no consten: un UNIQUE equivocado podría rechazar
--    datos reales de Lovable. Solo índices no únicos.

CREATE EXTENSION IF NOT EXISTS postgis;
SET search_path TO public, extensions;

-- =========================================================================
-- cadastre_national — catastro nacional canónico que consume el front.
-- (Las policies las crean migraciones posteriores; aquí solo tabla + RLS + grant.)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.cadastre_national (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL,
  rol text,
  name text,
  tipo text,
  status text,
  holder_name text,
  holder_rut text,
  area_ha numeric,
  commune text,
  provincia text,
  region text,
  datum text,
  geom geometry,
  geom_3857 geometry,
  geometry_geojson jsonb,
  constituted_at timestamptz,
  last_patent_year integer,
  source text,
  origen text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cadastre_national_external_id ON public.cadastre_national (external_id);
CREATE INDEX IF NOT EXISTS idx_cadastre_national_rol ON public.cadastre_national (rol);
CREATE INDEX IF NOT EXISTS idx_cadastre_national_region ON public.cadastre_national (region);
CREATE INDEX IF NOT EXISTS idx_cadastre_national_geom ON public.cadastre_national USING gist (geom);
ALTER TABLE public.cadastre_national ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.cadastre_national TO authenticated;
GRANT ALL ON public.cadastre_national TO service_role;

-- =========================================================================
-- cadastre_sync_runs — bitácora de corridas del sync de catastro.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.cadastre_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origen text NOT NULL,
  scope text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'running',
  region text,
  features_seen integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  unchanged integer NOT NULL DEFAULT 0,
  archived integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cadastre_sync_runs_started ON public.cadastre_sync_runs (started_at DESC);
ALTER TABLE public.cadastre_sync_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.cadastre_sync_runs TO authenticated;
GRANT ALL ON public.cadastre_sync_runs TO service_role;

-- =========================================================================
-- bulletin_sync_runs — bitácora de corridas del sync del Boletín (ninguna otra
-- migración la toca: aquí sí se crea su policy de lectura).
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.bulletin_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'boletin',
  status text NOT NULL DEFAULT 'running',
  scraped_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  alerts_created integer NOT NULL DEFAULT 0,
  error_message text,
  payload jsonb,
  triggered_by text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bulletin_sync_runs_started ON public.bulletin_sync_runs (started_at DESC);
ALTER TABLE public.bulletin_sync_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.bulletin_sync_runs TO authenticated;
GRANT ALL ON public.bulletin_sync_runs TO service_role;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bulletin_sync_runs' AND policyname='bulletin_sync_runs_authenticated_read') THEN
    CREATE POLICY "bulletin_sync_runs_authenticated_read" ON public.bulletin_sync_runs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
