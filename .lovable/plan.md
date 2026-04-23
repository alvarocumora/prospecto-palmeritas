

# Plan estratégico — Geocapitals como sistema real de geología, catastro y consulta legal

## Diagnóstico del estado actual

El sistema ya tiene una base muy sólida (30 rutas, 26 tablas con RLS, capas SERNAGEOMIN/Sentinel/EMAG2 reales, auth + roles + audit log). Los **3 ejes centrales** que pediste revisar están en estos niveles de madurez:

| Eje | Estado | Brecha vs sistema real |
|---|---|---|
| **Catastro minero** | 80% — fetch live SERNAGEOMIN ArcGIS, popups con titular/RUT/comuna, expiry alerts, panel filtrable, sync history | Falta: cron sync automático, alertas email, intersección oficial AOI vs catastro, watchlist multi-titular, histórico de cambios visualizado |
| **Geofísica** | 60% — CRUD de surveys/líneas/estaciones, captura GPS offline, EMAG2/WGM2012 regionales | Falta: visualización de grid magnético interpolado, reducción al polo, filtros (RTP, derivada vertical), perfiles 2D, integración con targets |
| **Consulta legal** | 30% — `mining_bulletins` y `mining_court_cases` con auto-match a holders, sync stub PJUD/Boletín | Falta: scraping real Boletín Minero PDF, búsqueda federada, alertas legales, expediente consolidado por concesión, due diligence automatizado |

Ya existe un `.lovable/plan.md` enfocado en 5 olas geocientíficas (geochem PCA, lineamientos, 3D implícito, drill recon, NI 43-101 IA). Ese plan es bueno pero **no cubre los ejes legal/catastro** que ahora priorizas.

---

## Plan propuesto — 4 fases ordenadas por ratio impacto/riesgo

### Fase A · Catastro de grado profesional (semana 1)
Convertir el módulo catastro de "viewer + CRUD" a **sistema de vigilancia jurídica continua**.

1. **Sync automático SERNAGEOMIN** — cron diario (pg_cron → `/api/public/sync-catastro`) que:
   - Refresca todas las concesiones del proyecto contra ArcGIS oficial.
   - Detecta cambios (titular, superficie, vigencia, estado) y los inserta en `concession_history` con diff JSON.
   - Marca concesiones desaparecidas como `status='vencida'`.
2. **Watchlist por titular/RUT** — usuario marca un RUT/empresa y recibe alerta cuando aparezca en una concesión nueva, manifestación, o boletín. Tabla `holder_watches` ya existe → activar el flujo end-to-end.
3. **Alertas email** (Resend vía edge function): vencimiento <90 días, cambio de titular detectado, nueva concesión vecina dentro de buffer 1 km de AOI.
4. **Intersección AOI ↔ catastro** real con turf.js: porcentaje exacto de overlap, hectáreas en conflicto, exportable a PDF para el QP.
5. **Vista "Expediente concesión"** — drawer con: ficha SERNAGEOMIN actual + histórico de cambios cronológico + boletines vinculados + casos judiciales del titular + archivos adjuntos + mapa centrado.

### Fase B · Consulta legal real (semana 2)
Pasar del stub `sync-pjud` a un **buscador legal-minero funcional**.

1. **Scraper Boletín Oficial de Minería** — edge function que descarga el PDF semanal, extrae con `pdf-parse` (Worker-compat) las publicaciones de manifestaciones/mensuras/sentencias, normaliza titular/RUT/comuna, e inserta en `mining_bulletins`. Auto-match con `concession_holders` ya está implementado vía trigger `trg_match_bulletin_holders`.
2. **Búsqueda PJUD** — integración con la API pública del Poder Judicial para causas mineras (materia 1407, 1408). Tabla `mining_court_cases` y trigger de match ya existen.
3. **Búsqueda federada** en una sola caja: por RUT, nombre titular, código de concesión, comuna. Devuelve concesiones + boletines + causas + watches en resultados unificados.
4. **Due diligence report** — botón en perfil de holder: PDF con todas las concesiones, deudas de patentes (cruce con `concession_patents`), litigios activos, publicaciones boletín último año.
5. **Alertas legales** — notificación cuando aparece una nueva causa contra un titular en watch, o cuando se publica una manifestación dentro del AOI del proyecto.

