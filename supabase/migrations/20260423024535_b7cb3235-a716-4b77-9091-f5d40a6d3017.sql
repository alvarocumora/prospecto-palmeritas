ALTER TABLE public.map_annotations
  ADD COLUMN IF NOT EXISTS target_id uuid REFERENCES public.exploration_targets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.exploration_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phase text;

CREATE INDEX IF NOT EXISTS idx_map_annotations_target ON public.map_annotations(target_id);
CREATE INDEX IF NOT EXISTS idx_map_annotations_campaign ON public.map_annotations(campaign_id);