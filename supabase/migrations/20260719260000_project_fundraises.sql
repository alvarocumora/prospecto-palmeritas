-- =========================================================
-- Levantamiento de capital por proyecto (project_fundraises).
--
-- Hasta ahora los términos económicos de la ronda (monto a levantar, ticket,
-- instrumento, uso de fondos, hitos, estructura de financiamiento) vivían
-- HARDCODEADOS en src/lib/investor/fichas.ts para 4 proyectos. Esta tabla los
-- vuelve datos reales, editables por el dueño del proyecto y por proyecto.
--
-- Una fila por proyecto (project_id único). RLS: miembros del proyecto leen;
-- owner/admin editan (se refina en la capa de server fn). El flag is_public y
-- el token de compartir alimentan la ficha pública (ronda siguiente).
-- =========================================================
CREATE TABLE IF NOT EXISTS public.project_fundraises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Ronda que se levanta.
  round_size_usd numeric,
  min_ticket_usd numeric,
  instrument text,                       -- equity | safe | convertible | option_nsr | jv_farmin | debt | other
  equity_offered_pct numeric,            -- % de la sociedad ofrecido por la ronda
  horizon_years numeric,

  -- Valorización referencial del activo.
  valuation_low_usd numeric,
  valuation_high_usd numeric,
  valuation_method text,

  -- Estructura y narrativa.
  financing_structure text,              -- opción, hitos no reembolsables, NSR, SPV… (texto)
  use_of_funds jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{label, pct}]
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,     -- [{when, what}]
  scenarios jsonb NOT NULL DEFAULT '[]'::jsonb,      -- [{key, label, multiple, note}]
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,     -- string[]
  notes text,

  status text NOT NULL DEFAULT 'draft',  -- draft | open | closed
  is_public boolean NOT NULL DEFAULT false,
  public_token_prefix text,
  public_token_hash text,

  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_fundraises_project
  ON public.project_fundraises(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_fundraises_public_token
  ON public.project_fundraises(public_token_hash) WHERE public_token_hash IS NOT NULL;

ALTER TABLE public.project_fundraises ENABLE ROW LEVEL SECURITY;

-- Miembros del proyecto ven; los cambios se hacen vía server fn (owner/admin).
DROP POLICY IF EXISTS "Members view fundraise" ON public.project_fundraises;
CREATE POLICY "Members view fundraise"
  ON public.project_fundraises FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members insert fundraise" ON public.project_fundraises;
CREATE POLICY "Members insert fundraise"
  ON public.project_fundraises FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Members update fundraise" ON public.project_fundraises;
CREATE POLICY "Members update fundraise"
  ON public.project_fundraises FOR UPDATE TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_project_fundraises_updated ON public.project_fundraises;
CREATE TRIGGER trg_project_fundraises_updated
  BEFORE UPDATE ON public.project_fundraises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
