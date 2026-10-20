-- `staffTicketAction("issue_contract")` validaba el KYC aprobado y hacía el
-- UPDATE de investment_tickets directo desde el server function, el único
-- punto del flujo de tickets donde la regla de negocio no vivía en la base
-- (a diferencia de ticket_sign_contract/submit_payment/cancel/settle, que
-- son SECURITY DEFINER). Esta RPC mueve esa validación a la base, igual que
-- las demás transiciones de staff.
CREATE OR REPLACE FUNCTION public.ticket_issue_contract(_ticket_id uuid)
RETURNS public.investment_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.investment_tickets;
  kyc_status text;
BEGIN
  IF NOT public.is_geocapitals_staff(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  SELECT * INTO t FROM public.investment_tickets WHERE id = _ticket_id FOR UPDATE;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Ticket no encontrado';
  END IF;
  IF t.status <> 'pending_kyc' THEN
    RAISE EXCEPTION 'El ticket no está pendiente de KYC';
  END IF;
  SELECT review_status INTO kyc_status
    FROM public.investor_profiles WHERE user_id = t.investor_user_id;
  IF kyc_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'El KYC del inversionista no está aprobado';
  END IF;
  UPDATE public.investment_tickets
    SET status = 'contract_pending'
    WHERE id = _ticket_id
    RETURNING * INTO t;
  RETURN t;
END
$function$;

REVOKE ALL ON FUNCTION public.ticket_issue_contract(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ticket_issue_contract(uuid) TO authenticated;
