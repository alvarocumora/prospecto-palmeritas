# Módulo Público de Catastro — `catastro.geocapitals.com`

Plataforma profesional freemium para operadores mineros en Chile, con mapa nacional SERNAGEOMIN, búsqueda, fichas SEO, alertas y reportes. Reutiliza infraestructura existente (`sync-catastro`, `concession_history`, `mining_concessions`, `concesionesNacionalesLayer`).

## Modelo de negocio

| Plan | Precio (USD/mes) | Límites |
|---|---|---|
| **Free** | $0 | Mapa nacional, búsqueda ilimitada, ficha básica, 1 watchlist (3 concesiones) |
| **Pro** | $49 | 50 watches, alertas email/push, traslapes, AOI ilimitadas, 20 exports PDF/GeoJSON, sin marca de agua |
| **Enterprise** | $299 | Watches ilimitados, Shapefile, API, multi-usuario, reportes due-diligence batch, soporte |

Pagos vía **Lovable Payments (Stripe)** — suscripción mensual. Webhook actualiza `subscriptions` table.

## Arquitectura de rutas

Subdominio `catastro.geocapitals.com` apuntando al mismo deployment, ruteado por dominio en `__root.tsx` o split build. Rutas:

```text
/                              → Landing comercial (hero, mapa demo, planes, SEO)
/mapa                          → App full-screen: mapa nacional + filtros + buscador
/c/$code                       → Ficha SSR de concesión (SEO indexable, og:image)
/titular/$rut                  → Perfil público de titular (concesiones, mapa, totales)
/region/$slug                  → Landing por región (Antofagasta, Atacama...)
/precios                       → Planes y comparación
/login, /signup, /cuenta       → Auth + gestión suscripción
/app/watchlist                 → (Pro) Watchlist + alertas
/app/aoi                       → (Pro) AOI dibujada + análisis traslapes
/app/exports                   → (Pro) Historial reportes PDF/GeoJSON
```

Todas las rutas `/c/$code`, `/titular/$rut`, `/region/$slug` con `head()` individual (title, description, og:image generado).

## Backend

### Tablas nuevas (migración)
- `public_concessions_cache` — snapshot de SERNAGEOMIN por código (titular, área, vigencia, geometría, region, comuna, last_synced_at). Permite búsqueda rápida sin golpear ArcGIS. Indexes: gin(titular trgm), btree(rut), gist(geometry).
- `public_holders` — agregado por RUT (nombre, total_concesiones, total_ha, regiones, last_updated).
- `catastro_watchlist` — user_id, concession_code, notify_email, notify_push, created_at. RLS por user_id.
- `catastro_alerts` — user_id, code, alert_type (holder_change, area_change, status_change, expiring, missing), payload, read_at.
- `catastro_aoi` — user_id, name, geometry (geography polygon), created_at. RLS por user_id.
- `catastro_exports` — user_id, type (pdf|geojson|shp), target (code|aoi|rut), file_url, created_at.
- `subscriptions` — user_id, plan ('free'|'pro'|'enterprise'), status, stripe_customer_id, stripe_sub_id, current_period_end.
- Helper `public.catastro_plan(uid uuid)` SECURITY DEFINER → text.

### Server functions (`createServerFn`)
- `searchConcessions` — full-text por titular/RUT/código/comuna, paginado, sin auth.
- `getConcessionByCode` — ficha pública (cache + fallback ArcGIS).
- `getHolderByRut` — agregado público.
- `getRegionStats` — agregados por región.
- `addToWatchlist`, `removeFromWatchlist`, `listMyWatchlist` — auth + chequeo límite por plan.
- `createAoi`, `analyzeAoiOverlaps` — usa `compute-overlaps` existente.
- `requestExport` — genera PDF/GeoJSON/SHP, guarda en storage, retorna URL.
- `createCheckoutSession`, `cancelSubscription` — Stripe.

### Server routes
- `/api/public/catastro/sitemap.xml` — sitemap dinámico de concesiones top + titulares + regiones.
- `/api/public/stripe-webhook` — verifica firma, actualiza `subscriptions`.

### Jobs (pg_cron existente)
- `refresh-public-cache` diario: paginación masiva de capas 0 y 1 SERNAGEOMIN → `public_concessions_cache` + `public_holders`.
- `dispatch-catastro-alerts` cada hora: diff sobre `public_concessions_cache` por watchlist activa, inserta `catastro_alerts`, envía email vía Resend.

## Frontend

### Componentes nuevos
- `src/features/catastro-public/` — feature aislada del dashboard interno.
  - `LandingHero.tsx`, `PricingTable.tsx`, `LiveMapDemo.tsx`
  - `PublicCatastroMap.tsx` — Leaflet + Esri base + capas SERNAGEOMIN (reutiliza `concesionesNacionalesLayer`) + buscador + drawer ficha.
  - `ConcessionPublicCard.tsx` — ficha SSR-friendly (server-rendered).
  - `HolderProfile.tsx` — perfil titular con mapa + lista.
  - `WatchlistPanel.tsx`, `AlertsBell.tsx` (Pro)
  - `AoiDrawTool.tsx` + `OverlapsResultPanel.tsx` (Pro)
  - `ExportDialog.tsx` (Pro)
  - `PlanGate.tsx` — wrapper que limita features según `subscriptions.plan`.

### SEO
- `head()` por ruta con title/desc únicos.
- JSON-LD `Place`/`Organization` por ficha y titular.
- Sitemap dinámico + robots.txt.
- og:image generado server-side por ficha (mapa estático).

## Fases de implementación

**Fase 1 — Fundaciones (sin pagos)**
1. Migración: `public_concessions_cache`, `public_holders`, `subscriptions`, helper `catastro_plan`.
2. Job de refresh inicial (semilla nacional).
3. Rutas `/`, `/mapa`, `/c/$code`, `/titular/$rut`, `/precios` con SEO y server functions de búsqueda/ficha.
4. Landing comercial + mapa público funcional.

**Fase 2 — Cuentas y freemium gating**
5. Auth pública (signup/login con Google), `PlanGate`, watchlist Free (3 items).
6. Migración watchlist + alerts + AOI + exports.

**Fase 3 — Monetización**
7. `recommend_payment_provider` → `enable_stripe_payments`.
8. Productos Pro/Enterprise, checkout, webhook, portal cliente.
9. `PlanGate` enforce límites reales.

**Fase 4 — Herramientas Pro**
10. AOI + traslapes + reportes PDF/GeoJSON/SHP.
11. Job de alertas (cron horario) + Resend email.
12. Perfiles de titular SEO + sitemap dinámico.

**Fase 5 — Subdominio y pulido**
13. Configurar `catastro.geocapitals.com` (auto setup Lovable).
14. Detección de host en `__root.tsx` para mostrar shell público vs dashboard.
15. Analytics, plantillas email, onboarding.

## Decisiones pendientes
- ¿Confirmamos arrancar por **Fase 1** ahora (mapa + búsqueda + fichas SEO públicas, sin pagos todavía)? Es la base sobre la que se monta todo lo demás y entrega valor demostrable en ~1 iteración.
- Precios definitivos USD/CLP (puedo dejar los sugeridos como placeholder).
- ¿Quieres soporte multi-idioma (es/en) desde el inicio o solo español?
