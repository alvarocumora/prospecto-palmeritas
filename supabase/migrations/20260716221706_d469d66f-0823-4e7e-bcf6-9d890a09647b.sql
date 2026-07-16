CREATE TABLE IF NOT EXISTS public.document_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id text NOT NULL,
  reference text,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  clauses text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_drafts TO authenticated;
GRANT ALL ON public.document_drafts TO service_role;

ALTER TABLE public.document_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own document drafts" ON public.document_drafts;
CREATE POLICY "Users manage their own document drafts"
  ON public.document_drafts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS document_drafts_set_updated_at ON public.document_drafts;
CREATE TRIGGER document_drafts_set_updated_at
  BEFORE UPDATE ON public.document_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS document_drafts_user_idx ON public.document_drafts (user_id);
