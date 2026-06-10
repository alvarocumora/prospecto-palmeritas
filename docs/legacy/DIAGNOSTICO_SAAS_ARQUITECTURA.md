# Diagnóstico estratégico del repositorio (Prospecto Palmeritas)

Fecha de análisis: 2026-04-25.

## 1) Arquitectura actual

### Frontend

- SPA/SSR híbrida con **TanStack Start + React 19 + Vite 7**, desplegable en Cloudflare Workers vía `wrangler`. El router es file-based (`src/routes/*`) y existe un layout autenticado monolítico que concentra navegación, permisos y shell de aplicación.
- La experiencia principal es **mapa operativo** (`/dashboard/map`) con una composición muy grande de capas, herramientas de dibujo, medición, snapshot, paneles y modo 3D.
- Estado de datos en cliente con hooks custom (sin una capa de dominio separada): muchos hooks consultan Supabase directamente desde UI/hooks.

### Backend / BFF

- No hay backend tradicional (Node/Go/etc.) separado.
- Se combinan dos estilos de backend:
  1. **Server handlers** en rutas TanStack (`src/routes/api.public.*`) para endpoints HTTP públicos/internos.
  2. **Supabase Edge Functions (Deno)** para procesos intensivos de negocio (catastro sync, IA, geoprocesos, firma, economía, compliance).
- El patrón dominante es “frontend + Supabase”, con lógica de negocio repartida entre cliente, SQL (RLS/triggers) y edge functions.

### Base de datos

- Base de datos PostgreSQL en Supabase con fuerte uso de **RLS + funciones SQL SECURITY DEFINER + triggers**.
- El tipado generado (`src/integrations/supabase/types.ts`) evidencia un dominio amplio (exploración, QA/QC, drones, catastro, economía, compliance, firmas, marketplace).
- Hay alto volumen de migraciones en poco tiempo (37 archivos), lo que sugiere evolución rápida y potencial deuda de esquema/versionado.

## 2) Problemas técnicos, deuda técnica y archivos críticos

### Problemas y deuda técnica detectada

1. **Monolito frontend en zonas clave**
   - `ProjectMap.tsx` y `dashboard/map` concentran demasiada responsabilidad (UI, orquestación de capas, integración de datos, herramientas, controles responsive, side effects, exportes).
   - Riesgo: baja mantenibilidad, regresiones por acoplamiento, costos altos de onboarding.

2. **Lógica de negocio distribuida sin capa de aplicación clara**
   - Parte de reglas vive en SQL/triggers, otra en edge functions, otra en hooks/UI.
   - Riesgo: duplicación de reglas, inconsistencia entre caminos de ejecución, dificultad para test end-to-end determinista.

3. **Seguridad: secreto hardcodeado en migración de cron**
   - En una migración se define `cron.schedule(... net.http_post(... Authorization: Bearer ...))` con token embebido en SQL.
   - Riesgo crítico: exposición de credenciales y rotación difícil.

4. **Uso intensivo de `service_role` en server/edge paths**
   - Varios flujos administrativos operan con service role y lógica ad hoc; correcto para jobs internos, pero exige fuerte disciplina de límites y auditoría.
   - Riesgo: escalamiento de privilegios accidental si algún endpoint queda mal expuesto.

5. **Churn de migraciones y crecimiento de dominio sin bounded contexts explícitos**
   - Muchas entidades (geología, legal, financiera, drones, firmas, compliance, marketplace) en un mismo esquema `public`.
   - Riesgo: fricción de cambios, impacto transversal y dificultad de ownership por equipo.

6. **Compatibilidad de toolchain inconsistente**
   - Coexisten `bun.lockb` y `package-lock.json`; puede crear builds no reproducibles entre entornos.

7. **Capacidad/performance potencialmente limitada en procesos síncronos**
   - Ejemplo: sincronización de catastro procesa concesiones en loop secuencial con llamadas externas por concesión.
   - Riesgo: latencia alta, timeouts, costos y baja elasticidad bajo crecimiento multi-tenant.

### Archivos críticos (hotspots)

- **Arquitectura app/routing**: `src/routes/_authenticated.tsx`, `src/routes/_authenticated.dashboard.map.tsx`, `src/components/ProjectMap.tsx`.
- **Datos/autenticación**: `src/hooks/useAuth.tsx`, `src/hooks/useProjects.ts`, `src/integrations/supabase/client.server.ts`, `src/integrations/supabase/auth-middleware.ts`.
- **Dominio/seguridad DB**: migraciones de multi-tenancy, RLS y funciones helper (`20260418220643_...sql`) + migraciones de cron/sync (`20260420132729_...sql`).
- **Orquestación operacional**: `src/routes/api.public.sync-catastro.ts` + `supabase/functions/sync-catastro/index.ts`.
- **IA y analítica**: `supabase/functions/geo-assistant/index.ts`, `supabase/functions/prospectivity-grid/index.ts`, `supabase/functions/geochem-fingerprint/index.ts`.

## 3) ¿Puede escalar como plataforma SaaS?

### Respuesta corta

**Sí, pero no de forma sana a gran escala sin refactor estructural.**

### Lo que ya está bien para SaaS

- Multi-tenant real con membresía por proyecto y RLS madura.
- Superficie funcional amplia (operación minera end-to-end) con diferenciadores de producto (mapa operacional + IA + compliance + firmas).
- Arquitectura cloud-native (Supabase + edge) favorable para iteración rápida.

