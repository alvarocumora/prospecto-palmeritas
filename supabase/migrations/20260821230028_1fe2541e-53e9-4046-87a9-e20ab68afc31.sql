COMMENT ON TABLE public.deals IS 'DEPRECADA: reemplazada por property_deal_inquiries + deal_stage_events (motor unico de deal). No usar en UI ni en metricas.';

CREATE OR REPLACE FUNCTION public.deal_advance(p_inquiry_id uuid, p_stage text, p_note text DEFAULT NULL::text)
 RETURNS property_deal_inquiries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  inq public.property_deal_inquiries;
  lst public.property_listings;
  is_owner boolean;
  is_inquirer boolean;
  is_staff boolean;
  resume_stage text;
  allowed text[];
  linear constant text[] := array['interesado','nda_firmado','data_room','oferta','due_diligence','cierre'];
  terminal constant text[] := array['cierre','descartado','rechazado','retirado','expirado'];
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

  if inq.stage = any(terminal) then
    raise exception 'El deal ya esta en un estado final: %', inq.stage;
  end if;

  if inq.stage = 'pausado' then
    select from_stage into resume_stage
      from public.deal_stage_events
     where inquiry_id = p_inquiry_id and to_stage = 'pausado'
     order by created_at desc
     limit 1;
    resume_stage := coalesce(resume_stage, 'interesado');
    allowed := array[resume_stage,'retirado','rechazado','expirado'];
  else
    allowed := case inq.stage
      when 'interesado'    then array['nda_firmado']
      when 'nda_firmado'   then array['data_room']
      when 'data_room'     then array['oferta']
      when 'oferta'        then array['due_diligence']
      when 'due_diligence' then array['cierre']
      else array[]::text[] end
      || array['pausado','retirado','rechazado','expirado','descartado'];
  end if;

  if not (p_stage = any(allowed)) then
    raise exception 'Transicion invalida: % -> %', inq.stage, p_stage;
  end if;

  if p_stage in ('data_room','due_diligence','cierre') and not (is_owner or is_staff) then
    raise exception 'Solo el titular del proyecto puede avanzar a %', p_stage;
  end if;
  if p_stage in ('rechazado','descartado') and not (is_owner or is_staff) then
    raise exception 'Solo el titular del proyecto o el equipo pueden rechazar el deal';
  end if;
  if p_stage = 'expirado' and not is_staff then
    raise exception 'Solo el equipo puede marcar el deal como expirado';
  end if;
  if p_stage = 'retirado' and not (is_inquirer or is_staff) then
    raise exception 'Solo el interesado puede retirarse del deal';
  end if;

  insert into public.deal_stage_events(inquiry_id, listing_id, from_stage, to_stage, note, actor_user_id)
  values (p_inquiry_id, inq.listing_id, inq.stage, p_stage, p_note, auth.uid());

  update public.property_deal_inquiries
     set stage = p_stage,
         stage_updated_at = now(),
         nda_signed_at = case when p_stage = 'nda_firmado' and nda_signed_at is null then now() else nda_signed_at end,
         closed_at = case when p_stage = any(terminal) then now() else null end,
         updated_at = now()
   where id = p_inquiry_id
   returning * into inq;

  return inq;
end;
$function$;

CREATE INDEX IF NOT EXISTS idx_deal_stage_events_inquiry_created ON public.deal_stage_events (inquiry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_stage_events_listing ON public.deal_stage_events (listing_id);
CREATE INDEX IF NOT EXISTS idx_property_deal_inquiries_listing_stage ON public.property_deal_inquiries (listing_id, stage);