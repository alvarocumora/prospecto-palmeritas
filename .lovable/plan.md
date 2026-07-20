# Trade Desk — Antimonio Sb Grade 2#

Objetivo: convertir el NCNDA firmado (Carpio & Kaddu ↔ Cliente) en una operación real en Trade Desk, sin que necesites que la contraparte tenga cuenta, y con un canal para que el proveedor cargue certificados, fotos y BLs.

## 1) Botón "Iniciar operación Antimonio" en `/dashboard/trades`

Un CTA destacado arriba de la lista que pre-rellena todo el trade con los datos del deal actual:

- Commodity: Antimony (Sb), forma: ingots Grade 2# (99.75–99.90% Sb)
- Cantidad inicial editable, Incoterm CIF por defecto, precio USD/t editable
- Referencia auto: `SB-ANTIMONIO-YYYYMM-####`
- Instrumento de pago: SBLC (MT760)
- Contraparte externa (sin cuenta): nombre, empresa, país, email, teléfono
- Rol del creador: vendedor por defecto (tú operas la venta de Carpio & Kaddu)
- Al crear: emite automáticamente el link espejo `/operacion/<token>` y lo copia al portapapeles

Si prefieres empezar en blanco, el "Nuevo trade" clásico sigue disponible.

## 2) Soporte de contraparte externa en `createTrade`

Hoy `createTrade` exige que la contraparte tenga cuenta (busca su `user_id` por email). Extensión:

- Nuevos campos opcionales: `counterpartyName`, `counterpartyCompany`, `counterpartyCountry`, `counterpartyPhone`, `counterpartyRole`
- Si no existe usuario para el email, se guardan esos campos en `commodity_trades.counterparty_*` (las columnas ya existen) y `buyer_user_id` o `seller_user_id` queda `null` según el `side`
- El detalle ya sabe pintar la contraparte externa (lo vi en `getTradeDetail`)
- Trigger existente `enforce_trade_seller` no debería bloquear porque el vendedor sigue siendo el usuario cuando `side='sell'`

## 3) Panel "Proveedor / Contraparte" en el detalle del trade

Bloque nuevo arriba del checklist documental:

- Datos de la contraparte externa (nombre, empresa, país, contacto)
- Botón **Emitir link de panel espejo** → `ensureCounterpartyLink` (ya existe) → copia URL y muestra prefijo
- Botón **Enviar invitación al Portal de Proveedores** → arma link a `/portal-proveedor?email=…&intent=trade&tradeRef=…` para que se registre y cargue KYC formal
- Botón **Rotar link** cuando ya existe

## 4) "Solicitar datos y documentos" al proveedor

Sección compacta dentro del panel de contraparte:

- Checklist rápido pre-marcado con los docs típicos de antimonio: **Certificate of Analysis (CoA)**, **SGS test report**, **Packing list**, **Fotos del lote**, **Origen del material**, **B/L**
- Botón **Solicitar** que:
  - Crea placeholders en `trade_documents` con `status = 'pending'` para los tipos elegidos (usa `upsertTradeDocument` existente)
  - Registra un evento `docs_requested` en `trade_events` con la lista
  - Muestra el link espejo para reenviar al proveedor (él sube desde `/operacion/<token>`)
- Textarea opcional con nota que se guarda como mensaje en el timeline

## 5) Ampliar catálogo documental con los específicos del antimonio

En `src/lib/tradeDocuments.ts` añadir (si no están) al catálogo fase "exportación":

- `coa` — Certificate of Analysis (Sb, Pb, As, Fe, S, Cu, Bi…)
- `sgs_report` — SGS Test Report
- `lot_photos` — Fotografías del lote (pallets/marcas)
- `origin_declaration` — Declaración de origen del material

Los tres primeros pasan a formar parte del núcleo mínimo para cerrar un trade de antimonio.

## 6) Subida pública desde `/operacion/<token>` (proveedor sin cuenta)

Extender `getOperacionByToken` para devolver la lista de docs pendientes y añadir `uploadOperacionDoc` (público, valida token → resuelve trade_id vía hash → usa cliente admin) para que la contraparte suba archivos al bucket `trade-docs` sin login. Cada subida:

- Registra evento `doc_uploaded_by_counterparty`
- Notifica por email al owner del trade (usa infra de emails existente)

## 7) QA

- Crear el trade Antimonio, verificar contraparte externa en detalle
- Emitir link, abrir `/operacion/<token>` en incógnito, subir un CoA de prueba
- Confirmar que aparece en el checklist del owner con estado "Cargado" y evento en el timeline
- `bunx tsgo` limpio

## Archivos a tocar

- `src/lib/trades.functions.ts` — extender `createTrade` con contraparte externa
- `src/lib/tradeDocuments.ts` — añadir docs de antimonio
- `src/lib/tradeOps.functions.ts` — añadir `uploadOperacionDoc` + docs pendientes en payload
- `src/routes/_authenticated.dashboard.trades.tsx` — CTA quickstart + panel contraparte + solicitar docs
- `src/routes/operacion.$token.tsx` — sección de carga de documentos

Sin cambios de esquema (los campos `counterparty_*` y buckets ya existen). Confirmar antes de construir.
