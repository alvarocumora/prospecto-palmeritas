# Plan: Sourcing → LOI/NCNDA → Registro proveedor → Lote → **Centro de Operaciones de Trade**

Este plan **amplía** el anterior con un centro de operaciones tipo "war room" que une productor y cliente final, con paneles espejo, timeline compartido, archivos y firmas visibles, y updates por email en cada evento.

## Estado actual verificado

- **RFQ público con link tokenizado** `/proveedor/{token}` y bandeja `/dashboard/sourcing/{id}` con archivos, preselección y "Convertir en trade" ✅
- **Trades base:** `commodity_trades`, `trade_documents`, `trade_events`, `trade_shipments`, `trade_payments` ✅
- **Plantillas de documentos:** NDA, NDI, MoU, **LOI**, Term Sheet, SPA ya existen en `src/lib/documents/templates.ts` + generador PDF `src/lib/tradeDocGen.ts` (incluye LOI, ICPO, FCO, SPA)
- **Firmas:** `document_sign_requests` + `document_signatures` con trazabilidad al trade ✅
- **Huecos:** no hay NCNDA, ni registro abierto de proveedor, ni panel espejo cliente/proveedor, ni notificaciones por email en cada avance, ni conversión propuesta→lote publicable.

## Alcance ampliado

### A. LOI + NCNDA generados desde el RFQ o desde la propuesta

- Botón **"Generar LOI"** y **"Generar NCNDA"** en `/dashboard/sourcing/{id}` (por requerimiento y por propuesta preseleccionada).
- Handler `generateSourcingDocument({ requestId, submissionId?, kind: 'loi'|'ncnda' })`:
  - Precarga: comprador (perfil logeado, empresa, RUT), proveedor/intermediario (datos de la submission), commodity, forma, tonelaje, precio ofertado/objetivo, incoterm, destino, validez 15 días.
  - Genera PDF descargable + guarda en `document_drafts` para reeditar y disparar firma.
- Nueva plantilla **NCNDA** en `src/lib/documents/templates.ts` (Non-Circumvention Non-Disclosure) con los campos que aparecen en el email de HQM Chile (Razón Social, RUT, giro, dirección, representante legal, correo, teléfono, destino del material, y si es intermediario los mismos datos de su contraparte).

### B. Registro abierto de proveedor + primer lote

- Ruta pública `/registro/proveedor` en dos pasos (Institutional Modernist):
  1. Empresa/mina + contacto (país, RUT, giro, representante legal, email, WhatsApp).
  2. Primer lote (commodity, forma, ley, tonelaje, incoterm, puerto, precio objetivo, notas) + upload de docs (assay, títulos, fotos).
- Server fn `registerSupplierAndLot`: magic-link, crea `commodity_lots` en `pending_verification`, notifica a `team@geocapitals.com`.
- Página final: "Lote en revisión" + link para completar cuenta.

### C. Propuesta → Lote publicable

- Botón **"Guardar como lote"** en cada propuesta de sourcing.
- Server fn `convertSubmissionToLot({ submissionId })`: crea `commodity_lots` (a nombre del proveedor prospecto), copia los archivos entre buckets con `supabaseAdmin.storage.copy` dentro del handler.

### D. **Centro de Operaciones de Trade** (nuevo — corazón del plan)

Panel unificado que une **productor**, **cliente final** e **intermediario (yo)** alrededor de un mismo `commodity_trade`.

**Estructura visual** (Institutional Modernist, papel/tinta/cobalto):

```
┌──────────────────────────────────────────────────────────┐
│ TRADE #GC-2026-001 · Antimony Ingot 99.85% · 20 t · CIF  │
│ [Vendedor · Productor]  ⇆  [Comprador · Cliente final]   │
│ Estado: LOI firmado → SPA pendiente         [Progreso 3/8]│
├──────────────┬───────────────┬───────────────┬───────────┤
│ TIMELINE     │ DOCUMENTOS    │ ARCHIVOS TÉC. │ ENTREGA   │
│ (feed vivo)  │ + firmas      │ (assay,SGS…)  │ + pagos   │
└──────────────┴───────────────┴───────────────┴───────────┘
```

