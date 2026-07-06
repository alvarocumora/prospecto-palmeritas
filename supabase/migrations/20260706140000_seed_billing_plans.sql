-- Seed de billing_plans como fuente de verdad única de planes.
-- Reemplaza el pricing hardcodeado en catastro.precios.tsx y el stub del admin.
-- Los códigos coinciden con el CHECK de subscriptions (free|pro|enterprise) y
-- con el RPC catastro_plan_limits.

INSERT INTO public.billing_plans
  (code, name, description, price_usd_monthly, price_usd_yearly,
   max_projects, max_members, max_storage_gb, max_ai_calls_per_month,
   features, is_active, is_default, display_order)
VALUES
  (
    'free', 'Free', 'Acceso al mapa nacional y búsqueda ilimitada de concesiones.',
    0, 0, 1, 1, 1, 20,
    '["Mapa nacional SERNAGEOMIN en vivo","Búsqueda ilimitada de concesiones","Ficha pública por concesión","Watchlist hasta 3 concesiones"]'::jsonb,
    true, true, 1
  ),
  (
    'pro', 'Pro', 'Monitoreo activo con alertas, AOI y exportes para due diligence.',
    49, 490, 20, 5, 50, 500,
    '["Todo lo de Free","Watchlist hasta 50 concesiones","Alertas por email y push","AOI ilimitadas con análisis de traslapes","20 exportes PDF / GeoJSON al mes","Sin marca de agua"]'::jsonb,
    true, false, 2
  ),
  (
    'enterprise', 'Enterprise', 'Escala institucional: multi-usuario, API y soporte con SLA.',
    299, 2990, 999, 50, 1000, 5000,
    '["Todo lo de Pro","Watchlist ilimitado","Exportes Shapefile y API","Multi-usuario y roles","Reportes due-diligence batch","Soporte prioritario","SLA y onboarding"]'::jsonb,
    true, false, 3
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_usd_monthly = EXCLUDED.price_usd_monthly,
  price_usd_yearly = EXCLUDED.price_usd_yearly,
  max_projects = EXCLUDED.max_projects,
  max_members = EXCLUDED.max_members,
  max_storage_gb = EXCLUDED.max_storage_gb,
  max_ai_calls_per_month = EXCLUDED.max_ai_calls_per_month,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  is_default = EXCLUDED.is_default,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- Lectura pública de planes activos (para la página de precios sin login).
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads active plans" ON public.billing_plans;
CREATE POLICY "Public reads active plans"
ON public.billing_plans
FOR SELECT TO anon, authenticated
USING (is_active = true);

GRANT SELECT ON public.billing_plans TO anon, authenticated;
