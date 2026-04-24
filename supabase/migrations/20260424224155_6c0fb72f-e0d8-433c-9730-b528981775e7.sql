-- Enum de estándares
DO $$ BEGIN
  CREATE TYPE public.compliance_standard AS ENUM ('ni43101','jorc2012','samrec','perc','gkz');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TABLA: compliance_rules ============
CREATE TABLE IF NOT EXISTS public.compliance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard public.compliance_standard NOT NULL,
  rule_code text NOT NULL,
  section_no integer,
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'mandatory',
  evaluator_type text NOT NULL DEFAULT 'manual',
  evaluator_config jsonb DEFAULT '{}'::jsonb,
  reference_url text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (standard, rule_code)
);

ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read compliance_rules" ON public.compliance_rules;
CREATE POLICY "Authenticated can read compliance_rules"
ON public.compliance_rules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super admin manages compliance_rules" ON public.compliance_rules;
CREATE POLICY "Super admin manages compliance_rules"
ON public.compliance_rules FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_compliance_rules_updated ON public.compliance_rules;
CREATE TRIGGER trg_compliance_rules_updated
BEFORE UPDATE ON public.compliance_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_compliance_rules_standard ON public.compliance_rules(standard, display_order);

-- ============ TABLA: compliance_evaluations ============
CREATE TABLE IF NOT EXISTS public.compliance_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.technical_reports(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.compliance_rules(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  score integer,
  auto_evaluated boolean NOT NULL DEFAULT false,
  evaluator_notes text,
  evaluated_at timestamptz,
  evaluated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, rule_id)
);

ALTER TABLE public.compliance_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read compliance_evaluations" ON public.compliance_evaluations;
CREATE POLICY "Members read compliance_evaluations"
ON public.compliance_evaluations FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Editors manage compliance_evaluations" ON public.compliance_evaluations;
CREATE POLICY "Editors manage compliance_evaluations"
ON public.compliance_evaluations FOR ALL TO authenticated
USING (
  public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist','qaqc_officer']::project_role[])
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist','qaqc_officer']::project_role[])
  OR public.is_super_admin(auth.uid())
);

DROP TRIGGER IF EXISTS trg_compliance_evaluations_updated ON public.compliance_evaluations;
CREATE TRIGGER trg_compliance_evaluations_updated
BEFORE UPDATE ON public.compliance_evaluations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_compliance_eval_report ON public.compliance_evaluations(report_id);
CREATE INDEX IF NOT EXISTS idx_compliance_eval_project ON public.compliance_evaluations(project_id);

-- Validador
CREATE OR REPLACE FUNCTION public.validate_compliance_evaluation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pass','warn','fail','na','pending') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.score IS NOT NULL AND (NEW.score < 0 OR NEW.score > 100) THEN
    RAISE EXCEPTION 'score must be 0..100';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_compliance_evaluation ON public.compliance_evaluations;
CREATE TRIGGER trg_validate_compliance_evaluation
BEFORE INSERT OR UPDATE ON public.compliance_evaluations
FOR EACH ROW EXECUTE FUNCTION public.validate_compliance_evaluation();

