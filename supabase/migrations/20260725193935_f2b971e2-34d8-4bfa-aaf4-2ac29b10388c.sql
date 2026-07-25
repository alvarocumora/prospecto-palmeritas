
-- ENUMS
DO $$ BEGIN CREATE TYPE public.operation_status AS ENUM (
  'draft','counterparties_invited','nda_in_progress','doc_collection','kyc_review','due_diligence',
  'technical_eval','commercial_eval','negotiation','contract','financial_instrument','logistics',
  'in_transit','completed','suspended','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.op_buyer_status AS ENUM (
  'not_invited','invitation_sent','access_created','nda_pending','profile_incomplete','kyc_incomplete',
  'under_review','observed','approved','suspended','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.op_seller_status AS ENUM (
  'not_invited','invitation_sent','access_created','nda_pending','docs_incomplete','under_review',
  'observed','due_diligence','prequalified','approved','suspended','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.op_participant_role AS ENUM ('buyer','seller','geocapitals');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.op_invitation_status AS ENUM ('pending','accepted','revoked','expired');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.op_doc_visibility AS ENUM ('internal','buyer_shared','seller_shared','all_parties','custom');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.op_message_channel AS ENUM ('buyer_gc','seller_gc','tripartite','internal');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.op_task_status AS ENUM ('pending','in_progress','answered','under_review','completed','overdue');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: staff GC (super_admin o support)
CREATE OR REPLACE FUNCTION public.is_gc_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_roles
    WHERE user_id = _user_id AND role IN ('super_admin'::app_role,'support'::app_role)
  );
$$;

-- OPERATIONS
CREATE TABLE IF NOT EXISTS public.operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  commodity TEXT NOT NULL,
  subproduct TEXT,
  quantity_monthly NUMERIC,
  quantity_total NUMERIC,
  unit TEXT DEFAULT 'MT',
  tech_spec JSONB DEFAULT '{}'::jsonb,
  origin_country TEXT,
  destination_country TEXT,
  destination_port TEXT,
  incoterm TEXT,
  duration_months INTEGER,
  target_price_usd NUMERIC,
  priority TEXT DEFAULT 'normal',
  status public.operation_status NOT NULL DEFAULT 'draft',
  buyer_status public.op_buyer_status NOT NULL DEFAULT 'not_invited',
  seller_status public.op_seller_status NOT NULL DEFAULT 'not_invited',
  buyer_name TEXT, buyer_company TEXT, buyer_email TEXT, buyer_phone TEXT,
  seller_name TEXT, seller_company TEXT, seller_email TEXT, seller_phone TEXT,
  responsible_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_trade_id UUID REFERENCES public.commodity_trades(id) ON DELETE SET NULL,
  internal_notes TEXT,
  commission_pct NUMERIC,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operations_status ON public.operations(status);
CREATE INDEX IF NOT EXISTS idx_operations_created_by ON public.operations(created_by);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operations TO authenticated;
GRANT ALL ON public.operations TO service_role;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;

