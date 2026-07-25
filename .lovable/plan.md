# Operaciones GeoCapitals — Buyer Portal + Seller Portal + Dashboard vivo

Reorientar el Trade Desk para que cada pedido sea un **workspace transaccional privado** con tres espacios conectados: interno GeoCapitals, portal comprador, portal vendedor. GeoCapitals mantiene control central; cada contraparte solo ve lo autorizado.

## Enfoque MVP (sin logística/financiero avanzado)

Priorizar: crear operación → generar 2 links seguros → invitar contrapartes → checklist + carga documental → firma NDA → data room segregado → mensajería → dashboard en vivo con RLS + audit log.

Reutilizar lo existente donde aplica: `commodity_trades`, `data_rooms/data_room_files/data_room_access_grants`, `signature_envelopes`, `document_registry`, `document_sign_requests`, `trade_events`, `partner_invitations` (patrón de token seguro). No duplicar módulos ya funcionales; extenderlos con nueva capa "operations".

## Fase 0 — Diseño previo a UI (entregables antes de codear)

Antes de pantallas, generar y validar:
1. Modelo de datos (ver §Técnico)
2. Políticas RLS por rol (buyer / seller / geocapitals / super_admin)
3. Flujo de invitación (token → registro → binding a operación+rol)
4. Matriz de permisos por tipo de documento
5. Mapa de pantallas (interno vs buyer vs seller)
6. Máquinas de estado (comprador, vendedor, operación)
7. Canales Realtime (por operación, por participante)

## Fase 1 — Esquema y seguridad (bloqueante)

**Tablas nuevas** en `public`:
- `operations` (código único `GC-XXX-####`, commodity, spec técnica JSONB, incoterm, cantidades, destino, responsable, prioridad, status enum)
- `operation_participants` (operation_id, user_id, org_id, role: buyer|seller|geocapitals, access_status, joined_at, last_access_at)
- `operation_invitations` (operation_id, participant_type, invited_email, secure_token único, expires_at, accepted_at, revoked_at, created_by)
- `portal_access_tokens` (rotación/revocación independiente del invite)
- `portal_sessions` (audit: user_id, ip, user_agent, started_at)
- `operation_documents` (operation_id, storage_path, kind, version, uploaded_by_role, immutable_after_sign bool)
- `document_permissions` (document_id, can_view_buyer, can_view_seller, can_view_geocapitals, can_download, expires_at)
- `operation_tasks` (target_role, priority, due_date, status)
- `operation_messages` + `message_channels` (buyer↔gc, seller↔gc, tripartito bloqueado por defecto, notas internas)
- `signature_requests` + `signatures` (extender los existentes con vínculo a operación y `partyRole`)
- `access_logs` (todo acceso/descarga)
- `participant_status_history` (auditoría cambios estado)
- `portal_notifications`

**Enums**: `operation_status`, `buyer_status`, `seller_status`, `participant_role`, `invitation_status`, `doc_visibility`.

**RLS obligatorio** (cada tabla nueva):
- Buyer ve filas donde existe `operation_participants` con su `user_id` y `role='buyer'`.
- Seller idem con `role='seller'`.
- Notas internas y comisiones: solo `geocapitals` staff (`has_role`).
- Documentos: filtrado por `document_permissions` + rol.
- Servicio de token público: helper `SECURITY DEFINER` que valida token, expiración, no-revocado, y devuelve solo campos permitidos.

**Storage**: bucket privado `operation-docs` con RLS en `storage.objects`; descargas siempre vía signed URL temporal generada por server fn tras chequear permisos.

**GRANTs** completos por tabla (authenticated + service_role; nunca anon salvo endpoints token-based server-side).

## Fase 2 — Backend server functions

Bajo `src/lib/operations/`:
- `createOperation.functions.ts` — crea operación, genera 2 invitaciones (buyer+seller), inicializa 3 data rooms segregados, aplica checklist plantilla por commodity/país.
- `invitations.functions.ts` — generar/revocar/regenerar tokens (crypto seguros, no secuenciales), enviar email vía pipeline existente.
- `redeemInvitation.functions.ts` — canjear token (público, valida hash + expiración) → registro/binding.
- `portalData.functions.ts` — feeds separados `getBuyerPortalView` / `getSellerPortalView` proyectando solo campos autorizados.
- `documents.functions.ts` — upload, versionado, congelar tras firma, signed URL bajo permiso.
- `tasks.functions.ts`, `messages.functions.ts`, `signatures.functions.ts` (extender flujo existente con `partyRole`).
- `generateOperationDoc.functions.ts` — reusa `renderGeocapitalsPdf` para NDA/LOI/ICPO/SCO/NCNDA/IMFPA/BRS con placeholders auto.

