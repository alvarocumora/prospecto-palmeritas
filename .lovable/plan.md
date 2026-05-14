
# Plan — Las Palmeras Pre-NI 43-101 v11 "Edición Épica"

Objetivo: convertir el informe en una pieza comercial de inversión nivel landing-page, con cartografía ESRI rica, plan de mina visual, malla de sondaje plotted y targets georreferenciados. Mantener el formato canónico de la guía (`docs/report-generation-guide.md`) y bumpear a **v11**.

---

## 1. Portada épica (estilo landing)

Reemplazar la portada actual (verde plano + diagonal) por una composición full-bleed de 4 capas:

```text
┌──────────────────────────────────────────────┐
│ [1] Hero satelital ESRI del AOI (full-bleed) │
│     · gradiente vertical PRIMARY_DK 0→85%    │
│ [2] Banda dark 14mm + ribbon ACCENT          │
│ [3] Bloque tipográfico (titular 56pt)        │
│     KICKER · LAS PALMERAS · subtítulo        │
│ [4] Strip inferior 60mm con 4 KPI hero:      │
│     Au oz · Ag oz · NPV · IRR (cards glass)  │
│ [5] Footer cover: operador / código / v11    │
└──────────────────────────────────────────────┘
```

Detalles:
- **Hero map**: render contextily ESRI World Imagery del AOI completo + polígono legal en `ACCENT` 1.6pt + glow exterior. PNG 300dpi 2480×3508 (A4).
- **Overlay**: gradiente lineal PRIMARY_DK (alpha 0 abajo → 0.92 arriba) para legibilidad.
- **Tipografía hero**: Helvetica-Bold 56pt blanco + tracking +40, kicker dorado 10pt uppercase tracking +120.
- **KPI strip**: 4 mini-cards translúcidas (`rgba(10,63,53,0.78)` + borde `ACCENT` 0.6pt), fondo glassmorphism sobre el mapa.
- **Sello**: badge circular dorado "Pre-NI 43-101 · v11 · 2026" esquina sup-derecha.

Nuevo `PageTemplate` `cover_epic` en builder Python; switch a `body` antes del primer `PageBreak`.

---

## 2. Mejora de mapas ESRI (Anexo A)

Subir el listón cartográfico con 5 mejoras sobre la versión v10:

| # | Mejora | Implementación |
|---|---|---|
| 1 | Multi-basemap | `Esri.WorldImagery` (default) + `Esri.WorldTopoMap` (referencia topo) + `Esri.WorldHillshade` (relieve) |
| 2 | Insets | mini-mapa de localización país/región esquina inf-izq de cada figura |
| 3 | Norte + escala gráfica | norte tipográfico bold + barra de escala segmentada en metros |
| 4 | Halo en labels | labels de anomalías con `path_effects.withStroke` blanco 2pt para legibilidad sobre imagen |
| 5 | Leyenda unificada | leyenda mineral (Au/Ag/Cu/Mo) + tamaños de score + simbología AOI |

Figuras nuevas:
- **A.1** Overview ESRI Imagery (todas las anomalías)
- **A.2** Overview ESRI Topo + Hillshade (geomorfología)
- **A.3 … A.(2+N)** Detalle individual por anomalía (zoom 17, ~400m radio)
- **A.(3+N)** Mapa de zonas Z1–Zn sobre ESRI
- **A.(4+N)** Mapa targets exploración con halo de probabilidad
- **A.(5+N)** Mapa malla DDH propuesta sobre ESRI con etiquetas de prioridad

---

## 3. Sección nueva — Plan de Mina (sección 11 expandida)

Hoy el plan de mina vive solo en Anexo B como tabla. Promoverlo a sección propia con visuales:

- **11.1 Concepto híbrido OP+UG**: diagrama isométrico (matplotlib 3D) del pit + galería UG sobre topografía sintética DEM Copernicus.
- **11.2 Secuencia de fases**: tabla `commercial_table` Fase 0–5 (años 1–8) con tonelaje, ley promedio, strip ratio.
- **11.3 KPIs económicos**: 4 KPI cards (NPV@8%, IRR, Payback, AISC) + 1 KPI hero CAPEX total.
- **11.4 Sensibilidad**: gráfico tornado (precio Au ±20%, ley ±15%, opex ±10%) en barras horizontales.
- **11.5 Mapa plan minero**: render ESRI con footprint del pit (polígono rojo translúcido) + boca-mina UG (icono).

---

## 4. Sección nueva — Malla de Sondaje DDH (sección 12)

Hoy es solo tabla. Convertir en sección visual:

- **12.1 Mapa malla**: ESRI World Imagery + AOI + 24–36 collares plotted como triángulos numerados, color por prioridad (P1 rojo, P2 ámbar, P3 verde).
- **12.2 Tabla DDH** (existente, mejorada con iconos de prioridad).
- **12.3 Sección transversal A–A'**: corte vertical 2D mostrando 4 hoyos con azimut/dip y zona objetivo proyectada (matplotlib).
- **12.4 Cronograma Gantt** Fase 1 (6 meses): 6 barras horizontales por anillo de sondaje.
- **12.5 Presupuesto DDH**: subtabla USD/m × metros × hoyos = total.

