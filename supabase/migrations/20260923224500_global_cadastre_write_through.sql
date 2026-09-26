-- Global Cadastre write-through identity.
-- Required by DB-first + official-source fallback in Global Cadastre Core.
-- Audit duplicates first, then enforce one current SERNAGEOMIN record per source id.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='uq_cadastre_national_source_external_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.cadastre_national
      WHERE archived_at IS NULL
      GROUP BY source, external_id
      HAVING count(*) > 1
    ) THEN
      CREATE UNIQUE INDEX uq_cadastre_national_source_external_id
        ON public.cadastre_national(source, external_id)
        WHERE archived_at IS NULL;
    ELSE
      RAISE NOTICE 'Global Cadastre: duplicate current source/external_id rows found; unique index deferred.';
    END IF;
  END IF;
END $$;

COMMENT ON TABLE public.cadastre_national IS
  'GeoCapitals canonical Global Cadastre store. Public, project and intelligence surfaces read this store before official-source fallback.';
