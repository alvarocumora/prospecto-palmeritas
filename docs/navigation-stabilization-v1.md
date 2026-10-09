# Estabilización de navegación — primera entrega

Base auditada: main 4a58fa6138f9d5dd7c5be38769f034b2d8d6f4c7.
La arquitectura objetivo sigue siendo docs/project-workspace-v1.md.

## Problema y comportamiento corregido

El dashboard, el terminal global y los terminales públicos usaban selecciones independientes.
Las rutas privadas de proyecto redirigían al sitio público, y Satelital enviaba UUIDs a un
resolver que únicamente aceptaba slugs. La sustitución del mapa de Los Verdes omitió targets
y magnetometría.

Esta entrega usa rutas existentes para recuperar continuidad antes de ampliar el árbol:

- Workspace privado: /dashboard/project-report?project=<UUID>&view=2d|3d.
- Ficha y financiamiento: /dashboard/projects/<UUID>.
- Vista pública: /terminal/<slug>?tab=mapa|tesis|simulador|dataroom&view=2d|3d.
- Enlace satelital: /visor-3d?project=<UUID>&anomaly=<id> o &insar=<id>.

La URL privada identifica el proyecto. El layout espera a que se active una membresía
disponible antes de montar el módulo, y rechaza identificadores no disponibles sin sustituir
otro activo. El mapa 2D y GeoScene3D se reutilizan por UUID, sin crear un dashboard por proyecto.
El selector, las pestañas internas y el portfolio conservan esa identidad.

Las rutas históricas privadas usan un adaptador temporal de perfiles para resolver una
membresía; no deben usarse sus coincidencias por nombre para incorporar nuevos proyectos.
La ficha pública se abre explícitamente y no reemplaza el workspace autenticado.

Satelital conserva la anomalía/adquisición solicitada y usa ProjectTerrain3D, sin añadir otro
motor de renderizado. Solo se dibujan anomalías con coordenadas publicadas. InSAR conserva su
detalle como selección; no se inventa geometría donde el endpoint no la proporciona.
Los fallos de DEM muestran un estado de disponibilidad sin presentar relieve sintético como medido.

Los Verdes utiliza PublicCanonicalMap y el adaptador existente con concesiones, satélite,
targets, magnetometría y muestras, conservando el estado de los registros y sus certificados.
Los mapas del terminal permanecen montados tras visitar su pestaña, y recalculan su tamaño
al volver a mostrarse para conservar cámara y capas.

## Validación y aceptación

CI debe pasar instalación, TypeScript, lint, pruebas y build sobre ambos PRs.
Las pruebas de regresión verifican resolución UUID/slug, selección de anomalía/InSAR,
rechazo de activos no disponibles y aislamiento de capas antes de activar un proyecto.

La comprobación visual requiere un entorno de aplicación y estos recorridos:

1. Satelital → anomalía → Ver en 3D: mismo UUID y anomalía destacada; retorno al mismo proyecto.
2. Satelital → InSAR → Ver en 3D: mismo UUID y adquisición visible en el panel.
3. Terminal público → 3D → tesis → mapa: conservar modo, cámara y capas.
4. Proyecto privado → workspace → financiamiento: conservar UUID y selector.
5. Abrir un enlace privado de otro proyecto: activar su membresía antes de mostrar capas.
6. UUID privado inaccesible: mostrar indisponibilidad sin abrir otro proyecto.
7. Cholqui/Franco/Palmeras legacy: permanecer dentro del dashboard.
8. Cholqui → Satélite/SPV: conservar acceso a ambos módulos privados.
9. Los Verdes 2D: mostrar controles y datos de targets, magnetometría y muestras.

## Próximas entregas

1. Crear el workspace por /projects/:projectId/:section conforme al documento de arquitectura,
   reutilizando esta resolución por UUID y migrando las secciones sin perder capacidades.
2. Sustituir el adaptador histórico de perfiles y los UUID ya conocidos del catálogo por una
   relación persistida UUID–slug; registrar Palmeras y Nahuelbuta sin inferir por nombre.
3. Unificar los bundles públicos y privados mediante permisos de publicación y metadatos de
   procedencia; mantener las diferencias de acceso de ambas superficies.
4. Integrar documentos, campañas, QA/QC, escenarios y validación dentro del workspace.
5. Vincular Capital y Trade mediante relaciones explícitas proyecto–deal–operación; resolver
   compras externas que no provienen de un proyecto propio, sin imponer una relación artificial.
6. Actualizar el registro de visores retirables y retirar implementaciones tras demostrar paridad.

Esta entrega no declara readiness ni cumplimiento certificado NI 43-101/JORC o admisión TSX.
