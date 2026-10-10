# Análisis satelital y catastro: revisión y repositorios

Revisión del árbol local de GeoCapitals en `main`, SHA base `9250d53f841880cba1d1f66391527b61e8bd6f0c`. Se conservaron las correcciones de consolidación y fluidez previas. Sin push, publicación ni escrituras de prueba en la base de datos.

## Hallazgos y correcciones

### Análisis satelital

El flujo hiperespectral consulta STAC, pero `seedHyperspectralFromScene` genera cinco productos con scores y áreas constantes. No ejecuta SAM ni procesamiento de píxeles. Antes podía hacerlo sin escena y usaba un AOI fijo ajeno al proyecto cuando faltaban coordenadas.

Se corrigió el recorrido para exigir un AOI geográfico válido y una escena con ID y fecha. Sin escena no llama al generador ni inventa productos. El botón ahora dice **Crear demostración desde escena**, con declaración visible de que los resultados son conceptuales. El servidor exige ID de escena, valida el bbox, registra `algorithm: synthetic_demo` y `provenance: synthetic` en las nuevas demostraciones. No se ejecutó ninguna generación sobre datos reales durante esta revisión.

Los productos existentes con `metadata.seeded` se identifican como **CONCEPTUAL · DEMOSTRACIÓN**. El mapa consulta metadata de productos/InSAR y notas de volúmenes para mostrar procedencia por entidad; lo desconocido queda **DERIVADO · VALIDACIÓN PENDIENTE**, nunca medido por defecto. La IA hiperespectral rechaza registros de demostración en lugar de interpretarlos como detecciones. Los fallos de carga del hook también se muestran en el panel.

La ruta satelital remonta sus módulos al cambiar de UUID de proyecto, evitando conservar formularios e interpretaciones del activo anterior. Incluye una declaración común para las acciones actuales de hiperespectral, InSAR y DEM-diff.

La auditoría también encontró que InSAR genera valores con `Math.random()` y DEM-diff deriva volúmenes sintéticos. Las nuevas filas InSAR quedan marcadas explícitamente como sintéticas y las notas de los nuevos volúmenes indican demostración conceptual. **No se implementó procesamiento real InSAR o DEM-diff**. Tampoco se migraron registros históricos: los volúmenes antiguos sin etiqueta necesitan reconciliarse con sus DEM fuente; no es seguro inferir procedencia únicamente del nombre del sensor.

### Catastro

`arcgisQueryAttributes` convertía HTTP fallido, errores ArcGIS y excepciones de red en `[]`. Eso hacía indistinguibles una fuente caída y una búsqueda válida sin concesiones.

Ahora propaga los errores y rechaza respuestas sin estructura `features`. Una consulta válida con `features: []` sigue siendo un resultado vacío legítimo. El buscador multi-país muestra fuente no disponible, ofrece reintento y anuncia la consulta en curso. Normaliza espacios, permite repetir el mismo término y alinea el máximo a los 64 caracteres admitidos por los conectores. Un país sin conector produce error en lugar de cero resultados. No se cambiaron reglas de titularidad, geometrías ni acceso.

Este cambio afecta a todos los conectores que usan el helper, incluidos Chile, Perú, Brasil y Landfolio. En búsquedas multi-capa, un fallo provoca error en vez de presentar una lista incompleta como resultado completo. Un contrato de resultados parciales explícitos queda como mejora posterior.

## Repositorios públicos examinados

Consulta de documentación primaria el 10 de octubre de 2026. No se clonaron, instalaron ni desplegaron estos proyectos; la compatibilidad propuesta es una evaluación de arquitectura, no una integración validada.

