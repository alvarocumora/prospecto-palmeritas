CREATE TABLE public.spv_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL,
  legal_name text NOT NULL,
  rut text,
  total_shares numeric NOT NULL DEFAULT 0,
  share_price numeric,
  currency text NOT NULL DEFAULT 'CLP',
  incorporated_on date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX spv_entities_project_code_key ON public.spv_entities (project_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spv_entities TO authenticated;
GRANT ALL ON public.spv_entities TO service_role;
ALTER TABLE public.spv_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spv_entities_read_auth" ON public.spv_entities FOR SELECT TO authenticated USING (true);
CREATE POLICY "spv_entities_staff_write" ON public.spv_entities FOR ALL TO authenticated
  USING (public.is_geocapitals_staff(auth.uid())) WITH CHECK (public.is_geocapitals_staff(auth.uid()));

CREATE TABLE public.spv_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spv_id uuid NOT NULL REFERENCES public.spv_entities(id) ON DELETE CASCADE,
  investor_user_id uuid,
  investor_name text NOT NULL,
  investor_email text,
  shares numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CLP',
  instrument text NOT NULL DEFAULT 'equity',
  subscribed_on date NOT NULL DEFAULT current_date,
  document_url text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX spv_positions_spv_idx ON public.spv_positions (spv_id);
CREATE INDEX spv_positions_user_idx ON public.spv_positions (investor_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spv_positions TO authenticated;
GRANT ALL ON public.spv_positions TO service_role;
ALTER TABLE public.spv_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spv_positions_own_read" ON public.spv_positions FOR SELECT TO authenticated
  USING (investor_user_id = auth.uid());
CREATE POLICY "spv_positions_staff_all" ON public.spv_positions FOR ALL TO authenticated
  USING (public.is_geocapitals_staff(auth.uid())) WITH CHECK (public.is_geocapitals_staff(auth.uid()));

CREATE TABLE public.spv_position_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.spv_positions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX spv_position_events_position_idx ON public.spv_position_events (position_id);
GRANT SELECT, INSERT ON public.spv_position_events TO authenticated;
GRANT ALL ON public.spv_position_events TO service_role;
ALTER TABLE public.spv_position_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spv_position_events_own_read" ON public.spv_position_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.spv_positions p WHERE p.id = position_id AND p.investor_user_id = auth.uid()));
CREATE POLICY "spv_position_events_staff_all" ON public.spv_position_events FOR ALL TO authenticated
  USING (public.is_geocapitals_staff(auth.uid())) WITH CHECK (public.is_geocapitals_staff(auth.uid()));

CREATE TABLE public.project_stage_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL,
  stage_key text NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  started_on date,
  completed_on date,
  evidence text,
  provenance text NOT NULL DEFAULT 'Declarado',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX project_stage_timeline_key ON public.project_stage_timeline (project_code, stage_key);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_stage_timeline TO authenticated;
GRANT ALL ON public.project_stage_timeline TO service_role;
ALTER TABLE public.project_stage_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stage_timeline_read_auth" ON public.project_stage_timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "stage_timeline_staff_write" ON public.project_stage_timeline FOR ALL TO authenticated
  USING (public.is_geocapitals_staff(auth.uid())) WITH CHECK (public.is_geocapitals_staff(auth.uid()));

CREATE TABLE public.project_operations_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL,
  period text NOT NULL,
  metric_key text NOT NULL,
  label text NOT NULL,
  value numeric,
  unit text,
  provenance text NOT NULL DEFAULT 'Declarado',
  source text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_operations_metrics_code_idx ON public.project_operations_metrics (project_code, period);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_operations_metrics TO authenticated;
GRANT ALL ON public.project_operations_metrics TO service_role;
ALTER TABLE public.project_operations_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops_metrics_read_auth" ON public.project_operations_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "ops_metrics_staff_write" ON public.project_operations_metrics FOR ALL TO authenticated
  USING (public.is_geocapitals_staff(auth.uid())) WITH CHECK (public.is_geocapitals_staff(auth.uid()));

CREATE TABLE public.project_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL,
  kind text NOT NULL,
  issuer text,
  number text,
  issued_on date,
  expires_on date,
  status text NOT NULL DEFAULT 'en_tramite',
  file_url text,
  provenance text NOT NULL DEFAULT 'Declarado',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_certifications_code_idx ON public.project_certifications (project_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_certifications TO authenticated;
GRANT ALL ON public.project_certifications TO service_role;
ALTER TABLE public.project_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_certifications_read_auth" ON public.project_certifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_certifications_staff_write" ON public.project_certifications FOR ALL TO authenticated
  USING (public.is_geocapitals_staff(auth.uid())) WITH CHECK (public.is_geocapitals_staff(auth.uid()));

CREATE TRIGGER spv_entities_set_updated_at BEFORE UPDATE ON public.spv_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER spv_positions_set_updated_at BEFORE UPDATE ON public.spv_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER project_stage_timeline_set_updated_at BEFORE UPDATE ON public.project_stage_timeline
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER project_certifications_set_updated_at BEFORE UPDATE ON public.project_certifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.spv_entities (project_code, legal_name, rut, total_shares, share_price, currency, notes)
VALUES ('CHOLQUI', 'Volcania Minerals SpA', NULL, 1000, NULL, 'CLP',
  'Sociedad titular declarada del Proyecto Cholqui. Acciones emitidas y valor por acción por confirmar con el estatuto social.');

INSERT INTO public.project_stage_timeline (project_code, stage_key, label, status, provenance, evidence, sort_order) VALUES
 ('CHOLQUI','exploracion','Exploración y mapeo geológico','done','Declarado','Prospecto Cholqui — 29 puntos de observación (Arcos / Leman)',1),
 ('CHOLQUI','muestreo','Muestreo de superficie certificado','done','Certificado','Informe de Ensayo AG2463714 — Andes Analytical Assay (P1–P3)',2),
 ('CHOLQUI','dominio','Acreditación de dominio y gravámenes','in_progress','A verificar','Certificados RFG: dominio, avalúos, gravámenes y embargo TGR',3),
 ('CHOLQUI','permisos','Permisos y habilitación de faena','pending','A verificar',NULL,4),
 ('CHOLQUI','produccion','Producción y entregas a ENAMI','pending','A verificar','Sin producción propia registrada',5);