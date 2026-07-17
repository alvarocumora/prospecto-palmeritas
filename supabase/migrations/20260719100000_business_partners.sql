-- Asociados comerciales del CRM de negocios: vendedores, gestores/brokers,
-- clientes y proveedores con los que el usuario co-gestiona deals de
-- commodities y minas. Cada usuario administra SU cartera (RLS owner-only).

create table if not exists public.business_partners (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text,
  -- vendedor | gestor | broker | cliente | proveedor | otro
  role text not null default 'gestor',
  email text,
  phone text,
  country text,
  commodities text[] default '{}',
  notes text,
  -- activo | prospecto | inactivo
  status text not null default 'activo',
  -- usuario de la plataforma vinculado (opcional, para colaboración futura)
  linked_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_partners_owner_idx
  on public.business_partners (owner_user_id, status);

alter table public.business_partners enable row level security;

drop policy if exists "Owner manages own partners" on public.business_partners;
create policy "Owner manages own partners"
  on public.business_partners for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop trigger if exists trg_business_partners_updated_at on public.business_partners;
create trigger trg_business_partners_updated_at
  before update on public.business_partners
  for each row execute function public.update_updated_at_column();
