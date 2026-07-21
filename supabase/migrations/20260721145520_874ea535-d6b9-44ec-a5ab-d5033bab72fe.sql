-- El bucket email-attachments se creó vía tool y ya nace privado.
-- Blindamos storage.objects para que solo service_role tenga acceso.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'email_attachments_service_only'
  ) THEN
    CREATE POLICY "email_attachments_service_only"
      ON storage.objects
      FOR ALL
      TO service_role
      USING (bucket_id = 'email-attachments')
      WITH CHECK (bucket_id = 'email-attachments');
  END IF;
END $$;