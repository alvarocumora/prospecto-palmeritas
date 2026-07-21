
-- Enum de rol sugerido en la invitación
DO $$ BEGIN
  CREATE TYPE public.partner_invitation_role AS ENUM ('broker','investor','both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.partner_invitation_status AS ENUM ('pending','sent','opened','signed','accepted','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabla principal
CREATE TABLE IF NOT EXISTS public.partner_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  email text NOT NULL,
  full_name text,
  company text,
  suggested_role public.partner_invitation_role NOT NULL DEFAULT 'both',
  chosen_role public.partner_invitation_role,
  status public.partner_invitation_status NOT NULL DEFAULT 'pending',
  project_ids uuid[] NOT NULL DEFAULT '{}',
  trade_ids uuid[] NOT NULL DEFAULT '{}',
  ncnda_ref text,
  ncnda_pdf_url text,
  sent_at timestamptz,
  opened_at timestamptz,
  signed_at timestamptz,
  accepted_at timestamptz,
  accepted_user_id uuid,
  invited_by uuid NOT NULL DEFAULT auth.uid(),
  message text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_invitations_email ON public.partner_invitations (lower(email));
CREATE INDEX IF NOT EXISTS idx_partner_invitations_token ON public.partner_invitations (token);
CREATE INDEX IF NOT EXISTS idx_partner_invitations_status ON public.partner_invitations (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_invitations TO authenticated;
GRANT SELECT ON public.partner_invitations TO anon;
GRANT ALL ON public.partner_invitations TO service_role;

ALTER TABLE public.partner_invitations ENABLE ROW LEVEL SECURITY;

-- Admin: ve todo
CREATE POLICY "Admins manage partner invitations"
  ON public.partner_invitations FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Cualquiera (incluido anon) puede leer una invitación por token (para el wizard público).
-- El token es un secreto de 48 hex — actúa como capability.
CREATE POLICY "Public read by token"
  ON public.partner_invitations FOR SELECT
  TO anon, authenticated
  USING (true);

-- Update: solo admin (el wizard usa RPC SECURITY DEFINER)
CREATE POLICY "Admin update partner invitations"
  ON public.partner_invitations FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_partner_invitations_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS partner_invitations_touch ON public.partner_invitations;
CREATE TRIGGER partner_invitations_touch
  BEFORE UPDATE ON public.partner_invitations
  FOR EACH ROW EXECUTE FUNCTION public.tg_partner_invitations_touch();

-- Eventos (traza)
CREATE TABLE IF NOT EXISTS public.partner_invitation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.partner_invitations(id) ON DELETE CASCADE,
  event text NOT NULL, -- 'created','sent','opened','signed','accepted','resent','voided'
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_invitation_events_inv ON public.partner_invitation_events (invitation_id);

GRANT SELECT, INSERT ON public.partner_invitation_events TO authenticated;
GRANT ALL ON public.partner_invitation_events TO service_role;

ALTER TABLE public.partner_invitation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view invitation events"
  ON public.partner_invitation_events FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Service role writes events"
  ON public.partner_invitation_events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

-- RPC pública para aceptar una invitación (usada por el wizard sin auth de admin)
CREATE OR REPLACE FUNCTION public.accept_partner_invitation(
  _token text,
  _user_id uuid,
  _chosen_role public.partner_invitation_role,
  _full_name text DEFAULT NULL,
  _company text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.partner_invitations%ROWTYPE;
  pid uuid;
BEGIN
  SELECT * INTO inv FROM public.partner_invitations WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitación no encontrada'; END IF;
  IF inv.status = 'void' THEN RAISE EXCEPTION 'Invitación anulada'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'Invitación expirada'; END IF;

  UPDATE public.partner_invitations
    SET chosen_role = _chosen_role,
        full_name = COALESCE(_full_name, full_name),
        company = COALESCE(_company, company),
        accepted_user_id = _user_id,
        accepted_at = now(),
        status = 'accepted',
        signed_at = COALESCE(signed_at, now())
    WHERE id = inv.id;

  -- Agrega al usuario como viewer en cada proyecto autorizado
  IF inv.project_ids IS NOT NULL THEN
    FOREACH pid IN ARRAY inv.project_ids LOOP
      INSERT INTO public.project_members (project_id, user_id, role, invited_by)
      VALUES (pid, _user_id, 'viewer', inv.invited_by)
      ON CONFLICT (project_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Actualiza el tipo de cuenta en profiles según rol elegido
  UPDATE public.profiles
    SET account_type = CASE
      WHEN _chosen_role = 'broker' THEN 'geocapitals_team'::account_type
      WHEN _chosen_role = 'investor' THEN 'investor'::account_type
      ELSE 'investor'::account_type
    END,
    account_type_selected_at = COALESCE(account_type_selected_at, now())
    WHERE user_id = _user_id;

  INSERT INTO public.partner_invitation_events (invitation_id, event, metadata)
  VALUES (inv.id, 'accepted', jsonb_build_object('chosen_role', _chosen_role, 'user_id', _user_id));

  RETURN inv.id;
END $$;

GRANT EXECUTE ON FUNCTION public.accept_partner_invitation TO anon, authenticated;

-- RPC pública para marcar como "opened" (tracking pixel + primer view)
CREATE OR REPLACE FUNCTION public.mark_partner_invitation_opened(_token text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.partner_invitations
    SET opened_at = COALESCE(opened_at, now()),
        status = CASE WHEN status = 'sent' THEN 'opened' ELSE status END
    WHERE token = _token AND status <> 'accepted' AND status <> 'void';
END $$;

GRANT EXECUTE ON FUNCTION public.mark_partner_invitation_opened TO anon, authenticated;
