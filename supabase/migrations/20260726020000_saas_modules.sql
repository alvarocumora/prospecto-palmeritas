-- SAAS MODULAR · Catálogo de módulos + entitlements por plan + get_my_modules().
--
-- 3 módulos vendibles por separado (por planes): Catastro/Exploración/Certificación,
-- Commodities/Trading/Envíos, Capital/Deals de minas. Un plan (billing_plans.code)
-- habilita módulos y features (p.ej. bilingual_docs) vía plan_entitlements. El front
-- llama get_my_modules() para armar el selector de módulo y gatear rutas.
--
-- Resolución (modelo real de Lovable): user -> subscriptions(user_id).plan ->
-- billing_plans.code -> plan_entitlements. Solo LEE subscriptions/billing_plans; no
-- las modifica. Compatibilidad: si un plan no tiene módulos configurados, se devuelven
-- TODOS (unrestricted) para no romper usuarios existentes; la restricción es opt-in.

-- Catálogo de módulos (bilingüe ES/EN). 'gated' = módulo vendible; core siempre activo.
CREATE TABLE IF NOT EXISTS public.modules_catalog (
  key text PRIMARY KEY,
  name_es text NOT NULL,
  name_en text NOT NULL,
  description_es text,
  description_en text,
  icon text,
  display_order integer NOT NULL DEFAULT 0,
  gated boolean NOT NULL DEFAULT true
);
INSERT INTO public.modules_catalog (key, name_es, name_en, description_es, description_en, icon, display_order, gated) VALUES
  ('catastro','Exploración, Certificación y Catastro','Exploration, Certification & Cadastre','Tenencia minera, catastro, boletín y exploración (geofísica, sondajes, NI 43-101).','Mining tenure, cadastre, bulletin and exploration (geophysics, drilling, NI 43-101).','pickaxe',1,true),
  ('commodities','Commodities, Trading y Envíos','Commodities, Trading & Shipping','Intermediación de metales: mesa de operaciones, sourcing, marketplace, compliance, negociación, logística.','Metals intermediation: trade desk, sourcing, marketplace, compliance, negotiation, logistics.','ship',2,true),
  ('capital','Capital y Deals de Minas','Capital & Mining Deals','Venta de proyectos, inversión y deals de minas.','Project sales, investment and mining deals.','landmark',3,true),
  ('core','General','General','Inicio, analítica, perfil y administración (transversal).','Home, analytics, profile and administration (shared).','layout-dashboard',0,false)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.modules_catalog ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='modules_catalog' AND policyname='modules_catalog_read') THEN
    CREATE POLICY "modules_catalog_read" ON public.modules_catalog FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.modules_catalog TO authenticated;
GRANT ALL ON public.modules_catalog TO service_role;

-- Entitlements por plan: qué módulos y features incluye cada billing_plans.code.
-- Se puebla con los códigos de plan reales (admin). Vacío => unrestricted (ver RPC).
CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  plan_code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('module','feature')),
  key text NOT NULL,               -- module: catastro|commodities|capital ; feature: p.ej. bilingual_docs
  PRIMARY KEY (plan_code, kind, key)
);
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plan_entitlements' AND policyname='plan_entitlements_read') THEN
    CREATE POLICY "plan_entitlements_read" ON public.plan_entitlements FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.plan_entitlements TO authenticated;
GRANT ALL ON public.plan_entitlements TO service_role;

COMMENT ON TABLE public.plan_entitlements IS
  'Módulos y features por plan (billing_plans.code). Vacío para un plan => acceso a todos los módulos (unrestricted). Feature bilingual_docs habilita generación bilingüe ES/EN.';

-- Resuelve los módulos/features del usuario actual según su plan.
CREATE OR REPLACE FUNCTION public.get_my_modules()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_has_modules boolean;
  v_modules jsonb;
  v_features jsonb;
BEGIN
  -- Plan del usuario (suscripción activa) o el plan por defecto.
  SELECT COALESCE(
    (SELECT COALESCE(bp.code, s.plan)
       FROM public.subscriptions s
       LEFT JOIN public.billing_plans bp ON (bp.id::text = s.plan)
      WHERE s.user_id = v_uid AND s.status IN ('active','trialing')
      ORDER BY s.current_period_end DESC NULLS LAST LIMIT 1),
    (SELECT code FROM public.billing_plans WHERE is_default ORDER BY display_order LIMIT 1)
  ) INTO v_code;

  SELECT EXISTS (SELECT 1 FROM public.plan_entitlements WHERE plan_code = v_code AND kind = 'module')
    INTO v_has_modules;

  IF v_has_modules THEN
    SELECT jsonb_agg(to_jsonb(m) ORDER BY m.display_order) INTO v_modules FROM (
      SELECT key, name_es, name_en, description_es, description_en, icon, display_order
      FROM public.modules_catalog
      WHERE gated AND key IN (SELECT key FROM public.plan_entitlements WHERE plan_code = v_code AND kind = 'module')
    ) m;
  ELSE
    SELECT jsonb_agg(to_jsonb(m) ORDER BY m.display_order) INTO v_modules FROM (
      SELECT key, name_es, name_en, description_es, description_en, icon, display_order
      FROM public.modules_catalog WHERE gated
    ) m;
  END IF;

  SELECT COALESCE(jsonb_agg(key ORDER BY key), '[]'::jsonb) INTO v_features
  FROM public.plan_entitlements WHERE plan_code = v_code AND kind = 'feature';

  RETURN jsonb_build_object(
    'plan_code', v_code,
    'unrestricted', NOT v_has_modules,
    'modules', COALESCE(v_modules, '[]'::jsonb),
    'features', v_features
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_my_modules() TO authenticated, service_role;
