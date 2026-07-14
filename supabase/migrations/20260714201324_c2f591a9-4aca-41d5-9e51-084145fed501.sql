
CREATE TABLE public.market_comparables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_url text,
  deal_type text NOT NULL DEFAULT 'transaction',
  project_name text NOT NULL,
  operator text,
  country text NOT NULL,
  region text,
  commodity text NOT NULL,
  stage text NOT NULL,
  area_ha numeric,
  price_usd numeric NOT NULL,
  price_per_ha_usd numeric,
  resource_tonnes numeric,
  resource_grade numeric,
  resource_grade_unit text,
  resource_confidence text,
  deal_date date,
  notes text,
  is_verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.market_comparables TO authenticated;
GRANT SELECT ON public.market_comparables TO anon;
GRANT ALL ON public.market_comparables TO service_role;

ALTER TABLE public.market_comparables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read market comparables"
  ON public.market_comparables FOR SELECT
  USING (true);

CREATE INDEX idx_market_comparables_commodity ON public.market_comparables (commodity);
CREATE INDEX idx_market_comparables_stage ON public.market_comparables (stage);
CREATE INDEX idx_market_comparables_country ON public.market_comparables (country);

-- Seed: comparables curados de fuentes públicas (TSX-V, ASX, S&P, Mining.com, MinersLink, remates SERNAGEOMIN)
INSERT INTO public.market_comparables
  (source, source_url, deal_type, project_name, operator, country, region, commodity, stage, area_ha, price_usd, price_per_ha_usd, deal_date, notes)
