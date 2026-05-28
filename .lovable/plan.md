
# Informe Técnico Pre-NI 43-101 / JORC — Alto Los Verdes 5 (Tilama)

Proyecto: **LV-TIL-001 · Distrito Cuprífero Los Verdes – Tilama** (Coquimbo, Cu-Au-Ag).
Entregable: **página interactiva navegable + export PDF idéntico**, con escena 3D estilo Datamine embebida y secciones pre-NI 43-101 completas. Datos reales del backend + IA Lovable (`google/gemini-2.5-pro`) rellenando vacíos como "modelo preliminar" claramente etiquetado.

---

## 1. Datos reales ya disponibles en backend

Verificado para `project_id = 7a499b02-…`:

| Capa | Cantidad | Fuente |
|------|---------:|--------|
| Concesiones catastro | 15 | `mining_concessions` |
| Anomalías satelitales | 45 | `satellite_anomalies` |
| Vetas modeladas | 6 | `veins` |
| Exploration targets | 108 | `exploration_targets` |
| Mag targets | 10 | `mag_targets` |
| Resource model | 1 | `resource_models` |
| Sondajes históricos | 0 → **IA preliminar** |
| Geofísica IP/Mag | 0 → **IA preliminar** |
| QAQC | 0 → **IA preliminar** |

Todo lo marcado "IA preliminar" lleva watermark visible en informe y panel: *"Modelo preliminar generado por IA — no apto para reporte NI 43-101 / JORC público sin campaña de validación"*.

---

## 2. Arquitectura del entregable

```text
src/routes/_authenticated.reports.losverdes.pre43101.tsx   ← página interactiva
src/routes/api/reports/losverdes-pdf.ts                    ← endpoint export PDF (server route)
src/features/reports/pre43101/
  ├─ Pre43101Shell.tsx          ← layout con TOC sticky + secciones
  ├─ sections/
  │   ├─ ExecutiveSummary.tsx   ← §1 Summary
  │   ├─ PropertyCatastro.tsx   ← §2 Property + 15 concesiones + mapa
  │   ├─ Geology.tsx            ← §3 Regional + local + alteración
  │   ├─ Exploration.tsx        ← §4 Sat (45) + Geofísica IA
  │   ├─ Drilling.tsx           ← §5 Sondajes (IA preliminar)
  │   ├─ SampleQAQC.tsx         ← §6 QAQC IA preliminar
  │   ├─ MineralResource.tsx    ← §7 Resource model + 6 vetas
  │   ├─ Targets3D.tsx          ← §8 Visor 3D Datamine embebido (foco)
  │   ├─ RiskOpportunities.tsx  ← §9
  │   └─ Recommendations.tsx    ← §10 Plan + presupuesto + QP
  ├─ data/usePre43101Data.ts    ← un solo serverFn que devuelve todo
  ├─ ai/generateNarrative.functions.ts ← IA por sección
  └─ export/pdfBuilder.ts       ← jspdf + html2canvas para PDF idéntico
```

### Visor 3D Datamine embebido

Reutiliza `LosVerdesEngine3D` (motor ya existe con DEM Martini + ESRI drape + isosurface + drillholes + block model + AI targets). En la sección §8 se monta con:

- Modo **Cinematic** por defecto (no Debug)
- Camera fly-through automático: catastro → anomalías sat → vetas → sondajes → targets
- Panel lateral con `AITargetTable` (top 10 targets rankeados)
- Botón **"Snapshot al PDF"** que captura WebGL → canvas → embebe en página correspondiente

### Export PDF

Server route `/api/reports/losverdes-pdf` recibe el `reportId`, renderiza con Puppeteer **no** (no compatible Workers) → usa **`@react-pdf/renderer`** server-side replicando layout, con snapshots del 3D capturados previamente desde el cliente y subidos a Supabase Storage (`reports/losverdes/{reportId}/snap-*.png`).

---

## 3. Secciones del informe (estándar NI 43-101 / JORC Table 1)

