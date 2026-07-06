-- Órdenes de pago para checkout con MercadoPago (Checkout Pro).
-- Cada intento de compra crea una fila pending; el webhook la marca paid y
-- activa la suscripción. external_reference = id de esta fila (para conciliar).

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_code text NOT NULL,
  billing text NOT NULL CHECK (billing IN ('monthly','yearly')),
  amount_clp integer NOT NULL,
  amount_usd numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','cancelled')),
  provider text NOT NULL DEFAULT 'mercadopago',
  preference_id text,
  payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS payment_orders_user_idx ON public.payment_orders (user_id, created_at);
CREATE INDEX IF NOT EXISTS payment_orders_payment_idx ON public.payment_orders (payment_id);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- El usuario ve sus propias órdenes; la escritura es solo service role
-- (server fn / webhook), nunca desde el cliente.
CREATE POLICY "Users read own orders"
ON public.payment_orders
FOR SELECT TO authenticated
USING (user_id = auth.uid());

GRANT SELECT ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;