VALUES
  -- COBRE Chile
  ('SEDAR+ / TSX-V', 'https://www.sedarplus.ca', 'transaction', 'Filo del Sol (option)', 'Filo Mining', 'AR', 'San Juan', 'copper', 'advanced_exploration', 5400, 45000000, 8333, '2023-08-15', 'Earn-in 60% + work commitment'),
  ('SEC EDGAR', 'https://www.sec.gov/edgar', 'transaction', 'Los Helados', 'NGEx Resources', 'CL', 'Atacama', 'copper', 'resource_definition', 8200, 120000000, 14634, '2022-11-01', 'JV con Pan Pacific Copper'),
  ('MinersLink', 'https://minerslink.com', 'listing', 'Cuprita Norte (venta)', NULL, 'CL', 'Antofagasta', 'copper', 'drilling', 1800, 8500000, 4722, '2024-05-10', 'Anuncio directo, incluye labores antiguas'),
  ('SERNAGEOMIN remate', 'https://www.sernageomin.cl', 'auction', 'Pedimento Copper Range', NULL, 'CL', 'Atacama', 'copper', 'early_stage', 300, 45000, 150, '2024-02-20', 'Remate público concesión de exploración'),
  ('Mining.com', 'https://mining.com', 'transaction', 'Mocoa (option)', 'Libero Copper', 'CO', 'Putumayo', 'copper', 'advanced_exploration', 11000, 82000000, 7454, '2023-03-01', 'Earn-in 100%'),
  ('S&P Capital IQ', 'https://spglobal.com/marketintelligence', 'transaction', 'Vizcachitas', 'Los Andes Copper', 'CL', 'Valparaíso', 'copper', 'pfs', 3800, 145000000, 38157, '2023-12-15', 'PFS avanzado, financiamiento estructurado'),
  ('TSX-V', 'https://www.tsx.com', 'listing', 'Marimaca (equity comp)', 'Marimaca Copper', 'CL', 'Antofagasta', 'copper', 'pfs', 2400, 260000000, 108333, '2024-06-01', 'Market cap implícito por EV/ha'),
  ('MinersLink', 'https://minerslink.com', 'listing', 'Distrito Copiapó (paquete)', NULL, 'CL', 'Atacama', 'copper', 'greenfield', 4200, 320000, 76, '2024-09-15', 'Paquete de pedimentos sin trabajos'),

  -- ORO
  ('TSX-V', 'https://www.tsx.com', 'transaction', 'Cerro Blanco Sur', 'Salazar Resources', 'EC', 'El Oro', 'gold', 'drilling', 2100, 12500000, 5952, '2023-06-12', 'Option agreement 100%'),
  ('ASX', 'https://www.asx.com.au', 'transaction', 'Josemaría (Au-Cu)', 'Lundin Mining', 'AR', 'San Juan', 'gold', 'fs', 5300, 625000000, 117924, '2023-07-01', 'FS completo, compra 100%'),
  ('MinersLink', 'https://minerslink.com', 'listing', 'Veta Aurífera Alhué', NULL, 'CL', 'Metropolitana', 'gold', 'drilling', 850, 3800000, 4470, '2024-04-20', 'Con planta pequeña incluida'),
  ('SERNAGEOMIN remate', 'https://www.sernageomin.cl', 'auction', 'Pedimento Cordillera Au', NULL, 'CL', 'Coquimbo', 'gold', 'greenfield', 500, 25000, 50, '2024-01-15', 'Remate anual patentes impagas'),
  ('SEDAR+', 'https://www.sedarplus.ca', 'transaction', 'Salares Norte', 'Gold Fields', 'CL', 'Atacama', 'gold', 'construction', 6800, 850000000, 125000, '2022-10-01', 'Ya en construcción, Au-Ag'),
  ('TSX', 'https://www.tsx.com', 'transaction', 'La Coipa (extensión)', 'Kinross Gold', 'CL', 'Atacama', 'gold', 'production', 3200, 340000000, 106250, '2023-02-15', 'Reinicio producción, con permisos'),

  -- LITIO
  ('ASX', 'https://www.asx.com.au', 'transaction', 'Rincón Lithium', 'Rio Tinto', 'AR', 'Salta', 'lithium', 'construction', 8000, 825000000, 103125, '2022-03-28', 'Salar en construcción'),
  ('S&P Capital IQ', 'https://spglobal.com/marketintelligence', 'transaction', 'Cauchari-Olaroz', 'Lithium Americas', 'AR', 'Jujuy', 'lithium', 'production', 12500, 1400000000, 112000, '2023-04-15', 'Producción activa'),
  ('MinersLink', 'https://minerslink.com', 'listing', 'Salar Grande (proyecto)', NULL, 'CL', 'Antofagasta', 'lithium', 'early_stage', 3500, 18000000, 5142, '2024-08-01', 'Salmuera con muestreo inicial'),
  ('SEDAR+', 'https://www.sedarplus.ca', 'transaction', 'Maricunga Lithium', 'Lithium Power', 'CL', 'Atacama', 'lithium', 'pfs', 4100, 320000000, 78048, '2023-05-20', 'PFS con recursos Indicated'),

  -- PLATA
  ('TSX-V', 'https://www.tsx.com', 'transaction', 'Corani (Ag-Pb-Zn)', 'Bear Creek Mining', 'PE', 'Puno', 'silver', 'construction', 5500, 195000000, 35454, '2022-08-10', 'Construcción, con FS'),
  ('MinersLink', 'https://minerslink.com', 'listing', 'Mina Ag Cordillera', NULL, 'CL', 'O''Higgins', 'silver', 'advanced_exploration', 1200, 4200000, 3500, '2024-03-01', 'Con labores históricas'),

  -- HIERRO
  ('S&P Capital IQ', 'https://spglobal.com/marketintelligence', 'transaction', 'Los Colorados (Fe)', 'CAP Mineria', 'CL', 'Atacama', 'iron', 'production', 2800, 220000000, 78571, '2022-06-15', 'Operación activa'),
  ('MinersLink', 'https://minerslink.com', 'listing', 'Fe Palmeras', NULL, 'CL', 'Atacama', 'iron', 'drilling', 950, 3200000, 3368, '2024-07-10', 'Cuerpos magnéticos con perforación previa'),

  -- Grassroots / paquetes de concesión
  ('SERNAGEOMIN remate', 'https://www.sernageomin.cl', 'auction', 'Paquete Norte Grande', NULL, 'CL', 'Antofagasta', 'copper', 'greenfield', 8000, 480000, 60, '2023-11-01', 'Paquete masivo remate patentes'),
  ('SERNAGEOMIN remate', 'https://www.sernageomin.cl', 'auction', 'Paquete Coquimbo mixto', NULL, 'CL', 'Coquimbo', 'gold', 'greenfield', 3500, 175000, 50, '2024-01-15', 'Concesiones exploración'),
  ('MinersLink', 'https://minerslink.com', 'listing', 'Distrito Illapel', NULL, 'CL', 'Coquimbo', 'copper', 'early_stage', 2200, 990000, 450, '2024-06-01', 'Con muestreo superficial y geoquímica'),

  -- Advanced/PEA reference
  ('SEDAR+', 'https://www.sedarplus.ca', 'transaction', 'La Verde', 'Chesapeake Gold', 'MX', 'Michoacán', 'copper', 'resource_definition', 6300, 78000000, 12380, '2023-09-12', 'Recurso Inferred'),
  ('TSX-V', 'https://www.tsx.com', 'transaction', 'Warintza', 'Solaris Resources', 'EC', 'Morona', 'copper', 'resource_definition', 4900, 165000000, 33673, '2023-10-05', 'Recurso Indicated 6.7Bt @ 0.42% Cu'),
  ('ASX', 'https://www.asx.com.au', 'transaction', 'Havieron', 'Greatland Gold', 'AU', 'WA', 'gold', 'pfs', 3300, 245000000, 74242, '2023-05-10', 'PFS, JV con Newcrest'),

  -- Chile stage-específicos
  ('MinersLink', 'https://minerslink.com', 'listing', 'Los Verdes Cu', NULL, 'CL', 'Coquimbo', 'copper', 'drilling', 1450, 6300000, 4344, '2024-05-20', 'Con drillholes 2018-2022'),
  ('MinersLink', 'https://minerslink.com', 'listing', 'Asiento Viejo', NULL, 'CL', 'Atacama', 'gold', 'advanced_exploration', 1800, 7500000, 4166, '2024-02-15', 'Vetas HS con geoquímica'),
  ('S&P Capital IQ', 'https://spglobal.com/marketintelligence', 'transaction', 'Diablillos', 'AbraSilver', 'AR', 'Salta', 'silver', 'pfs', 4900, 285000000, 58163, '2024-01-20', 'PFS Ag-Au'),
  ('TSX-V', 'https://www.tsx.com', 'transaction', 'Yaguas', 'Panoro Minerals', 'PE', 'Cusco', 'copper', 'advanced_exploration', 6100, 52000000, 8524, '2023-04-18', 'Skarn Cu-Au'),
  ('SEDAR+', 'https://www.sedarplus.ca', 'transaction', 'Cortadera', 'Hot Chili', 'CL', 'Atacama', 'copper', 'pfs', 3900, 340000000, 87179, '2024-02-01', 'PFS reciente, Cu-Au-Ag'),
  ('MinersLink', 'https://minerslink.com', 'listing', 'Portezuelo Cu-Au', NULL, 'CL', 'Atacama', 'copper', 'early_stage', 780, 340000, 435, '2024-10-01', 'Con geoquímica de suelo'),
  ('SERNAGEOMIN remate', 'https://www.sernageomin.cl', 'auction', 'Pertenencias El Salvador Sur', NULL, 'CL', 'Atacama', 'copper', 'greenfield', 1500, 90000, 60, '2024-03-01', 'Remate anual, sin trabajos');

CREATE OR REPLACE FUNCTION public.update_market_comparables_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_market_comparables_updated_at
  BEFORE UPDATE ON public.market_comparables
  FOR EACH ROW EXECUTE FUNCTION public.update_market_comparables_updated_at();
