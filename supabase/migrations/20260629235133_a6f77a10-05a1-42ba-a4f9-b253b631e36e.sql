-- Permite que el inversionista vea sus propias liquidaciones (historial y estado de pago)
CREATE POLICY "investor reads own settlements"
ON public.deal_settlements
FOR SELECT
TO authenticated
USING (investor_user_id = auth.uid());