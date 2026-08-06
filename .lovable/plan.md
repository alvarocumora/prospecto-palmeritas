# Participantes del trade, documentos bilingües y expediente KYC

Objetivo: cerrar el entorno de operación del trade de oro con (1) invitación por correo de brókeres u otros participantes con enlace propio y revocación, (2) documentos ICPO / FCO / IMFPA bilingües ES-EN accesibles desde la ficha pública y el panel interno, (3) descarga de la ficha en PDF, y (4) un expediente documental del comprador (KYC, prueba de fondos, etc.) con generador y administrador de documentos.

## 1. Invitar y revocar participantes

Hoy una operación solo admite dos enlaces (comprador y vendedor) guardados como columnas en la operación; no hay forma de sumar un bróker ni de revocar accesos.

- Nueva tabla de participantes de la operación: rol (comprador, vendedor, bróker, asesor, observador), nombre, correo, permisos (ver ficha, ver documentos, negociar, subir documentos), enlace con token hasheado, estado activo/revocado, quién invitó y cuándo.
- Panel "Participantes" en el detalle interno del trade (solo equipo GeoCapitals): listado con rol, correo, prefijo del enlace, estado; botones Invitar, Reenviar y Revocar. Nunca se muestra el token completo salvo en el momento de emitirlo.
- Al invitar se envía un correo con el enlace privado de la operación, el rol asignado y una nota de confidencialidad. Plantilla nueva de correo con la identidad Geocapitals.
- El portal `/operacion/$token` resuelve también estos enlaces: muestra el rol, y limita a solo lectura salvo que el permiso lo habilite. Un enlace revocado muestra un aviso de acceso finalizado.

## 2. Documentos bilingües ICPO / FCO / IMFPA

- IMFPA (acuerdo de pago de comisiones) se suma al catálogo de plantillas; ICPO y FCO ya existen.
- Las tres plantillas pasan a soportar idioma: Español, English o Bilingüe (español sobre inglés en cada cláusula), con cláusula de prevalencia del texto en español.
- Panel interno del trade: sección "Documentos comerciales" con selector de idioma, generación del PDF con marca, QR de validación y versionado, igual que el resto de documentos.
- Ficha pública `/ficha/$token`: bloque de descarga de ICPO, FCO e IMFPA en el idioma elegido, disponible según los permisos del enlace.

## 3. Descargar la ficha en PDF

- Botón "Descargar ficha (PDF)" en la ficha pública y en el panel interno, con el mismo renderizador institucional: portada con referencia y commodity, especificaciones de producto, condiciones comerciales públicas (nunca precio base ni margen), contactos y QR de verificación.

## 4. Expediente del comprador (KYC / Proof of Funds) y administrador de documentos

- Checklist de expediente del comprador sobre la estructura documental existente: identidad del representante, constitución y poderes de la empresa, registro tributario, KYC corporativo, prueba de fondos, carta bancaria (BCL), listas de sanciones y beneficiario final.
- Cada ítem admite: subir archivo, ver estado (pendiente, en revisión, aprobado, observado), nota de revisión y fecha de vencimiento. El comprador sube desde su enlace; el equipo GeoCapitals revisa y aprueba.
- Vista "Documentos y contratos" del trade que unifica en una sola tabla: documentos generados por plantilla, documentos subidos por las partes y documentos firmados; con filtro por parte, tipo y estado, y acciones de descarga, nueva versión y solicitud de firma.
- El avance a evaluación comercial exige el expediente del comprador completo, sumado a los gates ya existentes.

## Detalles técnicos

- Migración: tabla `trade_participants` con RLS (equipo GeoCapitals y participantes de la propia operación), GRANT a `authenticated`/`service_role`, funciones para emitir y revocar enlace (token SHA-256, solo se guarda el hash y el prefijo), y tabla/extensión de checklist KYC del comprador reutilizando `operation_document_structure`.
- Servidor: `src/lib/tradeAccess.functions.ts` (listar, invitar, reenviar, revocar) y ampliación de `src/lib/tradeOps.functions.ts` para resolver tokens de participantes con permisos y estado revocado.
- Plantillas: `src/lib/documents/model.ts` gana un parámetro `lang` y helper `biline()`; `templates.ts` añade IMFPA y las versiones EN de ICPO/FCO/IMFPA.
- PDF: reutiliza `src/lib/documents/pdf.ts` y el flujo de versionado de `tradePack.functions.ts`; la ficha PDF se genera desde `tradeFicha.functions.ts` sin exponer datos internos.
- Correo: nueva plantilla `trade-participant-invitation.tsx` registrada en `registry.ts` y envío por la infraestructura de correo existente.
- UI nueva en `src/features/trades/`: `TradeParticipantsPanel.tsx`, `TradeDocsBilingualPanel.tsx`, `TradeBuyerKycPanel.tsx`, `TradeDocumentManager.tsx`, integradas en `_authenticated.dashboard.trades_.$tradeId.tsx` y en `ficha.$token.tsx` / `operacion.$token.tsx`.
