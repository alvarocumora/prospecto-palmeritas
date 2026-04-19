-- Tabla de presupuestos por campaña
CREATE TABLE public.campaign_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.exploration_campaigns(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  planned_amount_usd NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, category)
);

-- Tabla de gastos reales
CREATE TABLE public.campaign_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.exploration_campaigns(id) ON DELETE CASCADE,
  hole_id UUID REFERENCES public.drill_holes(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_usd NUMERIC NOT NULL DEFAULT 0,
  meters_drilled NUMERIC,
  vendor TEXT,
  invoice_number TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validación de categorías y estados
CREATE OR REPLACE FUNCTION public.validate_campaign_finance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.category NOT IN ('drilling','geophysics','geochemistry','drones','logistics','lab','permits','salaries','equipment','other') THEN
    RAISE EXCEPTION 'Invalid category: %', NEW.category;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_budget
  BEFORE INSERT OR UPDATE ON public.campaign_budgets
  FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_finance();

CREATE OR REPLACE FUNCTION public.validate_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.category NOT IN ('drilling','geophysics','geochemistry','drones','logistics','lab','permits','salaries','equipment','other') THEN
    RAISE EXCEPTION 'Invalid category: %', NEW.category;
  END IF;
  IF NEW.status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.amount_usd < 0 THEN
    RAISE EXCEPTION 'amount_usd must be >= 0';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_expense
  BEFORE INSERT OR UPDATE ON public.campaign_expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_expense();

-- Triggers de updated_at
CREATE TRIGGER trg_budgets_updated
  BEFORE UPDATE ON public.campaign_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_expenses_updated
  BEFORE UPDATE ON public.campaign_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX idx_budgets_campaign ON public.campaign_budgets(campaign_id);
CREATE INDEX idx_expenses_campaign ON public.campaign_expenses(campaign_id);
CREATE INDEX idx_expenses_hole ON public.campaign_expenses(hole_id);
CREATE INDEX idx_expenses_date ON public.campaign_expenses(expense_date DESC);

-- RLS
ALTER TABLE public.campaign_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_expenses ENABLE ROW LEVEL SECURITY;

-- campaign_budgets policies
CREATE POLICY "Members view budgets"
  ON public.campaign_budgets FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Managers insert budgets"
  ON public.campaign_budgets FOR INSERT TO authenticated
  WITH CHECK (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[])
    AND auth.uid() = created_by
  );

CREATE POLICY "Managers update budgets"
  ON public.campaign_budgets FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[]));

CREATE POLICY "Admins delete budgets"
  ON public.campaign_budgets FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[]));

-- campaign_expenses policies
CREATE POLICY "Members view expenses"
  ON public.campaign_expenses FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Managers insert expenses"
  ON public.campaign_expenses FOR INSERT TO authenticated
  WITH CHECK (
    has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist']::project_role[])
    AND auth.uid() = created_by
  );

CREATE POLICY "Managers update expenses"
  ON public.campaign_expenses FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[]));

CREATE POLICY "Admins delete expenses"
  ON public.campaign_expenses FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner','admin']::project_role[]));