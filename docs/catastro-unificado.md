# Catastro unificado — un solo sistema, no varios

## Diagnóstico: hoy hay fragmentación en 3 ejes

1. **Dos stacks de datos paralelos** que casi no comparten código:
   - *Público multi-país* (`/catastro/*`, `src/lib/cadastre/`, conectores Chile/Perú/Brasil/Landfolio):
     consulta **en vivo por request** a los ArcGIS oficiales. La caché `public_concessions_cache`
     existe pero **nunca se puebla** → todo pega en vivo.
   - *Por proyecto* (`mining_concessions`, edge functions `sync-catastro`/`match-project-catastro`):
     **persistido** en Supabase, sincronizado contra SERNAGEOMIN.
2. **N mapas distintos** para lo mismo: `LosVerdesStrategicMap`, `LosVerdesPublicScene`,
   `FrancoPertenenciasMap`/`CholquiPertenenciasMap`, `CatastroMap`, `catastro.mapa.tsx`.
   Cada uno reimplementa capas, estilos y fitBounds.
3. **Fuente oficial canónica sin uso central:** `cadastre_national` (la tabla de polígonos
   oficiales) solo la puebla `match-project-catastro`; la búsqueda pública no la usa.

## Objetivo: un solo núcleo de catastro

```
            ┌──────────────────────────────────────────────┐
 Oficiales  │  cadastre_national  (ÚNICA fuente canónica)   │  ← una sync (bbox/país)
 (SNGM,     │  - polígonos oficiales, versionados, indexados│    write-through en cada
  GEOCATMIN,│  - lo llena la MISMA sync para público y proj │    fetch en vivo (cache real)
  ANM…)     └───────────────┬──────────────────────────────┘
                            │ join por match (rol/nombre/geom)
            ┌───────────────┴──────────────────────────────┐
 Proyecto   │  mining_concessions (registros del proyecto)  │  ← link a cadastre_national
            │  + cadastre_reconciliation_runs/_findings     │    (reconciliación auditable)
            └───────────────┬──────────────────────────────┘
                            │
            ┌───────────────┴──────────────────────────────┐
   UI       │  <CadastreMap scope=… /> UN componente        │  ← público (país/bbox) o
            │  searchCadastre(scope)   UNA API de búsqueda  │    proyecto (project_id)
            └──────────────────────────────────────────────┘
```

**Principios**
- **Una tabla canónica de oficiales:** `cadastre_national`. Se elimina `public_concessions_cache`
  (muerta) y su rol lo cumple `cadastre_national`.
- **Una sync con write-through:** cada vez que se consulta un ArcGIS en vivo, el resultado se
  **persiste** en `cadastre_national`. La próxima consulta lee de la DB (no del ArcGIS). Esto mata
  el "live en cada request" y unifica la fuente pública y la de proyecto.
- **Una API de búsqueda:** `searchCadastre({scope})` con scope `país` | `bbox` | `project`.
  Reemplaza `searchGlobalCadastre`, `searchConcessions`, `searchMiningCadastre`.
- **Un componente de mapa:** `<CadastreMap scope layers />` parametrizable; los mapas por
  proyecto pasan `project_id`, los públicos pasan país/bbox.
- **Una reconciliación persistida:** el motor en memoria escribe a `save_cadastre_reconciliation`
  (ya existe el backend; hoy está huérfano).

## Ruta incremental (no rompe nada de golpe)

1. **Write-through**: en los conectores/`searchCadastre`, tras un fetch en vivo, upsert a
   `cadastre_national` (RPC `upsert_cadastre_feature`). Búsqueda pública: leer DB primero,
   vivo solo en miss. → colapsa los dos stacks en uno.
2. **Match desde DB**: `match-project-catastro` deja de descargar; lee `cadastre_national`
   por bbox. Una sola descarga alimenta a todos.
3. **Un mapa**: extraer `<CadastreMap>` de `LosVerdesStrategicMap` (el más completo, MapLibre)
   y migrar las demás páginas a él. Regla dura: **no filtrar silenciosamente** concesiones sin
   geometría; mostrarlas listadas con badge "sin polígono".
