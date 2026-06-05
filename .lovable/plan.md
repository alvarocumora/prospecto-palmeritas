
# Geocapitals Terminal — Plan de implementación

Reemplazar la home `/` por una terminal de inversión minera de alta densidad, estilo Bloomberg, usando los tokens semánticos actuales (`bg-background`, `gold`, `muted`, etc.) y datos reales del backend. Fase 1 entrega el shell + Mapa Geológico + Portfolio; Market/Tokenize/Capital Raise quedan como rutas con scaffolding listo para iterar.

## Alcance Fase 1

1. **Shell de terminal** en `/` con:
   - Sidebar lateral colapsable (Market, Portfolio, Tokenize, Capital Raise, Settings) usando shadcn `Sidebar`.
   - Header de métricas (ticker tape): precio cobre/oro/litio desde `commodity_prices`, nº proyectos activos, nº concesiones monitoreadas, estado de salud de fuentes externas (reusa `useExternalSourcesHealth`).
   - Layout grid denso, modo oscuro, respetando tokens (`gold` como acento principal; verde/rojo solo para deltas usando los tokens existentes si están, si no se añade `--color-positive`/`--color-negative` en `styles.css`).
   - CTA "Iniciar sesión" persistente para anónimos; los datos sensibles se ocultan tras auth.

2. **Geological Map View (módulo principal)**
   - Mapa Leaflet reutilizando el patrón de `catastro.mapa.tsx` (ArcGIS v2 FeatureServer) centrado en Chile.
   - Capa de **proyectos** desde `projects` (lat/lng) con marcadores tipo HUD; tooltip con commodity, etapa, NPV si existe.
   - Capa de **concesiones del portafolio** del usuario autenticado.
   - Panel lateral derecho con lista sincronizada al mapa (hover-to-highlight).

3. **Portfolio**
   - Tabla shadcn densa con proyectos accesibles al usuario (vía `projects` + `project_members`).
   - Columnas: proyecto, commodity, etapa, hectáreas concesionadas, alertas abiertas (`concession_alerts`), valor estimado.
   - Click en fila → drawer lateral con resumen técnico (reusa hooks existentes: `useProjects`, `useProjectMiningConcessions`, `useConcessionAlerts`, `useExecutiveKpis`).

4. **Rutas placeholder** (shells navegables, sin lógica todavía):
   - `/terminal/market`, `/terminal/tokenize`, `/terminal/capital-raise`.
   - Cada una con `head()` propio y un "Coming next" usando el mismo grid.

## Datos (server functions nuevas)

Todas como `createServerFn` en `src/lib/terminal.functions.ts`:

- `getTerminalTicker` — últimos precios por commodity desde `commodity_prices` + delta 24h.
- `getTerminalPortfolio` (con `requireSupabaseAuth`) — proyectos del usuario + KPIs agregados + nº alertas abiertas.
- `getTerminalMapLayers` (con `requireSupabaseAuth`) — geojson liviano de proyectos y concesiones del portafolio.

Reglas: importar `client.server` solo dentro de `.handler()` cuando se necesite admin; el resto vía middleware autenticado (RLS aplica).

## Estructura de archivos

```
src/
  routes/
    index.tsx                          (REESCRITO → TerminalShell)
    terminal.market.tsx                (placeholder)
    terminal.tokenize.tsx              (placeholder)
    terminal.capital-raise.tsx         (placeholder)
  features/terminal/
    TerminalShell.tsx                  (sidebar + header + outlet de panel)
    TerminalSidebar.tsx
    TickerTape.tsx                     (header de métricas)
    panels/
      GeologicalMapPanel.tsx           (mapa + lista sincronizada)
      PortfolioPanel.tsx               (tabla densa + drawer detalle)
      ProjectDetailDrawer.tsx
  lib/
    terminal.functions.ts              (server fns)
```

La landing actual (`hero + features + CTA`) se mueve a `src/routes/about.tsx` para no perder el contenido marketing y mantener SEO.

## Detalles técnicos

- **Auth**: el shell se renderiza para anónimos pero los paneles Portfolio/Mapa muestran un estado "Inicia sesión para ver tus activos" si no hay sesión; no requiere `_authenticated/` porque queremos que la home siga siendo pública e indexable.
- **SEO**: `head()` con título y descripción de terminal; `og:image` solo aquí (no en `__root.tsx`).
- **Estilo**: sin colores hardcoded en componentes; se reutiliza la paleta actual (`gold`, `muted`, `border`, `background`). Si hace falta verde/rojo de delta, se añaden tokens en `src/styles.css` en `oklch`.
- **Densidad**: tipografía `font-mono` para números (ya existe en la landing actual), `text-[10px]`/`text-xs` en headers, separadores 1px, padding compacto (`p-2`/`p-3`).
- **Runtime error actual** (`virtual:tanstack-start-client-entry`): se valida que tras la reescritura el dev server arranque limpio.

## Fuera de alcance (siguiente iteración)

- Realtime ticks vía Supabase Realtime.
- Tokenización on-chain real / smart contracts.
- Order book de Market.
- Charts financieros con recharts (se dejan stubs).

## Entregable

Al terminar Fase 1, en `/` el usuario ve la Terminal con el Mapa Geológico y, si está autenticado, su Portfolio real. El resto de tabs navega a placeholders coherentes, listos para iterar.
