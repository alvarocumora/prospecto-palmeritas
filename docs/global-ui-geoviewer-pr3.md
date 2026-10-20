# GeoCapitals Global UI/UX — PR 3: visor de proyecto

## Decisión técnica
No crear ni sustituir motores de mapa. `ProjectWorkspaceViewer` es el contenedor del workspace y conserva `WorkspaceProjectLayers` como único compositor por proyecto. Para proyectos públicos sigue usando `UnifiedProjectScene` y `GeoScene3D`, sin modificar sus capas, cámara, fuentes o geometrías. No crear rutas adicionales.

## Cambios de la iteración
- Shell en Institutional Modernist (`im-light`), con jerarquía coherente con el dashboard, borde semántico y superficie de canvas explícita `data-surface="canvas"`.
- Estados compartidos `ContentState` para activación y proyecto no disponible. Nunca se monta un proyecto distinto mientras cambia el proyecto activo.
- Controles Planta/Perspectiva accesibles, con `aria-pressed`, grupo etiquetado y blancos táctiles ≥44 px.
- La clase `heightClassName` del consumidor ahora llega al canvas, respetando variantes de altura.
- El encabezado compacto conserva el comportamiento de ocultar título o botones según las props actuales.
- Prueba adicional sobre cambio de vista, disparo de callback y render en un único canvas.

## Restricciones y QA
- Sin cambios en MapLibre, deck.gl, Leaflet legacy, tablas, datos STAC, permisos ni funciones financieras.
- Validar 320 / 390 / 1440 px para el contenedor y con usuario autorizado, sin afirmar inspecciones no ejecutadas.
- CI de TypeScript, lint, tests, build. Registrar por separado los fallos heredados del suite GeoScene3D en #333.
- Smoke: proyecto conocido, proyecto ausente, transición activa, vista controlada y vista local, `compactHeader`, capas.
- Merge solo tras comprobar el diff y los tests relevantes; no desplegar ni publicar automáticamente.

## Próximos PRs
Continuar con controles de capas/inspector/leyendas dentro de un lenguaje compartido usando datos de procedencia. Coordinar con #332 (capas satelitales) y #333 (mocks GeoScene3D), sin rebases que cambien geometría ni fuentes.
