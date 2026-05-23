## Diagnóstico del v2.0

El script actual (`lv5_report.mjs`, jsPDF + sharp) llegó a 14 páginas pero arrastra tres techos duros:

1. **Render cartográfico artesanal.** Mosaico ESRI compuesto a mano, sin proyección real ni reglas cartográficas (norte, escala gráfica, grilla UTM, leyenda). El "mapa raro" que reportaste viene de mezclar lat/lon con píxeles sin un CRS de verdad.
2. **3D conceptual.** Proyección isométrica calculada a mano en canvas 2D. No hay topografía real drapeada ni interpolación implícita; las vetas son cuñas dibujadas, no superficies estructurales.
3. **Proxy magnético sin pipeline geofísico.** La grilla 200×200 multivariada no aplica continuación ascendente, primera derivada vertical, ni reducción al polo — los tres productos estándar de cualquier informe geofísico serio.

Para subir a nivel "Pre-NI 43-101 defendible" el camino correcto es **dejar de reinventar** y montar el informe sobre librerías open-source de la industria geocientífica.

## Stack propuesto (todo open-source, en sandbox local)

| Capa | Librería | Para qué |
|---|---|---|
| Cartografía | **GeoPandas + Contextily + Matplotlib + Cartopy** | Mapas con CRS real (EPSG:32719 UTM 19S), basemap ESRI/Sentinel, leyenda, escala, norte, grilla |
| Geofísica | **Fatiando a Terra (Harmonica + Verde)** | Grillado de muestras, continuación ascendente, 1ª derivada vertical, reducción al polo, contornos |
| 3D estructural | **PyVista + GemPy (lite) + rasterio** | DEM Copernicus real drapeado con Sentinel-2/carta geológica, vetas como superficies implícitas, sondajes, targets, pit conceptual. Export a PNG (lámina) **y** HTML interactivo embebible. |
| Cartas SERNAGEOMIN | **WMS GetMap** vs `catastro.sernageomin.cl/arcgis/.../Geologia_Base_1M` (ya validado en `src/components/map/sernageominLayers.ts`) + **Hoja Illapel 1:250.000** georreferenciada manualmente | Capa geológica oficial drapeada sobre el bbox de LV-5 |
| Reporte | **ReportLab (Platypus)** + plantilla NI 43-101 lite | Reemplaza jsPDF — soporte nativo de tablas, TOC, figuras vectoriales, headers/footers, paginación |

Referencias relevantes que se evaluarán/reutilizarán:
- `fatiando/harmonica` — pipeline magnético estándar (ya validado en docs oficiales).
- `gempy-project/gempy` (1.2k★) — modelo implícito 3D a partir de orientaciones; usamos modo "lite" con los lineamientos como input.
- `Loop3D/LoopStructural` (258★) — alternativa más liviana si GemPy es pesado para el sandbox.
- `chapmangj/geoinsights3d` (MIT) — referencia de pipeline de drillholes → PyVista (no se importa, se mira el patrón).

## Estructura del informe v3.0 (16–20 pp)

```text
0. Portada + ficha resumen + mapa de ubicación nacional
1. Resumen ejecutivo + tesis de inversión
2. Tenencia: tabla concesiones LV-5 + vecinos + cumplimiento patentes
3. Mapa cartográfico maestro (basemap ESRI + concesiones + targets + muestras)
4. Carta geológica SERNAGEOMIN (WMS 1:1M + Hoja Illapel 1:250k) drapeada sobre LV-5
5. Geología local interpretada + leyenda litoestratigráfica
6. Mineralización y targets (tabla 108 targets filtrados a LV-5 + láminas por target crítico)
7. Exploración satelital Sentinel-2 (índices alteración: clay B11/B12, iron-ox B4/B2, NDVI)
8. Geofísica — proxy magnético v2 (Harmonica):
   8a. Campo total proxy
   8b. Continuación ascendente 100 m
   8c. Primera derivada vertical (realce de bordes estructurales)
   8d. Contornos sobre satelital
9. Modelo 3D estructural (PyVista):
   9a. Lámina isométrica con DEM + concesión + vetas + targets
   9b. Sección NW-SE atravesando targets críticos
   9c. Link al HTML interactivo (export PyVista standalone)
10. Plan minero conceptual (footprint + drilling fase 1 + cronograma)
11. CAPEX/OPEX scoping + ask de inversión
12. QA/QC, limitaciones, disclaimers
13. Próximos pasos NI 43-101 formal
14. Anexos: tablas completas, láminas A3
```

## Cambios concretos respecto al v2

### A. Mapas con CRS real

- Reproyección de toda la data del proyecto a **EPSG:32719** (UTM 19S, el huso de Tilama).
- `contextily` para traer basemap ESRI World Imagery **como raster real**, no mosaico jpeg pegado.
- Grilla UTM cada 500 m, escala gráfica, flecha N, leyenda categórica para concesiones/targets/muestras.
- Misma proyección reutilizada en mapa geológico, mapa de anomalías y proyección XY del 3D → todas las láminas son comparables pixel a pixel.

