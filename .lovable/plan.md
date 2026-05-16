
## Objetivo
Mientras se ejecuta `runSatelliteAnalysisOnTargets`, mostrar al usuario una barra de progreso con estado granular (índice actual, runs creados, anomalías insertadas) que se actualiza en vivo a medida que el server fn escribe filas en la base.

## Estrategia: Supabase Realtime (sin refactorizar el server fn)

El server fn ya inserta secuencialmente 4 runs (uno por índice) y luego N anomalías por run con `pipeline_version='target-batch-v1'`. En vez de convertirlo a streaming, escuchamos los `INSERT` en tiempo real desde el cliente — funciona porque Realtime ya está disponible para esas tablas.

Pasos esperados:
- 4 runs en `satellite_analysis_runs` (uno por índice elegido)
- N×4 anomalías en `satellite_anomalies` (N = targets enviados, típicamente 10 ⇒ 40)

## Cambios

### 1. Migración: habilitar realtime en las tablas

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.satellite_analysis_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.satellite_anomalies;
ALTER TABLE public.satellite_analysis_runs REPLICA IDENTITY FULL;
ALTER TABLE public.satellite_anomalies REPLICA IDENTITY FULL;
```
(idempotente: envolver en `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`)

### 2. Nuevo hook `src/hooks/useSatelliteAnalysisProgress.ts`

```ts
useSatelliteAnalysisProgress({
  projectId,
  enabled,           // true mientras runSat.isPending
  startedAt,         // Date marca de inicio
  expectedRuns,      // 4
  expectedAnomalies, // targetCount * indexCount
}) => {
  runsDone, anomaliesDone, currentIndex, percent, stage
}
```

Internamente:
- Abre un `channel('sat-progress-<projectId>')` con dos `postgres_changes`:
  - `event:'INSERT', schema:'public', table:'satellite_analysis_runs', filter:'project_id=eq.<id>'`
  - `event:'INSERT', schema:'public', table:'satellite_anomalies', filter:'project_id=eq.<id>'`
- Filtra por `created_at >= startedAt` y `pipeline_version === 'target-batch-v1'` (runs) para no contar inserciones ajenas.
- Mantiene `currentIndex` = `index_code` del último run recibido.
- `percent` = `0.3 * runsDone/expectedRuns + 0.7 * anomaliesDone/expectedAnomalies` (clamp 0–100).
- Cleanup: `supabase.removeChannel` cuando `enabled=false` o al desmontar.

### 3. Nuevo componente `src/components/targets/SatelliteAnalysisProgress.tsx`

- Usa `<Progress />` de shadcn + chips de estado por índice (`IRON_OXIDE`, `CLAY_MINERALS`, `HYDROTHERMAL_ALTERATION`, `STRUCTURAL_LINEAMENTS`) con check cuando su run aparece.
- Línea de texto: `Procesando {currentIndex} · {runsDone}/4 índices · {anomaliesDone}/{expectedAnomalies} anomalías`.
- Aparece como banner sticky encima del mapa/tabla cuando `runSat.isPending`.

### 4. Wire en `src/routes/_authenticated.dashboard.targets.tsx`

- En `handleRunSatellite`: setear `runStartedAt = new Date()` y `expectedAnomalies = top10.length * 4` antes de `mutateAsync`.
- Renderizar `<SatelliteAnalysisProgress … />` cuando `runSat.isPending`.
- Al `onSuccess` del mutation, invalidar `['project-satellite-anomalies', projectId]` y `['project-mining-concessions', projectId]` para que el mapa repinte las capas (los hooks existentes ya usan TanStack Query).
- Mantener el toast final actual ("Análisis listo · X índices · Y anomalías").

## Detalles técnicos
- No tocar la firma ni el cuerpo del server fn — sigue devolviendo el resumen al final.
- Realtime usa la sesión del usuario y respeta RLS existentes en ambas tablas.
- Si Realtime se cae, el `onSuccess` del mutation sigue cerrando el progreso al 100% como fallback.
- Solo afecta UI/datos; sin cambios en PDF ni en la lógica de análisis.

## Verificación
1. SQL: confirmar que las dos tablas figuran en `pg_publication_tables` con `pubname='supabase_realtime'`.
2. UI: pulsar el botón → ver barra avanzando, chips de índices iluminándose, contador de anomalías subiendo.
3. Backend: tras finalizar, `SELECT count(*) FROM satellite_analysis_runs WHERE pipeline_version='target-batch-v1'` debe coincidir con `runsDone` mostrado.
