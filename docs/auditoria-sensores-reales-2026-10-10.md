# ASTER, EMIT, radar y DEM: análisis de integración real

Revisión de `main` bc309ab3a7ee2906e0fa147680c078d41dd74185, 10 de octubre de 2026. Auditoría del código y consultas públicas de catálogos; sin descarga de productos científicos autenticados, sin lectura nueva de píxeles y sin cambios de aplicación ni escritura en producción.

## Estado de GeoCapitals

| Sistema               | Estado encontrado                                                                                                                                                                             | Integración real pendiente                                                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sentinel-2 L2A        | Lectura de píxeles, radiometría BOA, máscara SCL, índices y GeoTIFF implementados y probados con una escena pública.                                                                          | Corrida autenticada completa, visualización de artefacto y cola de trabajos si se escala.                                                                                                                      |
| ASTER                 | `searchStac` consulta `ASTER_L1T_v003`, que devuelve HTTP 404. El botón genera cinco productos conceptuales mediante `seedHyperspectralFromScene`, sin leer bandas. Busca solo el último año. | ASTER es multiespectral. Migrar catálogo a versión actual, seleccionar archivo histórico SWIR válido, leer bandas/metadatos y calibrar según nivel de producto. No tratar L1T como reflectancia de superficie. |
| EMIT                  | `EMITL2ARFL_v002` devuelve HTTP 404. También genera productos conceptuales.                                                                                                                   | Colecciones reales `EMITL2ARFL_002` y `EMITL2BMIN_002`: reflectancia, estimación mineral, incertidumbre, máscaras y georreferenciación GLT.                                                                    |
| Sentinel-1 / InSAR    | Consulta de catálogo `sentinel-1-rtc`, pero desplazamientos creados por `seedInsarMonitoring` son sintéticos. No existe pipeline interferométrico.                                            | RTC sirve para retrodispersión; desplazamiento LOS exige productos con fase SLC y procesamiento interferométrico/series temporales o importación de resultados verificados.                                    |
| Copernicus GLO-30     | Lectura real de DSM público en `dem.functions.ts` para relieve; fallback procedural devuelve `source: synthetic`.                                                                             | Pendiente análisis dedicado de pendientes/orientación y exportación con nodata, resolución efectiva y calidad. No es un DEM multitemporal de stockpiles.                                                       |
| DEM-diff / stockpiles | `seedStockpileVolume` genera resultados conceptuales; no lee dos DEM.                                                                                                                         | Dos levantamientos reales fechados, misma referencia horizontal/vertical, corregistro, máscara válida y propagación de incertidumbre; volumen dentro del polígono de acopio.                                   |
| Landsat               | No hay procesador equivalente al nuevo Sentinel en los módulos auditados.                                                                                                                     | Candidato para series históricas con Collection 2 L2, escalas/offsets de producto y QA, separado de detecciones mineralógicas.                                                                                 |

## Verificación pública cerca de Cholqui

BBox exploratorio WGS84 `[-71.1, -34, -70.9, -33.8]`. No representa tenencia. Las consultas devuelven huellas de escenas; no demuestran píxeles despejados, georreferenciación correcta ni cobertura útil de cada punto.

- `AST_L1T_003` responde 200 como colección, pero su búsqueda en ese bbox y periodo 2000–31/03/2008 devolvió cero escenas.
- `AST_L1T_004` devolvió **73 coincidencias** para el mismo bbox/periodo, con límite de muestra de tres. Las primeras muestras son adquisiciones del 18/05/2000 y 02/10/2000, reprocesadas en 2025; los assets incluyen TIR y bandas SWIR. La fecha de reprocesamiento no es fecha de observación.
- `EMITL2ARFL_002` devolvió tres adquisiciones: 07/01/2023, 12/01/2023 y 04/09/2026. `EMITL2BMIN_002` devolvió las mismas fechas. No se descargaron ni validaron sus valores.
- CMR también lista AST_L1T versión 004 y EMIT reflectancia/mineralogía versión 002. Las versiones se deben resolver explícitamente; no asumir que nombres con `_v002` son IDs STAC.

Evidencia en [auditoria-sensores-reales-2026-10-10.evidencia.json](auditoria-sensores-reales-2026-10-10.evidencia.json). Consultas crudas temporales en `/tmp/geocapitals-*-search.json`.

## Condiciones científicas y acceso

