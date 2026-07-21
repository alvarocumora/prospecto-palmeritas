## Objetivo

Convertir a Geocapitals en el motor operacional de todos los trades de commodities: onboarding masivo, war room público por operación, panel de trazabilidad unificado (custodia + firmas + finanzas + KYC/AML) y monetización SaaS multi-tenant (suscripción + success fee + fee por documento + white-label API). Base: `commodity_trades`, `trade_events`, `trade_payments`, `trade_shipments`, `trade_documents`, `organizations`, `organization_subscriptions`, `subscription_plans` — todos ya existen.

## Fase 1 — Onboarding masivo en la lista de trades (semana 1)

**Objetivo:** un click, N trades, cada contraparte recibe su paquete NDA + LOI + Portal, con estado consolidado por trade.

- Añadir selección múltiple + barra de acciones en `/dashboard/trades` (checkbox por fila, "Seleccionar todos", contador).
- Extender `src/lib/supplierOnboarding.functions.ts` con `sendSupplierOnboardingBatch({ tradeIds })`: itera con concurrencia limitada, reutiliza la generación NDA/LOI existente, corta si un trade no tiene email de contraparte y devuelve reporte `{ tradeId, ok, error, recipient }`.
- Nueva columna virtual "Onboarding" en la lista (Pendiente / Enviado / NDA firmado / LOI firmado / Portal completo). Se calcula uniendo `document_sign_requests` (por `trade_id`) + `sourcing_submissions` (por email/token) + `trade_events` de tipo `supplier_onboarding_sent`.
- Cronjob `pg_cron` diario: reenvía recordatorio a contrapartes con NDA/LOI pendiente > 3 días (usa el sender interno de emails ya existente).
- Endpoint público `/api/public/webhooks/sign-status` que actualice el estado en el timeline cuando la firma se completa (ya lo emite `document_sign_requests`).

## Fase 2 — War Room público generalizado (semana 2)

**Objetivo:** cada trade tiene una URL `/operacion/$token` viva para cliente y proveedor, con timeline, KPIs, docs firmados, embarques y pagos.

- Auditar `src/routes/operacion.$token.tsx` para que todos los trades (no solo el antimonio piloto) emitan token buyer + seller (`counterparty_seller_token_*` / `counterparty_buyer_token_*` ya existen). Trigger DB que genere ambos tokens al crear un trade si faltan.
- Migración para agregar `role` derivado del token (buyer vs seller) y filtrar qué ve cada parte (buyer no ve datos internos del seller y viceversa).
- Panel público muestra: producto, cantidad, incoterm, precio, stage, milestones (`trade_events`), documentos firmados con QR de verificación, embarques (`trade_shipments`) y pagos (`trade_payments` — solo lo que corresponde a la parte).
- Emails automáticos on-event (usando `email_send_log` que ya existe): cuando pasa a `contract_signed`, `shipment_dispatched`, `payment_received`, `delivered`. Un template por evento en `src/lib/email-templates/`.
- Botón "Copiar link buyer" / "Copiar link seller" desde el detalle del trade, con QR imprimible.

## Fase 3 — Panel de trazabilidad unificado / Compliance (semana 3)

**Objetivo:** una vista donde Geocapitals (y auditor externo) ve la cadena completa por trade y agregada.

- Nueva ruta `/dashboard/trazabilidad` (super-admin + compliance role) con filtros: producto, contraparte, país, periodo, estado.
- Cuatro columnas por trade: **Custodia física** (origen → CoA → SGS → B/L → entrega, con hash del archivo), **Firmas** (NDA → LOI/NCNDA → SPA, con firmante, timestamp, hash del doc), **Cadena financiera** (instrumento SBLC/DLC/escrow, pagos parciales, comisiones — usa `trade_payments` + `deal_commissions`), **KYC/AML** (identidad de contraparte + screening).
- KYC/AML: nueva tabla `kyc_screenings` (business_partner_id, provider, status, hits jsonb, screened_at). Integración con OpenSanctions API pública (gratis, sin key) llamada desde un `createServerFn` — no requiere connector.
- Export "Compliance Package" por trade: PDF con toda la cadena + ZIP con archivos originales, generado por server function.
- Alertas: trigger DB que marca un trade como `compliance_flagged` si (a) contraparte tiene hit AML, (b) monto > umbral por plan, o (c) faltan docs > 15 días.

## Fase 4 — SaaS multi-tenant + monetización + white-label API (semana 4-5)

