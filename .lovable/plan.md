# Plan: Auditoría de respaldo de datos + validación de modelos 3D vivos

## 1. Estado real en base de datos (proyecto Los Verdes – Tilama)

Verificado vía SQL sobre el `project_id` real:

| Capa | Registros | Respaldo |
|---|---|---|
| Concesiones mineras | 15 | REAL (geom WGS84) |
| Vetas mapeadas | 6 | REAL |
| Anomalías satelitales | 45 | REAL (CLAY, IRON_OXIDE, HYDROTHERMAL, NDVI, LINEAMENTS) |
| Runs satelitales | 9 (succeeded) | REAL (Sentinel/MPC) |
| Targets de exploración | 108 (con geom) | REAL |
| MAG targets | 10 | REAL |
| **Geofísica (surveys/stations/anomalías)** | **0** | **SIN respaldo** |
| **Sondajes (drill_holes/core_logs)** | **0** | **SIN respaldo** |
| **Muestreo (sample_custody)** | **0** | **SIN respaldo** |
| **scene_3d_cache** | **0** | **No persistido** |
| **AI anomaly explanations** | **0** | **Sin generar** |
| ni43101_satellite_evidence_links | 0 | Sin trazabilidad cargada |

## 2. Hallazgo crítico del informe v4

Las láminas L3D-1 a L3D-4 incluyen elementos **conceptuales** que se presentan visualmente como si tuvieran respaldo:

- **Shells de pórfido (Cu eq %)**: simulados, no hay block model ni assays.
- **Sondajes "LV-TIL-001" y trazas drillhole**: no existe ningún registro en `drill_holes`.
- **Voxels MAG/Grav**: no existe ninguna campaña en `geophysics_*`.
- **Pit conceptual / galerías / planta 2,500 t/d**: ingeniería conceptual sin estudio.
- **Sección geológica Lo Prado + stock monzonítico**: interpretación, no sondaje.

Lo que SÍ tiene respaldo real y debe destacarse:
- Ortofoto + concesiones + 45 anomalías sat (índice + severidad) + 108 targets + 6 vetas + DEM Copernicus.

## 3. Acciones propuestas

### A. Reetiquetar el informe (v5) por nivel de evidencia
Cada lámina y figura llevará un sello visible:
- `DATO` (verde) — respaldado por tablas Supabase, con conteo y fuente.
- `INTERPRETACIÓN` (ámbar) — derivado geológico razonado a partir de datos reales.
- `CONCEPTUAL` (rojo) — modelo target/ingenieril sin sondaje ni geofísica de campo.

Aplicación:
- L1 (ortofoto+concesiones+targets): DATO.
- L2 (estructural+sección traza): DATO + INTERPRETACIÓN.
- L3 sección geológica, L3D-1 shells, L3D-2 lito 3D, L3D-3 voxels geofís, L3D-4 plan minero: CONCEPTUAL.
- "Sondajes LV-TIL-001": eliminar o reetiquetar como **drillhole targets propuestos** (no ejecutados).

### B. Añadir página "Trazabilidad de datos"
Tabla con: capa, fuente (Sentinel-2 MPC run_id, Copernicus DEM, SERNAGEOMIN concesiones, mapeo veta), fecha, n° registros, link a run en plataforma. Genera honestidad NI 43-101.

### C. Generar respaldo faltante donde sea barato y honesto
- Poblar `ai_anomaly_explanations` para las 45 anomalías reales vía Lovable AI Gateway (ya hay tabla y el patrón existe). Esto convierte INTERPRETACIÓN en respaldada.
- Persistir el DEM + drape de la escena en `scene_3d_cache` para versión live reproducible.
- Crear `exploration_targets` "drillhole proposals" (no sondajes ejecutados) con coordenadas, azimuth/dip planeado, y vincularlos a anomalías vía `ni43101_satellite_evidence_links`.

### D. Validar el visor 3D vivo en la app
Rutas existentes a revisar:
- `/_authenticated/dashboard/geology3d` (Geology3DViewer — DEM real + drape Sentinel)
- `/_authenticated/dashboard/sat3d` (SatToSubsurface3DViewer)
- `/_authenticated/dashboard/3d-pro`
- `/live/losverdes` y `/live/tilama` (públicas)

Checks:
1. Abrir cada ruta en preview, verificar que renderiza con los 15 concesiones, 45 anomalías y 108 targets reales (no mock).
2. Confirmar que el DEM Copernicus + drape Sentinel responden vía `scene3d.server` con el bbox de Tilama.
3. Confirmar paridad visual con las láminas del PDF — si la app muestra algo distinto, alinear.
4. Capturar screenshots de cada visor y embeberlos como "Vista live del modelo 3D" en el informe v5, con QR/URL al deploy publicado.

### E. Compilar informe v5
- `Geocapitals-LosVerdes5-PreNI43101_v5.pdf` con:
  - Sello de evidencia en cada lámina.
  - Página de trazabilidad.
  - Capturas reales del visor live + link público.
  - AI explanations adjuntas como anexo por anomalía.
  - Eliminar/relabel todo lo que se presentaba como sondaje ejecutado.

## Notas técnicas
- Sin nuevas migraciones requeridas: todas las tablas existen.
- AI explanations: usar `google/gemini-2.5-flash` (barato, multimodal) vía Lovable AI Gateway, batch de 45.
- Captura del visor live: usar `browser--screenshot` sobre cada ruta autenticada con sesión de prueba.
- Entregable final como artifact en `/mnt/documents/`.

## Pregunta al usuario antes de ejecutar
1. ¿Procedo a **eliminar** los sondajes ficticios "LV-TIL-001" del informe, o prefieres mantenerlos reetiquetados como "propuestas de sondaje" (drill targets)?
2. ¿Genero las 45 explicaciones IA de anomalías y las persisto en `ai_anomaly_explanations`? (costo bajo, ~30 s)
3. ¿Capturo el visor live publicado (`prospecto-palmeritas.lovable.app/live/losverdes`) o el preview autenticado?
