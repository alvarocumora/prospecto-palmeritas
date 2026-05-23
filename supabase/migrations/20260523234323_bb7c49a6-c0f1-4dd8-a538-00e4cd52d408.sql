
CREATE TABLE IF NOT EXISTS public.commodity_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  name text NOT NULL,
  unit text NOT NULL,
  price numeric NOT NULL,
  change_pct numeric NOT NULL DEFAULT 0,
  source text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commodity_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commodity_prices_public_read"
  ON public.commodity_prices FOR SELECT USING (true);

CREATE POLICY "commodity_prices_admin_write"
  ON public.commodity_prices FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_commodity_prices_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_commodity_prices_updated_at ON public.commodity_prices;
CREATE TRIGGER trg_commodity_prices_updated_at
  BEFORE UPDATE ON public.commodity_prices
  FOR EACH ROW EXECUTE FUNCTION public.touch_commodity_prices_updated_at();

INSERT INTO public.commodity_prices (symbol, name, unit, price, change_pct, source) VALUES
  ('Cu', 'Cobre', 'US$/lb', 4.21, 1.2, 'seed'),
  ('Au', 'Oro', 'US$/oz', 2347, 0.8, 'seed'),
  ('Ag', 'Plata', 'US$/oz', 28.65, 1.5, 'seed'),
  ('Li', 'Litio', 'US$/t', 14200, -0.4, 'seed')
ON CONFLICT (symbol) DO NOTHING;
