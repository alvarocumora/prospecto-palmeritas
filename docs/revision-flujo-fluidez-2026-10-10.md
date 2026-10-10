# Revisión de flujo y fluidez — GeoCapitals

Revisión sobre el árbol local de `main`, SHA base `9250d53f841880cba1d1f66391527b61e8bd6f0c`, conservando la consolidación y las correcciones anteriores. Sin commit, push ni publicación.

## Alcance de repositorios

Se revisó GeoCapitals y, como referencia local, `../codeflow-ai-hub` (HEAD `0982f64`): scripts, dependencias y composición de rutas con carga diferida. La referencia usa React 18, Vite 5 y react-router-dom; GeoCapitals usa React 19, Vite 7 y TanStack. No se trasladaron dependencias, rutas ni código de ese repositorio. Esta revisión no incluye otros repositorios remotos ni acredita la calidad completa de Codeflow.

## Mejoras aplicadas

| Fricción observada                                             | Cambio                                                             | Efecto esperado                                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Captura PDF importada estáticamente desde el menú              | Importación de captura y generación dentro de la descarga          | Evita exigir ese módulo por el simple montaje del menú; otros consumidores pueden cargarlo independientemente. |
| Adaptadores documentales y simulador importados desde la shell | Adaptadores asíncronos y simulador con `lazy`                      | Carga al solicitar documentos o entrar al simulador.                                                           |
| Errores del constructor documental fuera del `try`             | Construcción dentro del manejo de errores, incluyendo promesas     | Mensaje de fallo y liberación del botón para reintentar.                                                       |
| Posibles exportaciones solapadas                               | Bloqueo síncrono por referencia durante el trabajo                 | Una exportación por instancia del menú; no duplica trabajo por clics rápidos.                                  |
| Render continuo del terreno estático                           | Canvas con `frameloop="demand"` e invalidación explícita de cámara | Redibujo al interactuar o cambiar escena; evita el bucle continuo en reposo.                                   |
| Carga del visor que sustituye controles y contenido            | Boundaries independientes de visor y paneles secundarios           | Selector 2D/3D visible mientras resuelve el módulo del visor.                                                  |
| Estado de espera y selección poco accesible                    | `role="status"`, anuncio de carga y `aria-pressed`                 | Estado legible para tecnologías de asistencia; etiqueta de generación visible.                                 |
| Documentos de Los Verdes habilitados sin modelo disponible     | Menú deshabilitado hasta disponer del reporte                      | Evita ofrecer una descarga sin antecedentes cargados.                                                          |

Se mantienen los datos, el gate de procedencia y la generación PDF institucional. No se modifica autenticación ni RLS. No se añadieron dependencias. No se afirma una mejora porcentual de velocidad, FPS o batería: se verifican cambios de carga y render, no un benchmark de hardware.

## Validación

- Typecheck completo: salida 0.
- Lint completo: salida 0; cero errores y siete advertencias existentes.
- Regresiones seleccionadas: seis archivos, **16 tests aprobados**. Incluyen dos pruebas nuevas de fallos asíncronos y exclusión de exportaciones simultáneas, más aislamiento de proyectos, procedencia, tenencia, registro de visores y renderer PDF.
- Recorrido del terreno de Cholqui: controles planta/perspectiva/reencuadre, estados MAG/IP y descarga PDF comprobados; un canvas y cero errores de navegador.
- Build completo (`npm run build`): salida 0, cliente/SSR/Nitro aprobados. Sin avisos de memoria o dependencias circulares; se conservan los avisos de dependencias/APIs ya documentados.

- Recorrido completo de Cholqui: tesis → simulador → documentos → mapa, con selección y URL correctas; se conserva la misma instancia 2D al volver entre pestañas. Cámara 3D redibujada al cambiar a planta; selector anuncia su estado. Onepager descargado sin fallo. A 390 px, la página de documentos no tiene desbordamiento horizontal. Cero errores de navegador. El primer intento automatizado falló por un selector de nombre accesible; la repetición corregida pasó. No se contabilizó ese intento como éxito.

Evidencia persistente: [revision-flujo-fluidez-2026-10-10.evidencia.json](revision-flujo-fluidez-2026-10-10.evidencia.json).

Logs locales: `/tmp/geocapitals-flow-{typecheck,lint,regression,build}.log`. El informe de [consolidación](validacion-consolidacion-2026-10-10.md) conserva los resultados anteriores de toda la suite y los bloqueos de datos.

## Prioridades siguientes

| Prioridad | Fricción                                                         | Trabajo necesario y criterio de cierre                                                                                                                                                                                     |
| --------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Tenencia y ubicación de Palmeras; consulta de Los Verdes fallida | Contrastar cartera RLS y fuente oficial, resolver discrepancia Illapel/Melipilla y contar geometrías disponibles. No fabricar polígonos ni dominio.                                                                        |
| 1         | Recorrido privado sin comprobar                                  | Sesión de pruebas autorizada para proyecto → trading → deal → colateral → reporting. Verificar retorno, filtros, vacíos, fallos y CRUD con datos de prueba.                                                                |
| 2         | Pérdida potencial de ajustes al cambiar entre 2D y 3D            | Definir qué capas, selección y cámara comparten estado por proyecto; validar ida y vuelta sin mezclar proyectos. La revisión actual conserva el mapa al cambiar de pestaña, no promete conservarlo al sustituir 2D por 3D. |
| 2         | Falta de métricas comparables del recorrido                      | Medir build de producción en navegador: carga inicial, interacción, transferencias por ruta y recuperación ante red lenta. Separar resultados con caché fría y caliente.                                                   |
| 2         | Recuperación y orientación entre módulos                         | Revisar retorno después de autenticación y errores backend; preservar proyecto y destino solicitado en cada recorrido real.                                                                                                |
| 3         | Deuda técnica existente                                          | Ejecutar Node 22/Ubuntu, revisar vulnerabilidades por impacto y resolver avisos restantes sin upgrades indiscriminados.                                                                                                    |

Estas prioridades derivan de fricciones observadas y del acceso disponible; no se declara validada la plataforma privada ni la exactitud geocientífica o comercial de sus datos.
