
## Contexto

Hoy `MarketingLanding.tsx` (~1.158 líneas, 13 secciones) mezcla: hero, dos caminos, regiones, mapa live, simulador, tipos de proyectos, prospecto destacado, capacidades, módulos del terminal, testimonios, precios, FAQ y CTA. El usuario quiere una landing más corta y enfocada en el core de negocio: **proyectos de minería + trade de commodities + catastro con mapa live + fichas de commodities del marketplace**.

Además, en `geocapitals.com` se sigue viendo la versión antigua. La causa más probable es que el último build de frontend no fue publicado (los cambios de frontend requieren "Update" explícito en el diálogo de publicación). Se republica al final.

## Landing rediseñada (single page, 5 secciones)

```
┌────────────────────────────────────────────────────┐
│ 1. HERO compacto                                   │
│    Título + subtítulo + 2 CTAs (Ver proyectos /    │
│    Ver catastro live). KPIs live (proyectos,       │
│    concesiones, anomalías) en una fila.            │
├────────────────────────────────────────────────────┤
│ 2. PROYECTOS DE MINERÍA                            │
│    Grid de listings publicados (InvestableProjects │
│    ya existente) → drawer con ficha, valorización  │
│    y data room público.                            │
├────────────────────────────────────────────────────┤
│ 3. CATASTRO LIVE (mapa)                            │
│    HeroLiveMap a ancho completo con proyectos      │
│    georreferenciados + link a /catastro/proyecto.  │
├────────────────────────────────────────────────────┤
│ 4. COMMODITIES / MARKETPLACE                       │
│    Ticker + grid de fichas de lotes públicos       │
│    (Cu, Au, Ag, Li) con CTA "Ver marketplace".     │
├────────────────────────────────────────────────────┤
│ 5. CTA final + footer                              │
│    "Publica tu proyecto" / "Solicita acceso        │
│    inversionista".                                 │
└────────────────────────────────────────────────────┘
```

## Cambios de archivos

1. **`src/features/marketing/MarketingLanding.tsx`** — reescribir dejando solo las 5 secciones arriba. Se eliminan del render: región (L364), simulador (L510), tipos de proyectos (L645), prospecto destacado individual (L678), capacidades diferenciales (L732), módulos del terminal (L818), testimonios (L924), planes/precios (L1004) y FAQ. Se mantienen `MarketingHeader`, `HeroLiveMap`, `InvestableProjects`, `CommodityTicker` y `Reveal` (componentes ya existentes; no se tocan sus archivos).

2. **Nuevo componente `src/features/marketing/PublicCommodityLots.tsx`** — grid liviano que consume un `createServerFn` público (`getPublicCommodityLots`) para mostrar 6-8 lotes publicados/verificados (commodity, grade, tonnage, incoterm, precio referencia, país) con link a `/dashboard/commodity-lots`. Usa el mismo estilo `brand-light` de la landing.

3. **Nuevo `src/lib/marketing.functions.ts`** — server fn `getPublicCommodityLots` (SELECT de `commodity_lots` con política `TO anon` ya existente para lotes públicos; proyecta solo columnas seguras: commodity, grade, tonnage, incoterm_hint, country, reference_price, id). Sin PII de sellers.
   - Verificación previa: confirmar con `supabase--read_query` que `commodity_lots` tiene una policy `SELECT TO anon` sobre lotes con estado publicado; si no existe, agregarla en la misma migración limitada a columnas públicas (por RLS a nivel fila, no de columna: filtrar por `status = 'published' AND verified = true`).

4. **`src/routes/index.tsx`** — actualizar `head()` con título/description más comerciales:
   - `title`: "Geocapitals · Proyectos mineros, catastro live y trade de commodities"
   - `description`: "Marketplace de proyectos mineros con catastro georreferenciado y lotes de commodities verificados."

## Ruta principal / dominio viejo

- No es bug de código: `src/routes/index.tsx` ya monta `MarketingLanding`. Lo que ve el usuario en `geocapitals.com` es el último build publicado, que quedó desactualizado.
- Tras aplicar los cambios, **publicar** con `preview_ui--publish` para que `geocapitals.com` sirva la nueva landing. Antes de publicar, correr `security--get_scan_results` (regla del proyecto).

## Fuera de alcance

- Navegación de dashboard, INICIO logeado, autenticación, edge functions, otros módulos.
- Diseño tipográfico/paleta: se mantiene Institutional Modernist (`brand-light`, tokens semánticos).
- No se borran los componentes retirados del render (Simulator, Testimonials, PlatformPreview, etc.) — quedan en el repo por si se reutilizan; solo se dejan de renderizar en el landing.
