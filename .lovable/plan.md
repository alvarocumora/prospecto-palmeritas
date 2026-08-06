# Ficha pública de oro + entorno de trade multiparte

## Estado real verificado

- Existen las funciones de base `get_trade_public_ficha`, `get_trade_public_price`, `get_trade_margin_split`, `get_trade_products`, `get_trade_negotiation`, `get_trade_access_links`, y las tablas `trade_pricing`, `trade_products`, `trade_commission_splits`.
- **No existe** la tabla `trade_access_links` (la función que la consulta quedó huérfana).
- **No existen** los archivos de la ficha pública: `src/routes/ficha.$token.tsx`, `src/lib/tradeFicha.functions.ts`, `src/features/trades/TradeMarginPanel.tsx`. Hay que crearlos.
- Los dos trades de oro (`AU-DORE-202607-CKG`, `AU-CONC-202607-CKG`) existen pero **sin productos, sin precios y sin tokens de contraparte**.
- El acceso externo hoy es sólo binario: `counterparty_buyer_token_hash` / `counterparty_seller_token_hash` en `commodity_trades`. No hay forma de sumar un tercer participante (otro bróker, abogado, inspector).

## Qué se construye

### 1. Ficha pública del trade de oro
- Ruta pública `/ficha/$token` (sin login) que llama a `get_trade_public_ficha`: commodity, referencia, productos/specs (pureza, presentación, origen, empaque) y **sólo precio de venta** — nunca precio base, margen ni reparto.
- Encabezado institucional (papel hueso / tinta / cobalto, serif), meta y OG dinámicos por commodity, `noindex`.
- Acciones: copiar enlace, compartir por WhatsApp, descargar ficha en PDF con QR de verificación, y enviar por correo (server fn interna).

### 2. Datos reales del trade de oro (Chile)
- Panel de staff para cargar y editar productos y precios del trade (`trade_products`, `trade_pricing`): unidad, precio base, precio de venta, moneda, cantidad por pedido, pool extra, frecuencia.
- Panel interno de margen y reparto (`get_trade_margin_split`) visible sólo para staff GeoCapitals: margen, distribuible, beneficiarios y remanente.

### 3. Entorno de trade tripartito + participantes adicionales
- Nueva tabla de participantes por operación con rol (`buyer`, `seller`, `geocapitals`, `broker`, `observer`, `advisor`), email, nombre, estado y token propio (hash + prefijo), con caducidad y revocación.
- Panel de staff "Accesos de la operación": invitar por correo, generar enlace seguro, copiar/reenviar, revocar y ver último acceso.
- La sala de contraparte (`/operacion/$token`) resuelve el token contra la nueva tabla (además de los dos campos legados) y muestra contenido según rol: documentos y checklist, hilo de negociación, productos y ficha. Broker/observer con vista de sólo lectura salvo mensajes.
- Bitácora de accesos por participante.

## Detalles técnicos

- Migración: tabla `trade_participants` (o `trade_access_links`, alineada con `get_trade_access_links`) con GRANTs, RLS (staff GC + partes del trade), índice único por `(trade_id, role, email)` y `updated_at` con trigger. RPC `issue_trade_access` / `revoke_trade_access` en SECURITY DEFINER para emitir hash SHA-256 sin exponer el token.
- Server fns nuevas en `src/lib/tradeFicha.functions.ts` (ficha pública, envío por correo) y extensión de `src/lib/tradeOps.functions.ts` para resolución de token multiparte.
- UI nueva: `src/routes/ficha.$token.tsx`, `src/features/trades/TradeMarginPanel.tsx`, `src/features/trades/TradePricingPanel.tsx`, `src/features/trades/TradeAccessLinksPanel.tsx`, integrados en `_authenticated.dashboard.trades_.$tradeId.tsx`.
- Sólo tokens semánticos del sistema Institutional Modernist.

## Verificación

Cargar precios y productos del trade de oro, emitir tres accesos (comprador, vendedor, bróker adicional), abrir la ficha pública en incógnito y comprobar que no aparece precio base ni margen, y que cada portal ve lo que le corresponde.