| § | Sección | Fuente datos |
|---|---------|--------------|
| 1 | Summary ejecutivo | IA sintetiza KPIs reales |
| 2 | Property & catastro | 15 concesiones reales + estado patentes |
| 3 | Accessibility, climate, infra | IA (Tilama, ruta D-71) |
| 4 | History | IA + minas vecinas conocidas |
| 5 | Geological setting | IA + 6 vetas reales |
| 6 | Deposit types | IA (IOCG / pórfido Cu-Au) |
| 7 | Exploration | 45 anomalías sat reales + mapa |
| 8 | Drilling | "Modelo preliminar IA" + 108 targets planificados |
| 9 | Sample prep, QAQC | "Modelo preliminar IA" |
| 10 | Data verification | Auto-check vs. backend |
| 11 | Mineral processing | IA (preliminar) |
| 12 | Mineral resource estimate | 1 resource model real + 6 vetas |
| 13 | Adjacent properties | IA + concesiones vecinas |
| 14 | **Visor 3D Datamine** | LosVerdesEngine3D embebido |
| 15 | Interpretación y conclusiones | IA con todo el contexto |
| 16 | Recomendaciones + presupuesto | IA, fases 1-2-3 con USD |
| 17 | QP statement | Placeholder editable |

---

## 4. Capa IA (Lovable AI Gateway)

`generateNarrative.functions.ts` — `createServerFn` por sección, modelo `google/gemini-2.5-pro`, structured output con Zod:

```ts
Output.object({ schema: z.object({
  title: z.string(),
  paragraphs: z.array(z.string()),
  bullets: z.array(z.string()).optional(),
  tables: z.array(z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) })).optional(),
  warnings: z.array(z.string()).optional(), // marca "preliminar"
}) })
```

Cache por `(project_id, section, data_hash)` en tabla `report_section_cache` para no re-llamar IA en cada visita. Regenerar bajo demanda con botón.

---

## 5. Migración DB

Una sola tabla nueva:

```sql
CREATE TABLE public.report_section_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  section text NOT NULL,
  data_hash text NOT NULL,
  payload jsonb NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, section, data_hash)
);
-- GRANTs authenticated + service_role, RLS por organization_id via projects join
```

Bucket Storage `reports` (privado) para PDFs + snapshots 3D.

---

## 6. Navegación

- Link nuevo en `/dashboard` → "Informe pre-NI 43-101" (visible solo en proyectos con `commodity` minero).
- Ruta: `/_authenticated/reports/losverdes/pre43101`
- Botón flotante **"Descargar PDF"** persistente.

---

## 7. Orden de ejecución (un solo turno de build)

1. Migración `report_section_cache` + bucket `reports`
2. `usePre43101Data` serverFn (agrega los 11 queries de §1 en uno)
3. `generateNarrative` serverFn IA + cache
4. `Pre43101Shell` + 10 componentes de sección
5. Embeber `LosVerdesEngine3D` en `Targets3D.tsx` con fly-through
6. `pdfBuilder` con `@react-pdf/renderer` (instalar dep)
7. Server route `/api/reports/losverdes-pdf`
8. Link en dashboard + ruta TanStack

---

## 8. Detalles técnicos

- **No nuevas deps 3D**: el motor ya existe (`LosVerdesEngine3D` + `TerrainMartiniLayer` + `AnomalyIsosurfaceLayer` + `DrillholesLayer` + `BlockModelLayer`).
- **Nueva dep**: `@react-pdf/renderer` (Worker-compatible, pure JS).
- **IA**: Lovable AI Gateway con `google/gemini-2.5-pro`, secret `LOVABLE_API_KEY` ya provisionado.
- **Snapshots 3D**: capturados client-side con `gl.domElement.toDataURL('image/png')` desde el `Canvas` de R3F, subidos vía `supabase.storage.from('reports').upload()`.
- **i18n**: informe completo en **español** (consistente con producto), con switch ES/EN futuro.
- **Watermark "preliminar"**: badge rojo en cada sección IA + nota legal al pie del PDF.

---

## 9. Fuera de alcance

- Firma digital QP (placeholder editable, sin DocuSign integrado en esta iteración).
- Estimación de recursos real (se usa el 1 modelo ya existente; no se re-corre kriging).
- Traducción EN/FR del PDF.
- Publicación a SERNAGEOMIN o sitio público (informe queda privado al proyecto).

