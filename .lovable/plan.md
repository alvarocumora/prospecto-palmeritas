# Estado real del Trade Desk y plan de mejoras con IA

## 1. Estado real (verificado en código y BD)

**Datos vivos** (`commodity_trades`): 11 trades — 10 `active`, 1 `cancelled`. Solo 3 tienen `quantity_t` (Cu 2.000, Sb 1.500, Sb 20 cancelado). Los 8 restantes de Carpio/Kaddu Group están en `inquiry` sin cantidad.

**Cobertura del flujo (lo que ya existe):**

| Capa | Módulo | Archivo | Estado |
|---|---|---|---|
| Trades core | listar / crear / detalle / stage | `src/lib/trades.functions.ts` (602 L), rutas `_authenticated.dashboard.trades*` | ✅ |
| Kanban | tablero por stage | `src/lib/tradeBoard.ts` + `trade-board.tsx` | ✅ |
| Document Pack | LOI/NCNDA/ICPO/SPA + versionado + firma | `src/lib/tradePack.functions.ts`, `src/features/trades/TradePackPanel.tsx` | ✅ |
| War Room externo | `/operacion/$token`, uploads counterparty | `src/lib/tradeOps.functions.ts` | ✅ |
| Shipments | crear/avanzar hitos | `src/lib/shipments.functions.ts` | ✅ básico |
| Payments | milestones, reminders, dunning | `payments.functions.ts`, `dunning.functions.ts`, `receivables.functions.ts`, `cobranza.tsx` | ✅ |
| Commissions | brokers | `commissions.functions.ts` | ✅ |
| Tracking | timeline unificado | `tradeTracking.functions.ts` + `tradeTimeline.ts` | ✅ |
| Price index | referencia commodities | `priceIndex.functions.ts` | ⚠️ solo lectura |
| Deal Agent AI | draft de "next action" email | `dealAgent.functions.ts` (**único uso de IA en trade**) | ⚠️ mínimo |

**Brechas concretas:**
1. **IA casi ausente** — solo el redactor de correo "next action". No hay clasificador de contrapartes, resumen de documentos subidos por proveedor, validación de LOI/SPA, ni Q&A sobre el trade.
2. **Precios estáticos** — `priceIndex` no se conecta a fuente real (LME/Kitco/Metals-API). Los términos LME −5% para Cu no se recalculan automáticamente.
3. **Sin KYC/AML** — contrapartes se registran sin chequeo de sanciones (OFAC/EU/UN) ni verificación LEI/GLEIF.
4. **Documentos subidos por proveedor sin parseo** — `attachOperacionDoc` guarda el archivo; nadie extrae assays, certificados de origen, o BLs.
5. **Shipments desconectados de tracking real** — no hay integración con carriers (MSC/Maersk/Track-trace) ni AIS marítimo.
6. **8 trades sin `quantity_t`** — bloquean valorización, dunning y export a Pack.
7. **Sin OCR/parse de facturas comerciales, packing lists, CoA** — todo se re-tipea a mano.
8. **Reputación de contraparte** existe (`counterpartyReputation.functions.ts`) pero no se muestra en el detalle del trade.

## 2. Roadmap propuesto (3 sprints, todos con IA embebida)

### Sprint 1 — "Trade Intelligence Layer" (P0, 1 semana)

**Objetivo:** convertir Deal Agent en un copiloto real por trade.

- **Trade Copilot** (server fn nueva, Gemini 3 Flash vía Lovable AI):
  - Resume el trade en 1 párrafo con evidencia (docs firmados, pagos, hitos).
  - Sugiere next action con contexto (no solo template).
  - Panel `<TradeCopilotPanel/>` en `trades_.$tradeId.tsx` a la derecha, colapsable.
- **Document Intel** — al subir docs por War Room o admin:
  - OCR + extracción estructurada (assays CoA → ley, Hg, As; BL → puerto/ETA; factura → montos) con Gemini multimodal.
  - Auto-rellena `trade_shipments` y `trade_payments` como *sugerencias* (nunca escribe sin aprobar).
- **Backfill 8 trades sin `quantity_t`** con un panel "Completar términos" que use IA para pre-poblar desde el LOI del pack más reciente.

### Sprint 2 — "Verificación externa" (P0, 1 semana)

- **KYC/AML automático** en `partner_invitations` y al crear counterparty:
  - Consulta OFAC SDN + EU consolidated + UN sanctions (fuentes abiertas, sin API pagada — datasets JSON diarios).
  - Búsqueda LEI en **GLEIF API** (gratuita) para validar razón social.
  - Bloquea `setTradeStage → binding` si hay hit.
