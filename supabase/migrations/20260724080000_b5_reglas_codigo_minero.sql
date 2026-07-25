-- B5 · Motor de reglas del Código de Minería: parámetros en TABLA, nunca en el
-- código (§v2). Cada regla cita el artículo y trae verificado_por /
-- fecha_verificacion. Si fecha_verificacion IS NULL, el motor marca el resultado
-- como "parámetro NO verificado" en vez de darlo por válido.
--
-- Valores tomados del texto oficial (Reglamento del Código de Minería, Título II,
-- Art. 8, que detalla el Art. 28 del Código). Cargados por IA a partir de la
-- fuente oficial: NO son verificación legal — un abogado debe confirmarlos y
-- setear fecha_verificacion. Además las Leyes 21.420 y 21.649 reformaron plazos
-- y patentes: esas filas quedan con valor NULL hasta verificar.

CREATE TABLE IF NOT EXISTS public.reglas_codigo_minero (
  id text PRIMARY KEY,
  tipo_solicitud text NOT NULL CHECK (tipo_solicitud IN ('exploracion', 'explotacion')),
  regla text NOT NULL,
  operador text,                 -- '<=' | '>=' | '==' | 'orientacion_utm'
  valor numeric,                 -- NULL = valor por verificar
  unidad text,                   -- 'ha' | 'm' | 'ratio' | 'anos'
  articulo_citado text NOT NULL,
  fuente_url text,
  verificado_por text,           -- NULL o 'IA — pendiente validación de abogado'
  fecha_verificacion date,       -- NULL = NO verificado legalmente
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reglas_codigo_minero ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reglas_codigo_minero' AND policyname='reglas_codigo_minero_read') THEN
    CREATE POLICY "reglas_codigo_minero_read" ON public.reglas_codigo_minero FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.reglas_codigo_minero TO authenticated;
GRANT ALL ON public.reglas_codigo_minero TO service_role;

-- Semilla (fuente oficial; NO verificada por abogado → fecha_verificacion NULL).
INSERT INTO public.reglas_codigo_minero
  (id, tipo_solicitud, regla, operador, valor, unidad, articulo_citado, fuente_url, verificado_por, fecha_verificacion, notas)
VALUES
  -- Exploración
  ('exploracion.orientacion','exploracion','orientacion_caras','orientacion_utm',NULL,NULL,
   'Art. 28 Código de Minería; Art. 8 Reglamento','https://faolex.fao.org/docs/pdf/chi51004.pdf','IA — pendiente validación de abogado',NULL,'Caras orientadas N-S y E-O en proyección U.T.M.'),
  ('exploracion.lado_max_m','exploracion','lado_mas_largo','<=',15000,'m',
   'Art. 28 Código; Art. 8 Reglamento','https://faolex.fao.org/docs/pdf/chi51004.pdf','IA — pendiente validación de abogado',NULL,'El lado más largo no podrá exceder de 15.000 m.'),
  ('exploracion.ratio_max','exploracion','relacion_largo_ancho','<=',15,'ratio',
   'Art. 28 Código; Art. 8 Reglamento','https://faolex.fao.org/docs/pdf/chi51004.pdf','IA — pendiente validación de abogado',NULL,'Proporción largo/ancho no superior a 15:1.'),
  ('exploracion.cara_min_ha','exploracion','cara_superior','>=',100,'ha',
   'Art. 28 Código; Art. 8 Reglamento','https://faolex.fao.org/docs/pdf/chi51004.pdf','IA — pendiente validación de abogado',NULL,'Cara superior no menos de 100 ha.'),
  ('exploracion.cara_max_ha','exploracion','cara_superior','<=',5000,'ha',
   'Art. 28 Código; Art. 8 Reglamento','https://faolex.fao.org/docs/pdf/chi51004.pdf','IA — pendiente validación de abogado',NULL,'Cara superior no más de 5.000 ha.'),
  ('exploracion.lado_multiplo_m','exploracion','lado_multiplo','==',1000,'m',
   'Art. 8 Reglamento','https://faolex.fao.org/docs/pdf/chi51004.pdf','IA — pendiente validación de abogado',NULL,'Lados múltiplos de 1.000 m.'),
  ('exploracion.duracion_anos','exploracion','duracion','==',NULL,'anos',
   'Código de Minería (reformado por Leyes 21.420 y 21.649)',NULL,NULL,NULL,'Duración y prórroga reformadas; valor por verificar con abogado.'),
  -- Explotación (pertenencia)
  ('explotacion.orientacion','explotacion','orientacion_caras','orientacion_utm',NULL,NULL,
   'Art. 28 Código; Art. 8 Reglamento','https://faolex.fao.org/docs/pdf/chi51004.pdf','IA — pendiente validación de abogado',NULL,'Caras orientadas N-S y E-O en proyección U.T.M.'),
  ('explotacion.lado_max_m','explotacion','lado_mas_largo','<=',1000,'m',
   'Art. 28 Código; Art. 8 Reglamento','https://faolex.fao.org/docs/pdf/chi51004.pdf','IA — pendiente validación de abogado',NULL,'El lado más largo no podrá exceder de 1.000 m.'),
  ('explotacion.ratio_max','explotacion','relacion_largo_ancho','<=',10,'ratio',
   'Art. 28 Código; Art. 8 Reglamento','https://faolex.fao.org/docs/pdf/chi51004.pdf','IA — pendiente validación de abogado',NULL,'Proporción largo/ancho no superior a 10:1.'),
  ('explotacion.cara_min_ha','explotacion','cara_superior','>=',1,'ha',
   'Art. 28 Código; Art. 8 Reglamento','https://faolex.fao.org/docs/pdf/chi51004.pdf','IA — pendiente validación de abogado',NULL,'Cara superior no menos de 1 ha.'),
  ('explotacion.cara_max_ha','explotacion','cara_superior','<=',10,'ha',
   'Art. 28 Código; Art. 8 Reglamento','https://faolex.fao.org/docs/pdf/chi51004.pdf','IA — pendiente validación de abogado',NULL,'Cara superior no más de 10 ha.'),
  ('explotacion.lado_multiplo_m','explotacion','lado_multiplo','==',100,'m',
   'Art. 8 Reglamento','https://faolex.fao.org/docs/pdf/chi51004.pdf','IA — pendiente validación de abogado',NULL,'Lados múltiplos de 100 m.')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.reglas_codigo_minero IS
  'B5: parámetros del Código de Minería (Art. 28 / Reglamento Art. 8). Cargados de la fuente oficial por IA; fecha_verificacion NULL = pendiente de validación de abogado. El motor marca "no verificado" toda regla sin fecha_verificacion.';
