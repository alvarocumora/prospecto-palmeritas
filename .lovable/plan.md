
El usuario reporta dos cosas:
1. **Login no funciona** — pero los logs muestran que SÍ se autentica (`alvaro.cumora@gmail.com` entra, perfil carga, llega a `/dashboard/catastro`). El problema real es: **0 proyectos** → la app queda en estado "Sin proyectos" sin guiarlo a crear uno. Además hay error de hidratación SSR del spinner de loading.
2. Pide **estructura de perfiles + módulos visibles por rol** y un **plan disruptivo** para la plataforma.

## Diagnóstico del "login roto"

- Network: `signInWithPassword` ✓, `/profiles` ✓, `/projects` devuelve `[]` ✓.
- El usuario YA está autenticado pero no tiene proyectos, así que nunca ve contenido real.
- Hidratación SSR rompe porque `useAuth` arranca con `loading=true` en server pero el cliente hidrata diferente — el spinner full-screen en `_authenticated.tsx` es el culpable.
- Sidebar/nav muestra TODOS los módulos sin importar rol → confunde.

## Plan disruptivo (3 fases)

### FASE 1 — Fix inmediato de UX (esta entrega)

**A. Onboarding obligatorio post-login**
Si el usuario tiene 0 proyectos, redirigir automáticamente desde `/dashboard/*` → `/dashboard/projects` con un wizard de bienvenida (3 pasos: nombre proyecto, commodity, ubicación en mapa). Nada de pantallas vacías.

**B. Arreglar hidratación SSR**
- En `_authenticated.tsx`: usar `<Suspense>` o renderizar `null` durante `loading` en SSR para evitar mismatch.
- En `useAuth`: inicializar `loading=false` en server, mantener `true` solo en cliente hasta resolver `getSession()`.

**C. Sistema de roles visible por módulo**
Ya existe `project_role` enum (`owner | admin | geologist | viewer`) y función `has_project_role`. Falta:
- Crear hook `useProjectRole()` que devuelve el rol del usuario en el proyecto activo.
- Componente `<RoleGate roles={[...]}>` para envolver navegación y acciones.
- Filtrar el sidebar y bottom-nav según rol:

```text
                 owner  admin  geologist  viewer
Resumen            ✓      ✓       ✓         ✓
Catastro           ✓      ✓       ✓         ✓ (read)
Geofísica          ✓      ✓       ✓         ✓ (read)
Sondajes           ✓      ✓       ✓         ✓ (read)
Muestreo           ✓      ✓       ✓         ✓ (read)
Palmeras (AI)      ✓      ✓       ✓         —
Proyectos/Equipo   ✓      ✓       —         —
Ajustes/Billing    ✓      —       —         —
```

- Badges visuales del rol al lado del nombre del proyecto.
- Botones de crear/editar/borrar ocultos o deshabilitados con tooltip "Requiere rol X" para `viewer`.

**D. Empty states accionables**
Cada módulo (Catastro, Geofísica, Sondajes, Muestreo) cuando esté vacío muestra un CTA grande: "Importar CSV", "Dibujar primer polígono", "Crear primer sondaje" — no más pantallas en blanco.

### FASE 2 — Estructura de perfiles ampliada (siguientes iteraciones, NO en esta entrega)

- **Perfiles ricos**: especialidad (geólogo de exploración / geotécnico / geofísico / catastro), certificaciones (QP NI 43-101), foto, organización, teléfono, idioma.
- **Tipos de cuenta**: Solo / Equipo / Empresa con límites distintos.
- **Invitaciones por email** con link mágico, asignación de rol al aceptar.
- **Auditoría** (quién cambió qué, cuándo) — tabla `audit_log`.

### FASE 3 — Disrupción de plataforma (visión, NO en esta entrega)

- **Dashboard ejecutivo** con KPIs cross-proyecto (m perforados, leyes promedio, intercepts del mes, CapEx geofísico).
- **Asistente IA geológico** (Lovable AI + Gemini Pro) con contexto del proyecto: "¿dónde perforar siguiente?", auto-redacción de NI 43-101.
- **Modo offline-first robusto** para campo (ya hay `useOfflineQueue`, expandirlo a sondajes y muestreo).
- **Marketplace de capas** (geología regional, satelital, alteración hiperespectral) compartibles entre proyectos.
- **Time machine** del proyecto: ver el estado del catastro/sondajes en cualquier fecha pasada.
- **Reportes one-click**: NI 43-101, JORC, technical brief, inversor pitch — todo desde los datos del proyecto.

## Esta entrega (Fase 1) — Archivos a editar

- **edit** `src/hooks/useAuth.tsx`: `loading` inicial `false` en SSR, evitar mismatch.
- **edit** `src/routes/_authenticated.tsx`:
  - reemplazar spinner full-screen por `null` durante `loading` (evita hidratación)
  - en `beforeLoad` o efecto: si `projects.length === 0` y ruta ≠ `/dashboard/projects`, redirigir
  - filtrar `NavItem` y `MobileBottomNav` por rol del proyecto activo
  - mostrar badge de rol junto al proyecto activo
- **new** `src/hooks/useProjectRole.ts`: devuelve rol del usuario en `active.id`.
- **new** `src/components/RoleGate.tsx`: wrapper `{children}` que oculta/disable según rol.
- **new** `src/components/OnboardingWizard.tsx`: 3 pasos para crear primer proyecto (nombre, commodity, lat/lng), inserta en `projects` (el trigger ya añade al usuario como `owner`).
- **edit** `src/routes/_authenticated.dashboard.projects.tsx`: si no hay proyectos, mostrar `<OnboardingWizard />` en vez de lista vacía.
- **edit** `src/routes/_authenticated.dashboard.index.tsx`: empty states accionables con links directos a importar/crear.
- **edit** módulos (Catastro, Geofísica, Sondajes, Muestreo): mostrar empty states con CTAs cuando no hay datos.

Sin cambios en DB — el esquema de roles ya existe y funciona.
