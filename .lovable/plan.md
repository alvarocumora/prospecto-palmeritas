# Informe PDF profesional — Tilama (Los Verdes)

Generación **one-shot** del PDF, descargable desde `/mnt/documents/`. No se toca la app (sin nuevas rutas ni componentes). El proyecto en BD es `Distrito Cuprífero Los Verdes – Tilama` (centro −32.0389, −71.1128).

## Datos reales que usaré (Supabase, proyecto Tilama)

- **45 anomalías satelitales** clasificadas: 11 hidrotermal (high), 11 óxidos de Fe (10 high + 1 med), 11 arcillas (10 high + 1 med), 11 lineamientos estructurales (2 high + 9 med), 1 NDVI.
- **108 exploration_targets** priorizados.
- **15 concesiones mineras** del distrito.
- **0 magnetometría de campo** → la sección "magnética" se construye con la **firma magnética inferida de satélite** (ratios SWIR/NIR + lineamientos DEM), declarado explícitamente en el informe. Si quieres magnetometría real, hay que cargarla antes; se lo dejo señalado como "siguiente paso".

## Estructura del PDF (A4, ~25–30 páginas)

1. **Portada** — Logo, título, AOI, fecha, disclaimer NI 43-101 preliminar.
2. **Resumen ejecutivo** — Tesis (Cu pórfido + IOCG distrital), 5 KPIs (área, # targets, anomalías high, concesiones, score promedio).
3. **Ubicación y accesos** — Mapa Esri World Imagery con AOI + caminos, tabla de coordenadas, contexto regional (Faja Cretácica).
4. **Marco geológico** — Litología, edades, mineralización conocida en distrito.
5. **Geofísica magnética + anomalías satelitales** (3–4 páginas)
   - Mapa Esri sat + halos hidrotermales (rojo), óxidos Fe (naranja), arcillas (violeta).
   - Mapa Sentinel-2 con índice SWIR/NIR realzado.
   - Tabla de los 11 anomalías high de hidrotermal + score.
6. **Estructuras 3D satelitales** (3 páginas)
   - Mapa Esri con lineamientos NW-SE y N-S.
   - **Render 3D real** del DEM Copernicus con drape Sentinel-2 + anomalías extruidas (capturas estáticas desde tres ángulos: oblicuo NE, oblicuo SW, vertical). Genero los renders server-side con `gl` headless o, si no es viable en sandbox, con `pydeck`/`matplotlib 3D` sobre el DEM real descargado del endpoint Copernicus.
   - Sección esquemática estructura-mineralización.
7. **Targets priorizados** — Tabla top-15 (de los 108) con coords, tipo, score, evidencia satelital cruzada.
8. **Concesiones** — Mapa Esri + tabla de las 15 concesiones (titular, tipo, vencimiento, superficie).
9. **Plan de explotación preliminar** (4 páginas)
   - Método propuesto (open pit cuprífero supérgeno + sulfuros primarios a profundidad).
   - Tonelaje conceptual (rango por analogía distrital, claramente marcado como "exploration target, no recurso").
   - Capex/opex orientativo, escenarios de precio Cu (3.50 / 4.00 / 4.50 USD/lb), NPV/IRR sensibilidad.
   - Cronograma 24 meses (sondajes → recursos NI 43-101 → PEA).
10. **Riesgos, permisos, comunidades, siguientes pasos**.
11. **Anexos** — Metodología, fuentes, coordenadas completas, glosario.

## Cómo se generan los mapas

- **Esri World Imagery + Sentinel-2 cloudless + Copernicus DEM hillshade** → descargo tiles XYZ vía `staticmap`/`mercantile`+`Pillow` componiendo el AOI a ~zoom 13–15. Overlays de anomalías y lineamientos dibujados con `Pillow` desde el GeoJSON real de Supabase.
- **Render 3D**: descargo el DEM real Copernicus 30 m del AOI (mismo origen que `scene3d.server`), lo proyecto con `numpy` + `matplotlib` 3D surface, dropeo el Sentinel-2 como textura y extruyo las anomalías high como columnas verticales coloreadas por score. Tres ángulos.

## Render técnico

- Python en `/tmp/`: `reportlab` para layout, `Pillow` + `mercantile` + `requests` para basemaps, `numpy` + `matplotlib` para 3D, `psycopg2` o `read_query` para datos.
- QA obligatorio: convierto cada página del PDF a JPG y reviso visualmente antes de entregar.
- Output: `/mnt/documents/Tilama_Informe_Mina_Explotacion.pdf` + `<presentation-artifact>` para descarga.

## Avisos honestos

- El informe se etiqueta **"Preliminar / Exploration Target"**: sin sondajes ni magnetometría de campo, no es NI 43-101 firmable. Sirve para inversores y due diligence inicial.
- Si quieres magnetometría **real** (no derivada de satélite), súbeme el CSV de estaciones o dame OK para cargar un dataset sintético calibrado al distrito.

¿Apruebo y construyo?
