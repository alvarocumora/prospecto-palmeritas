-- Fix 1: qp-signatures bucket — restrict read to owner folder
DROP POLICY IF EXISTS "Authenticated read qp-signatures" ON storage.objects;
CREATE POLICY "Users read own qp-signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'qp-signatures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Fix 2: term_sheet_shares — remove SELECT from admin ALL policy
DROP POLICY IF EXISTS term_sheet_shares_modify_admin ON public.term_sheet_shares;

CREATE POLICY term_sheet_shares_insert_admin ON public.term_sheet_shares
FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role])
);

CREATE POLICY term_sheet_shares_update_admin ON public.term_sheet_shares
FOR UPDATE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role])
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role])
);

CREATE POLICY term_sheet_shares_delete_admin ON public.term_sheet_shares
FOR DELETE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_project_role(project_id, auth.uid(), ARRAY['owner'::project_role, 'admin'::project_role])
);
-- SELECT remains restricted to super_admin via existing term_sheet_shares_select_super;
-- project admins must use public.list_term_sheet_shares() which excludes passphrase_hash.