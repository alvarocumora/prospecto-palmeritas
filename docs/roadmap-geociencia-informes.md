# Roadmap — geociencia real → informes (muestras + catastro)

Orden para que la plataforma genere **informes y data de geofísica/geología reales**
a partir de **puntos de muestra** y **catastro**, sin mezclar dato real con sintético.

## Principio rector (inviolable)
Un dato inventado es un pasivo legal. Todo dato lleva **procedencia** y un informe
**nunca** presenta dato sintético/modelado como medido. Ya existen las banderas en el
esquema (`is_synthetic`, `provenance`, `procedencia` = Certificado/Declarado/A verificar);
falta que **gobiernen** la generación de informes.

## Estado actual (lo que YA existe)

| Dominio | Tablas / módulos reales | Estado |
|---|---|---|
| Muestras / geoquímica | `sampling_results`, `geochem_analyses`, `sample_custody`, `mineralogy`, `synthetic_assays` | Datos + cadena de custodia; sintético separado |
| Geología | `lithology_units`, `alteration_zones`, `geological_features`, `veins`, `drill_holes`+logs/surveys/trajectories, `geology_wireframes` | Modelo completo |
| Geofísica | `geophysics_surveys/lines/stations/anomalies`, `mag_targets`, `mag_target_revalidations`; import CSV de estaciones; inversión SimPEG magnética (`simpegMagnetics.ts`, `geoscience_compute_jobs`) | Captura + inversión v1 |
| Teledetección | `src/lib/remote-sensing/` (anomalyEngine, rasterSampler, sceneCatalog) + paquete `geocapitals-remote` (Nivel 0) | Screening satelital |
| Catastro | `mining_concessions`, `cadastre_national`, reconciliación auditable | Unificándose |
| Targets / interpretación | `exploration_targets`, `engine_drill_targets` | Existe |
| Informes | pre43101 (shell+secciones+narrativa IA+PDF), NI43101 (varias variantes), `geocapitals-docs` (KYC/ficha/DD), PDFs por proyecto | **Fragmentado (~10 generadores)** |

**Diagnóstico:** las piezas están; faltan tres cosas — (1) un **gate de procedencia**, (2) un
**pipeline** ordenado dato→proceso→interpretación→informe, y (3) **un solo motor de informe**
(hoy hay ~10 generadores distintos, igual que pasaba con el catastro).

## El orden (fases)

### Fase 0 — Gate de procedencia (fundación) · backend (mío)
Una vista/función que, por proyecto, clasifica cada capa como **medido / declarado / modelado /
sintético** y expone un "nivel de evidencia". Regla dura: un informe solo puede marcar una
sección como "dato real" si su fuente es medido/declarado con procedencia; lo modelado se rotula
"interpretación", lo sintético se marca de agua y **no** entra a un informe entregable.
→ Entregable: `report_readiness(project_id)` + banderas de procedencia normalizadas.

### Fase 1 — Intake de datos reales · backend (mío) + UI (Lovable)
- Validar **puntos de muestra**: coordenadas + CRS declarados (no adivinar huso), assay de lab
  acreditado, custodia. Rechazar/《A verificar》 lo que no cumpla.
- Validar **estaciones geofísicas** (ya hay `StationCsvImport`) con CRS y unidades.
- **Marco catastral:** vincular muestras/estaciones a las concesiones que las contienen
  (`mining_concessions` / `cadastre_national`) — el informe declara sobre qué pertenencias corre.
→ Entregable: RPCs de validación + carga; enlace muestra↔concesión.

### Fase 2 — Procesamiento · backend/worker (mío/compartido)
- **Geofísica:** inversión magnética SimPEG (existe) → `geoscience_compute_jobs`; salidas rotuladas
  "modelo geofísico", con parámetros y versión.
- **Geoquímica:** interpolación de leyes desde puntos de muestra (con incertidumbre), no como
  "recurso".
- **Teledetección:** Nivel 0 (`geocapitals-remote`) + `anomalyEngine` → cobertura + candidatos.
→ Entregable: capas derivadas versionadas y trazables a su input.

### Fase 3 — Interpretación · backend + UI
- **Targets** (`exploration_targets`) generados del cruce anomalía + muestra + estructura, con
  confianza y su cadena de evidencia. Revalidación (`mag_target_revalidations`) para auditar.
- **Cruce catastral** (reconciliación) como contexto legal del target.
→ Entregable: target = evidencia + confianza + procedencia, no un número suelto.

### Fase 4 — Un solo motor de informe · report engine (mío) + UI (Lovable)
Consolidar los ~10 generadores en **uno** (base: `features/reports/pre43101`, el más completo),
alimentado desde la DB por secciones:
- Portada + marco catastral (concesiones, overlaps).
- Muestreo (tabla de assays reales, procedencia por fila).
- Geofísica (mapa + modelo de inversión, rotulado "modelado").
- Interpretación (targets con evidencia).
- Anexos de trazabilidad.
Reglas: campos sin dato → "Por confirmar"; secciones sin dato real → no se afirman; sintético →
marca de agua. Salida PDF con la identidad GeoCapitals (reutiliza `geocapitals-docs`).

## Consolidación transversal (como el catastro)
Deprecar progresivamente los generadores duplicados (`cholquiPdf`, `FrancoNI43101DraftPanel`,
`SatelliteIntelPdfExport`, `engine3d/reports`, etc.) hacia el motor único, cada uno como un
*preset* de secciones.

## Dónde empezar (recomendación)
**Fase 0 (gate de procedencia)** primero: es la fundación, es la regla inviolable hecha código, y
es 100% mi territorio (backend). Con eso, cualquier informe posterior nace confiable. En paralelo
puedo dejar el **contrato de datos del informe único** (qué secciones lee de qué tablas) para que
Lovable cablee la UI.
