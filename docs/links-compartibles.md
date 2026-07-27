# Fichas / links compartibles (WhatsApp) — registro de producto y portal de negociación

> Dos enlaces que el usuario envía (WhatsApp/email) para que un tercero **sin cuenta**
> participe: (A) **registro de producto** y (B) **oferta/negociación** en un portal.
> El backend ya soporta ambos; la generación del token, la ficha pública y el botón de
> compartir son de Lovable (`/src`). Aquí el contrato y el patrón.

## Patrón común: link tokenizado + compartir por WhatsApp
- El token vive HASHEADO (como en `commodity_trades.counterparty_*_token_*` /
  `sourcing_requests.submit_token_hash`); el server fn valida el token y opera con
  **service client** (sin sesión del tercero).
- Compartir por WhatsApp: `https://wa.me/?text=<mensaje + URL>` (o `https://wa.me/<tel>?text=...`).
- Ficha pública OG-friendly (title/description/imagen) para que el link se vea como
  tarjeta en WhatsApp.

## A) Ficha de REGISTRO DE PRODUCTO
Flujo: el usuario genera un link → lo manda al proveedor → el proveedor abre una ficha
pública y **registra su producto** (specs, cantidad, precio, origen, packaging, docs).

- **Ruta pública:** p.ej. `/registro/producto/$token` (Lovable).
- **Server fn (service client):** valida el token; al enviar el formulario:
  - Si el registro es dentro de una operación existente → `INSERT` en `trade_products`
    (`added_by_role='seller'`, status `offered`), o `import_supplier_offer_to_trade` si
    ya hay una `supplier_offer`.
  - Si es alta libre de catálogo → `supplier_offers` / `commodity_lots` (dominio Lovable).
- **Seguimiento para el proveedor:** el mismo token muestra el estado (checklist de
  documentos vía `trade_documents_checklist`, estado de sus productos vía
  `get_trade_products`). Así "sube documentación y da seguimiento".

## B) Ficha de OFERTA / NEGOCIACIÓN (portal para negociar)
Flujo: el usuario manda la ficha del producto/operación al comprador → el comprador
abre el portal (War Room) y **hace una oferta o negocia** precio, fecha, Incoterm,
puertos, envío — sin cuenta.

- **Ruta pública:** `/operacion/$token` (War Room ya existente; token de
  `ensureCounterpartyLink`).
- **Ver la ficha del producto:** server fn (service client) → `get_trade_products(trade)`.
- **Negociar (NUEVO backend habilitado para link):** server fn valida el token →
  llama vía service client:
  - `propose_trade_terms(p_trade_id, p_party, p_price_usd_t, p_quantity_t, p_incoterm,
     p_port_loading, p_port_discharge, p_delivery_from, p_delivery_to, p_payment_terms,
     p_shipping_notes, p_valid_until, p_message, p_replies_to)` — oferta/contraoferta.
  - `respond_trade_terms(p_offer_id, 'accept'|'reject', p_note)` — al aceptar vuelca los
    términos al trade.
  - `get_trade_negotiation(trade)` — hilo para mostrar la negociación en el portal.
  El `p_party` sale del token (buyer/seller). **Ya no exigen sesión** (migración
  20260726030000): el server fn es el gatekeeper del token; los RPC siguen sin grant a
  `anon`.
- **Subir documentos y firmar:** `attachOperacionDoc` + checklist/screening ya existentes.

## Seguridad
- Los RPC de negociación se otorgan a `authenticated` y `service_role`, **nunca a
  `anon`**. El tercero sin cuenta NO llama los RPC directo: pasa por el server fn que
  validó el token. `created_by` queda `null` en el flujo por link (auditable por
  `party` + timeline).
- Expira el token (`valid_until`/`expires_at`) y permite revocar/regenerar
  (`ensureCounterpartyLink`, `get_trade_access_links` para gobernanza).

## Prompt para Lovable
```text
Crea dos flujos de link compartible (WhatsApp):
1) /registro/producto/$token — ficha pública donde el proveedor registra su producto y
   da seguimiento. Server fn con service client valida el token e inserta en
   trade_products (added_by_role='seller') o supplier_offers; muestra estado con
   trade_documents_checklist y get_trade_products. Botón "Compartir por WhatsApp"
   (wa.me/?text=). Ficha OG (title/description/imagen del producto).
2) Portal de negociación en /operacion/$token: además del data room, panel de oferta/
   contraoferta que llama (vía server fn con service client, token validado)
   propose_trade_terms / respond_trade_terms / get_trade_negotiation. Formulario con
   Incoterm (CIF/FOB/…), puertos, fechas, pago y notas de envío. Botón compartir wa.me.
El token se genera y valida en el server fn (hash), como ensureCounterpartyLink /
generateSubmissionShareLink. Los RPC ya no exigen sesión para el flujo por link.
```
