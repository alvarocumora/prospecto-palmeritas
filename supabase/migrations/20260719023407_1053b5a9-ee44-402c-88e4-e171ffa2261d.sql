
DROP POLICY IF EXISTS "cadastre_national_authenticated_read" ON public.cadastre_national;

CREATE POLICY "cadastre_national_super_admin_read"
ON public.cadastre_national
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "estudio-logos read" ON storage.objects;

CREATE POLICY "estudio-logos authenticated read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'estudio-logos');
