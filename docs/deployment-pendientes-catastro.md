# Cierre de pendientes — sistema de catastro (deploy)

Dos piezas quedan fuera de este entorno (necesitan infra de deploy). Aquí están
especificadas para cerrarlas.

## P1 · Cron de vigilancia (G4)

El motor `checkMyWatchlist` (`src/lib/catastroMonitor.functions.ts`) ya funciona con
el botón "Revisar ahora". Falta el disparo **programado** por usuario.

**Opción A — Edge Function + pg_cron (Supabase):**
1. Edge function `watchlist-sweep` que, con service role, itera los usuarios con
   watchlist activa y ejecuta la misma lógica de diff (o llama a un RPC/route).
2. `pg_cron`:
   ```sql
   select cron.schedule('watchlist-sweep','0 */6 * * *',
     $$ select net.http_post(url:='https://<proj>.functions.supabase.co/watchlist-sweep',
        headers:='{"Authorization":"Bearer <service_role>"}'::jsonb) $$);
   ```
3. Notificaciones: al insertar `catastro_alerts`, un trigger o la propia función
   envía email (plantillas `email-templates/catastro-expiration-*`) / push según
   `catastro_watchlist.notify_email/notify_push`.

**Nota de refactor:** extraer la lógica de diff de `checkMyWatchlist` a una función
pura `diffWatch(codes, cache, live) -> alerts[]` reutilizable por el server fn y el
sweep, para no duplicar.

## P2 · Worker de análisis on-demand (G2)

El análisis satelital/geofísico (Sentinel-2 + `harvest_opportunities.py`) es **pesado**
y no corre en el web server. Debe ser un **worker separado**.

- Servicio (contenedor Python, como `services/simpeg-magnetics`) con endpoint
  `POST /analyze { bbox | polygon }` → cola de trabajo → corre cobertura+anomalías
  (Planetary Computer) + harvester (catastro/geoquímica/franjas/yacimientos) →
  guarda el bundle (Storage/DB) → notifica.
- El front encola desde el AOI dibujado y hace polling del resultado; el visor
  consume el bundle ya generado (no computa en el navegador).
- Cachear por celda/geohash para no recomputar sectores ya analizados.

Ambas piezas reusan lo ya construido (conectores Python, motor de diff, tablas de
alertas); solo falta el andamiaje de deploy.
