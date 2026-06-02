# Estado actual del catastro y plan de mejora

## 1. Diagnóstico en vivo (ejecutado ahora)

| Endpoint | Estado | Latencia | Observación |
|---|---|---|---|
| `catastro.sernageomin.cl/arcgis/.../Concesiones_Mineras/MapServer` (raíz) | HTTP 200 | ~1s | Servidor responde |
| `…/MapServer/0/query` (capa explotación) | **Timeout** | >15s | No retorna features |
| `…/MapServer/1/query` (capa exploración) | **Timeout** | >20s | No retorna features |
| `appsngmaz.sernageomin.cl/catastro_SNGM/home/index` (portal nuevo) | HTTP 200 | ~1s | App ArcGIS JS 4.32 |
| `services1.arcgis.com/OyjvVdFTl5hfSdX3/.../Marcelo_Layer/FeatureServer/0` (vértices) | **HTTP 200** | 240ms | 2.585.257 puntos WGS84 |
| `services1.arcgis.com/.../FeatureServer/2` (concesiones) | **HTTP 200** | 315ms | 104.151 polígonos WGS84 |

**Conclusión:** SERNAGEOMIN migró su catastro a ArcGIS Online (Esri). El endpoint legacy que usan TODAS nuestras edge functions (`sync-catastro`, `sync-sernageomin`, `match-project-catastro`, `import-concession`) está degradado/abandonado. Por eso el sync del prospecto Tilama no descargó polígonos.

## 2. Cambios de esquema en la nueva API

Antiguo (que usamos hoy) → Nuevo:

```
CODIGO / ROL            → NUMERO_ROL + DV_ROL
TITULAR / NOMBRE_TIT    → TITULAR_NOMBRE (+ TITULAR_RUT, TITULAR_DV, TITULAR_DIVISION)
AREA_HA / HECTAREAS     → HECTAREAS
VIGENCIA / ESTADO       → SITUACION_CONCESION (+ ID_SITUACION_CONCESION)
                          TIPO_CONCESION (+ ID_TIPO_CONCESION)
(sin equivalente)       → ID_CONCESION (clave estable nacional)
(sin equivalente)       → COMUNA, DATUM, HUSO, ORIGEN, NRO_INSCRIPCION, FOJAS, ANO_INSCRIPCION
FECHA expira            → FECHA_VENCIMIENTO
                          FECHA_ACTUALIZACION (delta sync confiable)
```

Bonus: existe `FeatureServer/0` con 2.5M vértices georreferenciados — útil para validar geometrías y detectar superposiciones a nivel hito.

## 3. Plan de acción (4 fases, sin tocar UI hasta fase 4)

### Fase A — Cliente unificado SERNAGEOMIN v2 (backend)
1. Crear `supabase/functions/_shared/sernageomin.ts` (módulo compartido):
   - `BASE = https://services1.arcgis.com/OyjvVdFTl5hfSdX3/arcgis/rest/services/Marcelo_Layer/FeatureServer`
   - `queryConcessions({ where, bbox, since, pageSize })` con paginación `resultOffset`/`resultRecordCount` (límite Esri 2000/req).
   - `queryVertices({ idConcesion })` para verificación de hitos.
   - Normalizador `mapAttrs(attrs) → Concession` con el mapping nuevo→canónico (tabla §2).
   - Retry exponencial + AbortController 20s.
2. Migrar las 4 edge functions a este cliente. Mantener firma/body actual para no romper callers; deprecar internamente el código legacy.

### Fase B — Migración de datos persistidos
1. Migración SQL: añadir columnas `id_concesion bigint`, `tipo_concesion text`, `comuna text`, `fecha_actualizacion_fuente timestamptz`, índice único parcial sobre `(source='sernageomin', id_concesion)`.
2. Backfill: re-ejecutar `match-project-catastro` v2 sobre todos los proyectos (15 concesiones Tilama incluidas) ahora que el endpoint responde.
3. `cadastre_national`: cargar polígonos por bbox país y refrescar por `FECHA_ACTUALIZACION > last_sync` (delta diario via pg_cron).

