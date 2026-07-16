
# Módulo de Documentos Editables — Geocapitals

Añadir a `/recursos` un módulo de **Documentos de Transacción** con plantillas editables in-app (NDA, MoU, SPA, LOI, ICPO, NDI, Term Sheet, Royalty Agreement, JV Agreement, Advisory Agreement) para minería y fondos de inversión, con export a PDF con branding Geocapitals.

## Alcance

- Nueva sección en la página `/recursos` bajo el hero ("Documentos de transacción — editables in-app").
- Nueva ruta `/recursos/documentos/$templateId` con editor.
- Sin backend obligatorio (funciona sin login). Opcional: guardar borradores en Supabase si el usuario está autenticado.

## Plantillas incluidas (v1)

Legales / M&A:
- **NDA** (Non-Disclosure Agreement) — mutuo y unilateral
- **NDI** (Non-Disclosure & Non-Circumvention) — típico en trade
- **MoU** (Memorandum of Understanding)
- **LOI** (Letter of Intent)
- **Term Sheet** — inversión / earn-in
- **SPA** (Share Purchase Agreement) — resumen
- **JV Agreement** (esqueleto)
- **Royalty / NSR Agreement**
- **Advisory Agreement**

Trade / commodities (reutiliza `tradeDocGen.ts` existente):
- ICPO, FCO, Commercial Invoice, Packing List

Cada plantilla define: título, partes involucradas, campos dinámicos (nombre, RUT/tax id, fecha, jurisdicción, montos, etc.) y cláusulas parametrizables.

## Arquitectura

```text
src/lib/documents/
  ├─ templates.ts          # catálogo + metadata (id, título, categoría, campos)
  ├─ templates/
  │   ├─ nda.ts            # función que recibe fields → GeneratedDoc
  │   ├─ ndi.ts
  │   ├─ mou.ts
  │   ├─ loi.ts
  │   ├─ termSheet.ts
  │   ├─ spa.ts
  │   ├─ jv.ts
  │   ├─ royalty.ts
  │   └─ advisory.ts
  ├─ documentModel.ts      # tipos compartidos con tradeDocGen (bloques: paragraph, clauses, fields, table, signature)
  └─ documentPdf.ts        # renderer PDF con branding Geocapitals (extiende tradeDocPdf con logo/colores)

src/features/documents/
  ├─ DocumentGallery.tsx   # grid de plantillas por categoría
  ├─ DocumentEditor.tsx    # form (campos) + preview live + botones export
  └─ ClausePicker.tsx      # activar/desactivar cláusulas opcionales

src/routes/
  ├─ recursos.tsx          # + sección "Documentos de transacción" con link
  └─ recursos.documentos.$templateId.tsx  # editor
```

## UX del editor

Layout dividido (desktop) / stacked (mobile):

```text
┌─────────────────────────────┬─────────────────────────────┐
│  Campos del documento       │   Vista previa live         │
│  ─ Partes                   │   ┌───────────────────────┐ │
│  ─ Objeto                   │   │  GEOCAPITALS          │ │
│  ─ Jurisdicción             │   │  NDA Mutuo            │ │
│  ─ Vigencia                 │   │  Ref: NDA-2026-...    │ │
│  ─ Cláusulas opcionales ☑   │   │  ...                  │ │
│                             │   └───────────────────────┘ │
│  [Descargar PDF] [Copiar]   │                             │
└─────────────────────────────┴─────────────────────────────┘
```

- Estado local (no requiere login). Persistencia opcional en `localStorage` por template.
- Cláusulas opcionales como checkboxes (ej. arbitraje CAM Santiago vs. jurisdicción ordinaria, penalidad por incumplimiento, exclusividad, non-circumvention).
- Botón "Restaurar valores por defecto".
- Export PDF usa `documentPdf.ts` (extensión de `tradeDocPdf.ts`) con:
  - Logo Geocapitals en cabecera
  - Colores brand (oro `oklch(0.78 0.14 82)`, negro)
  - Tipografía consistente
  - Footer con disclaimer legal (no constituye asesoría legal)

## Integración con `/recursos`

Nueva sección entre el hero y los módulos del curso:

- Eyebrow: "Documentos de transacción"
- Heading: "Plantillas editables in-app"
- Grid de tarjetas por categoría (Legales, M&A/Inversión, Trade)
- Cada tarjeta → link a `/recursos/documentos/$templateId`

## Detalles técnicos

- Modelo de documento compartido con `tradeDocGen.ts` (bloques `paragraph | clauses | fields | table | signature`) para reutilizar `tradeDocPdf.ts`.
- El renderer PDF se refactoriza levemente: extraer helper `renderDocPdf(doc, { brand: 'geocapitals' })` que aplica logo + colores. `tradeDocPdf.ts` pasa a llamar al helper.
- Sin cambios en base de datos.
- Sin dependencias nuevas (jsPDF + jspdf-autotable ya presentes).
- SEO: `head()` en la ruta del editor con título por plantilla.
- i18n: contenido en español (jurisdicción Chile por defecto, editable).

## Disclaimer

Cada PDF incluye pie: *"Documento generado por Geocapitals como borrador editable. No constituye asesoría legal. Validar con asesores antes de firmar."*

## Fuera de alcance (v2)

- Firma electrónica embebida (ya existe `signature_envelopes`, se puede integrar después)
- Guardado versionado en Supabase
- Colaboración multi-usuario
- Plantillas en inglés
