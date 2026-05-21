
-- Watchlist
CREATE TABLE public.catastro_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concession_code TEXT NOT NULL,
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_push BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, concession_code)
);
CREATE INDEX idx_catastro_watchlist_user ON public.catastro_watchlist(user_id);
CREATE INDEX idx_catastro_watchlist_code ON public.catastro_watchlist(concession_code);

ALTER TABLE public.catastro_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlist_select_own" ON public.catastro_watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "watchlist_insert_own" ON public.catastro_watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watchlist_update_own" ON public.catastro_watchlist FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "watchlist_delete_own" ON public.catastro_watchlist FOR DELETE USING (auth.uid() = user_id);

-- Alerts
CREATE TABLE public.catastro_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concession_code TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('holder_change','area_change','status_change','expiring','missing')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  title TEXT NOT NULL,
  message TEXT,
  payload JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_catastro_alerts_user_unread ON public.catastro_alerts(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_catastro_alerts_created ON public.catastro_alerts(created_at DESC);

ALTER TABLE public.catastro_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_select_own" ON public.catastro_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "alerts_update_own" ON public.catastro_alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "alerts_delete_own" ON public.catastro_alerts FOR DELETE USING (auth.uid() = user_id);

-- AOI (areas of interest)
CREATE TABLE public.catastro_aoi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  geometry JSONB NOT NULL,
  area_ha NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_catastro_aoi_user ON public.catastro_aoi(user_id);

ALTER TABLE public.catastro_aoi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aoi_select_own" ON public.catastro_aoi FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "aoi_insert_own" ON public.catastro_aoi FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "aoi_update_own" ON public.catastro_aoi FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "aoi_delete_own" ON public.catastro_aoi FOR DELETE USING (auth.uid() = user_id);

-- Exports
CREATE TABLE public.catastro_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL CHECK (export_type IN ('pdf','geojson','shp','csv')),
  target_type TEXT NOT NULL CHECK (target_type IN ('concession','holder','aoi','region')),
  target_ref TEXT NOT NULL,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','ready','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_catastro_exports_user ON public.catastro_exports(user_id, created_at DESC);

ALTER TABLE public.catastro_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exports_select_own" ON public.catastro_exports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "exports_insert_own" ON public.catastro_exports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Helper: límites por plan
CREATE OR REPLACE FUNCTION public.catastro_plan_limits(_user_id UUID)
RETURNS TABLE(plan TEXT, max_watches INT, max_aoi INT, max_exports_month INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p AS plan,
    CASE p WHEN 'free' THEN 3 WHEN 'pro' THEN 50 WHEN 'enterprise' THEN 99999 END AS max_watches,
    CASE p WHEN 'free' THEN 1 WHEN 'pro' THEN 50 WHEN 'enterprise' THEN 99999 END AS max_aoi,
    CASE p WHEN 'free' THEN 0 WHEN 'pro' THEN 20 WHEN 'enterprise' THEN 99999 END AS max_exports_month
  FROM (SELECT public.catastro_plan(_user_id) AS p) s;
$$;

-- Trigger updated_at en AOI
CREATE TRIGGER catastro_aoi_updated_at
BEFORE UPDATE ON public.catastro_aoi
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
