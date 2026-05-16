# PLAN DE MEJORA DE ARQUITECTURA Y PLATAFORMA (GEOCAPITALS)

Este plan aterriza la ejecución técnica para evolucionar Geocapitals desde el estado actual a una plataforma SaaS modular, segura y operable.

## 1) Objetivos de transformación

1. Reducir acoplamiento del monolito funcional (frontend + lógica distribuida).
2. Endurecer seguridad operativa (secretos, service-role, límites de exposición).
3. Formalizar dominios y contratos para escalar equipos y releases.
4. Mejorar confiabilidad operativa (observabilidad, SLOs, jobs robustos).
5. Preparar base comercial SaaS (multi-tenant, analytics, control por plan).

---

## 2) Principios rectores

- **Security by default:** sin secretos embebidos y con privilegios mínimos.
- **Domain-first:** módulos por bounded context con ownership claro.
- **Contracts-first:** handlers/edge functions con schemas versionados.
- **Operability-first:** todo flujo crítico con métricas, trazas y alertas.
- **Incremental delivery:** cambios en slices pequeños, sin “big bang rewrite”.

---

## 3) Workstreams (frentes de trabajo)

## WS-1 Seguridad y gobierno de acceso

### Alcance

- Rotación y saneamiento de secretos.
- Inventario de rutas/funciones que usan `SUPABASE_SERVICE_ROLE_KEY`.
- Hardening de endpoints públicos y cron hooks.

### Entregables

- Matriz de secretos y política de rotación.
- Checklist de exposición por endpoint/edge function.
- Reporte de reducción de superficie de riesgo.

### KPIs

- 0 secretos hardcodeados en repo.
- 100% endpoints críticos con autenticación/autorización validada.

---

## WS-2 Modularización de frontend y capa de aplicación

### Alcance

- Separar módulos por dominio: `deals`, `certification`, `investor-crm`, `data-room`, `analytics`.
- Extraer orquestación de `ProjectMap` y dashboard map en submódulos.
- Introducir capa `application` (casos de uso) entre UI e infraestructura.

### Entregables

- Estructura `src/modules/<dominio>/{ui,application,infra,domain}`.
- Reducción de complejidad de archivos hotspot.
- Guía de arquitectura frontend por módulo.

### KPIs

- > 30% reducción de tamaño/complexidad en hotspots iniciales.
- > 70% de nuevas features implementadas dentro de módulos, no en capas globales.

---

## WS-3 Backend/BFF y jobs de plataforma

### Alcance

- Estandarizar APIs por dominio y contratos I/O.
- Mover procesos pesados síncronos a jobs asincrónicos con reintentos e idempotencia.
- Diseñar patrón de orquestación de sincronizaciones (catastro, PJUD, etc.).

### Entregables

- Convención `/api/<dominio>/<use-case>` + versionado.
- Cola/worker pattern para tareas pesadas.
- Repositorio de contratos (schemas compartidos).

### KPIs

- p95 de endpoints críticos dentro de umbral objetivo.
- Job success rate >99%.

---

## WS-4 Datos, RLS y calidad de esquema

### Alcance

- Auditoría de políticas RLS y funciones `SECURITY DEFINER`.
- Normalización progresiva por dominios (schemas o prefijos consistentes).
- Gobernanza de migraciones (release squashes + estándares).

### Entregables

- Catálogo de políticas por tabla y dominio.
- Plan de normalización de esquema.
- Guía de migraciones con control de calidad.

### KPIs

- 100% tablas críticas con políticas auditadas y documentadas.
- Reducción de regresiones por migraciones.

---

## WS-5 Observabilidad, SRE y operación SaaS

### Alcance

- Trazabilidad request-id end-to-end.
- Dashboards de salud por dominio y tenant.
- SLOs, alertas y runbooks para incidentes.

### Entregables

- Stack mínimo de observabilidad (logs + métricas + trazas).
- Runbooks de incidentes de jobs críticos.
- Panel ejecutivo de confiabilidad.

### KPIs

- MTTR bajo objetivo definido.
- > 95% de incidentes críticos con causa raíz identificada.

---

## 4) Plan por horizontes

## Horizonte 0 (Semana 0–2) — Estabilización inmediata

### Objetivo

Cerrar riesgos críticos de seguridad y preparar base de ejecución.

### Acciones

1. Barrido de secretos hardcodeados y rotación completa.
2. Inventario de service-role usage por archivo/endpoint.
3. Estándar de PR template técnico (riesgo, impacto, métricas).
4. Definir SLO inicial para endpoints y jobs críticos.

