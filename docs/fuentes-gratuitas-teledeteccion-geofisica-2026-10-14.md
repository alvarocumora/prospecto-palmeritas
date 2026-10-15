# Fuentes gratuitas para teledetección y geofísica

Revisión de fuentes oficiales, APIs y motores reutilizables para GeoCapitals. Consulta realizada el 14-10-2026. “Gratuito” significa acceso abierto o cuota gratuita vigente; no garantiza procesamiento ilimitado, SLA ni ausencia de costos de cómputo/almacenamiento.

## Estado que confirma el repositorio

- Sentinel-2 L2A tiene un flujo real en `src/lib/remote-sensing/sentinelRaster.ts`: lectura de reflectancia BOA, escalas y offsets desde metadatos del producto, máscara SCL, índices derivados, GeoTIFF georreferenciado y vista previa para el mapa. Los índices no identifican minerales.
- El catálogo Planetary Computer está integrado para descubrir escenas Sentinel-2. El endpoint de procesamiento usa Planetary Computer para firmar activos.
- `services/simpeg-magnetics/runner.py` implementa una inversión 3D escalar de susceptibilidad magnética con SimPEG, pero no se encontraron llamadas desde `src/` al worker ni una función que encole ese modelo. Es motor disponible, no capacidad productiva conectada.
- `services/simpeg-magnetics/api.py` ofrece ese worker como nodo HTTP privado, con token obligatorio, una corrida concurrente, límites de tamaño y retorno del NPZ con SHA-256. La función `src/lib/simpegMagnetics.functions.ts` ahora valida membresía y datasets registrados, no sintéticos, con hash y CRS común; crea el job, llama el nodo y guarda el artefacto en `engine-artifacts`. El paquete JSON se hashea y se registran las referencias a sus datasets, pero la función aún no lee sus archivos para demostrar que los arrays coinciden; el llamador debe preparar el payload desde esas fuentes exactas. La corrida fixture sintética valida motor y transporte, no evidencia geológica. Para usarlo desde el servidor hay que configurar `SIMPEG_MAGNETICS_URL`, `SIMPEG_MAGNETICS_TOKEN` y `SUPABASE_SERVICE_ROLE_KEY`; todavía falta una interfaz y datos de campaña con TMI, incertidumbre, alturas/topografía y campo geomagnético documentados.
- El catálogo Landsat Collection 2 Level-2 ya está incorporado como fuente de descubrimiento en la inteligencia satelital; no ejecuta un procesamiento de píxeles Landsat en la terminal. Hace falta un procesador separado con factores Collection 2 y QA_PIXEL.
- El mapa de estaciones geofísicas genera superficies IDW. Son interpolaciones de datos de campo, no inversión.
- ASTER/EMIT, InSAR y DEM-diff en la pantalla de inteligencia satelital no ejecutan todavía un procesamiento real de esos productos.

## Fuentes de imágenes y acceso

