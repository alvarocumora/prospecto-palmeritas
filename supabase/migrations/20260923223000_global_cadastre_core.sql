-- Global Cadastre Core v1 — canonical identity and project linkage.
-- Additive/idempotent: no legacy table or route is removed.

ALTER TABLE public.cadastre_national
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'CL',
  ADD COLUMN IF NOT EXISTS authority text,
  ADD COLUMN IF NOT EXISTS source_record_id text;

UPDATE public.cadastre_national
SET authority = COALESCE(authority, source, 'SERNAGEOMIN'),
    source_record_id = COALESCE(source_record_id, external_id)
WHERE authority IS NULL OR source_record_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_cadastre_national_country
  ON public.cadastre_national(country_code);
CREATE INDEX IF NOT EXISTS idx_cadastre_national_authority_record
  ON public.cadastre_national(country_code, authority, source_record_id);
CREATE INDEX IF NOT EXISTS idx_cadastre_national_holder
  ON public.cadastre_national(holder_name);

-- Avoid a hard UNIQUE until existing cloud drift/duplicates have been audited.
-- This index supports canonical lookups without rejecting legacy rows.

ALTER TABLE public.mining_concessions
  ADD COLUMN IF NOT EXISTS cadastre_national_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mining_concessions_cadastre_national_id_fkey'
      AND conrelid = 'public.mining_concessions'::regclass
  ) THEN
    ALTER TABLE public.mining_concessions
      ADD CONSTRAINT mining_concessions_cadastre_national_id_fkey
      FOREIGN KEY (cadastre_national_id)
      REFERENCES public.cadastre_national(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mining_concessions_cadastre_national_id
  ON public.mining_concessions(cadastre_national_id);

COMMENT ON COLUMN public.cadastre_national.country_code IS
  'ISO-like country code used by the GeoCapitals Global Cadastre Core.';
COMMENT ON COLUMN public.cadastre_national.authority IS
  'Official cadastral authority, e.g. SERNAGEOMIN, INGEMMET or ANM.';
COMMENT ON COLUMN public.cadastre_national.source_record_id IS
  'Stable identifier of the record at the official authority.';
COMMENT ON COLUMN public.mining_concessions.cadastre_national_id IS
  'Optional canonical link from a project-declared concession to the Global Cadastre record.';
