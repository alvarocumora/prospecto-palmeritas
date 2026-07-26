-- OPERACIONES (spine Trades) · Gobernanza de accesos (parte backend del paso 4).
--
-- Consolidar invitaciones = deprecar los sistemas duplicados (operation_invitations,
-- invitation_links) en /src y quedarse con el mecanismo del spine: token HASHEADO de
-- contraparte en commodity_trades (counterparty_{buyer,seller}_token_hash/prefix).
-- Eso es trabajo de Lovable. La parte de datos que aporto: una vista única para que
-- GeoCapitals audite qué contraparte tiene link ACTIVO por operación, SIN exponer
-- nunca el hash (solo el prefix y un booleano). Link governance para operar en serio.
--
-- Depende de commodity_trades (Lovable). No la crea.

CREATE OR REPLACE FUNCTION public.get_trade_access_links(p_trade_id uuid)
RETURNS TABLE (party text, email text, token_prefix text, active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'buyer'::text, t.counterparty_buyer_email, t.counterparty_buyer_token_prefix,
         (t.counterparty_buyer_token_hash IS NOT NULL)
  FROM public.commodity_trades t WHERE t.id = p_trade_id
  UNION ALL
  SELECT 'seller'::text, t.counterparty_seller_email, t.counterparty_seller_token_prefix,
         (t.counterparty_seller_token_hash IS NOT NULL)
  FROM public.commodity_trades t WHERE t.id = p_trade_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_trade_access_links(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_trade_access_links(uuid) IS
  'Gobernanza de accesos: link activo (buyer/seller) por operación, con prefix y estado. Nunca expone el token_hash.';
