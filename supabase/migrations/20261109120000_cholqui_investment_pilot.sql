-- A deliberately separate sandbox. Only an operator with SQL access can invite
-- a tester by inserting their auth.users UUID. No production ticket is written.
CREATE TABLE public.cholqui_pilot_invitations (
  investor_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_at timestamptz NOT NULL DEFAULT now(),
  simulated_order_id uuid UNIQUE,
  simulated_amount_clp integer,
  simulated_at timestamptz,
  CONSTRAINT cholqui_pilot_order_complete CHECK (
    (simulated_order_id IS NULL AND simulated_amount_clp IS NULL AND simulated_at IS NULL)
    OR (
      simulated_order_id IS NOT NULL
      AND simulated_amount_clp IS NOT NULL
      AND simulated_at IS NOT NULL
      AND simulated_amount_clp BETWEEN 100000 AND 10000000
      AND simulated_amount_clp % 10000 = 0
    )
  )
);

ALTER TABLE public.cholqui_pilot_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cholqui_pilot_invitations FROM PUBLIC, anon, authenticated;

-- NULL reads the current invitation/receipt. An amount confirms the test order.
-- The row doubles as an invitation and the unique slot for its simulation.
CREATE FUNCTION public.cholqui_pilot_receipt(p_amount_clp integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_investor uuid := auth.uid();
  v_receipt jsonb;
BEGIN
  IF v_investor IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_amount_clp IS NOT NULL THEN
    IF p_amount_clp NOT BETWEEN 100000 AND 10000000 OR p_amount_clp % 10000 <> 0 THEN
      RAISE EXCEPTION 'Monto de prueba inválido' USING ERRCODE = '22023';
    END IF;

    UPDATE public.cholqui_pilot_invitations
    SET simulated_order_id = gen_random_uuid(),
        simulated_amount_clp = p_amount_clp,
        simulated_at = now()
    WHERE investor_id = v_investor AND simulated_order_id IS NULL;
  END IF;

  SELECT jsonb_build_object(
    'orderId', i.simulated_order_id,
    'amountClp', i.simulated_amount_clp,
    'issuedAt', i.simulated_at
  )
  INTO v_receipt
  FROM public.cholqui_pilot_invitations AS i
  WHERE i.investor_id = v_investor;

  RETURN v_receipt;
END;
$$;

REVOKE ALL ON FUNCTION public.cholqui_pilot_receipt(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cholqui_pilot_receipt(integer) TO authenticated;
