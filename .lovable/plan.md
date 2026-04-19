
User asks for a senior geology engineer's strategic plan to evolve this into "the best functional mining platform in the world" with order, structure, modules and roles from the start. This is a strategic/architectural plan, not a single feature. Let me look at what exists.

Current modules I can see in routes: dashboard (overview, admin, audit, campaigns, catastro, drilling, drones, geophysics, index, map, marketplace, palmeras, profile, projects, sampling, team). Roles already defined: owner/admin/geologist/viewer + super_admin. Tables cover: projects, members, invitations, drill_holes, drill_core_logs, sampling_results, geophysics (surveys/lines/stations), drone_flights/rasters, campaigns, concessions, geology reference (litho/alteration/mineralogy/features/refs), map_views, shared_layers, audit_log.

So the foundation is solid. The user wants a senior-eyed roadmap: maturity gaps, missing modules, role refinement, data governance, QA/QC, reporting standards (NI 43-101, JORC), and a phased plan.

I'll structure it as:
1. Diagnóstico actual (what exists, what's missing)
2. Visión (target state)
3. Modelo de roles refinado
4. Mapa de módulos completo (current + missing)
5. Estándares y gobernanza de datos
6. Roadmap por fases (12 meses)
7. Quick wins próximos

Keep concise, in Spanish (user writes in Spanish), no implementation code, just the plan.

---

# Plan estratégico: TrackMin / Geocapitals como plataforma minera de clase mundial

## 1. Diagnóstico actual (lo que ya tienes)

**Sólido:**
- Multi-proyecto con membresías y roles (owner/admin/geologist/viewer + super_admin)
- Módulos clave operativos: Mapa (Centro de Operaciones), Catastro, Geofísica, Sondajes, Muestreo, Drones, Campañas, Palmeras, Equipo, Auditoría
- RLS por proyecto en todas las tablas críticas
- Exportación PDF NI 43-101 inicial, snapshot de mapa, mini-mapa, section builder
- Datos de referencia geológica (litología, alteración, mineralogía, features, bibliografía)

**Brechas que un senior detectaría:**
- No hay **QA/QC formalizado** (blanks/standards/duplicates con control charts y umbrales por lab)
- No hay **versionado/aprobación de datos** (un log puede editarse sin workflow de revisión)
- No hay **modelo 3D ni recursos** (block model, dominios, estimación, clasificación Inferred/Indicated/Measured)
- No hay **HSE/permisos/comunidad** (incidentes, permisos ambientales, relacionamiento comunitario)
- No hay **costos/presupuesto por campaña** consolidado (hay cost_usd suelto en surveys)
- No hay **pipeline de targets** (generación → priorización → drill-ready)
- No hay **inventario físico** (testigos, pulpas, rechazos, almacén)
- Roles binarios — falta granularidad por módulo (ej. "QA/QC officer", "drill supervisor", "project geologist")

---

## 2. Visión: ¿qué define "la mejor plataforma minera del mundo"?

Cinco principios no-negociables:

1. **Cadena de custodia trazable** — todo dato (muestra, intervalo, lectura) tiene origen, timestamp, autor, certificado y se puede auditar end-to-end.
2. **Estándares industriales** — CIM/JORC/NI 43-101, formatos AcQuire/Leapfrog/Datamine intercambiables.
3. **Offline-first en campo** — geólogo en cordillera sin señal sigue trabajando, sincroniza al volver.
4. **Roles granulares + workflow de aprobación** — QA/QC officer firma antes de publicar; geólogo propone, supervisor aprueba.
5. **Decisión, no solo datos** — el mapa y los reportes responden "¿dónde perforo el próximo hoyo y por qué?".

---

## 3. Modelo de roles refinado (granular por módulo)

Pasar de 4 roles globales a **roles base + capacidades por módulo**:

| Rol base | Alcance |
|---|---|
| `owner` | Dueño del proyecto, único que borra/transfiere |
| `project_manager` | Admin operativo, presupuesto, miembros |
| `chief_geologist` | Aprueba interpretaciones, firma reportes |
| `geologist` | Captura datos, propone targets |
| `qaqc_officer` | Valida lab, firma certificados, gestiona blanks/standards |
| `field_technician` | Solo captura en campo (móvil), sin edición histórica |
| `drilling_supervisor` | Gestiona contratistas, avance diario, costos |
| `hse_officer` | Incidentes, permisos, monitoreo ambiental |
| `community_relations` | Stakeholders, compromisos, comunicaciones |
| `viewer` / `external_consultant` | Solo lectura, con expiración opcional |
| `super_admin` | Plataforma (ya existe) |

**Capacidades como flags adicionales** (`can_approve_assays`, `can_publish_reports`, `can_export_confidential`) almacenadas en tabla `project_member_capabilities` para casos especiales sin multiplicar roles.

---

## 4. Mapa de módulos: actual + faltantes

```text
EXPLORACIÓN                   OPERACIÓN              GOBIERNO
├─ Catastro          ✅      ├─ Sondajes      ✅    ├─ Equipo & Roles  ✅
├─ Geofísica         ✅      ├─ Muestreo      ✅    ├─ Auditoría       ✅
├─ Geoquímica        ⚠️      ├─ QA/QC         ❌    ├─ Permisos        ❌
├─ Mapa Geológico    ⚠️      ├─ Logística     ❌    ├─ HSE             ❌
├─ Drones/LiDAR      ✅      ├─ Inventario    ❌    ├─ Comunidad       ❌
├─ Targets Pipeline  ❌      ├─ Costos/Budget ⚠️    ├─ Documentación   ❌
                              │                      ├─ Reportes (NI/JORC) ⚠️
MODELAMIENTO                                          └─ Marketplace     ✅
├─ Modelo Geológico 3D ❌
├─ Block Model         ❌
├─ Recursos & Reservas ❌
├─ Section Builder    ✅
```

**Leyenda:** ✅ existe · ⚠️ parcial · ❌ falta

### Módulos nuevos prioritarios

1. **QA/QC** — control charts blanks/standards/duplicates, umbrales por elemento, alertas, firma electrónica del oficial QA
2. **Targets Pipeline** — Kanban (Generated → Validated → Drill-Ready → Drilled → Closed) con scoring multicriterio
3. **HSE** — incidentes, near-miss, permisos ambientales con vencimientos
4. **Inventario físico** — testigos, pulpas, rechazos, ubicación en sala de cores, chain of custody
5. **Costos & Presupuesto** — por campaña, vs real, drill cost por metro, alertas de overrun
6. **Documentación** — repositorio versionado (informes, mapas, contratos) con control de acceso
7. **Modelo 3D / Recursos** — integración con Leapfrog/Micromine (export DXF/CSV) o visor 3D propio (deck.gl)

---

## 5. Estándares y gobernanza de datos

- **Diccionario único de litología/alteración/mineralización** por proyecto (ya existe base, falta UI de edición y bloqueo post-aprobación)
- **Coordenadas:** estandarizar a WGS84 + zona UTM por proyecto, validar en captura
- **Certificados de laboratorio** como entidad de primera clase (PDF + parsing) ligados a lotes de muestras
- **Workflow de estados** para datasets: `draft → review → approved → published → archived`
- **Audit log** ya existe → exponer UI de "ver historial de este registro" en cada entidad
- **Backups y export full** del proyecto en formato estándar (CSV + GeoJSON + ZIP) bajo demanda del owner

---

## 6. Roadmap por fases (12 meses)

```text
FASE 1 — Fundamentos de calidad (mes 1-2)  [bloqueante para cualquier reporte serio]
├─ QA/QC módulo completo (blanks, standards, duplicates, control charts)
├─ Roles granulares + capacidades por módulo
├─ Workflow draft→review→approved en sondajes y muestreo
└─ Diccionarios bloqueables por proyecto

FASE 2 — Decisión exploratoria (mes 3-4)
├─ Targets Pipeline (Kanban + scoring)
├─ Inventario físico de cores y muestras
├─ Costos & Budget por campaña con dashboard ejecutivo
└─ Documentación versionada

FASE 3 — Gobernanza y cumplimiento (mes 5-6)
├─ HSE (incidentes, permisos)
├─ Comunidad & stakeholders
├─ Reportes NI 43-101 / JORC completos con firma del CP
└─ Export full del proyecto

FASE 4 — Modelamiento (mes 7-9)
├─ Visor 3D (drill traces, intercepts, superficies)
├─ Sections múltiples y fence diagrams
├─ Export a Leapfrog/Micromine/Datamine
└─ Estimación simple (IDW, vecino más cercano) para targets

FASE 5 — Inteligencia y escala (mes 10-12)
├─ AI Assistant geológico (ya iniciado) → recomendaciones de targets
├─ Detección automática de anomalías en geoquímica/geofísica
├─ Multi-tenant white-label para juniors mineras
└─ API pública + integraciones (Leapfrog, AcQuire, ArcGIS)
```

---

## 7. Quick wins próximos (próximas 2-3 semanas)

Si quieres avanzar ya con impacto alto y esfuerzo medio:

1. **Refinar matriz de roles** — añadir `chief_geologist`, `qaqc_officer`, `drilling_supervisor` y `field_technician` a la enum + permisos por módulo
2. **QA/QC mínimo viable** — vista de blanks/standards con control chart y semáforo verde/amarillo/rojo (los datos ya entran por el assay parser)
3. **Workflow de aprobación** — campo `status: draft|review|approved` en `drill_core_logs` y `sampling_results` + filtro por defecto "approved" en mapa
4. **Vistas guardadas (`map_views`)** — la tabla ya existe, falta UI de guardar/cargar
5. **Dashboard ejecutivo** — KPIs por proyecto: metros perforados, muestras analizadas, costo/m, anomalías abiertas, targets drill-ready

---

## ¿Por dónde quieres empezar?

Mi recomendación de senior: **Fase 1 completa** antes que cualquier feature nueva visual. Sin QA/QC y sin workflow de aprobación, los reportes NI 43-101 que ya generas no son defendibles ante una due diligence. Después, Targets Pipeline para que la plataforma deje de ser "captura de datos" y se vuelva "soporte de decisión exploratoria".

Si te parece, el siguiente paso concreto es: **diseñar el módulo QA/QC + roles granulares** (Fase 1, ítems 1 y 2) en un plan ejecutable.
