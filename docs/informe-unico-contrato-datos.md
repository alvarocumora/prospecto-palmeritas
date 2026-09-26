# Contrato de datos — informe único (gateado por procedencia)

Fase 0 entregó `report_readiness(project_id)` (migración `20260926150000`). Este documento
define cómo el **motor único de informe** (base: `src/features/reports/pre43101`) consume los
datos por sección, **rotulando cada uno por procedencia** y respetando el gate.

## Gate (obligatorio antes de generar)
```ts
const r = await supabase.rpc("report_readiness", { p_project_id: projectId });
// r.overall.report_ready === false  -> NO ofrecer "informe entregable".
//   level 'synthetic_or_modeled'    -> bloquear o marcar TODO como demostración.
//   level 'declared_only'           -> permitir, pero marca de agua "por verificar".
//   level 'measured'/'partial'      -> permitir informe real; rotular por sección.
```

## Secciones → fuente → procedencia

| Sección del informe | Tabla(s) | Nivel de evidencia | Regla de render |
|---|---|---|---|
| Marco catastral | `mining_concessions`, `cadastre_national`, reconciliación | declared/official | Declara sobre qué pertenencias corre; overlaps del cruce |
| Muestreo (geoquímica) | `sampling_results` | `certificate`+`lab` → **measured**; assay sin cert → **declared** | Tabla de assays con columna de procedencia por fila; sin dato → "Por confirmar" |
| Custodia | `sample_custody` | measured | Cadena de custodia como anexo de trazabilidad |
| Geología | `lithology_units`, `alteration_zones`, `geological_features`, `veins` | declared/mapped | Mapeo de terreno; distinguir observado de inferido |
| Geofísica (adquisición) | `geophysics_surveys/lines/stations` | `is_synthetic=false` → **measured**; true → **synthetic** (excluir) | Solo estaciones reales en el informe entregable |
| Geofísica (modelo) | `geoscience_compute_jobs` (SimPEG) | **modeled** | Rotular "modelo de inversión", con parámetros y versión |
| Teledetección | `geocapitals-remote` / `remote-sensing` | modeled (Nivel 0) | Cobertura + candidatos, con disclaimers de Nivel 0 |
| Interpretación (targets) | `exploration_targets` | `validated_at` → validado; else candidato | Target = evidencia + confianza; nunca "recurso" |
| Anomalías mag regionales | `mag_targets` | **modeled/regional** (EMAG2v3) | Rotular regional, no medición de terreno |

## Reglas de honestidad (heredadas)
- Campo sin dato → **"Por confirmar"** (ámbar), nunca vacío presentado como confirmado.
- **measured** puede afirmarse como dato real (con procedencia).
- **declared** = "por verificar".
- **modeled** = "interpretación/modelo", nunca "medido".
- **synthetic** = marca de agua de demostración; excluido del informe entregable.
- No existe estimación de recursos/reservas bajo estándar (CH20235/NI43101/JORC/S-K1300)
  salvo que la fuente lo sustente; los escenarios son sensibilidad, no leyes promedio.

## Salida
PDF con identidad GeoCapitals reutilizando el motor `geocapitals-docs/` (mismos tokens de marca,
"Por confirmar" en ámbar, marca de agua para secciones modeladas/sintéticas).

## Próximo (Fase 1)
Validación de intake (CRS de muestras/estaciones — hoy `sampling_results` no versiona CRS del
easting/northing; declararlo) y enlace muestra↔concesión para el marco catastral.