**Objetivo:** que otros traders/brokers usen Geocapitals con su marca y paguen.

- Consolidar `organizations` como tenant primario. Todos los queries de trades/partners/documents ya filtran por `created_by`; migración para agregar `organization_id` y RLS por membresía (`organization_members` ya existe).
- Actualizar `subscription_plans`: **Starter** (1 usuario, 5 trades activos, sub mensual), **Team** (5 usuarios, 25 trades), **Broker** (ilimitado, white-label), **Enterprise** (API + SLA). Success fee = 0.5% del `total_value_usd` al llegar a `payment_confirmed`. Fee por documento = US$5 por firma completada.
- Billing con **Paddle seamless** (Merchant of Record — ideal para clientes internacionales sin fricción fiscal). Enable via `enable_paddle_payments`. Suscripción mensual + registro de fees por evento (`trade_payment_confirmed`, `document_signed`) que se acumulan y facturan al cierre de mes.
- White-label: por organización, `brand_config` (logo, colores, dominio custom, favicon). PDFs y War Room heredan la marca del tenant vía `data-theme`. Reutiliza `src/lib/publicUrl.ts` para permitir dominio propio.
- API pública v1: `POST /api/v1/trades`, `GET /api/v1/trades/:id`, `POST /api/v1/documents/:id/sign-request`, `GET /api/v1/trades/:id/timeline`. Auth con `api_keys` (tabla ya existe) por organization. Rate limit por plan.
- Consola para el broker: crear API keys, ver uso vs límite del plan, ver invoices Paddle.

## Detalles técnicos

- **Servidor**: todo con `createServerFn` + `requireSupabaseAuth`; webhooks de Paddle y firmas en `src/routes/api/public/webhooks/*` con verificación de firma HMAC.
- **RLS**: cada tabla nueva (`kyc_screenings`, `usage_events`, `brand_config`, `api_keys` extended) con `organization_id` + policy vía `has_org_role()` SECURITY DEFINER (siguiendo `mem://security/definer-funcs`).
- **Diseño**: todas las vistas nuevas envueltas en `data-theme="im-light"` (Institutional Modernist, memoria activa).
- **Emails**: reutilizan `email_send_log` + templates existentes; nuevos templates para eventos War Room y recordatorios.
- **Trazabilidad de archivos**: SHA-256 del blob al momento de subida, guardado en `trade_documents.metadata` para que el QR de verificación demuestre integridad.

## Ubicación en el repo

```text
src/routes/
├── _authenticated.dashboard.trades.tsx        [Fase 1: selección múltiple + estado onboarding]
├── _authenticated.dashboard.trazabilidad.tsx  [Fase 3: nuevo]
├── _authenticated.dashboard.saas.tsx          [Fase 4: consola tenant + API keys]
├── operacion.$token.tsx                       [Fase 2: generalizar + role buyer/seller]
└── api/public/webhooks/
    ├── paddle.ts                              [Fase 4: firmar suscripciones + fees]
    └── sign-status.ts                         [Fase 1: callback firma]
src/lib/
├── supplierOnboarding.functions.ts            [Fase 1: +Batch]
├── kyc.functions.ts                           [Fase 3: OpenSanctions screening]
├── compliance.functions.ts                    [Fase 3: package export + alertas]
├── billing.functions.ts                       [Fase 4: usage events + Paddle sync]
└── tenant.functions.ts                        [Fase 4: brand_config + org context]
```

## Entregables por fase

- **F1**: envío masivo funcional en la lista + estado por trade + recordatorio cron.
- **F2**: cada nuevo trade genera War Room, emails automáticos por evento, QR de verificación en docs.
- **F3**: vista `/dashboard/trazabilidad` con 4 cadenas + export Compliance Package + KYC/AML activo.
- **F4**: Paddle enabled, planes vivos, white-label por org, API v1 documentada.

## Fuera de alcance (siguiente iteración)

- Integración blockchain (anchoring de hashes en cadena) — se puede sumar en F5 sobre la infraestructura de hash ya sembrada en F3.
- Marketplace público de trades cerrados — depende de F4.
- Mobile app dedicada.

## Confirmaciones antes de arrancar

Para partir con F1 esta semana necesito confirmes: (a) ¿arrancamos por F1 completo o quieres que arme F1+F2 en paralelo?, (b) ¿el plan Starter/Team/Broker/Enterprise con esos números te sirve como base o querés otros límites?, (c) ¿confirmás Paddle como proveedor de billing (MoR internacional, sin cuenta propia)?