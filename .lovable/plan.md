# Live Field Map PWA — Los Verdes (Tilama)

Reutiliza la infraestructura ya existente (`FieldMap.tsx`, `field_pois`, `useFieldPoiQueue`, `InstallPwaButton`, patrón `/live/palmeras`) y la expone como PWA pública con contraseña, lista para usar **hoy en terreno**.

## 1. Nueva ruta `/live/losverdes`

Archivo: `src/routes/live.losverdes.tsx`

- Patrón idéntico a `live.palmeras.tsx`: `PasswordGate` → contenido protegido.
- `sessionStorage` key: `live_map_losverdes_token`.
- Banner "Live Field · Los Verdes · Confidencial" + botón cerrar sesión.
- Renderiza `<FieldFieldMapPublic projectId="7a499b02-ecdf-447b-8956-b106fe4ec087" />`.
- `head()` con `noindex,nofollow` + `theme-color` + manifest link.

## 2. Verifier nuevo

En `src/lib/live-map.functions.ts`:
- Añadir `export const verifyLosVerdesLiveMapPassword = buildVerifier("LIVE_MAP_LOSVERDES_PASSWORD");`
- Pedir secret `LIVE_MAP_LOSVERDES_PASSWORD` via `add_secret`.

## 3. Variante pública del FieldMap

Hoy `FieldMap` depende de `useProjects()` (sesión autenticada) y de RLS que exige `is_project_member`. Para el modo `/live/*` (sin login):

Opción elegida: **modo "solo lectura + notas anónimas locales"** para no abrir RLS:
- Nuevo componente `src/components/field/FieldMapPublic.tsx` (basado en FieldMap):
  - Recibe `projectId` por prop, salta `useProjects`.
  - Carga concesiones y targets vía **server fn pública** nueva (`getPublicFieldData`) que usa `supabaseAdmin` y retorna solo capas no sensibles del proyecto Los Verdes (concesiones vigentes, exploration_targets, bbox).
  - **POIs/notas:** se guardan en `localStorage` + `IndexedDB` (cola), NO en `field_pois`. Botón "Exportar GeoJSON/CSV" para subirlos luego desde el dashboard autenticado.
  - GPS, foto (input file), seguimiento y capa targets clicable: igual que FieldMap.
- Esto evita exponer escritura sin auth y mantiene el principio de RLS estricto del proyecto.

Server fn nueva en `src/lib/livemap-public.functions.ts`:
- `getLosVerdesPublicLayers()` → `{ concessions, targets, center, bbox }` filtrado por `project_id`.

## 4. PWA (manifest + install)

- `public/manifest.losverdes.json` con `name`, `short_name: "LV Field"`, `start_url: "/live/losverdes"`, `display: standalone`, `theme_color`, iconos.
- Link `<link rel="manifest" href="/manifest.losverdes.json">` inyectado por `head()` de la ruta.
- Reutiliza `InstallPwaButton` ya existente.
- **No** se añade service worker (regla del proyecto: PWA solo manifest, sin SW por iframes de preview). Instalable en móvil sin offline shell.

## 5. Importador de notas al dashboard

En `/_authenticated/dashboard/field-map` añadir botón "Importar notas del Live PWA" que:
- Lee localStorage `live_map_losverdes_pois`.
- Inserta en `field_pois` vía server fn autenticada.
- Limpia la cola local.

## 6. Acceso desde el PDF / dashboard

- Card en `/dashboard/index` para "Distrito Los Verdes": link + QR a `/live/losverdes`.
- (Opcional, fuera de scope si quieres rápido) añadir QR a la página 1 del PDF v1.4.

## Entregables

```text
src/routes/live.losverdes.tsx                (nuevo)
src/components/field/FieldMapPublic.tsx       (nuevo)
src/lib/livemap-public.functions.ts           (nuevo)
src/lib/live-map.functions.ts                 (+ verifier)
public/manifest.losverdes.json                (nuevo)
src/routes/_authenticated.dashboard.field-map.tsx  (+ importador)
secret: LIVE_MAP_LOSVERDES_PASSWORD
```

## Notas técnicas

- No se modifican RLS de `field_pois` (siguen requiriendo `is_project_member`).
- La server fn pública solo expone capas no sensibles ya presentes en `exploration_targets` + `mining_concessions` del proyecto Los Verdes.
- Mobile-first: controles grandes (≥44px), bottom-sheet, contraste alto sobre satélite Esri.
- Sin Service Worker (cumple regla `pwa` del proyecto).

¿Apruebas para implementar?
