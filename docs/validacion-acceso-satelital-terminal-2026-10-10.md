# Acceso al procesamiento satelital desde la terminal

El panel real Sentinel-2 estaba disponible exclusivamente en `/dashboard/satellite-intel`; la terminal no exponía una acción para abrirlo.

Se añadió la pestaña **Análisis satelital** (móvil: **Satelital**) a todas las terminales. En Cholqui: `/terminal/cholqui?tab=satelital`. Reutiliza `SentinelProcessingPanel`, sin crear otro procesador ni visor. Flujo: definir AOI → buscar escenas Sentinel-2 → seleccionar escena → procesar reflectancia real → descargar GeoTIFF.

El acceso requiere sesión y un proyecto miembro con el UUID de la terminal. Para proyectos sin UUID catalogado, exige coincidencia única de código. Nunca utiliza el proyecto activo del dashboard como alternativa. Muestra inicio de sesión, errores recuperables o ausencia de membresía de forma explícita. El AOI inicial editable procede del centro de ese proyecto (4 km por lado del centro); no acredita tenencia. Los índices conservan la etiqueta de resultados modelados.

## Validación

- `npm run typecheck`: aprobado, código 0.
- ESLint de los cuatro archivos de implementación/pruebas afectados: aprobado, sin errores ni advertencias.
- Vitest del acceso de terminal y procesador Sentinel: 6 pruebas aprobadas. Incluyen sesión anónima, ausencia de membresía, aislamiento por UUID y flujo de selección/procesamiento.
- Chrome/Playwright local: navegación desde Tesis hasta Análisis satelital en Cholqui aprobada; muestra título del proyecto e inicio de sesión. En móvil de 390 px la pestaña Satelital es visible y el documento no tiene desbordamiento horizontal. Sin errores JavaScript de página.
- Capturas: `/tmp/geocapitals-terminal-satelital-desktop.png` y `/tmp/geocapitals-terminal-satelital-mobile.png`. Evidencia: `/tmp/geocapitals-terminal-satelital.json`.
- `git diff --check`: aprobado.

## Límites

El usuario informó que el SQL del almacenamiento privado se ejecutó correctamente. No se verificó una corrida autenticada ni los permisos reales del backend: la revisión visual fue con sesión anónima y las pruebas de membresía usan mocks. No se repitió el build completo para este ajuste de navegación. No se hizo push ni publicación; aplicar el SQL no actualiza el frontend publicado.
