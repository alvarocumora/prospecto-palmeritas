## Objetivo

Activar una capa de **Catastro Minero SERNAGEOMIN** sobre el Live Map PWA (`/live/losverdes`) y resaltar las 15 pertenencias del proyecto (LV-C-001 a LV-C-015) sobre el cuadrante real publicado por el organismo oficial. Esto reemplaza el plano impreso de las fotos por polígonos georreferenciados que se actualizan automáticamente.

## Qué se va a ver en terreno

- Polígonos oficiales de **Explotación 1983**, **Explotación 1932**, **Exploración 1983** y **Estacamento** alrededor del proyecto.
- Las concesiones **del titular Carlos Fernández** resaltadas en amarillo intenso con borde grueso (match por nombre contra la base SERNAGEOMIN).
- Popup oficial: ROL, nombre, titular, hectáreas, vencimiento, comuna.
- Chip nuevo: `[📋 Catastro]` con conteo en vivo (`📋 142`).
- Mini-leyenda con los 4 colores ORIGEN cuando el toggle está activo.

## Cómo se conecta (técnico)

La infraestructura ya existe en el dashboard interno y se reutiliza tal cual — no hay tablas nuevas ni migraciones:

```text
src/components/map/catastroLayer.ts   →  loadCatastro(L, bbox)  + bboxAround()
src/components/map/overlays.ts        →  CATASTRO_STYLE + popup oficial
```

`loadCatastro` consulta el **ArcGIS FeatureServer público** de SERNAGEOMIN (sin API key, sin RLS) y cachea 24h en `localStorage`. Funciona offline después de la primera carga.

### Cambios

1. **`FieldMapPublic.tsx`**
   - Nuevos estados: `showCatastro`, `catastroCount`, `loadingCatastro`, `catastroLayerRef`.
   - Nuevo chip `[📋 Catastro]` (color `#22c55e`) entre `Vetas` y `3D`.
   - `useEffect` que, al activar el toggle:
     - calcula `bboxAround([center_lat, center_lng], 6)` (≈ 12×12 km, cubre todo el cluster Los Verdes / Tilama).
     - llama `loadCatastro(L, bbox)`.
     - añade los 4 layers ORIGEN al mapa.
     - resalta features cuyo `NOMBRE` matchee (normalizado) cualquier `mining_concession.name` del proyecto → restyle con `weight: 4, color: '#facc15', fillOpacity: 0.35`.
     - actualiza `catastroCount` con el total.
   - Al desactivar: `removeLayer()` y mantiene el cache para próxima activación.

2. **`livemap-public.functions.ts`**
   - Extender `getLosVerdesPublicLayers` para incluir `projectConcessions: { code, name, holder }[]` desde `mining_concessions` (filtro `project_id`, sin geometría — solo metadata para el matching cliente). Bypassa RLS vía `supabaseAdmin`.

3. **Mini-leyenda flotante** (debajo de la legend del heatmap)
   - 4 cuadritos con label corto: `Explot. '83 · Explot. '32 · Explor. '83 · Estacament.`
   - Visible solo cuando `showCatastro` está activo.

4. **Estado online/offline**
   - Si está offline y no hay cache, mostrar toast: "Catastro requiere conexión la primera vez".
   - Si hay cache, carga normal y muestra badge `cached` discreto.

## Lo que NO se hace en esta iteración

- No se editan los registros en `mining_concessions` (siguen sin geometría en la DB; el matching es solo visual).
- No se agrega un job para sincronizar geometría desde SERNAGEOMIN → DB (eso queda para un sprint posterior si se quiere persistir).
- No se toca el dashboard interno ni se modifica RLS.

## Archivos a modificar

- `src/components/field/FieldMapPublic.tsx` (toggle, layer, leyenda, matching)
- `src/lib/livemap-public.functions.ts` (añadir `projectConcessions` al payload)

## Validación

- Abrir `/live/losverdes` en móvil → activar `📋 Catastro` → ver polígonos rosados/azules sobre el área.
- Verificar que las 15 pertenencias del titular Fernández aparezcan resaltadas en amarillo.
- Tocar un polígono → popup con ROL + titular + vencimiento.
- Desactivar conexión → re-activar toggle → debe servir desde cache.