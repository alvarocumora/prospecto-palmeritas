# Plan: Plataforma de inversión minera con datos reales + IA de oportunidades

## Diagnóstico

Datos reales disponibles en la DB:

- **4 proyectos reales**: La Cornellana, Las Palmeras, Gianfranco, Los Verdes – Tilama
- **117 concesiones** propias + **11.064 concesiones nacionales** (catastro)
- **4.111 yacimientos** (`mineral_deposits`), **209 targets**, **104 anomalías satelitales**, **24 titulares**
- **5 deals** activos, **100 inversionistas ( yo y mis sociedades )**
- Tablas IA ya existentes: `ai_recommendation_traces`, `ai_anomaly_explanations`, `ai_document_embeddings`, `engine_drill_targets`, `prospectivity_cells`/`runs`

Hoy la landing y varios KPIs muestran texto estático. Existe infraestructura (Lovable AI, PostGIS, edge funcs, scene3d) pero falta el módulo de **inteligencia de oportunidades** que cruce catastro + yacimientos + anomalías + titulares y rankee deals.

## Fase 1 — Sustituir contenido estático por datos reales (1 día)

1. **ServerFn `getPlatformStats**` (`src/lib/platformStats.functions.ts`, público, usa `supabaseAdmin`):
  - proyectos activos, concesiones gestionadas, hectáreas, países, targets generados, anomalías detectadas, deals en pipeline.
2. **Landing `MarketingLanding.tsx**`:
  - Sección "Nuestra red global" + "Métricas clave" leen de `getPlatformStats` vía `useQuery`.
  - Carrusel "Proyectos destacados" con los 4 proyectos reales (commodity, región, status, hectáreas, target principal).
3. **Dashboard index** (`_authenticated.dashboard.index.tsx`): KPIs vivos (último target IA, última anomalía, deals abiertos, alertas catastro).

## Fase 2 — Motor IA de Oportunidades sobre Catastro (3-4 días)

Objetivo: que un inversor pinche "Oportunidades" y vea un ranking en vivo de concesiones del catastro nacional con score IA, justificación y acción ("contactar titular", "preparar oferta", "publicar deal").

### 2.1 Tabla `cadastre_opportunities`

```
id, concession_id (fk cadastre_national), score numeric(5,2),
commodity_hint text[], deposit_proximity_km numeric, nearest_deposit_id,
anomaly_overlap_count int, holder_id, holder_risk_score numeric,
patent_status text, expiry_risk text, ai_thesis text, ai_action text,
features jsonb, computed_at timestamptz, model text
```

RLS: lectura `authenticated`, escritura solo `service_role`. Grants estándar.

### 2.2 ServerFn `scoreCadastreOpportunities` (admin, super_admin only)

Pipeline en lotes (cron pg_cron diario + trigger manual):

1. Para cada concesión: PostGIS `ST_Distance` al yacimiento más cercano + count de `satellite_anomalies` que intersectan + estado de patente + edad titular + overlaps.
2. Construye `features` numéricos.
3. Score heurístico inicial (ponderado) + **explicación LLM** vía Lovable AI Gateway (`google/gemini-3-flash-preview`) que devuelve `ai_thesis` (2-3 frases) y `ai_action` (CTA).
4. Persiste en `cadastre_opportunities` + `ai_recommendation_traces`.

### 2.3 Ruta `_authenticated.dashboard.opportunities.tsx`

- Tabla rankeada (score, commodity, región, distancia a yacimiento, anomalías, titular, patente, tesis IA).
- Filtros: commodity, región, score mínimo, riesgo expiración, distancia.
- Panel lateral con mapa MapLibre mostrando la concesión + yacimientos y anomalías cercanas (reutiliza capas existentes).
- Acciones: "Crear deal desde concesión", "Añadir a watchlist", "Contactar titular" (usa `concession_holders` + `investor_contacts`).

### 2.4 Geo-Copilot conversacional

- Reutiliza `geo_copilot_conversations`. Nuevo serverFn `askOpportunityCopilot` que recibe pregunta en español ("muéstrame concesiones de cobre en Atacama con anomalía satelital cerca de Codelco") → traduce a filtros SQL + responde con citas a oportunidades.

## Fase 3 — Marketplace y matching inversor (2 días)

1. **Sembrar `investors**` con 8-12 perfiles institucionales reales/plausibles (juniors, fondos, smelters) — vía herramienta `insert`.
2. `**deal_investor_pipeline` matching**: serverFn `suggestInvestorsForDeal` que cruza `investor_profiles.preferred_commodities/regions/ticket` con el deal.
3. **Página `dashboard.marketplace**`: ya existe — añadir tab "Sugeridos por IA" con el output de matching.

## Fase 4 — Loop de aprendizaje y diferenciación (1-2 días)

- Captura feedback (👍/👎) en cada recomendación → `ai_recommendation_traces.feedback`.
- Re-entrenamiento ligero semanal de pesos heurísticos (job pg_cron) usando feedback acumulado.
- Badge "IA Verified" en deals cuyo target subyacente tenga score > 80 y QP firmado.

## Detalles técnicos

- **Stack**: TanStack Start (`createServerFn` + `requireSupabaseAuth` para lecturas autenticadas; admin client para scoring batch). Sin edge functions nuevas — todo dentro de serverFn / server route.
- **IA**: Lovable AI Gateway, modelo por defecto `google/gemini-3-flash-preview`; structured output con Zod para `{thesis, action, confidence}`.
- **Geo**: PostGIS ya instalado (`ST_DWithin`, índices GIST en `geom`).
- **Cron**: `pg_cron` invoca `/api/public/cron/score-opportunities` (firmado con `WEBHOOK_SECRET`).
- **Seguridad**: RLS estricta (ya hardenizada esta semana); nada del scoring se expone a `anon`.
- **Migraciones**: 1 sola — `cadastre_opportunities` + grants + RLS + índices + job pg_cron.

## Entregables al cerrar

1. Landing y dashboard mostrando solo datos vivos del proyecto.
2. Módulo "Oportunidades IA" con ranking en vivo de las 11k concesiones del catastro nacional.
3. Geo-Copilot que responde en español sobre oportunidades.
4. Marketplace con matching inversor↔deal sugerido por IA.
5. Bucle de feedback persistido para mejorar el modelo.

## Preguntas antes de construir

1. ¿Arranco por **Fase 1 + Fase 2** (datos reales + Oportunidades IA) en esta iteración y dejamos marketplace/feedback para la siguiente?
2. ¿OK sembrar 8-12 perfiles de inversionistas plausibles (con disclaimer "demo") para que el marketplace no aparezca vacío, o prefieres dejarlo vacío hasta tener inversionistas reales?
3. ¿El scoring debe correr sobre **todo el catastro nacional (11k)** o limitarlo a regiones con yacimientos conocidos (Atacama, Antofagasta, Coquimbo) para controlar costo IA?