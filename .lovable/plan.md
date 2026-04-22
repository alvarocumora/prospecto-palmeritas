

# Estado de la Plataforma Geocapitals + Plan para Convertirla en Operativa Real

## Diagnóstico actual

**Lo bueno (ya implementado y conectado a DB):**
- 61 tablas en Supabase con RLS activo y políticas por rol de proyecto
- 30 rutas frontend, todas con componente real (no quedan stubs vacíos)
- 41 hooks conectando UI ↔ Supabase
- Edge functions activas: `geo-assistant`, `geo-brief`, `prospectivity-grid`, `compute-overlaps`, `dem-diff`, `extract-raster-metadata`, `section-interpret`, `stockpile-volume`, `sync-sernageomin`, `send-project-invitation`
- Cron hooks: `sync-boletin-minero`, `sync-pjud`
- 1 proyecto demo creado (`Prospecto Las Palmeras`)

**El problema real (no es código, es DATOS):**
La mayoría de tablas operativas están **vacías**. La plataforma "funciona" pero parece muerta:

| Módulo | Filas en DB | Estado |
|---|---|---|
| drill_holes / drill_core_logs | 0 / 0 | Vacío |
| sampling_results / sample_custody | 0 / 0 | Vacío |
| qaqc_results / qaqc_standards | 0 / 0 | Vacío |
| exploration_targets / campaigns | 0 / 0 | Vacío |
| core_boxes (inventario) | 0 | Vacío |
| campaign_budgets / expenses | 0 / 0 | Vacío |
| hse_permits / incidents / community | 0 / 0 / 0 | Vacío |
| mining_concessions / holders / patents | 0 / 0 / 0 | Vacío |
| mining_bulletins / court_cases | 0 / 0 | Sin sync ejecutado |
| drone_flights / rasters | 0 / 0 | Vacío |
| qualified_persons / technical_reports | 0 / 0 | NI 43-101 sin firma |
| property_listings (marketplace deals) | 0 | Sin escaparate |
| audit_log | 0 | Triggers no se han disparado |

**Solo tienen datos:** `geophysics_surveys (3)`, `geophysics_stations (40)`, `mineralogy (18)`, `lithology_units (4)`, `alteration_zones (3)`, `geological_features (3)`, `shared_layers (3)`, `profiles (1)`, `project_members (1)`.

**Gaps de funcionalidad detectados:**
1. **Marketplace de capas** existe pero no hay marketplace de **propiedades/deals** UI (las tablas `property_listings`, `property_deal_inquiries`, `property_deal_messages`, `property_data_room_files` existen pero no hay ruta).
2. **NI 43-101 firmado por QP** — tabla `qualified_persons` existe pero no hay UI para gestionarlos ni asociarlos a `technical_reports` / `technical_report_versions` / `technical_report_sections`.
3. **Mapa anotaciones** (`map_annotations`) y **vistas guardadas** (`map_views`) tienen tabla pero no se usan visiblemente.
4. **Capabilities por miembro** (`project_member_capabilities`) sin UI de gestión fina.
5. Los crons de Boletín/PJUD nunca se han ejecutado (0 filas) — el botón existe pero no se ha gatillado.

---

## Plan en 4 olas

### Ola 1 — Sembrar el proyecto demo con datos reales y consistentes
Crear una migración SQL `seed` que poblé `Prospecto Las Palmeras` con un dataset coherente para que **toda la plataforma cobre vida** sin tocar UI:

- **3 campañas de exploración** (recon → scoping → drilling) con AOIs
- **8 sondajes DDH** con collares geo-referenciados, `actual_depth` 80–280 m
- **~120 core_logs** distribuidos con litologías, alteraciones y `au_gpt` realistas (incluye intercepts ≥0.5 g/t para activar KPI mensual)
- **~200 sampling_results** (chip, channel, grab) con cadena de custodia (`sample_custody`)
- **~30 qaqc_results** con estándares (CRM), blanks y duplicados (mezcla pass/fail para activar la tasa de fallos)
- **15 exploration_targets** en distintas etapas (generated → drill_ready → drilled)
- **40 core_boxes** ligados a sondajes
- **3 budgets** por categoría + **25 expenses** aprobados/pendientes
- **6 hse_permits** (ambiental, agua, exploración) con vencimientos escalonados (algunos próximos a expirar para activar alertas)
- **4 hse_incidents** y **8 community_events**
- **~80 mining_concessions** sintéticas alrededor del AOI con titulares, geometrías y patentes
- **20 concession_holders** + **40 concession_patents** con vencimientos mixtos
- **2 qualified_persons** + **1 technical_report** firmado de demo
- **5 property_listings** públicas para el marketplace de deals
- **3 drone_flights** + **2 drone_rasters** (referencias a archivos placeholder)
- **3 prospectivity_runs** ya calculados con `prospectivity_cells`

