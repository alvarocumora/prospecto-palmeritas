# Firma de NDA vinculada a versiones inmutables por operación

Vincular envelopes de firma (`signature_envelopes` + `document_signatures`) a documentos concretos de cada operación (`operation_documents`), usando la versión **frozen** como el artefacto inmutable auditable.

## Modelo

- `operation_documents.is_frozen = true` + `sha256` = versión inmutable. Una vez congelada no admite re-subida; una nueva versión crea un `operation_documents` hijo (`parent_document_id`, `version+1`).
- `signature_envelopes` se crea apuntando al doc congelado:
  - `document_type = 'operation_document'`
  - `document_ref_id = operation_documents.id`
  - `document_hash = operation_documents.sha256`
  - `document_storage_path = operation_documents.storage_path`
  - `metadata = { operation_id, kind, version }`
- Firmantes = participantes de la operación (buyer, seller, gc_staff) según plantilla (NDA bilateral, NCNDA trilateral, LOI, etc.).
- Al completar todas las firmas → envelope `completed`, se genera PDF estampado y se sube como **nueva versión hija** del documento (`kind` = `<original>_signed`, `is_frozen=true`).

## Cambios

### 1. Migración
- Trigger `prevent_frozen_mutation` en `operation_documents`: bloquea UPDATE de `storage_path/sha256/file_size` cuando `is_frozen=true`.
- Trigger `bump_version_on_child`: al insertar con `parent_document_id`, setea `version = parent.version + 1`.
- Índice único parcial: `(operation_id, kind) WHERE is_frozen=false AND parent_document_id IS NULL` para evitar duplicados activos por kind.
- Vista `operation_signature_status` que joina envelope + operation_document + conteo de firmas.
- RLS: policy en `signature_envelopes` y `document_signatures` que permita a participantes de la operación (buyer/seller/staff) leer sus envelopes vía `metadata->>'operation_id'`.

### 2. Server functions — `src/lib/operations/signatures.functions.ts`
- `createOperationSignatureFlow({ operationId, documentId, template, signers[] })`:
  - Valida `is_frozen=true`; si no lo está, congela el doc primero (reusa `freezeOperationDocument`).
  - Crea envelope + `document_signatures` para cada firmante mapeando `signer_role` a `op_participant_role`.
  - Emite correos de invitación a firmar (reutiliza template existente + link `/firmar/$token`).
- `listOperationSignatureFlows(operationId)` → envelopes con estado.
- `finalizeOperationSignatureFlow(envelopeId)` (auto al firmar último): renderiza PDF auditado con `renderGeocapitalsPdf` + banda de auditoría, sube como hijo congelado, registra en `operation_access_logs` y `document_registry`.
- Trigger DB o hook server que al pasar envelope a `completed` dispare la finalización.

### 3. UI
- `src/features/operations/OperationSignaturesPanel.tsx`:
  - Lista envelopes de la operación con estado (pendiente/parcial/completado), versión del documento, hash corto y link al PDF firmado.
  - Botón "Iniciar firma" sobre docs frozen; abre diálogo para elegir plantilla (NDA / NCNDA / LOI / SPA) y firmantes (autocompletados desde `operation_participants`).
  - Copia enlace `/firmar/$token` por firmante y estado de correo.
- Inyectar panel en `PortalPage.tsx` (buyer/seller ven solo sus envelopes) y en `_authenticated.dashboard.operaciones.$id.tsx` (staff ve todos).
- En `OperationDocumentsPanel`, badge "🔒 v{n} · firmado" cuando existe envelope completed.

### 4. Ruta de firma
- Reutilizar `src/routes/firmar.$token.tsx`; añadir soporte para envelopes de tipo `operation_document`: carga PDF desde signed URL del storage de operación, muestra contexto de operación (GC code, contraparte).

## Detalles técnicos

- Firma HMAC actual (`signature_hmac`) sigue vinculando `signer_user_id + envelope.document_hash + timestamp`.
- El PDF final estampado guarda su propio SHA-256; se registra en `document_registry` para que el QR de verificación resuelva vía `/verificar/$ref`.
- Idempotencia: `createOperationSignatureFlow` usa `metadata.idempotency_key = op:{opId}:doc:{docId}:v{version}` para evitar duplicar envelopes de la misma versión.
- Segregación RLS: buyer solo ve envelopes donde es firmante o el doc tiene `visibility in ('shared','buyer_only')`; idem seller.

## Fuera de alcance

- Firma con certificado avanzado (eIDAS / FEA Chile) — se mantiene firma electrónica simple con HMAC + auditoría.
- Nueva UI de creación de plantillas custom; se usan las plantillas ya existentes (NDA, NCNDA, LOI, SPA).
