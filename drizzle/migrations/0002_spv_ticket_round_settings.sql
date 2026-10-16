ALTER TABLE public.spv_entities ADD COLUMN IF NOT EXISTS tickets_open boolean NOT NULL DEFAULT false;
ALTER TABLE public.spv_entities ADD COLUMN IF NOT EXISTS round_size numeric;
ALTER TABLE public.spv_entities ADD COLUMN IF NOT EXISTS min_ticket numeric;
ALTER TABLE public.spv_entities ADD COLUMN IF NOT EXISTS round_shares numeric;
ALTER TABLE public.spv_entities ADD COLUMN IF NOT EXISTS escrow_instructions text;

CREATE OR REPLACE FUNCTION public.spv_round_status(_project_code text)
RETURNS TABLE(spv_id uuid, committed numeric, settled numeric, tickets_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id,
    coalesce(sum(t.amount) FILTER (WHERE t.status NOT IN ('cancelled','draft')),0),
    coalesce(sum(t.amount) FILTER (WHERE t.status = 'settled'),0),
    count(t.id) FILTER (WHERE t.status <> 'cancelled')::int
  FROM public.spv_entities s
  LEFT JOIN public.investment_tickets t ON t.spv_id = s.id
  WHERE s.project_code = _project_code
  GROUP BY s.id
$$;
REVOKE ALL ON FUNCTION public.spv_round_status(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.spv_round_status(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ticket_submit_for_review(_ticket_id uuid)
RETURNS public.investment_tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.investment_tickets; s public.spv_entities;
BEGIN
  SELECT * INTO t FROM public.investment_tickets WHERE id=_ticket_id FOR UPDATE;
  IF t.id IS NULL OR t.investor_user_id <> auth.uid() THEN RAISE EXCEPTION 'Ticket no encontrado'; END IF;
  IF t.status <> 'draft' THEN RAISE EXCEPTION 'El ticket ya fue enviado'; END IF;
  SELECT * INTO s FROM public.spv_entities WHERE id=t.spv_id;
  IF s.id IS NULL OR NOT s.tickets_open THEN RAISE EXCEPTION 'La ronda no está abierta'; END IF;
  IF s.min_ticket IS NOT NULL AND t.amount < s.min_ticket THEN RAISE EXCEPTION 'Monto bajo el ticket mínimo'; END IF;
  UPDATE public.investment_tickets SET status='pending_kyc', risk_disclosure_accepted_at=now() WHERE id=_ticket_id RETURNING * INTO t;
  RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.ticket_submit_for_review(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ticket_submit_for_review(uuid) TO authenticated;