4. **Wire reconciliación**: `_authenticated.dashboard.catastro.tsx` → `save_cadastre_reconciliation`
   al terminar; historial con `list_cadastre_reconciliations`.
5. **Borrar lo muerto**: `sync-sernageomin` (host caído), `public_concessions_cache`,
   y unificar la lógica de alertas de expiración.

## Backend a versionar (mi territorio — quita drift)

- `upsert_cadastre_feature`, `is_super_admin`, `is_project_member` y otras existen en la nube
  pero no todas están versionadas en `supabase/migrations` (drift de Lovable). Versionarlas
  idempotentes para que el "un solo sistema" sea reproducible.
- FK `mining_concessions.cadastre_national_id` (link explícito al polígono oficial) si no existe.

---

## PROMPT 1 (Lovable) — destapar el error real del sync de catastro

> En `src/lib/losverdes5-catastro.functions.ts`, el manejo de error del invoke descarta el
> cuerpo real de la edge function y solo deja el string genérico "non-2xx status code".
> Cámbialo para extraer el detalle del `error.context` (Response) de supabase-js:
>
> ```ts
> const { data: result, error } = await supabaseAdmin.functions.invoke("match-project-catastro", {
>   body: { projectId: TILAMA_PROJECT_ID, radiusKm: data.radiusKm ?? 15, dryRun: data.dryRun ?? false },
> });
> if (error) {
>   let detail = error.message;
>   try {
>     const body = await (error as { context?: Response }).context?.json?.();
>     if (body?.error) detail = String(body.error);
>   } catch { /* sin cuerpo legible */ }
>   return { ok:false, fetched:0, upserted_to_national:0, matched:0, unmatched:0, results:[], error: detail };
> }
> ```
>
> Aplica el mismo patrón a cualquier otro server fn que invoque edge functions y muestre
> "non-2xx" al usuario (p.ej. `sync-catastro`, `sync-boletin-minero`, `sync-pjud`).

## PROMPT 2 (Lovable) — un solo catastro (fase 1: fuente única + un mapa)

> Consolidar el catastro en un solo sistema. Fase 1, sin romper rutas existentes:
>
> 1. **Fuente única de oficiales.** Hacer que la búsqueda pública lea de `cadastre_national`
>    primero y solo consulte el ArcGIS en vivo si no hay filas; tras un fetch en vivo, hacer
>    **write-through** (upsert a `cadastre_national` vía `upsert_cadastre_feature`). Marcar
>    `public_concessions_cache` como deprecada (dejar de leerla).
> 2. **Un componente de mapa reutilizable** `src/components/catastro/CadastreMap.tsx`, extraído
>    de `LosVerdesStrategicMap` (MapLibre, es el más completo). Props: `{ scope: {kind:"project",
>    projectId} | {kind:"bbox",bbox} | {kind:"country",code}, layers }`. Debe:
>    - Dibujar concesiones con/ sin geometría: las **sin** polígono se listan en el panel con
>      badge "sin polígono" (NO se descartan en silencio como hoy en
>      `losverdes-map.functions.ts:54`).
>    - Reusarse en `/live/losverdes`, `/live/cholqui`, `catastro.mapa.tsx` y el dashboard.
> 3. **Una API de búsqueda** `searchCadastre({scope})` que envuelva y reemplace progresivamente
>    `searchGlobalCadastre` / `searchConcessions` / `searchMiningCadastre`.
> 4. Distinguir **"fuente caída" de "0 resultados"** en `src/lib/cadastre/arcgis.ts` y `sngm.ts`
>    (hoy ambos devuelven `[]`/`null` indistinguible) y propagar el estado a la UI.
>
> No borrar rutas ni tablas todavía; esto es aditivo. Las fases 2 (match desde DB), wire de
> reconciliación (`save_cadastre_reconciliation`) y limpieza de `sync-sernageomin` van aparte.
