
## Diagnóstico

Hoy existen dos "catastros" paralelos que confunden al usuario:

**A. Catastro público (principal, `/catastro/*`)** — la ruta con planes, marca y SEO:
- `/catastro` — landing con buscador nacional
- `/catastro/mapa` — mapa nacional en vivo desde SERNAGEOMIN (~103k polígonos, filtros tipo/situación, basemap sat/calles, export CSV/GeoJSON)
- `/catastro/precios`, `/catastro/global`, `/catastro/pais/$country`, `/catastro/c/$code`, `/catastro/app/watchlist`
- Envoltura: `PublicCatastroShell`

**B. Catastro del dashboard (`/dashboard/catastro`)** — vista *scoped al proyecto activo*:
- Tabs: Mis concesiones, Titulares, Patentes, Conflictos (overlaps), Vigilancia, Historial, Sync log
- Su propio `CatastroMap` (proyecto), sync con `sync-catastro`+`compute-overlaps`, alertas de vencimiento, AOI overlap, importador SERNAGEOMIN
- Datos: `mining_concessions` filtrado por `project_id`

Duplicación real: dos mapas distintos, dos experiencias de búsqueda, dos capas SERNAGEOMIN cargadas por caminos separados. Lo que NO se duplica: los tabs (holders/patents/watches/history/sync) son valor genuino del dashboard.

## Objetivo

Que **`/catastro/mapa` sea el único mapa nacional** de la plataforma, y que el dashboard se convierta en una **capa "vista proyecto"** montada encima de ese mismo mapa + los paneles operativos (patents/holders/watches/etc.). Cero pérdida de features; solo unificación de la superficie visual y del código de mapa.

## Plan por fases

### Fase 1 — Mapa único (elimina la duplicación real)

1. Promover `catastro.mapa.tsx` como el componente de mapa canónico. Extraer su cuerpo a `src/features/catastro-public/NationalCatastroMap.tsx` (props: `overlayConcessions?`, `aoi?`, `projectName?`, `onFeatureClick?`, `initialCenter?`, `showProjectStats?`).
2. Borrar `src/components/ops/CatastroMap.tsx` (mapa del dashboard) y sustituir sus usos por `NationalCatastroMap` con las props de overlay del proyecto. El mapa nacional queda igual para el público; con `overlayConcessions` pinta encima las concesiones del proyecto activo con estilo destacado (borde cobalto, fill semi-transparente) y hace fit al bbox del proyecto.
3. Mantener `CatastroOverlapPanel` y `AoiOverlapPanel` alimentándose de las features cargadas por `NationalCatastroMap` (mismo `onFeaturesLoaded`).

### Fase 2 — Reubicar el dashboard como sub-ruta del catastro principal

4. Mover la experiencia del dashboard a **`/catastro/proyecto`** (dentro del árbol público, pero con guard: requiere sesión + `active project`). Concretamente crear:
   - `src/routes/catastro.proyecto.tsx` — layout con `PublicCatastroShell` + banner "Vista proyecto: {code · name}" + selector de proyecto si el usuario tiene varios + los tabs actuales.
   - `src/routes/catastro.proyecto.index.tsx` = tab "concesiones" (mapa nacional con overlay del proyecto + stats + alertas + tabla).
   - Sub-rutas: `catastro.proyecto.titulares.tsx`, `.patentes.tsx`, `.conflictos.tsx`, `.vigilancia.tsx`, `.historial.tsx`, `.sync.tsx` — cada una renderiza el panel existente sin reescribir lógica.
5. Redireccionar `/dashboard/catastro` → `/catastro/proyecto` con `beforeLoad` + `redirect`, preservando `holders/$id` (mover a `catastro.proyecto.titulares.$id.tsx` con su misma vista). Sin romper links existentes.
6. En `PublicCatastroShell`, si hay sesión + proyecto activo mostrar en la nav un enlace extra "Mi proyecto" apuntando a `/catastro/proyecto`. Si no hay sesión el enlace no aparece.

### Fase 3 — Unificar búsqueda y watchlist

7. El input de búsqueda de `/catastro` y `/catastro/mapa` ya usa `searchConcessions` (server fn público). Añadir un toggle "Solo mi proyecto" cuando hay sesión + proyecto: filtra client-side contra `mining_concessions` del proyecto. Esto elimina la sensación de "dos buscadores".
8. Consolidar watchlist: `/catastro/app/watchlist` (público autenticado) queda como único watchlist; el tab "Vigilancia" del dashboard se re-implementa como vista del proyecto sobre la misma tabla (`concession_alert_settings` + `bulletin_watches`), sin crear duplicados.

### Fase 4 — Limpieza

9. Borrar código muerto tras la migración: `src/components/ops/CatastroMap.tsx`, imports huérfanos en `_authenticated.dashboard.catastro.tsx` (el archivo queda como stub que redirige).
10. Actualizar la navegación del dashboard (sidebar): la entrada "Catastro" apunta directamente a `/catastro/proyecto`, no a `/dashboard/catastro`.
11. Verificación: cargar `/catastro`, `/catastro/mapa`, `/catastro/proyecto` (con y sin proyecto activo), redirect desde `/dashboard/catastro`, y que el enlace de titular `catastro/proyecto/titulares/{id}` funcione.

## Notas técnicas

- **Sin cambios de BD ni RLS.** Todo es refactor de rutas + extracción de componente de mapa.
- **Auth**: `/catastro/proyecto/*` usa el patrón `beforeLoad` que verifica sesión y redirige a `/auth?intent=project` si falta. No se anida bajo `_authenticated/` para conservar la envoltura `PublicCatastroShell` (branding + nav públicos).
- **Rendimiento**: el mapa nacional ya trae tiling desde ArcGIS a partir de zoom ≥ 9; añadir un overlay de N ≤ 200 polígonos del proyecto es despreciable.
- **Riesgos**: rutas en producción del sidebar y links en PDFs que apunten a `/dashboard/catastro` — mitigado por el redirect permanente.

## Fuera de alcance

- Rediseño visual (ya está en Institutional Modernist).
- Cambios al mapa 3D `Geology3DViewer` o a `/live/*`.
- Cambios en el precio o planes.

## Aprobación

Si estás de acuerdo, implemento Fase 1 y Fase 2 en el primer sprint (mapa único + `/catastro/proyecto` con redirect) y Fases 3-4 en un segundo pase. ¿Procedo así o prefieres todo de una?
