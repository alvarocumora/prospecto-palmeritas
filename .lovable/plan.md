# Auditoría + Plan de mejoras — Landing, Inversionistas y Shell

## 1. Hallazgos clave de la auditoría y aún no funciona en la ruta pública y dominio muestra error 500 

### A. Shell fragmentado (3 sistemas conviviendo)


| Zona                                                                        | Shell                                               | Tokens                                     | Problema                                     |
| --------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| `/`, `/proyectos`, `/inversionistas`, `/empresas`, `/recursos`, `/contacto` | `MarketingShell` (header blanco + footer navy)      | `--brand-*`                                | OK, coherente                                |
| `/terminal`, `/terminal.market`, etc.                                       | `TerminalShell` propio (top bar + ticker + sidebar) | `bg-background`, `text-foreground`, `gold` | Otro sistema visual sin puente con marketing |
| `/dashboard/*` (45 rutas)                                                   | Cada una con su layout interno                      | Mezcla shadcn + brand                      | Sin top-bar/breadcrumb unificado             |
| `/catastro/*`, `/live/*`                                                    | Shells parciales                                    | Mezcla                                     | Sin header común                             |


### B. Landing map (HeroLiveMap)

- Toggle Listings/Potential bien, pero el mapa sólo ocupa la mitad derecha del hero; en mobile (440px) queda chico y los pills se tapan.
- Click en marker Listings abre popup pero **no enlaza a detalle del deal** (`/proyectos` genérico).
- Sin filtros rápidos (commodity, país, ticket).
- Sin "feed" lateral con los listados visibles (mapa+lista sincronizados como Bloomberg/Zillow).
- Mode "Potential" muestra score sin leyenda numérica clara.

### C. `/inversionistas`

- Página estática: 4 cards de beneficios + tickets + 2 CTAs + ContactForm.
- **No muestra deal-flow real** (los `property_listings` ya existen y los carga el mapa, pero esta página no los lista).
- Sin tabla/cards de oportunidades, sin filtros, sin "match" por preferencias.
- CTA "Ver terminal" lleva al terminal vacío para no autenticados.

### D. Inconsistencias menores

- `MarketingLanding` tiene sección "Contacto embebido" con `id="contacto"` Y existe ruta `/contacto`: duplicación.
- Hero CTA "Publica" usa `hash="publicar"` en `/proyectos` sin ancla destino.
- Ticker `Geocapitals Terminal` en TerminalShell usa color `text-gold` y el resto de marketing usa `--brand-gold`: mismo color, dos nombres.
- Wheel del proceso (`brand-spin-slow`) sólo visible `lg:block` → mobile pierde el "giro" del que habla la marca.
- Footer marketing repite enlaces que también están en header; "Iniciar sesión" en footer va a `/auth` (signup mezclado).

---

## 2. Plan de mejoras (4 frentes, orden de ejecución)

### Frente 1 — Shell unificado (base del sistema)

Objetivo: una sola gramática visual para Marketing, Terminal y Dashboard.

1. Crear `src/components/shell/AppShell.tsx` con tres variantes:
  - `variant="marketing"` → header blanco translúcido + footer navy (actual `MarketingShell`).
  - `variant="terminal"` → top bar oscura compacta + ticker opcional + sidebar opcional.
  - `variant="workspace"` → top bar + breadcrumb + slot lateral (para `/dashboard/*`).
2. Unificar tokens en `src/styles.css`: alias `--gold` → `--brand-gold`, `--background-app` único; eliminar duplicados.
3. `BrandMark`, `LangToggle`, `UserMenu` extraídos a `src/components/shell/` y reutilizados por las 3 variantes.
4. Reemplazar `MarketingShell` y `TerminalShell` por wrappers delgados sobre `AppShell`.
5. Añadir mismo `<head>` defaults (favicon, viewport, OG fallbacks) vía un helper `withMeta()` reutilizado por todas las rutas.

### Frente 2 — Landing map rediseñado (más útil, más vivo)

Objetivo: que el mapa sea el corazón del landing, no un adorno.