| Repositorio                                                               | Capacidad documentada                                                                         | Aplicación propuesta a GeoCapitals                                                                                                                                             |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [radiantearth/stac-browser](https://github.com/radiantearth/stac-browser) | UI Vue para catálogos estáticos y APIs STAC                                                   | Referencia para explorar escenas, metadatos y assets. Reproducir el recorrido con React/TanStack, conservando el visor canónico.                                               |
| [developmentseed/titiler](https://github.com/developmentseed/titiler)     | Servicio Python/FastAPI para teselas dinámicas COG/STAC, proyecciones y mosaicos              | Candidato para visualizar rásteres reales sin descargar escenas completas al navegador. Requiere servicio separado; no calcula por sí solo minerales ni desplazamientos InSAR. |
| [protomaps/PMTiles](https://github.com/protomaps/PMTiles)                 | Archivo único de teselas alojable en almacenamiento; clientes Leaflet y MapLibre              | Candidato para snapshots catastrales versionados y capas grandes. Separar snapshot fechado de consulta oficial en vivo.                                                        |
| [developmentseed/eoAPI](https://github.com/developmentseed/eoAPI)         | Servicios STAC, ráster y vector sobre PostgreSQL/PostGIS con ejemplos Compose                 | Referencia para arquitectura futura de catálogo + distribución. Evaluar componentes por separado antes de adoptar la plataforma completa.                                      |
| [DanielD-S/Capas_IDE_CHILE](https://github.com/DanielD-S/Capas_IDE_CHILE) | Publica GeoJSON procesado desde fuentes oficiales; README declara actualización junio de 2026 | Fuente secundaria para contrastar snapshots. No reemplazar la fuente oficial ni llamar “en vivo” a sus releases. El antiguo URL `catastro_minero` redirige a este repositorio. |

La comprobación de fuentes debe partir del [portal de visores de SERNAGEOMIN](https://www.sernageomin.cl/visores-mineros/). El contenido del repositorio comunitario es una declaración de su mantenedor; no se verificó registro por registro ni se importaron sus capas. La apertura directa del portal oficial falló en esta sesión, aunque la búsqueda encontró su página; no se interpreta como prueba de indisponibilidad del servicio catastral.

## Flujo propuesto y prioridades

1. **Catastro → concesión → proyecto → AOI:** usar geometría asociada y verificable, con titularidad declarada separada de dominio acreditado. Si solo existe un centro, identificar el bbox como área de consulta aproximada.
2. **AOI → catálogo de escenas:** permitir escoger fecha, cobertura, nubes, sensor y asset. Distinguir escena encontrada, acceso al archivo y producto procesado. Mostrar fecha fuente y fecha de consulta.
3. **Escena → procesamiento trazable:** worker con método, bandas, máscara de calidad, parámetros, versión, checksum y artefacto ráster real. Mantener estados pendiente/en ejecución/fallido/completado. Las demostraciones deben permanecer separadas.
4. **Producto → visor compartido → interpretación:** incorporar teselas COG mediante un servicio como TiTiler; comparar fechas y consultar valores/QA. La IA debe recibir procedencia y límites, no sustituir validación geocientífica.
5. **Catastro a escala:** medir transferencia y dibujo antes de adoptar PMTiles/MVT; diseñar snapshots con fecha y diff frente a fuente oficial. Conservar búsqueda por rol/RUT y detalle oficial fuera de la tesela simplificada.
6. **Exportación:** mantener plantilla PDF institucional; cada sección debe declarar escenas, método, fecha, procedencia y limitaciones reales. Revisar exports/targets históricos para que los derivados de demos no aparezcan como evidencia medida.

## Validación y límites

Se añadieron tests para distinguir fuente vacía de fallida, rechazar payloads ArcGIS inválidos, identificar registros sintéticos, rechazar AOIs inválidos y comprobar que el panel no genera productos sin escena. Typecheck completo aprobado (salida 0). Lint completo aprobado: cero errores y siete advertencias existentes; lint del nuevo test del panel también aprobado. Suite completa: **687 tests aprobados y cuatro omitidos**, 133 archivos aprobados y uno omitido (RLS requiere credenciales). Tests seleccionados: 24 de core catastral/procedencia más dos del panel hiperespectral, todos aprobados. `git diff --check` y Prettier aprobados. Build completo (`npm run build`): salida 0, cliente/SSR/Nitro aprobados; conserva avisos de dependencias/APIs, sin avisos de memoria ni dependencias circulares.

[Evidencia persistente](revision-satelital-catastro-2026-10-10.evidencia.json).

El dashboard satelital requiere autenticación. No se acreditan acceso a assets NASA, procesamiento de escenas reales, alertas InSAR de campo, exactitud legal del catastro ni CRUD privado. Los controles de InSAR/volúmenes, sus interpretaciones IA y exports requieren una revisión adicional de procedencia por registro antes de usarlos para decisiones operacionales. Node 24 local sigue siendo diferente de Node 22 de CI.

Logs: `/tmp/geocapitals-satellite-cadastre-{typecheck,lint,tests,full-tests,build}.log` y `/tmp/geocapitals-satellite-panel-tests.log`.

## Implementación posterior

El nuevo flujo de procesamiento real Sentinel-2 y su validación con píxeles de una escena pública están registrados en [procesamiento-real-sentinel-2026-10-10.md](procesamiento-real-sentinel-2026-10-10.md). Esta implementación calcula índices multiespectrales y exporta GeoTIFF; no convierte en reales los generadores previos de EMIT/ASTER, InSAR o DEM-diff. La migración de almacenamiento sigue preparada sin aplicar.