### Lo que limita el escalamiento

- Acoplamiento alto en frontend core y reparto difuso de reglas.
- Falta de capa de servicios de dominio versionada y testeable.
- Procesos batch/sync de diseño más “MVP” que “plataforma robusta”.
- Riesgos de seguridad operativa (secretos en SQL, service-role sprawl).

## 4) Propuesta de nueva arquitectura modular

## Objetivo

Pasar de “feature monolith” a una **arquitectura modular por dominios**, manteniendo Supabase como pilar de datos/autenticación, pero con contratos claros entre capas.

### 4.1 Módulos de dominio (bounded contexts)

Separar en módulos explícitos (código + ownership + métricas):

1. **Identity & Access** (auth, perfiles, membresía, RBAC/RLS)
2. **Cadastre & Legal** (concesiones, boletín, PJUD, alertas)
3. **Field Operations** (geofísica, drones, drilling, sampling)
4. **Resource Intelligence** (targets, prospectivity, resource models, economics)
5. **Governance & Compliance** (QA/QC, approvals, audit, NI 43-101, firmas)
6. **Collaboration** (team, invitations, annotations, realtime)

### 4.2 Estructura de código recomendada

- `src/modules/<dominio>/`
  - `ui/` (componentes de presentación)
  - `application/` (casos de uso)
  - `infra/` (adaptadores Supabase/API)
  - `domain/` (tipos, reglas puras)
- `src/shared/` para cross-cutting (design system, logging, feature flags, observabilidad, errores).

### 4.3 Backend/BFF modular

- Mantener TanStack server handlers y edge functions, pero introducir convención:
  - `/api/<dominio>/<use-case>` (versionado semántico cuando aplique)
  - Edge functions por dominio con contratos de entrada/salida formales (Zod/JSON Schema).
- Jobs pesados asíncronos con cola/eventos (en vez de loops síncronos de larga duración).

### 4.4 Datos y gobernanza

- Mantener RLS, pero:
  - estandarizar políticas por dominio,
  - auditar y limitar `SECURITY DEFINER`,
  - mover secretos fuera de SQL hardcodeado,
  - introducir `schema` por dominio o al menos prefijos + ownership.
- Añadir migraciones “squash” por release mayor para reducir fricción histórica.

### 4.5 Observabilidad y SRE mínimo SaaS

- Trazabilidad de request-id en frontend → api handler → edge function → DB.
- Dashboards de latencia/errores por dominio.
- Alertas de jobs (sync-catastro, sync-pjud, IA, firmas) con SLOs.

## 5) Roadmap por etapas (MVP → Escalabilidad → IA)

### Etapa A — MVP robusto (0-8 semanas)

**Meta:** estabilizar base técnica y seguridad sin frenar negocio.

- A1. Seguridad operativa inmediata
  - Rotar y eliminar cualquier token embebido en migraciones/hardcode.
  - Inventario de endpoints con service role + checklist de exposición.
- A2. Modularización inicial frontend
  - Extraer `ProjectMap` y `/dashboard/map` en submódulos (layers, tools, inspectors, exports).
- A3. Contratos y validación
  - Esquemas de input/output para handlers y edge functions críticas.
- A4. Calidad de build
  - Unificar package manager/lockfile.
  - Pipeline CI mínimo: lint + typecheck + smoke tests API.

**KPI de salida Etapa A:**

- 0 secretos hardcodeados.
- 80% de endpoints críticos con contrato validado.
- Reducción de tamaño/complexidad de archivos hotspot (>30%).

### Etapa B — Escalabilidad SaaS (2-4 meses)

**Meta:** soportar crecimiento multi-proyecto/multi-equipo sin degradación.

- B1. Bounded contexts reales
  - Separar ownership por módulos y roadmaps independientes.
- B2. Procesamiento asíncrono
  - Migrar syncs y cómputos pesados a jobs con reintentos/idempotencia.
- B3. Observabilidad completa
  - Métricas por tenant/proyecto (latencia, error rate, costo IA, throughput jobs).
- B4. Hardening DB
  - Revisión de índices por consulta real, pruebas de carga y tuning RLS.

**KPI de salida Etapa B:**

- p95 de operaciones críticas dentro de objetivo definido.
- Job success rate > 99%.
- MTTR de incidentes operativos < objetivo.

### Etapa C — Capa IA de plataforma (4-8 meses)

**Meta:** pasar de features IA aisladas a plataforma IA gobernada.

- C1. AI Gateway interno
  - Unificar prompts, políticas, costos, fallback de modelos, tracing y redaction.
- C2. Knowledge layer por proyecto
  - Índices/vectorización de documentos técnicos, reportes, historial operativo.
- C3. IA accionable
  - Recomendaciones explicables (drilling next-best-action, riesgos compliance, alertas predictivas).
- C4. AI governance
  - Versionado de prompts/modelos, evaluación offline, guardrails y auditoría.

**KPI de salida Etapa C:**

- % de respuestas IA con evidencia trazable.
- Reducción medible de tiempo de análisis por geólogo.
- Control de costo IA por proyecto/usuario.

---

## Conclusión ejecutiva

El repositorio ya tiene una base funcional potente y diferencial para minería, pero hoy opera como un monolito de features aceleradas. La prioridad estratégica no es “agregar más módulos”, sino **modularizar y endurecer seguridad/operación** para convertirlo en SaaS escalable de verdad.