| Fuente | Acceso / cobertura relevante | Uso adecuado | Límite y decisión |
| --- | --- | --- | --- |
| Copernicus Data Space STAC | `https://stac.dataspace.copernicus.eu/v1/`; catálogo oficial incluye Sentinel-1 GRD/SLC y Sentinel-2 L1C/L2A. | Descubrimiento trazable de escenas; descargar por activos o evaluar Sentinel Hub para composiciones y estadísticas. | Requiere cuenta para ciertas APIs y acceso a activos; cuotas gratuitas mensuales y límites de transferencia. No tratar cuota como ilimitada. Prioridad alta para catálogo S1 y alternativa operacional a PC. |
| Microsoft Planetary Computer STAC | `https://planetarycomputer.microsoft.com/api/stac/v1`; búsqueda pública anónima, con throttling. | Mantener Sentinel-2 actual y explorar Landsat C2 L2. | Confirmar activos/escenas para AOI chilenas antes de activar; no todos los catálogos del servicio cubren Chile. |
| Landsat Collection 2 Level-2 (USGS) | Archivo global de reflectancia de superficie, acceso sin costo; STAC LandsatLook y EarthExplorer/M2M para catálogo/descarga. | Serie histórica, complementaria a Sentinel-2; índices equivalentes de reflectancia, con QA_PIXEL y coeficientes oficiales. | Resolución nativa 30 m; calibración y bits QA propios de Collection 2. Hace falta un pipeline separado y pruebas contra metadatos USGS; no mapear bandas como si fueran S2. Prioridad alta. |
| ASTER L2 AST07 / AST_07XT | LP DAAC/NASA Earthdata. AST07 contiene reflectancia de bandas VNIR/SWIR; CMR/AppEEARS sirven para búsqueda/órdenes según producto. | Razones SWIR para exploración de alteración y composiciones históricas donde haya escenas válidas. | Requiere Earthdata Login y gestión de órdenes/descarga; resolución y disponibilidad varían por banda. Leer QA, emisividad/reflectancia y geometría; ASTER L1T de Planetary Computer es una colección distinta y no equivale a ASTER L2. Prioridad media tras Landsat. |
| EMIT L2A / L2B | NASA Earthdata; productos hiperespectrales y de mineralogía estimada. | Contexto regional/espectral cuando exista cobertura y geometría útil. | Cobertura espacial discontinua, píxel grueso (~60 m), productos estimados con incertidumbre y requisitos de acceso Earthdata. No usar catálogo como resultado procesado. Prioridad exploratoria. |
| HLS v2 | Planetary Computer ofrece reflectancia armonizada Landsat/Sentinel. | Series consistentes en zonas cubiertas por el producto. | El catálogo documenta coberturas regionales y no lista Chile en su cobertura actual consultada. No priorizar para los proyectos chilenos hasta comprobar ítems de cada AOI. |

## InSAR y radar

- **ASF HyP3 API/SDK** (`https://hyp3-docs.asf.alaska.edu/`) puede generar RTC y productos InSAR desde Sentinel-1 SLC. Es una vía mucho más rápida que desplegar un procesador propio, pero requiere Earthdata Login y tiene cuota de procesamiento. En noviembre de 2025 ASF anunció una reducción de la cuota estándar a 8.000 créditos/usuario/mes; comprobar el límite vigente antes de diseñar consumo.
- **OPERA RTC-S1** es un producto RTC preprocesado de ASF, potencialmente más barato que pedir RTC a demanda cuando cubre el AOI. Sirve para backscatter y cambio, no es por sí solo una serie de desplazamiento InSAR.
- **MintPy** (`https://github.com/insarlab/MintPy`) es software abierto para series temporales LOS; consume pilas de interferogramas ya coregistrados/desenrollados junto con coherencia y geometría. No reemplaza la preparación SLC, coregistro ni phase unwrapping.
- **ESA SNAP / Sentinel-1 Toolbox** es una opción abierta para preparar Sentinel-1; una ruta propia debe fijar versión, grafo reproducible, órbitas precisas, DEM, coherencia, desenrollado y máscara de calidad.
- Propuesta: comenzar con ingesta de un producto ASF ya procesado y almacenar proveedor, job id, pares, órbita, polarización, DEM, fecha, CRS, coherencia, referencia LOS y versión; presentar “desplazamiento LOS” solo si el artefacto de salida y QA existen. No reactivar el demo InSAR como resultado.

## Geofísica abierta

- **SimPEG** (`https://github.com/simpeg/simpeg`) ya está incorporado en `services/simpeg-magnetics`. El worker requiere TMI, incertidumbres, topografía, CRS métrico, campo inducido y malla acotada. El próximo trabajo de plataforma es conectar jobs autenticados, persistir artefacto NPZ/JSON y hash, leer QA/residuales y renderizar susceptibilidad como MODELADO. No generar inversiones desde las estaciones IDW sin datos y parámetros suficientes.
- **SERNAGEOMIN GeoMin/SIGEX** publica catálogos, mapas e informes geológicos/geofísicos; parte de la información requiere obtener productos descargables y verificar sus licencias/metadatos. No se confirmó una API pública estable de magnetometría para consumo automatizado. Mantenerlo como fuente de búsqueda/manual hasta validar endpoints y términos.
- **NOAA EMAG2 v3** ofrece contexto magnético global a 2 minutos de arco. Su resolución efectiva es demasiado gruesa para reemplazar magnetometría de campaña o respaldar anomalías a escala de concesión; puede mostrarse solo como capa regional con metadatos.
- **USGS Spectral Library** ofrece espectros medidos de laboratorio como referencia para investigación y comparación espectral. No convierte un índice Sentinel en identificación mineral; la biblioteca necesita método de remuestreo espectral, respuesta del sensor y controles de mezcla/alteración.

