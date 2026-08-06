CREATE TABLE public.portal_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_otp_lookup ON public.portal_otp_challenges (token_hash, email, created_at DESC);

GRANT ALL ON public.portal_otp_challenges TO service_role;
ALTER TABLE public.portal_otp_challenges ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  session_hash text NOT NULL UNIQUE,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portal_sessions_token ON public.portal_sessions (token_hash);

GRANT ALL ON public.portal_sessions TO service_role;
ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;