

# Plan: Marketplace, NI 43-101 y gestión avanzada de Catastro

Tres módulos integrados que convierten a Geocapitals en una plataforma operativa **end-to-end**: descubrir oportunidades (Marketplace), gobernar permisos vigentes (Catastro+) y entregar entregables bancables (NI 43-101).

---

## 1. Marketplace de Minería y Proyectos (evolución del actual)

Hoy `dashboard/marketplace` solo instala capas GeoJSON públicas. Lo expandimos a un **doble marketplace**:

### 1.A — Marketplace de Capas (mejorar existente)
- Categorías técnicas: Geología regional · Fallas · Hidrografía · Geofísica pública · Concesiones · Comunidades indígenas · Áreas protegidas (SNASPE).
- Ratings (1–5) + comentarios + curador verificado (`● VERIFIED` dot cyan).
- Preview thumbnail (mini-mapa SVG de la geometría) antes de instalar.
- Filtros por commodity, país, escala, licencia (CC-BY, dominio público, propietaria).

### 1.B — Marketplace de Proyectos / Property Deals (NUEVO)
Listado de **propiedades/concesiones en venta, joint-venture, opción o farm-in** publicadas por holders.

- Tarjeta de proyecto: código, commodity, etapa (greenfield → reserve), superficie, NSR/regalía pedida, modalidad (venta · JV · opción · earn-in), datos disponibles (assays, sondajes, NI 43-101 previo).
- Filtros: commodity, país, etapa, presupuesto, modalidad.
- **Data room virtual** por proyecto: PDFs, sondajes históricos, mapas, reportes 43-101 — acceso solicitado bajo NDA digital (firma click-through registrada en `audit_log`).
- Mensajería 1-a-1 entre interesado y holder (canal Realtime Supabase, no email).
- Estados del deal: `LISTED → INQUIRY → NDA_SIGNED → DUE_DILIGENCE → LOI → CLOSED/WITHDRAWN`.

### Tablas nuevas
- `property_listings` (project_id opcional, holder, commodity, area_ha, stage, modality, asking_price_usd, royalty_pct, region, geometry, summary, is_published, views_count)
- `property_deal_inquiries` (listing_id, inquirer_user_id, status, nda_signed_at, message)
- `property_data_room_files` (listing_id, file_path, requires_nda, uploaded_by)
- `marketplace_layer_reviews` (shared_layer_id, user_id, rating 1-5, comment)

### Rutas
- `/dashboard/marketplace/layers` (rebranded de la actual)
- `/dashboard/marketplace/properties` (nuevo)
- `/dashboard/marketplace/properties/$id` (detalle + data room)
- `/dashboard/marketplace/my-listings` (gestión holder)

---

## 2. Certificación NI 43-101 (workflow completo)

Hoy `lib/export-ni43101-pdf.ts` genera un PDF estático. Lo elevamos a **flujo de Technical Report bancable** con QP (Qualified Person), checklist y versionado.

### 2.A — Reporte estructurado por secciones (las 27 oficiales)
Basado en el formato `Form 43-101F1`. Cada sección como bloque editable:

```text
1.  Summary                  10. Property Description
2.  Introduction              11. Sample Preparation
3.  Reliance on Other Experts 12. Data Verification
4.  Property Description      13. Mineral Processing
5.  Accessibility             14. Mineral Resource Estimates
6.  History                   15. Mineral Reserve Estimates
...                           23. Adjacent Properties
                              25. Interpretation & Conclusions
                              26. Recommendations
                              27. References
```

Cada sección: estado (`empty | draft | qp_review | approved`), QP responsable, fecha, contenido markdown + figuras adjuntas, citas a `geo_references`.

### 2.B — Qualified Person (QP) Registry
Tabla `qualified_persons`: nombre, profesión, registro (AusIMM, CIM, SAIMM, etc.), nº licencia, áreas de competencia, CV PDF, firma digital (image storage). Cada sección del reporte se asigna a un QP que firma electrónicamente al aprobar.

### 2.C — Compliance Checklist (auto-validado)
Panel que verifica en tiempo real ante la base de datos:
- ✓ ≥1 sondaje con assays QA/QC pass-rate ≥ 90%
- ✓ ≥1 mapa de propiedad con concesiones vigentes (cruza `mining_concessions.expires_at`)
- ✓ Cadena de custodia completa para muestras (`sample_custody`)
- ✓ Métodos analíticos certificados (lab acreditado ISO 17025)
- ✓ QP asignado a todas las secciones técnicas
- ✓ Disclaimer + caveat statements

Cada item: ✓ verde, ⚠ ámbar (parcial), ✕ rojo. Bloquea export final si falta crítico.

### 2.D — Versionado y entrega
- Snapshots inmutables (`technical_report_versions` con hash SHA-256).
- Export PDF con marca de agua "DRAFT / FINAL / FILED".
- Export adicional: paquete ZIP con apéndices (assay certs, drill logs CSV, JORC↔43-101 cross-walk).

### Tablas nuevas
- `technical_reports` (project_id, title, effective_date, status, lead_qp_id, version)
- `technical_report_sections` (report_id, section_no, title, content_md, status, qp_id, signed_at)
- `qualified_persons` (user_id, profession, registration_body, license_no, signature_url)
- `technical_report_versions` (report_id, version_no, snapshot_jsonb, hash, generated_at)

