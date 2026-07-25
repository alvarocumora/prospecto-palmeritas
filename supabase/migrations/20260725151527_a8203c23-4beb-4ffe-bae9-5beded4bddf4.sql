
-- RLS para bucket supplier-docs
-- - Proveedor lee/escribe SOLO sus propios archivos (path empieza por su supplier_id)
-- - Staff (super_admin) lee todos y actualiza review

CREATE POLICY "supplier reads own docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-docs'
  AND EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.owner_user_id = auth.uid()
      AND (storage.foldername(name))[1] = s.id::text
  )
);

CREATE POLICY "supplier uploads own docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supplier-docs'
  AND EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.owner_user_id = auth.uid()
      AND (storage.foldername(name))[1] = s.id::text
  )
);

CREATE POLICY "staff reads all supplier docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-docs' AND public.is_super_admin(auth.uid())
);

-- Notas de revisión (staff -> proveedor)
CREATE TABLE IF NOT EXISTS public.supplier_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.supplier_offers(id) ON DELETE SET NULL,
  author_user_id uuid NOT NULL,
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','supplier')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.supplier_notes TO authenticated;
GRANT ALL ON public.supplier_notes TO service_role;
ALTER TABLE public.supplier_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manages notes"
ON public.supplier_notes FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "supplier reads visible notes"
ON public.supplier_notes FOR SELECT TO authenticated
USING (
  visibility = 'supplier'
  AND EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_notes.supplier_id AND s.owner_user_id = auth.uid()
  )
);

-- Extracciones IA por documento
CREATE TABLE IF NOT EXISTS public.supplier_doc_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.supplier_documents(id) ON DELETE CASCADE,
  model text NOT NULL,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_text text,
  confidence numeric(4,3),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.supplier_doc_extractions TO authenticated;
GRANT ALL ON public.supplier_doc_extractions TO service_role;
ALTER TABLE public.supplier_doc_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff reads extractions"
ON public.supplier_doc_extractions FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "supplier reads own extractions"
ON public.supplier_doc_extractions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.supplier_documents d
  JOIN public.suppliers s ON s.id = d.supplier_id
  WHERE d.id = supplier_doc_extractions.document_id AND s.owner_user_id = auth.uid()
));
