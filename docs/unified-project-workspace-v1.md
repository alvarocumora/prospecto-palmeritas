# GeoCapitals Unified Project Workspace v1

## Goal

Replace project-specific public pages, dashboards and investor cards that evolved independently with one project workspace contract.

The workspace follows the mining lifecycle instead of the component history:

```
PROJECT
  → Overview
  → Data & Cadastre
  → Exploration
  → Geological / Resource Model
  → Mine Plan
  → Economics
  → Validation / Due Diligence
  → Investment
```

Cholqui and Los Verdes are the first two migrations.

## Visual contract

The single platform theme is **Institutional Modernist** from `docs/design-system.md`.

- warm paper background;
- ink typography;
- cobalt as the only brand action colour;
- serif only for project/page display headings;
- sans for UI and narrative;
- mono only for data, codes and technical labels;
- medium radii, hairlines and restrained shadows;
- dark UI is reserved for `data-surface="canvas"` maps, 3D and terminal-grade visualisation.

Maps are not a second theme. They are embedded canvas surfaces inside the same workspace.

## Project header

Every project gets one compact header with:

- project code and stage;
- project name;
- commodity and location;
- maximum four decision metrics;
- document/share actions;
- module navigation.

Large marketing hero banners are intentionally excluded from technical workspaces.

## Evidence vocabulary

Decision metrics and project data must preserve evidence state:

- `verified`: official/certified/measured source;
- `derived`: calculated or interpreted from source data;
- `proposed`: conceptual plan, target, drillhole or economic scenario;
- `pending`: missing due diligence or validation.

A conceptual NPV is never presented with the same visual status as a certified assay or official cadastre record.

## Data readiness

Every project should expose readiness in four lanes:

1. **Cadastre** — linked concessions, geometry coverage, title/DD gaps.
2. **Exploration** — samples, assays, remote sensing, geophysics, drilling.
3. **Economics** — scenario/model availability and key missing inputs.
4. **Validation** — QA/QC, provenance, recognized-standard status and open gaps.

Los Verdes now reports concession geometry coverage explicitly. This makes missing cadastre geometry visible instead of silently dropping it from the map.

## Map density rules

The default map must answer one question without requiring configuration.

### Cholqui
Default: tenure + certified assays + Sentinel screening.
Regional magnetics/gravity, project geophysics, proposed drilling, proposed pedimentos, district deposits and sediment geochemistry are opt-in.
The layer drawer is closed by default.

### Los Verdes
Default: concessions + samples + targets.
Satellite and magnetic anomaly layers are opt-in.
The layer drawer is closed by default.

The old “NI 43-101 certification mode” label is replaced by **validation mode**. A confidence threshold is an internal filter and must not imply compliance with NI 43-101, JORC, CH 20235 or S-K 1300.

## Next migration phases

### v1 — current PR
- shared project shell;
- Cholqui migration;
- Los Verdes migration;
- compact headers;
- readiness strip;
- map density reduction;
- explicit evidence state.

### v2
- make `/dashboard/projects/:projectId` the authenticated version of the same workspace;
- project adapter interface so Cholqui, Los Verdes, Palmeras and future assets feed the same modules;
- move fundraising editor into the Investment module;
- move concessions/fact sheet into Data & Cadastre;
- shared validation/gap register.

### v3
- migrate dashboard cards, investor marketplace cards and terminal project panels to shared primitives;
- one global spacing/card/badge/action grammar;
- remove legacy gold/cyan decorative variants outside canvas surfaces.

### v4
- connect Dataset Registry, compute jobs and Mining Asset Graph directly to workspace readiness;
- 3D model revisions, block models, target lineage and economic scenarios become versioned project objects.
