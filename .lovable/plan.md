## Objetivo

Un único flujo de operaciones ("Trades") alcanzable desde el menú, con checklist de compliance conectado a los RPC del repo y gate de readiness. Landing sin links rotos, rutas duplicadas/huérfanas redirigidas o enlazadas. Solo cambios en `/src` (más aplicar 3 migraciones ya mergeadas, sin reescribirlas).

## 0. Migraciones (verificado: no aplicadas en la base)

Los RPC/tabla del checklist no existen aún en el proyecto Supabase (`trade_documents_checklist`, `trade_documents_readiness`, `operation_document_structure` → `null`). Aplicar en orden, tal cual están en el repo:

1. `20260724040000_tenencia_geom_consolidation.sql`
2. `20260725210000_operation_document_checklist.sql` (catálogo REICON + tabla `operation_document_structure`)
3. `20260725220000_trade_documents_checklist.sql` (RPC sobre `commodity_trades` / `trade_documents`)

## 1. Reachability del menú + rutas huérfanas

En `src/routes/_authenticated.tsx` (grupo NEGOCIO):
- Renombrar la entrada `/dashboard/trades` a **"Mesa de operaciones"** (mantener icono Handshake) y dejarla como entrada principal. La entrada `Tablero de trades` se mantiene como vista Kanban.
- Quitar del rail entradas huérfanas del sistema "Operaciones" viejo (no estaban listadas, pero mantenerlas fuera).

Rutas duplicadas/huérfanas — reemplazar el archivo por una redirección declarativa (`beforeLoad: () => redirect(...)`) al equivalente en Trades:

| Ruta actual | Acción |
|---|---|
| `/dashboard/operaciones` (index) | redirect → `/dashboard/trades` |
| `/dashboard/operaciones/nuevo` | redirect → `/dashboard/trades` (con hint `?new=1`) |
| `/dashboard/operaciones/$id` | redirect → `/dashboard/trades/$tradeId` usando el mismo id (deprecado, un aviso corto arriba del detalle si el id no existe en trades) |
| `/portal/buyer/$token`, `/portal/seller/$token` | redirect → `/operacion/$token` (War Room canónica) |

Rutas huérfanas del sistema Proveedores/RFQ — enlazar desde el detalle del trade en lugar de dejarlas colgadas:
- `/dashboard/proveedores` (+ `$id`, `/dashboard/proveedor`): enlazadas desde el panel "Contraparte" del detalle de trade (botón "Ver proveedor").
- `/dashboard/rfqs` (+ `$id`, `nuevo`): enlazadas desde el detalle de trade en el panel "Requerimiento origen".
- `/dashboard/enlaces`, `/dashboard/invitaciones`, `/dashboard/fletes`: dejar como sub-vistas de admin — añadir un pequeño índice "Herramientas" al pie del rail (grupo CUENTA), no como items sueltos.

## 2. Panel Compliance (nuevo)

Componente reusable `src/features/trades/TradeComplianceChecklist.tsx`:
- Carga `supabase.rpc('trade_documents_checklist', { p_trade_id })` y `trade_documents_readiness`.
- Agrupa por `section` ordenado por `section_no`, cada fila ordenada por `sequence`.
- Cada ítem: título + descripción + badge de `status` (falta / subido / aprobado / observado / firmado), pill `obligation` (mandatory vs if_available vs conditional con tooltip de `condition`), autor esperado (`required_from_role`).
- Barra superior: `mandatory_ok / mandatory_total` + estado `ready`.
- Botón "Subir" por fila: abre input y llama a `attachOperacionDoc({ docType: item.doc_kind, ... })` — el `doc_kind` del catálogo es el `docType` (no editable). Refresca ambos RPC al terminar.
- Suscripción realtime a `trade_documents` filtrada por `trade_id` para refrescar el checklist sin recargar.

Integración:
- `src/routes/_authenticated.dashboard.trades_.$tradeId.tsx` → añadir el panel en el layout del detalle. El botón "Pasar a evaluación comercial" se **deshabilita** mientras `ready === false`, con tooltip "Faltan N documentos obligatorios".
- `src/routes/operacion.$token.tsx` (War Room pública) → mismo panel en modo restringido: solo muestra ítems visibles a la contraparte y los `Subir` respetan el token (`attachOperacionDoc` ya soporta upload por token; se pasa `docType = doc_kind`).

## 3. Navegación cruzada desde el detalle del trade

Nuevo panel lateral "Enlaces de la operación" en `_authenticated.dashboard.trades_.$tradeId.tsx`:
- Contraparte: link a `/dashboard/proveedores/$id` (si `business_partner_id`), botón "Invitar proveedor" → `/inscripcion?trade=$tradeId`.
- Requerimiento origen: link a `/dashboard/rfqs/$id` si existe `rfq_id` en el trade (si no existe la columna, botón "Crear RFQ" → `/dashboard/rfqs/nuevo?trade=$tradeId`).
- War Room de contraparte: botón "Abrir War Room" que ejecuta `ensureCounterpartyLink` y copia el URL de `operacionUrl(token)`.

## 4. Landing y menú público

- `src/features/marketing/MarketingLanding.tsx:309` → cambiar `to="/dashboard/commodity-lots"` por `to="/marketplace"`.
- `src/components/shell/AppShell.tsx` (`NAV`) → añadir `{ to: "/inscripcion", key: "nav_supplier_signup" }` y `{ to: "/rfqs", key: "nav_rfqs" }`. Registrar las dos llaves en `src/features/marketing/i18n.ts` (es/en).

## 5. Verificación

- Después de aplicar migraciones: `SELECT proname FROM pg_proc WHERE proname IN ('trade_documents_checklist','trade_documents_readiness')` debe devolver 2 filas y `to_regclass('public.operation_document_structure')` no nulo.
- Abrir un trade de copper existente: el checklist debe mostrar las 40 filas REICON, estado inicial "falta", `ready=false`, y el botón "Pasar a evaluación comercial" deshabilitado.
- Subir un documento por el panel: la fila cambia a "subido/aprobado" y `mandatory_ok` incrementa sin recargar.

## Fuera de alcance

No se toca `supabase/migrations/*` (solo se aplican), ni `etl/`, `packages/reglas/`, `tests/`, `docs/`. No se agregan tablas ni RPC nuevos. No se elimina el sistema "Operaciones" del backend, solo se redirigen sus rutas de UI.
