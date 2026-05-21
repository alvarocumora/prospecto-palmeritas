
-- Required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- public_concessions_cache: snapshot nacional desde SERNAGEOMIN
-- ============================================================
CREATE TABLE IF NOT EXISTS public.public_concessions_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  concession_type text NOT NULL CHECK (concession_type IN ('explotacion','exploracion','mensura','manifestacion')),
  name text,
  holder text,
  rut text,
  area_ha numeric,
  status text,
  granted_at date,
  expires_at date,
  region text,
  region_slug text,
  commune text,
  province text,
  datum text,
  geometry geometry(MultiPolygon, 4326),
  centroid geometry(Point, 4326),
  raw_attrs jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcc_holder_trgm ON public.public_concessions_cache USING gin (holder gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pcc_name_trgm   ON public.public_concessions_cache USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pcc_rut         ON public.public_concessions_cache (rut);
CREATE INDEX IF NOT EXISTS idx_pcc_region_slug ON public.public_concessions_cache (region_slug);
CREATE INDEX IF NOT EXISTS idx_pcc_type        ON public.public_concessions_cache (concession_type);
CREATE INDEX IF NOT EXISTS idx_pcc_geom        ON public.public_concessions_cache USING gist (geometry);
CREATE INDEX IF NOT EXISTS idx_pcc_centroid    ON public.public_concessions_cache USING gist (centroid);

ALTER TABLE public.public_concessions_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read concessions cache"
  ON public.public_concessions_cache FOR SELECT
  USING (true);

-- ============================================================
-- public_holders: agregado por titular
-- ============================================================
CREATE TABLE IF NOT EXISTS public.public_holders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rut text UNIQUE,
  holder_name text NOT NULL,
  holder_slug text UNIQUE NOT NULL,
  total_concessions integer NOT NULL DEFAULT 0,
  total_area_ha numeric NOT NULL DEFAULT 0,
  regions text[] NOT NULL DEFAULT '{}',
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ph_name_trgm ON public.public_holders USING gin (holder_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ph_slug      ON public.public_holders (holder_slug);

ALTER TABLE public.public_holders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read holders"
  ON public.public_holders FOR SELECT
  USING (true);

-- ============================================================
-- subscriptions: plan de cada usuario
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled','trialing')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_user ON public.subscriptions (user_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Writes via service role only (webhook + server fns elevated).
-- No insert/update/delete policies = blocked for normal users.

-- ============================================================
-- Helper: plan actual del usuario (default 'free')
-- ============================================================
CREATE OR REPLACE FUNCTION public.catastro_plan(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT plan FROM public.subscriptions
      WHERE user_id = _user_id AND status IN ('active','trialing')
      LIMIT 1),
    'free'
  );
$$;

GRANT EXECUTE ON FUNCTION public.catastro_plan(uuid) TO authenticated, anon;

-- ============================================================
-- updated_at triggers (reusa public.update_updated_at_column si existe)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $f$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql SET search_path = public;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_pcc_updated ON public.public_concessions_cache;
CREATE TRIGGER trg_pcc_updated BEFORE UPDATE ON public.public_concessions_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_sub_updated ON public.subscriptions;
CREATE TRIGGER trg_sub_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
