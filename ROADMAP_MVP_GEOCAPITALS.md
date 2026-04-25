# ROADMAP MVP GEOCAPITALS

Base estratégica: este roadmap deriva del diagnóstico en `DIAGNOSTICO_SAAS_ARQUITECTURA.md` y lo traduce a ejecución por fases, priorizando time-to-market sin comprometer escalabilidad SaaS.

## Supuestos de ejecución
- Horizonte total sugerido: 2 trimestres (iterativo, con releases quincenales).
- Enfoque: entregar valor de negocio por fase con hardening técnico incremental.
- Regla de arquitectura: cada fase debe dejar módulos más desacoplados que al inicio.

---

## Fase 1 — Dashboard + Deals + Certificadores

### Objetivo
Lanzar un núcleo comercial-operativo que conecte visibilidad ejecutiva (dashboard), pipeline de deals y red de certificadores/QPs en un flujo usable de punta a punta.

### Módulos
- Executive Dashboard
- Deals Pipeline
- Certificadores / QPs Registry
- Access & Roles (mínimo necesario)

### Componentes
- **Dashboard v1**
  - KPIs base: deals activos, estado de certificación, próximos hitos, riesgos críticos.
  - Widgets por proyecto con filtros por fecha/estado.
- **Deals Board v1**
  - Kanban por etapa (sourcing, review, due diligence, term-sheet, cerrado).
  - Entidades: `deals`, `deal_stages`, `deal_notes`, `deal_owners`.
- **Certificadores v1**
  - Catálogo de QPs/certificadores con especialidad, jurisdicción, estado de disponibilidad.
  - Matching manual deal ↔ certificador.
- **Permisos iniciales**
  - Roles mínimos: owner/admin/manager/viewer + certificador externo.

### Riesgos
- Scope creep por querer incluir scoring avanzado demasiado temprano.
- Inconsistencia entre pipeline comercial y estados de certificación.
- UX fragmentada si dashboard y deals no comparten modelo de datos/eventos.

### Criterios de éxito
- Un deal puede crearse, avanzar de etapa y asignarse a un certificador en <10 minutos.
- Dashboard refleja estados de deals y certificaciones con latencia funcional aceptable (near-real-time o refresh predecible).
- Al menos 3 perfiles de rol funcionando con restricciones visibles y auditables.

### PRs sugeridos
1. `feat(deals): crear esquema inicial de deals y pipeline`  
   - tablas + RLS + hooks + ruta `/dashboard/deals`.
2. `feat(certifiers): registro de certificadores y asignación a deal`  
   - catálogo, formulario, panel de asignación.
3. `feat(dashboard): widgets ejecutivos conectados a deals/certificadores`.
4. `refactor(auth): endurecer capacidades por módulo en navegación y acciones`.

---

## Fase 2 — Certification Engine

### Objetivo
Implementar el motor de certificación para transformar evidencias y reglas en estado certificable, trazable y auditable.

### Módulos
- Certification Rules
- Evidence Management
- Certification Workflow
- Signature & Audit Integration

### Componentes
- **Motor de reglas v1**
  - Definición de estándares (NI 43-101/JORC u otros perfiles internos).
  - Evaluación automática de cumplimiento por regla.
- **Evidencias**
  - Vinculación de evidencias por criterio (documento, dato estructurado, fuente).
  - Trazabilidad: quién cargó, cuándo, versión.
- **Workflow de certificación**
  - Estados: draft, in-review, action-required, certified, rejected.
  - Checklist obligatorio y score mínimo configurable.
- **Firmas y auditoría**
  - Integración con sobres de firma y bitácora de eventos inmutable.

### Riesgos
- Reglas ambiguas por estándar/jurisdicción.
- Falsos positivos/negativos en autoevaluación sin calibration loop.
- Cuello de botella en revisión manual si UX de evidencias no es clara.

### Criterios de éxito
- Un reporte técnico puede evaluarse y emitir estado certificable con trazabilidad completa.
- Toda certificación tiene evidencia mínima obligatoria y cadena de auditoría.
- Tiempo de revisión manual reducido frente al proceso ad-hoc previo.

### PRs sugeridos
1. `feat(cert-engine): framework de reglas y evaluador de cumplimiento`.
2. `feat(evidence): modelo y UI de evidencia enlazada por regla`.
3. `feat(workflow): estados y transiciones de certificación con permisos`.
4. `feat(audit): consolidar audit trail de certificación + firmas`.

---

## Fase 3 — Investor CRM + Exits

### Objetivo
Habilitar una capa comercial/financiera para relacionamiento con inversionistas y gestión de rutas de salida (exit paths) por activo/deal.

### Módulos
- Investor CRM
- Pipeline de Interacciones
- Exit Strategy Manager
- Confidentiality Controls

### Componentes
- **CRM inversionistas v1**
  - Fichas de inversionista, tesis, ticket objetivo, geografía, preferencias de riesgo.
  - Timeline de interacciones (llamadas, correos, reuniones, follow-ups).
- **Deal distribution**
  - Matching deal ↔ inversionistas.
  - Estado de interés y probabilidad de avance.
- **Exits**
  - Plantillas de estrategia: sale, JV, farm-out, royalty, licensing.
  - Hitos y dependencias por estrategia.
