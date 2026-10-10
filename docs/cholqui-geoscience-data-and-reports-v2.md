# Cholqui: informes, geofísica sobre DEM y fuentes de integración

Revisión de main 11d1321de0bb75ee72f4bfe9fb6fbd10d846e6b2. Fuentes consultadas el 10 de octubre de 2026 (America/Santiago). Este documento distingue código implementado, fuentes investigadas e integraciones pendientes. No incorpora datasets nuevos como evidencia del proyecto.

## Cambios del paquete

- La descarga histórica de inversión delega al renderer institucional y a las fuentes embebidas, con versión separada para memorando y teaser. El teaser pasa a ser un resumen real de una página. El memorando conserva antecedentes analíticos, flujos mensuales (dos mesetas, 24 meses), sensibilidad, flota/costos, ronda, garantías, contrato complementario y matriz de procedencia. Los detalles se trasladan a anexos.
- Los informes técnico, de targets y de terreno comparten un inventario de datos y una explicación de DEM, MAG/IP, interpolación/inversión e insumos para estimación. No se incorporan cotas, pendientes ni resultados geofísicos sin snapshot de campaña.
- El PDF de targets usa azimuts/dips del archivo publicado, mantiene IDs por orden original del dataset y lista el catálogo completo de candidatos. Se elimina la asociación automática entre flag de tenencia y collares. No existe anomalyId informado en la propuesta publicada.
- El 3D muestra estaciones y líneas de campo del proyecto, elegidas por campaña, y permite proyectar superficies numéricas IDW MAG/IP sobre DEM real. La altura procede del terreno; el valor geofísico sólo cambia el color. Se muestran rango, unidades, cantidad de estaciones y mediana MAG. Superficies apagadas inicialmente y ocultas en modo evidencia primaria.
- Se reutilizan el interpolador y los colores del 2D, los IDs del registro de capas y sus preferencias. Se excluyen filas globales, otros proyectos, simuladas, coordenadas inválidas y campañas ajenas. Si RLS o la ausencia de estaciones no permite datos, se muestra un estado vacío explícito.
- El interpolador rechaza campañas/proyectos mezclados y posiciones duplicadas pendientes de QA. El residual visual sigue siendo TMI menos mediana, no una corrección diurna/IGRF ni inversión.
- No se cambia acceso/RLS, no se despliega una Edge Function ni un worker y no se instala software científico nuevo.

## Fuentes de datos verificadas

