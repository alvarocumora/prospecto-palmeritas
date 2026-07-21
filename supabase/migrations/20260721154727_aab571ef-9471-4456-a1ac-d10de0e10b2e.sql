CREATE TABLE IF NOT EXISTS public.email_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('sent','delivered','opened','clicked','bounced','complained','failed')),
  recipient_email TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_delivery_events_message ON public.email_delivery_events(message_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_events_event ON public.email_delivery_events(event);
GRANT SELECT ON public.email_delivery_events TO authenticated;
GRANT ALL ON public.email_delivery_events TO service_role;
ALTER TABLE public.email_delivery_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read delivery events" ON public.email_delivery_events FOR SELECT TO authenticated USING (true);