- **Precios en vivo**:
  - `priceIndex.functions.ts` consulta **Metals-API** (o LME delayed via yahoo-finance2) con cache pg de 15 min.
  - Muestra en el header del trade: "LME Cu hoy US$ 9.4XX → precio actual del trade US$ Y".
- **Reputación visible** — mover `counterpartyReputation` al header del trade.

### Sprint 3 — "Logística real + Legal AI" (P1, 1.5 semanas)

- **Tracking marítimo**:
  - Integración **searates.com / Vizion API** (o `terminal49` opcional) para BLs.
  - Fallback: AIS público (`aisstream.io` gratis) por IMO del buque.
  - Nuevo panel `<ShipmentTrackerPanel/>` con mapa MapLibre y ETA recalculada.
- **Legal AI review** del SPA:
  - Al generar v2+ del pack, IA compara contra v1 y marca cambios materiales (precio, Incoterm, arbitraje, force majeure).
  - Checklist de cláusulas mínimas para SPA de commodities (ICC 2020, arbitraje LCIA/CIETAC según destino).
- **Q&A sobre el trade** — chat con RAG sobre docs firmados + eventos + shipments + pagos del trade (aislado por RLS).

## 3. Repos útiles a integrar

Todos son OSS y compatibles con TanStack/Cloudflare Workers salvo notas.

| Necesidad | Repo | Uso |
|---|---|---|
| Sanciones OFAC/EU/UN | `walletlabs/sanctions-lists` (JSON diario) + `opensanctions/opensanctions` | Descargar en cron, matching fuzzy con `fuzzysort` |
| LEI validation | GLEIF API `api.gleif.org/api/v1/lei-records` (no repo, pero cliente HTTP simple) | Verificar razón social |
| Precios metales | `qcoreseb/metals-api-client` o `gadicc/yahoo-finance2` | Cache en `commodity_prices` |
| OCR CoA/BL | Gemini 3 Flash multimodal (ya disponible en Lovable AI) + `unpdf` para PDF→text | En `attachOperacionDoc` |
| Tracking marítimo | `vizion-api/vizion-node` o consumir REST directo | Solo servidor |
| AIS público | `aisstream/aisstream-node-example` | Fallback gratuito |
| Firma cláusulas SPA | `bespoken-io/legal-templates` (referencia) | Base de checklists |
| RAG sobre docs trade | `supabase/vecs` con `pgvector` (ya instalado) + `ai` SDK `embedMany` | Ya tienes `ai_document_embeddings` |
| PDF diff (versionado pack) | `pdf-lib` (ya instalado) + `diff` de jsdiff | Comparar v1 vs v2 |
| Iconos flujo | `xyflow/react` (React Flow) | Para el mapa visual del pipeline en `trade-board` |
| Charts precios | `recharts` (ya instalado) | Curva LME vs precio del trade |

## 4. Detalles técnicos

- **IA**: modelo por defecto `google/gemini-3-flash-preview` vía `src/lib/ai-gateway.server.ts` (ya existe). Para Q&A largo con historial usar `gemini-2.5-pro`.
- **RLS**: nuevas tablas (`sanctions_hits`, `shipment_tracking_events`) siempre con `GRANT` a `authenticated` + policy por `commodity_trades.user_id`.
- **Cron**: usar `pg_cron` existente para refrescar precios (cada 15 min) y sanciones (diario 03:00 UTC).
- **UI**: todo en `data-theme="im-light"` (Institutional Modernist). Copiloto = card papel hueso con acento cobalto, no chat oscuro.
- **Sin nuevos secretos** si usamos Lovable AI + fuentes gratuitas. Metals-API/Vizion requerirían secret nuevo → confirmar antes.

## 5. Fuera de alcance de este plan

- Tokenización on-chain de trades (mencionado en Terminal pero es otro track).
- Migrar Kanban a React Flow (nice-to-have, no bloqueante).
- Reemplazar `pdf-lib` por servicio externo.

## 6. Orden de ejecución sugerido

1. **Sprint 1** (Copilot + Document Intel + backfill) — máximo impacto visible.
2. **Sprint 2** (KYC + precios en vivo) — desbloquea compliance para clientes institucionales.
3. **Sprint 3** (Tracking + Legal AI) — cierra ciclo hasta entrega y pago.

¿Arrancamos por Sprint 1 completo, o quieres priorizar solo Trade Copilot + backfill de los 8 trades sin cantidad para mostrar valor inmediato?
