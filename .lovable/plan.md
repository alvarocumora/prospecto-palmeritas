
# Plan — Visor estratégico Los Verdes (exploración + certificación)

El visor 3D en `/live/losverdes` se está cargando vacío y agrega complejidad sin valor para el caso de uso real: **decisión exploratoria y due-diligence**. Pivote a un visor 2D MapLibre denso en datos, con foco en anomalías, targets y trazabilidad NI 43-101.

## Objetivos

1. Quitar el visor 3D del flujo principal (lo dejamos detrás de un toggle "Beta / 3D" para no perder el trabajo hecho).
2. Reemplazar el área central por un **mapa 2D MapLibre** con todas las capas reales del proyecto.
3. Convertir los KPI cards en filtros activos (click → filtra mapa).
4. Añadir panel lateral de **fichas de target / anomalía** con score, evidencia y exportables.
5. Mantener botones existentes: Modelo conceptual, Sincronizar SERNAGEOMIN, Informe PDF, KMZ.

## Fase 1 — Visor 2D estratégico (este sprint)

### 1.1 Mapa base
- MapLibre GL JS con basemap satelital (Esri World Imagery) + toggle topo (OpenTopoMap) + toggle calles.
- Centrado en bbox de targets+samples del proyecto Los Verdes.
- Controles: zoom, escala, coordenadas live (lat/lon + UTM 19S), medición de distancia/área, fullscreen.

### 1.2 Capas (todas filtrables desde el panel "Capas")
| Capa | Fuente | Estilo |
|---|---|---|
| Concesiones mineras | `mining_concession` (15) | Polígonos cuando exista geometría, pines etiquetados si no |
| Catastro nacional | `cadastre_national` (radio 15 km) | Polígonos translúcidos por tipo |
| Targets exploración | `exploration_target` (108) | Círculos coloreados por prioridad, tamaño por score |
| Anomalías satelitales | `satellite_anomaly` (45) | Donut por severidad (33 alta · 11 media · 1 baja) |
| Vetas Cu-Au-Ag | `geological_features` (6) | Líneas con color por mineral dominante |
| Anomalías magnéticas | geofísica (10) | Heatmap |
| Muestras rock | `rock_samples` (190, UTM 19S→WGS84) | Burbujas por ley Cu (rojo>1%, naranja 0.3-1%, gris <0.3%) |
| AOI proyecto | envolvente calculada | Polígono dashed |

### 1.3 KPI cards interactivas
Los cinco cards actuales (Concesiones, Anom. Sat, Targets, Vetas, NPV) se vuelven **chips toggleables**: click filtra el mapa a esa capa exclusivamente; doble click hace fly-to bbox.

### 1.4 Panel lateral derecho — Ficha estratégica
Al click en cualquier feature del mapa:
- **Target**: nombre, prioridad, score, distancia a infra, muestras asociadas (top 5 leyes), anomalías cercanas, recomendación AI (`google/gemini-2.5-flash`).
- **Anomalía**: severidad, índice (NDVI/clay/iron), área, fecha, link a tile Sentinel, targets afectados.
- **Muestra**: ID, leyes Cu/Au/Mo/Pb/Zn/As, método QA/QC, lote, certificado lab.
- **Concesión**: rol, hectáreas, vigencia, titular, padrón anual, link SERNAGEOMIN.
- Botón "Exportar ficha PDF" (1 página, branding Geocapitals).

### 1.5 Modo certificación NI 43-101
Toggle "Modo certificación" que:
- Muestra solo muestras con QA/QC válido + lab certificado.
- Pinta de verde features con cadena de custodia completa; rojo las que faltan evidencia.
- Genera checklist exportable de gaps (qué falta para NI 43-101 Item 11 / 12).

### 1.6 Drawer "Score de prospectividad"
Cálculo client-side (transparente) sobre features visibles:
`score = w1·densidadAnomalíasSat + w2·leyMaxCu + w3·proximidadVetas + w4·confianzaCatastro`
Sliders de pesos + ranking top-10 targets actualizado en vivo. Exporta CSV.

## Fase 2 — 3D + IA generativa (siguiente sprint, fuera de scope ahora)
Mantener `LosVerdesPublicScene` accesible vía `/live/losverdes?engine=3d` o tab oculta "Beta · 3D". No tocar `Geology3DViewer` ni `scene3d.server`.

## Detalles técnicos

- **Nuevo componente**: `src/components/live/LosVerdesStrategicMap.tsx` (MapLibre + capas GeoJSON).
- **Server fn**: `src/lib/losverdes-map.functions.ts` con `getLosVerdesMapData()` que retorna `{ concessions, cadastre, targets, anomalies, veins, magAnoms, samples, aoi }` ya reproyectado a WGS84 (pyproj se hace en server fn vía SQL `ST_Transform` aprovechando PostGIS 3.3.7 ya instalado).
- **Caché**: `useSuspenseQuery` con `staleTime: 5min`; loader en `live.losverdes.tsx`.
- **Reemplazo en `live.losverdes.tsx`**: el bloque "3D Scene" (líneas ~333-380) se sustituye por `<LosVerdesStrategicMap />`; el botón "Activar visor 3D" se mueve a un menú "Más vistas" en el header.
- **Estilos**: tokens semánticos existentes (`--primary`, `--anomaly-high`, etc.); añadir `--mineral-cu`, `--mineral-au`, `--mineral-mo` en `src/styles.css` si faltan.
- **Sin nuevas tablas, sin nuevas dependencias backend.** En frontend: `maplibre-gl` y `@mapbox/mapbox-gl-draw` (para medición). Ya tenemos `maplibre-gl` en FieldMapPublic, reutilizar.
- **AI explainer ficha**: server fn `explainFeature.functions.ts` que llama Lovable AI Gateway con contexto del feature; rate-limit 10/min por sesión.
- **Modo certificación**: helper `src/lib/ni43101-checklist.ts` con reglas declarativas.

## Entregables del sprint

1. `/live/losverdes` carga mapa 2D útil aún sin GPU/WebGL2.
2. Click en feature → ficha lateral con datos reales.
3. Toggle certificación + checklist exportable.
4. Score panel con ranking top-10.
5. KMZ y PDF actuales siguen funcionando (no se tocan).
6. Visor 3D queda accesible pero no bloquea la página.

## Fuera de scope

- Edición/digitalización de features en mapa.
- Subida de nuevas muestras desde el visor.
- Cross-section y fusion score AI (Sprint 2 según `mem://plan/3d-ia-disruptivo`).
