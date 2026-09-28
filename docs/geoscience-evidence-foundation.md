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

## Próximos PRs (no incluidos aquí)

- **PR-B**: worker `services/geoscience/adapters/copernicus_stac.py` (no Edge
  Function pesada) para ingestión real de escenas y cálculo de `strength`.
- **PR-C**: endpoint de scoring determinista
  (`POST /projects/{id}/targets/{id}/score`) que escribe en `target_scores`.
- **PR-D**: UI del Project Workspace — capas conmutables, inspector de
  anomalía (source, método, fecha, confidence, contribución al score).
- **Migración de datos**: mover filas existentes de `satellite_evidence` con
  `target_id` no nulo a `exploration_target_id` cuando exista un
  `exploration_targets` correspondiente (requiere mapeo manual — no automático,
  para no inventar equivalencias).
