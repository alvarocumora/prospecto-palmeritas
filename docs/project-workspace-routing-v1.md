# Workspace por UUID — primera migración de secciones

Base: main fdce083018dbcd64dc53886b5bf1772a23b6def5, después de integrar #311 y #312.
Contrato objetivo: [Project Workspace v1](project-workspace-v1.md).

## Entrega

La ruta privada /projects/:projectId/:section permanece dentro del layout autenticado.
Se migran overview, exploration (campañas geofísicas), targets, model y validation (QA/QC).
Los componentes reciben projectId explícito y consultan ese UUID.
Los formularios, exportaciones y operaciones existentes se conservan; las rutas históricas
son adaptadores temporales y siguen mostrando sus rutas hijas de campañas y AI Brief.

La URL determina el proyecto; el layout no monta la sección hasta activar su membresía.
El selector cambia el UUID de la ruta y conserva sección, filtros y fragmento.
Las pestañas muestran únicamente las secciones permitidas y reutilizan las políticas
existentes de módulo, plan y rol. Las consultas y mutaciones conservan sus controles
actuales del servidor y RLS.

Resumen conserva el mapa y los paneles privados Satélite/SPV de Cholqui.
Modelo usa GeoScene3D mediante ProjectWorkspaceViewer. La sección determina el modo:
overview en 2D y model en 3D. El parámetro view adapta enlaces históricos;
el toggle navega entre las secciones canónicas.
La ficha pública se abre explícitamente en otra pestaña. La ficha de financiamiento
mantiene su ruta actual y vuelve al resumen por UUID.

Typecheck genera primero el árbol de TanStack con la misma versión instalada por
router-plugin. El archivo generado se sincroniza con el resultado real del generador.

## Aceptación

- Proyectos → Abrir workspace → Modelo 3D → selector: conservar UUID, sección y capas.
- URL canónica con query project contradictoria: prevalece el UUID del path.
- UUID sin membresía o sección desconocida: no sustituir otro activo.
- Targets: ranking, mapa, creación y exportación según los permisos existentes.
- Exploración: campaña → detalle → campo; conservar UUID y navegación de retorno.
- Targets → AI Brief: abrir la ruta hija conservando UUID.
- Validación: QA/QC únicamente para roles habilitados.
- Cholqui: resumen → Satélite/SPV → financiamiento → resumen.
- Enlaces históricos de project-report/geophysics/targets/qaqc: adaptar sin salir del dashboard.

Las pruebas cubren identidad, cambio de proyecto y paridad de permisos.
La comprobación visual de mapas, formularios y exportaciones requiere navegador y datos
de una cuenta autorizada; sigue pendiente.

## Siguientes migraciones

Cadastre, documents, economics y mining todavía no se publican como secciones canónicas.
Exploration integra geofísica; muestreo, sondajes y campañas adicionales mantienen sus
pantallas actuales hasta extraer sus componentes con paridad.
Capital/Trade requieren relaciones persistidas proyecto–deal–operación y soporte a compras externas.
También quedan pendientes la relación UUID–slug y el retiro de adaptadores de perfiles.
No se declara cumplimiento certificado NI 43-101/JORC ni readiness de admisión TSX.