### Fase C · Geofísica visual y analítica (semana 3)
Llevar el módulo de "tabla de estaciones" a **mapa interpretable**.

1. **Grid interpolado en cliente** — tomar `geophysics_stations` con valor magnético/IP, interpolar con IDW (JS puro) sobre canvas, renderizar como capa raster en Leaflet con paleta cyan-magenta. Toggle de opacidad y rango.
2. **Reducción al polo y derivada vertical** — edge function `geophysics-process` que aplica RTP y 1ra derivada vertical sobre el grid. Resultados cacheados en `geophysics_processed_grids`.
3. **Perfiles 2D** — herramienta de dibujo: el usuario traza una línea y se genera un gráfico de perfil con valores interpolados a lo largo, descargable.
4. **Importación Geosoft GXF / XYZ** — parser para los formatos estándar de la industria, no solo CSV.
5. **Cruce magnetometría × targets** — los targets de exploración heredan automáticamente el valor magnético del grid en su centroide (alimenta el score de prospectividad existente).

### Fase D · Integración geocientífica (semana 4)
Conectar las 3 fases anteriores con la **Ola 1 del plan original** (Geochemical Fingerprint PCA).

1. **PCA + k-means sobre samples** (Ola 1 del plan existente) — firma del depósito y generación automática de targets desde clusters geoquímicos.
2. **Score unificado de prospectividad** combinando: anomalía magnética (Fase C), densidad de lineamientos estructurales, firma geoquímica (Ola 1), proximidad a vetas mapeadas, ausencia de conflictos catastrales (Fase A).
3. **Dashboard ejecutivo enriquecido** — agregar tarjetas "Vigencia catastral" (% concesiones >90 días), "Alertas legales abiertas", "Cobertura geofísica" (% AOI cubierto).

---

## Detalles técnicos

- **Edge functions nuevas**: `sync-catastro` (cron público), `scrape-boletin-minero`, `sync-pjud`, `geophysics-process`, `geochem-fingerprint`, `due-diligence-report`, `notify-alerts`.
- **Tablas nuevas**: `concession_alerts` (tipo, severidad, leído, payload), `geophysics_processed_grids` (survey_id, type=RTP|VD1, raster_url, bbox), `geochem_analyses` (run_id, pca_loadings, clusters JSON, pathfinder_scores).
- **Cron**: `pg_cron` extension activada → llama a URLs estables `project--{id}.lovable.app/api/public/sync-catastro` y `/api/public/scrape-boletin` con header `x-cron-secret` validado por HMAC.
- **Storage**: bucket nuevo `geophysics-grids` (privado, RLS por proyecto) para los rasters interpolados PNG, y `legal-docs` para PDFs de boletines.
- **Email**: Resend connector — templates para "vencimiento concesión", "cambio detectado", "nueva publicación boletín", "causa judicial nueva".
- **Librerías compatibles Worker**: `turf.js` (intersección), `ml-pca` + `ml-kmeans` (geoquímica), `pdf-parse` (boletín), todas pure-JS sin native bindings.
- **Seguridad**: RLS estricto en todas las tablas nuevas con `has_project_role`, endpoints `/api/public/*` validan firma HMAC del cron, scraping respeta robots.txt y rate-limit.
- **No tocar**: `auth.tsx`, `useAuth.tsx`, `client.ts`, `types.ts`, ni el shell del router. Las fases extienden, no rompen.

---

## Recomendación de arranque

Empezar por **Fase A (Catastro profesional)** porque:
1. El 80% de la infraestructura ya está (tablas `concession_history`, `holder_watches`, `concession_overlaps`, edge function `sync-sernageomin` stub, hook `useUnreadCatastroAlerts`).
2. Es el módulo más visible para el usuario final (abogado/QP minero).
3. Desbloquea el flujo de alertas que reutilizará Fase B (legal) y D (dashboard).
4. Riesgo bajo: solo agrega cron + email + un drawer; no toca esquema crítico.

Al aprobar este plan, implemento Fase A completa: cron + watchlist activa + alertas email + intersección turf + drawer expediente. Las fases B/C/D se ejecutan secuencialmente en mensajes posteriores para mantener cada cambio revisable.