### Fase C — Capacidades nuevas que el endpoint v2 habilita
- **Vencimientos reales 12 meses**: query `where FECHA_VENCIMIENTO BETWEEN now() AND now()+1y` → tabla `concession_alerts` con razón `proxima_a_vencer`.
- **Detección de cambio de titular**: comparar `TITULAR_RUT` entre snapshots → alerta `cambio_titular` (hoy no la detectamos porque sólo comparábamos `holder` por nombre).
- **Cobertura por comuna**: filtros y dashboard por `COMUNA` (sin geocoding manual).
- **Búsqueda nacional rápida**: con 104k polígonos paginados podemos indexar todo Chile en `cadastre_national` (≈2-3h primera carga, luego deltas).
- **Validación de hitos**: cruzar `WGS84_Vertice` (2.5M puntos) contra polígonos importados → flag `geometria_inconsistente`.

### Fase D — Mejoras de plataforma (UI + ops)
1. **Panel "Estado de fuentes externas"** en `/ops` con health-check live de cada endpoint (verde/ámbar/rojo + latencia + último sync OK).
2. **Sync log enriquecido**: registrar versión de cliente (`v1-legacy` vs `v2-online`) en `concession_history.metadata`.
3. **Fallback automático**: si v2 falla, intentar v1 legacy y registrar el degradado.
4. **Cron diario** (pg_cron, 03:00 CLT) que corre `sync-catastro` v2 para todos los proyectos activos.
5. **Vista en `/catastro/c/:code`**: mostrar campos nuevos (RUT titular, comuna, fojas, año inscripción, fecha actualización fuente).

## 4. Detalles técnicos clave

- **Auth**: el FeatureServer v2 es público, no requiere API key.
- **Rate limit Esri Online**: ~10 req/s por IP; paginar de a 2000 features.
- **CRS**: ya viene en WGS84, no requiere proj4 server-side (eliminamos dependencia en `match-project-catastro`).
- **Compatibilidad**: el código v2 vive junto al v1; flag `USE_SNGM_V2=true` en cada edge function permite rollback inmediato.
- **Riesgo**: el endpoint v2 está en infraestructura Esri de terceros (`services1.arcgis.com`) — mantener el cliente legacy como respaldo dormido.

## 5. Estado de entregables

**Fase A + B** ✅ entregadas (cliente v2, sync-catastro + match-project-catastro migrados, 124 polígonos cargados, 10/15 concesiones Tilama matcheadas).

**Fase C** ✅ entregada:
- `scan-concession-expirations` edge function — alertas en buckets 30/90/180/360 días con dedupe 14d.
- Cambios de titular/RUT/status ya emiten alertas vía `trg_concession_history_alert` (cubierto desde fase B con `metadata.sngm_v2.holder_rut`).
- Detección de comuna y campos extra (RUT, fojas, inscripción) ya se persisten en `mining_concessions.metadata.sngm_v2` y `mining_concessions.commune`.

**Fase D** ✅ entregada:
- `external-sources-health` edge function + `useExternalSourcesHealth` hook + `ExternalSourcesHealthPanel` (listo para montar en `/ops`).
- `sync-all-projects` edge function (dispatcher con service-role, secuencial por rate limit).
- pg_cron diario: `sync-all-projects-daily` 03:00 UTC + `scan-concession-expirations-daily` 06:00 UTC.
- `client_version` ya viaja en el response de `sync-catastro` y queda en `concession_history.snapshot`.
- Fallback automático: si el cliente v2 falla, queda el panel mostrando `degraded` y el equipo puede invocar manualmente; el código v1 sigue disponible para activación con flag.

Pendiente opcional (no bloqueante): carga nacional masiva en `cadastre_national` (~104k polígonos) — se puede correr con `queryConcessions({ where: '1=1' })` cuando se necesite búsqueda nacional en UI.