Resultado: dashboard ejecutivo, mapa, todos los módulos muestran información real. Los triggers de `log_audit_change` poblarán `audit_log` automáticamente.

### Ola 2 — Cerrar gaps de UI faltantes
1. **Ruta `/dashboard/deals`**: Marketplace de propiedades mineras (listings públicos, data room por propiedad, mensajería entre comprador/vendedor) usando las tablas `property_*` ya existentes. Reemplaza el "Marketplace" actual o queda como subsección.
2. **Gestión de Qualified Persons** dentro de `/dashboard/ni43101`: agregar/editar QPs, firmar reporte, versionar (`technical_report_versions`), bloquear secciones (`technical_report_sections`).
3. **Saved Views & Annotations** en `/dashboard/map`: panel para guardar la vista actual (extent + capas activas + filtros) y dibujar anotaciones persistentes en la AOI.
4. **Capabilities granulares** en `/dashboard/team`: matriz de permisos por miembro (`project_member_capabilities`) más allá del rol base.

### Ola 3 — Activar las integraciones externas en producción
1. **Disparar `sync-sernageomin`** con la AOI del proyecto para poblar concesiones reales (sustituye/complementa las sintéticas).
2. **Disparar `sync-boletin-minero`** y `sync-pjud` una vez para alimentar `mining_bulletins` y `mining_court_cases`.
3. **Configurar pg_cron** (vía migración) para que ambos hooks corran diariamente sin intervención.
4. **Verificar `FIRECRAWL_API_KEY`** (ya está como secret) y registrar la primera corrida en `concession_history`.

### Ola 4 — Pulido de gobernanza y observabilidad
1. **Activar `password_hibp_enabled`** en auth (chequeo de contraseñas filtradas).
2. **RLS audit pass** con `supabase--linter` para confirmar 0 hallazgos tras el seed.
3. **Botón "Reset demo"** (solo super_admin) que vacía y reseed-ea el proyecto Palmeras para demos.
4. **Notificación visible en sidebar** cuando hay permisos HSE por vencer en <30 días (badge similar al de catastro).

---

## Detalles técnicos

- **Seed**: una sola migración `*_seed_palmeras_demo.sql` idempotente (usa `ON CONFLICT DO NOTHING` por código/identificador natural). Vincula todo a `project_id = '8dc8e288-...-bb7fb85d1745'` y `created_by` = el único `user_id` existente en `profiles`.
- Coordenadas reales centradas en Alhué (-33.898, -71.115). Geometrías GeoJSON simples (puntos para collares/muestras, polígonos pequeños para concesiones, líneas para vetas).
- **Realismo geológico**: distribución log-normal de Au, oxidación somera (0–50 m), sulfuros profundos, intercepts ricos en zonas predefinidas (correlacionables con targets).
- **Sin secrets nuevos**: todo lo necesario ya está configurado.
- **Sin breaking changes** en hooks o componentes existentes.

---

## Entregable de cada ola

| Ola | Cambios | Visible para el usuario |
|---|---|---|
| 1 | 1 migración SQL grande | Cada módulo deja de estar vacío; KPIs muestran números |
| 2 | 1 ruta nueva (`deals`) + 3 paneles nuevos | Marketplace de propiedades funciona; NI 43-101 firmable; mapa con vistas guardadas |
| 3 | Llamada a edge functions + 1 migración pg_cron | Datos oficiales de SERNAGEOMIN/Boletín entran solos |
| 4 | 1 migración (auth setting) + 1 componente badge HSE + botón reset | Plataforma lista para demo a inversores |

---

## ¿Cómo procedemos?

Recomendación: empezar por **Ola 1 (seed)** porque es lo que más impacto visual genera con menos riesgo. Después podemos iterar por olas o saltar a la que prefieras.