## Software/reutilización y licencias a revisar

1. `insarlab/MintPy`: series temporales InSAR; BSD-3-Clause según repositorio. Integrarlo como proceso batch/servicio, no bundle cliente.
2. ESA SNAP: procesamiento de sensores Copernicus; revisar licencia/versiones y requisitos de instalación antes de empaquetar.
3. `simpeg/simpeg`: inversión geofísica; ya existe un worker en el repositorio y es la opción con menor duplicación para cerrar la brecha de geofísica.
4. STAC API + COG/GeoTIFF: conservar como contrato entre catálogos, assets y motores. Validar hosts, CRS, QA y metadatos en servidor; no exponer URLs firmadas en resultados persistidos.

## Secuencia recomendada

1. **Completar SimPEG**: integrar interfaz que seleccione datasets registrados, cargue su contenido real y solicite inversión solo cuando existan TMI, incertidumbres, topografía/alturas y campo geomagnético de fuente documentada; luego inspeccionar residuales y cortes del volumen. Mantener guardas de malla/costo y distinguir inversión de IDW.
2. **Landsat L2 real**: mantener el catálogo ya existente y añadir un procesador separado con factores Collection 2, `QA_PIXEL`, bandas Landsat y malla nativa 30 m. Comparación temporal Landsat/Sentinel exige armonización explícita, máscaras compatibles y estadísticas de cobertura; no comparar medias brutas como cambio mineral.
3. **ASTER L2**: prototipo con escenas LP DAAC reales de un AOI, autenticación Earthdata en secreto de servidor, QA y reflectancia AST07; evaluar al menos una escena comprobable antes de mostrar controles como disponibles.
4. **Sentinel-1**: empezar con catálogo CDSE y chequeo de pares SLC; conectar ASF HyP3 con límite de costo/cuota. InSAR de serie requiere varias adquisiciones y QA, no solo dos escenas ni el catálogo.
5. **Fuentes chilenas**: inventariar productos SERNAGEOMIN/GeoMin por área, formato, datum, resolución, fecha y términos. Integrar raster/vector solo tras validar descarga automatizable y atribución.

## Referencias oficiales

- [Copernicus Data Space STAC](https://documentation.dataspace.copernicus.eu/APIs/STAC.html)
- [Cuotas CDSE](https://documentation.dataspace.copernicus.eu/Quotas.html)
- [USGS Landsat STAC](https://www.usgs.gov/landsat-missions/spatiotemporal-asset-catalog-stac)
- [USGS Landsat Collection 2 sin costo](https://www.usgs.gov/faqs/how-do-i-search-and-download-landsat-collection-2-data-products)
- [ASTER User Guide, LP DAAC](https://lpdaac.usgs.gov/documents/262/ASTER_User_Handbook_v2.pdf)
- [NASA AppEEARS API](https://appeears.earthdatacloud.nasa.gov/help)
- [ASF HyP3 InSAR product guide](https://github.com/ASFHyP3/hyp3-docs/blob/develop/docs/guides/insar_product_guide.md)
- [Cuotas y cambios de HyP3](https://github.com/ASFHyP3/hyp3-docs/blob/develop/docs/whats_new.md)
- [MintPy](https://github.com/insarlab/MintPy)
- [Visores SERNAGEOMIN](https://www.sernageomin.cl/visores-mineros/)
- [EMAG2 v3](https://www.ngdc.noaa.gov/geomag/emag2_download.html)
- [USGS Spectral Library](https://www.usgs.gov/labs/spectroscopy-lab/science/spectral-library)
