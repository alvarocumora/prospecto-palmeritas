
-- Storage RLS for operation-docs bucket
-- Path convention: {operation_id}/{role}/{filename}

DROP POLICY IF EXISTS "opdocs_gc_all" ON storage.objects;
CREATE POLICY "opdocs_gc_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'operation-docs' AND public.is_gc_staff(auth.uid()))
  WITH CHECK (bucket_id = 'operation-docs' AND public.is_gc_staff(auth.uid()));

DROP POLICY IF EXISTS "opdocs_participant_upload" ON storage.objects;
CREATE POLICY "opdocs_participant_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'operation-docs'
    AND public.is_operation_participant(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  );

DROP POLICY IF EXISTS "opdocs_participant_read" ON storage.objects;
CREATE POLICY "opdocs_participant_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'operation-docs'
    AND public.is_operation_participant(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  );
