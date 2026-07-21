
# Plan: Document Pack automático + Trade Desk mejorado

## Objetivo
Que cada trade genere con 1 clic un **paquete completo de documentos PDF** (Ficha Técnica, LOI, NCNDA, ICPO, SPA draft) usando los datos reales del pedido (commodity, tonelaje, incoterm, precio, contrapartes) y permita enviarlos por correo o compartir por WhatsApp. Además, limpiar Trade Desk para que la operación sea el centro visual.

---

## 1. Generador de Document Pack por trade

Nuevo módulo `src/lib/documents/tradePack.server.ts` que, a partir de un `trade_id`, arma todos los PDFs de una operación con los datos del trade + counterparties + business_partners.

Documentos generados automáticamente:
- **Ficha Técnica** (Purchase Terms, formato ya usado para Antimonio/Cobre — extendido a genérico por commodity)
- **LOI** (Letter of Intent buyer→seller, con volumen, incoterm, precio referenciado)
- **NCNDA** (ICC-standard, ya existe plantilla — se pobla con partes)
- **ICPO** (Irrevocable Corporate Purchase Order, buyer-side)
- **SPA Draft** (Sale & Purchase Agreement borrador)

Cada PDF:
- Usa `buildOfficialPdf` con branding Institutional Modernist ya existente
- Sello "GEOCAPITALS · Intermediario y Gestor Operacional"
- QR de verificación en `geocapitals.com/verificar/{ref}`
- Se sube a storage con URL firmada 60 días
- Se registra evento `pack_generated` en el timeline del trade

Server functions nuevas en `src/lib/documents/tradePack.functions.ts`:
- `generateTradePack({ tradeId, include: ['ficha','loi','ncnda','icpo','spa'] })` → devuelve `{ url, docs: [{type, url, filename}] }`
- `dispatchTradePack({ tradeId, recipients, subject, message })` → envía email con adjuntos + links

## 2. UI en Trade Desk: panel "Document Pack"

Nuevo componente `TradePackPanel` dentro de la vista de trade en `src/routes/_authenticated.dashboard.trades.tsx`:

- Sección "Documentos de la operación" con checkboxes por tipo
- Botón **"Generar paquete PDF"** → genera todos y muestra lista con:
  - Nombre del doc, tamaño, badge de estado (generado/enviado/firmado)
  - Botón **Descargar**, **Copiar link**, **WhatsApp**, **Email**
- Botón **"Compartir por WhatsApp"** por documento y por paquete completo:
  - Usa `https://wa.me/?text=` con mensaje pre-armado + link firmado
  - Detecta si hay teléfono en `business_partners` para prellenar destinatario
- Botón **"Enviar paquete por correo"** → modal con destinatarios (buyer/seller ya cargados), asunto y mensaje editables

## 3. Reorganización de Trade Desk

Actual problema: paneles desordenados (Quickstart, Supplier, Upload, Delivery, RequestDocs, Accept, etc. todos apilados).

Nueva estructura por trade seleccionado con **tabs**:
1. **Resumen** — KPIs, contrapartes, incoterm, volumen, precio, estado
2. **Documentos** — Document Pack + firmas + subidas recibidas (unifica UploadInbox + RequestDocs + Sign)
3. **Contrapartes** — Supplier + Buyer panels
4. **Timeline** — eventos + entregas email
5. **War Room link** — token público para compartir

Quickstart queda arriba como barra colapsable (solo "Nuevo trade Antimonio / Cobre / Genérico"). Filtro y toggle cancelados se mantienen.

## 4. Datos y consistencia

- `generateTradePack` lee del `trade` real: `commodity`, `quantity_mt`, `incoterm`, `payment_instrument`, `price_ref`, `notes`, `counterparty_buyer`, `counterparty_seller`
- Corrige el bug histórico donde fichas mostraban tonelaje por defecto (20 MT) en vez del real del trade
- Cada doc muestra footer "Operación {reference} · {volumen} MT/mes · {incoterm}"

## 5. Detalles técnicos

- PDFs generados server-side con `pdf-lib` (patrón ya establecido en `officialPdfs.server.ts`)
- Templates en `src/lib/documents/templates/` (uno por tipo: `ficha.ts`, `loi.ts`, `ncnda.ts`, `icpo.ts`, `spa.ts`) — reutilizan helpers de layout ya existentes (safe zones, page-break, watermark)
- WhatsApp share es client-side: `window.open('https://wa.me/{phone}?text=...')`
- Registrar cada envío en `email_send_log` + `trade_events` para trazabilidad
- Migración menor: agregar índice en `trade_events(trade_id, created_at)` si no existe (verificar antes)

## Fuera de alcance
- Firma digital dentro del PDF (ya existe flujo de firmas separado en `document_sign_requests`)
- Envío por WhatsApp Business API (solo link `wa.me`)
- Nuevos templates de commodities distintos a antimonio/cobre/genérico (se agregan bajo demanda)
