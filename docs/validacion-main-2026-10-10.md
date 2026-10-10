# Validación local de main — 2026-10-10

- SHA validado: `9250d53f841880cba1d1f66391527b61e8bd6f0c` (`Reemplazó accesos al Catastro`).
- Rama: `main`; coincidía con la referencia local `origin/main`. No se hizo fetch para comprobar el remoto.
- Árbol de trabajo inicialmente limpio. Se leyó `AGENTS.md`.
- Entorno local: macOS, Node `v24.21.0`, npm `11.19.0`.
- CI: `.github/workflows/ci.yml`, Ubuntu, Node `22`; npm no está fijado explícitamente.

| Comando             | Resultado                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`            | OK, salida 0: 1108 paquetes instalados, 1109 auditados. El primer intento aislado falló con `ENOTFOUND`; el reintento con acceso autorizado a red/caché pasó. |
| `npm run typecheck` | OK, salida 0; generación de rutas y `tsc --noEmit`. Sin cambios en `src/routeTree.gen.ts`.                                                                    |
| `npm run lint`      | Inicialmente falló: 71 errores de Prettier y 18 advertencias. Tras las correcciones: OK, salida 0, 0 errores y 18 advertencias.                               |
| `npm run test`      | OK, salida 0: 126 archivos aprobados, 1 omitido; 671 tests aprobados, 4 omitidos.                                                                             |
| `npm run build`     | OK, salida 0: cliente, SSR y salida Nitro generados.                                                                                                          |

## Correcciones

Se aplicó exclusivamente formato Prettier a 11 archivos de código propio. Se comprobó que su contenido final coincide con el resultado de formatear las versiones del SHA registrado. Los PDF conservan su implementación institucional, fuentes y reglas de divulgación.

Las cuatro rutas MCP con banner `AUTO-GENERATED` se regeneran durante el build y vuelven al formato del plugin. Se desactivó solamente `prettier/prettier` para esas rutas en `eslint.config.js`; el resto de las reglas sigue activo. Se repitió lint y pasó después del build.

## Avisos y diferencias del entorno

- La ejecución valida Node 24/macOS; no se ejecutó la suite bajo Node 22/Ubuntu ni se afirma equivalencia con CI.
- npm 11 mostró avisos de scripts de instalación no cubiertos por `allowScripts` (esbuild, core-js, fsevents, sharp y workerd). No bloquearon los comandos ejecutados. La versión exacta de npm utilizada por CI no se conoce a partir del workflow.
- `npm ci` reportó 44 vulnerabilidades: 5 bajas, 11 moderadas, 23 altas y 5 críticas; además, dependencias obsoletas. No se modificó el lockfile ni se aplicó `npm audit fix`; esos avisos quedan pendientes de revisión de dependencias.
- Las 18 advertencias de lint corresponden a dependencias de hooks, exportaciones para Fast Refresh y variables sin uso.
- Los 4 tests omitidos son `src/services/rlsAccess.test.ts`, que requieren URL y clave pública/anon de Supabase. No se verificó acceso RLS contra un servicio real.
- El build mostró avisos de `inputValidator()` obsoleto, módulos Node externalizados para navegador, directivas `use client`, anotaciones de dependencias, partición de chunks y configuración de Wrangler. No impidieron generar la salida.

No se hizo commit, push, deploy ni publicación. Los cambios quedan locales para revisión.

## Revisión del diff y prueba de Cholqui

Se mantuvo el mismo SHA de base, Node y npm. Antes de las correcciones adicionales de PDF, se revisó el diff y se comprobó que los 11 archivos de código propio coincidían exactamente con la salida de Prettier aplicada a su versión en `HEAD`: no cambiaban datos, condiciones, dependencias de hooks, textos ni cálculos. Los cambios funcionales descritos más abajo se incorporaron después, como resultado de esta revisión.

### Alcance de ESLint

Los patrones iniciales no desactivaban reglas globales, pero podían alcanzar futuras rutas con nombres similares. Se sustituyeron por los cuatro nombres exactos, escapando los corchetes para ESLint:

- `src/routes/mcp.ts`
- `src/routes/[.mcp]/list-tools.ts`
- `src/routes/[.mcp]/invoke-tool/$tool.ts`
- `src/routes/[.well-known]/oauth-protected-resource.ts`

Se consultó la configuración efectiva con `ESLint.calculateConfigForFile()`: únicamente `prettier/prettier` tiene severidad 0 en esas cuatro rutas. `react-hooks/rules-of-hooks` y `@typescript-eslint/no-explicit-any` conservan severidad 2. Archivos de control como `src/routes/other/list-tools.ts`, `src/routes/other/invoke-tool/other.ts` y `CholquiTerrain3D.tsx` mantienen también Prettier con severidad 2. No se añadieron exclusiones globales.

### Aplicación y mapas

Se inició `npm run dev -- --host 127.0.0.1` en `http://127.0.0.1:8080/`. El primer intento encontró `EPERM` al abrir el puerto en el sandbox; el reintento autorizado arrancó correctamente. Las comprobaciones se realizaron con Chrome headless mediante Playwright, sin sesión de usuario, a 1440 × 1000 px. Playwright y PDF.js se instalaron exclusivamente en `/tmp`, sin modificar `package.json` ni el lockfile del proyecto.

