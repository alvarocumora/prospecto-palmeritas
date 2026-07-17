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
