ALTER TABLE public.investor_profiles
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS is_accredited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accreditation_basis text,
  ADD COLUMN IF NOT EXISTS risk_disclosure_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS nda_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS nda_signature_name text,
  ADD COLUMN IF NOT EXISTS nda_hash text,
  ADD COLUMN IF NOT EXISTS nda_version text;