Todas con `requireSupabaseAuth` salvo los endpoints públicos token-based (bajo `src/routes/api/public/portal/*` con validación server-side estricta).

## Fase 3 — Portales externos (rutas separadas)

- `src/routes/portal/buyer.$token.tsx` — layout independiente del dashboard interno.
- `src/routes/portal/seller.$token.tsx`
- Sub-vistas: perfil, checklist, documentos, firmas pendientes, tareas, mensajes, timeline autorizado.
- Diseño Institutional Modernist, mobile-first (carga desde cámara, firma táctil, formularios por pasos, botón WhatsApp).
- Auth ligera: token + email + código OTP; sesión limitada a esa operación+rol.

Portal comprador NUNCA ve: docs vendedor no compartidos, comisiones, notas internas, otras operaciones, matching de competidores.
Portal vendedor NUNCA ve: PoF comprador (salvo autorización), datos bancarios comprador, comisiones, otros vendedores postulando.

## Fase 4 — Dashboard interno vivo

- `src/routes/_authenticated/dashboard.operaciones.index.tsx` — lista con KPIs (último acceso buyer/seller, docs hoy, % KYC, alertas, días sin actividad).
- `src/routes/_authenticated/dashboard.operaciones.$id.tsx` — **vista de 3 columnas** (Buyer | GeoCapitals | Seller) con progreso, checklist, docs, firmas, mensajes, alertas por columna.
- Botones internos: copiar link buyer/seller, enviar invitación, revocar, regenerar, ver sesiones, bloquear.
- Panel "Actividad reciente" alimentado por Realtime (`operation_events`).

## Fase 5 — Realtime + notificaciones

Suscripciones Supabase Realtime por `operation_id`:
- INSERTS en `operation_documents`, `signatures`, `operation_messages`, `operation_tasks`, `access_logs`, `participant_status_history`.
- Reutilizar patrón de `useTradeBoardRealtime`.
- Notificaciones email best-effort por eventos clave (invitación, firma, observación).

## Fase 6 — Seed demo GC-SB-0001 (Antimonio)

Migración de datos con la operación de ejemplo, checklists buyer/seller precargados, campos técnicos Sb, y vincular al trade de antimonio ya existente para no duplicar.

## Fuera de alcance MVP (explícito)

Logística avanzada, instrumentos financieros complejos, integración DocuSign/Adobe (arquitectura preparada pero firma interna con audit trail para MVP), matching automático vendedores, IA scoring avanzado.

## Verificación antes de cerrar

- Linter Supabase sin findings nuevos.
- Prueba cross-operation: buyer de op A NO puede leer op B (test RLS).
- Token revocado → 401 en portal.
- Documento firmado → inmutable (nueva versión requerida).
- Descarga siempre vía signed URL con TTL corto.
- Audit log registra todo acceso/descarga/cambio estado.

## Sección técnica breve

```text
operations ──< operation_participants >── auth.users
     │
     ├──< operation_invitations (token, expires_at, revoked_at)
     ├──< operation_documents ──< document_permissions
     │                        └──< signature_requests ──< signatures
     ├──< operation_tasks
     ├──< operation_messages (channel: buyer_gc | seller_gc | tripartite | internal)
     ├──< access_logs
     └──< participant_status_history
```

Estados: ver §12 del brief (implementar exactos). Rutas públicas bajo `/portal/buyer/$token` y `/portal/seller/$token`; APIs bajo `/api/public/portal/*` con verificación de token en cada handler.

## Orden de ejecución sugerido

1. Migración esquema + RLS + GRANTs + bucket + storage policies.
2. Server fns (create/invite/redeem/portalData/documents/tasks/messages).
3. Portales externos buyer/seller (móvil-first).
4. Dashboard interno 3 columnas + Realtime.
5. Seed GC-SB-0001.
6. Auditoría de seguridad (linter + tests cross-tenant).

¿Procedo con esta arquitectura o ajusto alcance (p. ej. omitir portal vendedor en la primera iteración, o integrar directamente sobre `commodity_trades` en lugar de crear tabla `operations`)?