### Criterio de salida

- Lista priorizada de remediaciones P0/P1 y backlog técnico validado.

---

## Horizonte 1 (Semana 3–8) — Modularización fundacional

### Objetivo

Crear la estructura modular mínima sin frenar entregas de negocio.

### Acciones

1. Crear `src/modules/deals` y `src/modules/certification` como pilotos.
2. Extraer lógica crítica de dashboard/map a servicios de aplicación.
3. Definir contratos schema-first para rutas/funciones críticas.
4. Migrar 1 proceso síncrono pesado a job asíncrono.

### Criterio de salida

- Primeros dos dominios operan con patrón modular completo.

---

## Horizonte 2 (Semana 9–16) — Escalabilidad operativa

### Objetivo

Aumentar resiliencia y capacidad multi-proyecto sin degradar experiencia.

### Acciones

1. Extender modularización a `investor-crm` y `data-room`.
2. Implementar observabilidad por tenant/proyecto.
3. Formalizar pipeline de datos para analytics cross-módulo.
4. Hardening de RLS en tablas de nuevos dominios.

### Criterio de salida

- Plataforma con operación medible y trazable por tenant.

---

## Horizonte 3 (Semana 17–24) — Plataforma SaaS lista para crecimiento

### Objetivo

Consolidar capabilities de plataforma: multi-tenant, analytics y controles por plan.

### Acciones

1. Tenant management central con límites por plan.
2. Feature flags por plan y control de consumo.
3. Dashboard ejecutivo de embudo end-to-end (deal→cert→investor→contract→exit).
4. Runbooks y simulacros de incidentes operativos.

### Criterio de salida

- Onboarding reproducible de tenants + operación con SLOs y gobierno de costos.

---

## 5) Backlog técnico priorizado (Top 12)

1. Eliminar secretos embebidos en SQL/migrations.
2. Auditar uso de `SUPABASE_SERVICE_ROLE_KEY` y encapsular accesos.
3. Extraer módulo `deals` con entidades y permisos.
4. Extraer módulo `certification` con reglas/evidencias/workflow.
5. Refactor de `ProjectMap` en submódulos (layers/tools/inspectors).
6. Contratos comunes (Zod/JSON schema) para rutas y edge functions.
7. Job runner para syncs y cómputos pesados.
8. Estándar de idempotencia/retry para jobs.
9. Catálogo RLS + revisión de `SECURITY DEFINER`.
10. Trazabilidad end-to-end con request-id.
11. Dashboards de errores/latencia/throughput por dominio.
12. Feature flags y límites por tenant/plan.

---

## 6) Riesgos de implementación y mitigaciones

- **Riesgo:** detener entrega de negocio por exceso de refactor.  
  **Mitigación:** enfoque dual-track (producto + plataforma) con cuotas fijas por sprint.

- **Riesgo:** inconsistencias entre módulos por falta de contratos.  
  **Mitigación:** schema-first obligatorio en PRs de APIs/edge.

- **Riesgo:** debt histórico de migraciones complica cambios.  
  **Mitigación:** ventana de normalización + release squashes.

- **Riesgo:** sobrecostos de observabilidad/infra.  
  **Mitigación:** instrumentación progresiva enfocada en flujos críticos.

---

## 7) Modelo de gobierno de ejecución

- **SteerCo semanal (45 min):** CTO/Tech Lead/Product.
- **Architecture review board quincenal:** aprobación de decisiones de alto impacto.
- **Definition of Done técnica obligatoria:**
  - seguridad validada,
  - contratos actualizados,
  - métricas instrumentadas,
  - documentación mínima por módulo.

---

## 8) PRs macro sugeridos (orden)

1. `security: limpieza y rotación de secretos + hardening de endpoints`.
2. `refactor(frontend): estructura modular base (deals/certification)`.
3. `feat(platform): contratos schema-first compartidos`.
4. `feat(platform): framework de jobs asíncronos con retry/idempotencia`.
5. `refactor(data): catálogo RLS y hardening de security definer`.
6. `feat(observability): logs, métricas, trazas y alertas por dominio`.
7. `feat(saas): tenant management + feature flags por plan`.

---

## 9) Definición de éxito del plan

El plan se considera exitoso si, al cierre del Horizonte 3:

- la plataforma opera con seguridad reforzada,
- los dominios críticos están modularizados,
- los flujos pesados están orquestados de forma confiable,
- existe visibilidad operativa por tenant,
- y la base SaaS permite escalar producto y negocio sin refactor estructural mayor.
