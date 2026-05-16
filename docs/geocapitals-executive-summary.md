# Geocapitals

**Plataforma SaaS de exploración minera, catastro y deal-flow**

Resumen ejecutivo del estado del producto, capacidades reales por módulo y hoja de ruta para consolidar la mejor plataforma de exploración del mercado LATAM.

**Fecha:** Mayo 2026  
**Clasificación:** Confidencial

---

## 1. Visión del producto

Geocapitals integra en un solo entorno los flujos críticos de la cadena de exploración: desde el catastro minero oficial hasta la generación de targets con IA, la certificación NI 43-101 y la conexión con inversionistas.

El producto está construido sobre Lovable Cloud con arquitectura multi-tenant basada en `organizations + projects`, RLS y PostGIS.

---

## 2. Stack y backend

| Capa        | Stack / capacidad                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------ |
| Frontend    | TanStack Start v1, React 19, Tailwind v4, Vite 7, TanStack Query                                 |
| Backend     | Lovable Cloud / Supabase, 135 tablas, 35 edge functions, PostGIS 3.3.7, pg_cron + pg_net         |
| IA          | Lovable AI Gateway: Gemini 2.5 Pro/Flash, GPT-5 para GeoCopilot, target generator y AI explainer |
| Geoespacial | Sentinel MPC, DEM Copernicus, ArcGIS REST de Sernageomin, drape 3D real                          |
| Seguridad   | RLS por proyecto, `has_role()` SECURITY DEFINER, `app_roles`, audit log                          |

---

## 3. Capacidades reales por módulo

Estado verificado contra el código en producción, no aspiracional.

| Módulo                 | Capacidad real                                                                                           |     Estado | Madurez |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ---------: | ------: |
| Catastro Minero        | Concesiones Sernageomin, holders, alertas patentes, overlaps con AOI, calendario, sync ArcGIS automático | Producción |     95% |
| Prospectos Mineros     | 30 prospectos curados desde Sernageomin REST con geometría WGS84 y commodity                             | Producción |     90% |
| Instalaciones Mineras  | ~29.000 instalaciones con filtros región/tipo/recurso, ingest async vía edge function                    |       Beta |     80% |
| Boletín Minero         | Watches, alertas, ingest PJUD/Boletín automatizado vía pg_cron                                           | Producción |     85% |
| Geofísica              | Surveys magnéticos/gravimétricos, captura de campo, anomalías, promoción a targets                       | Producción |     90% |
| Geología 3D            | Geology3DViewer real con DEM Copernicus + drape Sentinel MPC + anomalías WGS84                           | Producción |     85% |
| Drilling               | Sondajes, core logging, strip logs, intercepts, QA/QC                                                    | Producción |     85% |
| Sampling & Geoquímica  | Imports CSV de assays, fingerprint geoquímico, validación                                                | Producción |     80% |
| Drones & Rasters       | Upload ortomosaicos, DEM diff, swipe overlay, cálculo de stockpiles                                      | Producción |     85% |
| Estimación de Recursos | Block model 3D, escenarios económicos, NI 43-101 export                                                  |       Beta |     70% |
| Targets de Exploración | Generación, scoring, prospectividad grid, AI explainer                                                   |       Beta |     75% |
| NI 43-101 / QPs        | Compliance matrix, evidence drawer, signature envelopes, qualified persons                               |       Beta |     70% |
| Deals & Marketplace    | Listings de propiedades mineras, inquiries, due diligence                                                |       Beta |     65% |
| Investor CRM           | Pipeline de inversionistas, campañas, finance tracking                                                   |      Alpha |     55% |
| Data Room              | Storage seguro de archivos por concesión/holder/proyecto                                                 | Producción |     80% |
| Team & Roles           | Multi-tenant por organization + project, RLS con `has_role()`, capabilities matrix                       | Producción |     95% |
| GeoCopilot AI          | Geo-Intel Brief con Lovable AI Gateway, Gemini/GPT, evidencia geológica                                  |       Beta |     70% |
| HSE & Compliance       | Auditoría, validación de datos, repairs, approvals                                                       | Producción |     80% |

---

## 4. Diferenciadores actuales

### Catastro vivo

Sincronización automática con Sernageomin: concesiones, aproximadamente 29.000 instalaciones y 30 prospectos curados.

### Geología 3D real

