# Global Mining Intelligence Pipeline

Cholqui is the golden validation project, not a special architecture.

## Canonical flow

`ProjectSpatialContext -> Global Cadastre -> Remote Sensing -> Anomalies -> Geological Interpretation -> Sampling/Assays -> Evidence Convergence -> Technical Report`

## Rules

- Every input keeps original CRS, normalized WGS84 coordinates, provenance and QC state.
- `cadastre_national` remains the canonical official cadastre store.
- Satellite anomalies are DERIVED evidence and never constitute proof of mineralization.
- Laboratory certificates are CERTIFIED evidence; documentary coordinates remain DOCUMENTARY until independently verified.
- Records with coordinate inconsistencies are retained with `qc=review`; they are never silently corrected or discarded.
- Engines accept project spatial context and must not contain Cholqui-specific business logic.

## Cholqui validation

Initial validation uses PSAD56 / UTM zone 19S (EPSG:24879) documentary points already represented in the project source, plus new historical points after QC. The pipeline must reconcile them with official cadastre, satellite scenes, geological context and certified assays.

## Acceptance criterion

A project can enter with an AOI and evidence points and produce a traceable technical finding whose sources can be followed from official cadastre and satellite scene through derived anomaly, nearby field evidence, interpretation and report limitations.
