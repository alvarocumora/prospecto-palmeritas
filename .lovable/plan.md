
The user wants two things:
1. **Estado actual del proyecto** — diagnóstico de qué está construido vs qué funciona realmente.
2. **Plan disruptivo funcional** — siguiente fase concreta que convierta esto en una plataforma de exploración minera operativa, no solo un demo.

Voy a estructurarlo como diagnóstico + roadmap accionable. Concise, sin código.

## ESTADO ACTUAL — auditoría rápida

### ✅ Construido y funcional (verificado en DB y código)
- **Auth + roles**: login, perfiles, roles por proyecto (owner/admin/geologist/viewer), super_admin global. RLS completa en todas las tablas.
- **Multi-proyecto**: switcher, invitaciones por token, equipo con roles, auditoría con triggers.
- **Catastro**: integración SERNAGEOMIN dinámica + tabla `mining_concessions` con alertas de vencimiento.
- **Geofísica**: surveys/lines/stations CRUD, mapa con magnetometría e IP, captura de campo.
- **Sondajes**: drill_holes + core_logs, strip log visual, cómputo de intercepts mineralizados.
- **Muestreo**: resultados de laboratorio (Au/Ag/Cu + path-finders).
- **Geo-AI Assistant**: chat con contexto de proyecto (Gemini Pro).
- **Marketplace**: capas públicas instalables.
- **Reporte NI 43-101**: PDF one-click.
- **Admin platform**: panel /dashboard/admin con usuarios, proyectos, auditoría.
- **Las Palmeras**: asignado a alvaro.cumora@gmail.com como owner, con datos vinculados.

### ⚠️ Construido pero a medias
- **Pagos**: stubs en admin, sin Stripe real conectado.
- **Offline**: hook existe pero no enchufado en formularios.
- **Emails de invitación**: edge function loguea el link, no envía email.
- **Marketplace**: solo lectura, no permite uploads.
- **Time machine**: filtro por fecha en audit, sin reconstrucción real de estado.
- **Reportes**: solo NI 43-101, falta Pitch Investor y Technical Brief.

### ❌ Faltante crítico para "exploración minera real"
- **Geoquímica avanzada**: no hay multielement plots, ratios path-finder, vectoreo a target.
- **Modelado 3D**: sin visor de wireframes/superficies (Leapfrog-lite).
- **QA/QC de muestras**: no hay duplicados, blancos, estándares, gráficos shewhart.
- **Recursos & estimación**: sin bloques, kriging, clasificación measured/indicated/inferred.
- **Workflows de campo**: no hay app PWA instalable real con cola offline robusta.
- **Integraciones laboratorio**: sin import directo de ALS/SGS/Bureau Veritas.
- **DEM/topografía**: sin elevación real, todo plano.
- **Reportes regulatorios reales**: ENAMI, SERNAGEOMIN annual.

---

## PLAN DISRUPTIVO — 4 olas funcionales

Cada ola es una unidad entregable de ~1-2 sesiones que aporta valor inmediato a un explorador real.

### 🌊 Ola 1 — "Datos de campo confiables" (FUNDAMENTOS)
Lo más urgente para que un geólogo lo use en terreno mañana.
- **PWA instalable**: manifest + service worker, install prompt en mobile.
- **Offline-first real**: enchufar `useOfflineQueue` en formularios de drill_core_logs, sampling_results y geophysics_stations. Badge de cola pendiente, sync automático.
- **Import CSV laboratorio**: parser para resultados ALS/SGS (assay sheets típicos) → sampling_results con QA/QC automático (detección de duplicados/blancos/estándares por código).
- **DEM + topografía**: integrar Mapbox terrain o SRTM para elevación real de drill collars.

### 🌊 Ola 2 — "Inteligencia geoquímica" (DIFERENCIADOR)
Lo que hace que la plataforma sea mejor que Excel + ArcGIS.
- **Multielement dashboard**: scatter Au-Ag, ratios path-finder (As/Sb/Hg vectoreo epitermal), histogramas log-normal, percentiles automáticos.
- **Mapas de anomalías interpolados**: IDW/kriging simple sobre sampling_results → heatmap por elemento sobre el mapa.
- **Vectoreo a target asistido por IA**: el geo-assistant analiza patrones (intercepts + alteración + geofísica) y propone próximos drill targets con justificación.
- **Cross-section builder**: dibuja una línea sobre el mapa → genera sección con holes proyectados, intercepts, lito, alteración.

### 🌊 Ola 3 — "Modelo 3D y recursos" (PRODUCTO ÚNICO)
Lo que cobra USD 50k+/año en software tradicional.
- **Visor 3D**: three.js/deck.gl con holes en 3D (azimuth+dip), intercepts coloreados, superficies de alteración.
- **Wireframe builder simple**: marca polígonos en secciones → triangula superficie 3D.
- **Bloques + estimación**: malla de bloques sobre AOI, asignación por inverso a la distancia, clasificación measured/indicated/inferred según distancia a holes.
- **Tonelaje/ley curve**: gráfico interactivo cutoff vs. tonelaje vs. ley promedio.

### 🌊 Ola 4 — "Comercialización y escala" (NEGOCIO)
Convertir la plataforma en SaaS real.
- **Stripe real**: planes (Solo / Equipo / Enterprise) con metering por GB de datos, nº proyectos, nº miembros.
- **Reportes regulatorios automatizados**: SERNAGEOMIN annual, declaración ENAMI, NI 43-101 técnico completo.
- **Data room para inversionistas**: link público read-only de un proyecto con KPIs, mapa, intercepts (sin datos crudos), watermark.
- **API pública**: REST endpoints para integración con ERPs mineros (SAP IS-Mining, Pronet).
- **Marketplace activo**: uploads de capas con thumbnail auto, sistema de ratings, monetización (créditos por download).

---

## Recomendación de próximo paso

Empezar por **Ola 1 → "Import CSV de laboratorio"** porque:
- Resuelve el dolor #1 real de un geólogo (recibe el assay sheet de ALS y lo mete a mano hoy).
- Activa todo lo demás: si entran datos reales, los gráficos, secciones e IA tienen sustancia.
- Bajo esfuerzo (1 sesión), impacto altísimo.

Después, en paralelo: PWA + offline real (Ola 1) y multielement dashboard (Ola 2).

¿Apruebas que arranque por **Import CSV laboratorio + QA/QC automático**, o prefieres otra ola/feature?
