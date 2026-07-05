## Diagnóstico: por qué los cards "no linkean a nada"

Los 6 cards en `MarketingLanding.tsx` (líneas 512-556) se renderizan como `<BrandCard>` **sin prop `to` ni `<Link>` envolvente**. No es un 404 del router: es que el elemento nunca fue un link. La flecha `→` es decorativa.

### Estado real por módulo

| # | Card | Ruta pública destino | Existe hoy | Datos reales disponibles |
|---|---|---|---|---|
| 1 | Mapa geológico | `/catastro/mapa` | ✅ Sí | ✅ `mining_concessions`, `cadastre_national` cargados |
| 2 | Visor 3D geocientífico | `/visor-3d` | ❌ No | ✅ `scene3d.server` (DEM Copernicus + Sentinel) ya funciona en `_authenticated/dashboard/geology3d` |
| 3 | Monitoreo satelital | `/satelital` | ❌ No | ✅ `satellite_layers`, `insar_displacement`, `satellite_anomalies` con datos demo Palmeritas/Franco |
| 4 | NI 43-101 asistido | `/ni43101` | ❌ No | ✅ `technical_reports`, `ni43101_section_catalogue`, reporte demo Los Verdes |
| 5 | Cumplimiento & patentes | `/cumplimiento` | ❌ No | ✅ `compliance_rules`, `compliance_evaluations`, `mining_bulletins` |
| 6 | Capital raise & deals | `/oportunidades` | ✅ Sí | ✅ `property_listings` featured + `deals` |

Conclusión: **4 de 6 destinos no existen como ruta pública** (viven detrás de `_authenticated/dashboard/*`). Los datos ya están en la BD — falta la capa pública que los muestre a un visitante sin login.

## Plan por sprints (público sin login)

Cada sprint = un turno cerrado. Recomiendo el orden por menor esfuerzo / mayor "wow".

### Sprint 0 — Cablear los 2 que ya existen (30 min)
- Añadir `Link` a los cards 1 y 6 → `/catastro/mapa` y `/oportunidades`.
- Añadir estado "próximamente" a los otros 4 con hover claro (mientras se construyen).
- Cierra la queja inmediata: ningún card queda muerto.

### Sprint 1 — `/satelital` (demo Palmeritas)
Vista pública que renderiza:
- Mapa MapLibre con `satellite_layers` (WMS/COG STAC) del proyecto demo.
- Panel InSAR con serie temporal de `insar_displacement`.
- Tabla de `satellite_anomalies` con severidad y confidence.
Fetcher: `createServerFn` público leyendo con `SUPABASE_PUBLISHABLE_KEY` + policy `TO anon` filtrada por `project_id = <demo>`.

### Sprint 2 — `/visor-3d` (Los Verdes)
- Reutilizar `Geology3DViewer` existente en modo read-only.
- Nuevo server fn público `getPublicScene3d({ projectId })` que llama a `scene3d.server` con project demo hardcoded.
- Sin controles de edición (solo cámara + capas visibles).

### Sprint 3 — `/ni43101` (Los Verdes pre-43101)
- Vista pública del reporte demo Los Verdes: TOC (`ni43101_section_catalogue`) + secciones renderizadas + evidencia satelital linkeada.
- Ya existe `/_authenticated/reports/losverdes.pre43101` — clonar a versión pública con banner "muestra".

### Sprint 4 — `/cumplimiento`
- Lista pública de `mining_bulletins` recientes por región + buscador simple.
- Reglas `compliance_rules` como catálogo educativo.
- CTA a login para "ver mis proyectos evaluados".

## Datos técnicos

- **RLS**: cada tabla necesita una policy `TO anon` estrecha, filtrada al `project_id` o `holder_id` del caso demo. No abrir toda la tabla.
- **Fetchers**: `createServerFn` públicos en `src/lib/*.functions.ts` usando cliente publishable server-side (no `supabaseAdmin`, no `requireSupabaseAuth`).
- **Loaders**: patrón canónico `ensureQueryData` + `useSuspenseQuery`. `errorComponent` + `notFoundComponent` obligatorios.
- **SEO**: cada ruta con `head()` propio (title, description, og:title, og:description, og:image cuando aplique).
- **Sitemap**: agregar las 4 rutas nuevas a `src/routes/sitemap[.]xml.ts`.
- **i18n**: añadir claves ES/EN en `src/features/marketing/i18n.tsx` para los CTAs.
- **AppShell nav**: opcional — añadir "Módulos" con dropdown a los 6 públicos.

## Recomendación

Ejecutar **Sprint 0 ya mismo** (los cards dejan de estar muertos hoy) y luego decides si seguimos por Sprint 1 (satelital, el más visualmente potente para inversionistas) o por otro orden.

¿Arranco con Sprint 0 + Sprint 1 en el próximo turno?
