
ALTER TABLE public.document_signatures
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_document_signatures_pending_reminder
  ON public.document_signatures (envelope_id, status)
  WHERE status = 'pending';
