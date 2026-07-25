-- B3 · Vigilancia del Boletín Oficial de Minería. La pieza más frágil: por eso
-- NADA se auto-aprueba sin umbral de confianza, y un registro sin coordenadas
-- verificables NUNCA recibe una coordenada verosímil por defecto — queda en la
-- cola de revisión humana. PostGIS sin calificar (search_path: public en CI,
-- extensions en Supabase). Idempotente.

-- 1) Edición del boletín (una publicación). origen_hash da idempotencia por
--    contenido: reingerir la misma edición no duplica.
CREATE TABLE IF NOT EXISTS public.boletin_ediciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente_id text REFERENCES public.fuentes_datos(id),
  numero text,
  fecha date,
  url text,
  tipo text,                         -- 'pedimentos' | 'manifestaciones' | 'sentencias' | 'mixto'
  origen_hash text NOT NULL,
  registros_leidos integer,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_boletin_ediciones_hash
  ON public.boletin_ediciones (origen_hash);

-- 2) Registro extraído del boletín, con CONFIANZA y estado de revisión.
--    geom es NULL si el registro no es geolocalizable (sin coords válidas o sin
--    huso): no se inventa una ubicación. Los crudos PSAD56 quedan guardados para
--    auditar la transformación (EPSG:1204, ver docs/datums.md).
CREATE TABLE IF NOT EXISTS public.boletin_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edicion_id uuid NOT NULL REFERENCES public.boletin_ediciones(id) ON DELETE CASCADE,
  tipo_acto text,                    -- 'pedimento' | 'manifestacion' | 'mensura' | 'sentencia' | NULL si no se reconoció
  rol text,
  nombre text,
  titular text,                      -- solicitante tal como lo publica el boletín (dato de registro público)
  comuna text,
  este_psad56 numeric,
  norte_psad56 numeric,
  huso integer,
  datum text NOT NULL DEFAULT 'PSAD56',
  geom geometry(Point, 4326),        -- NULL si no geolocalizable — nunca un valor por defecto
  confianza numeric NOT NULL CHECK (confianza >= 0 AND confianza <= 1),
  estado_revision text NOT NULL DEFAULT 'pendiente_revision'
    CHECK (estado_revision IN ('auto_ok', 'pendiente_revision', 'aprobado', 'rechazado')),
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,   -- motivos de baja confianza / inconsistencias
  revisado_por text,
  revisado_at timestamptz,
  revision_nota text,
  origen_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Idempotencia: un registro por edición y contenido normalizado.
CREATE UNIQUE INDEX IF NOT EXISTS uq_boletin_registros_hash
  ON public.boletin_registros (edicion_id, origen_hash);
CREATE INDEX IF NOT EXISTS idx_boletin_registros_geom
  ON public.boletin_registros USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_boletin_registros_cola
  ON public.boletin_registros (estado_revision) WHERE estado_revision = 'pendiente_revision';

-- 3) Alerta por cruce espacial contra el catastro (+buffer). 'dentro_de_concesion'
--    (el punto cae en un polígono vigente) o 'proximidad' (dentro del buffer).
CREATE TABLE IF NOT EXISTS public.boletin_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id uuid NOT NULL REFERENCES public.boletin_registros(id) ON DELETE CASCADE,
  concesion_external_id text NOT NULL,
  tipo_alerta text NOT NULL CHECK (tipo_alerta IN ('dentro_de_concesion', 'proximidad')),
  distancia_m numeric,
  buffer_m numeric,
  estado text NOT NULL DEFAULT 'nueva' CHECK (estado IN ('nueva', 'revisada', 'descartada')),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Idempotencia: una alerta por registro y concesión.
CREATE UNIQUE INDEX IF NOT EXISTS uq_boletin_alertas
  ON public.boletin_alertas (registro_id, concesion_external_id);

-- 4) Cola de revisión humana: vista de los registros que NO se auto-aprobaron.
CREATE OR REPLACE VIEW public.boletin_cola_revision AS
  SELECT r.id, r.edicion_id, r.tipo_acto, r.rol, r.nombre, r.comuna,
         r.confianza, r.flags, r.geom IS NOT NULL AS geolocalizable, r.created_at
  FROM public.boletin_registros r
  WHERE r.estado_revision = 'pendiente_revision'
  ORDER BY r.confianza ASC, r.created_at ASC;

ALTER TABLE public.boletin_ediciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boletin_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boletin_alertas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='boletin_ediciones' AND policyname='boletin_ediciones_read') THEN
    CREATE POLICY "boletin_ediciones_read" ON public.boletin_ediciones FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='boletin_registros' AND policyname='boletin_registros_read') THEN
    CREATE POLICY "boletin_registros_read" ON public.boletin_registros FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='boletin_alertas' AND policyname='boletin_alertas_read') THEN
    CREATE POLICY "boletin_alertas_read" ON public.boletin_alertas FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.boletin_ediciones, public.boletin_registros, public.boletin_alertas, public.boletin_cola_revision TO authenticated;
GRANT ALL ON public.boletin_ediciones, public.boletin_registros, public.boletin_alertas TO service_role;

COMMENT ON TABLE public.boletin_registros IS
  'B3: registros extraídos del Boletín Oficial de Minería con confianza y cola de revisión. geom NULL = no geolocalizable (nunca coordenada por defecto). Cruce espacial contra catastro en boletin_alertas.';