---

## 5. Sección nueva — Targets de Exploración (sección 9 expandida)

- **9.1 Mapa de targets**: ESRI Imagery + halos circulares de probabilidad (gradiente radial según `confidence_score`) + etiquetas T-01…T-N.
- **9.2 Tabla 4.2 Exploration Target conceptual** (existente, manteniendo disclaimer §2.3).
- **9.3 Ranking de targets**: tabla scoreada con columnas: Código, Tonelaje rango, Au eq (g/t), Confianza %, Recomendación (DDH inmediato / geofísica / mapeo).
- **9.4 Fusión multifuente**: barras apiladas por target mostrando contribución de cada fuente (satelital, geoquímica, geofísica, mapeo).

---

## 6. Estructura final (18 → 26–30 páginas)

```text
01  Portada épica (cover_epic)
02  TOC + marco regulatorio
03  Resumen ejecutivo (8 KPI cards)
04  Contexto geológico + AOI (mapa ESRI grande)
05  Catastro y concesiones
06  Datos satelitales y bandas
07  Anomalías multiespectrales (tabla)
08  Zonas de interés (mapa + tabla 4.1)
09  Targets de exploración (NUEVO mapa + ranking)        ← +2 pág
10  Estimación de recursos (placeholder Pre-NI)
11  Plan de mina híbrido (NUEVO 5 subsecciones)          ← +3 pág
12  Malla DDH (NUEVO mapa + sección + Gantt)             ← +3 pág
13  Pipeline F1·F2·F3 + CAPEX
14  Conclusiones y próximos hitos
15  Anexo A · Mapas satelitales ESRI multi-capa          ← +N pág
16  Anexo B · Concesión legal + deprecación v1–v10
17  Página de validación (QR + Ed25519)
```

---

## 7. Detalles técnicos (builder)

- Archivo: `/tmp/build_v11.py` (basado en `build_v10.py`).
- Assets: `/tmp/v11_assets/` (todos los PNG 300 dpi).
- Dependencias: `reportlab`, `matplotlib`, `contextily`, `qrcode`, `pillow`, `numpy`. Verificar con `python -m pip install --no-cache-dir`.
- Helpers nuevos:
  - `render_cover_hero(aoi_geojson, out_path)` — hero ESRI + gradiente
  - `render_esri_map(layers, basemap, insets, out_path)` — mapa multi-capa unificado
  - `render_pit_isometric(dem, pit_polygon, out_path)` — 3D matplotlib
  - `render_ddh_section(collars, line_AA, out_path)` — corte transversal
  - `render_tornado(sensitivities, out_path)` — gráfico sensibilidad
  - `render_gantt(tasks, out_path)` — cronograma
- Tipografía hero: registrar Helvetica-Bold a 56pt en canvas (no Platypus).

---

## 8. Datos canónicos a consultar

| Dato | Fuente | Notas |
|---|---|---|
| Polígono AOI | `mining_concessions.geom` (PostGIS) | ya verificado v10 |
| Anomalías | `satellite_anomalies` filtradas por AOI | usar score real |
| Targets | `exploration_targets` + `satellite_targets` | usar `confidence_score` para halo |
| Collares DDH | `drill_collars` proyecto Palmeras | si no hay, generar 24 collares sintéticos en grid 80×80m sobre Z1+Z2 |
| Plan minero | `mineral_deposits` + `block_models` | si no hay, usar parámetros conceptuales documentados en Anexo B v10 |
| KPIs económicos | `economic_scenarios` | NPV/IRR/CAPEX |

Si la BD no tiene datos para DDH/recursos, generar valores conceptuales **etiquetados como "indicativo conceptual"** y reforzar disclaimer §2.3.

---

## 9. Actualización de la guía

Tras v11 aprobado, actualizar `docs/report-generation-guide.md`:
- §3.1 → nueva plantilla `cover_epic` documentada
- §4.6 → multi-basemap ESRI + insets + halo labels
- §5 → tabla canónica con 17 secciones
- §6 → anchos de tabla para Plan de Mina, Targets ranking y DDH presupuesto
- §11 → bump v11 + deprecación v1–v10

---

## 10. QA obligatorio

1. `pdftoppm -r 150 -jpeg Las_Palmeras_PreNI43-101_v11.pdf /tmp/qa_v11`
2. Inspeccionar las **27±3 páginas** una a una (sin saltar).
3. Verificar: portada épica legible, mapas ESRI con atribución, tablas sin overflow, QR escaneable, footer paginado, hash SHA-256 reproducible.
4. Reportar issues + fixes al usuario.

---

## Entregable

- `Las_Palmeras_PreNI43-101_v11.pdf` (~27 pág, ~6–8 MB)
- SHA-256 + fingerprint Ed25519
- `docs/report-generation-guide.md` actualizado a v1.1
- Memoria `mem://reports/v11-epico` con decisiones de diseño

¿Apruebas el plan o ajustamos alguna sección antes de generar v11?
