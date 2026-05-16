# GPS en terreno + PWA con offline básico

## Estado actual (ya existe)
- `public/manifest.webmanifest` con `display: standalone` y `start_url: /dashboard/field-map`
- `__root.tsx` ya enlaza manifest, theme-color y apple-touch-icon
- `src/hooks/useGeolocation.ts` con `watchPosition` + helper `haversineMeters`
- `src/components/field/FieldMap.tsx` ya usa GPS para captura de puntos
- `src/components/targets/TargetsMap.tsx` (Leaflet) sin GPS por ahora

Esto significa que el 60% de la pieza PWA + GPS ya está en pie. El plan se concentra en **traer el GPS al mapa de targets** y **agregar offline básico controlado** sin romper el preview de Lovable.

---

## Alcance acordado
- PWA: **instalable + offline básico** (service worker con cache de la app shell y de tiles del mapa).
- GPS en `TargetsMap`:
  1. Botón **"Ubicarme"** (marcador + círculo de exactitud + centrar)
  2. **Seguimiento continuo** (toggle on/off, usa `watchPosition`)
  3. Panel **"Target más cercano"** con distancia (m/km) y rumbo (bearing °)
  4. **Alerta al entrar en radio <100 m** de un target crítico o alto

---

## 1. GPS en el mapa de targets

### 1.1 Helper de bearing
Extender `src/hooks/useGeolocation.ts` con `bearingDegrees(a, b)` (fórmula de rumbo inicial sobre esfera). Devuelve 0–360°.

### 1.2 Componente `UserLocationLayer` (nuevo)
`src/components/targets/UserLocationLayer.tsx`:
- Recibe `position: GeoPosition | null` y `follow: boolean`
- Usa `useMap()` de `react-leaflet`
- Renderiza `<CircleMarker>` azul (8 px) con `<Circle>` traslúcido del radio = `accuracy`
- Si `follow`, llama `map.setView([lat,lng], Math.max(map.getZoom(), 15))` cuando cambia la posición

### 1.3 Panel "Target más cercano" (nuevo)
`src/components/targets/NearestTargetPanel.tsx`:
- Inputs: `targets`, `position`
- Calcula con `haversineMeters` el más cercano (entre los visibles según filtros)
- Muestra: código, nombre, prioridad, **distancia** (m si <1 km, si no km con 2 dec) y **bearing** (`315° NO`)
- Botón "Ir al target" centra el mapa en el target (via callback)
- Posicionado en esquina inferior-izquierda del mapa (overlay)

### 1.4 Geofence + alerta
Dentro de `TargetsMap`:
- `useEffect` que recorre targets con `priority in ('critical','high')` y revisa distancia
- Mantiene un `Set` de IDs ya notificados para no spamear
- Cuando un nuevo target entra a <100 m: `toast.success("Cerca de TGT-XXX (78 m)")` + vibración (`navigator.vibrate?.([200,100,200])`)
- Reinicia el flag cuando el usuario se aleja >150 m (histéresis)

### 1.5 Controles GPS en `TargetsMap`
Header del mapa (junto a los chips de prioridad), 3 botones:
- **Ubicarme** (uso puntual: `getCurrentPosition` una vez)
- **Seguir** (toggle del `watchPosition` continuo)
- Indicador de estado: "GPS activo · ±12 m" / "Permiso denegado" / etc.

Estado:
```ts
const [tracking, setTracking] = useState(false);
const { position, status, error } = useGeolocation(tracking);
```

Sin tracking, el botón "Ubicarme" hace una sola lectura via `navigator.geolocation.getCurrentPosition` y guarda en estado local.

---

## 2. PWA con offline básico

### 2.1 Dependencia
```bash
bun add -d vite-plugin-pwa
```

### 2.2 `vite.config.ts`
Añadir `VitePWA` con la configuración segura para Lovable:
```ts
VitePWA({
  registerType: "autoUpdate",
  devOptions: { enabled: false },   // jamás en dev/preview
  manifest: false,                  // ya tenemos public/manifest.webmanifest
  workbox: {
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/_/],
    runtimeCaching: [
      { urlPattern: ({ request }) => request.mode === "navigate",
        handler: "NetworkFirst",
        options: { cacheName: "html", networkTimeoutSeconds: 3 } },
      { urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*\/tile\/.*/i,
        handler: "CacheFirst",
        options: { cacheName: "esri-tiles",
          expiration: { maxEntries: 600, maxAgeSeconds: 60*60*24*30 },
          cacheableResponse: { statuses: [0, 200] } } },
      { urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
        handler: "CacheFirst",
        options: { cacheName: "osm-tiles",
          expiration: { maxEntries: 600, maxAgeSeconds: 60*60*24*30 },
          cacheableResponse: { statuses: [0, 200] } } },
    ],
  },
})
```

