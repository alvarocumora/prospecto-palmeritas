
## Objetivo
1. Enviar hoy NCNDA firmado por Geocapitals + link de registro a `joaquin.belmar@zbalatam.com` y `eduardo@singularx.io`, con acceso pre-aprobado a los 4 data rooms (Los Verdes, Palmeras, Franco, Cornellana) y al trade de Cobre 2.000 MT/mes.
2. Elevar el sistema con: wizard de onboarding broker/cliente, panel admin de invitaciones, y home segmentado por rol.

---

## Parte A — Envío inmediato (los 2 correos)

**1. Registrar contactos como leads pre-aprobados**
- Insertar en `investor_profiles` (o `business_partners` según convenga) con status `invited`, tipo `undefined` (elige al registrarse).
- Crear rows en `project_invitations` para los 4 proyectos con `role='viewer'` y `data_room_grant=true` (usar `data_room_access_grants` para los 4 data rooms + trade cobre).
- Token único por invitado que sirva de identificador durante el onboarding.

**2. Generar y enviar el pack**
Reutilizando `generateTradePack` + `renderGeocapitalsPdf`, para cada correo:
- **NCNDA v1** ya firmado por Geocapitals (contraparte pendiente), con QR de validación (`/verificar.$ref`).
- **Carta de invitación** (1 pág.) con logo, resumen de acceso y CTA.
- Link único: `https://geocapitals.com/onboarding/$token` (nueva ruta pública).

Email vía plantilla nueva `partner-invitation` en `src/lib/email-templates/`, con tracking pixel (`email_delivery_events`) para saber cuándo abren, y botones "Firmar NCNDA" + "Entrar al data room".

---

## Parte B — Wizard de onboarding broker/cliente

Nueva ruta pública `src/routes/onboarding.$token.tsx` (3 pasos):

```text
[1] Identidad          [2] Rol            [3] NCNDA + acceso
────────────           ────────           ──────────────────
Nombre / empresa       ○ Broker           Firma electrónica
Email (prellenado)     ○ Cliente/Inv.     (nombre + IP + fecha)
Teléfono/WhatsApp      ○ Ambos            → activa data rooms
Crear contraseña                          → redirige a dashboard
```

- Al terminar: crea `auth.users`, `profiles.account_type = 'broker'|'investor'`, marca la invitación como `accepted`, dispara `document_signatures` sobre la NCNDA y activa los grants pendientes.
- Diseño Institutional Modernist (`data-theme="im-light"`, PAPER/INK/COBALT).

---

## Parte C — Panel admin de invitaciones

Nueva ruta `src/routes/_authenticated.dashboard.invitaciones.tsx` (solo `super_admin` / `admin`):

- Tabla con: correo, rol elegido, estado NCNDA (pending/signed), estado invitación, último email abierto, proyectos con acceso.
- Acciones por fila: **Reenviar** (regenera link+email), **Anular** (revoca grants y marca invitación `void`), **Ver logs** (`email_delivery_events`).
- Botón "Nueva invitación" con formulario (email + rol sugerido + proyectos + trades).

---

## Parte D — Dashboard segmentado por rol

Refactor de `src/routes/_authenticated.dashboard.index.tsx`:

- Lee `profiles.account_type`.
- **Broker** → widgets: Deals abiertos, comisiones pipeline, contactos, NCNDAs pendientes, marketplace de lotes.
- **Cliente/Inversionista** → widgets: Portfolio, alertas catastrales, data rooms accesibles, valuaciones, oportunidades.
- **Admin/Operador** → mantiene su vista actual + acceso al panel de invitaciones.
- Header muestra badge del rol con opción de re-clasificar (solo admin).

---

## Detalles técnicos

**Migraciones**
- `project_invitations`: añadir `data_room_grants jsonb`, `sent_at`, `opened_at`, `signed_at`, `status enum(pending, opened, signed, accepted, void)`.
- Grants: reutilizar `data_room_access_grants` (ya existe) + trigger que active los grants al aceptar la invitación.
- RLS: admin ve todas las invitaciones; el usuario invitado ve solo la suya vía token.

**Server functions** (`src/lib/invitations.functions.ts`)
- `createPartnerInvitation({ email, projects[], trades[], suggestedRole })` — solo admin.
- `getInvitationByToken(token)` — pública.
- `acceptInvitation({ token, role, signatureName, password })` — crea user + firma NCNDA + activa grants.
- `resendInvitation(id)` / `voidInvitation(id)` — admin.

**Correos** — 2 plantillas nuevas en registry:
- `partner-invitation` — envío inicial con NCNDA adjunto.
- `partner-invitation-reminder` — recordatorio a los 3 días si `status != signed`.

**Ejecución inicial (parte A)** — script server-fn `dispatchInitialPartners` que corre una sola vez para Joaquín y Eduardo con acceso a los 4 proyectos + trade cobre. Confirma envío con toast en un botón admin "Enviar ahora".

---

## Orden de implementación
1. Migraciones (invitaciones + grants).
2. Server fns + plantillas de email.
3. Wizard público `/onboarding/$token`.
4. Panel admin de invitaciones + botón "Enviar ahora" para los 2 correos.
5. Dashboard segmentado por rol.
6. Verificar en preview: crear invitación de prueba con tu correo, abrir el flujo completo, confirmar que llegan los pixels y el NCNDA firmado.

## Fuera de alcance
- Firma electrónica cualificada (eIDAS/FEA) — se mantiene la firma simple con QR + IP actual.
- Comisiones automatizadas del broker en deals (queda enganchado el rol, la lógica de split se aborda en otro turno).
