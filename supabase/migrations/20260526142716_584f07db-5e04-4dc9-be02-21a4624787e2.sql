-- Fase 3: limpieza de tablas huérfanas (Lote A + D reducido)
-- Todas verificadas: vacías, sin FKs entrantes, sin referencias en código de app
-- (las únicas refs son en types.ts auto-generado).

-- Lote A — features muertas
DROP TABLE IF EXISTS public.card_comments CASCADE;
DROP TABLE IF EXISTS public.card_mentions CASCADE;
DROP TABLE IF EXISTS public.escrito_templates CASCADE;
DROP TABLE IF EXISTS public.mining_owner_profiles CASCADE;
DROP TABLE IF EXISTS public.marketplace_layer_reviews CASCADE;
DROP TABLE IF EXISTS public.workspace_function_roles CASCADE;
DROP TABLE IF EXISTS public.team_member_profiles CASCADE;

-- Lote D — billing/credits sin uso
-- (se conservan: subscriptions, organization_subscriptions, billing_plans)
DROP TABLE IF EXISTS public.credit_ledger CASCADE;
DROP TABLE IF EXISTS public.credit_wallets CASCADE;
DROP TABLE IF EXISTS public.user_subscriptions CASCADE;
DROP TABLE IF EXISTS public.usage_counters CASCADE;