-- ============ TABLA: report_evidence_links ============
CREATE TABLE IF NOT EXISTS public.report_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.technical_reports(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.compliance_rules(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  evidence_id uuid,
  url text,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

ALTER TABLE public.report_evidence_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read evidence_links" ON public.report_evidence_links;
CREATE POLICY "Members read evidence_links"
ON public.report_evidence_links FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Editors manage evidence_links" ON public.report_evidence_links;
CREATE POLICY "Editors manage evidence_links"
ON public.report_evidence_links FOR ALL TO authenticated
USING (
  public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist','qaqc_officer']::project_role[])
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist','qaqc_officer']::project_role[])
  OR public.is_super_admin(auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_evidence_report ON public.report_evidence_links(report_id);
CREATE INDEX IF NOT EXISTS idx_evidence_rule ON public.report_evidence_links(rule_id);

-- ============ EXTIENDE technical_reports ============
ALTER TABLE public.technical_reports
  ADD COLUMN IF NOT EXISTS active_standards public.compliance_standard[] NOT NULL DEFAULT ARRAY['ni43101']::public.compliance_standard[],
  ADD COLUMN IF NOT EXISTS compliance_threshold integer NOT NULL DEFAULT 95,
  ADD COLUMN IF NOT EXISTS compliance_score_cached integer,
  ADD COLUMN IF NOT EXISTS compliance_evaluated_at timestamptz;

-- ============ SEED: NI 43-101 (Form 43-101F1, 27 secciones) ============
INSERT INTO public.compliance_rules (standard, rule_code, section_no, title, description, severity, evaluator_type, display_order) VALUES
('ni43101','43101-S1',1,'Title Page','Title page with project name, commodity, location, QP names, effective date and report date.','mandatory','auto_field',1),
('ni43101','43101-S2',2,'Table of Contents','Table of contents with sections, sub-sections, tables, figures and appendices.','mandatory','manual',2),
('ni43101','43101-S3',3,'Summary','Plain-language executive summary covering all material items of the report.','mandatory','manual',3),
('ni43101','43101-S4',4,'Introduction','Issuer, purpose, terms of reference, sources of information, prior involvement of QPs.','mandatory','manual',4),
('ni43101','43101-S5',5,'Reliance on Other Experts','Disclaimer of QP reliance on legal, environmental, marketing or political expertise from third parties.','mandatory','manual',5),
('ni43101','43101-S6',6,'Property Description and Location','Area, location, mineral tenure, royalties, agreements, environmental liabilities, permits.','mandatory','auto_evidence',6),
('ni43101','43101-S7',7,'Accessibility, Climate, Local Resources, Infrastructure and Physiography','Topography, elevation, vegetation, access, climate, operating season, infrastructure, water, power.','mandatory','manual',7),
('ni43101','43101-S8',8,'History','Prior ownership, exploration, drilling, production, historical resource estimates.','mandatory','manual',8),
('ni43101','43101-S9',9,'Geological Setting and Mineralization','Regional, local and property geology; mineralization styles, dimensions, grade.','mandatory','auto_evidence',9),
('ni43101','43101-S10',10,'Deposit Types','Conceptual model and analogue deposits being explored for or being delineated.','mandatory','manual',10),
('ni43101','43101-S11',11,'Exploration','Exploration work (other than drilling) by issuer, surveys, sampling and results.','mandatory','auto_count',11),
('ni43101','43101-S12',12,'Drilling','Type and extent of drilling, procedures, recovery, sample length, location, orientation, results.','mandatory','auto_count',12),
('ni43101','43101-S13',13,'Sample Preparation, Analyses and Security','Sample method, prep, security, lab info, accreditation, QA/QC, QP opinion on adequacy.','mandatory','auto_evidence',13),
('ni43101','43101-S14',14,'Data Verification','QP data verification procedures, limitations, opinion on data adequacy.','mandatory','manual',14),
('ni43101','43101-S15',15,'Mineral Processing and Metallurgical Testing','Nature, extent and results of metallurgical testing; basis for assumptions.','mandatory','manual',15),
('ni43101','43101-S16',16,'Mineral Resource Estimates','Key assumptions, parameters and methods; classification (Inferred/Indicated/Measured); QP opinion on risks.','mandatory','manual',16),
('ni43101','43101-S17',17,'Mineral Reserve Estimates','Key assumptions, methods, modifying factors, classification (Probable/Proven). Required if reporting reserves.','conditional','manual',17),
('ni43101','43101-S18',18,'Mining Methods','Geotechnical, hydrological, mining method, equipment, production rate, schedule.','conditional','manual',18),
('ni43101','43101-S19',19,'Recovery Methods','Process flowsheet, plant design, throughput, recoveries, requirements.','conditional','manual',19),
('ni43101','43101-S20',20,'Project Infrastructure','Roads, rail, port, power, water, tailings, accommodation.','conditional','manual',20),
('ni43101','43101-S21',21,'Market Studies and Contracts','Markets, commodity price assumptions, contracts in place or required.','conditional','manual',21),
('ni43101','43101-S22',22,'Environmental Studies, Permitting and Social or Community Impact','Baseline, impact, permits, mine closure, social agreements, community plans.','mandatory','auto_evidence',22),
('ni43101','43101-S23',23,'Capital and Operating Costs','Capex/opex breakdown with accuracy and basis. Required for PEA/PFS/FS.','conditional','manual',23),
('ni43101','43101-S24',24,'Economic Analysis','Cash flow forecasts, NPV, IRR, payback, sensitivity. Required for PEA/PFS/FS.','conditional','manual',24),
('ni43101','43101-S25',25,'Adjacent Properties','Relevant information on adjacent properties verified by the QP.','recommended','manual',25),
('ni43101','43101-S26',26,'Other Relevant Data and Information','Additional information necessary to make the report not misleading.','recommended','manual',26),
('ni43101','43101-S27',27,'Interpretation and Conclusions','QP interpretation, conclusions, risks, uncertainties, recommendations with budget.','mandatory','manual',27)
ON CONFLICT (standard, rule_code) DO NOTHING;