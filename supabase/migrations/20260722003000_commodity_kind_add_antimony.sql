-- Agrega antimonio (mineral en breña) al enum de commodities del marketplace.
-- Debe ir en su propia migración/transacción: Postgres no permite usar un valor
-- de enum recién agregado dentro de la misma transacción que lo crea. El seed
-- que lo usa vive en la migración siguiente (20260722003100_*).
ALTER TYPE public.commodity_kind ADD VALUE IF NOT EXISTS 'sb_ore';
