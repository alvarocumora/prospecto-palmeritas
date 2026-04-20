

## Problema

En móvil (≤768px), las vistas **Mapa** (`/dashboard/map`) y **Catastro** (`/dashboard/catastro`) no cargan correctamente.

Causas probables identificadas tras revisar el código:

1. **`/dashboard/map`** usa `fixed inset-0 md:left-56 top-12 md:top-0 bottom-14 md:bottom-0` — el contenedor depende de un header móvil de 48px y bottom-nav de 56px. Si el layout `_authenticated.tsx` no renderiza esos elementos en móvil, el mapa queda con altura 0 o tapado. Además los paneles flotantes (`SectionBuilderTool`, `RasterControlPanel`, `SavedViewsPanel`, `RasterSwipePanel`, `LiveCollabLayer`, `TimeSlider`, `ProspectivityButton`, `GeoIntelBriefButton`, `CollapsibleAuLegend`) se apilan todos al mismo tiempo en una pantalla de 440px y bloquean el mapa.
2. El header de la vista mapa tiene **demasiados controles** (`MapCommandPalette`, `ViewModeToggle`, `CampaignSelector`, checkbox high-grade, contador, snapshot) que en 440px hacen wrap a 3-4 filas y empujan el mapa fuera de viewport.
3. **`/dashboard/catastro`** probablemente usa una tabla ancha sin scroll horizontal contenido y un dialog form que desborda en móvil.

## Solución

### 1. Vista Mapa móvil (`_authenticated.dashboard.map.tsx`)

- Reemplazar `fixed inset-0 md:left-56 …` por un layout que use `h-[100dvh]` (dynamic viewport, evita problemas con barra de URL en móvil) y respete el shell de `_authenticated.tsx`.
- **Header móvil compacto**: en `<md` mostrar solo título + un botón "⚙ Controles" que abra un `Sheet` (drawer) con CampaignSelector, ViewModeToggle, high-grade toggle, snapshot y command palette. En `≥md` mantener la barra actual.
- **Paneles flotantes en móvil**: ocultar por defecto `SectionBuilderTool`, `RasterControlPanel`, `SavedViewsPanel`, `RasterSwipePanel`, `TimeSlider`, `ProspectivityButton`, `GeoIntelBriefButton`, `CollapsibleAuLegend`. Añadir un FAB único "Herramientas" abajo-derecha que abra un `Sheet` con accesos. En desktop sin cambios.
- Asegurar `ProjectMap` con `fillHeight` use `height: 100%` real (revisar contenedor padre).

### 2. Vista Catastro móvil (`_authenticated.dashboard.catastro.tsx`)

- Envolver tabla en `<div class="overflow-x-auto -mx-3 px-3">` para scroll horizontal limpio.
- En `<md` reemplazar la tabla por **cards** (una por concesión: nombre, tipo, estado expiración, titular, acciones).
- Stats en grid `grid-cols-2 md:grid-cols-5`.
- Filtros y búsqueda colapsables en móvil tras un botón "Filtros".
- Dialog `ConcessionDialog` con `max-h-[90dvh] overflow-y-auto` y campos `grid-cols-1 md:grid-cols-2`.

### 3. Verificación shell autenticado

Revisar `_authenticated.tsx` para confirmar que en móvil hay `top-bar` (h-12) y `bottom-nav` (h-14) reales — si no existen, ajustar offsets de la vista mapa a `top-0 bottom-0`.

## Archivos a editar

- `src/routes/_authenticated.dashboard.map.tsx` — layout responsive + sheet móvil
- `src/routes/_authenticated.dashboard.catastro.tsx` — cards móvil + dialog responsive
- `src/routes/_authenticated.tsx` — verificar (solo si offsets no coinciden)

## Resultado esperado

En 440×688px:
- **Mapa**: header de 1 fila + mapa a pantalla completa + 1 FAB de herramientas + leyenda Au colapsable.
- **Catastro**: stats 2-col, lista de cards scrolleable, dialog que cabe en pantalla.

