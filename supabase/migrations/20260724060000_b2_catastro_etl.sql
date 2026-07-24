-- B2 · Capa de datos del ETL de catastro (prompt v2). Tablas PROPIAS del ETL,
-- con versionado temporal auditable — no tocan public_concessions_cache (cache
-- de Lovable). PostGIS vive en el schema `extensions` (patrón Supabase).
-- Idempotente.

-- 1) Registro de fuentes externas (§B2: url, formato, SRID, licencia, frecuencia).
CREATE TABLE IF NOT EXISTS public.fuentes_datos (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  url text,
  formato text,
  srid_nativo integer,
  licencia text,
  frecuencia text,
  ultima_corrida timestamptz,
  ultimo_hash text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Log de cada corrida del ETL (§B2: log de corrida, idempotencia por hash).
CREATE TABLE IF NOT EXISTS public.etl_corridas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente_id text NOT NULL REFERENCES public.fuentes_datos(id),
  iniciada_at timestamptz NOT NULL DEFAULT now(),
  finalizada_at timestamptz,
  estado text NOT NULL DEFAULT 'corriendo'
    CHECK (estado IN ('corriendo', 'ok', 'sin_cambios', 'error')),
  origen_hash text,
  registros_leidos integer,
  registros_nuevos integer,
  registros_cerrados integer,
  mensaje text
);
CREATE INDEX IF NOT EXISTS idx_etl_corridas_fuente ON public.etl_corridas(fuente_id, iniciada_at DESC);

-- 3) Concesiones con VERSIONADO TEMPORAL (§B2.4: valid_from/valid_to, sin UPDATE
--    destructivo — el estado histórico es lo que hace auditables los informes).
CREATE TABLE IF NOT EXISTS public.catastro_concesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente_id text NOT NULL REFERENCES public.fuentes_datos(id),
  external_id text NOT NULL,
  rol text,
  nombre text,
  tipo text,
  estado text,
  titular text,
  hectareas numeric,
  region text,
  comuna text,
  datum_origen text,
  -- PostGIS sin calificar (resuelve por search_path: public en CI, extensions en
  -- Supabase), igual patrón que public_concessions_cache.
  geom geometry(MultiPolygon, 4326) NOT NULL,
  atributos jsonb NOT NULL DEFAULT '{}'::jsonb,
  origen_hash text NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  ingesta_corrida_id uuid REFERENCES public.etl_corridas(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Un solo registro "actual" (valid_to IS NULL) por concesión y fuente.
CREATE UNIQUE INDEX IF NOT EXISTS uq_catastro_concesiones_actual
  ON public.catastro_concesiones (fuente_id, external_id)
  WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_catastro_concesiones_geom
  ON public.catastro_concesiones USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_catastro_concesiones_ext
  ON public.catastro_concesiones (external_id);

-- RLS: lectura para autenticados (el front puede consultar el catastro
-- versionado); escritura solo service_role (la hace el ETL).
ALTER TABLE public.fuentes_datos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etl_corridas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catastro_concesiones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fuentes_datos' AND policyname='fuentes_datos_read') THEN
    CREATE POLICY "fuentes_datos_read" ON public.fuentes_datos FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='etl_corridas' AND policyname='etl_corridas_read') THEN
    CREATE POLICY "etl_corridas_read" ON public.etl_corridas FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='catastro_concesiones' AND policyname='catastro_concesiones_read') THEN
    CREATE POLICY "catastro_concesiones_read" ON public.catastro_concesiones FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

GRANT SELECT ON public.fuentes_datos, public.etl_corridas, public.catastro_concesiones TO authenticated;
GRANT ALL ON public.fuentes_datos, public.etl_corridas, public.catastro_concesiones TO service_role;

COMMENT ON TABLE public.catastro_concesiones IS
  'Concesiones del catastro con versionado temporal (valid_from/valid_to). Fuente auditable del ETL (B2). Distinta de public_concessions_cache (snapshot del front).';
