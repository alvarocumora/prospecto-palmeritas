ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'PROSPECCION', ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.deal_pedimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  seq int NOT NULL,
  name text NOT NULL,
  ha numeric,
  court text,
  status text NOT NULL DEFAULT 'PENDIENTE',
  n_from numeric, n_to numeric, e_from numeric, e_to numeric,
  datum text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_pedimentos TO authenticated;
GRANT ALL ON public.deal_pedimentos TO service_role;
ALTER TABLE public.deal_pedimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY deal_pedimentos_select ON public.deal_pedimentos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id));
CREATE POLICY deal_pedimentos_write ON public.deal_pedimentos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND (d.created_by = auth.uid() OR public.is_super_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND (d.created_by = auth.uid() OR public.is_super_admin(auth.uid()))));

CREATE TABLE public.deal_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  priority text NOT NULL DEFAULT 'MEDIA',
  title text NOT NULL,
  description text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_alerts TO authenticated;
GRANT ALL ON public.deal_alerts TO service_role;
ALTER TABLE public.deal_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY deal_alerts_select ON public.deal_alerts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id));
CREATE POLICY deal_alerts_write ON public.deal_alerts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND (d.created_by = auth.uid() OR public.is_super_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND (d.created_by = auth.uid() OR public.is_super_admin(auth.uid()))));

CREATE OR REPLACE FUNCTION public.deal_children_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER deal_pedimentos_touch BEFORE UPDATE ON public.deal_pedimentos FOR EACH ROW EXECUTE FUNCTION public.deal_children_touch();
CREATE TRIGGER deal_alerts_touch BEFORE UPDATE ON public.deal_alerts FOR EACH ROW EXECUTE FUNCTION public.deal_children_touch();