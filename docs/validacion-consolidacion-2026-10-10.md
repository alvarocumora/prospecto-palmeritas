# Validación de consolidación GeoCapitals — 10 de octubre de 2026

Consolidación implementada y comprobaciones técnicas aprobadas. La validación funcional de tenencia y de las pantallas privadas queda parcialmente bloqueada por acceso a datos y autenticación; no se considera acreditada la titularidad legal de ninguna concesión.

## Base y entorno

- Rama `main`, SHA `9250d53f841880cba1d1f66391527b61e8bd6f0c`. Cambios locales sin commit, push ni publicación.
- Leído `AGENTS.md`; se conserva el renderer institucional de PDF, sus fuentes incrustadas y sus declaraciones de alcance técnico.
- Mac: Node **24.21.0**, npm **11.19.0**. CI: Node **22**, Ubuntu. No se ejecutó Node 22 localmente; el éxito local no acredita equivalencia con CI.
- Bun **1.4.3**, TypeScript **5.9.3**, Vite **7.3.2**, tsgo **7.0.0-dev.20260707.2**. Bun y tsgo se instalaron temporalmente fuera del proyecto; no se cambió `package.json` ni el lockfile npm.

## Resultados

| Comprobación            | Resultado                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `npm ci` — fase inicial | Salida 0; 1.108 paquetes instalados. Auditoría: 44 vulnerabilidades, pendientes de revisión.                                   |
| `npm run typecheck`     | Salida 0, sin errores.                                                                                                         |
| `tsgo --noEmit`         | Salida 0, sin errores.                                                                                                         |
| `npm run lint`          | Salida 0: cero errores, ocho advertencias existentes.                                                                          |
| `npm run test`          | Salida 0: 677 tests aprobados, cuatro omitidos; 129 archivos aprobados y uno omitido. Los omitidos requieren credenciales RLS. |
| `bun run build`         | Salida 0; compilación cliente, SSR y Nitro aprobada. Sin avisos de memoria ni dependencias circulares.                         |
| `git diff --check`      | Aprobado.                                                                                                                      |

El build conserva avisos de dependencias/APIs: deprecación de `inputValidator`, directivas `use client` ignoradas, externalización Node de geotiff y anotaciones de terceros. No se presenta como una compilación sin ningún warning. Los ocho avisos ESLint corresponden a Fast Refresh, variables sin uso y una dependencia de memo en código histórico; ninguno es un error.

## Cambios revisados

Los visores de proyectos comparten `ProjectMasterViewer` y `ProjectTerrain3D`. Cholqui conserva DEM real, trazas propuestas, recorte de polígonos, cámaras, filtros geofísicos y descargas mediante un adaptador de configuración. Los Verdes y Palmeras usan el mismo renderer. El mapa satelital y la captura del informe NI 43-101 también delegan en el visor compartido. Se mantienen las visualizaciones analíticas de bloques y gráficos científicos; no son visores duplicados del terreno de proyectos.

El workspace selecciona adaptadores publicados únicamente por UUID y perfil coincidentes. Los proyectos privados utilizan sus consultas RLS y nunca reciben datos de otro proyecto como sustitución. El catastro mantiene su entrada canónica `/catastro/mapa`. Las rutas antiguas de mapa, satélite y geología redirigen al terminal del proyecto publicado o al catastro, conservando el UUID solicitado y el modo 2D/3D cuando corresponde. No se incorporó `react-router-dom`.

La resolución de tenencia utiliza ID de proyecto, rol/código exacto normalizado, RUT o declaración explícita existente. Se etiqueta como **declarada**, sin certificar dominio. Los Verdes intenta recuperar geometría por rol exacto del catastro, rechaza coincidencias ambiguas y mantiene geometrías ausentes como ausentes. Palmeras comparte la asociación de cartera entre 2D y 3D; no marca sus once polígonos como propios sin evidencia. Oro y gris están centralizados en tokens geoespaciales; los componentes modificados usan estilos semánticos. No se escribieron datos en el backend.

La procedencia por entidad prevalece sobre la etiqueta general de una capa: conceptual/sintético nunca pasa a medido; resultados no aprobados permanecen declarados. Los tests incluyen estos contraejemplos y la protección contra sustitución de proyectos.

Trading, deals y colateral heredan el shell autenticado y `WorkspaceTabs`, con superficies claras, encabezados Newsreader, cifras mono y controles compactos. La revisión de código confirma la integración; la revisión visual privada y las operaciones CRUD no pudieron completarse sin sesión.

