# Cholqui: visualización geocientífica v1

## Recorrido

Terminal público: `/terminal/cholqui?tab=mapa&view=2d` y `view=3d`.
El terminal conserva sus visores existentes. El 3D consume el bundle de evidencia publicada, incluida la misma malla estática de siete sondajes propuesta que el 2D. Las capacidades autenticadas de ProjectWorkspaceViewer y GeoScene3D siguen su contrato de acceso existente.

## Cambios

- Lectura Copernicus GLO-30 por todos los archivos que toca la grilla. Cada muestra conserva su ubicación; ya no se estira al área solicitada un recorte del archivo central.
- El 3D solicita explícitamente el centro de Cholqui y muestra solo terreno real completo. Un fallo ofrece reintento y acceso al 2D; el fallback procedural no se dibuja. Los fallos no quedan guardados en el cache del servidor.
- Extensión 20 × 20 km, grilla 257 × 257 (78,1 m de paso visual). La resolución nominal del producto (~30 m) y el paso de visualización se distinguen. Las cotas son relativas al centro; exageración vertical 1×.
- Huellas originales de los 57 candidatos satelitales, con colores por índice, polígonos multipartes/anillos y líneas apoyadas sobre el terreno. No hay radio de alteración inventado, extrusión por score ni profundidad inferida del satélite.
- No se interpola el conjunto de z-scores de Cholqui. El archivo publicado declara poblaciones de fondo distintas y mezcla índices; los valores originales se conservan en los inspectores.
- Catastro oficial, pedimentos pendientes/propuestos, hitos de mensura, estructuras y contexto metalogénico provienen de los mismos archivos publicados. Las geometrías se recortan a la extensión disponible del DEM.
- Proyección en planta de los sondajes según su azimut, inclinación y profundidad explícita. El 3D y la tabla de targets usan esa misma propuesta (1.070 m publicados); no vuelven a generar un plan con otra función. Los enlaces de anomalía y objetivos ausentes se declaran como no informados.
- Visibilidad y opacidad guardadas por proyecto y capa canónica para continuidad 2D/3D. La opacidad respeta la transparencia original de cada estilo, también dentro de grupos Leaflet.
- Búsqueda y encuadre por capa en el 2D; búsqueda, modo evidencia primaria, opacidad y vistas planta/perspectiva en 3D. Controles colapsables.
- Los puntos sin informe de ensaye vinculado se conservan como observaciones documentales, con símbolos grises. No reciben un badge de ensaye certificado.
- La certificación del ensaye no valida la coordenada histórica. Se mantienen las posiciones WGS84 publicadas y se declara su origen PSAD56/UTM 19S; este cambio no las transforma silenciosamente.

## Verificaciones automatizadas

Pruebas de mosaico en el borde longitudinal que cruza Cholqui, archivo ausente, NoData y elevación cero; orientación/interpolación de coordenadas, multipartes/anillos y dirección/profundidad de sondajes; continuidad de preferencias 2D/3D y aislamiento entre proyectos; controles de evidencia primaria; preservación de los 57 candidatos y siete collares sin superficie IDW incompatible. CI ejecuta typecheck, lint, tests y build.

## Aceptación visual pendiente de publicación

1. Comparar posiciones de candidatos y collares entre 2D y 3D, especialmente a ambos lados de 71°W.
2. Desactivar una capa y ajustar opacidad en 2D; comprobar continuidad al pasar al 3D.
3. Verificar planta, perspectiva, encuadre y controles en móvil.
4. Comprobar siete trazas propuestas con el azimut, inclinación y profundidad del archivo publicado.
5. Probar un fallo DEM: ningún relieve artificial debe aparecer como terreno real.
6. Comprobar información de ensayes, observaciones documentales y faena vecina sin confundir procedencia.

## Próximo paquete

- Unificar el inspector y la selección de entidades entre terminal y workspace autenticado.
- Resolver CRS/datum y referencia vertical de sondajes de base de datos: el problema global de convenciones UTM versus offsets locales no queda resuelto por este piloto estático.
- Corregir la alineación de bandas/máscara, NoData y escala/offset del muestreador Sentinel para nuevos análisis. No se recalcula el archivo de candidatos publicado.
- Mapas raster numéricos y leyendas geofísicas por variable/unidad, versiones y soporte de datos.
- Integrar resultados de inversión SimPEG, incertidumbre y secciones sincronizadas; no presentar IDW como inversión.
