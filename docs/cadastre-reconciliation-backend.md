# Backend — persistencia auditable de reconciliación catastral

**Migración:** `supabase/migrations/20260923120000_cadastre_reconciliation_audit.sql`
**Motor de cálculo (cliente, Lovable):** `src/lib/cadastre/` — `reconcileCadastre`, `buildReconciliationBundle`, `reconciliationGeoJSON`, `buildCadastreDueDiligence`.

El motor corre en el navegador y es efímero. Este backend lo hace **persistente y
auditable**: cada corrida guarda su snapshot de entrada (proyecto + oficial), la salida
anotada y los hallazgos, para poder reproducir y defender la due diligence más tarde.

## Tablas

- `cadastre_reconciliation_runs` — una fila por corrida (summary, snapshots, `created_by`).
- `cadastre_reconciliation_findings` — hallazgos (`severity` INFO/REVIEW/HIGH) por corrida.

**RLS:** lectura solo para `is_gc_staff` o el `created_by` de la corrida. Escritura solo
por RPC (SECURITY DEFINER) o `service_role`.

## RPCs (contrato para la UI)

### Guardar una corrida
```ts
const { data: runId, error } = await supabase.rpc('save_cadastre_reconciliation', {
  p_summary:        bundle.summary,                    // Record<State, number>
  p_result_geojson: reconciliationGeoJSON(bundle),     // FeatureCollection anotada
  p_project_fc:     bundle.project,                    // FeatureCollection de entrada
  p_official_fc:    bundle.official,                   // FeatureCollection oficial
  p_findings:       buildCadastreDueDiligence(bundle).findings,  // [{severity,code,message}]
  p_source:         bundle.source,                     // 'SERNAGEOMIN'
  p_neighbor_km:    5,
  p_project_id:     projectId ?? null,
  p_note:           null,
});
// -> runId: uuid
```

### Obtener una corrida (metadatos + hallazgos, sin los FC pesados)
```ts
const { data } = await supabase.rpc('get_cadastre_reconciliation', { p_run_id: runId });
// -> { run: {...}, has_snapshots: boolean, findings: [{severity,code,message}] }
```

### Listar corridas recientes (ligero, para tablero)
```ts
const { data } = await supabase.rpc('list_cadastre_reconciliations', {
  p_project_id: projectId ?? null,   // null = todas las visibles
  p_limit: 50,
});
// -> [{ id, project_id, source, summary, high_findings, ...counts, created_at, created_by }]
```

## Notas

- `project_feature_count` / `official_feature_count` se derivan en el servidor desde los
  FC (`jsonb_array_length`), no confían en el cliente.
- `project_id` no tiene FK dura (para no chocar con el *drift* histórico de migraciones);
  es un uuid indexado.
- El `disclaimer` del motor de due diligence ("Análisis automatizado de apoyo. No
  constituye estudio de títulos…") debe seguir mostrándose en la UI: el backend guarda
  evidencia, no emite opinión jurídica.
