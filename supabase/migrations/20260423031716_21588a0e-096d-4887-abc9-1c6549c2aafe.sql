ALTER TABLE public.map_annotations
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS resolved_reason text,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

CREATE OR REPLACE FUNCTION public.validate_map_annotation_priority()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.priority NOT IN ('low','medium','high') THEN
    RAISE EXCEPTION 'Invalid priority: %', NEW.priority;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS map_annotations_validate_priority ON public.map_annotations;
CREATE TRIGGER map_annotations_validate_priority
  BEFORE INSERT OR UPDATE ON public.map_annotations
  FOR EACH ROW EXECUTE FUNCTION public.validate_map_annotation_priority();