DEM Copernicus + drape Sentinel + anomalías geofísicas extruidas. No es una maqueta visual; es una capa geoespacial operativa.

### GeoCopilot

Brief geológico generado por IA con evidencia trazable: targets, intercepts, litología, alteración y permisos.

### End-to-end exploración → deal

Producto que une catastro, exploración, NI 43-101 y marketplace de inversionistas.

### Multi-tenant nativo

RLS estricto por proyecto y rol, listo para operación SaaS.

---

## 5. Brechas críticas

| Brecha                  | Impacto    | Nota                                                                                                   |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| Jobs pesados            | Alto       | Algunos syncs aún sufren timeouts. Mitigado con `EdgeRuntime.waitUntil`, pero falta job runner formal. |
| Modularización frontend | Alto       | `ProjectMap` y dashboards monolíticos frenan velocidad de equipo.                                      |
| Observabilidad          | Alto       | Falta request-id end-to-end y dashboards por tenant.                                                   |
| Investor CRM            | Medio/alto | Aún en alpha; requiere pipeline visual y métricas de embudo.                                           |
| SaaS comercial          | Alto       | Falta tenant management central, feature flags por plan y límites de consumo.                          |

---

## 6. Próximos pasos para tener la mejor plataforma de exploración

Hoja de ruta priorizada por impacto y dependencia técnica.

| Fase                         | Foco                                                                                              |    Plazo | Prioridad |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | -------: | --------: |
| F1 — Endurecer seguridad     | Auditar SECURITY DEFINER, rotar secretos, RLS por dominio                                         |    2 sem |        P0 |
| F2 — Job runner robusto      | Mover syncs pesados —catastro, instalaciones, PJUD— a workers async con retry/idempotencia        |    3 sem |        P0 |
| F3 — Modularización frontend | Extraer ProjectMap en submódulos: layers, tools, inspectors; separar dominios deals/certification |    4 sem |        P1 |
| F4 — Fusion Score 3D + IA    | Sprint disruptivo: cross-section, AI target generator, geofísica a profundidad                    |    4 sem |        P1 |
| F5 — SaaS multi-tenant       | Tenant management central, feature flags por plan, límites de consumo                             |    3 sem |        P1 |
| F6 — Observabilidad          | Request-id end-to-end, dashboards por tenant, SLOs y runbooks                                     |    2 sem |        P2 |
| F7 — Go-to-market            | Onboarding reproducible, demos verticales para junior miners y exploración avanzada               | Continuo |        P2 |

---

## 7. Sprints disruptivos recomendados: 3D + IA

### Sprint 1 — Mission Control 3D

Visor real embebido + anomalías satelitales extruidas + geofísica a profundidad.

### Sprint 2 — Cross-section dinámica

Cortes geológicos interactivos con fusión de litología, alteración y assays.

### Sprint 3 — Fusion Score

Índice unificado: geofísica × geoquímica × estructural × satélite por celda H3.

### Sprint 4 — AI Target Generator

Generación automática de targets con explainer trazable y nivel de confianza.

### Sprint 5 — GeoCopilot conversacional

Chat con memoria de proyecto, citando evidencia y exportando briefs PDF.

---

## 8. KPIs de éxito a 6 meses

| Categoría       | KPI objetivo                                                                     |
| --------------- | -------------------------------------------------------------------------------- |
| Confiabilidad   | Job success rate > 99%; p95 endpoints críticos < 800 ms                          |
| Cobertura datos | 100% de concesiones activas Chile sincronizadas diariamente                      |
| Adopción        | ≥ 10 tenants activos con > 5 proyectos cada uno                                  |
| Producto        | ≥ 3 reportes NI 43-101 emitidos íntegramente desde la plataforma                 |
| IA              | ≥ 70% de targets aceptados por geólogos competentes vs. generados por GeoCopilot |

---

## 9. Recomendación final

Geocapitals tiene hoy una base técnica difícil de replicar: catastro vivo, 3D real, IA con evidencia y multi-tenant.

La diferencia entre una plataforma sólida y la mejor plataforma de exploración LATAM está en ejecutar las Fases 1-4 en los próximos 90 días:

1. Endurecer seguridad.
2. Formalizar jobs.
3. Modularizar el mapa.
4. Lanzar el AI Target Generator.

Ese combo convierte la propuesta en defensible y comercializable a junior miners e inversionistas institucionales.
