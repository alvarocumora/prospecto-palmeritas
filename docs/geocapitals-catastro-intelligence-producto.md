# GeoCapitals Catastro Intelligence — producto por suscripción

Producto de **inteligencia de catastro y exploración** para Chile. La diferencia con
un visor de concesiones tradicional (p. ej. propiedadminera.digital) es que no solo
muestra *quién tiene qué*, sino que cruza catastro + geociencia oficial + teledetección
con **procedencia explícita**, para responder la pregunta que importa: *¿dónde hay una
oportunidad real de exploración o de pedimento?*

## 1. Qué lo hace mejor que un visor de concesiones

| Capacidad | Visor de concesiones típico | **GeoCapitals Catastro Intelligence** |
|---|---|---|
| Concesiones + titular + situación | ✅ | ✅ (catastro SIGEX oficial) |
| **Terreno vacante calculado** | — | ✅ (AOI menos catastro, por bbox) |
| **Geoquímica de sedimentos medida** (multi-elemento + REE) | — | ✅ (SERNAGEOMIN) |
| **Franjas metalogénicas** (sistema mineral) | — | ✅ |
| **Yacimientos / minerales críticos** cercanos | — | ✅ (Merge_RR) |
| **Anomalías satelitales** (Sentinel-2, Al-OH/gossan) | — | ✅ con veredicto de cobertura |
| **Motor de oportunidades** (vacante × anomalía × franja × yacimiento) | — | ✅ |
| **Procedencia por capa** (OFICIAL/MEDIDO/DERIVADO/INTERPRETADO/PROPUESTO) | — | ✅ badges |
| Generador de **pedimentos** (rectángulo N-S/E-W, vértices) | — | ✅ (borrador) |

## 2. Fuentes de datos (todas oficiales y alcanzables)

SERNAGEOMIN publica su geociencia en **ArcGIS Online** (`services1.arcgis.com/OyjvVdFTl5hfSdX3`),
accesible aunque sus servidores propios (`catastromineronline`, `geoservicios`) bloqueen
ciertos entornos. Capas conectadas:

| Capa | Fuente | Evidencia |
|---|---|---|
| Catastro minero | Propiedad Minera SIGEX (`Marcelo_Layer`) | OFICIAL |
| Geoquímica de sedimentos | Compilación de Geoquímica de Sedimentos de Chile | MEDIDO |
| Franjas metalogénicas | `Franjas_Metalogénicas` | OFICIAL |
| Yacimientos / críticos | `Merge_RR` (Minerales Críticos) | OFICIAL |
| Magnetometría / gravedad regional | EMAG2 v3 (NOAA), WGM2012 (BGI) | DERIVADO |
| Relieve | DEM Copernicus / hillshade SRTM | OFICIAL |
| Anomalías espectrales | Sentinel-2 L2A (Planetary Computer) | DERIVADO |
| Geoquímica de terreno / sondajes | captura propia del operador | MEDIDO / CERTIFICADO |

Cobertura: la geoquímica de sedimentos cubre norte/centro (lat ~-17.6 a -31.0); el
catastro, franjas y yacimientos cubren todo el país.

## 3. Motor de oportunidades (harvester)

`geocapitals-remote/scripts/harvest_opportunities.py`: dado un **bbox**, descarga y cruza
las capas y entrega un bundle + resumen:
- franja(s) metalogénica(s) del sector,
- catastro (CONSTITUIDA / EN TRÁMITE) y **terreno vacante**,
- yacimientos conocidos en ~30 km (sistema mineral, modelo, minerales críticos),
- geoquímica de sedimentos (si hay cobertura),
- anomalías Sentinel-2 en suelo vacante = **candidatos a pedimento**.

Conectores reusables: `sernageomin_catastro.py`, `sernageomin_geochem.py`, y el propio
harvester. Cualquier sector de Chile se consulta con un bbox.

## 4. Visor (React + Leaflet)

`ProjectMasterViewer` renderiza todas las capas con:
- **badges de evidencia + escala** por capa (un raster regional no se confunde con detalle),
- conteo por capa; capas vacías no se muestran,
- inspector lateral con procedencia y guardas por entidad,
- panel colapsable, capas conmutables.

Envoltorios por proyecto (`CholquiMasterViewer`, etc.) cargan sus geojson y los pasan.

## 5. Modelo de suscripción (propuesta)

| Plan | Para quién | Incluye |
|---|---|---|
| **Consulta** (free/lead) | prospector individual | catastro + vacante en un sector acotado |
| **Pro** | pequeño/mediano minero, corredor | + geoquímica, franjas, yacimientos, anomalías Sentinel-2, generador de pedimentos (borrador), export geojson/PDF |
| **Enterprise / API** | juniors, fondos, estudios jurídicos | + monitoreo de vacancia/caducidades, alertas por área de interés, harvester on-demand por bbox, capas de terreno propias (geoquímica/geofísica/sondajes), due diligence |

Palancas de valor: *ahorro de estudio de títulos* (vacante precalculado), *targeting*
(anomalía × franja × yacimiento), y *velocidad* (consultar cualquier sector en minutos).

## 6. Guardas y cumplimiento (no negociables)

- **Procedencia visible** en cada capa; nunca se presenta lo derivado/interpretado como medido.
- Geoquímica de sedimento y yacimientos = **contexto/dispersión, no ley in situ**.
- Anomalía satelital = firma espectral, **no** identificación mineral ni extensión medida.
- Vacancia = **indicativa**; para constituir se confirma prioridad/vigencia en la **Oficina
  Judicial Virtual** y con estudio de títulos.
- Pedimentos = **borrador**, no la solicitud oficial; requiere abogado de minería y, donde
  aplique, **consulta indígena (Convenio 169)**.
- Un dato inventado es un pasivo legal: todas las cifras provienen de fuentes verificables.

## 7. Roadmap

1. ✅ Conectores catastro/geoquímica/franjas/yacimientos + harvester.
2. ✅ Capas cableadas al visor (Cholqui como referencia).
3. Buscador **por dirección/rol/bbox** en el visor (consultar cualquier sector, no solo proyectos).
4. Refresco programado del catastro + **alertas de caducidad/vacancia** por área de interés.
5. Export de reporte de oportunidad (PDF) y API para Enterprise.
6. Geofísica/geoquímica de terreno del cliente → superficies (SimPEG/pyGIMLi) y modelo 3D (GemPy/LoopStructural).
