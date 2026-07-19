-- =========================================================
-- Dunning: seguimiento de recordatorios de cobranza por pago.
--
-- Añade a trade_payments la marca del último recordatorio enviado y el conteo,
-- para respetar una cadencia (no reenviar más de lo debido) y mostrar en la
-- cola de cobranza cuándo se recordó por última vez. Aditivo e idempotente:
-- el módulo de cobranza degrada elegante si estas columnas aún no existen.
-- =========================================================
ALTER TABLE public.trade_payments
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;
