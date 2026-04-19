
User reports overlapping controls on /dashboard/map. Viewport 815px (tablet-ish). Let me map what's stacked where.

**Top-left (Leaflet default):** zoom +/- control (`leaflet-top leaflet-left`)
**Top-right (Leaflet default):** layer control + custom toolbar buttons in ProjectMap (fullscreen, draw, layers, measure) + SectionBuilderTool at `top-14 right-3`
**Bottom-left:** Au legend at `bottom-3 left-3` + Leaflet attribution
**Bottom-right:** CoordinateFooter + scale
**Right side:** FeatureInspectorPanel (aside, when open) overlaps everything on right

Conflicts at 815px:
1. SectionBuilderTool (top-14 right-3) collides with ProjectMap's own top-right toolbar
2. FeatureInspectorPanel covers right-side controls when open
3. Au legend bottom-left near attribution
4. Zoom top-left is fine but no breathing room from header
5. Multiple z-index layers (1000, 1100) competing

Plan focuses on reorganizing into clear zones with consistent spacing and z-index hierarchy. No new features — pure layout cleanup.

## Plan: Reorganizar controles del Centro de Operaciones

### Problema
A 815px de ancho los controles se traslapan: la barra de "Sección" choca con el toolbar de ProjectMap (fullscreen/draw/capas/medir), el panel de inspección tapa controles del lado derecho, y la leyenda de Au compite con la atribución de Leaflet.

### Solución: zonas fijas + jerarquía clara

```text
┌────────────────────────────────────────────────┐
│ HEADER (proyecto, campaña, filtros)            │
├──┬──────────────────────────────────────────┬──┤
│+ │                                          │TR│ ← Toolbar vertical:
│− │                                          │TR│   fullscreen, draw,
│  │             MAPA                         │TR│   capas, medir,
│  │                                          │TR│   sección
│  │                                          │  │
│  │                                          │  │
│LG│                                          │  │ ← Leyenda Au
├──┴──────────────────────────────────────────┴──┤
│ Coordenadas · escala                           │
└────────────────────────────────────────────────┘
```

### Cambios concretos

**1. Toolbar derecho unificado vertical** (`ProjectMap.tsx` + `SectionBuilderTool.tsx`)
- Mover los botones del toolbar de ProjectMap (fullscreen, dibujo, capas, medir) a una columna vertical en `top-3 right-3`, ancho fijo ~40px, iconos solamente con tooltip.
- Integrar el botón "Sección" como un botón más en esa misma columna (no flotando aparte).
- El input "± 50m" y el control "Ver sección / Limpiar" aparecen en un mini-popover sobre el botón de Sección cuando está activo, no permanente.

**2. FeatureInspectorPanel**
- Fijar ancho 320px y posicionar `top-3 right-16` (después del toolbar) en lugar de pegado al borde, para que no tape el toolbar al abrirse.
- En viewports <900px: convertir a panel inferior tipo bottom-sheet (max-height 50vh).

**3. Leyenda Au**
- Subirla a `bottom-12 left-3` para no chocar con la atribución de Leaflet.
- Hacerla colapsable con un botón `<` que la reduce a un icono.

**4. Zoom de Leaflet**
- Mover los controles de zoom a `bottom-left` (configurar `zoomControl: false` y añadir `L.control.zoom({ position: 'bottomleft' })`) para liberar el top-left y dejar el flujo natural pulgar-derecha en mobile.

**5. Z-index hierarchy estandarizada**
- Mapa Leaflet: default (400)
- Toolbar/leyenda flotantes: `z-[500]`
- FeatureInspectorPanel: `z-[600]`
- SectionView modal: `z-[700]`
- Tooltips de Sonner/dialogs shadcn: ya son `z-[1000+]`

**6. Header**
- Reducir altura a 44px en md+ y compactar el badge "X muestras" para que no fuerce wrap a 815px.

### Archivos a tocar
- `src/components/ProjectMap.tsx` — toolbar vertical, mover zoom, ajustar inspector
- `src/components/map/SectionBuilderTool.tsx` — integrarse al toolbar vertical, popover para opciones
- `src/components/map/FeatureInspectorPanel.tsx` — ancho fijo, bottom-sheet en mobile
- `src/routes/_authenticated.dashboard.map.tsx` — header compacto, posición leyenda Au
- `src/styles.css` (si hace falta) — variables z-index

### Resultado
Una sola columna de herramientas a la derecha (sin solapes), zoom abajo-izquierda, leyenda colapsable arriba de la atribución, panel de inspección que no tapa los controles, y header que no rompe a 815px. Sin agregar features nuevas — solo orden visual.

### No incluido (próximas iteraciones)
- Atajos de teclado para herramientas
- Mini-mapa de overview
- Modo presentación (oculta toda UI excepto mapa)
