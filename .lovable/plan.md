

# Plan: Rediseño disruptivo "Command Platform" estilo Palantir

Transformar Geocapitals desde un dashboard SaaS estándar (oro cálido sobre negro) a una **plataforma de control operacional** densa, técnica y cinematográfica — referencia: Palantir Foundry / Gotham, Anduril Lattice, Bloomberg Terminal.

## Filosofía de diseño

| Antes (estándar) | Después (Command Platform) |
|---|---|
| Dorado cálido decorativo | Cyan/ámbar técnico funcional (estado, no marca) |
| Cards redondeadas con padding generoso | Paneles densos, bordes 1px, esquinas casi rectas |
| Tipografía amigable (DM Sans) | Mono-first (JetBrains Mono) + Inter para prosa |
| Hero marketing | "System status board" con métricas live |
| Iconos decorativos | Iconos = controles funcionales con tooltips |
| Espaciado relajado | Information density alta, jerarquía por color/peso |

## 1. Sistema de diseño nuevo (`src/styles.css`)

**Paleta "Operations":**
```text
--bg-void:       #06080A   /* casi negro azulado, no warm */
--bg-panel:      #0C1014   /* paneles primarios */
--bg-elevated:   #131820   /* hover/active */
--bg-grid:       #0A0E13   /* fondo con grid sutil */
--border-line:   #1F2832   /* divisores 1px */
--border-hot:    #2A3744   /* bordes hover */
--text-primary:  #E4E9F0
--text-mono:     #A8B5C4
--text-dim:      #5A6878

/* Estados (no marca) */
--signal-cyan:   #4DD0E1   /* primario: data, links, foco */
--signal-amber:  #FFB300   /* warning, pendiente */
--signal-red:    #FF5252   /* crítico, alerta */
--signal-green:  #66BB6A   /* ok, aprobado */
--signal-violet: #B388FF   /* IA, predicciones */
--accent-gold:   reservado solo para logo Geocapitals
```

**Tipografía:**
- `JetBrains Mono` — todos los datos, labels, IDs, números, navegación
- `Inter` — prosa larga, headers de marketing
- Eliminar `DM Sans` y reducir uso de `IBM Plex Mono`

**Tokens:** `--radius` baja a `2px` (casi rectangular). Sombras reemplazadas por `inset 0 1px 0 var(--border-hot)` (efecto bisel sutil).

## 2. App Shell — "Operations Console" (`_authenticated.tsx`)

Reemplazar sidebar tradicional por **Command Rail tri-zona** estilo Palantir:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ [▣ GEOCAPITALS]  PROJECT-ID:PLM-001 ▾  │ Centro Op. › Mapa  │ ⚡ ⌘K │  ← Top bar 36px
├──┬───────────────────────────────────────────────────────────────────┤
│▣ │                                                                    │
│◈ │                                                                    │
│⊕ │                  WORKSPACE (Outlet)                                │
│▤ │                                                                    │
│⚙ │                                                                    │
├──┴───────────────────────────────────────────────────────────────────┤
│ ● LIVE  PLM-001  3 alerts  142 samples  CPU 12%  ⌘K              0.2s │  ← Status bar 24px
└──────────────────────────────────────────────────────────────────────┘
```

- **Rail izquierdo 48px**: solo iconos con tooltip flotante. Hover expande a 220px (overlay, no push). Categorías colapsables: Operations, Cadastre, Field, Analysis, Governance.
- **Top bar 36px**: logo + project switcher (selector tipo terminal con código/RUT) + breadcrumb activo + ⌘K command palette + indicador online.
- **Status bar inferior 24px**: tipo IDE — proyecto activo, alertas en vivo (ticker), conteo de records, latencia, atajos. Reemplaza el footer.
- **Mobile**: rail se vuelve drawer offcanvas; status bar se mantiene.

## 3. Dashboard "Mission Control" (`_authenticated.dashboard.index.tsx`)

Reemplazar grid de KPIs sueltos por un **briefing operacional**:

```text
┌─ SITUATION REPORT ────────────────────┬─ ACTIVITY FEED ──────────┐
│ Project: PALMERAS-001                 │ 14:32 ● Sample BX-091    │
│ Status: ● ACTIVE   Phase: DRILLING    │       approved by JDG    │
│ Last update: 4m ago by María L.       │ 14:18 ⚠ Concession 2891  │
│                                       │       expires in 12 days │
│ ┌──────┬──────┬──────┬──────┐        │ 13:55 ◈ DDH-042 finished │
│ │ 12   │ 4128 │ 2.3  │ 142  │        │       at 318.4m          │
│ │ holes│ m    │ g/t  │ smpl │        │ ...                      │
│ └──────┴──────┴──────┴──────┘        │                          │
├─ CRITICAL SIGNALS ────────────────────┼─ RUN PRIORITIES ─────────┤
│ ⚠ 3 concessions expire <30d           │ □ Approve 7 core logs    │
│ ⚠ QA/QC fail rate 12% (>threshold)    │ □ Review 2 catastro alrt │
│ ● 7 records pending approval          │ □ Sync PJUD (last 4d)    │
└───────────────────────────────────────┴──────────────────────────┘
┌─ PRODUCTION SPARKLINES (last 30d) ────────────────────────────────┐
│ Meters drilled  ▁▂▃▅▇▆▅▇█▇▆▅▆▇█  +18%                           │
│ Samples logged  ▂▃▃▄▅▄▅▆▇▇▆▅▆▇▇  +9%                            │
│ Au best inter.  ▁▁▂▁▃▂▄▃▅▇▆▅█▇▆  2.3 g/t / 12.4m                │
└────────────────────────────────────────────────────────────────────┘
```

- Sparklines inline (sin librería: SVG path o caracteres unicode block).
- Activity feed con timestamps relativos, refresh realtime via Supabase channel.
- "Critical signals" prioriza por severidad y tiene CTA inline.
- Sin imágenes, sin gradientes — pura información.

## 4. Centro de Operaciones (Mapa) — full bleed cinematográfico

- Mapa **edge-to-edge** sin header visible. Header colapsa a una **HUD flotante translúcida** arriba-izquierda con backdrop-blur fuerte.
- Paneles laterales tipo Foundry: **rail derecho colapsable 320px** que aloja Capas/Inspector/Tiempo/Snapshot como tabs verticales (no FABs sueltos).
- Coordenadas, zoom y CRS en el **status bar global** (no en footer del mapa).
- Crosshair central opcional + reticle con ticks de escala.
- Mobile: HUD bottom-sheet con handle, map ocupa todo el viewport menos los 24px del status bar.

## 5. Listas → "Data Tables" densas

Catastro, Sondajes, Muestreo, Aprobaciones, Auditoría:
- Tablas mono `text-[11px]`, row height 28px, separadores 1px, **zebra sutil** opcional, **hover row con border-left cyan 2px**.
- Toolbar superior: filtros inline tipo chips, búsqueda con `⌘F`, export rápido.
- Estados con dot + color, no badges grandes. Ej: `● ACTIVE`, `◐ PENDING`, `✕ ARCHIVED`.
- Mobile: ya tenemos cards — refinarlas al mismo lenguaje (mono, border-left de estado, sin sombras).

## 6. Landing pública (`index.tsx`)

Reemplazar hero marketing por **"Live Operations Demo"**:
- Background animado: grid + lat/lon ticks + concesiones SVG animadas.
- Headline mono: `GEOCAPITALS // EXPLORATION OPERATIONS PLATFORM`
- Sub: "The control surface for modern mineral exploration."
- Reemplazar imágenes hero por **screenshots reales** del dashboard (mockup en frame de monitor).
- Sección "Trusted data feeds" con logos/labels técnicos: SERNAGEOMIN · BOLETÍN MINERO · PJUD · MACROSTRAT · EMAG2 (todos como text-mono con dot verde "● LIVE").
- CTA: `[ INITIATE SESSION → ]` en lugar de "Empezar gratis".
- Eliminar gradientes dorados decorativos; usar líneas y cyan funcional.