### B. Carta geológica SERNAGEOMIN integrada

Dos fuentes complementarias:
- **WMS oficial 1:1M** (`catastro.sernageomin.cl/arcgis/services/Geologia/Geologia_Base_1M/MapServer/WMSServer`, capa `0`) — `GetMap` directo al bbox LV-5, drapeado al 60% sobre ESRI.
- **Hoja Illapel 1:250.000** (SERNAGEOMIN 1991, dominio público) — descarga del PNG/PDF público y georreferencia manual con `rasterio` usando 4 GCPs conocidos. Permite litología a escala distrital.
- Disclaimer: ambas fuentes citadas explícitamente en cada figura.

### C. Pipeline geofísico real (Harmonica)

Reemplaza la grilla multivariada artesanal:
1. Construir "pseudo-puntos magnéticos" a partir de la densidad de anomalías Sentinel + Cu geoquímico.
2. `harmonica.EquivalentSources` para grillar a malla regular.
3. `harmonica.upward_continuation(distance=100m)` → suaviza ruido superficial.
4. `harmonica.derivative_upward(order=1)` → realza contactos y estructuras.
5. Contornos isolíneas cada 5 nT-equivalente, colormap geofísico (`cmocean.balance` o `RdBu_r`).
6. Cada lámina incluye **el script de generación en pie de página** para trazabilidad.
7. Disclaimer "proxy multivariado, no sustituye magnetometría terrestre" reforzado.

### D. 3D real con PyVista

- DEM Copernicus 30 m recortado al bbox LV-5 (`rasterio` + `pyvista.StructuredGrid`).
- Drapeado de Sentinel-2 **y** de la carta geológica como texturas seleccionables.
- Vetas como `pyvista.PolyData` superficies implícitas: tomamos strike/dip de los lineamientos dominantes y los proyectamos a -500 m con cortes -100 m.
- Sondajes propuestos como cilindros (`pyvista.Tube`) coloreados por leyenda.
- Targets críticos como esferas escaladas por score.
- Pit conceptual: prisma truncado parametrizado por área somera + ángulo de talud.
- **Doble export**: PNG 4K (lámina del PDF) **+** HTML interactivo standalone (`scene.export_html`) que se entrega junto al PDF en `/mnt/documents/`.

### E. ReportLab Platypus en vez de jsPDF

- Plantilla con `BaseDocTemplate` + frames + footer con paginación y atribuciones.
- TOC automático, tablas con `LongTable`, figuras vectoriales SVG cuando aplique.
- Sin más bugs de hex de 3 caracteres, sin `setColor` artesanal.

## Detalles técnicos

- Script Python en `/tmp/lv5_report_v3/` con módulos: `data.py` (queries Supabase), `maps.py` (GeoPandas/Contextily), `geophys.py` (Harmonica), `model3d.py` (PyVista), `report.py` (ReportLab), `main.py`.
- Dependencias instaladas vía `pip install --user` en sandbox (todas puro-Python o wheels: geopandas, contextily, rasterio, fatiando-harmonica, pyvista, reportlab, cmocean, owslib). No requieren GUI — PyVista off-screen con `pyvista.start_xvfb()` o `OSMesa`.
- Datos vía `psql` (proyecto `7a499b02-…`): geometrías reales con `ST_AsGeoJSON(ST_Transform(geom, 4326))`, targets, muestras, anomalías.
- WMS SERNAGEOMIN consultado con `owslib.wms.WebMapService` para `GetMap` reproyectado.
- QA obligatorio: `pdftoppm -r 150` página por página, revisión visual de cada figura, búsqueda de glifos rotos / texto recortado / mapas sin leyenda.

## Entregables

1. `Distrito_Los_Verdes_Tilama_PreNI43-101_v3.0.pdf` (16–20 pp, ReportLab) en `/mnt/documents/`.
2. `Distrito_Los_Verdes_Tilama_modelo3D_v3.html` (PyVista standalone, rotable, zoom, capas on/off) en `/mnt/documents/`.
3. `Distrito_Los_Verdes_Tilama_anexo_laminas_A3.pdf` — láminas cartográficas A3 a alta resolución.

## Lo que NO incluye este plan

- Campaña magnetométrica real (sigue siendo recomendación para fase siguiente).
- Modelo de recursos JORC/NI 43-101 formal con QP firmante.
- Cambios en la plataforma Geocapitals (UI, edge functions, DB schema, visor 3D de la app).
- Integración del HTML interactivo dentro de la app web (queda como artefacto descargable).

¿Apruebas que arranque con esta v3.0 sobre stack Python geocientífico?