**Ruta autenticada:** `/dashboard/trades/{tradeId}` (existente) se enriquece con:
- Cabecera con las dos partes, estado y semáforo de fase (**Intención → NCNDA → LOI → SCO → SPA → Embarque → Pago → Cierre**).
- **Timeline** leyendo `trade_events` con ícono por tipo (documento, archivo, firma, pago, mensaje, embarque).
- **Documentos**: tarjetas por documento con estado firmado/pendiente, botón "Solicitar firma", visor PDF, historial de versiones.
- **Archivos técnicos**: los del proveedor + los que suba el comprador (LOI, POF, LC draft, BL, etc.) — todos en el bucket del trade, con signed URL, listados con quién los subió y cuándo.
- **Entrega**: pestaña con `trade_shipments` (ETD/ETA, puerto de carga, contenedores, BL) y `trade_payments` (LC/TT, milestones).
- **Chat/notas**: usa `trade_events` como registro auditado — cada mensaje queda en el feed.

**Paneles espejo para las contrapartes** (sin cuenta full):
- **Proveedor y cliente** reciben un link tokenizado `/operacion/{token}` (público, one-time refresh) con **exactamente la misma información** filtrada a su rol (el proveedor no ve el margen del intermediario ni los datos del otro comprador; el cliente no ve el costo del origen).
- Server fns nuevas:
  - `generateTradePartyLink({ tradeId, party: 'seller'|'buyer' })` → token en `commodity_trades.counterparty_seller_token` / `_buyer_token` (columnas nuevas — cero cambios de esquema mayores, solo `alter table add column`).
  - `getTradeByPartyToken({ token })` → devuelve solo los campos visibles para ese rol.
- Ruta pública `/operacion/{token}` con la misma estructura de 4 secciones (timeline, documentos, archivos, entrega/pagos) en modo lectura + botones para "Subir archivo" y "Firmar documento" (usa `document_sign_requests` sin exigir cuenta, con verificación por email OTP corto).

### E. Notificaciones por email en cada evento

Reutiliza el sistema `sendTransactionalEmail` (`src/lib/email/send.ts`) y crea plantillas nuevas en `src/lib/email-templates/`:

- `trade-created` → a proveedor y cliente cuando arranca el trade.
- `trade-document-shared` → cuando el intermediario publica LOI/NCNDA/SPA.
- `trade-signature-requested` → al firmante con link de firma.
- `trade-signature-completed` → a todas las partes cuando se firma.
- `trade-file-uploaded` → cuando la contraparte sube un assay/POF/BL.
- `trade-shipment-updated` → al cambiar ETA/BL.
- `trade-payment-milestone` → al registrar pago o milestone.

Cada email lleva link directo a `/operacion/{token}` (proveedor/cliente) o `/dashboard/trades/{tradeId}` (intermediario). Todas las plantillas siguen la identidad Institutional Modernist ya establecida.

Cada evento también se escribe a `trade_events` para que aparezca en el timeline en tiempo real (polling cada 30 s + `refetchInterval`).

## Cambios de esquema mínimos

Una sola migración pequeña, respetando las reglas de RLS + GRANTs:

- `commodity_trades`: add `counterparty_seller_token text unique`, `counterparty_buyer_token text unique`, `counterparty_seller_email text`, `counterparty_buyer_email text`.
- Bucket `trade-files` (si no existe) con RLS por trade_id.
- Sin tablas nuevas: `trade_documents`, `trade_events`, `trade_shipments`, `trade_payments` ya existen.

## Entrega en orden

1. NCNDA (plantilla + PDF) y "Generar LOI/NCNDA" desde el sourcing.
2. Registro abierto de proveedor + primer lote.
3. Propuesta → lote publicable; lote → iniciar trade.
4. **Centro de Operaciones**: cabecera + timeline enriquecido + tabs documentos/archivos/entrega/pagos en `/dashboard/trades/{tradeId}`.
5. Panel espejo `/operacion/{token}` para proveedor y cliente (lectura + subir/firmar).
6. Emails por evento (7 plantillas nuevas) y trigger en cada server fn relevante.
7. Prueba manual end-to-end usando el caso Aupal Antimony (Sb 99.85%, 20 t, CIF Florida) como escenario de referencia.

## Restricciones

- No tocar navegación ni INICIO.
- Solo tokens semánticos (papel/tinta/cobalto), nada de hex hardcodeados.
- No modificar archivos auto-generados de Supabase.
- Cada nueva tabla o columna en `public` lleva GRANT + RLS en la misma migración.
