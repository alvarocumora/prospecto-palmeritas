# Project Workspace v1

## Objetivo

GeoCapitals debe operar cada activo minero dentro de una sola interfaz y un solo contrato de datos. Los Verdes, Cholqui, Palmeritas y futuros proyectos no deben tener dashboards paralelos con navegación, estados o componentes distintos.

La unidad de navegación es el proyecto:

```text
/projects/:projectId/overview
/projects/:projectId/cadastre
/projects/:projectId/exploration
/projects/:projectId/targets
/projects/:projectId/model
/projects/:projectId/economics
/projects/:projectId/mining
/projects/:projectId/documents
/projects/:projectId/validation
```

Las rutas públicas `/live/*` pueden mantenerse durante la migración, pero deben convertirse en adaptadores de lectura del mismo workspace y no en productos separados.

## Principios

1. GitHub es la fuente de verdad de arquitectura, código y documentación.
2. Todo módulo técnico debe recibir `projectId`; no debe inferir un proyecto por nombre de ruta.
3. La información específica de un activo vive en datos/adaptadores, no en componentes duplicados.
4. Un mismo componente debe servir a cualquier proyecto compatible con el contrato canónico.
5. Los datos deben conservar procedencia, estado de validación y nivel de evidencia.
6. Los datos observados y los resultados conceptuales/modelados no se presentan con el mismo estatus visual.
7. La interfaz común se migra antes de eliminar rutas legacy.

## Secciones canónicas

| ID | Módulo | Propósito |
| --- | --- | --- |
| `overview` | Resumen | Estado ejecutivo, KPIs, madurez y brechas |
| `cadastre` | Catastro | Concesiones, pertenencias, titulares, obligaciones y geometría |
| `exploration` | Exploración | Muestras, assays, geología, geofísica, satélite, sondajes y campañas |
| `targets` | Targets | Priorización, scoring, lineage y acciones recomendadas |
| `model` | Modelo / 3D | DEM, estructuras, sondajes, interpretaciones y modelos geológicos |
| `economics` | Economía | Supuestos, escenarios, CAPEX, OPEX, NPV, IRR y sensibilidad |
| `mining` | Explotación | Método, producción, procesamiento, recuperación y LOM |
| `documents` | Documentos | Expediente técnico, versiones, categorías y publicación |
| `validation` | Validación | Readiness, QA/QC, provenance, auditoría y brechas técnicas |

## Estados de evidencia

El vocabulario mínimo compartido es:

- `verified`: dato respaldado por fuente oficial, laboratorio o revisión aceptada.
- `derived`: dato calculado o interpretado a partir de evidencia trazable.
- `conceptual`: escenario, diseño, modelo o proyección preliminar.
- `pending`: información faltante o todavía no validada.

No debe usarse un estado interno para sugerir cumplimiento de NI 43-101, JORC, S-K 1300 u otro estándar reconocido.

## Readiness

Cada proyecto debe exponer, como mínimo, readiness para:

- Catastro.
- Exploración.
- Economía.
- Validación.

La puntuación global debe poder descomponerse hasta el dataset o requisito que la origina.

## Contrato de implementación

Los nuevos componentes de proyecto deben:

- recibir `projectId` explícito;
- reutilizar `projects`, `organizations`, RLS y los registros geocientíficos existentes;
- evitar tablas específicas por proyecto salvo razones técnicas documentadas;
- conservar `source_id`, estado de validación y geometría cuando corresponda;
- usar las primitivas visuales compartidas de `src/components/ui-system`;
- mantener mapas y 3D como superficies de datos, no como un segundo sistema visual.

## Migración

### Fase 1 — Foundation

- Definir contrato único de secciones, estados y rutas.
- Mantener selector global de proyecto ya existente.
- Congelar la creación de nuevos dashboards específicos por activo.

### Fase 2 — Canonical routing

- Crear la ruta autenticada de workspace por `projectId`.
- Hacer que el selector de proyecto navegue al workspace activo.
- Mantener aliases/rutas legacy con compatibilidad temporal.

### Fase 3 — Los Verdes + Cholqui

- Migrar ambos activos al mismo adapter/loader.
- Unificar Overview, Catastro, Exploration y Validation.
- Mostrar brechas de datos explícitamente.

### Fase 4 — Economía y explotación

- Estructurar escenarios, supuestos y sensibilidad.
- Separar evidencia observada de proyecciones conceptuales.
- Reutilizar los antecedentes mineros existentes de Cholqui.

### Fase 5 — Deprecación legacy

- Retirar componentes específicos cuando exista paridad funcional.
- Mantener redirecciones públicas estables cuando sean necesarias.

## Criterio de aceptación del workspace

Un proyecto nuevo debe poder aparecer en la interfaz común sin crear un nuevo dashboard React. La incorporación debe consistir principalmente en datos, permisos, configuración y adapters reutilizables.