Se migró el consumidor activo del antiguo `LosVerdesEngine3D` antes de retirarlo. La auditoría de importaciones, reexportaciones, importaciones dinámicas y workers permitió eliminar **70 archivos y 13.444 líneas** de motores y utilidades huérfanas. Se conservaron parsers geoespaciales, `crs.ts`, `commodityColors.ts` y la infraestructura DEM activa. El grafo final no conecta las escenas históricas restantes con rutas de producción; algunas referencias de QA siguen en el repositorio.

| Suma de todos los chunks JS del cliente |      Antes |   Después |           Reducción |
| --------------------------------------- | ---------: | --------: | ------------------: |
| Bytes sin comprimir                     | 10.667.938 | 9.025.962 | 1.641.976 — 15,39 % |
| Bytes gzip                              |  3.191.855 | 2.686.511 |   505.344 — 15,83 % |

La base es el build anterior de este mismo árbol de trabajo, incluyendo las correcciones PDF previas. Esta suma no representa el payload inicial de una ruta ni una medición de rendimiento del navegador.

Los cambios exclusivamente de formato de la fase inicial no alteran comportamiento; las correcciones funcionales PDF y de esta consolidación se registran por separado. El override ESLint sigue limitado a las **cuatro rutas MCP generadas**: `mcp.ts`, `[.mcp]/list-tools.ts`, `[.mcp]/invoke-tool/$tool.ts` y `[.well-known]/oauth-protected-resource.ts`. Solo omite `prettier/prettier` en esos archivos; no desactiva reglas globales.

## QA de Cholqui y documentos

Aplicación iniciada en `http://127.0.0.1:8081`; 8080 ya estaba ocupado. Se comprobó navegación por mapa, tesis, simulador, documentos y regreso; mapa 2D con cambio de base; terreno 3D con planta, perspectiva y reencuadre. No se registraron errores de navegador en los recorridos.

Se verificaron **siete collares**, tanto en la tabla como en los símbolos 2D: cuatro de 170 m y tres de 130 m, total **1.070 m**. CHO-DDH-05 tiene azimut **105°**, los otros seis **285°**; todos tienen inclinación **−60°**. Son sondajes propuestos conceptuales, no perforaciones medidas. El terreno utiliza Copernicus GLO-30 en una ventana de 20 × 20 km y una malla de representación 257 × 257, aproximadamente 78,1 m entre nodos.

Se revisaron MAG residual, cargabilidad IP y resistividad IP: no hay estaciones de campaña accesibles. Los controles de campaña y superficie IDW permanecen deshabilitados; no se verificaron mediciones ni interpolaciones reales.

Se descargaron y analizaron siete PDFs: informe geocientífico (11 páginas), minuta (11), targets (12), deck (8), informe JORC (11), informe NI (11) y onepager (1). No se detectó texto fuera de márgenes; los enlaces de índice coinciden con su página destino. Los informes usan folios institucionales; el deck conserva portada sin número y folios propios del 2 al 8. Se comprobaron fuentes Newsreader e IBM Plex Sans incrustadas en los siete documentos. La selección NI/JORC expresa estructura de revisión y no cumplimiento certificado.

Las redirecciones se probaron en navegador, incluyendo UUID de Cholqui, UUID desconocido y acceso sin sesión. Palmeras carga el mapa y muestra tenencia no resuelta. Los Verdes comunica el fallo de consulta; no se da por validado su mapa live.

## Bloqueos y límites

- **Los Verdes:** consulta backend fallida. Las cifras de 88 concesiones y diez geometrías proceden del prompt; no fueron recontadas en una consulta live. La recuperación de las geometrías restantes requiere acceso a registros oficiales y no está acreditada por esta ejecución.
- **Palmeras:** se necesita cartera oficial accesible para confirmar asociaciones. Además, el encabezado público indica Illapel/Coquimbo y los datos cartográficos locales apuntan a Melipilla. Se registra la discrepancia sin escoger arbitrariamente una ubicación ni modificar evidencia.
- **Dashboard privado:** trades, deals y colateral redirigen a autenticación; no hay validación visual completa ni CRUD autenticado.
- **MAG/IP:** sin campaña de campo accesible, no se puede contrastar valores, estaciones o superficies con mediciones.
- **CI:** Node 22/Ubuntu pendiente de ejecución. Auditoría de dependencias pendiente; no se aplicaron upgrades indiscriminados.

La evidencia persistente está en [validacion-consolidacion-2026-10-10.evidencia.json](validacion-consolidacion-2026-10-10.evidencia.json). Capturas, PDFs originales, grafo y logs completos permanecen en `/tmp/geocapitals-consolidation-browser` y `/tmp/geocapitals-consolidation-*-final-verified.log`; son artefactos temporales locales.

No se hizo commit, push, deploy ni publicación. Las correcciones previas y el `deno.lock` preexistente se conservaron.
