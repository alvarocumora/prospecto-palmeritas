DROP POLICY IF EXISTS trade_screenings_read ON public.trade_screenings;

CREATE POLICY trade_screenings_read ON public.trade_screenings
FOR SELECT TO authenticated
USING (
  public.is_gc_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.commodity_trades t
    WHERE t.id = trade_screenings.trade_id
      AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  )
);

COMMENT ON TABLE public.portal_sessions IS 'Sin politicas RLS por diseno: solo accesible via funciones del servidor (service role). Ningun cliente debe leerla.';
COMMENT ON TABLE public.portal_otp_challenges IS 'Sin politicas RLS por diseno: codigos OTP de portales externos, solo accesibles via funciones del servidor (service role).';
COMMENT ON TABLE public.email_delivery_events IS 'Sin politicas RLS por diseno: telemetria de entrega de correo escrita por webhooks con service role; no se expone al cliente.';