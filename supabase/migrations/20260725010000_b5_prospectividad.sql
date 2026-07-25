-- B5.3 · Prospectividad de arcillas iónicas REE (scoring transparente).
--
-- Modelo de PRIORIZACIÓN EXPLORATORIA, NO estimación de recursos (Ley 20.235: una
-- estimación de recursos/reservas requiere Persona Competente; este score no lo es).
-- Pesos y factores EDITABLES, todos marcados NO verificados (fecha_verificacion
-- NULL) hasta que un geólogo competente los valide. Ningún parámetro va hardcodeado
-- en el motor: vive en esta tabla.
--
-- Convive con el sistema de prospectividad de Lovable (prospectivity_runs/cells):
-- el motor (packages/reglas/prospectividad.py) emite celdas con la MISMA forma que
-- prospectivity_cells (score 0-100 + features jsonb), para alimentar ese renderer
-- en lugar de duplicarlo. Aquí solo se guardan las REGLAS del modelo geológico REE.

CREATE TABLE IF NOT EXISTS public.reglas_prospectividad (
  grupo text NOT NULL,               -- 'peso' | 'litologia' | 'param'
  clave text NOT NULL,
  valor numeric,                     -- NULL = sin dato / a definir (nunca un default verosímil)
  unidad text,
  descripcion text,
  fuente text,
  articulo_citado text,
  verificado_por text,
  fecha_verificacion date,           -- NULL => el motor marca el resultado "no verificado"
  PRIMARY KEY (grupo, clave)
);

COMMENT ON TABLE public.reglas_prospectividad IS
  'B5.3: pesos y factores del modelo de prospectividad REE (arcillas iónicas). Priorización exploratoria, NO estimación de recursos (Ley 20.235). Editables; fecha_verificacion NULL => no verificado por geólogo competente.';

-- Pesos de los factores (suman ~1,0; el motor normaliza). Heurística exploratoria.
INSERT INTO public.reglas_prospectividad (grupo, clave, valor, unidad, descripcion, fuente, verificado_por) VALUES
  ('peso', 'litologia', 0.50, 'fracción', 'Aporte de la litología favorable al score', 'heurística exploratoria', 'IA — pendiente validación de geólogo competente'),
  ('peso', 'contacto',  0.30, 'fracción', 'Aporte de la proximidad a contactos intrusivo/basamento', 'heurística exploratoria', 'IA — pendiente validación de geólogo competente'),
  ('peso', 'pendiente', 0.20, 'fracción', 'Aporte de la pendiente (preservación de regolito)', 'heurística exploratoria', 'IA — pendiente validación de geólogo competente')
ON CONFLICT (grupo, clave) DO NOTHING;

-- Favorabilidad por clase litológica (0-1). Granitoides tipo I / tonalitas de
-- biotita ± anfíbola son las más favorables para arcillas iónicas REE. Heurística.
INSERT INTO public.reglas_prospectividad (grupo, clave, valor, unidad, descripcion, fuente, verificado_por) VALUES
  ('litologia', 'granitoide_tipo_i',          1.00, '0-1', 'Granitoide tipo I', 'heurística exploratoria', 'IA — pendiente validación de geólogo competente'),
  ('litologia', 'tonalita_biotita',           0.90, '0-1', 'Tonalita de biotita', 'heurística exploratoria', 'IA — pendiente validación de geólogo competente'),
  ('litologia', 'tonalita_biotita_anfibola',  0.85, '0-1', 'Tonalita de biotita ± anfíbola', 'heurística exploratoria', 'IA — pendiente validación de geólogo competente'),
  ('litologia', 'granodiorita',               0.60, '0-1', 'Granodiorita', 'heurística exploratoria', 'IA — pendiente validación de geólogo competente'),
  ('litologia', 'granito_tipo_s',             0.30, '0-1', 'Granito tipo S', 'heurística exploratoria', 'IA — pendiente validación de geólogo competente'),
  ('litologia', 'volcanica',                  0.10, '0-1', 'Roca volcánica', 'heurística exploratoria', 'IA — pendiente validación de geólogo competente'),
  ('litologia', 'sedimentaria',               0.05, '0-1', 'Roca sedimentaria', 'heurística exploratoria', 'IA — pendiente validación de geólogo competente')
ON CONFLICT (grupo, clave) DO NOTHING;

-- Parámetros de las funciones de decaimiento (contacto y pendiente). Heurística.
INSERT INTO public.reglas_prospectividad (grupo, clave, valor, unidad, descripcion, fuente, verificado_por) VALUES
  ('param', 'distancia_contacto_optima_m', 500,  'm',      'Distancia a contacto con favorabilidad plena', 'heurística exploratoria', 'IA — pendiente validación de geólogo competente'),
  ('param', 'distancia_contacto_max_m',    3000, 'm',      'Distancia a contacto más allá de la cual el aporte es 0', 'heurística exploratoria', 'IA — pendiente validación de geólogo competente'),
  ('param', 'pendiente_optima_max_grados', 8,    'grados', 'Pendiente máxima con favorabilidad plena (preserva regolito)', 'heurística exploratoria', 'IA — pendiente validación de geólogo competente'),
  ('param', 'pendiente_max_grados',        25,   'grados', 'Pendiente más allá de la cual el aporte es 0 (regolito erosionado)', 'heurística exploratoria', 'IA — pendiente validación de geólogo competente')
ON CONFLICT (grupo, clave) DO NOTHING;

ALTER TABLE public.reglas_prospectividad ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reglas_prospectividad' AND policyname='reglas_prospectividad_read') THEN
    CREATE POLICY "reglas_prospectividad_read" ON public.reglas_prospectividad FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.reglas_prospectividad TO authenticated;
GRANT ALL ON public.reglas_prospectividad TO service_role;
