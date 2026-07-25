-- B5.2 · Motor de patentes y carry. Escalas en TABLA (nunca en código); valor de
-- la UTM en registro FECHADO (nunca constante en código). Valores cargados por IA
-- desde fuente oficial/citable — NO verificación legal: fecha_verificacion=NULL.

-- Valor de la UTM por mes (poblado desde SII). El motor usa el más reciente; si
-- tiene más de 35 días, marca el resultado como desactualizado (§B5.2).
CREATE TABLE IF NOT EXISTS public.valores_utm (
  fecha date PRIMARY KEY,      -- primer día del mes de vigencia
  valor_clp numeric NOT NULL,
  fuente text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Escala de patente por tipo/tramo de años (Ley 21.420). con_labores = patente
-- rebajada por labores acreditadas.
CREATE TABLE IF NOT EXISTS public.patentes_escala (
  id text PRIMARY KEY,
  tipo_solicitud text NOT NULL CHECK (tipo_solicitud IN ('exploracion', 'explotacion')),
  con_labores boolean NOT NULL DEFAULT false,
  ano_desde integer NOT NULL DEFAULT 1,
  ano_hasta integer,               -- NULL = en adelante
  valor_utm_por_ha numeric NOT NULL,
  articulo_citado text NOT NULL,
  fuente_url text,
  verificado_por text,
  fecha_verificacion date,         -- NULL = NO verificado legalmente
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.valores_utm ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patentes_escala ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='valores_utm' AND policyname='valores_utm_read') THEN
    CREATE POLICY "valores_utm_read" ON public.valores_utm FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patentes_escala' AND policyname='patentes_escala_read') THEN
    CREATE POLICY "patentes_escala_read" ON public.patentes_escala FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.valores_utm, public.patentes_escala TO authenticated;
GRANT ALL ON public.valores_utm, public.patentes_escala TO service_role;

-- Valor UTM (dato factual publicado por el SII, fechado).
INSERT INTO public.valores_utm (fecha, valor_clp, fuente) VALUES
  ('2026-07-01', 71649, 'SII (sii.cl/valores_y_fechas/utm/utm2026.htm)')
ON CONFLICT (fecha) DO NOTHING;

-- Escalas Ley 21.420 (fuente citada; NO verificadas por abogado → fecha_verificacion NULL).
INSERT INTO public.patentes_escala
  (id, tipo_solicitud, con_labores, ano_desde, ano_hasta, valor_utm_por_ha, articulo_citado, fuente_url, verificado_por, fecha_verificacion, notas)
VALUES
  ('exploracion.base','exploracion',false,1,NULL,0.06,
   'Ley 21.420 (patente de exploración, 3/50 UTM/ha)','https://www.bcn.cl/leychile/navegar?idNorma=1171875','IA — pendiente validación de abogado',NULL,
   'DISCREPANCIA a resolver: una fuente indica 3/50 (0,06) UTM/ha; otra 1/50 (0,02) para casos calificados.'),
  -- Explotación sin labores: escala progresiva por tramos de 5 años.
  ('explotacion.sinlab.1_5','explotacion',false,1,5,0.4,'Ley 21.420 (escala progresiva)','https://www.bcn.cl/leychile/navegar?idNorma=1171875','IA — pendiente validación de abogado',NULL,NULL),
  ('explotacion.sinlab.6_10','explotacion',false,6,10,0.8,'Ley 21.420','https://www.bcn.cl/leychile/navegar?idNorma=1171875','IA — pendiente validación de abogado',NULL,NULL),
  ('explotacion.sinlab.11_15','explotacion',false,11,15,0.9,'Ley 21.420','https://www.bcn.cl/leychile/navegar?idNorma=1171875','IA — pendiente validación de abogado',NULL,NULL),
  ('explotacion.sinlab.16_20','explotacion',false,16,20,1.2,'Ley 21.420','https://www.bcn.cl/leychile/navegar?idNorma=1171875','IA — pendiente validación de abogado',NULL,NULL),
  ('explotacion.sinlab.21_25','explotacion',false,21,25,3,'Ley 21.420','https://www.bcn.cl/leychile/navegar?idNorma=1171875','IA — pendiente validación de abogado',NULL,NULL),
  ('explotacion.sinlab.26_30','explotacion',false,26,30,6,'Ley 21.420','https://www.bcn.cl/leychile/navegar?idNorma=1171875','IA — pendiente validación de abogado',NULL,NULL),
  ('explotacion.sinlab.31','explotacion',false,31,NULL,12,'Ley 21.420','https://www.bcn.cl/leychile/navegar?idNorma=1171875','IA — pendiente validación de abogado',NULL,'Desde el año 31 de vigencia.'),
  -- Explotación con labores acreditadas: patente rebajada.
  ('explotacion.conlab','explotacion',true,1,NULL,0.1,'Ley 21.420 (patente rebajada, 1/10 UTM/ha)','https://www.bcn.cl/leychile/navegar?idNorma=1171875','IA — pendiente validación de abogado',NULL,
   'Aplica con labores, ingreso al SEIA o permisos del Reglamento de Seguridad Minera.')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.patentes_escala IS
  'B5.2: escalas de patente (Ley 21.420). Cargadas de fuente citable por IA; fecha_verificacion NULL = pendiente de abogado. Existe proyecto 2026 (Boletín 18259-08) que aún no es ley.';
