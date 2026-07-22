
CREATE TABLE public.trade_board_prefs (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_stages TEXT[] NOT NULL DEFAULT '{}',
  wip_limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  column_order TEXT[] NOT NULL DEFAULT '{}',
  preferred_view TEXT NOT NULL DEFAULT 'kanban',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_board_prefs TO authenticated;
GRANT ALL ON public.trade_board_prefs TO service_role;
ALTER TABLE public.trade_board_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs read" ON public.trade_board_prefs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own prefs write" ON public.trade_board_prefs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prefs update" ON public.trade_board_prefs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prefs delete" ON public.trade_board_prefs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.freight_rates (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  port_origin TEXT NOT NULL,
  port_destination TEXT NOT NULL,
  container_type TEXT NOT NULL CHECK (container_type IN ('20ft','40ft','bulk_mt')),
  usd_rate NUMERIC NOT NULL,
  transit_days INT,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX freight_rates_route_idx ON public.freight_rates(port_origin, port_destination, valid_from DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.freight_rates TO authenticated;
GRANT ALL ON public.freight_rates TO service_role;
ALTER TABLE public.freight_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "freight read" ON public.freight_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "freight admin write" ON public.freight_rates FOR INSERT TO authenticated WITH CHECK (public.has_app_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "freight admin update" ON public.freight_rates FOR UPDATE TO authenticated USING (public.has_app_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_app_role(auth.uid(), 'super_admin'::public.app_role));
CREATE POLICY "freight admin delete" ON public.freight_rates FOR DELETE TO authenticated USING (public.has_app_role(auth.uid(), 'super_admin'::public.app_role));

INSERT INTO public.freight_rates (port_origin, port_destination, container_type, usd_rate, transit_days, source, notes) VALUES
('San Antonio (CL)', 'Shanghai (CN)', '40ft', 3200, 32, 'Drewry WCI', 'Ruta principal cobre/concentrados a China'),
('San Antonio (CL)', 'Shanghai (CN)', '20ft', 2100, 32, 'Drewry WCI', NULL),
('San Antonio (CL)', 'Shanghai (CN)', 'bulk_mt', 45, 35, 'Baltic Dry', 'Granel supramax'),
('Valparaíso (CL)', 'Rotterdam (NL)', '40ft', 2850, 28, 'Freightos FBX', 'Vía Panamá'),
('Valparaíso (CL)', 'Rotterdam (NL)', '20ft', 1950, 28, 'Freightos FBX', NULL),
('Valparaíso (CL)', 'Hamburg (DE)', '40ft', 2950, 30, 'Freightos FBX', NULL),
('Valparaíso (CL)', 'Antwerp (BE)', '40ft', 2900, 29, 'Freightos FBX', NULL),
('Mejillones (CL)', 'Shanghai (CN)', 'bulk_mt', 42, 34, 'Baltic Dry', 'Concentrados norte'),
('Mejillones (CL)', 'Busan (KR)', 'bulk_mt', 48, 30, 'Baltic Dry', 'Concentrados de cobre'),
('Mejillones (CL)', 'Qingdao (CN)', 'bulk_mt', 43, 36, 'Baltic Dry', NULL),
('Iquique (CL)', 'Los Angeles (US)', '40ft', 2400, 18, 'Freightos FBX', NULL),
('Iquique (CL)', 'Los Angeles (US)', '20ft', 1650, 18, 'Freightos FBX', NULL),
('Iquique (CL)', 'Houston (US)', '40ft', 2650, 22, 'Freightos FBX', NULL),
('San Antonio (CL)', 'Busan (KR)', '40ft', 3050, 30, 'Freightos FBX', NULL),
('San Antonio (CL)', 'Yokohama (JP)', '40ft', 3100, 31, 'Freightos FBX', NULL),
('Valparaíso (CL)', 'Genoa (IT)', '40ft', 2950, 32, 'Freightos FBX', 'Sur de Europa'),
('San Antonio (CL)', 'Long Beach (US)', '40ft', 2350, 17, 'Freightos FBX', NULL),
('Mejillones (CL)', 'Rotterdam (NL)', 'bulk_mt', 52, 40, 'Baltic Dry', 'Vía Panamá'),
('Iquique (CL)', 'Shanghai (CN)', 'bulk_mt', 46, 35, 'Baltic Dry', NULL),
('San Antonio (CL)', 'Antwerp (BE)', '20ft', 1980, 29, 'Freightos FBX', NULL);

CREATE TRIGGER trg_freight_rates_updated
  BEFORE UPDATE ON public.freight_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_trade_board_prefs_updated
  BEFORE UPDATE ON public.trade_board_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
