alter table public.property_deal_inquiries
  add column if not exists stage text not null default 'interesado',
  add column if not exists stage_updated_at timestamptz not null default now();

do $$ begin
  alter table public.property_deal_inquiries
    add constraint property_deal_inquiries_stage_check
    check (stage in ('interesado','nda_firmado','data_room','oferta','due_diligence','cierre','descartado'));
exception when duplicate_object then null; end $$;

update public.property_deal_inquiries
   set stage = case
     when closed_at is not null then 'cierre'
     when nda_signed_at is not null then 'data_room'
     else 'interesado' end
 where stage = 'interesado';

create table if not exists public.deal_stage_events (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.property_deal_inquiries(id) on delete cascade,
  listing_id uuid not null references public.property_listings(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  note text,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists deal_stage_events_inquiry_idx on public.deal_stage_events(inquiry_id, created_at desc);

grant select on public.deal_stage_events to authenticated;
grant all on public.deal_stage_events to service_role;
alter table public.deal_stage_events enable row level security;

drop policy if exists "deal_stage_events_read_parties" on public.deal_stage_events;
create policy "deal_stage_events_read_parties" on public.deal_stage_events
  for select to authenticated
  using (
    public.is_platform_staff(auth.uid())
    or exists (select 1 from public.property_deal_inquiries i
                where i.id = deal_stage_events.inquiry_id and i.inquirer_user_id = auth.uid())
    or exists (select 1 from public.property_listings l
                where l.id = deal_stage_events.listing_id and l.owner_user_id = auth.uid())
  );

create or replace function public.deal_advance(p_inquiry_id uuid, p_stage text, p_note text default null)
returns public.property_deal_inquiries
language plpgsql
security definer
set search_path = public
as $$
declare
  inq public.property_deal_inquiries;
  lst public.property_listings;
  is_owner boolean;
  is_inquirer boolean;
  is_staff boolean;
  allowed text[];
begin
  select * into inq from public.property_deal_inquiries where id = p_inquiry_id;
  if inq.id is null then raise exception 'Solicitud no encontrada'; end if;
  select * into lst from public.property_listings where id = inq.listing_id;

  is_owner := lst.owner_user_id = auth.uid();
  is_inquirer := inq.inquirer_user_id = auth.uid();
  is_staff := public.is_platform_staff(auth.uid());
  if not (is_owner or is_inquirer or is_staff) then
    raise exception 'No autorizado para modificar este deal';
  end if;

  allowed := case inq.stage
    when 'interesado'   then array['nda_firmado','descartado']
    when 'nda_firmado'  then array['data_room','descartado']
    when 'data_room'    then array['oferta','descartado']
    when 'oferta'       then array['due_diligence','descartado']
    when 'due_diligence' then array['cierre','descartado']
    else array[]::text[] end;

  if not (p_stage = any(allowed)) then
    raise exception 'Transición inválida: % → %', inq.stage, p_stage;
  end if;

  if p_stage in ('data_room','due_diligence','cierre') and not (is_owner or is_staff) then
    raise exception 'Sólo el titular del proyecto puede avanzar a %', p_stage;
  end if;

  insert into public.deal_stage_events(inquiry_id, listing_id, from_stage, to_stage, note, actor_user_id)
  values (p_inquiry_id, inq.listing_id, inq.stage, p_stage, p_note, auth.uid());

  update public.property_deal_inquiries
     set stage = p_stage,
         stage_updated_at = now(),
         nda_signed_at = case when p_stage = 'nda_firmado' and nda_signed_at is null then now() else nda_signed_at end,
         closed_at = case when p_stage in ('cierre','descartado') then now() else closed_at end,
         updated_at = now()
   where id = p_inquiry_id
   returning * into inq;

  return inq;
end;
$$;

revoke all on function public.deal_advance(uuid, text, text) from public, anon;
grant execute on function public.deal_advance(uuid, text, text) to authenticated;