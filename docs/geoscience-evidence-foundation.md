# Geoscience Evidence Foundation v1

Fusión de dos propuestas independientes (documento externo "Integración de
geofísica, magnetometría y detección satelital" + análisis interno GEO-01) tras
auditar el esquema real (`src/integrations/supabase/types.ts`, generado desde la
base viva — no desde `supabase/migrations/*.sql`, que puede contener migraciones
escritas pero no aplicadas todavía; ver "Nota sobre migraciones pendientes"
abajo).

## Auditoría previa (qué existe realmente vs. qué se asumía)

| Tabla propuesta | Estado real antes de esta migración |
|---|---|
| `satellite_anomalies` | Existe, pero sin `sensor/scene_id/method/strength/target_id/raster_asset_id` |
| `satellite_evidence` | Existe. `target_id` apunta a `satellite_targets` (legacy) |
| `satellite_layers`, `satellite_analysis_runs` | Existen, sin cambios necesarios |
| `satellite_targets` | Existe — **concepto de target paralelo y desconectado** de `exploration_targets` |
| `geophysics_anomalies` (no `geophysical_anomalies`) | Existe, ya con `target_id -> exploration_targets` |
| `exploration_targets` | Existe — se declara aquí como **target canónico** de la plataforma |
| `data_sources`, `target_scores`, `target_score_sources` | No existían — creadas en esta migración |
| `geoscience_datasets`, `geoscience_compute_jobs`, `mining_asset_nodes/edges`, `mineral_passports`, `mineral_traceability_events`, `cadastre_reconciliation_*` | **Migraciones ya escritas en el repo (23–25 sep) pero ausentes de `types.ts`** — ver nota abajo |

## Nota sobre migraciones pendientes de aplicar

`supabase/migrations/` es territorio Claude Code (no se poda en el sync de
Lovable), pero escribir el archivo `.sql` en el repo **no implica que ya corrió
contra la base real**. Comparando `CREATE TABLE IF NOT EXISTS public.<tabla>` en
las migraciones más recientes contra `types.ts` (que sí refleja el esquema
vivo), estas 8 tablas de 4 migraciones ya escritas **no aparecen en `types.ts`**:

- `20260925210000_global_mining_asset_graph.sql` → `mining_asset_nodes`,
  `mining_asset_edges`, `mineral_passports`, `mineral_traceability_events`
- `20260925214000_global_geoscience_dataset_registry.sql` → `geoscience_datasets`
- `20260925215500_geoscience_compute_jobs.sql` → `geoscience_compute_jobs`
- `20260923120000_cadastre_reconciliation_audit.sql` → `cadastre_reconciliation_findings`,
  `cadastre_reconciliation_runs`

Esto sugiere que `supabase db push` (o el paso equivalente que aplica
migraciones al proyecto `klfabvnblrcqubvjrzku`) no se ha ejecutado desde esas
fechas, o que `types.ts` no se regeneró después. Este entorno no tiene Supabase
CLI ni credenciales para aplicarlas ni para confirmarlo con certeza — **requiere
verificación humana o de Lovable antes de asumir que esas tablas están
disponibles en producción**. La migración de este documento es aditiva
(`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`) por lo que no depende
de si esas 8 tablas llegaron a aplicarse.

**Actualización (delta GEO-01, `20260928221833_geo01_project_scope_invariants.sql`):**
se volvió a auditar `types.ts` contra el `main` que incluye esta migración
(`geoscience_evidence_foundation.sql`) ya mergeado. Las 8 tablas de la nota
anterior — `mining_asset_nodes`, `mining_asset_edges`, `mineral_passports`,
`mineral_traceability_events`, `geoscience_datasets`, `geoscience_compute_jobs`
— **ya aparecen en `types.ts` con sus columnas completas**, igual que
`data_sources`, `target_scores` y las columnas aditivas de
`satellite_anomalies`/`satellite_evidence` de esta misma migración. El drift
que motivó la advertencia de arriba ya no existe: el gate quedó verde antes de
escribir el delta.

## Alcance de esta migración (`20260927180000_geoscience_evidence_foundation.sql`)

1. **`data_sources`**: catálogo de proveedores/dataset con licencia,
   redistribución y atribución — sembrado con Sentinel-2, Sentinel-1, EMAG2, SRTM.
2. **`satellite_anomalies`**: columnas aditivas `source_id, sensor, scene_id,
   method, method_version, strength, confidence, feature_values,
   processing_parameters, raster_asset_id, target_id`. `target_id` apunta
   directo a `exploration_targets` (no a `satellite_targets`).
3. **Target canónico**: `satellite_evidence.exploration_target_id` (nueva
   columna, nullable) permite enlazar evidencia satelital a
   `exploration_targets` sin romper el enlace legacy
   `satellite_evidence.target_id -> satellite_targets`. Ambas tablas quedan con
   comentario `DEPRECATED` explicando la migración a futuro.
4. **`target_scores` + `target_score_sources`**: scoring versionado con
   `strength`/`confidence`/`completeness` separados por `model_name` +
   `model_version`. Nunca se sobrescribe — cada cómputo es una fila nueva.

## Modelo de scoring (contrato)

```
score_total ∈ [0,100]
confidence  ∈ [0,1]   -- cuánto confiamos en la observación/procesamiento
completeness ∈ [0,1]  -- cobertura ponderada de evidencias disponibles

score_total = Σ (weight_i · strength_i · confidence_i) / Σ weight_i   [por componente i]
```

Componentes iniciales (pesos como hipótesis de trabajo, versionar por tipo de
depósito): satélite 0.25, magnetismo 0.30, geoquímica 0.30, estructural 0.15.

Un score guardado no se sobrescribe: se inserta una fila nueva en
`target_scores`; la UI muestra la más reciente y permite comparar históricas.

## GEO-01 delta: invariantes de aislamiento + API de aplicación

PR sobre esta base (`feat/geo01-evidence-foundation-delta`), sin crear otra
tabla de anomalías, otro registry ni otro grafo — cierra la brecha entre el
SQL ya escrito y una API de aplicación usable.

### Migración `20260928221833_geo01_project_scope_invariants.sql`

- **FKs compuestos `(id/target_id/node_id, project_id)` `NOT VALID`** en
  `satellite_anomalies.target_id`, `satellite_evidence.exploration_target_id`,
  `geophysics_anomalies.target_id`, `target_scores.target_id` y
  `mining_asset_edges.from_node_id`/`to_node_id`: garantizan a nivel de base
  de datos —no solo de RLS— que evidencia/score/edge de un proyecto no puede
  enlazar a un target o nodo de otro proyecto. RLS protege el acceso normal,
  pero una service/secret key se lo salta; el FK compuesto no.
- Quedan **`NOT VALID`** a propósito: no escanean filas históricas en este
  deploy. Antes de un `VALIDATE CONSTRAINT` posterior, correr las queries de
  auditoría cross-project contra la base viva (ver sección siguiente).
- `mining_asset_nodes.node_type` gana `remote_sensing_dataset`, `anomaly` y
  `evidence` al CHECK — el grafo ya puede representar
  `dataset -> anomaly -> evidence -> target` sin otra migración.
- Validado localmente (sin Docker/Supabase CLI en este sandbox: se usó un
  Postgres 16 efímero vía `initdb`/`pg_ctl`, con un esquema sintético que
  replica las columnas reales verificadas contra `types.ts`) y además con un
  test real en CI: `tests/geo/test_geo01_invariants.py` aplica **el archivo
  de migración tal cual** contra el servicio PostGIS de
  `.github/workflows/datum.yml` y prueba que cada cross-project insert falla
  con el nombre de constraint esperado.

### Queries de auditoría antes de `VALIDATE CONSTRAINT`

```sql
select sa.id from public.satellite_anomalies sa
join public.exploration_targets t on t.id = sa.target_id
where sa.target_id is not null and sa.project_id <> t.project_id;

select se.id from public.satellite_evidence se
join public.exploration_targets t on t.id = se.exploration_target_id
where se.exploration_target_id is not null and se.project_id <> t.project_id;

select ga.id from public.geophysics_anomalies ga
join public.exploration_targets t on t.id = ga.target_id
where ga.target_id is not null and ga.project_id <> t.project_id;

select e.id from public.mining_asset_edges e
join public.mining_asset_nodes f on f.id = e.from_node_id
join public.mining_asset_nodes tn on tn.id = e.to_node_id
where e.project_id <> f.project_id or e.project_id <> tn.project_id;
```

Si no devuelven filas, correr en una migración aparte:

```sql
ALTER TABLE public.satellite_anomalies VALIDATE CONSTRAINT satellite_anomalies_target_project_fk;
ALTER TABLE public.satellite_evidence VALIDATE CONSTRAINT satellite_evidence_target_project_fk;
ALTER TABLE public.geophysics_anomalies VALIDATE CONSTRAINT geophysics_anomalies_target_project_fk;
ALTER TABLE public.target_scores VALIDATE CONSTRAINT target_scores_target_project_fk;
ALTER TABLE public.mining_asset_edges VALIDATE CONSTRAINT mining_asset_edges_from_project_fk;
ALTER TABLE public.mining_asset_edges VALIDATE CONSTRAINT mining_asset_edges_to_project_fk;
```

### Contrato de aplicación `ProjectEvidence`

`src/types/projectEvidence.ts` — no es una tabla, es la forma normalizada que
usan UI/scoring/target intelligence para leer evidencia sin conocer el
esquema físico de origen. `targetId`, cuando existe, es siempre
`exploration_targets.id`.

- `src/services/geoscience/evidenceAdapters.ts` — `fromSatelliteEvidence`,
  `fromSatelliteAnomaly`, `fromGeophysicsAnomaly`: funciones puras
  (Row → ProjectEvidence), sin I/O. `fromSatelliteEvidence` usa
  `exploration_target_id`, nunca el `target_id` legacy hacia
  `satellite_targets`. `strength`, `confidence` y `score` nunca se mezclan.
  Provenance ausente se expone como `null`, no se inventa.
- `src/services/geoscience/registryAdapter.ts` — `satelliteRunToDatasetDraft`,
  `geophysicsSurveyToDatasetDraft`, `computeJobToDerivedDatasetDraft`: mappers
  puros hacia `geoscience_datasets` (el `Insert` real generado, no un tipo
  paralelo). Campañas de geofísica se clasifican `DOCUMENTARY` (medición de
  campo); productos satelitales/compute jobs, `DERIVED`.
- `src/services/geoscience/stacAdapter.ts` — `stacItemToDatasetDraft`: mapper
  puro STAC Item → dataset draft, sin HTTP/auth/paginación. Fija el contrato
  de traducción para que **GEO-02** (ingestión real desde Copernicus Data
  Space / Microsoft Planetary Computer — ambos alcanzables y probados desde
  este entorno con Sentinel-2 L2A real de 2026-07-03) no tenga que
  rediseñarlo.
- Tests: `evidenceAdapters.test.ts` (13), `registryAdapter.test.ts` (10),
  `stacAdapter.test.ts` (6, con fixture offline) — 29 tests, deterministas,
  sin red ni base de datos.

### Explícitamente fuera de este delta

- Ingestión HTTP real de Copernicus/Sentinel (GEO-02).
- Descarga/procesamiento de raster.
- Endpoint de scoring (`POST /projects/{id}/targets/{id}/score`).
- Cambios de UI.
- Backfill automático de `satellite_targets` → `exploration_targets`.
- `VALIDATE CONSTRAINT` de los FKs compuestos (paso separado, post-auditoría
  de datos vivos — ver arriba).

## Próximos PRs (no incluidos aquí)

- **GEO-02**: cliente STAC real (Copernicus Data Space / Planetary Computer)
  sobre `stacItemToDatasetDraft`, más ingestión de escenas y cálculo de
  `strength`.
- **PR-C**: endpoint de scoring determinista
  (`POST /projects/{id}/targets/{id}/score`) que escribe en `target_scores`.
- **PR-D**: UI del Project Workspace — capas conmutables, inspector de
  anomalía (source, método, fecha, confidence, contribución al score),
  probablemente consumiendo `ProjectEvidence` directamente.
- **Migración de datos**: mover filas existentes de `satellite_evidence` con
  `target_id` no nulo a `exploration_target_id` cuando exista un
  `exploration_targets` correspondiente (requiere mapeo manual — no automático,
  para no inventar equivalencias).