### 2.3 Registro seguro en `src/main.tsx` (o `src/start.ts` del cliente)
Registro **condicional** para nunca activarse dentro del iframe del editor:
```ts
const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
const isPreviewHost = location.hostname.includes("id-preview--")
  || location.hostname.includes("lovableproject.com")
  || location.hostname.includes("lovable.app");

if (inIframe || isPreviewHost) {
  navigator.serviceWorker?.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
} else if ("serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
}
```

> El offline solo funciona en la URL publicada (`geocapitals.com` o `*.lovable.app`), nunca en el preview del editor.

### 2.4 Manifest tweak
Cambiar `start_url` actual `/dashboard/field-map` por `/dashboard/targets` (la vista de exploración con GPS pedida), o dejarla y agregar **shortcut** PWA a Targets:
```json
"shortcuts": [
  { "name": "Targets", "url": "/dashboard/targets", "icons": [{ "src": "/apple-touch-icon.png", "sizes": "180x180" }] }
]
```
Decisión sugerida: dejar `start_url` y agregar el shortcut.

### 2.5 Botón "Instalar app"
Componente reutilizable `src/components/pwa/InstallPWAButton.tsx`:
- Escucha `beforeinstallprompt`, guarda el evento, muestra botón solo cuando esté disponible
- Llama `prompt()` al click
- En iOS Safari (que no emite el evento) muestra tooltip: "Compartir → Agregar a inicio"
- Colocar el botón en la header del Mapa de Targets y opcionalmente en el dashboard

---

## 3. Avisos importantes
- El **service worker no se registra en el preview** ni dentro de iframes; solo en la URL publicada. Es obligatorio para no romper el iframe del editor.
- El offline básico cachea **tiles ya visitados** (no descarga proactivamente toda la zona). Para usar en terreno: abrir el área con datos antes de salir, luego ya queda cacheada.
- Una vez instalada la PWA, `start_url` queda fijado en el dispositivo. Cambios futuros a ese campo solo afectan a nuevas instalaciones.
- Para que el GPS funcione el sitio debe estar en **HTTPS** (lo está: `geocapitals.com` y `*.lovable.app`).

---

## Detalles técnicos resumidos

| Archivo | Acción |
|---|---|
| `src/hooks/useGeolocation.ts` | + `bearingDegrees(a,b)` |
| `src/components/targets/UserLocationLayer.tsx` | nuevo (marker + accuracy + follow) |
| `src/components/targets/NearestTargetPanel.tsx` | nuevo (distancia + bearing + ir) |
| `src/components/targets/TargetsMap.tsx` | + controles GPS + montaje de los dos componentes + geofence |
| `src/components/pwa/InstallPWAButton.tsx` | nuevo |
| `src/routes/_authenticated.dashboard.targets.tsx` | + InstallPWAButton en header |
| `vite.config.ts` | + VitePWA configurado |
| `src/main.tsx` | + registro condicional del SW |
| `public/manifest.webmanifest` | + `shortcuts` a Targets |
| `package.json` | + `vite-plugin-pwa` (devDep) |

## Criterios de aceptación
- En `geocapitals.com/dashboard/targets`: aparece botón "Ubicarme" y toggle "Seguir"; al aceptar permiso se ve marker azul con círculo de exactitud
- Panel inferior muestra "TGT-XX · 234 m · 312° NO" actualizándose con el movimiento
- Al acercarse a <100 m de un target crítico/alto: toast + vibración (una sola vez)
- En la URL publicada aparece prompt "Instalar app" (Android/desktop Chrome); en iOS, tooltip de instrucciones
- Tras instalar, abrir la app sin red: las tiles ya vistas y la app shell cargan; los datos de Supabase fallan con mensaje claro (offline básico, no offline-first de datos)
- En el preview del editor: **no se registra service worker** (verificable en DevTools → Application)