| Fuente | Aplicación para Cholqui | Acceso / producto | Condiciones y alcance |
| --- | --- | --- | --- |
| [SERNAGEOMIN: catálogo](https://portalsdnmext.sernageomin.cl/publicacionesgeologicas) y [Portal GEOMIN](https://portalgeomin.sernageomin.cl/service/60de3ded818938000000) | Litología, contactos, fallas, depósitos y cartografía geofísica publicada | Consultar publicaciones y descargar SIG cuando el producto lo incluya | Verificar cobertura, edición, escala, datum y permiso de redistribución por producto; no asumir una API WFS universal |
| [Mapa San Antonio–Melipilla, 1996, 1:100.000](https://catalogobiblioteca.sernageomin.cl/cgi-bin/koha/opac-ISBDdetail.pl?biblionumber=268879) | Primera carta candidata para marco geológico | Registro bibliográfico oficial | Comprobar extensión exacta sobre el AOI antes de declararla integrada; revisar también Talagante–San Francisco de Mostazal |
| [SIGEX](https://www.sernageomin.cl/sigex/) | Antecedentes de exploración publicados en el entorno del proyecto | Sistema de entrega y acceso a información de exploración | No equivale a libre disponibilidad de toda campaña privada; comprobar acceso, metadatos y derechos |
| [Copernicus DEM](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) | Relieve, soporte visual, pendientes de screening y malla/topografía de cálculo | GLO-30 ya usado por la plataforma | Es un modelo de superficie; controlar referencia vertical y exactitud local. No reemplaza topografía de replanteo |
| [Copernicus STAC](https://documentation.dataspace.copernicus.eu/APIs/STAC.html) | Escenas Sentinel-2 L2A y metadatos reproducibles | https://stac.dataspace.copernicus.eu/v1/ | El catálogo descubre productos; autenticación/descarga depende del servicio. Alinear bandas de 10/20/60 m, SCL, NoData y escala/offset |
| [NOAA EMAG2v3](https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ngdc.mgg.geophysical_models%3AEMAG2_V3) | Contexto magnético regional | GeoTIFF numérico float32 nT, CSV con origen/error; 2 arc-min | Producto continental continuado a 4 km sobre el geoide; no es magnetometría de detalle. Citar DOI 10.7289/V5H70CVX, conservar altura y grilla originales |
| [BGI WGM2012](https://bgi.obs-mip.fr/grids-and-models-2/grids-and-models-2-2/) | Contexto gravimétrico regional | Grillas globales aire libre/Bouguer/isostática | Distinguir producto de grilla de datos de estaciones. Los [términos BGI](https://bgi.obs-mip.fr/data-products/terms-of-use/) dan acceso gratuito a determinadas grillas globales; estaciones y usos comerciales/redistribución tienen condiciones específicas. Revisar el producto elegido |

No se verificó una campaña MAG/IP/gravimetría de detalle descargable para el AOI de Cholqui. Los portales se identificaron, pero no se descargaron binarios ni se confirmó la cobertura de cada publicación. La lectura directa del catálogo de publicaciones devolvió un error de acceso temporal; los registros bibliográficos y resultados oficiales permiten identificar cartas candidatas, no acreditar una ingesta.

## Repositorios científicos verificados

Licencias según API GitHub y, para GemPy/SimPEG, el archivo LICENSE actual. Fijar release/commit y validar dependencias antes de construir una imagen de worker.

| Repositorio | Función | Licencia observada | Integración propuesta |
| --- | --- | --- | --- |
| [SimPEG](https://github.com/simpeg/simpeg) | Modelado directo e inversión geofísica | MIT | Extender el worker magnético existente; emplear topografía, celdas activas, incertidumbre de medida y validación de respuesta |
| [Harmonica](https://github.com/fatiando/harmonica) | Procesamiento MAG/gravedad, fuentes equivalentes, prismas y correcciones de terreno | BSD-3-Clause | Preproceso/gravedad en Python; no reemplaza el contrato de inversión existente |
| [Verde](https://github.com/fatiando/verde) | Gridding, tendencias y validación espacial | BSD-3-Clause | Comparar grillas con validación por bloques; conservar soporte y error, sin extrapolación silenciosa |
| [PyKrige](https://github.com/GeoStat-Framework/PyKrige) | Kriging ordinario/universal 2D/3D | BSD-3-Clause | Worker de estimación separado de Deno, variograma documentado y validación por campaña/dominio |
| [GeostatsPy](https://github.com/GeostatsGuy/GeostatsPy) | Análisis geostatístico y simulación | MIT | Evaluación de declustering, variogramas y escenarios de incertidumbre |
| [GemPy](https://github.com/gempy-project/gempy) | Modelado geológico implícito | EUPL-1.2 en main consultado | Evaluar interfaces/orientaciones y obligaciones de licencia de la versión concreta; no instalarlo aún. Resultados de búsqueda antiguos muestran otras licencias |

## Arquitectura de integración

Se conserva el registro canónico de capas y las versiones de datasets existentes. Evitar otro sistema de mapas o de informes.

1. **Ingesta:** AOI + fuente + fecha + términos + archivo original inmutable. Registrar checksum, CRS horizontal, datum vertical, escala, unidades, NoData, resolución y altura de observación.
2. **Normalización:** transformar a un CRS métrico documentado (para Cholqui, WGS84/UTM 19S EPSG:32719 cuando corresponda). Las coordenadas históricas PSAD56/UTM 19S EPSG:24879 requieren transformación y control; no sólo cambiar el código EPSG. Conservar original y transformación.
3. **Procesamiento:** worker Python produce COG numérico para superficies, geometrías vectoriales para contactos/fallas, y malla/volumen versionado para inversión. No elevar una anomalía superficial por su score.
4. **Cálculo con terreno:** DSM/DEM y altura del instrumento no son lo mismo. MAG requiere TMI, fecha/hora, base diurna/IGRF y elevación del sensor; gravedad requiere deriva, mareas, latitud, altura, Bouguer y corrección de terreno; IP requiere posiciones de todos los electrodos, configuración, corriente/voltaje, ventanas y error. Mantener referencia vertical común.
5. **Visualización:** misma escala numérica, unidad y versión en 2D/3D. Drapeado muestra una variable superficial; inversión muestra propiedades/volumen bajo una malla de topografía y celdas activas. El remuestreo no mejora la resolución de origen.
6. **Informe:** exportar el snapshot de selección, campaña, variable, escala, DEM, fuentes/checksums y parámetros junto con cada figura. Mantener el inventario analítico y la propuesta publicados como fuentes, sin sustituirlos por modelos generados.

## Gaps de estimación detectados que requieren un paquete independiente

- estimate-resources implementa IDW y vecino más cercano; OK está deshabilitado en UI, pero el backend puede caer en IDW si recibe method=ok.
- El backend asigna measured/indicated/inferred según distancia y cantidad de vecinos; eso no acredita clasificación de recursos. Debe sustituirse por soporte/validación y clasificación explícita revisada.
- Proyección de compósitos usa collar + azimut/dip fijo, con defaults cuando faltan; todavía no consume trayectorias con desvío y mínimo curvado.
- Los compósitos pueden atravesar vacíos/dominos, y el bloque estimado no se recorta contra topografía o sólidos de dominio.
- Falta controlar densidad por dominio, cobertura de compósito, soporte de sondajes distintos, variograma, validación cruzada, swath y unidades de metal (Cu % requiere dividir por 100 para toneladas de metal).
- El PDF geocientífico indica estas condiciones de habilitación y no usa ese motor para afirmar recursos de Cholqui.

## Orden de integración

1. Ingestar la carta geológica local con contactos/fallas y un manifiesto de procedencia.
2. Validar un recorte numérico EMAG2v3 con grilla de origen, altura y error; mantenerlo como contexto regional.
3. Incorporar una campaña MAG/IP propia con contrato de adquisición completo y QA.
4. Completar preproceso y ejecutar inversión SimPEG con terreno/celdas activas; comparar observado/predicho y residuos.
5. Habilitar secciones sincronizadas y snapshots de informe.
6. Abordar el motor de estimación en una PR separada antes de presentar categorías o tonelajes para decisiones de capital.

## Validación y aceptación

Pruebas nuevas: aislamiento proyecto/campaña, exclusión de simulados/globales y posiciones inválidas, rechazo de campañas mezcladas/duplicados, proyección sobre DEM real y exclusión fuera del terreno, azimuts/IDs de targets PDF, siete collares/1.070 m, escenarios de 24 meses y garantías conservadas.

CI y revisión visual de PDFs/3D deben verificarse antes de publicar. Revisar A4/teaser/deck, portada, índice, anexos, glifos y fuentes, cortes de tablas, escala/unidades/leyenda, cambio de campaña, modo evidencia primaria, ausencia de datos, fallo DEM y preferencias 2D/3D.

Estado de validación del paquete: 17 fuentes TS/TSX analizadas sintácticamente mediante el parser TypeScript de Prettier 2.0.5 en V8, y 11 comprobaciones directas del código puro (transpilación por borrado de tipos AST; publicUrl aislado). Se comprobaron aislamiento de proyecto, mediana/campañas/duplicados, drapeado DEM, rechazo de terreno sintético/fuera de área, siete collares/1.070 m, flujos de 24 meses, IDs y azimuts del PDF. No sustituyen tsc, ESLint/Prettier 3.7, Vitest, build ni renderizado visual. GitHub Actions falló antes de asignar runner en la corrida 38029524339 y su reintento; la validación completa y el formato con la versión del proyecto siguen pendientes. El workflow original se conserva en el commit final.
