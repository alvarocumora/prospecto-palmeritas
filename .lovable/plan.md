# Plan: PWA móvil para mapa de exploración en terreno

Activar instalación tipo app en móvil (Android/iOS) sobre una vista de mapa optimizada para campo, con pertenencias mineras visibles y un botón flotante para marcar puntos de interés con nota geolocalizada.

> **Aviso importante sobre PWA en Lovable**: las PWA son una característica avanzada. Las funciones de instalación, ícono en home screen y uso offline básico **solo funcionarán en la URL publicada** (`geocapitals.com` / `*.lovable.app`), no dentro del preview del editor. Para evitar romper el preview, NO activaré service worker con caché agresiva; usaremos la ruta "manifest-only + SW kill-switch seguro" que recomienda la plataforma.

---

## 1. Instalabilidad móvil (manifest-only, sin caché que rompa el preview)

- `public/manifest.webmanifest` con: `name: "Geocapitals Field"`, `short_name: "Geocapitals"`, `display: "standalone"`, `orientation: "portrait"`, `theme_color` y `background_color` desde tokens del design system, `start_url: "/dashboard/field-map"`, `scope: "/"`.
- Íconos generados (192, 512, maskable 512) en `public/icons/`.
- Tags en `src/routes/__root.tsx` head: `link[rel=manifest]`, `meta[name=theme-color]`, `apple-touch-icon`, `apple-mobile-web-app-capable`, `viewport-fit=cover`.
- **No** instalar `vite-plugin-pwa`. **No** registrar service worker con runtime caching (rompe el preview en iframe).
- Botón "Instalar app" en la nueva vista móvil que captura `beforeinstallprompt` (Android/Chrome) y muestra instrucciones para iOS Safari (Compartir → Añadir a inicio).

## 2. Nueva ruta `/dashboard/field-map` (mapa de campo móvil-first)

Archivo: `src/routes/_authenticated.dashboard.field-map.tsx`.

Capas sobre Leaflet (reusando patrones de `ProjectMap` y `src/components/map/`):
- Basemap satelital (Esri World Imagery) + toggle topográfico.
- **Pertenencias mineras** del proyecto activo (usa `useMiningConcessions` ya existente) con estilo por estado (vigente / en trámite / caducada) y popup con código, titular, hectáreas.
- AOI del proyecto.
- Targets de exploración (`useExplorationTargets` + `targetsLayer.ts` existente).
- **Capa de POIs de campo** (nueva, ver sección 4).
- `CoordinateFooter` + posición GPS actual con `useGeolocation` (punto azul + halo de precisión).

UX móvil:
- Header colapsable; el mapa ocupa todo el alto disponible (`100dvh` menos safe-area).
- Reutiliza `MobileMapInspector` para toggles de capas y opacidad.
- FAB principal dorado abajo-derecha: **"Marcar punto"** (icono `MapPin`).
- FAB secundario: **"Mi ubicación"** (centrar y seguir GPS).
- Indicador online/offline (`OnlineStatusBadge`).

## 3. Flujo "Marcar punto de interés con nota"

Al tocar el FAB "Marcar punto":
1. Captura coordenadas actuales del GPS (alta precisión); si falta permiso, fallback al centro del mapa con aviso.
2. Abre un `Sheet` inferior con formulario:
   - Tipo (select): afloramiento, alteración, veta, estructura, muestra, contacto litológico, infraestructura, riesgo HSE, otro.
   - Título corto (obligatorio).
   - Nota (textarea, multilínea).
   - Foto opcional (input `capture="environment"` → sube a Storage del proyecto).
   - Precisión GPS y timestamp (auto, solo lectura).
3. Botón "Guardar" persiste el POI y lo dibuja inmediatamente en el mapa.
4. Si está offline: se encola usando el patrón `useOfflineQueue` existente y se sincroniza al recuperar conexión.

Tap sobre un POI existente → popup con título, tipo, nota, autor, fecha, foto miniatura, y acciones "Editar" / "Eliminar" (según rol).

## 4. Backend (Lovable Cloud)

Nueva tabla `field_pois` con:
- Vinculada al proyecto, organización y usuario autor.
- Tipo, título, nota, lat/lng, precisión GPS, elevación opcional, URL de foto.
- RLS multi-tenant siguiendo el patrón existente (lectura: miembros del proyecto; escritura: miembros con rol mínimo `geologist`/`field`; borrado: autor o `admin`, validado vía `has_role()`).
- Índice geoespacial (lat, lng) y por `project_id`.

Bucket de Storage `field-poi-photos` (privado) con políticas por proyecto.

Hook `useFieldPois(projectId)` con React Query + suscripción realtime para colaboración en vivo entre geólogos en terreno.

## 5. Navegación

- Entrada nueva en el menú lateral: **"Mapa de campo"** (icono `Compass`), visible en móvil y desktop.
- En móvil, la barra inferior incluye acceso directo a esta vista.

---

## Detalles técnicos

- **Stack**: TanStack Start file-based routing, Leaflet (ya en el proyecto), Tailwind v4, shadcn `Sheet`/`Select`/`Textarea`.
- **Geolocalización**: reutiliza `src/hooks/useGeolocation.ts`; añade `watchPosition` mientras el FAB "Seguir" esté activo.
- **Offline**: cola en `localStorage` vía `useOfflineQueue`; al volver online, `flush` hace insert batch a `field_pois` y sube fotos pendientes.
- **Performance móvil**: capas de pertenencias en GeoJSON con `simplify` cuando hay >500 polígonos; `preferCanvas: true` en el mapa.
- **Accesibilidad**: FAB ≥48px, contraste AA, safe-area-inset respetada.

## Lo que NO incluye este plan

- Modo offline completo del mapa (tiles cacheados). Se puede agregar después con un service worker dedicado y tiles MBTiles o cache de tiles raster — requiere su propio plan por el impacto en el preview.
- Edición masiva de POIs ni exportación a shapefile (se puede sumar después).
- Cambios al PDF NI 43-101.
