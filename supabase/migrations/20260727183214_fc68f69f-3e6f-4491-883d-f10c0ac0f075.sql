
DROP POLICY IF EXISTS trade_negotiations_read ON public.trade_negotiations;
CREATE POLICY trade_negotiations_read ON public.trade_negotiations
  FOR SELECT TO authenticated
  USING (
    public.is_gc_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.commodity_trades t
      WHERE t.id = trade_negotiations.trade_id
        AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid() OR t.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS trade_products_read ON public.trade_products;
CREATE POLICY trade_products_read ON public.trade_products
  FOR SELECT TO authenticated
  USING (
    public.is_gc_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.commodity_trades t
      WHERE t.id = trade_products.trade_id
        AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid() OR t.created_by = auth.uid())
    )
  );
