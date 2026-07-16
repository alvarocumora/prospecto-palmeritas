-- =========================================================
-- api_keys: llaves de acceso al API público de Geocapitals
-- (data-as-a-product: catastro unificado multi-país).
--
-- La llave completa se muestra UNA sola vez al crearla; en la
-- base solo se guarda su hash SHA-256 (key_hash) y un prefijo
-- para mostrar (key_prefix). Cuota mensual por plan controlada
-- en la app (monthly_count + month_key).
-- =========================================================
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'default',
  key_prefix text NOT NULL,              -- ej. "gc_live_a1b2" (solo display)
  key_hash text NOT NULL UNIQUE,         -- sha256 hex de la llave completa
  plan text NOT NULL DEFAULT 'free',     -- free | pro | enterprise
  is_active boolean NOT NULL DEFAULT true,
  monthly_count integer NOT NULL DEFAULT 0,
  month_key text,                        -- "YYYY-MM" del contador vigente
  requests_total integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash) WHERE is_active;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- El dueño gestiona sus llaves; la validación del API usa service_role (bypassa RLS).
CREATE POLICY "Owner views own api keys"
  ON public.api_keys FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owner creates own api keys"
  ON public.api_keys FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner updates own api keys"
  ON public.api_keys FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_api_keys_updated
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
