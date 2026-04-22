-- Storage bucket for concession files
INSERT INTO storage.buckets (id, name, public)
VALUES ('concession-files', 'concession-files', false)
ON CONFLICT (id) DO NOTHING;

-- Concession files table
CREATE TABLE public.concession_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  concession_id UUID NOT NULL REFERENCES public.mining_concessions(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'otros',
  description TEXT,
  size_bytes BIGINT,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_concession_files_concession ON public.concession_files(concession_id);
CREATE INDEX idx_concession_files_project ON public.concession_files(project_id);

ALTER TABLE public.concession_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members view concession files"
ON public.concession_files FOR SELECT
USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members upload concession files"
ON public.concession_files FOR INSERT
WITH CHECK (
  public.is_project_member(project_id, auth.uid())
  AND uploaded_by = auth.uid()
);

CREATE POLICY "Uploader or editor can delete concession files"
ON public.concession_files FOR DELETE
USING (
  uploaded_by = auth.uid()
  OR public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[])
);

CREATE POLICY "Uploader or editor can update concession files"
ON public.concession_files FOR UPDATE
USING (
  uploaded_by = auth.uid()
  OR public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin','project_manager','chief_geologist','geologist']::project_role[])
);

-- Storage policies for concession-files bucket
-- Path convention: {project_id}/{concession_id}/{uuid-filename}
CREATE POLICY "Project members view concession storage"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'concession-files'
  AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Project members upload concession storage"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'concession-files'
  AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Project members delete concession storage"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'concession-files'
  AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid())
);