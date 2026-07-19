-- =============================================================
-- GeoCapitals · migraciones pendientes (aplicar en Supabase SQL editor)
--
-- Consolida las migraciones que respaldan cobranza/dunning, sourcing
-- enriquecido y el módulo de proyectos. TODO es idempotente (IF NOT
-- EXISTS / DROP POLICY|TRIGGER IF EXISTS): re-ejecutar es inofensivo,
-- aunque algo ya esté aplicado. Ejecutar de una sola vez.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 20260719200000_trade_payments.sql
-- ─────────────────────────────────────────────────────────────
-- Capa financiera del trade: cronograma de pagos de una operación (anticipo,
-- contra embarque, contra entrega, balance, comisión). Cada pago tiene monto,
-- vencimiento, instrumento y estado. Visible/editable solo por las contrapartes
-- del trade (mismo criterio que trade_shipments / trade_documents).

create table if not exists public.trade_payments (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.commodity_trades(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  -- anticipo | contra_embarque | contra_entrega | balance | comision | otro
  kind text not null default 'otro',
  label text,
  amount_usd numeric,
  currency text not null default 'USD',
  -- Instrumento: sblc_mt760 | dlc | tt | escrow | otro
  instrument text,
  reference text,
  due_date date,
  -- programado | pagado | cancelado
  status text not null default 'programado',
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trade_payments_trade_idx on public.trade_payments (trade_id);
create index if not exists trade_payments_status_idx on public.trade_payments (status);

alter table public.trade_payments enable row level security;

drop policy if exists "Trade parties manage payments" on public.trade_payments;
create policy "Trade parties manage payments"
  on public.trade_payments for all to authenticated
  using (
    exists (
      select 1 from public.commodity_trades t
      where t.id = trade_payments.trade_id
        and (t.buyer_user_id = auth.uid() or t.seller_user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.commodity_trades t
      where t.id = trade_payments.trade_id
        and (t.buyer_user_id = auth.uid() or t.seller_user_id = auth.uid())
    )
  );

drop trigger if exists trg_trade_payments_updated_at on public.trade_payments;
create trigger trg_trade_payments_updated_at
  before update on public.trade_payments
  for each row execute function public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 20260719220000_payment_reminders.sql
-- ─────────────────────────────────────────────────────────────
-- =========================================================
-- Dunning: seguimiento de recordatorios de cobranza por pago.
--
-- Añade a trade_payments la marca del último recordatorio enviado y el conteo,
-- para respetar una cadencia (no reenviar más de lo debido) y mostrar en la
-- cola de cobranza cuándo se recordó por última vez. Aditivo e idempotente:
-- el módulo de cobranza degrada elegante si estas columnas aún no existen.
-- =========================================================
ALTER TABLE public.trade_payments
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- 20260719160000_sourcing.sql
-- ─────────────────────────────────────────────────────────────
-- Sourcing de commodities: un comprador/gestor registra un requerimiento y
-- comparte un link para que asociados/proveedores suban su propuesta. Luego
-- genera una ficha de proveedor y la comparte con el comprador final.
--
-- Tokens públicos (submit para el proveedor, share para el comprador) se
-- guardan SOLO como hash SHA-256; el flujo público valida por hash con
-- service role (mismo patrón que document_sign_requests).

create table if not exists public.sourcing_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  reference text not null,
  commodity text not null,
  form text,
  quantity_t numeric,
  incoterm text,
  destination text,
  target_price_usd_t numeric,
  specs text,
  notes text,
  status text not null default 'abierto',
  submit_token_prefix text not null,
  submit_token_hash text not null,
  expires_at timestamptz not null default (now() + interval '60 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sourcing_requests_submit_token_hash_idx
  on public.sourcing_requests (submit_token_hash);
create index if not exists sourcing_requests_owner_idx
  on public.sourcing_requests (owner_user_id, status);

create table if not exists public.sourcing_submissions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.sourcing_requests(id) on delete cascade,
  supplier_name text not null,
  supplier_company text,
  supplier_country text,
  contact_email text,
  contact_phone text,
  offer_price_usd_t numeric,
  offer_quantity_t numeric,
  incoterm text,
  lead_time text,
  specs text,
  notes text,
  -- Documentos aportados por el proveedor: [{label, url}]
  documents jsonb not null default '[]'::jsonb,
  status text not null default 'recibida',
  -- Ficha compartible con el comprador final (hash del token de solo lectura).
  share_token_prefix text,
  share_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sourcing_submissions_request_idx
  on public.sourcing_submissions (request_id);
create unique index if not exists sourcing_submissions_share_token_hash_idx
  on public.sourcing_submissions (share_token_hash) where share_token_hash is not null;

alter table public.sourcing_requests enable row level security;
alter table public.sourcing_submissions enable row level security;

-- El dueño gestiona sus requerimientos.
drop policy if exists "Owner manages sourcing requests" on public.sourcing_requests;
create policy "Owner manages sourcing requests"
  on public.sourcing_requests for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- El dueño del requerimiento ve/gestiona sus propuestas.
drop policy if exists "Owner manages sourcing submissions" on public.sourcing_submissions;
create policy "Owner manages sourcing submissions"
  on public.sourcing_submissions for all to authenticated
  using (
    exists (
      select 1 from public.sourcing_requests r
      where r.id = sourcing_submissions.request_id
        and r.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.sourcing_requests r
      where r.id = sourcing_submissions.request_id
        and r.owner_user_id = auth.uid()
    )
  );

drop trigger if exists trg_sourcing_requests_updated_at on public.sourcing_requests;
create trigger trg_sourcing_requests_updated_at
  before update on public.sourcing_requests
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_sourcing_submissions_updated_at on public.sourcing_submissions;
create trigger trg_sourcing_submissions_updated_at
  before update on public.sourcing_submissions
  for each row execute function public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 20260719180000_sourcing_submission_trade.sql
-- ─────────────────────────────────────────────────────────────
-- Convertir una propuesta de proveedor preseleccionada en un trade del Trade
-- Desk: al hacerlo, la operación queda vinculada y toda la trazabilidad
-- (documentos, procedencia, contratos, comisiones, envío) vive en el trade.

alter table public.sourcing_submissions
  add column if not exists trade_id uuid references public.commodity_trades(id) on delete set null;

create index if not exists sourcing_submissions_trade_idx
  on public.sourcing_submissions (trade_id) where trade_id is not null;

-- ─────────────────────────────────────────────────────────────
-- 20260719240000_sourcing_supplier_ficha.sql
-- ─────────────────────────────────────────────────────────────
-- =========================================================
-- Ficha de proveedor enriquecida: campos estructurados que el proveedor
-- completa al subir su propuesta y que luego se comparten como ficha.
--
--   supplier_role     productor | representante | broker | trader | otro
--   port_loading      puerto de carga / origen del embarque
--   payment_terms     modo de pago (texto libre: "30% anticipo, 70% contra B/L")
--   offer_valid_until validez de la oferta (fecha)
--   quality_grade     ley / calidad (ej. "Cu 24%, Au 3 g/t")
--   packaging         empaque (big bags, granel, tambores…)
--
-- Todo aditivo y nullable: el flujo de sourcing degrada elegante si aún no se
-- aplica esta migración.
-- =========================================================
ALTER TABLE public.sourcing_submissions
  ADD COLUMN IF NOT EXISTS supplier_role text,
  ADD COLUMN IF NOT EXISTS port_loading text,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS offer_valid_until date,
  ADD COLUMN IF NOT EXISTS quality_grade text,
  ADD COLUMN IF NOT EXISTS packaging text;

-- ─────────────────────────────────────────────────────────────
-- 20260719260000_project_fundraises.sql
-- ─────────────────────────────────────────────────────────────
-- =========================================================
-- Levantamiento de capital por proyecto (project_fundraises).
--
-- Hasta ahora los términos económicos de la ronda (monto a levantar, ticket,
-- instrumento, uso de fondos, hitos, estructura de financiamiento) vivían
-- HARDCODEADOS en src/lib/investor/fichas.ts para 4 proyectos. Esta tabla los
-- vuelve datos reales, editables por el dueño del proyecto y por proyecto.
--
-- Una fila por proyecto (project_id único). RLS: miembros del proyecto leen;
-- owner/admin editan (se refina en la capa de server fn). El flag is_public y
-- el token de compartir alimentan la ficha pública (ronda siguiente).
-- =========================================================
CREATE TABLE IF NOT EXISTS public.project_fundraises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Ronda que se levanta.
  round_size_usd numeric,
  min_ticket_usd numeric,
  instrument text,                       -- equity | safe | convertible | option_nsr | jv_farmin | debt | other
  equity_offered_pct numeric,            -- % de la sociedad ofrecido por la ronda
  horizon_years numeric,

  -- Valorización referencial del activo.
  valuation_low_usd numeric,
  valuation_high_usd numeric,
  valuation_method text,

  -- Estructura y narrativa.
  financing_structure text,              -- opción, hitos no reembolsables, NSR, SPV… (texto)
  use_of_funds jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{label, pct}]
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,     -- [{when, what}]
  scenarios jsonb NOT NULL DEFAULT '[]'::jsonb,      -- [{key, label, multiple, note}]
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,     -- string[]
  notes text,

  status text NOT NULL DEFAULT 'draft',  -- draft | open | closed
  is_public boolean NOT NULL DEFAULT false,
  public_token_prefix text,
  public_token_hash text,

  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_fundraises_project
  ON public.project_fundraises(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_fundraises_public_token
  ON public.project_fundraises(public_token_hash) WHERE public_token_hash IS NOT NULL;

ALTER TABLE public.project_fundraises ENABLE ROW LEVEL SECURITY;

-- Miembros del proyecto ven; los cambios se hacen vía server fn (owner/admin).
DROP POLICY IF EXISTS "Members view fundraise" ON public.project_fundraises;
CREATE POLICY "Members view fundraise"
  ON public.project_fundraises FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members insert fundraise" ON public.project_fundraises;
CREATE POLICY "Members insert fundraise"
  ON public.project_fundraises FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Members update fundraise" ON public.project_fundraises;
CREATE POLICY "Members update fundraise"
  ON public.project_fundraises FOR UPDATE TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_project_fundraises_updated ON public.project_fundraises;
CREATE TRIGGER trg_project_fundraises_updated
  BEFORE UPDATE ON public.project_fundraises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 20260719280000_project_facts.sql
-- ─────────────────────────────────────────────────────────────
-- =========================================================
-- Ficha de datos del proyecto con PROCEDENCIA por dato.
--
-- GeoCapitals es una plataforma de certificación: no puede mezclar lo probado
-- con lo informado por el dueño. Cada dato (superficie, ley, reserva, titular…)
-- se carga con uno de tres estados de procedencia:
--   certificado  → verificado por tercero / QP / estándar (NI 43-101, JORC…)
--   declarado    → informado por el dueño, con fuente pero sin verificación
--   a_verificar  → pendiente de confirmación (entra al checklist de due diligence)
--
-- Una fila por dato. RLS: miembros del proyecto leen; owner/admin editan (se
-- refuerza en la capa de server fn). Aditivo: el módulo degrada si no existe.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.project_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  section text NOT NULL DEFAULT 'otro',   -- activo|geologia|oro|tierras_raras|economico|catastro|legal|otro
  label text NOT NULL,
  value text,
  unit text,
  provenance text NOT NULL DEFAULT 'a_verificar',  -- certificado|declarado|a_verificar
  source text,                            -- quién certifica/declara (lab, QP, boletín…)
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_facts_project ON public.project_facts(project_id);

ALTER TABLE public.project_facts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view facts" ON public.project_facts;
CREATE POLICY "Members view facts"
  ON public.project_facts FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members insert facts" ON public.project_facts;
CREATE POLICY "Members insert facts"
  ON public.project_facts FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Members update facts" ON public.project_facts;
CREATE POLICY "Members update facts"
  ON public.project_facts FOR UPDATE TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members delete facts" ON public.project_facts;
CREATE POLICY "Members delete facts"
  ON public.project_facts FOR DELETE TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_project_facts_updated ON public.project_facts;
CREATE TRIGGER trg_project_facts_updated
  BEFORE UPDATE ON public.project_facts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 20260719300000_concession_parcels.sql
-- ─────────────────────────────────────────────────────────────
-- =========================================================
-- Catastro enriquecido: matrículas catastrales de la concesión/pertenencia.
--
-- mining_concessions ya modela expediente (code), superficie (area_ha),
-- titular (holder), vigencia (granted_at/expires_at) y polígono
-- (geometry_geojson). Falta la referencia a las matrículas catastrales de la
-- propiedad (ej. "224, 461"). Aditivo y nullable.
-- =========================================================
ALTER TABLE public.mining_concessions
  ADD COLUMN IF NOT EXISTS parcel_ids text;

