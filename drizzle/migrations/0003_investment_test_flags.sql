ALTER TABLE public.investment_tickets ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.spv_positions ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.investment_tickets.is_test IS 'Ticket de prueba interno: excluido del avance público de la ronda.';
CREATE OR REPLACE FUNCTION public.spv_round_status(_project_code text)
 RETURNS TABLE(spv_id uuid, committed numeric, settled numeric, tickets_count integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT s.id,
    coalesce(sum(t.amount) FILTER (WHERE t.status NOT IN ('cancelled','draft')),0),
    coalesce(sum(t.amount) FILTER (WHERE t.status = 'settled'),0),
    count(t.id) FILTER (WHERE t.status <> 'cancelled')::int
  FROM public.spv_entities s
  LEFT JOIN public.investment_tickets t ON t.spv_id = s.id AND NOT t.is_test
  WHERE s.project_code = _project_code
  GROUP BY s.id
$function$;