## 7. Componentes nuevos compartidos (`src/components/ops/`)

- `<StatusDot status="live|warn|crit|ok" />`
- `<MetricCell label value delta sparkline? />` — celda densa de KPI
- `<DataTable />` wrapper con estilo ops uniforme
- `<HudPanel title collapsible>` — panel translúcido para mapa
- `<ActivityTicker projectId />` — feed realtime
- `<Sparkline data />` — SVG inline, sin deps
- `<CommandRail items />` — sidebar nuevo
- `<StatusBar />` — barra inferior global

## 8. Producción — checklist

- **Performance**: lazy-load Map3DView, RasterControl, PDF libs; preload fuentes; reducir bundle Leaflet.
- **SEO**: head() único por ruta pública; OG images por sección.
- **Accesibilidad**: contraste AAA en cyan/ámbar sobre void; focus rings cyan visibles; `prefers-reduced-motion` desactiva ticker.
- **Errores**: errorComponent + notFoundComponent en cada ruta con loader (ya parcial).
- **Loading states**: skeletons mono (líneas `▒▒▒` parpadeantes) en lugar de spinners genéricos.
- **Manifest PWA + favicon** actualizado al lenguaje técnico.
- **Console limpia**: eliminar warnings, console.logs.
- **Empty states**: ilustraciones ASCII tipo terminal (`[ NO DATA · INITIATE SYNC ]`).

## Archivos a crear/editar (orden de ejecución)

**Fase A — Sistema base** (1 sesión)
1. `src/styles.css` — nueva paleta + tipografía + utilidades ops
2. `src/components/ops/StatusDot.tsx`, `MetricCell.tsx`, `Sparkline.tsx`, `HudPanel.tsx`, `StatusBar.tsx`, `CommandRail.tsx`, `ActivityTicker.tsx`
3. Cargar JetBrains Mono + Inter en `__root.tsx`

**Fase B — Shell** (1 sesión)
4. `src/routes/_authenticated.tsx` — nuevo CommandRail + TopBar + StatusBar
5. Mobile drawer rail

**Fase C — Superficies clave** (2 sesiones)
6. `_authenticated.dashboard.index.tsx` — Mission Control
7. `_authenticated.dashboard.map.tsx` — HUD + rail derecho
8. Tablas: catastro, drilling, sampling, approvals, boletin

**Fase D — Landing + producción** (1 sesión)
9. `routes/index.tsx` — landing técnica
10. Auditoría performance, accesibilidad, SEO, empty/error states

## Resultado esperado

Una plataforma que **se sienta como un sistema operativo de exploración**, no como otra app SaaS — densa, mono, con datos vivos en cada borde, gestos rápidos por teclado, y estética de sala de control que comunica seriedad técnica desde el primer pixel.

