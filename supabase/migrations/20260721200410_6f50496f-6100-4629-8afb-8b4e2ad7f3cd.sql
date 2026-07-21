
-- Revocación manual del link compartido
ALTER TABLE public.sourcing_submissions
  ADD COLUMN IF NOT EXISTS share_token_revoked_at timestamptz;

-- Log de visitas al QR / link público
CREATE TABLE IF NOT EXISTS public.sourcing_share_token_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.sourcing_submissions(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.sourcing_requests(id) ON DELETE CASCADE,
  ip_hash text,
  ua_hash text,
  referer text,
  outcome text NOT NULL DEFAULT 'valid',  -- valid | revoked | not_found | invalid_format
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sourcing_share_token_views_submission_idx
  ON public.sourcing_share_token_views(submission_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS sourcing_share_token_views_request_idx
  ON public.sourcing_share_token_views(request_id, viewed_at DESC);

GRANT SELECT ON public.sourcing_share_token_views TO authenticated;
GRANT ALL ON public.sourcing_share_token_views TO service_role;

ALTER TABLE public.sourcing_share_token_views ENABLE ROW LEVEL SECURITY;

-- El dueño del requerimiento ve las visitas de sus fichas
DROP POLICY IF EXISTS "owner reads share views" ON public.sourcing_share_token_views;
CREATE POLICY "owner reads share views" ON public.sourcing_share_token_views
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sourcing_requests r
    WHERE r.id = sourcing_share_token_views.request_id
      AND r.owner_user_id = auth.uid()
  ));
