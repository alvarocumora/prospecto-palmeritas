# Auditoría + plan de consolidación (Palestra)

## Qué encontré

**152 rutas**, navegación central en `src/lib/workspace.ts` (cobertura buena: casi no hay rutas de dashboard fuera del menú). El problema no son huérfanas sueltas, sino **superficies duplicadas del mismo caso de uso** y **coherencia gráfica parcial**.

### 1. Cinco vitrinas para lo mismo (invertir en proyectos)

`/proyectos`, `/oportunidades`, `/dashboard/listings`, `/dashboard/deals`, `/dashboard/investments`, `/dashboard/opportunities`, `/dashboard/offerings`, `/dashboard/marketplace` — ~2.500 líneas resolviendo "ver proyecto → interesarme → entrar al data room". Ningún flujo cierra el ciclo completo (interés → NDA → data room → oferta → cierre).

### 2. Tres vitrinas de commodities

`/marketplace`, `/dashboard/commodity-lots`, `/dashboard/sourcing` + RFQ. El spine canónico de operación (`/dashboard/trades`, 2.168 líneas) sí es real y completo (checklist, screening, productos, negociación, márgenes, KYC, portales por token).

### 3. Rutas realmente huérfanas o débiles

`/terminal` + `/terminal/{market,capital-raise,tokenize}` (sin entrada de menú), `/panel` y `/panel/privacidad`, `/satelital`, `/empresas`, `/live/{palmeras,franco,tilama,losverdes}` (4 páginas casi idénticas hardcodeadas por proyecto), `/visor-3d`, `/proyectos/ficha/$slug` vs `/proyecto/$token` vs `/ficha/$token`.

### 4. Coherencia gráfica

Solo 29 archivos aplican `data-theme="im-light"`. El resto de los módulos de dashboard sigue en el tema oscuro antiguo, contra la regla permanente (homepage = Institutional Modernist).

---

## Plan en 5 fases

### Fase 1 — Un solo spine de inversión (dolor real: "quiero invertir y no sé cómo avanzar")

- **Canónico**: `/dashboard/deals` renombrado a **Deal Flow**, con vista de tarjetas + detalle en drawer (reusa `ListingDetailDrawer` + `ValuationPanel` ya construidos).
- Redirigir `listings`, `investments`, `opportunities`, `offerings`, `marketplace` (dashboard) → `deals` con tab (`?tab=mis-listings|ofertas|portafolio`).
- Público: `/proyectos` queda como única vitrina; `/oportunidades` redirige a `/proyectos`.
- **Función real nueva**: máquina de estados del deal — `interesado → NDA firmado → data room abierto → oferta (LOI) → due diligence → cierre`, con el estado visible para inversionista y dueño. Reusa firmas y watermark existentes.

### Fase 2 — Data room de verdad (no una lista de archivos)

- Un `DataRoom` por proyecto con: carpetas por categoría (técnico, legal, financiero, ESG), **gate por NDA firmado**, registro de accesos (quién vio qué y cuándo), watermark por visor y checklist de completitud tipo el de compliance de trades.
- Enlaces por token para inversionistas externos (mismo mecanismo de `trade_access_links`), revocables.
- Métricas para el dueño: "3 inversionistas vieron el informe geológico esta semana" — ese es el dolor real del lado vendedor.

### Fase 3 — Commodities: una vitrina, un spine

- `/marketplace` (público) y `/dashboard/commodity-lots` (interno) dejan de duplicar: lotes se administran en `commodity-lots` y se publican al marketplace con un switch.
- `RFQ → cotización → trade` como transición única: el botón "Convertir a operación" crea el `commodity_trade` con productos y participantes precargados.
- `/dashboard/trade-board` se absorbe como tab "Tablero" dentro de `/dashboard/trades`.

### Fase 4 — Limpieza de rutas huérfanas

- `/terminal/*`: o se cablean como tab de Capital, o redirigen a `/dashboard/deals`. (Sugiero redirigir; el valor está en Deal Flow.)
- `/live/{proyecto}`: colapsar en una ruta paramétrica `/live/$slug` alimentada por `projectFacts` (fuente única ya existente).
- `/panel`, `/satelital`, `/empresas`, `/visor-3d`: enlazar desde su flujo padre o redirigir.
- Fichas públicas: `/proyecto/$token` (data room por token) y `/ficha/$token` (trade) se conservan; `/proyectos/ficha/$slug` redirige.

### Fase 5 — Coherencia gráfica total

- Migrar módulo por módulo a Institutional Modernist envolviendo la raíz con `data-theme="im-light"` y sustituyendo colores señal (`signal-cyan`, `bg-panel`) por tokens semánticos.
- Orden: Deal Flow y Data Room → Trades → Catastro → módulos técnicos (los técnicos oscuros pueden quedar al final).

---

## Detalles técnicos

- Rutas eliminadas se conservan como `beforeLoad: () => { throw redirect(...) }` (patrón ya usado en `command-center`) para no romper URLs publicadas.
- Estado del deal: nueva tabla `deal_stages` con RLS por proyecto + GRANTs, y RPC `deal_advance(deal_id, stage)` con validación de transición.
- Accesos al data room: reusar el patrón de `trade_access_links` (token + revocación + auditoría) en vez de crear otro mecanismo.
- Toda función de servidor nueva pasa por `requireCapitalRole` / `requireTradeRole` de `src/lib/access/roleMiddleware.ts`.
- Sin nuevas dependencias.

## Orden sugerido de entrega

1 (spine inversión) → 2 (data room) → 5 parcial (coherencia de esas dos pantallas) → 3 (commodities) → 4 (limpieza) → 5 completo.
