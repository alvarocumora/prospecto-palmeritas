# Plan — Crear Proyecto "Distrito Cuprífero Los Verdes – Tilama"

Carga de datos del informe Andes Rock Geoconsultores en GeoCapitals, lista para visualizar en mapa, targets, catastro y como base para upgrade a NI 43-101.

## 1. Proyecto base

Insert en `projects`:
- code: `LV-TIL-001`
- name: `Distrito Cuprífero Los Verdes – Tilama`
- commodity: `Cu-Au-Ag`
- country: `Chile` · region: `Coquimbo` · commune: `Los Vilos`
- crs_epsg: `32719` (UTM 19S WGS84)
- center: convertido desde UTM ~300500 E / 6453300 N → **lat -32.0257, lng -71.0123** (aprox; recalculo exacto con proj4 al ejecutar)
- status: `active`
- description: resumen ejecutivo (skarn Cu + vetiformes Cu-Au-Ag, control Riedel dextral, dos zonas económicas conceptuales La Guanaca y Castellana)

## 2. Titulares (`holders`)

- Carlos Fernández Vásquez → 4 pertenencias grupo Alto Los Verdes
- Carlos Fernández Chacana → 5 pertenencias grupo Fernández Chacana

## 3. Pertenencias (`mining_concessions`) — 11 registros

Como puntos/centroides (sin shapefile oficial todavía), marcados `source='informe_andes_rock'`, `status='vigente_declarado'`:

Grupo Los Verdes (titular Vásquez): Alto Los Verdes, Alto Los Verdes 2, Alto Los Verdes 4, Alto Los Verdes 5, Los Verdes 5-1-12, Los Verdes 4-1-10, Cumbre Nevado 1-30, Las Palmas 1-30, Las Trancas 1-20, Los Peumos 1-20.

Grupo Fernández Chacana: Lucas 1-9, Mandela 1-10, Chele Norte 1-8, Naranjo Norte, Naranjo Sur.

Geometría: centroide derivado del mapa Andes Rock (imagen subida) con `notes='Pendiente shapefile oficial SERNAGEOMIN'`.

## 4. Targets (`exploration_targets`) — 9 registros

Conversión UTM 19S → WGS84 vía `pyproj` al ejecutar.

| Code | Nombre | Tipo | Prioridad | UTM E | UTM N |
|---|---|---|---|---|---|
| LV-T-001 | TIL1 Los Verdes | vein | high | 302025 | 6453773 |
| LV-T-002 | TIL2 Castellana feeder | vein | **critical** | 301103 | 6454455 |
| LV-T-003 | TIL4 Alto Los Verdes | skarn | high | 300388 | 6455200 |
| LV-T-004 | TIL5 Los Peumos | vein | medium | 300527 | 6452753 |
| LV-T-005 | TIL6 Mineralización central | skarn | high | 300128 | 6452963 |
| LV-T-006 | TIL7 Mandela | vein | medium | 297369 | 6454397 |
| LV-T-007 | TIL8 Chele Norte | vein | medium | 297294 | 6453332 |
| LV-T-008 | Zona La Guanaca | skarn | **critical** | 300500 | 6453300 |
| LV-T-009 | Zona Castellana | vein | high | 300900 | 6454100 |

Para LV-T-008 (La Guanaca): `rationale` = "600×10×200 m, ~3.24 Mt @ 3.5–4% Cu visual"; `evidence` JSON con dimensiones y tonelaje conceptual.
Para LV-T-009 (Castellana): "250×5×150 m, ~506 kt @ 0.8–1% Cu".

## 5. Modelo geológico (notas en proyecto)

Guardado en `description` + opcionalmente en una nota markdown:
- Depósito: Skarn Cu + vetiformes Cu-Au-Ag + enriquecimiento supergénico
- Mineralogía: Cpy, Bn, Cv, Cc, Cz, Atc, Mlc
- Alteraciones: potásica, propilítica, hematítica, skarn calcosilicatado
- Estructuras: N-S, NNE-SSW, NE-SW, NNW-SSE — Riedel dextral

## 6. Próximos pasos (no se ejecutan ahora, se dejan como TODO)

- Importar shapefile oficial SERNAGEOMIN (cuando esté disponible)
- Correr análisis Sentinel-2 / ASTER sobre AOI del distrito (función ya disponible)
- Generar campaña de muestreo geoquímico en La Guanaca + Castellana
- Calcular Fusion Score sobre los 9 targets
- Producir teaser PDF + data room

## Detalles técnicos

- Migración SQL única (`supabase--migration`) con todos los inserts en transacción
- Conversión UTM→WGS84 inline con `ST_Transform(ST_SetSRID(ST_MakePoint(E,N),32719),4326)` para evitar dependencia de pyproj
- `created_by` = primer usuario admin existente (lookup por `has_role`)
- `organization_id` = misma org que proyectos existentes
- Sin tocar código frontend — el proyecto aparecerá automáticamente en `/dashboard/projects` y mapa vía hooks ya existentes (`useProjects`, `useExplorationTargets`, `useMiningConcessions`)

¿Apruebas para ejecutar la migración?
