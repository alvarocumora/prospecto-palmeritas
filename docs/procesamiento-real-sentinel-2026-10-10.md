# Procesamiento real Sentinel-2 — implementación y validación

Se implementó un flujo real Sentinel-2 L2A en el módulo de Inteligencia Satelital. Lee píxeles de seis assets de una escena seleccionada, aplica radiometría y máscara de calidad, calcula cuatro índices y exporta un GeoTIFF georreferenciado. Se validó con una escena pública real; la activación y validación autenticada del almacenamiento siguen pendientes.

Base: `main`, SHA `9250d53f841880cba1d1f66391527b61e8bd6f0c`, Node 24.21.0/npm 11.19.0 local. CI Node 22/Ubuntu no ejecutada. Sin commit, push ni publicación.

## Método implementado

- Escena Sentinel-2 L2A seleccionada por ID del catálogo de Planetary Computer; el servidor resuelve sus assets. No acepta URLs ráster arbitrarias del cliente.
- Lectura de B02, B04 y B08 (10 m), B11/B12 y SCL (20 m). Ventanas limitadas al AOI; malla de salida de 20 m alineada al asset B11.
- Se registra la proyección UTM de la escena y se transforma el AOI WGS84. Cada banda se consulta en el mismo centro espacial de celda, mediante vecino más cercano. Se recorta por pertenencia del centro al bbox; esto define el AOI de cálculo, no dominio minero.
- Reflectancia BOA calculada con `BOA_QUANTIFICATION_VALUE` y `BOA_ADD_OFFSET` por banda, leídos del XML original del producto. Baselines anteriores a 04 permiten offset cero cuando no existe esa etiqueta; baselines nuevos sin offsets fallan. No se deduce radiometría por fecha de adquisición.
- Se aceptan clases SCL 4 y 5 (vegetación/suelo desnudo). Se excluyen nubes, sombras, agua, nieve, clases inciertas, nodata y reflectancias no positivas. Los píxeles fuera del AOI o de cobertura también quedan excluidos.
- Orden de bandas de salida: NDVI `(B08−B04)/(B08+B04)`, NDMI `(B08−B11)/(B08+B11)`, ratio `B04/B02`, ratio `B11/B12`. Índices adimensionales, con medias/mínimos/máximos y conteo válido.
- GeoTIFF Float32 de cuatro bandas, nodata −9999, CRS y georreferenciación. **No se declara COG**: el archivo exportado no tiene overviews ni organización COG validada.
- Procedencia **modelled/modelado**: índices calculados a partir de reflectancia satelital real; no minerales identificados, sondajes medidos ni evidencia de campo certificada. No genera anomalías o recursos mediante scores prefijados en este flujo nuevo.

El procesador reutiliza `computeSpectralMetrics` del motor existente. La implementación nueva utiliza coordenadas para alinear bandas; no reutiliza la combinación por posición de arrays del antiguo sampler. La calibración histórica de Cholqui aún usa ese sampler y requiere migración independiente; no se declara validada por esta prueba.

## Flujo de plataforma

La ruta `/dashboard/satellite-intel` incorpora un panel de carga diferida con AOI editable, periodo, consulta de hasta doce escenas con nubosidad inferior al 20 %, selección explícita de escena, procesamiento, historial de corridas y descarga privada. La nubosidad del catálogo no sustituye la máscara SCL local.

El endpoint exige rol Catastro y pertenencia al proyecto. Reutiliza `satellite_analysis_runs`: crea estado running y solo marca succeeded después de calcular, subir el artefacto y guardar su registro. Los fallos quedan failed con su causa; no existe fallback sintético. Se valida que la actualización realmente devuelva la corrida. Si falla el guardado tras subir el archivo, intenta retirar el artefacto.

El registro conserva parámetros, versión del pipeline, escena/fecha, URLs fuente sin tokens SAS, escala/offset/nodata, CRS/malla, estadísticas y SHA-256. La descarga verifica proyecto, estado, versión y ruta exacta, y genera un enlace firmado de cinco minutos. El GeoTIFF contiene una referencia compacta a escena y fecha; el resto de la trazabilidad está en el registro.

