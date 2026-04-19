
Implementar Fase 2 + Fase 3 simultáneamente. Esto es ambicioso — voy a entregar una base funcional de cada pieza, no todo pulido. Aviso de antemano: serán ~15-20 archivos nuevos.

## FASE 2 — Estructura ampliada de perfiles y equipos

### 2.1 Perfiles ricos (DB migration)
Añadir a `profiles`:
- `specialty` (text) — exploración / geotécnico / geofísico / catastro / otro
- `certifications` (text[]) — QP NI 43-101, JORC, etc.
- `phone` (text)
- `language` (text, default 'es')
- `country` (text)

### 2.2 Invitaciones por email (nueva tabla + edge function)
- Tabla `project_invitations` (project_id, email, role, token, status, invited_by, expires_at).
- RLS: owners/admins crean e ven invitaciones de su proyecto; cualquiera con el token puede leer la suya.
- Edge function `send-project-invitation` que inserta + envía email vía Lovable Emails (auth scaffold ya posible más tarde — por ahora email opcional, foco en el link).
- Página `/invitations/$token` para aceptar — inserta en `project_members` con el rol indicado.

### 2.3 Auditoría
- Tabla `audit_log` (id, project_id, user_id, action, entity_type, entity_id, payload jsonb, created_at).
- Trigger genérico `log_changes()` aplicado a tablas clave (drill_holes, drill_core_logs, sampling_results, mining_concessions).
- RLS: solo miembros del proyecto leen su audit_log.

### 2.4 UI
- Página `/dashboard/team` (owners/admins): listado de miembros, cambiar roles, invitar, ver invitaciones pendientes.
- Página `/dashboard/profile`: editar perfil completo.
- Página `/dashboard/audit` (owners/admins): timeline de cambios del proyecto activo.

## FASE 3 — Disrupción de plataforma

### 3.1 Dashboard ejecutivo cross-proyecto
Reemplazar `_authenticated.dashboard.index.tsx` con KPIs agregados:
- Total m perforados (suma `actual_depth` de drill_holes)
- Au promedio ponderado (de drill_core_logs y sampling_results)
- Intercepts del mes (usando `computeIntercepts` por hole)
- CapEx geofísico (suma `cost_usd` de geophysics_surveys)
- Cards por proyecto con mini-spark de actividad

### 3.2 Asistente IA geológico
- Edge function `geo-assistant` usando Lovable AI Gateway (`google/gemini-2.5-pro`).
- Recibe `project_id` + `messages[]`. Construye system prompt inyectando contexto del proyecto: nº holes, m perforados, surveys activos, top intercepts, concesiones.
- Stream de respuesta SSE.
- Componente flotante `<GeoAssistant />` (botón redondo abajo-derecha) con drawer de chat, disponible en todas las páginas del dashboard.

### 3.3 Modo offline-first ampliado
- Extender `useOfflineQueue` con namespaces (`drilling`, `sampling`, `geophysics`).
- Hook `useOfflineMutation(table, mode)` que: si online → supabase directo; si offline → cola IndexedDB + flush al reconectar.
- Indicador de estado online/offline + cola pendiente en topbar.

### 3.4 Marketplace de capas (skeleton)
- Tabla `shared_layers` (name, description, geometry_geojson, owner_id, is_public, tags[], thumbnail_url, downloads_count).
- Página `/dashboard/marketplace`: grilla de capas públicas + "instalar en mi proyecto" (copia geometry como geological_feature).
- Por ahora sin uploads — solo seed con 3 ejemplos (geología regional Chile, hidrografía, fallas regionales).

### 3.5 Time machine
- Vista que lee `audit_log` y permite "viajar" a una fecha: filtra entidades creadas/modificadas antes de esa fecha.
- Implementación mínima: slider de fecha en `/dashboard/audit` que recompone snapshot.

### 3.6 Reportes one-click
- Botón "Generar NI 43-101" en dashboard de proyecto — ya existe `export-ni43101-pdf.ts`.
- Añadir "Pitch Investor" (1 página, hero + KPIs + mapa + ask) y "Technical Brief" (5 páginas).

## Fixes adicionales
- **Hidratación SSR rota**: el `OnboardingWizard` se monta en SSR con `<div className="min-h-screen...">` pero debería ir dentro de `<Suspense>`. Envolver el branch del wizard en `typeof window` check o usar `useEffect` para mostrar.

## Archivos

### DB (1 migration)
- Migration: añadir columnas a `profiles`, crear `project_invitations`, `audit_log`, `shared_layers`, trigger genérico audit, seed de shared_layers.

### Edge functions (2)
- `supabase/functions/send-project-invitation/index.ts`
- `supabase/functions/geo-assistant/index.ts`

### Hooks (4)
- `src/hooks/useTeam.ts` — miembros + invitaciones
- `src/hooks/useAuditLog.ts`
- `src/hooks/useExecutiveKpis.ts`
- `src/hooks/useOfflineMutation.ts` (extiende useOfflineQueue)

### Componentes (4)
- `src/components/GeoAssistant.tsx` — drawer flotante
- `src/components/team/InviteMemberDialog.tsx`
- `src/components/team/MembersTable.tsx`
- `src/components/OnlineStatusBadge.tsx`

### Rutas (5 nuevas + 2 editadas)
- `src/routes/_authenticated.dashboard.team.tsx`
- `src/routes/_authenticated.dashboard.profile.tsx`
- `src/routes/_authenticated.dashboard.audit.tsx`
- `src/routes/_authenticated.dashboard.marketplace.tsx`
- `src/routes/invitations.$token.tsx`
- editar `src/routes/_authenticated.dashboard.index.tsx` → dashboard ejecutivo
- editar `src/routes/_authenticated.tsx` → añadir GeoAssistant + OnlineStatusBadge + nuevas entradas nav (Equipo, Perfil, Auditoría, Marketplace) gateadas por rol
- editar `src/hooks/useProjectRole.ts` → añadir módulos nuevos al MODULE_ROLES

### Fix hidratación
- editar `src/routes/_authenticated.tsx` → wrapper del onboarding con guard `mounted`

Confirmo: empiezo migración primero (no en paralelo con código), luego todo el resto.
