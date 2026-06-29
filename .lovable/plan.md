
# Plan: Sistema de Inversión listo para clientes (Fase 1 — Captura calificada)

Decidiste **capturar leads calificados ahora** y dejar el cobro online para fase 2. Este plan deja la plataforma en estado "abierta al público" con un funnel completo: inversor llega al landing → se registra → completa perfil de inversión → ve deals reales → solicita acceso a data room / NDA → tu equipo aprueba y agenda → cuando cierras offline, marcas el deal y registras el wire en Stripe Chile manualmente (fase 2).

## 1. Funnel público de inversor (frontend)

- **Landing `/inversionistas`**: CTA primario "Acceder a deals verificados" → `/auth?intent=investor`. Mostrar 3 deals destacados reales desde `property_listings` (ya existe `getPublicListings`) con badge "NI 43-101" cuando aplique.
- **Signup dedicado**: `/auth` ya existe; agregar query `?intent=investor` que pre-selecciona `account_type=investor` y salta el paso 1 del `OnboardingWizard`.
- **Wizard paso 2 (investor)**: ya captura full_name, company, country, ticket min/max, commodities, standards aceptados, website, review_status='pending_review'. Confirmar copy + tooltips de "qué hacemos con tus datos".
- **Estado "pending_review"**: tras enviar, el inversor ve un dashboard "limitado" — puede explorar marketplace pero los botones de data room / contacto muestran "Tu cuenta está en revisión (24 h hábiles)".

## 2. Aprobación interna (geocapitals_team)

- Nueva ruta `/_authenticated/dashboard/admin/investors` visible solo si `has_role(uid,'admin')` o `account_type='geocapitals_team'`.
- Lista de `investor_profiles` con filtro por `review_status`, columnas: nombre, empresa, país, ticket, commodities, website, fecha.
- Acciones: **Aprobar** (review_status='approved' + email "bienvenido, ya tienes acceso") · **Rechazar** (con motivo, NO se expone al inversor; solo queda en log interno) · **Pedir info** (email template).
- Notificación interna al equipo cuando entra un nuevo `pending_review` (template ya scaffoldeado: extender `internal-new-lead`).

## 3. Deal flow operativo

- **Marketplace público (`/proyectos`)**: ya muestra listings; añadir filtros por commodity/región/modalidad y badge de score.
- **Ficha de deal `/proyectos/$id`** (pública con datos resumidos, completa si está aprobado):
  - Resumen ejecutivo, mapa, ley/tonelaje declarado, modalidad (Venta/JV/Royalty), commodity, región, status legal de concesión (semáforo desde `cadastre_national`).
  - CTA "Solicitar acceso al data room" → crea fila en `property_deal_inquiries` con estado `requested`.
  - Si `review_status != 'approved'` → CTA bloqueado con modal "Completa tu verificación".
- **Drawer de inquiry**: el dueño del deal (mining_owner) ve la solicitud en su dashboard → aprueba → se crea `data_room_access_grants` por 14 días → email al inversor con link directo.

## 4. Métrica y compliance mínima

- **Audit trail**: cada acceso a data room y cada descarga ya queda en `data_room_access_logs` (no exponer PII al inversor; visible solo a owner/admin).
- **Términos legales**: checkbox obligatorio en wizard "Acepto Términos y Política de Privacidad" + páginas `/legal/terminos` y `/legal/privacidad` (placeholders editables).
- **NDA simple electrónico**: usar `signature_envelopes` ya existente; el inversor firma click-wrap antes de descargar archivos del data room.

## 5. Pagos — preparar fase 2 (no implementar checkout aún)

- Conectar **Stripe Chile** vía connector ahora (sin exponer botones) → permite emitir invoices manuales para success fee cuando cierres un deal offline.
- Tabla `deal_settlements` (nueva): deal_id, investor_id, amount_clp/usd, success_fee_pct, status (`pending_wire` | `received` | `paid_out`), stripe_invoice_id, wire_reference, recorded_by, recorded_at.
- UI admin "Registrar wire recibido" — solo lectura para inversores/owners.

## 6. Notificaciones reales (ya hay infra)

Templates a añadir/editar en `src/lib/email-templates/`:
- `investor-welcome-pending` — al registrarse.
- `investor-approved` — cuando admin aprueba.
- `investor-data-room-granted` — link + expira en X días.
- `internal-new-investor-lead` — al equipo Geocapitals.
- `owner-new-inquiry` — al mining_owner cuando llega solicitud.

## 7. Go-live checklist

1. Confirmar dominio `geocapitals.com` 200 OK y `/api/public/health` verde.
2. Política de Privacidad + Términos publicados (aunque sean v1).
3. Al menos 3 deals reales cargados en `property_listings` con coords y modalidad.
4. Cuenta admin creada y `RoleSegmentedPanel` muestra panel team correctamente.
5. Probar funnel completo end-to-end con Playwright: signup investor → wizard → marketplace → inquiry → admin aprueba → email llega.
6. Publicar y compartir link.

## Detalles técnicos

```text
DB:
  + tabla deal_settlements (admin-only RLS)
  + columna investor_profiles.terms_accepted_at timestamptz
  + RPC admin_list_investors_pending() SECURITY DEFINER + has_role check

Rutas nuevas:
  src/routes/_authenticated.dashboard.admin.investors.tsx
  src/routes/_authenticated.dashboard.admin.settlements.tsx
  src/routes/proyectos.$listingId.tsx     (ficha pública)
  src/routes/legal.terminos.tsx
  src/routes/legal.privacidad.tsx

Server fns:
  src/lib/investors.functions.ts  (listPending, approve, reject, requestInfo)
  src/lib/deals.functions.ts      (requestDataRoom, grantAccess, recordSettlement)

Emails:
  5 templates nuevos en src/lib/email-templates/ + registry update
  Triggers: server fns invocan sendTransactionalEmail con idempotencyKey

Conectores:
  standard_connectors--connect stripe   (solo provisión; sin checkout aún)
```

## Orden de ejecución (1 sesión de build)

1. Migración: `deal_settlements` + `terms_accepted_at` + grants/RLS.
2. Server fns + ruta admin de inversores.
3. Ficha pública de deal + flujo de inquiry + data room grant.
4. 5 templates de email + wiring en server fns.
5. Páginas legales + checkbox en wizard.
6. Smoke test Playwright end-to-end + publicar.

¿Apruebo este plan y arranco con el paso 1, o quieres ajustar alguna parte (por ejemplo, sumar KYC ligero ya, o adelantar Stripe Checkout para suscripción del terminal)?
