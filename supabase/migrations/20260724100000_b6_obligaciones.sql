-- B6 · Obligaciones y notificaciones. El eje del producto: qué vence y cuándo.
-- Obligaciones derivadas de una concesión (patentes, plazos, mensuras) con su
-- fecha de vencimiento; alertas escalonadas (90/30/7 días + vencido) con
-- idempotencia (no reenviar la misma alerta). Una obligación cumplida NUNCA se
-- borra: se marca con evidencia.

CREATE TABLE IF NOT EXISTS public.obligaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente_id text,
  concesion_external_id text,        -- ID_CONCESION del catastro (si aplica)
  tipo text NOT NULL,                -- 'patente' | 'plazo_procesal' | 'mensura'
  descripcion text NOT NULL,
  monto_clp numeric,
  periodo text,                      -- ej '2026' (para no duplicar por año)
  vence_at date NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'cumplida', 'vencida')),
  evidencia jsonb,                   -- adjunta al marcar cumplida
  cumplida_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Una obligación por concesión/tipo/periodo (idempotencia del generador).
CREATE UNIQUE INDEX IF NOT EXISTS uq_obligaciones_periodo
  ON public.obligaciones (fuente_id, concesion_external_id, tipo, periodo)
  WHERE concesion_external_id IS NOT NULL AND periodo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_obligaciones_vence ON public.obligaciones (vence_at) WHERE estado = 'pendiente';

CREATE TABLE IF NOT EXISTS public.obligacion_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obligacion_id uuid NOT NULL REFERENCES public.obligaciones(id) ON DELETE CASCADE,
  umbral text NOT NULL,              -- 'd90' | 'd30' | 'd7' | 'vencido'
  dias_restantes integer,
  disparada_at timestamptz NOT NULL DEFAULT now(),
  notificada_at timestamptz,         -- se setea al enviar el correo
  message_id text
);
-- Idempotencia: una sola alerta por obligación y umbral (no reenviar).
CREATE UNIQUE INDEX IF NOT EXISTS uq_obligacion_alertas
  ON public.obligacion_alertas (obligacion_id, umbral);

ALTER TABLE public.obligaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obligacion_alertas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='obligaciones' AND policyname='obligaciones_read') THEN
    CREATE POLICY "obligaciones_read" ON public.obligaciones FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='obligacion_alertas' AND policyname='obligacion_alertas_read') THEN
    CREATE POLICY "obligacion_alertas_read" ON public.obligacion_alertas FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.obligaciones, public.obligacion_alertas TO authenticated;
GRANT ALL ON public.obligaciones, public.obligacion_alertas TO service_role;

COMMENT ON TABLE public.obligaciones IS
  'B6: obligaciones de tenencia (patentes/plazos/mensuras) con vencimiento. Nunca se borra una cumplida; se marca con evidencia. Alertas escalonadas en obligacion_alertas (idempotentes).';
