-- Geo Copilot conversation history (per user, project, module)
CREATE TABLE public.geo_copilot_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nueva conversación',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_geo_copilot_conv_user_proj_mod
  ON public.geo_copilot_conversations (user_id, project_id, module, updated_at DESC);

ALTER TABLE public.geo_copilot_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own copilot conversations"
  ON public.geo_copilot_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own copilot conversations"
  ON public.geo_copilot_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own copilot conversations"
  ON public.geo_copilot_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own copilot conversations"
  ON public.geo_copilot_conversations FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_geo_copilot_conv_updated_at
  BEFORE UPDATE ON public.geo_copilot_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();