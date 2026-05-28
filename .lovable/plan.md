## Diagnóstico

El PDF actual (`Los_Verdes_5_Informe_Profesional_v1.pdf`) se generó con un script Node aislado (`/tmp/lv5_report.mjs`) que:
- No sigue el sistema de marca de `docs/report-generation-guide.md` (paleta `--primary #0E5F4F` / `--accent #C8A24A`, portada full-bleed, header band, sello, página de validación, anexos numerados).
- Reemplazó las imágenes ESRI por una **proyección isométrica vectorial sintética**, porque el runtime Worker no soporta navegador headless.
- No incluye catastro real (sólo tablas de texto) ni el visor 3D real (`Geology3DViewer`/`live/losverdes` con DEM + drape Sentinel + vetas + anomalías extruidas).

## Objetivo

Generar el informe **desde el cliente** (browser), reutilizando los visores reales de la plataforma y los primitives PDF (`src/lib/pdf/*`) que ya implementan la guía. Esto da imágenes ESRI reales, catastro real y captura del 3D real, sin depender de Puppeteer en Workers.

## Arquitectura

```text
/live/losverdes5  (ruta cliente, ya existe)
   └── botón "Generar Informe Profesional"
         ↓
   exportLosVerdes5Report()  ← nuevo, client-side
         ├─ getLosVerdes5Report() server fn  → datos (concesiones, vetas, anomalías, targets, fronts)
         ├─ <ReportRenderStage/>             → componente oculto (off-screen) que monta por frente:
         │     • MapLibre ESRI World Imagery + overlay catastro + anomalías (Mapbox-style)
         │     • LosVerdesScene3D (DEM + drape Sentinel + vetas 3D + anomalías extruidas)
         │     • Geology3DViewer (geofísica: isosurfaces magnéticas)
         ├─ captureElement(...)              → 1 PNG ESRI + 1 PNG 3D geo + 1 PNG 3D geof por frente
         └─ buildPdf(state, captures, data)  → usa primitives.ts + figures.ts + secciones del guide
```

## Estructura del PDF (siguiendo §5 de la guía)

| Pág | Contenido |
|---|---|
| 1 | Cover full-bleed `PRIMARY_DK` + sello "PRE-NI 43-101 v1" + meta |
| 2 | TOC + marco regulatorio (§9.1) |
| 3 | Resumen ejecutivo: 6 KPIs (recursos in-situ, USD in-situ, planta destino, NPV, IRR, payback) |
| 4 | Contexto geológico distrito Tilama (Cretácico Inf, vetas epi-mesotermales Cu-Au) |
| 5-7 | **Una sección por frente** (La Guanaca / Los Verdes / Castellana): captura ESRI con catastro y anomalías superpuestas, tabla concesiones, tabla anomalías top-10, tabla vetas |
| 8 | Snapshot 3D real del distrito (`LosVerdesScene3D`) con leyenda |
| 9 | Modelo geofísico 3D (`MagAnomaly3DPro`/`Geology3DViewer`) — isosurfaces magnéticas + anomalías a profundidad |
| 10 | Cubicación in-situ por frente (largo × potencia × alto × 2.7 × ley) |
| 11 | Comparativa 3 plantas ENAMI (Matta · Delta · Vallenar): distancia, transporte, maquila, pago neto USD/t |
| 12 | Plan de explotación 24 meses por frente (método, fases `mine_plan_phases`, ramp-up) |
| 13 | OPEX detallado USD/t (perforación, tronadura, carguío, chancado, transporte, admin, contingencia 15%) |
| 14 | Flujo de caja 24 meses + NPV (8%) + IRR + sensibilidad LME Cu |
| 15 | Riesgos & mitigaciones |
| 16 | Disclaimer NI 43-101 §2.3 + página de validación (QR + Ed25519, §8) |

## Capturas reales — cómo

1. **ESRI por frente**: monta un `<MapContainer>` Leaflet off-screen (1200×800 px) con basemap `World_Imagery` (ESRI), encima:
   - polígonos `mining_concessions` por frente (estilo `CATASTRO_STYLE`)
   - puntos `satellite_anomalies` coloreados por `severity`
   - bbox del frente, escala y norte (ya existe en `src/lib/map/snapshot.ts`)
   - `captureMapSnapshot()` → PNG decorado con leyenda
2. **3D geología por frente**: monta `LosVerdesScene3D` en contenedor 1200×800, espera `onLoad`, `captureElement()`.
3. **3D geofísica**: monta `MagAnomaly3DPro` filtrado por bbox del frente, `captureElement()`.

Las capturas usan `html2canvas-pro` (ya en uso en `catastro-map.ts`) → embebidas como JPEG en el PDF vía `figures.ts` con caption auto-numerado.

## Implementación técnica

**Archivos nuevos**
- `src/lib/pdf/losverdes5-report.ts` — orquesta capturas + arma PDF con primitives. ~600 líneas, modular.
- `src/lib/pdf/lv5-sections.ts` — helpers: `coverLV5`, `frenteSection`, `enamiCompareTable`, `cashflowTable`, `validationPage`.
- `src/components/live/Lv5ReportStage.tsx` — stage React off-screen que monta los 3 visores secuencialmente por frente y expone refs DOM para captura.

**Archivos editados**
- `src/routes/live.losverdes5.tsx` — botón "Generar Informe Profesional" que dispara el flujo y descarga.
- `src/lib/losverdes5.functions.ts` — añadir `area_ha`, `severity`, geometría `ST_AsGeoJSON` a anomalías y concesiones (para overlays mapa).

**Sin cambios**
- `primitives.ts`, `figures.ts`, `sections.ts` — se reutilizan tal cual.
- `mining-economics.ts` — ya implementa ENAMI + OPEX.

## Entregables

1. Nuevo PDF `Los_Verdes_5_PreNI43-101_v2.pdf` con marca Geocapitals correcta, imágenes ESRI reales con catastro + anomalías por frente, snapshot 3D real del distrito, snapshot 3D geofísico, página de validación QR.
2. Botón funcional en `/live/losverdes5` para regenerarlo en cualquier momento.
3. QA visual: convertir PDF a PNG con `pdftoppm` y revisar las 16 páginas antes de entregar.

## Riesgos & mitigaciones

- **Tiles ESRI tarda en cargar** → esperar evento `tileload`/timeout 4s antes de capturar.
- **WebGL del visor 3D no se renderiza off-screen** → forzar `preserveDrawingBuffer: true` en MapLibre/three y capturar canvas directamente (no via html2canvas).
- **Tamaño PDF** → comprimir JPEG calidad 0.82 y redimensionar capturas a 1600 px máx.
