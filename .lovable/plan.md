
# Plan: Tablero Trade v2 + Fichas Commodities enriquecidas

Aplicamos todas las mejoras seleccionadas. Trabajo se divide en cuatro entregables independientes que comparten una capa de datos común (`commodity_prices`, `freight_rates`, `market_comparables` ya existentes).

## 1. Tablero de Trades — mejoras UX

**Columnas configurables + WIP limits**
- Nueva tabla `trade_board_prefs` (por usuario): `hidden_stages[]`, `wip_limits jsonb`, `column_order[]`.
- Popover "Configurar tablero" en `TradeBoardView` para ocultar/mostrar etapas, reordenar (drag) y fijar WIP por columna.
- Banner rojo cuando una columna excede su WIP; bloqueo suave del drop (toast de aviso, no impide).

**KPIs avanzados + aging**
- Extender `boardSummary` con: días promedio por etapa, trades "stuck" (>N días sin evento en `trade_events`), forecast ponderado (Σ valor × probabilidad por etapa: ICPO 10%, LOI 25%, FCO 50%, SPA 70%, SBLC 85%, Embarque 95%, Closed 100%).
- `TradeCard` muestra badge de días en etapa; color rojo si supera SLA.
- Fila KPI extendida: Aging medio, Forecast ponderado, Stuck count.

**Vista Timeline/Gantt**
- Toggle `view=kanban|timeline` en el search param.
- `TradeTimelineView`: filas = trades, columnas = etapas del pipeline, marcador sobre la etapa actual + barra de progreso hasta cerrado; hover muestra fechas de eventos (`trade_events`).

**Bulk actions + export**
- Modo selección múltiple (checkbox en `TradeCard`).
- Acciones batch: cambiar etapa, asignar responsable, exportar filtrados a CSV/XLSX (usando `xlsx` ya presente o `sheetjs`).

## 2. Ficha de commodity — enriquecimiento

Se aplica a `SupplierSheetPdf` (server-side) y a un nuevo panel `CommodityIntelPanel` mostrado en el detalle del trade y en la ficha web (`/lot/$id`).

**Precio live + histórico**
- Panel superior con: último precio, variación 24h/7d/30d, sparkline 30/90d.
- Datos leídos de `commodity_prices` (ver §3).

**Calculadora flete CIF/FOB**
- Selector origen (puerto Chile: San Antonio, Valparaíso, Mejillones, Iquique) → destino (Shanghai, Rotterdam, Los Angeles, Busan, Antwerp, Hamburg).
- Muestra USD/MT, tránsito estimado, fuente y fecha; permite override manual.
- Cálculo final: FOB = precio × qty; CIF = FOB + flete + seguro (0.15% default).

**Comparables de mercado**
- Consulta `market_comparables` filtrando por commodity/grade y últimos 180d.
- Tabla compacta: fecha, ley, precio, incoterm, región (contraparte anonimizada).

**Escenarios de margen**
- Mini simulador: sliders de precio (±15%), flete (±30%), ley (±10%).
- Salida: margen bruto USD, margen %, NPV rápido (single-period a 30d con costo capital 8%).

Los cuatro bloques se serializan también al PDF (nuevas secciones "Market intel", "Logística", "Comparables", "Sensibilidad") manteniendo la matriz institucional (`renderGeocapitalsPdf`).

## 3. Fuente de precios (híbrida en cascada)

Se implementa la cascada completa; cada fuente rellena `commodity_prices` con `source` distinto y el consumidor prioriza la más fresca disponible.

1. **LME oficial (Metals-API / Metalpriceapi)** para Cu, Zn, Pb, Ni, Sn, Al, Sb.
   - Requiere secret `METALS_API_KEY`.
   - Cron horario (`pg_cron` → `/api/public/hooks/prices-lme`).
2. **Yahoo Finance** (sin key, delay 15min) como fallback y para futuros COMEX (HG=F, SI=F, GC=F).
   - Cron cada 30 min → `/api/public/hooks/prices-yahoo`.
3. **SHFE + Fastmarkets scraping** para REE, antimonio, tierras raras.
   - Job diario, tolerante a fallos, marca `source='shfe'|'fastmarkets'` con timestamp.
4. **Manual + CSV semanal** — página `/dashboard/precios` con upload CSV (columnas: commodity, grade, price_usd, currency, date, source) e histórico editable.

Tabla `commodity_prices` ya existe (9 col). Añadir índice compuesto `(commodity, price_date DESC)` si falta.

Vista `v_commodity_price_latest` que devuelve el mejor precio por commodity aplicando prioridad: manual > LME > SHFE > Yahoo, cayendo hacia el siguiente si el más reciente supera 72h.

## 4. Flete — tabla estática por ruta

Nueva tabla `freight_rates`:
```
port_origin text, port_destination text, container_type text ('20ft'|'40ft'|'bulk_mt'),
usd_rate numeric, transit_days int, valid_from date, source text, notes text
```
Seed inicial con rutas Chile → CN/EU/US/KR (San Antonio→Shanghai, Valparaíso→Rotterdam, Mejillones→Busan, Iquique→Los Angeles, etc.) usando referencias públicas Drewry/Freightos H1 2026 (editable después).

Función `getFreightQuote(origin, destination, mode)` en `src/lib/freight.ts`. Página `/dashboard/fletes` para editar tarifas (rol admin/broker).

## Detalles técnicos

- **Nuevas tablas**: `trade_board_prefs`, `freight_rates`. Ambas con GRANTs + RLS por usuario/organización.
- **Nuevas server functions** (`src/lib/`): `boardPrefs.functions.ts`, `commodityIntel.functions.ts`, `freight.functions.ts`, `prices.functions.ts`.
- **Nuevas rutas públicas** (cron endpoints): `src/routes/api/public/hooks/prices-lme.ts`, `.../prices-yahoo.ts`, `.../prices-shfe.ts`, todas con `apikey` header check.
- **Nuevas rutas UI**:
  - `_authenticated/dashboard/precios.tsx` (CSV upload + tabla)
  - `_authenticated/dashboard/fletes.tsx` (editor rutas)
- **Componentes nuevos**:
  - `TradeBoardConfig.tsx` (popover columnas/WIP)
  - `TradeTimelineView.tsx`
  - `TradeBulkBar.tsx`
  - `CommodityIntelPanel.tsx` (con sub-componentes: `PriceStrip`, `FreightCalc`, `ComparablesTable`, `MarginSim`)
- **Secretos requeridos**: `METALS_API_KEY` (se solicitará vía `add_secret` cuando lleguemos al paso 3.1).
- Diseño Institutional Modernist en todo (tokens `surface/content/hairline/accent-brand`, serif display en headers, `data-theme="im-light"`).

## Orden de implementación

1. Migraciones (`trade_board_prefs`, `freight_rates`, índice precios, vista `v_commodity_price_latest`) + seed rutas.
2. Panel `CommodityIntelPanel` (usa datos existentes de `commodity_prices` y `market_comparables`).
3. Mejoras tablero (config, KPIs+aging, timeline, bulk/export).
4. Ingesta precios (LME → Yahoo → SHFE → manual) + página `/dashboard/precios` y `/dashboard/fletes`.
5. Integración de intel al PDF de fichas.
6. QA visual (Playwright: kanban, timeline, ficha con panel intel, PDF renderizado).

## Fuera de alcance

- Flete API live (Searates/Freightos) — se deja `getFreightQuote` extensible pero sin proveedor externo.
- Comparables anonimizados con firma criptográfica — se usan los datos ya cargados en `market_comparables`.