ASTER SWIR presenta anomalías desde abril de 2008, según [aviso de NASA](https://forum.earthdata.nasa.gov/viewtopic.php?sid=d59f648390b8116c6f9d5a19525be66c&t=765). Para exploración SWIR conviene buscar el archivo previo y validar calidad/bandas por escena. VNIR, SWIR y TIR tienen diferentes resoluciones; no emparejar arrays por índice. Un ratio espectral señala compatibilidad con materiales superficiales, no mineral certificado ni recurso en profundidad.

EMIT requiere validar cobertura, máscaras y banderas de calidad, longitud de onda, incertidumbre y GLT. La [guía NASA de acceso](https://github.com/nasa/EMIT-Data-Resources/blob/main/guides/Getting_EMIT_Data_using_EarthData_Search.md) indica Earthdata Login para descargar; no se verificaron credenciales en esta auditoría. La interpretación mineral sigue siendo una estimación modelada aun cuando el producto venga de NASA. No añadir IA antes de pasar estos controles.

[OPERA DISP cubre Norteamérica y Centroamérica hasta Panamá](https://docs.asf.alaska.edu/vertex/displacement/), no Chile. No ofrecerlo como monitor chileno disponible. Para Chile evaluar SLC reales de Sentinel-1 mediante ASF/CDSE y procesador externo. El resultado LOS no equivale a desplazamiento vertical sin hipótesis/geometrías adicionales.

[Copernicus GLO-30 es un DSM](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM), con vegetación y estructuras; sus releases no son levantamientos repetidos recientes de acopios. La resolución nominal no equivale a precisión vertical. DEM-diff necesita fuentes y datums compatibles, fechas y error verificables; tonelaje requiere densidad con procedencia propia.

## Riesgos encontrados en lectura e interpretación

- `explainHyperspectralProducts` ya bloquea productos conceptuales, pero `explainInsarPattern` no aplica ese filtro aunque lee metadata; `explainStockpileChanges` ni siquiera incluye notes/procedencia y describe entradas como mediciones.
- El workflow de alertas InSAR selecciona severidades sin filtrar metadata: podría generar tareas operacionales desde demostraciones.
- `Ni43101DraftPanel` contiene textos de metodologías y mediciones que no acreditan el procesamiento actual. Los agregados y exports deben conservar la procedencia de cada entrada y no convertir registros conceptuales en inventario de evidencia medida.
- `normalizeFeature` usa la fecha actual si falta fecha de adquisición; esa sustitución debe reemplazarse por rechazo o fecha desconocida antes de habilitar lectura científica.
- El catálogo no tiene timeout/validación científica equivalente al nuevo procesador Sentinel. Leer un asset arbitrario recibido del cliente tampoco debe habilitarse; resolverlo del catálogo permitido en el servidor.

## Orden recomendado de implementación

1. Corregir IDs y búsqueda por sensor, añadir exploración de escenas y estado claro «catálogo / lectura / procesamiento» sin ejecutar seeds. Bloquear interpretación y alertas desde datos conceptuales o sin procedencia verificada.
2. EMIT L2BMIN para lectura de mineralogía estimada con incertidumbre y GLT; EMIT L2A para espectros reales. Reutilizar trabajos, permisos, almacenamiento privado, artefactos y trazabilidad existentes. Procesamiento NetCDF/HDF y ortorrectificación en worker Python, no dentro del navegador.
3. ASTER v004 histórico SWIR: leer/calibrar bandas, máscara y transformaciones espaciales; validar con escena independiente. Añadir VNIR/TIR únicamente según producto disponible y correcciones documentadas.
4. Análisis de relieve Copernicus y comparación de DEM aportados por el usuario con datums y error. DEM-diff de acopios requiere levantamientos de resolución adecuada.
5. Sentinel-1 SLC: servicio de procesamiento de pares/series, coherencia y controles geométricos/atmosféricos; no reutilizar RTC como interferometría.

Repos primarios a evaluar: [NASA EMIT-Data-Resources](https://github.com/nasa/EMIT-Data-Resources) para acceso, GLT y lectura mineral; [ISCE2](https://github.com/isce-framework/isce2) para interferometría; [MintPy](https://github.com/insarlab/MintPy) para series InSAR. No se clonaron ni instalaron. Para [Landsat L2](https://www.usgs.gov/faqs/how-do-i-use-a-scale-factor-landsat-level-2-science-products), aplicar metadatos de escala/offset y QA del producto, no los valores de Sentinel.

## Avance posterior: catálogo real en la terminal

Se actualizó el catálogo ASTER a `AST_L1T_004`, EMIT L2A a `EMITL2ARFL_002` y se añadió EMIT L2B mineralogía estimada `EMITL2BMIN_002`. La pestaña Satelital ahora ofrece búsqueda NASA por AOI/periodo, tarjetas con fecha/ID/nubosidad/assets, vista pública `browse` del producto y enlace a metadatos STAC. El procesador limita las URLs de las miniaturas a la ruta pública NASA permitida; no presenta un browse como salida de análisis.

La búsqueda ahora exige un usuario miembro del UUID de proyecto y no inventa la fecha actual si el STAC no publica fecha de adquisición. En Cholqui se verificó en el catálogo que EMIT L2A y L2B devuelven 3 escenas cada una y ASTER v004 devuelve coincidencias históricas.

Esta fase es **descubrimiento y lectura de metadatos/vista previa reales**, no lectura de reflectancia ni espectros. Los NetCDF EMIT de datos y ASTER L1T por bandas son assets protegidos de LP DAAC: procesarlos requiere Earthdata Login y lectores NetCDF/HDF compatibles. La aplicación actual no dispone aún de ese lector. L2B es una clasificación mineral estimada por NASA y debe conservar incertidumbre/máscara, sin promocionarla a medición de campo. No se modifica el panel legacy que crea demos; su aviso de procedencia permanece visible.

La comprobación TypeScript directa (`npx tsc --noEmit --pretty false`) terminó con código 0. ESLint dirigido a los tres archivos modificados terminó con código 0. Esta etapa no añadió ni ejecutó pruebas ni build.
