-- =========================================================
-- patent_remates: nómina anual de concesiones con patente
-- minera impaga que van a remate (proceso de amparo, TGR /
-- SERNAGEOMIN). Datos de referencia nacional (como
-- mining_bulletins): lectura para autenticados, escritura por
-- service_role (cron de ingesta) o super admin.
--
-- Cruza deuda REAL contra las concesiones por concession_code
-- ("rol-dv"), reemplazando la señal inferida desde
-- SITUACION_CONCESION por un estado de morosidad confirmado.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.patent_remates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,                       -- año del proceso de amparo / nómina
  rol text,                                     -- NUMERO_ROL
  dv_rol text,                                  -- dígito verificador del rol
  concession_code text,                         -- "rol-dv" normalizado (llave de cruce)
  concession_name text,
  holder_name text,
  holder_rut text,
  region text,
  comuna text,
  concession_type text,                         -- exploracion | explotacion
  years_owed integer,                           -- años de patente adeudados
  amount_clp numeric,                           -- monto adeudado
  court text,                                    -- juzgado competente
  court_role text,                              -- rol de la causa de remate
  status text NOT NULL DEFAULT 'nomina',        -- nomina | rematada | pagada | retirada
  source text NOT NULL DEFAULT 'sernageomin-amparo',
  source_url text,
  raw_payload jsonb,
  content_hash text NOT NULL UNIQUE,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patent_remates_code ON public.patent_remates(concession_code) WHERE concession_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patent_remates_year ON public.patent_remates(year DESC);
CREATE INDEX IF NOT EXISTS idx_patent_remates_rut ON public.patent_remates(holder_rut) WHERE holder_rut IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patent_remates_name ON public.patent_remates(concession_name);

ALTER TABLE public.patent_remates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view remates"
  ON public.patent_remates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins insert remates"
  ON public.patent_remates FOR INSERT TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins update remates"
  ON public.patent_remates FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins delete remates"
  ON public.patent_remates FOR DELETE TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE TRIGGER update_patent_remates_updated_at
  BEFORE UPDATE ON public.patent_remates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
