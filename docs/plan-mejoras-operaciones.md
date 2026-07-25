# Plan de mejoras — operar intermediación de commodities de verdad

> Objetivo: dejar **un solo sistema** de operaciones, con rutas **alcanzables** desde
> el dashboard y el menú público, para arrancar operaciones reales de intermediación
> de commodities y metales. Basado en la auditoría de reachability del flujo.

## 1. El problema de fondo: dos sistemas paralelos

Coexisten **dos** implementaciones del mismo caso de uso (crear operación → invitar
contraparte por token → data room → firmar), en **tablas distintas**:

| | **Trades** (cableado al menú) | **Operaciones** (huérfano, más completo) |
|---|---|---|
| Entrada UI | Sidebar "Trade Desk" (`_authenticated.tsx:169`) | **ninguna** (solo URL/correo) |
| Backend | `lib/tradeOps.functions` | `lib/operations/operations.functions` + `portal.functions` |
| Tablas | `commodity_trades`, `trade_documents` | `operations`, `operation_documents`, `operation_invitations` |
| Contraparte | `/operacion/$token` | `/portal/buyer\|seller/$token` (portal tripartito) |
| Firmas | — | `signature_envelopes` / `document_signatures` |
| Integración comercial | **sí** (sourcing, clientes, partners, anticipos, cobranza, envíos) | **no** (isla) |
| Checklist de documentos (REICON) | — | **sí** (`operation_document_structure`, ya construido) |

**Consecuencia:** el sistema que la gente alcanza (Trades) no tiene el modelo de
compliance (KYC/checklist/portal/firmas) que exige la intermediación real; y el que
sí lo tiene (Operaciones) no es alcanzable ni está integrado al stack comercial.

## 2. La decisión que desbloquea todo: un solo spine

Hay que **consolidar en uno**. Dos caminos:

- **A) Canónico = Trades** (recomendado). Es el que está cableado e integrado con el
  stack comercial. Se le **portan** las piezas fuertes de Operaciones: portal
  tripartito, checklist de documentos y e-firmas, sobre `commodity_trades`/
  `trade_documents`. Menor riesgo para arrancar; el checklist REICON se retargetea de
  `operation_documents` a `trade_documents` (mismo patrón que usamos con terreno
  franco → `cadastre_national`).
- **B) Canónico = Operaciones**. Lovable lo **cablea** al menú y le integra el stack
  comercial (sourcing/clientes/anticipos/cobranza/envíos). Más trabajo de UI, pero se
  conserva tal cual el modelo de portal/firmas/checklist ya hecho.

En ambos, el otro sistema se **deprecia** (redirige) para no dejar dos fuentes de
verdad. Esta decisión define dónde vive mi backend; está pendiente de confirmación.

## 3. Mejoras de UI/rutas — **territorio Lovable** (`/src`)

Claude Code no las edita; se listan como especificación:

1. **Cablear el sistema canónico al CommandRail** (`src/routes/_authenticated.tsx`,
   grupo "NEGOCIO") con una entrada clara ("Operaciones"/"Mesa de operaciones").
2. **Rescatar o deprecar las rutas huérfanas** (inalcanzables por click):
   `/dashboard/operaciones(.nuevo/.$id)`, `/dashboard/rfqs(.*)`,
   `/dashboard/proveedores(.*)`, `/dashboard/proveedor`, `/dashboard/enlaces`,
   `/dashboard/invitaciones`, `/dashboard/fletes`. Cada una: enlazar desde el menú/su
   flujo padre, o redirigir a su equivalente del stack canónico.
3. **Fix landing:** "Ver marketplace completo" apunta a `/dashboard/commodity-lots`
   (gateada por auth) → cambiar al `/marketplace` público
   (`MarketingLanding.tsx:308-309`).
4. **Menú público:** agregar acceso a **inscripción de proveedores** y, si el RFQ
   público debe indexarse por navegación, a `/rfqs` (hoy solo por URL/SEO).
5. **Navegación cruzada** entre operación ↔ requerimiento ↔ proveedor (hoy son islas)
   dentro del sistema canónico.

## 4. Mejoras de backend — **territorio Claude Code** (lo que construyo)

Dependen de la decisión (§2). Suponiendo **A (Trades canónico)**:

1. **Retargetear el checklist de documentos** a `trade_documents`: RPC
   `trade_documents_checklist(trade_id)` + `trade_documents_readiness(trade_id)`
   reusando `operation_document_structure` (mismo catálogo REICON, editable). Alinear
   `trade_documents.doc_type` al vocabulario `doc_kind`.
2. **Productos por operación**: modelo de productos que sube el proveedor
   (specs/cantidad/precio/calidad/origen), reconciliando `supplier_offers`/
   `rfq_products` hacia el trade/operación.
3. **Ciclo del requerimiento**: transiciones (borrador → enviado por link → completado
   → bloqueado) como RPC con validación.
4. **Consolidar invitaciones**: unificar `operation_invitations` / `invitation_links`
   en un solo mecanismo de token para el sistema canónico.
5. **Screening de compliance**: registrar el resultado del screening OFAC/UN/EU/UK que
   ya exige el checklist REICON (fila `sanctions_screening`, rol geocapitals).

Si la decisión es **B (Operaciones canónico)**, 1 y 4 no requieren retarget (el
checklist ya vive ahí); el resto es igual.

## 5. Secuencia propuesta para "operaciones reales"

1. **Decidir el spine** (§2) — bloqueante.
2. Lovable: cablear el spine al menú + fix landing (§3.1, §3.3) — habilita el on-ramp.
3. Claude: checklist sobre el spine + productos por operación (§4.1–4.2).
4. Claude: ciclo del requerimiento + consolidar invitaciones (§4.3–4.4).
5. Lovable: navegación cruzada + deprecación de rutas duplicadas (§3.2, §3.5).
6. Compliance: screening + readiness como gate para pasar a evaluación comercial.

El checklist REICON (cátodos de cobre) ya está listo y es el primer control de
compliance real; solo hay que apuntarlo al spine que elijas.