### Rutas
- `/dashboard/reports/ni43101` (listado)
- `/dashboard/reports/ni43101/$id` (editor por secciones)
- `/dashboard/reports/ni43101/$id/checklist`
- `/dashboard/reports/qp` (registro QPs)

---

## 3. Catastro y Concesiones (gestión avanzada)

Sobre lo existente (`mining_concessions` + capa SERNAGEOMIN nacional) sumamos **vigilancia activa, pago de patentes y due diligence**.

### 3.A — Sync automático SERNAGEOMIN
Edge function `sync-sernageomin` (cron diario) que para cada concesión del proyecto:
- Consulta endpoint ArcGIS por `external_id`/código.
- Detecta cambios en titular, vigencia, superficie, estado.
- Crea alerta tipo `concession_changed` con diff antes/después.

### 3.B — Patentes Mineras (pago anual)
Tabla `concession_patents`: año, monto UTM, estado (`pending | paid | overdue`), fecha pago, comprobante PDF. Calendario visual con UTM convertido a CLP/USD (rate cacheado). Alertas:
- 60 días antes del vencimiento patente → ⚠
- Vencida → ✕ rojo en el mapa

### 3.C — Sobreposición / Conflictos
Detector automático server-side (PostGIS o cálculo TS) que compara concesiones del proyecto vs. capa nacional SERNAGEOMIN y marca:
- Sobreposición con concesión de tercero (potencial conflicto).
- Sobreposición con SNASPE (parque nacional → bloqueo legal).
- Sobreposición con comunidades indígenas (consulta previa requerida).

Cada conflicto → ticket en módulo Approvals con responsable y deadline.

### 3.D — Due Diligence Pack (export)
Botón "Generar DD Pack" para una concesión: PDF con titularidad histórica, patentes pagadas, gravámenes, mapa de sobreposición, fotos del terreno, links a expedientes BCN/CBR. Útil para vender/comprar (alimenta directamente el Marketplace 1.B).

### 3.E — Vigilancia Boletín Minero + PJUD ampliada
Ya existe `bulletin_watch_holders`. Agregar:
- Watch sobre **códigos** de concesión (no solo holders).
- Watch sobre **comunas/regiones** (alerta si publican nueva concesión que se sobrepone con AOI del proyecto).
- Watch sobre **causas judiciales** (mining_court_cases) que mencionen RUT/código.

### Tablas nuevas / extensiones
- `concession_patents` (concession_id, year, amount_utm, status, paid_at, receipt_url)
- `concession_overlaps` (concession_id, overlap_type, overlap_with_id, area_overlap_ha, severity, resolved_at)
- `concession_history` (concession_id, snapshot_jsonb, synced_at) — historial sync
- Extend `bulletin_watch_holders` → renombrar a `bulletin_watches` con tipo (`holder|code|region|court_keyword`)

### Rutas / mejoras
- `/dashboard/catastro` — agregar tabs: **Mis concesiones · Patentes · Conflictos · Vigilancia · Sync log**
- `/dashboard/catastro/$id` — detalle con timeline de cambios + DD pack export

---

## Componentes UI nuevos (lenguaje Command Platform)

- `<MarketplaceCard kind="layer|property" />`
- `<DataRoomGate listingId />` — NDA click-through
- `<ReportSectionEditor sectionNo qpRequired />`
- `<ComplianceChecklist reportId />` — auto-evalúa
- `<QPSignatureBlock qpId />` — firma + sello
- `<PatentCalendar concessionId />`
- `<OverlapMap concessionId />` — Leaflet con conflictos
- `<DDPackButton concessionId />`

Todo bajo `src/components/ops/` siguiendo mono + dots + 11px.

---

## Edge Functions

- `sync-sernageomin` (cron diario) — actualiza `mining_concessions` + crea alertas
- `generate-ni43101-pack` — compila reporte + apéndices a ZIP firmado
- `compute-overlaps` — corre overlay analysis bajo demanda
- `nda-sign` — registra firma click-through con IP/timestamp en audit_log

---

## Orden de ejecución sugerido

**Fase 1 — Catastro avanzado** (base para los otros 2)
1. Migraciones: `concession_patents`, `concession_overlaps`, `concession_history`, extend `bulletin_watches`
2. Edge: `sync-sernageomin`, `compute-overlaps`
3. UI: tabs nuevos en `/dashboard/catastro` + detalle

**Fase 2 — NI 43-101 workflow**
4. Migraciones: `qualified_persons`, `technical_reports`, `technical_report_sections`, `technical_report_versions`
5. Editor por secciones + checklist + firma QP
6. Edge `generate-ni43101-pack`

**Fase 3 — Marketplace ampliado**
7. Migraciones: `property_listings`, `property_deal_inquiries`, `property_data_room_files`, `marketplace_layer_reviews`
8. Rutas marketplace properties + data room + NDA
9. Mensajería Realtime

---

## Resultado esperado

Una plataforma donde un explorador puede: **descubrir** una propiedad en el Marketplace → solicitar **DD pack** generado desde Catastro → firmar **NDA digital** → revisar el **NI 43-101** ya estructurado y firmado por QP → cerrar el deal — todo dentro de Geocapitals, con trazabilidad completa en `audit_log` y datos en vivo de SERNAGEOMIN/Boletín/PJUD.