| Comprobación          | Resultado observado                                                                                                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/live/cholqui`       | Redirige a `/terminal/cholqui?tab=mapa`.                                                                                                                                                                                                                                              |
| Navegación            | Tesis y ensayes, simulador y modelo, documentos y Data Room; regreso al mapa 2D. Las URL y contenidos cambian correctamente. Sin errores de consola ni respuestas HTTP ≥400 en el recorrido final de estas pestañas y descargas.                                                      |
| Mapa 2D               | Leaflet renderiza el mapa, bases satélite/topográfica, catastro y huellas. Se contaron 7 marcadores de collar y 7 trazas azimutales en el SVG.                                                                                                                                        |
| Geofísica regional 2D | El control de EMAG2 se pudo activar y desactivar; sin errores de consola en ese recorrido. No se validaron valores numéricos de la grilla regional.                                                                                                                                   |
| Mapa 3D / DEM         | Canvas WebGL visible con relieve real, catastro, huellas y evidencia. Fuente aceptada por el visor: Copernicus GLO-30; área 20 × 20 km, grilla visual 78,1 m, exageración 1×. Se inspeccionó la captura del terreno. No se verificó exactitud altimétrica contra topografía de campo. |
| Cámara                | Planta y perspectiva actualizan `aria-pressed`; reencuadrar responde sin error.                                                                                                                                                                                                       |
| MAG/IP de campo       | Se seleccionaron TMI menos mediana, cargabilidad y resistividad. El acceso devuelve 0 estaciones; campaña e IDW permanecen deshabilitados. No se añadieron datos simulados. La validación de superficies y valores reales queda bloqueada por falta de estaciones accesibles.         |

### Collares, tablas y descargas

Se contrastaron el archivo publicado, la tabla visible y el texto extraído de los informes detallados. El total es **7 collares y 1.070 m**, con inclinación **−60°** en todos los casos:

| Collar     | Azimut | Profundidad |
| ---------- | ------ | ----------- |
| CHO-DDH-01 | 285°   | 170 m       |
| CHO-DDH-02 | 285°   | 170 m       |
| CHO-DDH-03 | 285°   | 170 m       |
| CHO-DDH-04 | 285°   | 170 m       |
| CHO-DDH-05 | 105°   | 130 m       |
| CHO-DDH-06 | 285°   | 130 m       |
| CHO-DDH-07 | 285°   | 130 m       |

Se descargaron desde los menús de la aplicación y analizaron los siguientes documentos:

| Descarga                                    | Páginas | Resultado                                                                                                                       |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Targets, NI 43-101, v1.2                    | 12      | Tabla de siete collares, total, orientaciones y catálogo de 57 candidatos.                                                      |
| Minuta de terreno, NI 43-101, v1.1          | 11      | Actividades, permisos, fuentes y tabla de siete collares.                                                                       |
| Informe técnico, NI 43-101, v4.1            | 11      | Siete collares, informes de laboratorio y siete resultados analíticos.                                                          |
| Informe técnico, JORC 2012, v4.1            | 11      | Marco de revisión JORC; mismas filas de collares.                                                                               |
| Deck, v4.1                                  | 8       | Formato panorámico; resumen y gráficos, sin tabla exhaustiva de collares.                                                       |
| Resumen de una página, v4.1                 | 1       | Conserva una sola página; sin tabla exhaustiva de collares.                                                                     |
| «Informe geocientífico» desde 3D, NI 43-101 | 11      | Este botón usa actualmente `buildCholquiDoc()`: descarga el mismo informe técnico v4.1, sin snapshot MAG/IP de campaña adjunto. |

Se comprobaron las filas de collar y sus azimuts, inclinaciones y profundidades en los cinco informes detallados; los límites de página no contienen texto fuera de la hoja. Los índices tienen destinos internos válidos y sus números impresos coinciden con dichos destinos: 20 enlaces en cada informe de 11 páginas y 21 en targets. Los folios definitivos son únicos y consecutivos. Se inspeccionaron mosaicos de páginas y, en detalle, índice y anexos de tablas. Los siete PDFs incluyen las seis fuentes TTF de marca (`FontFile2`) y las familias `GCSerif`/`GCSans`.

Los marcos NI 43-101/JORC conservan las declaraciones de revisión pendiente y ausencia de certificación; la propuesta de sondajes sigue siendo conceptual. Las fuentes provienen de los metadatos existentes. La revisión de descarga no acredita recursos, reservas, tenencia ni conformidad normativa.

### Errores adicionales corregidos

1. El pie provisional `Página n de 0` seguía en el contenido del PDF bajo un rectángulo blanco y un segundo pie definitivo. El renderer ahora difiere el pie y llama una sola vez al helper institucional `folio()` después de fijar el índice y el total de páginas.
2. «Anexo A/B» se solapaba visualmente con «INFORME TÉCNICO». El helper institucional calcula la separación a partir del ancho real del rótulo.
3. El título del anexo de collares podía quedar al final de una página y su tabla comenzar en la siguiente. Se reserva espacio para título, metadatos, cabecera y primera fila. La medición de tablas y su renderizado utilizan la misma fuente de cuerpo para las filas.
4. El test del renderer expuso que el glob de fuentes con alias `@/` no se resolvía en Vitest. Se cambió por la ruta relativa a los mismos seis TTF; las descargas confirman que las fuentes siguen incrustadas.

Se añadieron tres tests de regresión del renderer: folios únicos tras eliminar la hoja de índice no utilizada, separación de anexos y permanencia del título de collares junto a su primera fila.

### Revalidación después de las correcciones

| Comando             | Resultado final                                                                     |
| ------------------- | ----------------------------------------------------------------------------------- |
| `npm run typecheck` | OK, salida 0.                                                                       |
| `npm run lint`      | OK, salida 0: 0 errores, 18 advertencias.                                           |
| `npm run test`      | OK, salida 0: 127 archivos aprobados y 1 omitido; 674 tests aprobados y 4 omitidos. |
| `npm run build`     | OK, salida 0; se conservan los avisos de dependencias y APIs descritos arriba.      |
| `git diff --check`  | OK. Sin cambios en `src/routeTree.gen.ts` ni en el lockfile.                        |

### Bloqueos y alcance

- Falta una campaña MAG/IP de campo accesible: no se pudieron contrastar estaciones, valores, escala de color ni superficies IDW con mediciones reales. El renderer exportado declara que el snapshot de campaña no está adjunto.
- El log del servidor registra `Missing Supabase server credentials` para `publicListings`: falta `SUPABASE_SERVICE_ROLE_KEY` en el entorno local. La información que depende de ese backend no queda validada por las descargas basadas en archivos publicados. No se inventaron credenciales ni se modificó el control de acceso.
- La revisión se realizó en el terminal público y sin una sesión autenticada; el workspace privado no se considera validado.
- Un recorrido inicial de automatización agotó el tiempo de captura de una página larga. Se repitieron navegación, controles y descargas de forma independiente; el fallo de captura no se contabilizó como éxito de una comprobación.
- Los datos económicos y geológicos mostrados se revisaron como contenido/renderizado, no como verificación de su exactitud científica o comercial. Node 22/Ubuntu sigue pendiente; las 44 vulnerabilidades de dependencias siguen pendientes de revisión.

Los hashes, tamaños, páginas y comprobaciones de los PDFs se registran en [validacion-cholqui-2026-10-10.evidencia.json](validacion-cholqui-2026-10-10.evidencia.json). Los originales descargados, capturas y logs de automatización están en `/tmp/geocapitals-browser-check`; son artefactos locales temporales.

No se hizo commit, push, deploy ni publicación. El servidor de desarrollo queda iniciado en localhost.

### Fase posterior: consolidación de visores y dashboard

La consolidación y su QA se documentan en [validacion-consolidacion-2026-10-10.md](validacion-consolidacion-2026-10-10.md), con evidencia JSON adjunta. El resultado final posterior es: typecheck y tsgo aprobados, lint sin errores y ocho advertencias, 677 tests aprobados y cuatro omitidos, build Bun aprobado sin avisos de memoria ni dependencias circulares. Se retiraron 70 archivos; la suma de chunks JS del cliente disminuyó un 15,39 %. Se conserva el detalle de los bloqueos de tenencia, backend, autenticación y Node 22 en ese informe. Sin commit, push ni publicación.