1. Subir hero map a **layout split 60/40**: mapa a la izquierda (más grande), copy a la derecha. En mobile, mapa primero a pantalla casi completa.
2. Añadir **panel lateral "Live deals"** sincronizado con el mapa: lista los listings visibles en el viewport; hover → highlight marker; click → drawer con detalle (precio, modalidad, ha, commodity, owner anonimizado) y CTA "Solicitar acceso a data room".
3. Filtros rápidos sobre el mapa: chips de commodity (Au, Cu, Li, Ag…), país (CL/PE/AR), modalidad (Sale/JV/Royalty), ticket (slider USD).
4. Popups con link a `/inversionistas?listing=<id>` (deep-link al drawer en la página de inversores).
5. Leyenda de score con escala 0-100 + tooltip explicativo en modo Potential.
6. Wheel del proceso: convertir a una franja horizontal compacta debajo del mapa, visible en mobile.

### Frente 3 — `/inversionistas` con deal-flow real

Objetivo: dejar de ser brochure y convertirse en la vitrina real de oportunidades.

1. Sección **"Oportunidades activas"** arriba: grid de cards reutilizando `ListingCard` (ya existe en `src/modules/deals/ui/`).
  - Server fn nueva `getPublicListings()` que devuelve listings publicados (sin PII del owner).
  - Filtros: commodity, modalidad, país, ticket, área (ha).
  - Empty state honesto si no hay data.
2. **Mini-mapa embebido** (variante de HeroLiveMap en modo "listings" sólo, sin toggle) sincronizado con los filtros de la lista.
3. Drawer de detalle reutilizando `ListingDetailDrawer` con CTA "Solicitar acceso al data room" → crea registro en `contact_messages` con `source=listing:<id>`.
4. Conservar benefits + tickets institucionales como segunda sección (after-the-fold).
5. Deep-link `/inversionistas?listing=<id>` abre drawer al cargar.

### Frente 4 — Limpieza de rutas, botones y contacto

1. Eliminar sección "Contacto embebido" del landing y reemplazar por un CTA limpio que linkee a `/contacto` (single source of truth). Mantener un único formulario.
2. Resolver `hash="publicar"`: añadir sección `#publicar` real en `/proyectos` o cambiar CTA a `/contacto?intent=publicar`.
3. Footer: dejar sólo links que NO están en header (Recursos, Contacto, Legal). Quitar duplicados.
4. Botones "Sign in" / "Iniciar sesión" / "Solicitar acceso" → 2 acciones nombradas consistentemente: `Iniciar sesión` (login) y `Solicitar acceso` (signup institucional con form, no `/auth` directo).
5. Auditar todos los `<Link>` del landing y de `/inversionistas` con un test simple (`src/test/landing-links.test.ts`) que importe el `routeTree.gen.ts` y verifique que cada `to=` existe.
6. Actualizar `GEOCAPITALS.md` con la nueva arquitectura del shell + mapa de rutas + decisiones de diseño.

---

## 3. Detalles técnicos

- **AppShell**: TanStack `<Outlet/>` adentro; props `variant`, `topBar?`, `sidebar?`, `ticker?`, `head?`. No reescribe rutas, sólo envuelve el contenido del componente.
- **getPublicListings server fn**: `src/lib/publicListings.functions.ts`, sin auth, filtra `is_published=true`, devuelve campos seguros. Reusa supabaseAdmin dentro del handler.
- **Sync mapa↔lista**: estado en el padre `<InvestorsPage>` con `bounds` + `filters`; pasa a ambos hijos.
- **Drawer deep-link**: usar `useSearch()` de TanStack Router (`?listing=<uuid>`); validar con Zod.
- **Tests**: vitest, sólo el link-checker y un smoke de render del AppShell con cada variante.

## 4. Entregables por orden

1. PR/cambio 1: AppShell + tokens unificados + migración de Marketing/Terminal shells.
2. PR/cambio 2: HeroLiveMap rediseñado (split + panel + filtros + deep-link).
3. PR/cambio 3: `/inversionistas` deal-flow real (server fn + lista + mini-mapa + drawer).
4. PR/cambio 4: limpieza de contacto/footer/CTAs + link-checker + actualización `GEOCAPITALS.md`.

## 5. Fuera de alcance (explícito)

- Sin tocar `/dashboard/*` salvo envolverlo con `AppShell variant="workspace"` (sin rediseñar paneles internos).
- Sin cambios en RLS ni en edge functions existentes; las funciones nuevas son read-only.
- Sin cambios al sistema bilingüe ya activo (sólo se traducen strings nuevos).