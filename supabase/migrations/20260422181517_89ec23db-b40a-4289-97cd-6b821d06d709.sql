
-- 1. concession_holders
CREATE TABLE public.concession_holders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  rut text,
  holder_type text NOT NULL DEFAULT 'sociedad',
  legal_repr_name text,
  legal_repr_rut text,
  address text,
  commune text,
  region text,
  email text,
  phone text,
  website text,
  economic_activity text,
  incorporation_date date,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, rut)
);

CREATE INDEX idx_concession_holders_project ON public.concession_holders(project_id);
CREATE INDEX idx_concession_holders_name ON public.concession_holders(lower(name));
CREATE INDEX idx_concession_holders_rut ON public.concession_holders(rut) WHERE rut IS NOT NULL;

ALTER TABLE public.concession_holders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view concession_holders"
  ON public.concession_holders FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Managers insert concession_holders"
  ON public.concession_holders FOR INSERT TO authenticated
  WITH CHECK (
    has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role])
    AND auth.uid() = created_by
  );

CREATE POLICY "Managers update concession_holders"
  ON public.concession_holders FOR UPDATE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role]));

CREATE POLICY "Admins delete concession_holders"
  ON public.concession_holders FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role]));

CREATE TRIGGER trg_concession_holders_updated
  BEFORE UPDATE ON public.concession_holders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Extend mining_concessions
ALTER TABLE public.mining_concessions
  ADD COLUMN IF NOT EXISTS holder_id uuid REFERENCES public.concession_holders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mining_concessions_holder_id ON public.mining_concessions(holder_id);

-- 3. holder_files
CREATE TABLE public.holder_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_id uuid NOT NULL REFERENCES public.concession_holders(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'otros',
  description text,
  size_bytes bigint,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_holder_files_holder ON public.holder_files(holder_id);
CREATE INDEX idx_holder_files_project ON public.holder_files(project_id);

ALTER TABLE public.holder_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view holder_files"
  ON public.holder_files FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Members insert holder_files"
  ON public.holder_files FOR INSERT TO authenticated
  WITH CHECK (is_project_member(project_id, auth.uid()) AND auth.uid() = uploaded_by);

CREATE POLICY "Managers delete holder_files"
  ON public.holder_files FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role]));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('holder-files', 'holder-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Project members view holder-files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'holder-files'
    AND EXISTS (
      SELECT 1 FROM public.holder_files hf
      WHERE hf.file_path = storage.objects.name
        AND is_project_member(hf.project_id, auth.uid())
    )
  );

CREATE POLICY "Project members upload holder-files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'holder-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Project managers delete holder-files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'holder-files'
    AND EXISTS (
      SELECT 1 FROM public.holder_files hf
      WHERE hf.file_path = storage.objects.name
        AND has_project_role(hf.project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role])
    )
  );

