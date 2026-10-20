# GeoCapitals · Mining Viewer 3D — ruta técnica

## Referentes revisados
- Seequent Leapfrog Geo: https://www.seequent.com/products-solutions/leapfrog-geo/ — integración de GIS, sondajes, superficies e interpretaciones en una escena 3D.
- Leapfrog, visualización de sondajes: https://help.seequent.com/Geo/2025.3/en-GB/Content/drilling/view-drilling-data.htm — intervalos, tablas, leyendas, filtros, cilindros y trazas.
- Maptek, perforación: https://help.maptek.com/geologycore/2022/topics/key-concepts/drillhole-visualisation.htm — leyendas por leyes analíticas y continuidad de perforación.
- deck.gl con MapLibre: https://deck.gl/docs/api-reference/maplibre/overview — overlays integrados sobre mapa WebGL2.
- deck.gl GeoJSON/Terrain: https://deck.gl/docs/api-reference/layers/geojson-layer y https://deck.gl/docs/api-reference/geo-layers/terrain-layer

## Auditoría del código de GeoCapitals
Ya hay **una** escena 3D canónica en `GeoScene3D`, usando MapLibre + deck.gl, con DEM, capas GeoJSON, visor 2D/3D, indices Sentinel, anomalías geofísicas, objetivos, sondajes y capas opcionales EMIT/ASTER. Los adaptadores de Cholqui y Los Verdes incorporan datos con diferentes procedencias. **No reemplazar ni duplicar motor**.

### PR #337 (esta entrega)
El primer upgrade es un inspector técnico incrustado en **ProjectSceneFrame** (consumido por Cholqui / Los Verdes / Palmeras / Nahuelbuta). Tiene filtros Satélite, Muestras, Geofísica, Sondajes, Concesiones y otros, con origen, escala, evidencia del registro canónico, número de features cargados y ejemplos de identificadores. Es un visor del inventario de las capas ya entregadas; no crea nuevos valores. Permite abrir/cerrar detalles accesibles en móvil y escritorio.

**Alcance:** datos GeoJSON del proyecto en escena (solo capas ya cargadas). No incluye consultas internas asíncronas de `useSatAnomaliesLayer`, `useGeophysAnomaliesLayer`, ni raster remoto de Sentinel, por lo que cifras del inventario no deben interpretarse como totales del proyecto. No estima toneladas, leyes, profundidad ni recursos. Los controles de visibilidad de la escena siguen exclusivamente en el panel «Capas».

## Próximos PRs sin atribuciones falsas
- #338 **Geofísica**: introducir metadatos trazables de unidad/tipo de estación/ensayo, mapas de anomalía sobre DEM, perfiles solo desde líneas de adquisición reales, interpolación IDW etiquetada DERIVADO. No extruir cuerpos ni asignar profundidad por defecto (el hook actual de anomalías usa un fallback de 150 m que debe revisarse).
- #339 **Satélite**: una vez resuelto #332, exponer fecha de imagen, fuente, cobertura, índice y resolución; proyectar raster con transformada espacial oficial, máscara de nodata y escala colorimétrica calibrada. Sentinel/EMIT muestran espectro: indicio, **no** ley ni yacimiento.
- #340 **Perforación, ensayes y secciones**: collares, survey, intervalos from/to, litología y assay por unidad con trayectorias y límites; sección vertical por azimut/ancho de banda, filtros y leyendas. Exigir CRS y datum vertical, QC coordenadas, metadatos de laboratorio y permisos antes de construir volúmenes o superficies de ley.
- #341 **Geología de inversión**: evidencia por target con scoring fundamentado, incertidumbre y data-room vinculado; supeditar reservas/recursos a estándar JORC / NI43-101 cuando exista reporte válido.

## Contratos de calidad
1. `project.id` y permisos contextualizados; sin fallback a otro proyecto.
2. Cada capa: identificador canónico, procedencia, escala, unidades, cobertura, estado de disponibilidad y aviso.
3. Interpolación no equivale a medición; profundidad estimada no es cuerpo geológico; la escala del DEM no crea precisión adicional.
4. Prohibido dibujar muestras ficticias, sondajes ficticios, cuerpos de mineral, mallas o secciones sin datasets respaldados.
5. Performance: lazy-load capas voluminosas, memoización, mobile-first panel plegado por defecto, libre interacción con el canvas.
6. Test: selector de dominio, clasificación inmutable, carga vacía, límites de nombres y render por proyecto; revisar 390/1440 con browser, y permisos.
7. Mantener PRs independientes: #332 afecta integración STAC, #333 afecta mocks y estilos del motor, #336 afecta chrome de workspace. No tocar esos archivos en #337.

## Estado
Este PR es un paso funcional y acotado, **no** la finalización del visor minero 3D. No publicar ni merge automáticamente. Validar typecheck/lint/tests/build y registrar el baseline de fallos conocidos.
