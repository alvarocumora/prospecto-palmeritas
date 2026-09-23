# Proyecto Cholqui — canonical identity

Proyecto Cholqui, Proyecto Franco, Distrito Franco and Gianfranco refer to the same mining project.

## Canonical naming

- Canonical public name: **Proyecto Cholqui**
- Canonical code: **CHOLQUI / CHQ-001**
- Canonical public route: `/live/cholqui`
- Canonical investor ficha slug: `cholqui`
- Canonical data source: `src/features/franco/data/cholqui.ts`

## Legacy compatibility

Legacy names and URLs are aliases only:

- `/live/franco` redirects to `/live/cholqui`.
- `getFicha("franco")` resolves to the canonical Cholqui ficha.
- `FRANCO_PROJECT` aliases `CHOLQUI_PROJECT`.
- `FrancoDashboard` aliases `CholquiDashboard`.

No new project, data record, metric, document or investment opportunity should be created under Franco/Gianfranco.

## PDF reliability

The public Cholqui dashboard imports the PDF generators directly instead of using a runtime dynamic import. This removes the stale hashed `cholquiPdf-*.js` chunk failure observed after production deployments.

## Follow-up refactor

The physical folder `src/features/franco` and legacy component filenames remain temporarily to minimize blast radius. They should be renamed to `src/features/cholqui` only after repository-wide import migration and build verification.
