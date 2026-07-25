
# Plan: Portal Proveedores + Buyer RFQ (integrados en Geocapitals)

Dos módulos hermanos bajo el mismo proyecto y con el mismo tema visual (Institutional Modernist: papel hueso, tinta, cobalto, serif). Entrega por fases; cada fase deja algo repartible.

---

## Alcance por módulo

**A) Portal Proveedores** (`/inscripcion` público + `/panel` proveedor + `/dashboard/bandeja` interno)
- Wizard móvil 4 pasos con guardado parcial, validación por país (RUT/RUC/CUIT/NIT).
- Link compartible con token, QR y contador (`/dashboard/enlaces`).
- Cuenta del proveedor (magic link) para seguir estado y subir documentos.
- Bandeja interna con comparador, señales de alerta (lista de hechos, sin puntaje).
- IA lectora de certificados (Lovable AI Gateway, `google/gemini-3.6-flash` multimodal).
- Cumplimiento base Ley 21.719: consentimiento versionado, /privacidad, export/delete cuenta, log de accesos.

**B) Buyer RFQ** (`/dashboard/rfq/*` interno + `/rfq/$publicId` público)
- Dashboard KPIs (RFQs, proveedores, DD, contratos).
- Crear RFQ multi-pestaña (general, productos, compliance REICON checklist).
- Perfil de proveedor con KYC/ESG/Compliance/Risk Score.
- Workflow: Pending → Review → Approved → Commercial → ICPO → SPA → Shipment.
- Risk Engine ponderado (Mining 30, Corporate 20, Financial 15, ESG 10, Compliance 25).
- Ficha RFQ pública con "Apply as Supplier" que aterriza en el Portal Proveedores.
- GeoCompliance AI: revisa docs, detecta faltantes, resume, recomienda.

**Puente único**: un `supplier_profiles` compartido. Un proveedor que se inscribe por `/inscripcion` puede aparecer en `/dashboard/bandeja` y postular a RFQs.

---

## Diseño

Todo bajo `data-theme="im-light"` con tokens semánticos ya existentes (`surface`, `content`, `hairline`, `accent-brand`). Se ignoran las paletas alternas del brief (verde mineral, azul SAP). Tipografía: la serif display + Inter + IBM Plex Mono para cifras que ya usa la plataforma. Componentes shadcn ya presentes.

---

## Fases

**Fase 1 — Base de datos + seguridad (1 migración grande)**
- Tablas: `suppliers`, `supplier_offers`, `offer_elements`, `supplier_documents`, `supplier_events`, `invitation_links`, `rfqs`, `rfq_products`, `rfq_compliance_items`, `supplier_scores`, `risk_assessments`, `rfq_applications`.
- RLS estricta: `suppliers` legible solo por su `owner_user_id` o staff (`has_role`). `invitation_links` solo staff. `rfqs` legibles por creador + assigned staff; ficha pública vía server fn dedicada.
- GRANTs explícitos (authenticated + service_role, sin anon salvo lookup público por token via server fn).
- Consent log + `privacy_policy_versions`.

**Fase 2 — Portal Proveedores mínimo repartible**
- `/inscripcion` wizard 4 pasos con `useLocalStorage` para draft + `createServerFn` público con rate-limit por IP y honeypot (sin Turnstile inicial; se agrega en Fase 5).
- `/inscripcion/gracias` con folio, próximos pasos y CTA "crear cuenta".
- `/dashboard/enlaces` (staff) genera tokens + copy WhatsApp + QR descargable.
- `/panel` (proveedor autenticado bajo `_authenticated`) con estado en lenguaje claro, edición de contacto, agregar oferta, subir docs.
- Bucket privado `supplier-docs` con URLs firmadas cortas.

**Fase 3 — Bandeja interna + IA de certificados**
- `/dashboard/bandeja` (tabla densa + filtros + comparador side-by-side).
- Server fn `extractCertificatePdf` con Lovable AI Gateway (multimodal) que sube el archivo, extrae tabla elemento/valor y guarda en `offer_elements` con `confidence` y `pending_confirmation=true`. UI muestra el recorte junto al valor.
- Señales de alerta calculadas del lado servidor y renderizadas como bullets con evidencia.

**Fase 4 — Buyer RFQ**
- `/dashboard/rfq` (lista + KPIs).
- `/dashboard/rfq/nuevo` (wizard tabs: General, Productos, Compliance REICON).
- `/dashboard/rfq/$id` (detalle + postulaciones + timeline).
- `/rfq/$publicId` ficha pública con "Apply as Supplier" → prellena `/inscripcion?ref=RFQ-xxx`.
- Risk Engine puro (`src/lib/risk.ts` + tests). Badge Low/Med/High.
- Export PDF del RFQ vía `renderGeocapitalsPdf`.

**Fase 5 — Compliance + endurecimiento**
- `/privacidad` versionada + tabla `privacy_consents`.
- Rutas de export/delete de datos del proveedor desde `/panel/mis-datos`.
- Log de acceso a PII (trigger).
- Turnstile en `/inscripcion` (secret `TURNSTILE_SECRET`).
- Job de anonimización de descartados > N días.

**Fase 6 — GeoCompliance AI (RFQ)**
- Server fn que evalúa un `supplier_profile` completo contra el checklist REICON del RFQ, retorna resumen + faltantes + recomendación (Approve / Request More Info / Reject), guardado en `risk_assessments`.

---

## Detalle técnico

- **Stack**: TanStack Start, server fns bajo `src/lib/suppliers/*.functions.ts` y `src/lib/rfq/*.functions.ts`. Rutas autenticadas bajo `src/routes/_authenticated/`. Rutas públicas top-level.
- **IA**: helper `createLovableAiGatewayProvider` ya existe. Nuevo `src/lib/ai/certificate-extract.server.ts` con `generateText` + `Output.object` (schema plano, sin `.min/.max`), fallback `NoObjectGeneratedError`. Modelo por defecto: `google/gemini-3.6-flash`.
- **Storage**: bucket privado `supplier-docs` vía `supabase--storage_create_bucket`. Subida cliente → server fn firma URL PUT.
- **Compresión imágenes**: en cliente antes de subir (canvas resize a 2000px, calidad 0.8).
- **Nunca datos bancarios** en formularios ni tablas.
- **Rate limit** en server fn público: tabla `public_form_hits` con TTL 1h por IP+phone.
- **Puente Buyer↔Supplier**: `rfq_applications(supplier_id, rfq_id, status, application_score)` con trigger que actualiza scores desde `supplier_scores`.

---

## Entregas incrementales

```text
Fase 1 → migración aplicada, DB lista
Fase 2 → link compartible funcional por WhatsApp (repartible)
Fase 3 → equipo puede triar ofertas + IA de certificados
Fase 4 → compradores publican RFQs y reciben postulaciones
Fase 5 → cumple Ley 21.719 antes de dic-2026
Fase 6 → recomendaciones automáticas de compliance
```

Cada fase compila, corre tests y queda usable sin depender de la siguiente.

---

## Fuera de alcance (explícito)

- WhatsApp Business API oficial (se usa `wa.me`).
- Chat en tiempo real proveedor↔analista (mensajes asíncronos simples).
- Verificación automática de concesiones no chilenas.
- Scoring crediticio de personas.
- Firma electrónica y blockchain (reutilizar módulo existente cuando aplique, no re-construir).

---

## Confirmación antes de arrancar

Voy a arrancar por **Fase 1 (migración) + Fase 2 (portal público repartible)** en el primer sprint de build. ¿Ok o prefieres que empiece por el Buyer RFQ (Fase 4)?
