# Reconciliación catastro/boletín — Lovable ↔ capa de datos (Claude Code)

> Origen: al revisar el avance de Lovable se detectó que **la capa B2–B6 quedó
> paralela** al catastro que Lovable ya tenía vivo. El front **no consume** ninguna
> de mis tablas (`catastro_concesiones`, `boletin_*`, `reglas_*`, `patentes_escala`,
> `valores_utm`, `reglas_prospectividad`, `obligaciones`) — 0 referencias en `/src`
> fuera de los tipos generados. Este documento fija el mapa y el plan.

## Tablas del dominio (quién las escribe / quién las lee)

| Tabla | Origen | Rol | Estado en el repo |
|---|---|---|---|
| `cadastre_national` | Lovable | **Catastro nacional canónico** que lee el front | Estaba **sin CREATE versionado** (drift) → **versionada aquí** |
| `cadastre_sync_runs` | Lovable | Bitácora del sync de catastro | Drift → **versionada aquí** |
| `mining_concessions` + `concession_history` | Lovable (edge fn `sync-sernageomin`) | Store del sync SERNAGEOMIN | Migración propia de Lovable |
| `bulletin_sync_runs` | Lovable | Bitácora del sync del Boletín | Drift (solo cloud) → **versionada aquí** |
| `catastro_concesiones` (B2) | Claude Code | Store versionado con historial temporal | Migrado, **no consumido por el front** |
| `boletin_ediciones/registros/alertas` (B3) | Claude Code | Boletín parseado + cruce espacial | Migrado, **no consumido por el front** |

## Qué versiona este baseline

`supabase/migrations/20260513000000_baseline_cadastre_bulletin.sql` reconstruye el
`CREATE TABLE` de `cadastre_national`, `cadastre_sync_runs` y `bulletin_sync_runs`
**fiel a `src/integrations/supabase/types.ts`** (fuente autoritativa generada por
Lovable). Es **idempotente** (`IF NOT EXISTS`): no-op en la base de Lovable donde ya
existen; las crea en CI / entornos nuevos. Timestamp temprano a propósito (corre
antes de la primera migración que las referencia, `20260514035146…`).

Validado en PostGIS fresco: las 25/15/13 columnas calzan **carácter por carácter**
con `types.ts`; el FK `concession_id REFERENCES cadastre_national(id)` que antes
fallaba en fresh ahora resuelve; segunda pasada = no-op limpio.

**Supuestos declarados** (en el encabezado de la migración): `geom`/`geom_3857` como
`geometry` genérico (subtipo/SRID exactos sin confirmar), `*_at` como `timestamptz`,
y los `DEFAULT` inferidos de columnas opcionales (solo afectan a bases nuevas).

## Alcance honesto — esto NO hace el repo 100% reproducible

El drift es **sistémico**, no se limita a estas 3 tablas. Muchas migraciones de
Lovable asumen objetos que viven solo en la cloud (otras tablas base, funciones como
`is_super_admin`/`is_project_member`, tipos enum). Un `apply` desde cero del repo
completo **todavía fallaría** por esos otros faltantes. Este baseline cubre el
clúster catastro/boletín (mi dominio, alta confianza). Faltan por versionar, con el
mismo método (reconstruir desde `types.ts`, idempotente), las demás tablas que el
front referencia sin CREATE versionado:

`organizations`, `organization_members`, `billing_plans`, `investor_profiles`,
`onboarding_status`, `follow_up_tasks`, `satellite_analysis_runs`,
`satellite_anomalies`, `ai_anomaly_explanations`.

## Recomendación de reconciliación (siguiente paso, a confirmar)

El valor diferenciado de la capa Claude Code son los **motores de cálculo** (Código
de Minería, patentes/carry, terreno franco, prospectividad REE, obligaciones), no un
segundo store de catastro. Propuesta:

1. **Canónico = `cadastre_national`.** Los motores/ETL leen de ahí (no de
   `catastro_concesiones`).
2. Exponer los motores como **RPC** que el front pueda invocar sobre `cadastre_national`.
3. `catastro_concesiones` (B2) se degrada a *staging* del ETL versionado o se retira;
   `boletin_*` (B3) alimenta/−complementa el pipeline de `bulletin_sync_runs`.

Esto se hace **después** de versionar el esquema drifteado (este bloque) y con
confirmación, para no romper contratos del front.

## Progreso de reconciliación (motores → cadastre_national)

- ✅ **Terreno franco.** `tenencia_terreno_franco` retargeteada a `cadastre_national`
  (`20260725200000_reconcilia_terreno_franco_cadastre.sql`): misma firma/salida
  (drop-in para el front), vocabulario real `status ∈ {vigente, en_tramite,
  vencida, cancelada}` (verificado en `functions/_shared/sernageomin.ts`), ocupan
  vigente+en_tramite, filas vigentes `archived_at IS NULL`. 5 tests sobre la tabla
  canónica.
- ⬜ Patentes (RPC `patente_estimada(external_id)` sobre `area_ha/tipo` + escala/UTM).
- ⬜ Obligaciones (job apuntando a `cadastre_national`).
- ⬜ Código de Minería (RPC de validación geométrica sobre `geom`).