El [encoder geotiff.js](https://github.com/geotiffjs/geotiff.js) reserva un encabezado de tamaño fijo en la versión instalada. La validación detectó solapamiento al añadir metadatos extensos. Se acotó la descripción a 600 bytes y se añadieron comprobaciones de relectura del JSON ASCII terminado en NUL y de los valores de las cuatro bandas.

La ejecución es síncrona y acotada: un millón de celdas como máximo, ventanas nativas limitadas y deadline de red de 180 segundos. No se implementó una cola distribuida ni recuperación automática de procesos interrumpidos por caída del servidor. Los archivos abiertos se cierran también ante fallo.

## Prueba con datos reales

Escena: `S2B_MSIL2A_20250323T143749_R096_T19HCC_20250323T180942`, adquirida **23 de marzo de 2025**, a las 14:37:49 UTC. Consulta pública de catálogo, XML y ventanas COG realizada el 10 de octubre de 2026, sin escribir registros de producción.

AOI de prueba WGS84: `[-71.05, -33.91, -71.02, -33.88]`. No se afirma que este bbox delimite propiedad o tenencia. Malla EPSG:32719, **143 × 170**, 20 m.

| Resultado         |         Valor |
| ----------------- | ------------: |
| Píxeles válidos   |        20.781 |
| Píxeles excluidos |         3.529 |
| NDVI medio        |      0,566329 |
| NDMI medio        |      0,147491 |
| B04/B02 medio     |      1,494593 |
| B11/B12 medio     |      1,654759 |
| GeoTIFF           | 389.960 bytes |

SHA-256 final: `7de9eff395c3e48b36ccc43773713a89a7c1de491cef7e5cceafdf111c503460`.

[GeoTIFF de prueba](/private/tmp/geocapitals-sentinel-real.tif). La evidencia persistente se registra en [procesamiento-real-sentinel-2026-10-10.evidencia.json](procesamiento-real-sentinel-2026-10-10.evidencia.json). El GeoTIFF y los logs son artefactos temporales locales.

## Validación técnica

Se probaron alineación de resoluciones, offsets BOA, máscara SCL/nodata, fallo sin píxeles claros, seguridad de URLs y lectura/cálculo completo desde GeoTIFFs controlados. La UI exige AOI y selección de escena y comunica fallos sin presentar éxito. Las pruebas controladas son fixtures, no datos medidos; la prueba externa se registra separadamente.

Resultados finales: typecheck completo aprobado (salida 0); lint completo con cero errores y siete advertencias existentes, y lint de todos los archivos nuevos/modificados de esta fase sin avisos; suite completa con **696 tests aprobados y cinco omitidos** (cuatro RLS y uno de red opt-in), 135 archivos aprobados y dos omitidos; nueve regresiones seleccionadas aprobadas; prueba externa opt-in aprobada. Build cliente/SSR/Nitro aprobado (salida 0), conservando avisos de dependencias/APIs, sin avisos de memoria ni dependencias circulares. Se comprobó que el artefacto SSR incluye la versión final del encoder y su límite de metadatos. `git diff --check` aprobado. La prueba externa es opt-in (`RUN_SENTINEL_LIVE=1 npm run test -- src/lib/remote-sensing/sentinelRaster.live.test.ts`) para no hacer depender CI de disponibilidad de red. Se corrigieron errores de tipos y del harness encontrados durante la validación.

## Activación y límites pendientes

- Preparada la migración `supabase/migrations/20261010140000_satellite_real_raster_storage.sql`: bucket privado `satellite-products` con límite de 20 MB, lectura para miembros y escritura/borrado en la carpeta del usuario miembro. **No aplicada**: respeta la instrucción de no publicar. No se crearon políticas ni buckets en el backend durante esta sesión.
- La corrida autenticada, inserción/actualización bajo RLS, subida y descarga firmada necesitan validarse con una cuenta y el backend provisionado. La prueba real confirma el cálculo y el archivo, no ese recorrido privado completo.
- No se implementaron SAM para EMIT/ASTER, deformación InSAR ni diferencia de DEM reales. Esos controles previos siguen identificados como demostraciones. Tampoco se migraron las corridas heurísticas históricas por targets ni sus productos.
- El resultado se consulta como estadísticas y descarga GeoTIFF. La superposición ráster de estos cuatro índices en el visor compartido queda pendiente; no se añadió un visor paralelo.
- No se escriben estas razones de banda en `hyperspectral_products` como si fueran minerales detectados. No hay interpretación automática ni certificación geocientífica.

Logs locales: `/tmp/geocapitals-real-processing-*.log`. Sin push, deploy ni publicación.
