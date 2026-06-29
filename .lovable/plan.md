
# Plan "Completar app" — 1 semana al go-live

Objetivo: dominio estable, usuarios reales entrando, perfilados por rol, viendo deal flow real y módulos técnicos con datos conectados. Sin pendientes que bloqueen ventas.

---

## Día 1 · Go-live técnico (estabilidad y dominio)

1. **SSR + dominio**
   - Verificar `geocapitals.com` sirve `MarketingLanding` (no 500). Probar `/`, `/proyectos`, `/inversionistas`, `/contacto`, `/auth`.
   - Smoke con Playwright (headless) sobre las 6 rutas públicas + `/api/public/health` + `/api/public/stats`.
   - Si aparece 500, leer `src/server.ts` + logs y aislar módulo culpable.

2. **Seguridad pre-publish**
   - `security--run_security_scan`. Resolver findings nuevos; ignorar con justificación solo PII de registro público (RUT catastro nacional).
   - Confirmar Google OAuth + email/password activos. `redirect_uri = window.location.origin`.

3. **Observabilidad mínima**
   - Endpoint `/api/public/health` ya existe → añadir uptime check externo (cron pg_cron → log a `job_logs`).
   - Activar `email_send_log` para ver envíos reales.

**Entregable**: dominio verde, scan limpio, login funcionando.

---

## Día 2 · Onboarding real y perfiles

1. **Wizard completo** (`OnboardingWizard`)
   - Paso 1: tipo de cuenta (ya existe).
   - Paso 2 condicional:
     - *Investor*: ticket, commodities, jurisdicciones → `investor_profiles`.
     - *Mining owner*: RUT/nombre titular, # concesiones aproximadas → crea `holders` + opción "importar de catastro nacional por RUT".
     - *Geocapitals team*: rol técnico (geólogo/QP/admin) → `app_roles`.
   - Paso 3: invitar equipo / saltar.
   - Marcar `onboarding_status.completed_at`.

2. **Email transaccional**
   - Templates ya existen. Cablear: bienvenida al completar wizard, invitación a proyecto, reset password.
   - Verificar DNS de `notify.geocapitals.com`.

**Entregable**: nuevo usuario llega → wizard → dashboard con su rol cargado.

---

## Día 3 · Dashboard segmentado con datos reales

Auditar `useExecutiveKpis` y `RoleSegmentedPanel` para que cada KPI tenga query real (hoy varios son 0/placeholder):

- **Investor**: `property_listings` activos, `deal_investor_pipeline` propio, `investor_shared_views` recibidas, watchlist.
- **Mining owner**: `mining_concessions` propias + `concession_alerts` + `concession_patents` vencimientos + `bulletin_alerts`.
- **Geocapitals team**: `drill_holes` activos, `qaqc_results` últimos 30d, `engine_drill_targets` por aprobar, `technical_reports` en draft.

Cada card → link a su módulo, vacío con CTA "crear primero".

---

## Día 4 · Deal Flow real end-to-end

1. **Marketplace público** (`/inversionistas`)
   - `getPublicListings` server fn ya existe → asegurar que devuelve `property_listings` con `is_public=true`.
   - Drawer con: resumen, ubicación, commodities, modalidad, precio, documentos públicos.
   - CTA "Solicitar acceso al data room" → crea `property_deal_inquiries`.

2. **Flujo dueño → publicación**
   - `/dashboard/marketplace` (owner): wizard 4 pasos crear `property_listing` (proyecto, comerciales, docs, publicar).
   - Toggle `is_public`.

3. **Flujo investor → data room**
   - Inbox de inquiries para el owner, aprobar → genera `data_room_access_grants` con expiración.
   - Email automático con link firmado.

---

## Día 5 · Módulos técnicos conectados + QA final

1. **Catastro**: confirmar `sync-catastro` cron activo; banner si hay `concession_alerts` no leídos.
2. **Satelital**: `OpportunitiesMap` ya consume `opportunities_geo` real → asegurar que jobs `satellite_analysis_jobs` corren y popula `satellite_anomalies`.
3. **Sondajes/QA-QC/3D**: smoke en proyecto demo (Los Verdes) → carga sin error.
4. **NI 43-101**: `Pre43101` accesible desde proyecto, lista secciones.

**QA final**:
- Playwright recorre: signup → wizard → dashboard → ver listing público → solicitar data room → owner aprueba → email recibido.
- `security--run_security_scan` final.
- `preview_ui--publish` con metadata verificada.

---

## Detalles técnicos (referencia)

- Server fns nuevos: `submitOnboardingStep2`, `createListingDraft`, `publishListing`, `requestDataRoomAccess`, `grantDataRoomAccess`.
- Server route público nuevo: `/api/public/listings` (read-only, `TO anon` SELECT con columnas seguras).
- Tablas tocadas: `investor_profiles`, `holders`, `app_roles`, `property_listings`, `property_deal_inquiries`, `data_room_access_grants`, `onboarding_status`.
- Migraciones: GRANT explícito en cada nueva, RLS por `auth.uid()` o `has_role()`, sin nuevos roles en `profiles`.
- Emails: usar `send-internal.server.ts` existente, idempotencia por key.

---

## Lo que NO entra esta semana (siguiente sprint)

- Firma electrónica avanzada de NDAs (usar checkbox legal por ahora).
- Pagos / suscripciones.
- App móvil nativa.
- Multi-idioma EN completo (ya hay toggle base).

¿Avanzo con Día 1 (estabilidad + scan) en cuanto apruebes?
