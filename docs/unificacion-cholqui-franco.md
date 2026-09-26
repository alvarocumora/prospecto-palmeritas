# Unificación Cholqui = Franco + mejoras del catastro

**Cholqui y Franco son el mismo proyecto.** "Distrito Franco / Gianfranco" es el
nombre anterior del **Proyecto Cholqui** (Cu-Au-Ag, Melipilla, RM). El nombre
canónico es **Cholqui**; "franco"/"gianfranco" son alias históricos.

Este documento define (1) qué ya está unificado, (2) el trabajo de consolidación
en `/src` (prompt para Lovable), (3) lo hecho en backend (mi territorio), y
(4) las mejoras prioritarias del sistema de catastro.

---

## 1. Estado actual de la unificación

- **Data: YA unificada.** Todo deriva de la fuente única `src/features/franco/data/cholqui.ts`
  (`export const CHOLQUI`). `data/project.ts` expone `FRANCO_PROJECT` derivado de
  `CHOLQUI` con la nota "no editar valores aquí".
- **Rutas:** `/live/franco` ya hace 301 → `/live/cholqui`. `/dashboard/franco` aún existe.
- **Catálogo público** (`src/lib/projects/catalog.ts`): slug canónico `cholqui`,
  `aliases: ["franco","gianfranco"]`. Correcto.
- **Pendiente:** el *nombre* "Franco" sigue en el directorio, componentes, consts,
  query-keys y en la fila del proyecto en la DB (`projects.name ~ 'Gianfranco'`).

## 2. Backend — hecho (mi territorio, migración `20260923140000`)

La RPC de cruce catastral `franco_match_pertenencia(jsonb,text)` es **project-neutral**
(cruza cualquier polígono contra `mining_concessions`; "franco" era solo herencia).

- Se creó `match_concessions_by_geometry(jsonb,text)` — nombre genérico, cuerpo idéntico.
- `franco_match_pertenencia` ahora es un **wrapper de compatibilidad** que delega en ella.
- Ambas con `GRANT EXECUTE` solo a `authenticated`/`service_role`. Validado en Postgres.

→ El código nuevo debe llamar **`match_concessions_by_geometry`**. El nombre viejo
sigue funcionando hasta que `/src` migre.

## 3. Consolidación en `/src` — PROMPT PARA LOVABLE

> Consolidar el proyecto "Franco/Gianfranco" bajo su nombre canónico **Cholqui**.
> Es un renombre, no un cambio de lógica ni de datos (la data ya deriva de `CHOLQUI`).
>
> **Directorio y símbolos**
> - Renombrar `src/features/franco/` → `src/features/cholqui/` y actualizar todos los imports.
> - `FrancoDashboard` → `CholquiDashboard` (usado en `live.cholqui.tsx`,
>   `_authenticated.dashboard.cholqui.tsx`, `_authenticated.dashboard.project-report.tsx`).
> - Componentes `Franco*` → `Cholqui*`: `FrancoHero`→`CholquiProjectHero`,
>   `FrancoPertenenciasMap`→`CholquiPertenenciasMap`, `FrancoPertenenciasPanel`,
>   `FrancoNI43101DraftPanel`, `FrancoTopNav`, `FrancoTabPlaceholder`.
> - `FRANCO_PROJECT` → `CHOLQUI_PROJECT` en `data/project.ts` (mantener derivado de `CHOLQUI`).
> - Archivos `franco-cadastre.functions.ts`, `spvCertificatePdf.ts`, `cholquiPdf.ts`:
>   mantener funcionalidad; renombrar `franco-cadastre.functions.ts` → `cholqui-cadastre.functions.ts`.
>
> **Rutas**
> - Convertir `/_authenticated/dashboard/franco` en redirect 301 a `/dashboard/cholqui`
>   (igual que ya hace `/live/franco`).
>
> **Cosméticos coherentes**
> - Query keys `"franco-cadastre-cross"` → `"cholqui-cadastre-cross"` (los 3 usos juntos:
>   `CholquiPertenenciasMap`, `CholquiPertenenciasPanel`, `FrancoNI43101DraftPanel`).
> - Nombres de descarga `franco_*.csv/json/html` → `cholqui_*`.
> - Texto visible: cualquier "Franco/Gianfranco" mostrado al usuario → "Cholqui"
>   (dejar `formerName: "Distrito Franco / Gianfranco"` en `cholqui.ts` como dato histórico).
>
> **RPC (coordinado con backend)**
> - En `cholqui-cadastre.functions.ts`, cambiar la llamada
>   `supabase.rpc("franco_match_pertenencia", …)` → `supabase.rpc("match_concessions_by_geometry", …)`
>   (firma y salida idénticas; ya existe en la DB).
> - La búsqueda del proyecto `.ilike("name","%Gianfranco%")` es frágil. Registrar el
>   proyecto con `code = 'CHOLQUI'` en la tabla `projects` y buscar por code, no por nombre.
>
> **Assets (opcional, bajo prioridad)**
> - `franco_pertenencias.geojson` y `project-gianfranco.jpg` pueden mantenerse
>   (evita re-subir binarios); solo actualizar imports si se renombran.

## 4. Mejoras prioritarias del sistema de catastro

Del mapa de arquitectura (dos stacks: público multi-país *live* y por-proyecto *persistido*):

| # | Mejora | Dónde | Prioridad |
|---|--------|-------|-----------|
| 1 | **Cablear la reconciliación al backend.** `_authenticated.dashboard.catastro.tsx` corre el motor de due diligence en memoria y lo descarta. Ya existe `save_cadastre_reconciliation` (migración `20260923120000`) sin usar. Llamarla al terminar `runReconciliation` y listar el historial con `list_cadastre_reconciliations`. | /src (Lovable) | **Alta** |
| 2 | **Poblar `public_concessions_cache`.** La búsqueda pública es "cache-first" pero la caché **nunca se puebla** → todo pega en vivo a SERNAGEOMIN. Activar un ETL que la llene (o el ETL B2 `catastro_concesiones`). | edge/ETL | **Alta** |
| 3 | **Distinguir "fuente caída" de "0 resultados"** en `lib/cadastre/arcgis.ts` y `sngm.ts` (hoy ambos `return []`/`null` → el usuario ve "sin resultados" cuando el servidor está caído). | /src (Lovable) | Media |
| 4 | **Caché + backoff server-side** ante los conectores extranjeros (Perú/Brasil/Landfolio) que se consultan en vivo por request, sin paginación ni rate-limit. | /src (Lovable) | Media |
| 5 | **Eliminar `sync-sernageomin`** (apunta a un host caído desde Q1-2026; duplica `sync-catastro`). Consolidar la lógica de alertas de expiración (hoy duplicada en `sync-catastro` vs `scan-concession-expirations`). | edge (Lovable) | Media |
| 6 | **Tests del motor espacial.** `reconcileCadastre`/`buildCadastreDueDiligence` tienen **cero cobertura**. Riesgo: el fuzzy-match de `match-project-catastro` (Jaccard ≥0.5, borra dígitos) puede sobrescribir el registro real con la concesión equivocada. | /src (Lovable) | Media |

**Mejora del live satelital de Cholqui** (relacionada, en `geocapitals-remote`): el panel
solo lista escenas; se le puede sumar el *verdict* de observabilidad Nivel 0
(% interpretable) y candidatos de muestreo (con disclaimers), persistidos por proyecto.
Ver `docs/cadastre-reconciliation-backend.md` como patrón.