-- 4. holder_links
CREATE TABLE public.holder_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_id uuid NOT NULL REFERENCES public.concession_holders(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  link_type text NOT NULL,
  bulletin_id uuid REFERENCES public.mining_bulletins(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.mining_court_cases(id) ON DELETE CASCADE,
  external_url text,
  label text,
  notes text,
  auto_matched boolean NOT NULL DEFAULT false,
  linked_by uuid,
  linked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT holder_links_one_target CHECK (
    (link_type = 'bulletin' AND bulletin_id IS NOT NULL) OR
    (link_type = 'court_case' AND case_id IS NOT NULL) OR
    (link_type = 'external_url' AND external_url IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uniq_holder_links_bulletin ON public.holder_links(holder_id, bulletin_id) WHERE bulletin_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_holder_links_case ON public.holder_links(holder_id, case_id) WHERE case_id IS NOT NULL;
CREATE INDEX idx_holder_links_holder ON public.holder_links(holder_id);
CREATE INDEX idx_holder_links_project ON public.holder_links(project_id);

ALTER TABLE public.holder_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view holder_links"
  ON public.holder_links FOR SELECT TO authenticated
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Members insert holder_links"
  ON public.holder_links FOR INSERT TO authenticated
  WITH CHECK (is_project_member(project_id, auth.uid()));

CREATE POLICY "Managers delete holder_links"
  ON public.holder_links FOR DELETE TO authenticated
  USING (has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role,'admin'::project_role,'project_manager'::project_role]));

-- 5. Auto-matching function
CREATE OR REPLACE FUNCTION public.normalize_rut(_rut text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(coalesce(_rut, ''), '[\.\s]', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.match_holder_publications(_holder_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h record;
  inserted_count integer := 0;
  rut_norm text;
BEGIN
  SELECT * INTO h FROM public.concession_holders WHERE id = _holder_id;
  IF h.id IS NULL THEN RETURN 0; END IF;
  rut_norm := public.normalize_rut(h.rut);

  -- Bulletin matches
  WITH ins AS (
    INSERT INTO public.holder_links (holder_id, project_id, link_type, bulletin_id, auto_matched)
    SELECT h.id, h.project_id, 'bulletin', b.id, true
    FROM public.mining_bulletins b
    WHERE
      (rut_norm <> '' AND public.normalize_rut(b.holder_rut) = rut_norm)
      OR (h.name IS NOT NULL AND b.holder_name ILIKE '%' || h.name || '%')
    ON CONFLICT (holder_id, bulletin_id) WHERE bulletin_id IS NOT NULL DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO inserted_count FROM ins;

  -- Court case matches
  WITH ins AS (
    INSERT INTO public.holder_links (holder_id, project_id, link_type, case_id, auto_matched)
    SELECT h.id, h.project_id, 'court_case', c.id, true
    FROM public.mining_court_cases c
    WHERE
      (rut_norm <> '' AND public.normalize_rut(c.defendant_rut) = rut_norm)
      OR (h.name IS NOT NULL AND c.defendant ILIKE '%' || h.name || '%')
    ON CONFLICT (holder_id, case_id) WHERE case_id IS NOT NULL DO NOTHING
    RETURNING 1
  )
  SELECT inserted_count + count(*) INTO inserted_count FROM ins;

  RETURN inserted_count;
END;
$$;

-- Trigger on holder insert/update
CREATE OR REPLACE FUNCTION public.trg_match_holder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.match_holder_publications(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_concession_holders_match
  AFTER INSERT OR UPDATE OF name, rut ON public.concession_holders
  FOR EACH ROW EXECUTE FUNCTION public.trg_match_holder();

-- Trigger on new bulletin: try matching all holders
CREATE OR REPLACE FUNCTION public.trg_match_bulletin_holders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rut_norm text;
BEGIN
  rut_norm := public.normalize_rut(NEW.holder_rut);
  INSERT INTO public.holder_links (holder_id, project_id, link_type, bulletin_id, auto_matched)
  SELECT h.id, h.project_id, 'bulletin', NEW.id, true
  FROM public.concession_holders h
  WHERE
    (rut_norm <> '' AND public.normalize_rut(h.rut) = rut_norm)
    OR (NEW.holder_name IS NOT NULL AND NEW.holder_name ILIKE '%' || h.name || '%')
  ON CONFLICT (holder_id, bulletin_id) WHERE bulletin_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mining_bulletins_match
  AFTER INSERT ON public.mining_bulletins
  FOR EACH ROW EXECUTE FUNCTION public.trg_match_bulletin_holders();

-- Trigger on new court case
CREATE OR REPLACE FUNCTION public.trg_match_case_holders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rut_norm text;
BEGIN
  rut_norm := public.normalize_rut(NEW.defendant_rut);
  INSERT INTO public.holder_links (holder_id, project_id, link_type, case_id, auto_matched)
  SELECT h.id, h.project_id, 'court_case', NEW.id, true
  FROM public.concession_holders h
  WHERE
    (rut_norm <> '' AND public.normalize_rut(h.rut) = rut_norm)
    OR (NEW.defendant IS NOT NULL AND NEW.defendant ILIKE '%' || h.name || '%')
  ON CONFLICT (holder_id, case_id) WHERE case_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mining_court_cases_match
  AFTER INSERT ON public.mining_court_cases
  FOR EACH ROW EXECUTE FUNCTION public.trg_match_case_holders();
