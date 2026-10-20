# PR #338 — Geofísica 3D · representación fiel de anomalías

## Problema corregido
El visor anterior convertía cada anomalía geofísica en una columna hacia abajo, asignando **150 m cuando no existía profundidad** y un mínimo visual de 50 m. Esa visualización podía parecer un sólido mineralizado o un cuerpo geofísico medido cuando solo se conocía un punto y una interpretación de anomalía.

## Implementación
- `normalizeGeophysicalAnomalies`: consume únicamente coordenadas WGS84 finitas y válidas, conserva el tipo/severidad declarados y metadatos opcionales de magnitud y profundidad **estimada**, sin inventar unidades o valores.
- Las anomalías del proyecto se representan como `ScatterplotLayer` en `[lng,lat]`, círculos sobre la escena, sin columna subterránea ni volumetría. La severidad codifica exclusivamente una **categoría registrada**, no una ley mineral ni amplitud geofísica. Si falta severidad, usa gris `unknown`, no media.
- Se conserva id de capa `geophysics.anomalies`, el registro de anchors para enfoque, la misma consulta con filtro `project_id` y el contrato `{layer,count}`.
- Datos inválidos (latitud, longitud, código) no se reubican al centro del proyecto; se omiten. Profundidad <=0, NaN o ausente queda nula. No inferir profundidad por respuesta espectral/gravimétrica/magnética.

## Validación
- Pruebas puras: profundidad desconocida, profundidad estimada explícita, coordenadas inválidas, severidad no declarada y códigos.
- CI: TypeScript, tests, lint y build. Registrar por separado la deuda basal de PR #333.
- Manual: probar modo Subsurface en proyectos con/sin anomalías autorizadas, leyenda, foco de copilot y comparación con mapa 2D, incluido móvil 390px.
- Los marcadores son representaciones geográficas, no demuestran depósitos ni recursos.

## Siguientes fases
- **Geofísica de campo**: ingestión con CRS, unidad y técnica de adquisición, intensidad, fecha, datum vertical y QA; grillas e IDW como DERIVADO, con resolución y nulos, y perfiles reales.
- **Sondajes**: `useDrillHolesLayer` aún convierte easting/northing relativos al centro usando 111320 m por grado sin contrato claro de CRS. Es una deuda prioritaria, no cambiar esa transformación en este PR. Para una trayectoria real se requieren collares E/N + EPSG, datum y unidades, azimut/inclinación y surveys por intervalo.
- **Satélite**: coordinar con PR #332 el pipeline STAC/EMIT/ASTER y mostrar fecha, resolución y cobertura reales.

## Fuera de alcance
No modificar motores MapLibre/deck.gl, permisos, servicios ni esquemas SQL, persistencia, otros proyectos, procesamiento satelital o wallet. Sin publicación ni merge automático.
