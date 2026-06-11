
-- ============================================================
-- 1. certifier_standards
-- ============================================================
DROP POLICY IF EXISTS cs_select ON public.certifier_standards;
DROP POLICY IF EXISTS cs_select_restricted ON public.certifier_standards;

CREATE POLICY cs_select_restricted ON public.certifier_standards
FOR SELECT TO authenticated
USING (
  qualified_person_id IN (SELECT id FROM public.qualified_persons WHERE user_id = auth.uid())
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.deal_certifier_assignments dca
    JOIN public.deals d ON d.id = dca.deal_id
    WHERE dca.qualified_person_id = certifier_standards.qualified_person_id
      AND public.has_project_role(d.project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[])
  )
);

-- ============================================================
-- 2. concession_holders
-- ============================================================
DO $$
DECLARE pol_name text;
BEGIN
  FOR pol_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='concession_holders' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.concession_holders', pol_name);
  END LOOP;
END $$;

CREATE POLICY concession_holders_select_privileged ON public.concession_holders
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_project_role(concession_holders.project_id, auth.uid(), ARRAY['owner','admin','project_manager']::project_role[])
);

-- ============================================================
-- 3. data_room_access_logs
-- ============================================================
DO $$
DECLARE pol_name text;
BEGIN
  FOR pol_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='data_room_access_logs' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.data_room_access_logs', pol_name);
  END LOOP;
END $$;

CREATE POLICY data_room_access_logs_select_admin ON public.data_room_access_logs
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.data_rooms dr
    WHERE dr.id = data_room_access_logs.data_room_id
      AND public.has_project_role(dr.project_id, auth.uid(), ARRAY['owner','admin']::project_role[])
  )
);

-- ============================================================
-- 4. document_signatures
-- ============================================================
DROP POLICY IF EXISTS sig_select ON public.document_signatures;
DROP POLICY IF EXISTS sig_select_privileged ON public.document_signatures;

CREATE POLICY sig_select_privileged ON public.document_signatures
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR signer_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.signature_envelopes se
    WHERE se.id = document_signatures.envelope_id
      AND public.has_project_role(se.project_id, auth.uid(), ARRAY['owner','admin','chief_geologist']::project_role[])
  )
);

-- ============================================================
-- 5. evidence_capture_audit
-- ============================================================
DO $$
DECLARE pol_name text;
BEGIN
  FOR pol_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='evidence_capture_audit' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.evidence_capture_audit', pol_name);
  END LOOP;
END $$;

CREATE POLICY evidence_capture_audit_select_admin ON public.evidence_capture_audit
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_project_role(evidence_capture_audit.project_id, auth.uid(), ARRAY['owner','admin']::project_role[])
);

-- ============================================================
-- 6. concession_files UPDATE
-- ============================================================
DO $$
DECLARE pol_name text;
BEGIN
  FOR pol_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='concession_files' AND cmd='UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.concession_files', pol_name);
  END LOOP;
END $$;

CREATE POLICY concession_files_update_restricted ON public.concession_files
FOR UPDATE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR public.has_project_role(concession_files.project_id, auth.uid(), ARRAY['owner','admin']::project_role[])
)
WITH CHECK (
  uploaded_by = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR public.has_project_role(concession_files.project_id, auth.uid(), ARRAY['owner','admin']::project_role[])
);

-- ============================================================
-- 7. Remove cadastre_sync_runs from Realtime publication
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='cadastre_sync_runs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.cadastre_sync_runs';
  END IF;
END $$;

-- ============================================================
-- 8. investor_profiles
-- ============================================================
DO $$
DECLARE pol_name text;
BEGIN
  FOR pol_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='investor_profiles' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.investor_profiles', pol_name);
  END LOOP;
END $$;

CREATE POLICY investor_profiles_select_admin ON public.investor_profiles
FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_my_investor_profile()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  company_name text,
  country text,
  investor_type text,
  ticket_min_usd numeric,
  ticket_max_usd numeric,
  commodities text[],
  accepted_standards text[],
  phone text,
  website text,
  notes text,
  review_status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, user_id, full_name, company_name, country, investor_type::text,
    ticket_min_usd, ticket_max_usd, commodities, accepted_standards,
    phone, website, notes, review_status::text, created_at, updated_at
  FROM public.investor_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_investor_profile() TO authenticated;

-- ============================================================
-- 9. term_sheet_shares
-- ============================================================
DO $$
DECLARE pol_name text;
BEGIN
  FOR pol_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='term_sheet_shares'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.term_sheet_shares', pol_name);
  END LOOP;
END $$;

CREATE POLICY term_sheet_shares_select_super ON public.term_sheet_shares
FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY term_sheet_shares_modify_admin ON public.term_sheet_shares
FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_project_role(term_sheet_shares.project_id, auth.uid(), ARRAY['owner','admin']::project_role[])
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.has_project_role(term_sheet_shares.project_id, auth.uid(), ARRAY['owner','admin']::project_role[])
);

CREATE OR REPLACE FUNCTION public.list_term_sheet_shares(_project_id uuid)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  slug text,
  label text,
  invitee_email text,
  expires_at timestamptz,
  revoked boolean,
  view_count integer,
  last_viewed_at timestamptz,
  max_uses integer,
  created_by uuid,
  created_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id, t.project_id, t.slug, t.label, t.invitee_email, t.expires_at,
    t.revoked, t.view_count, t.last_viewed_at, t.max_uses,
    t.created_by, t.created_at, t.revoked_at, t.revoked_by
  FROM public.term_sheet_shares t
  WHERE t.project_id = _project_id
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_project_role(t.project_id, auth.uid(), ARRAY['owner','admin']::project_role[])
    );
$$;

GRANT EXECUTE ON FUNCTION public.list_term_sheet_shares(uuid) TO authenticated;

-- ============================================================
-- 10. Storage policies for data-room-files
-- ============================================================
DROP POLICY IF EXISTS "Grantees read data room storage" ON storage.objects;
DROP POLICY IF EXISTS "Project members manage data room storage" ON storage.objects;

CREATE POLICY "Grantees read data room storage" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'data-room-files'
  AND EXISTS (
    SELECT 1
    FROM public.data_room_access_grants g
    JOIN public.data_rooms r ON r.id = g.data_room_id
    WHERE g.grantee_user_id = auth.uid()
      AND (g.expires_at IS NULL OR g.expires_at > now())
      AND g.revoked_at IS NULL
      AND (r.id)::text = (storage.foldername(objects.name))[1]
  )
);

CREATE POLICY "Project members manage data room storage" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'data-room-files'
  AND EXISTS (
    SELECT 1
    FROM public.data_rooms r
    WHERE (r.id)::text = (storage.foldername(objects.name))[1]
      AND public.is_project_member(r.project_id, auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'data-room-files'
  AND EXISTS (
    SELECT 1
    FROM public.data_rooms r
    WHERE (r.id)::text = (storage.foldername(objects.name))[1]
      AND public.is_project_member(r.project_id, auth.uid())
  )
);
