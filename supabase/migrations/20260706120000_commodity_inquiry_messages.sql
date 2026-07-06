-- Hilo de mensajes buyer↔seller por consulta de commodity.
-- Espejo del patrón property_deal_messages, pero para commodity_inquiries.

CREATE TABLE IF NOT EXISTS public.commodity_inquiry_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.commodity_inquiries(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commodity_inquiry_messages_inquiry_idx
  ON public.commodity_inquiry_messages (inquiry_id, created_at);

ALTER TABLE public.commodity_inquiry_messages ENABLE ROW LEVEL SECURITY;

-- Participantes: el buyer de la consulta o el seller del lote consultado.
CREATE POLICY "Participants read inquiry messages"
ON public.commodity_inquiry_messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.commodity_inquiries i
    JOIN public.commodity_lots l ON l.id = i.lot_id
    WHERE i.id = commodity_inquiry_messages.inquiry_id
      AND (i.buyer_user_id = auth.uid() OR l.seller_user_id = auth.uid())
  )
);

CREATE POLICY "Participants send inquiry messages"
ON public.commodity_inquiry_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.commodity_inquiries i
    JOIN public.commodity_lots l ON l.id = i.lot_id
    WHERE i.id = commodity_inquiry_messages.inquiry_id
      AND (i.buyer_user_id = auth.uid() OR l.seller_user_id = auth.uid())
  )
);

GRANT SELECT, INSERT ON public.commodity_inquiry_messages TO authenticated;
GRANT ALL ON public.commodity_inquiry_messages TO service_role;
