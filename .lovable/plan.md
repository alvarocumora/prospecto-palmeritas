## Problema confirmado

En `src/features/marketing/MarketingLanding.tsx` el componente `HeroLiveMap` se renderiza dos veces (hero + sección "Catastro live"), mostrando exactamente el mismo mapa (4 listings publicados + capa "potencial"). La sección Catastro no muestra el catastro real que sí tenemos indexado (`cadastre_national` = 11.751 concesiones SERNAGEOMIN, `mining_concessions` = 117 gestionadas). Los planes (`billing_plans`: Free / Pro USD 49 / Enterprise USD 299) existen y `/catastro/precios` está funcional con checkout MercadoPago, pero desde el landing no se promocionan.

## Objetivo

1. Eliminar la duplicación del mapa en el landing.
2. Que la sección "Catastro" muestre datos reales del catastro nacional y no una copia del hero.
3. Convertir esa sección en un gancho comercial: KPIs reales + herramientas + planes con CTA a `/catastro/precios`.

## Cambios

### 1. Nueva server function `getLandingCatastroSnapshot`

Archivo: `src/lib/landingCatastro.functions.ts` (público, sin auth, cacheable).

Devuelve, leyendo `cadastre_national` vía `supabaseAdmin`:

- `totalNacional` (count)
- `porRegion`: top 6 regiones con conteo
- `porTipo`: distribución exploración / explotación / manifestación
- `porEstado`: vigentes / en trámite / caducadas
- `topTitulares`: top 5 titulares por nº de concesiones (solo nombre + count, sin PII sensible)
- `heatPoints`: hasta 3.000 puntos `[lng, lat]` muestreados uniformemente para pintar un heatmap MapLibre
- `updatedAt`: fecha del último `cadastre_sync_run` exitoso

### 2. Nuevo componente `LandingCatastroBlock`

Archivo: `src/features/marketing/LandingCatastroBlock.tsx`. Reemplaza al segundo `<HeroLiveMap />` de la sección `#catastro`. Layout en dos columnas:

```text
┌─────────────────────────────┬──────────────────────────┐
│  Mapa MapLibre heat de       │  KPIs vivos               │
│  cadastre_national           │  · 11.7k concesiones      │
│  (heatmap + basemap Esri)    │  · N regiones cubiertas   │
│  Chip "SERNAGEOMIN · live"   │  · Última sync: hh:mm     │
│  Etiqueta "sample 3k / 11.7k"│                            │
│                              │  Top regiones (barras)    │
│                              │  Distribución tipo/estado │
│                              │  Top 5 titulares          │
└─────────────────────────────┴──────────────────────────┘
```

Debajo, tira de "Herramientas del catastro" (chips con link a rutas ya existentes):

- Mapa nacional → `/catastro/mapa`
- Buscar concesión / titular → `/catastro/mapa?q=`
- Multi-país (PE, BR, ZM, MW) → `/catastro/global`
- Monitoreo y alertas (Pro) → `/catastro/app/watchlist`
- Reportes PDF/GeoJSON (Pro) → `/catastro/precios`

Al final del bloque, mini-tabla de planes leída desde `getPublicPlans` (Free / Pro / Enterprise) con precios reales y CTA "Ver planes" → `/catastro/precios` y "Abrir catastro" → `/catastro/mapa`.

### 3. Ajustes en `MarketingLanding.tsx`

- Sección hero (`<HeroLiveMap />` línea 182): sin cambios (sigue siendo el mapa live de listados + potencial).
- Sección `#catastro` (líneas 224-286): eliminar `<HeroLiveMap />` duplicado y el grid manual de 3 KPIs; renderizar `<LandingCatastroBlock />`. La cabecera queda con eyebrow, título y párrafo actuales; los botones "Abrir catastro / Terminal geológico" se mueven al final del bloque para no repetir el CTA.
- El KPI `cadastreNationalCount` del bloque contiguo pasa a leerse del snapshot real en lugar de `getLandingLiveKpis`.

### 4. Verificación

- `bunx vitest run src/features/marketing` si hay tests que apliquen; agregar smoke test que asegure que `getLandingCatastroSnapshot` responde `totalNacional > 0` contra la BD real.
- Playwright sobre `/` con viewport 1280×1800: capturar hero y sección catastro, confirmar visualmente que no hay dos mapas idénticos y que el bloque catastro muestra heatmap + KPIs + planes.
- Revisar `/catastro/precios` navegando desde el CTA nuevo.

## Fuera de alcance

- No se toca `/catastro/proyecto`, `/catastro/mapa`, `/catastro/global` ni el flujo de MercadoPago.
- No se modifica `HeroLiveMap` ni el resto del landing.
- No se cambian precios ni features de `billing_plans`.
