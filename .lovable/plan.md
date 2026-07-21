# Trade Board dinámico + modo pantalla completa

## Estado actual

- `/dashboard/trade-board` renderiza columnas por etapa (`buildTradeBoard`) con tarjetas 100% estáticas: solo enlace al detalle.
- Sin drag & drop, sin filtros, sin realtime, sin acciones desde la tarjeta.
- `setTradeStage` ya existe en `src/lib/trades.functions.ts` (cubre `icpo | fco | spa | payment | shipping | delivered | closed`) → sirve para persistir cambios de columna.
- `commodity_trades` tiene RLS por usuario; se puede suscribir por realtime desde el cliente (verificar publicación `supabase_realtime`; si falta la tabla, se añade en migración).

## Alcance

Un solo entregable que resuelve las cuatro necesidades marcadas + el modo fullscreen.

### 1. Drag & drop entre columnas

- Añadir `@dnd-kit/core` + `@dnd-kit/sortable` (ligero, mantenido, sin dependencias nativas).
- Cada `BoardCard` es `useDraggable`; cada columna es `useDroppable`.
- On drop:
  - Optimistic update en la cache de React Query (`["my-trades"]`): mover la tarjeta y recalcular totales.
  - Llamar `setTradeStage({ id, stage })` vía `useMutation`.
  - En error: revertir + toast institucional.
  - En éxito: `queryClient.invalidateQueries({ queryKey: ["my-trades"] })` + registro visible (badge "actualizado hace Ns").
- Restricción: solo el owner (buyer/seller) puede mover; `desk` sí; tarjetas en `cancelled` no son arrastrables.
- Feedback visual: columna destino resaltada (cobalto tenue), tarjeta con sombra al agarrar, cursor `grab/grabbing`.

### 2. Filtros y búsqueda

Barra superior sticky con estado en URL (`Route.validateSearch` + `useNavigate`):
- Búsqueda por texto: `reference`, `counterparty`, `commodity`.
- Chips: `role` (compra/venta/desk), `commodity` (derivado de trades cargados), rango de valor USD (min/max).
- Botón "Limpiar filtros" y contador de resultados por columna se recalcula con lo filtrado (los totales de la columna también).

### 3. Realtime / auto-refresh

- `useEffect` en el componente: `supabase.channel('trade-board').on('postgres_changes', { schema: 'public', table: 'commodity_trades' }, …).subscribe()`.
- Al recibir evento: `queryClient.invalidateQueries(["my-trades"])`.
- Igual para `trade_documents` (avance documental de la barra inferior de la tarjeta).
- Cleanup en unmount con `supabase.removeChannel`.
- Si las tablas no están en la publicación `supabase_realtime`, migración corta para agregarlas (`ALTER PUBLICATION supabase_realtime ADD TABLE …`).

### 4. Acciones rápidas en la tarjeta

Menú `...` (Popover shadcn) sobre cada tarjeta, sin salir del board:
- Avanzar / retroceder etapa (usa mismo `setTradeStage`).
- Marcar cerrado (`closed`) o cancelar (`status = cancelled` → nueva variante en `setTradeStage` o mutation dedicada).
- Abrir detalle en drawer lateral (reutiliza contenido de `_authenticated.dashboard.trades_.$tradeId`) sin perder el board.
- Copiar referencia y abrir War Room público (`/operacion/$token`) si existe.

### 5. Modo pantalla completa

- Botón "Pantalla completa" en el header del board.
- Toggle `?full=1` en la URL: oculta sidebar del dashboard (envolver contenido con clase que fuerce `max-w` amplio y `h-screen`), header institucional colapsado a una barra fina con KPIs + filtros.
- Swimlanes opcionales: switch "Agrupar por rol" que renderiza dos filas horizontales (compras / ventas) manteniendo las mismas columnas.
- Scroll vertical dentro de cada columna con `max-h` calculado desde `100dvh`.
- `Esc` sale del modo fullscreen (limpia `full` del search).

## Detalles técnicos

- Archivos nuevos:
  - `src/features/trade-board/TradeBoardView.tsx` (UI principal reutilizable en fullscreen y normal).
  - `src/features/trade-board/TradeCard.tsx`, `TradeColumn.tsx`, `TradeFilters.tsx`, `TradeCardActions.tsx`.
  - `src/features/trade-board/useTradeBoardRealtime.ts`.
- Archivos modificados:
  - `src/routes/_authenticated.dashboard.trade-board.tsx`: agrega `validateSearch` (q, role, commodity, min, max, full, group), monta `TradeBoardView`.
  - `src/lib/trades.functions.ts`: extender `setTradeStage` para aceptar `status: "cancelled" | "active" | "closed"` opcional (o añadir `cancelTrade` / `reopenTrade`).
  - `src/lib/tradeBoard.ts`: exponer helper `filterTrades(trades, filters)` puro para reutilizar en el view y mantener totales coherentes.
- Migración (si aplica):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.commodity_trades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_documents;
```

- Diseño: Institutional Modernist. Solo tokens `surface/content/hairline/accent-brand`, tipografía serif para títulos, mono para KPIs/etiquetas de etapa. Nada de hex hardcodeados.
- Sin cambios al detalle del trade en esta iteración (más allá de reutilizarlo dentro del drawer).

## Fuera de alcance

- Reordenar tarjetas dentro de una columna (prioridad manual): se puede añadir después con un campo `board_order`.
- Colaboración multi-usuario con cursores.
- Exportar el board a PDF/CSV.

## Validación

- `bun typecheck` limpio.
- Playwright headless: cargar `/dashboard/trade-board`, arrastrar una tarjeta, verificar que la columna origen decrementa y la destino incrementa, y que tras recarga el cambio persiste.
- Comprobar realtime abriendo dos sesiones simultáneas (segunda ventana refleja el cambio sin recargar).