- **Controles de confidencialidad**
  - Visibilidad por deal y por documento compartido.

### Riesgos
- Riesgo legal/compliance por manejo de información sensible de terceros.
- Dispersión de datos si CRM y deals evolucionan con contratos distintos.
- Sobrecomplejidad del scoring de inversionistas prematuramente.

### Criterios de éxito
- Se puede registrar pipeline de inversionistas activo por deal con historial completo.
- Cada deal tiene al menos una estrategia de exit definida y estado rastreable.
- Controles de acceso evitan exposición cruzada entre proyectos/tenants.

### PRs sugeridos
1. `feat(crm): entidades base de inversionistas e interacciones`.
2. `feat(deals): relacionar deal-inversor con estados y score simple`.
3. `feat(exits): módulo de estrategias de salida por deal`.
4. `security(rbac): reforzar políticas de confidencialidad comercial`.

---

## Fase 4 — Data Room + Contracts

### Objetivo
Estandarizar colaboración transaccional con data room seguro y ciclo de contratos versionado + firmado.

### Módulos
- Virtual Data Room
- Contract Lifecycle
- Permissions & External Access
- Document Integrity

### Componentes
- **Data Room v1**
  - Estructura por deal/proyecto con carpetas y metadata de documentos.
  - Compartición granular con expiración y watermark.
- **Contract lifecycle**
  - Plantillas, borradores, redlines, versiones, aprobación y firma.
  - Estados contractuales y recordatorios de vencimiento/renovación.
- **Integridad documental**
  - Hash por versión, evidencia de firma, trail de acceso/descarga.
- **Portal externo controlado**
  - Acceso de terceros (inversionistas/abogados/certificadores) con permisos acotados.

### Riesgos
- Exposición accidental de documentos por configuración errónea.
- Falta de coherencia entre estado contractual y estado real de negociación.
- Escalamiento de costo storage/egress sin políticas de retención.

### Criterios de éxito
- Data room operativo con compartición granular y auditoría de acceso.
- Contratos con versionado claro y trazabilidad desde draft hasta firma.
- Incidentes de acceso no autorizado = 0 en pruebas de seguridad internas.

### PRs sugeridos
1. `feat(data-room): buckets, metadata y permisos granulares`.
2. `feat(contracts): flujo contractual con versionado y estados`.
3. `feat(signatures): integración contractual con sobres de firma`.
4. `chore(security): hardening de acceso externo + expiraciones`.

---

## Fase 5 — Analytics + Multi-tenant SaaS

### Objetivo
Convertir el producto en plataforma SaaS escalable con analítica transversal, observabilidad operativa y aislamiento robusto por tenant.

### Módulos
- SaaS Tenant Management
- Analytics & BI
- Platform Operations (SRE)
- Billing & Plan Controls (base)

### Componentes
- **Multi-tenant management**
  - Tenant provisioning, límites por plan, aislamiento reforzado (RLS + controles app).
  - Administración central (super-admin) con métricas por tenant.
- **Analytics 360**
  - Embudo deals→certificación→inversionista→contrato→exit.
  - Dashboards por tenant, por proyecto y por rol.
- **SRE/observabilidad**
  - Logs estructurados, tracing por request-id, alertas por SLO.
  - Telemetría de jobs críticos (sync, certificación, firmas, IA).
- **Base de monetización**
  - Flags por plan, consumo por módulo, base para billing futuro.

### Riesgos
- Deuda técnica previa limita velocidad de escalado multi-tenant.
- Costos de infraestructura/IA crecen sin controles de uso por tenant.
- Falta de estandarización de eventos impide analítica confiable.

### Criterios de éxito
- Onboarding de nuevos tenants repetible y automatizable.
- KPIs clave accesibles en dashboards ejecutivos con consistencia de datos.
- SLOs definidos y monitoreados para operaciones críticas.
- Base preparada para planes/comercialización SaaS sin refactor mayor.

### PRs sugeridos
1. `feat(tenancy): gestión de tenants, límites y administración global`.
2. `feat(analytics): modelo de eventos y dashboards cross-módulo`.
3. `feat(observability): tracing, métricas y alertas por dominio`.
4. `feat(plans): feature flags por plan y control de consumo`.

---

## Dependencias transversales (todas las fases)
- Seguridad: eliminar secretos hardcodeados, rotación de claves y controles service-role.
- Calidad: contratos API/edge (schemas), pruebas de integración por dominio.
- Arquitectura: separación progresiva por módulos (`ui/application/infra/domain`).
- Gobernanza: catálogo de eventos y definiciones KPI únicas.

## Orden recomendado de ejecución de PRs (macro)
1. Seguridad y base de datos (hardening).
2. Módulos funcionales de negocio (deals/certificación).
3. Colaboración transaccional (data room/contracts).
4. Capa plataforma (analytics + multi-tenant + observabilidad).

## Definición de “MVP listo para mercado”
Se considera MVP comercial cuando Fase 1 + Fase 2 estén productivas, con:
- flujo deal → certificación completo,
- trazabilidad auditada,
- roles operativos estables,
- latencia y confiabilidad dentro de umbrales aceptables para operación diaria.
