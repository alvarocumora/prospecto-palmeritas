## Objetivo

Generar `Distrito_Los_Verdes_Tilama_PreNI43-101_v2.0.pdf` (12–16 páginas) siguiendo la estructura de los reportes Pre-NI 43-101 ya entregados (Las Palmeras / Las Arenas / Franco), con foco en **Los Verdes 5** y arreglando dos puntos críticos del v2:

1. El "mapa integrado" del v2 quedó ilegible (envolvente calculada sin basemap, símbolos amontonados).
2. La proyección 3D de vetas era plana y conceptual, sin amarre al mapa ni a las anomalías.

## Estructura del informe (alineada a guía NI 43-101 lite)

```text
1. Resumen ejecutivo (tesis, ask, hitos 12 m)
2. Propiedad y tenencia      → ficha de Los Verdes 5 + vecinos del distrito
3. Accesibilidad, fisiografía, infraestructura
4. Historia y trabajos previos
5. Geología regional y local + modelo de yacimiento (IOCG / Cu-Au estructural)
6. Mineralización y targets  → tabla de los 108 targets, filtrada a LV-5
7. Exploración satelital      → índices Sentinel-2 + lineamientos
8. Geofísica (proxy magnético) → mapa raster por capas
9. Modelo 3D de estructuras y plan minero conceptual
10. QA/QC y limitaciones
11. Próximos pasos, presupuesto, cronograma
12. Anexos (láminas A3, tablas)
```

## Lo nuevo / lo que cambia respecto al v2

### A. Basemap satelital ESRI real

- Render del mapa principal sobre **ESRI World Imagery** (tile service público `World_Imagery/MapServer/tile/{z}/{y}/{x}`, sin API key).
- Cálculo del bbox a partir de la geometría real de la concesión LV-5 (PostGIS `ST_Envelope` + buffer 10%), zoom 14–15, mosaico de 4×4 tiles, composición server-side a PNG y embebido en el PDF.
- Reproyección WebMercator → lat/lon para ubicar targets, muestras y anomalías encima con coordenadas correctas (no la "envolvente calculada" del v2).
- Capas overlay con leyenda y toggle visual:
  - Polígono LV-5 (rojo) + concesiones colindantes (gris)
  - Targets por prioridad (rojo crítico / naranja alto / amarillo medio)
  - Muestras geoquímicas coloreadas por % Cu (escala continua)
  - Anomalías Sentinel-2 por tipo (hidrotermal, óxidos Fe, arcillas) como halos semitransparentes
  - Lineamientos estructurales (líneas blancas)

### B. Mapa de "anomalías magnéticas" por color y capas

Como no hay magnetometría real, se construye **proxy geofísico explícito y etiquetado como tal**:

- Grilla 200×200 sobre el bbox de LV-5.
- Campo escalar combinado: densidad de anomalías Sentinel + densidad de lineamientos + gradiente de muestras de Cu.
- Render como **heatmap multicapa** con colormap geofísico (azul → cyan → verde → amarillo → rojo → magenta) y contornos isolíneas.
- 3 capas separadas en páginas contiguas: (i) proxy magnético total, (ii) primera derivada / gradiente, (iii) anomalías residuales sobre satelital.
- Disclaimer técnico en cada página: "proxy multivariado, no sustituye levantamiento magnetométrico terrestre".

### C. 3D mejorado de estructuras + plan de mina

- Proyección isométrica calibrada (mantengo el motor del v2 pero amarrado al bbox del mapa, misma escala XY que el basemap).
- Estructuras principales modeladas como **planos inclinados** con strike/dip derivados de los lineamientos dominantes, no líneas rectas.
- Profundidad hasta -500 m con cortes cada -100 m.
- Capas:
  - Topografía drapeada (DEM Copernicus, ya disponible en `scene3d.server`)
  - Polígono concesión proyectado en superficie
  - Vetas y cross-cuts como cuerpos tabulares coloreados por ley estimada
  - Pit/galería conceptual (rampa de acceso + niveles) con cotas
  - Targets críticos como esferas rojas a la profundidad sugerida
- Segunda lámina: **sección vertical NW-SE** atravesando los targets de mayor ley, con litología/alteración inferida y trazas de vetas.

### D. Plan minero conceptual (página dedicada)

- Método sugerido (cielo abierto inicial sobre target somero + sublevel stoping en estructuras profundas), con justificación.
- Footprint en planta superpuesto al mapa satelital.
- Programa de drilling fase 1 (objetivo m perforados, n° de sondajes, malla, costo).
- CAPEX/OPEX a nivel de scoping (rangos, no PEA).
- Cronograma 24 meses con hitos (drilling → recursos inferidos → PEA).

## Detalles técnicos

- Script Node.js + `jsPDF` (mismo patrón que v2), nuevo archivo `/tmp/los_verdes_v3.mjs`.
- Descarga de tiles ESRI con `fetch` paralelo (limit 8 concurrentes), cache local en `/tmp/tiles/`.
- Composición de basemap con `sharp` no es viable en Worker pero **aquí corre en sandbox local**, así que uso `sharp` o `canvas` Node-side para componer el mosaico y exportar a JPEG antes de embeber en PDF.
- Datos desde la DB Supabase: reuso queries del v2 (proyecto `7a499b02-…`) + agrego `ST_AsGeoJSON` de los polígonos de concesión para tener geometría real.
- QA obligatorio: convertir el PDF a imágenes con `pdftoppm` y revisar página por página antes de entregar (mapa legible, leyenda visible, 3D no recortado, sin glifos rotos).

## Entregable

- `Distrito_Los_Verdes_Tilama_PreNI43-101_v2.0.pdf` en `/mnt/documents/`
- Disclaimers visibles donde uso proxies (magnético, 3D conceptual)
- Sin cambios en la app web (todo es generación de artefacto vía script)

## Lo que NO incluye este plan

- Levantamiento magnético real (requiere campaña terrestre)
- Modelo de recursos JORC/NI 43-101 formal (requiere QP firmante)
- Cambios en la plataforma Geocapitals (UI, edge functions, DB schema)

¿Apruebas que arranque con esta versión 2.0?
