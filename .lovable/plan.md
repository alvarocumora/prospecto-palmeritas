
## 1. Rebrand del login (`/auth`)

Hoy la pantalla usa metáforas de trabajo de campo geológico ("Sesión geólogo", "Acceso al campo", "Continúa donde dejaste tu última campaña", "Nombre del geólogo", "diseñada por geólogos"). Geocapitals es una plataforma de **negocios mineros** (deals, inversión, sourcing de commodities, valorización, NI 43-101), no una app de terreno.

Cambios en `src/routes/auth.tsx`:
- Encabezado: "Sesión geólogo" → "Plataforma Geocapitals"; "Acceso al campo" → "Acceso a tu cuenta".
- Subtítulo login: "Continúa donde dejaste tu última campaña." → "Gestiona tus proyectos, deals y valorizaciones mineras."
- Subtítulo registro: enfocar en "Crea tu cuenta para acceder a proyectos mineros, data rooms y valorización".
- Label "Nombre del geólogo" → "Nombre completo".
- Copy secundario ("diseñada por geólogos", CTA "Entrar al proyecto") → lenguaje de negocio: "Entrar" / "diseñada para el negocio minero: catastro, deals, inversión y NI 43-101".
- Añadir 3 chips bajo el título con los pilares reales de la plataforma: Catastro & Concesiones · Deals & Inversión · NI 43-101 & Valorización.
- Mantener tema Institutional Modernist y tokens actuales (sin cambios visuales de layout).

## 2. Migraciones pendientes

Revisar en la base cuáles de estas siguen sin aplicar y correr las que falten (idempotentes, ya mergeadas):
- `20260719160000_sourcing.sql`
- `20260719180000_sourcing_submission_trade.sql`
- `20260719200000_trade_payments.sql`
- `20260719140000_deal_commissions.sql`
- `20260719120000_sign_requests_trade_link.sql`
- `20260719100000_business_partners.sql`
- `20260718120000_trade_shipments.sql`

Para cada tabla nueva verificar el bloque GRANT (`authenticated` + `service_role`), RLS activo y policies por `auth.uid()`. Si alguna falta GRANT o policy, emitir migración correctiva en el mismo paso.

## 3. Auditoría de flujo (entregable = informe corto + fixes puntuales)

Recorrido end-to-end de los flujos críticos, marcando ✅ / ⚠️ / ❌ y abriendo fix sólo donde rompe UX o seguridad:

1. **Auth & onboarding**: `/auth` → `/dashboard`, redirect post-login, estado `loading` sin flash a `/auth`.
2. **Proyectos & Data Room**: listar, entrar a un listing, ValuationPanel, Data Room (grants, descargas sin 403).
3. **Sourcing de commodities**: crear requerimiento → link público de proveedor → subir propuesta → convertir en trade → payments/commissions.
4. **Trades & shipments**: crear trade, agregar shipment, adjuntar documentos, marcar pagos.
5. **Firmas**: crear envelope, link `firmar/$token`, verificación `verificar/$ref`, QR válido.
6. **Documentos**: editar plantilla, exportar PDF (layout, footer, watermark), branding consistente.
7. **Live maps públicos** (`/live/losverdes`, `/live/palmeras`, `/live/franco`): acceso sin auth, tema IM, export PDF.
8. **Seguridad**: correr `security--run_security_scan`, revisar findings críticos nuevos (RLS, PII, escaladas).
9. **Cron & jobs**: `pg_cron` (sync catastro, sync sernageomin, scan concession expirations) — verificar últimas corridas.

## 4. Mejoras al flujo (priorizadas, sólo scoping — se detallan cuando toque implementarlas)

- **P1** Landing post-login orientada a negocio (KPIs reales: deals abiertos, sourcing pendiente, firmas por completar, alertas de catastro) en vez de placeholder.
- **P1** Sourcing: badge de propuestas nuevas + email al owner cuando llega submission.
- **P2** Trades: timeline unificada (evento + shipment + pago + firma) en la ficha del trade.
- **P2** Documentos: guardado autosave del draft + versión firmada inmutable.
- **P3** Notificaciones: centro único (`/dashboard/notificaciones`) que consuma `email_send_log` + eventos internos.

## Entrega esperada tras aprobar el plan

1. Rebrand `/auth` (commit único).
2. Migraciones pendientes aplicadas + verificadas.
3. Informe de auditoría en el chat (tabla ✅/⚠️/❌ por flujo) + fixes menores incluidos.
4. Lista final de mejoras P1/P2/P3 para decidir cuáles implementar en el siguiente ciclo.

## Fuera de alcance

- No se toca navegación ni el INICIO (Centro de Negocios).
- No se rediseñan módulos completos en este ciclo (sólo copy del login + fixes puntuales que salgan de la auditoría).
- No se cambian claves ni providers de auth.
