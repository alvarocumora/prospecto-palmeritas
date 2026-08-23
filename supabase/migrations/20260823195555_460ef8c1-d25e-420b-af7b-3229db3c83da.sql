CREATE TABLE public.water_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id text NOT NULL UNIQUE,
  name text NOT NULL,
  river text NOT NULL,
  commune text NOT NULL,
  province text NOT NULL,
  region text NOT NULL,
  country text NOT NULL DEFAULT 'Chile',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  utm_datum text,
  utm_zone text,
  utm_north numeric,
  utm_east numeric,
  right_type text NOT NULL DEFAULT 'surface',
  nature text NOT NULL DEFAULT 'consuntivo',
  exercise text NOT NULL DEFAULT 'permanente_continuo',
  flow_permanent_ls numeric NOT NULL DEFAULT 0,
  flow_eventual_ls numeric,
  flow_notes text,
  capture_system text,
  dga_resolution text,
  dga_resolution_date date,
  unit_value_clp numeric NOT NULL DEFAULT 750000,
  reference_value_clp numeric,
  quality_status text NOT NULL DEFAULT 'not_tested',
  verification_status text NOT NULL DEFAULT 'declared',
  status text NOT NULL DEFAULT 'published',
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.water_legal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_uuid uuid NOT NULL REFERENCES public.water_assets(id) ON DELETE CASCADE,
  attribute text NOT NULL,
  value text,
  verification text NOT NULL DEFAULT 'pending',
  note text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.water_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_uuid uuid NOT NULL REFERENCES public.water_assets(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  title text NOT NULL,
  institution text,
  doc_date date,
  status text NOT NULL DEFAULT 'pending',
  storage_path text,
  external_url text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.water_quality_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_uuid uuid NOT NULL REFERENCES public.water_assets(id) ON DELETE CASCADE,
  sampling_date date,
  laboratory text,
  certification text,
  status text NOT NULL DEFAULT 'not_tested',
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.water_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_uuid uuid NOT NULL REFERENCES public.water_assets(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'unit_flow',
  flow_ls numeric NOT NULL,
  unit_value_clp numeric NOT NULL,
  reference_value_clp numeric NOT NULL,
  currency text NOT NULL DEFAULT 'CLP',
  valuation_date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.water_hydrology (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_uuid uuid NOT NULL REFERENCES public.water_assets(id) ON DELETE CASCADE,
  basin text,
  sub_basin text,
  dga_station text,
  ecological_flow_ls numeric,
  mean_monthly_flow jsonb,
  drought_risk text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.water_portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#0ea5e9',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.water_portfolio_assets (
  portfolio_id uuid NOT NULL REFERENCES public.water_portfolios(id) ON DELETE CASCADE,
  asset_uuid uuid NOT NULL REFERENCES public.water_assets(id) ON DELETE CASCADE,
  PRIMARY KEY (portfolio_id, asset_uuid)
);

CREATE TABLE public.water_due_diligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_uuid uuid NOT NULL REFERENCES public.water_assets(id) ON DELETE CASCADE,
  item text NOT NULL,
  category text NOT NULL DEFAULT 'legal',
  status text NOT NULL DEFAULT 'pending',
  note text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.water_assets TO anon;
GRANT SELECT ON public.water_assets TO authenticated;
GRANT ALL ON public.water_assets TO service_role;
GRANT SELECT ON public.water_legal_records TO authenticated;
GRANT ALL ON public.water_legal_records TO service_role;
GRANT SELECT ON public.water_documents TO anon;
GRANT SELECT ON public.water_documents TO authenticated;
GRANT ALL ON public.water_documents TO service_role;
GRANT SELECT ON public.water_quality_tests TO anon;
GRANT SELECT ON public.water_quality_tests TO authenticated;
GRANT ALL ON public.water_quality_tests TO service_role;
GRANT SELECT ON public.water_valuations TO anon;
GRANT SELECT ON public.water_valuations TO authenticated;
GRANT ALL ON public.water_valuations TO service_role;
GRANT SELECT ON public.water_hydrology TO anon;
GRANT SELECT ON public.water_hydrology TO authenticated;
GRANT ALL ON public.water_hydrology TO service_role;
GRANT SELECT ON public.water_portfolios TO anon;
GRANT SELECT ON public.water_portfolios TO authenticated;
GRANT ALL ON public.water_portfolios TO service_role;
GRANT SELECT ON public.water_portfolio_assets TO anon;
GRANT SELECT ON public.water_portfolio_assets TO authenticated;
GRANT ALL ON public.water_portfolio_assets TO service_role;
GRANT SELECT ON public.water_due_diligence TO authenticated;
GRANT ALL ON public.water_due_diligence TO service_role;

ALTER TABLE public.water_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_legal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_quality_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_hydrology ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_portfolio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_due_diligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "water_assets_public_read" ON public.water_assets FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "water_assets_staff_write" ON public.water_assets FOR ALL TO authenticated USING (public.is_gc_staff(auth.uid())) WITH CHECK (public.is_gc_staff(auth.uid()));

CREATE POLICY "water_legal_auth_read" ON public.water_legal_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "water_legal_staff_write" ON public.water_legal_records FOR ALL TO authenticated USING (public.is_gc_staff(auth.uid())) WITH CHECK (public.is_gc_staff(auth.uid()));

CREATE POLICY "water_documents_read" ON public.water_documents FOR SELECT TO anon, authenticated USING (is_public OR auth.uid() IS NOT NULL);
CREATE POLICY "water_documents_staff_write" ON public.water_documents FOR ALL TO authenticated USING (public.is_gc_staff(auth.uid())) WITH CHECK (public.is_gc_staff(auth.uid()));

CREATE POLICY "water_quality_read" ON public.water_quality_tests FOR SELECT TO anon, authenticated USING (is_public OR auth.uid() IS NOT NULL);
CREATE POLICY "water_quality_staff_write" ON public.water_quality_tests FOR ALL TO authenticated USING (public.is_gc_staff(auth.uid())) WITH CHECK (public.is_gc_staff(auth.uid()));

CREATE POLICY "water_valuations_read" ON public.water_valuations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "water_valuations_staff_write" ON public.water_valuations FOR ALL TO authenticated USING (public.is_gc_staff(auth.uid())) WITH CHECK (public.is_gc_staff(auth.uid()));

CREATE POLICY "water_hydrology_read" ON public.water_hydrology FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "water_hydrology_staff_write" ON public.water_hydrology FOR ALL TO authenticated USING (public.is_gc_staff(auth.uid())) WITH CHECK (public.is_gc_staff(auth.uid()));

CREATE POLICY "water_portfolios_read" ON public.water_portfolios FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "water_portfolios_staff_write" ON public.water_portfolios FOR ALL TO authenticated USING (public.is_gc_staff(auth.uid())) WITH CHECK (public.is_gc_staff(auth.uid()));

CREATE POLICY "water_portfolio_assets_read" ON public.water_portfolio_assets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "water_portfolio_assets_staff_write" ON public.water_portfolio_assets FOR ALL TO authenticated USING (public.is_gc_staff(auth.uid())) WITH CHECK (public.is_gc_staff(auth.uid()));

CREATE POLICY "water_dd_auth_read" ON public.water_due_diligence FOR SELECT TO authenticated USING (true);
CREATE POLICY "water_dd_staff_write" ON public.water_due_diligence FOR ALL TO authenticated USING (public.is_gc_staff(auth.uid())) WITH CHECK (public.is_gc_staff(auth.uid()));

CREATE TRIGGER water_assets_updated_at BEFORE UPDATE ON public.water_assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.water_assets (asset_id, name, river, commune, province, region, latitude, longitude, utm_datum, utm_zone, utm_north, utm_east, right_type, nature, exercise, flow_permanent_ls, flow_eventual_ls, flow_notes, capture_system, dga_resolution, dga_resolution_date, unit_value_clp, reference_value_clp, verification_status, summary)
VALUES
('GC-WATER-0001','Río Tranallaquín / Contaco Water Right','Río Tranallaquín / Contaco','San Juan de la Costa','Osorno','Los Lagos',-40.567996,-73.705897,'WGS84','18',5508393,609545,'surface','consuntivo','permanente_continuo',1000,270,'Caudal eventual de hasta 270 L/s sujeto a excedente disponible.','gravitacional','DGA N° 247','2019-06-17',750000,750000000,'documented','Derecho superficial consuntivo de ejercicio permanente y continuo en la comuna de San Juan de la Costa.'),
('GC-WATER-0002','Río Cholguaco Water Right','Río Cholguaco','Río Negro','Osorno','Los Lagos',-40.762016,-73.826895,'WGS84','18',5486999,599015,'surface','consuntivo','permanente_continuo',1000,NULL,NULL,'gravitacional','DGA N° 269','2019-07-03',750000,750000000,'documented','Derecho superficial consuntivo permanente y continuo, inscrito en Registro de Propiedad de Aguas.'),
('GC-WATER-0003','Río Quihue Water Right','Río Quihue','San Juan de la Costa','Osorno','Los Lagos',-40.485538,-73.739091,'WGS84','18',5517587,606866,'surface','consuntivo','permanente_continuo_con_eventual',1000,30,'Referencia febrero: 970 L/s permanente + 30 L/s eventual sujeto a disponibilidad. Denominación jurídica Quihue/Quilhue pendiente de validación.','gravitacional','DGA N° 499','2019-10-17',750000,750000000,'declared','Nombre provisional Río Quihue; denominación jurídica pendiente de validación (Quihue / Quilhue).'),
('GC-WATER-0004','Río Hueyelhue Water Right','Río Hueyelhue','Río Negro','Osorno','Los Lagos',-40.694144,-73.682215,'WGS84','18',5494360,611340,'surface','consuntivo','permanente_continuo',1500,NULL,NULL,'gravitacional','DGA N° 125','2017-05-12',750000,1125000000,'documented','Derecho superficial consuntivo permanente y continuo, con inscripción informada en el CBR de Río Negro (2017, N° 58).');

INSERT INTO public.water_valuations (asset_uuid, method, flow_ls, unit_value_clp, reference_value_clp, notes)
SELECT id, 'unit_flow', flow_permanent_ls, unit_value_clp, reference_value_clp,
  'Valorización comercial referencial. Sujeta a due diligence legal, hidrológica, ambiental y de mercado. No se valorizan caudales eventuales.'
FROM public.water_assets;

INSERT INTO public.water_legal_records (asset_uuid, attribute, value, verification, display_order)
SELECT a.id, x.attribute, x.value, x.verification, x.ord
FROM public.water_assets a
CROSS JOIN LATERAL (VALUES
  ('DGA Resolution', a.dga_resolution, 'document_provided', 1),
  ('Resolution Date', to_char(a.dga_resolution_date,'DD-MM-YYYY'), 'document_provided', 2),
  ('Contraloría Status',
     CASE WHEN a.asset_id = 'GC-WATER-0004' THEN NULL ELSE 'Tomada razón por Contraloría Regional (informado en ficha comercial)' END,
     CASE WHEN a.asset_id = 'GC-WATER-0004' THEN 'not_available' ELSE 'declared' END, 3),
  ('Public Deed',
     CASE WHEN a.asset_id = 'GC-WATER-0004' THEN NULL ELSE 'Reducida a escritura pública en septiembre de 2020 (informado)' END,
     CASE WHEN a.asset_id = 'GC-WATER-0004' THEN 'not_available' ELSE 'declared' END, 4),
  ('Water Property Registry',
     CASE
       WHEN a.asset_id = 'GC-WATER-0002' THEN 'Inscrito en Registro de Propiedad de Aguas (informado)'
       WHEN a.asset_id = 'GC-WATER-0004' THEN 'Registro de Propiedad de Aguas, año 2017, N° 58'
       ELSE 'Indicado como vigente e inscribible en Registro de Propiedad de Aguas'
     END, 'declared', 5),
  ('Conservador', CASE WHEN a.asset_id = 'GC-WATER-0004' THEN 'Conservador de Bienes Raíces de Río Negro' ELSE NULL END,
     CASE WHEN a.asset_id = 'GC-WATER-0004' THEN 'declared' ELSE 'not_available' END, 6),
  ('Registry Year', CASE WHEN a.asset_id = 'GC-WATER-0004' THEN '2017' ELSE NULL END,
     CASE WHEN a.asset_id = 'GC-WATER-0004' THEN 'declared' ELSE 'not_available' END, 7),
  ('Registry Number', CASE WHEN a.asset_id = 'GC-WATER-0004' THEN '58' ELSE NULL END,
     CASE WHEN a.asset_id = 'GC-WATER-0004' THEN 'declared' ELSE 'not_available' END, 8),
  ('Registered Holder', NULL, 'pending', 9),
  ('Environmental Conditions', NULL, 'pending', 10),
  ('Ecological Flow', NULL, 'pending', 11),
  ('Previous Rights Priority', NULL, 'pending', 12),
  ('Water Intake Authorization', NULL, 'pending', 13),
  ('Easements', NULL, 'pending', 14)
) AS x(attribute, value, verification, ord);

INSERT INTO public.water_quality_tests (asset_uuid, status, parameters, is_public)
SELECT id, 'not_tested', '{}'::jsonb, true FROM public.water_assets;

INSERT INTO public.water_portfolios (code, name, description, color, display_order) VALUES
('SJC','San Juan de la Costa','Portafolio comercial San Juan de la Costa — 2.000 L/s permanentes.','#0ea5e9',1),
('RNE','Río Negro','Portafolio comercial Río Negro — 2.500 L/s permanentes.','#1d4ed8',2);

INSERT INTO public.water_portfolio_assets (portfolio_id, asset_uuid)
SELECT p.id, a.id FROM public.water_portfolios p JOIN public.water_assets a ON
 (p.code = 'SJC' AND a.asset_id IN ('GC-WATER-0001','GC-WATER-0003'))
 OR (p.code = 'RNE' AND a.asset_id IN ('GC-WATER-0002','GC-WATER-0004'));

INSERT INTO public.water_due_diligence (asset_uuid, item, category, status, display_order)
SELECT a.id, x.item, x.category, 'pending', x.ord
FROM public.water_assets a
CROSS JOIN LATERAL (VALUES
  ('Certificado de dominio vigente','legal',1),
  ('Copia autorizada de resolución DGA','legal',2),
  ('Escritura pública','legal',3),
  ('Inscripción CBR','legal',4),
  ('Estudio hidrológico','hidrologia',5),
  ('Análisis de calidad de agua','calidad',6),
  ('Verificación de servidumbres y acceso','tecnico',7)
) AS x(item, category, ord);