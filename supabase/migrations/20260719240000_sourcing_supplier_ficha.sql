-- =========================================================
-- Ficha de proveedor enriquecida: campos estructurados que el proveedor
-- completa al subir su propuesta y que luego se comparten como ficha.
--
--   supplier_role     productor | representante | broker | trader | otro
--   port_loading      puerto de carga / origen del embarque
--   payment_terms     modo de pago (texto libre: "30% anticipo, 70% contra B/L")
--   offer_valid_until validez de la oferta (fecha)
--   quality_grade     ley / calidad (ej. "Cu 24%, Au 3 g/t")
--   packaging         empaque (big bags, granel, tambores…)
--
-- Todo aditivo y nullable: el flujo de sourcing degrada elegante si aún no se
-- aplica esta migración.
-- =========================================================
ALTER TABLE public.sourcing_submissions
  ADD COLUMN IF NOT EXISTS supplier_role text,
  ADD COLUMN IF NOT EXISTS port_loading text,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS offer_valid_until date,
  ADD COLUMN IF NOT EXISTS quality_grade text,
  ADD COLUMN IF NOT EXISTS packaging text;
