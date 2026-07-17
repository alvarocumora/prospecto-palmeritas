-- =========================================================
-- Mesa de Origen (Supply Desk): estructura B2B demanda → red de
-- proveedores → matching → trade.
--
-- Modela el negocio de originación de commodities de la plataforma:
--   1. supply_mandates  — mandatos de compra (demanda real de compradores:
--      refinerías, traders; ej. antimonio para refinería en Florida,
--      cátodo/concentrado de cobre, oro en bullion/doré).
--   2. supply_partners  — red de asociados/proveedores de materia prima
--      (productores, agregadores, agentes) con su vetting KYC.
--   3. mandate_matches  — pipeline que conecta un proveedor (y opcionalmente
--      un lote del marketplace) con un mandato, hasta convertirse en un
--      trade del Trade Desk (commodity_trades).
-- Es gestión de estado y trazabilidad; NO mueve dinero.
-- =========================================================

-- ---------------------------------------------------------
-- supply_mandates: demanda (mandatos de compra)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supply_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text,                        -- folio interno (MND-2026-001)
  title text NOT NULL,
  commodity text NOT NULL,               -- Sb | Cu | Au | ...
  form text,                             -- ingot|cathode|concentrate|dore|bullion|ore
  spec text,                             -- especificación: ley, impurezas, norma
  quantity_t numeric,                    -- cantidad por embarque/contrato
  frequency text NOT NULL DEFAULT 'spot',-- spot|monthly|quarterly|annual
  incoterm text,
  destination text,                      -- destino (ej. refinería en Florida, USA)
  target_price_usd numeric,              -- precio objetivo USD/t (o USD/oz)
  price_basis text,                      -- base de precio (LME -x%, LBMA, fija)
  payment_instrument text,               -- sblc_mt760|dlc|tt|escrow
  buyer_company text,                    -- comprador final (contraparte demanda)
  buyer_contact text,
  status text NOT NULL DEFAULT 'active', -- draft|active|paused|fulfilled|closed
  priority text NOT NULL DEFAULT 'normal', -- low|normal|high|critical
  notes text,
  owner_user_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supply_mandates_owner ON public.supply_mandates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_supply_mandates_status ON public.supply_mandates(status, created_at DESC);

ALTER TABLE public.supply_mandates ENABLE ROW LEVEL SECURITY;

-- El dueño del mandato lo gestiona; el super admin (mesa central) ve todo.
CREATE POLICY "Owner or admin views mandates"
  ON public.supply_mandates FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Owner creates mandate"
  ON public.supply_mandates FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (owner_user_id = auth.uid() OR is_super_admin(auth.uid())));

CREATE POLICY "Owner or admin updates mandate"
  ON public.supply_mandates FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Owner or admin deletes mandate"
  ON public.supply_mandates FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE TRIGGER trg_supply_mandates_updated
  BEFORE UPDATE ON public.supply_mandates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------
-- supply_partners: red de asociados / proveedores
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supply_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  country text,
  region text,
  partner_type text NOT NULL DEFAULT 'producer', -- producer|trader|aggregator|agent|refiner
  commodities text[] NOT NULL DEFAULT ARRAY[]::text[], -- Sb, Cu, Au...
  forms text[] NOT NULL DEFAULT ARRAY[]::text[],       -- concentrate, cathode, dore...
  monthly_capacity_t numeric,
  vetting_status text NOT NULL DEFAULT 'prospect', -- prospect|contacted|nda|docs_review|verified|rejected
  kyc_notes text,
  notes text,
  owner_user_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supply_partners_owner ON public.supply_partners(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_supply_partners_vetting ON public.supply_partners(vetting_status);

ALTER TABLE public.supply_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or admin views partners"
  ON public.supply_partners FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Owner creates partner"
  ON public.supply_partners FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (owner_user_id = auth.uid() OR is_super_admin(auth.uid())));

CREATE POLICY "Owner or admin updates partner"
  ON public.supply_partners FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Owner or admin deletes partner"
  ON public.supply_partners FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE TRIGGER trg_supply_partners_updated
  BEFORE UPDATE ON public.supply_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------
-- mandate_matches: pipeline mandato ↔ proveedor (→ lote → trade)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mandate_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id uuid NOT NULL REFERENCES public.supply_mandates(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.supply_partners(id) ON DELETE CASCADE,
  lot_id uuid REFERENCES public.commodity_lots(id) ON DELETE SET NULL,
  trade_id uuid REFERENCES public.commodity_trades(id) ON DELETE SET NULL,
  -- identified|contacted|ncnda|sampling|qualified|offer|allocated|trade|dropped
  stage text NOT NULL DEFAULT 'identified',
  offered_quantity_t numeric,
  offered_price_usd numeric,
  assay_summary text,                    -- resumen del ensayo/muestra (SGS, etc.)
  next_action text,
  next_action_date date,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mandate_id, partner_id)
);
CREATE INDEX IF NOT EXISTS idx_mandate_matches_mandate ON public.mandate_matches(mandate_id);
CREATE INDEX IF NOT EXISTS idx_mandate_matches_partner ON public.mandate_matches(partner_id);
CREATE INDEX IF NOT EXISTS idx_mandate_matches_stage ON public.mandate_matches(stage);

ALTER TABLE public.mandate_matches ENABLE ROW LEVEL SECURITY;

-- Acceso vía propiedad del mandato (mismo perímetro que la demanda).
CREATE POLICY "Mandate owner views matches"
  ON public.mandate_matches FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.supply_mandates m
    WHERE m.id = mandate_matches.mandate_id
      AND (m.owner_user_id = auth.uid() OR is_super_admin(auth.uid()))
  ));

CREATE POLICY "Mandate owner creates match"
  ON public.mandate_matches FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.supply_mandates m
      WHERE m.id = mandate_id
        AND (m.owner_user_id = auth.uid() OR is_super_admin(auth.uid()))
    )
  );

CREATE POLICY "Mandate owner updates match"
  ON public.mandate_matches FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.supply_mandates m
    WHERE m.id = mandate_matches.mandate_id
      AND (m.owner_user_id = auth.uid() OR is_super_admin(auth.uid()))
  ));

CREATE POLICY "Mandate owner deletes match"
  ON public.mandate_matches FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.supply_mandates m
    WHERE m.id = mandate_matches.mandate_id
      AND (m.owner_user_id = auth.uid() OR is_super_admin(auth.uid()))
  ));

CREATE TRIGGER trg_mandate_matches_updated
  BEFORE UPDATE ON public.mandate_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