-- PARTICIPANTS
CREATE TABLE IF NOT EXISTS public.operation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  role public.op_participant_role NOT NULL,
  email TEXT,
  full_name TEXT,
  access_status TEXT DEFAULT 'active',
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  last_access_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(operation_id, user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_op_participants_user ON public.operation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_op_participants_op ON public.operation_participants(operation_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operation_participants TO authenticated;
GRANT ALL ON public.operation_participants TO service_role;
ALTER TABLE public.operation_participants ENABLE ROW LEVEL SECURITY;

-- Helper participant check
CREATE OR REPLACE FUNCTION public.is_operation_participant(_op_id UUID, _user_id UUID, _role public.op_participant_role DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.operation_participants
    WHERE operation_id = _op_id AND user_id = _user_id
      AND (_role IS NULL OR role = _role)
      AND COALESCE(access_status,'active') = 'active'
  );
$$;

-- INVITATIONS
CREATE TABLE IF NOT EXISTS public.operation_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  participant_type public.op_participant_role NOT NULL,
  invited_email TEXT NOT NULL,
  invited_name TEXT,
  secure_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32),'base64'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.op_invitation_status NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_op_inv_token ON public.operation_invitations(secure_token);
CREATE INDEX IF NOT EXISTS idx_op_inv_op ON public.operation_invitations(operation_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operation_invitations TO authenticated;
GRANT ALL ON public.operation_invitations TO service_role;
ALTER TABLE public.operation_invitations ENABLE ROW LEVEL SECURITY;

-- DOCUMENTS
CREATE TABLE IF NOT EXISTS public.operation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  parent_document_id UUID REFERENCES public.operation_documents(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  storage_bucket TEXT NOT NULL DEFAULT 'operation-docs',
  storage_path TEXT,
  file_size BIGINT,
  content_type TEXT,
  sha256 TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  visibility public.op_doc_visibility NOT NULL DEFAULT 'internal',
  uploaded_by_role public.op_participant_role NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_status TEXT DEFAULT 'pending',
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  is_frozen BOOLEAN NOT NULL DEFAULT false,
  frozen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_op_docs_op ON public.operation_documents(operation_id);
CREATE INDEX IF NOT EXISTS idx_op_docs_visibility ON public.operation_documents(visibility);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operation_documents TO authenticated;
GRANT ALL ON public.operation_documents TO service_role;
ALTER TABLE public.operation_documents ENABLE ROW LEVEL SECURITY;

-- TASKS
CREATE TABLE IF NOT EXISTS public.operation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_role public.op_participant_role NOT NULL,
  related_document_id UUID REFERENCES public.operation_documents(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE,
  status public.op_task_status NOT NULL DEFAULT 'pending',
  assigned_internal_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_op_tasks_op ON public.operation_tasks(operation_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operation_tasks TO authenticated;
GRANT ALL ON public.operation_tasks TO service_role;
ALTER TABLE public.operation_tasks ENABLE ROW LEVEL SECURITY;

-- MESSAGES
CREATE TABLE IF NOT EXISTS public.operation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  channel public.op_message_channel NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role public.op_participant_role NOT NULL,
  body TEXT NOT NULL,
  attachment_document_id UUID REFERENCES public.operation_documents(id) ON DELETE SET NULL,
  read_by JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_op_messages_op ON public.operation_messages(operation_id, channel);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operation_messages TO authenticated;
GRANT ALL ON public.operation_messages TO service_role;
ALTER TABLE public.operation_messages ENABLE ROW LEVEL SECURITY;

-- ACCESS LOGS
CREATE TABLE IF NOT EXISTS public.operation_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role public.op_participant_role,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_op_access_logs_op ON public.operation_access_logs(operation_id, created_at DESC);
GRANT SELECT, INSERT ON public.operation_access_logs TO authenticated;
GRANT ALL ON public.operation_access_logs TO service_role;
ALTER TABLE public.operation_access_logs ENABLE ROW LEVEL SECURITY;

-- STATUS HISTORY
CREATE TABLE IF NOT EXISTS public.operation_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.operation_status_history TO authenticated;
GRANT ALL ON public.operation_status_history TO service_role;
ALTER TABLE public.operation_status_history ENABLE ROW LEVEL SECURITY;

-- Code generator
CREATE OR REPLACE FUNCTION public.op_generate_code(_commodity TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE prefix TEXT; seq INTEGER;
BEGIN
  prefix := UPPER(SUBSTRING(regexp_replace(COALESCE(_commodity,'OP'),'[^A-Za-z]','','g') FROM 1 FOR 2));
  IF LENGTH(prefix) < 2 THEN prefix := 'OP'; END IF;
  SELECT COUNT(*) + 1 INTO seq FROM public.operations WHERE code LIKE 'GC-' || prefix || '-%';
  RETURN 'GC-' || prefix || '-' || LPAD(seq::TEXT, 4, '0');
END; $$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.op_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_operations_touch ON public.operations;
CREATE TRIGGER trg_operations_touch BEFORE UPDATE ON public.operations
  FOR EACH ROW EXECUTE FUNCTION public.op_touch_updated_at();
DROP TRIGGER IF EXISTS trg_op_docs_touch ON public.operation_documents;
CREATE TRIGGER trg_op_docs_touch BEFORE UPDATE ON public.operation_documents
  FOR EACH ROW EXECUTE FUNCTION public.op_touch_updated_at();
DROP TRIGGER IF EXISTS trg_op_tasks_touch ON public.operation_tasks;
CREATE TRIGGER trg_op_tasks_touch BEFORE UPDATE ON public.operation_tasks
  FOR EACH ROW EXECUTE FUNCTION public.op_touch_updated_at();

-- Freeze after sign
CREATE OR REPLACE FUNCTION public.op_prevent_frozen_edit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_frozen = true AND (
    NEW.storage_path IS DISTINCT FROM OLD.storage_path OR NEW.sha256 IS DISTINCT FROM OLD.sha256
  ) THEN
    RAISE EXCEPTION 'Documento congelado tras firma; crear nueva versión (parent_document_id)';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_op_docs_freeze ON public.operation_documents;
CREATE TRIGGER trg_op_docs_freeze BEFORE UPDATE ON public.operation_documents
  FOR EACH ROW EXECUTE FUNCTION public.op_prevent_frozen_edit();

-- Anti-escalation on participants
CREATE OR REPLACE FUNCTION public.op_prevent_participant_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'geocapitals' AND NOT public.is_gc_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Solo staff GeoCapitals puede asignar rol geocapitals';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_op_participants_no_escalate ON public.operation_participants;
CREATE TRIGGER trg_op_participants_no_escalate BEFORE INSERT OR UPDATE ON public.operation_participants
  FOR EACH ROW EXECUTE FUNCTION public.op_prevent_participant_escalation();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "operations_gc_staff_all" ON public.operations;
CREATE POLICY "operations_gc_staff_all" ON public.operations FOR ALL TO authenticated
  USING (public.is_gc_staff(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_gc_staff(auth.uid()) OR created_by = auth.uid());
DROP POLICY IF EXISTS "operations_participants_select" ON public.operations;
CREATE POLICY "operations_participants_select" ON public.operations FOR SELECT TO authenticated
  USING (public.is_operation_participant(id, auth.uid()));

DROP POLICY IF EXISTS "op_participants_gc_all" ON public.operation_participants;
CREATE POLICY "op_participants_gc_all" ON public.operation_participants FOR ALL TO authenticated
  USING (public.is_gc_staff(auth.uid())) WITH CHECK (public.is_gc_staff(auth.uid()));
DROP POLICY IF EXISTS "op_participants_self_select" ON public.operation_participants;
CREATE POLICY "op_participants_self_select" ON public.operation_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "op_invitations_gc_all" ON public.operation_invitations;
CREATE POLICY "op_invitations_gc_all" ON public.operation_invitations FOR ALL TO authenticated
  USING (public.is_gc_staff(auth.uid()) OR created_by = auth.uid())
  WITH CHECK (public.is_gc_staff(auth.uid()) OR created_by = auth.uid());

DROP POLICY IF EXISTS "op_docs_gc_all" ON public.operation_documents;
CREATE POLICY "op_docs_gc_all" ON public.operation_documents FOR ALL TO authenticated
  USING (public.is_gc_staff(auth.uid())) WITH CHECK (public.is_gc_staff(auth.uid()));
DROP POLICY IF EXISTS "op_docs_buyer_select" ON public.operation_documents;
CREATE POLICY "op_docs_buyer_select" ON public.operation_documents FOR SELECT TO authenticated
  USING (visibility IN ('buyer_shared','all_parties')
    AND public.is_operation_participant(operation_id, auth.uid(), 'buyer'::public.op_participant_role));
DROP POLICY IF EXISTS "op_docs_seller_select" ON public.operation_documents;
CREATE POLICY "op_docs_seller_select" ON public.operation_documents FOR SELECT TO authenticated
  USING (visibility IN ('seller_shared','all_parties')
    AND public.is_operation_participant(operation_id, auth.uid(), 'seller'::public.op_participant_role));
DROP POLICY IF EXISTS "op_docs_participant_insert" ON public.operation_documents;
CREATE POLICY "op_docs_participant_insert" ON public.operation_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_operation_participant(operation_id, auth.uid()) AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS "op_tasks_gc_all" ON public.operation_tasks;
CREATE POLICY "op_tasks_gc_all" ON public.operation_tasks FOR ALL TO authenticated
  USING (public.is_gc_staff(auth.uid())) WITH CHECK (public.is_gc_staff(auth.uid()));
DROP POLICY IF EXISTS "op_tasks_participant_select" ON public.operation_tasks;
CREATE POLICY "op_tasks_participant_select" ON public.operation_tasks FOR SELECT TO authenticated
  USING (public.is_operation_participant(operation_id, auth.uid(), target_role));
DROP POLICY IF EXISTS "op_tasks_participant_update" ON public.operation_tasks;
CREATE POLICY "op_tasks_participant_update" ON public.operation_tasks FOR UPDATE TO authenticated
  USING (public.is_operation_participant(operation_id, auth.uid(), target_role))
  WITH CHECK (public.is_operation_participant(operation_id, auth.uid(), target_role));

DROP POLICY IF EXISTS "op_messages_gc_all" ON public.operation_messages;
CREATE POLICY "op_messages_gc_all" ON public.operation_messages FOR ALL TO authenticated
  USING (public.is_gc_staff(auth.uid())) WITH CHECK (public.is_gc_staff(auth.uid()));
DROP POLICY IF EXISTS "op_messages_buyer_channel" ON public.operation_messages;
CREATE POLICY "op_messages_buyer_channel" ON public.operation_messages FOR SELECT TO authenticated
  USING (channel IN ('buyer_gc','tripartite')
    AND public.is_operation_participant(operation_id, auth.uid(), 'buyer'::public.op_participant_role));
DROP POLICY IF EXISTS "op_messages_seller_channel" ON public.operation_messages;
CREATE POLICY "op_messages_seller_channel" ON public.operation_messages FOR SELECT TO authenticated
  USING (channel IN ('seller_gc','tripartite')
    AND public.is_operation_participant(operation_id, auth.uid(), 'seller'::public.op_participant_role));
DROP POLICY IF EXISTS "op_messages_participant_insert" ON public.operation_messages;
CREATE POLICY "op_messages_participant_insert" ON public.operation_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_operation_participant(operation_id, auth.uid()) AND channel <> 'internal');

DROP POLICY IF EXISTS "op_access_logs_gc_select" ON public.operation_access_logs;
CREATE POLICY "op_access_logs_gc_select" ON public.operation_access_logs FOR SELECT TO authenticated
  USING (public.is_gc_staff(auth.uid()));
DROP POLICY IF EXISTS "op_access_logs_insert" ON public.operation_access_logs;
CREATE POLICY "op_access_logs_insert" ON public.operation_access_logs FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid() OR public.is_gc_staff(auth.uid()));

DROP POLICY IF EXISTS "op_status_history_gc_all" ON public.operation_status_history;
CREATE POLICY "op_status_history_gc_all" ON public.operation_status_history FOR ALL TO authenticated
  USING (public.is_gc_staff(auth.uid())) WITH CHECK (public.is_gc_staff(auth.uid()));
DROP POLICY IF EXISTS "op_status_history_participant_select" ON public.operation_status_history;
CREATE POLICY "op_status_history_participant_select" ON public.operation_status_history FOR SELECT TO authenticated
  USING (public.is_operation_participant(operation_id, auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.operations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.operation_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.operation_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.operation_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.operation_access_logs;
