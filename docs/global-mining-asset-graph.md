# Global Mining Asset Graph + Mineral Passport Core v1

GeoCapitals uses one graph to connect mineral rights, exploration evidence, geological interpretation, models, investment assets and produced material. Project-specific modules are adapters; they must not create parallel identity systems.

## Canonical path

Project -> Concession -> Target -> Geological body -> Sample/Assay/Drillhole/Geophysics/Geochemistry -> Interpretation -> Resource model -> Economic model -> Investment asset -> Production batch -> Commodity lot -> Mineral passport.

Every node and edge carries provenance. OFFICIAL and CERTIFIED evidence must never be silently upgraded from DOCUMENTARY, DECLARED, DERIVED or INTERPRETED.

## Traceability

The passport ledger is commodity-neutral. Each custody or transformation event is append-only and contains a SHA-256 payload hash plus the previous event hash. Blockchain is optional: an external chain may anchor selected hashes later, but blockchain is not the source of truth.

A production workflow may preserve lineage: ore face -> ROM batch -> stockpile -> plant feed -> concentrate -> shipment -> smelter -> refined metal. Splits and blends are represented explicitly through inputRefs and outputRefs; mass balance is not inferred when source measurements are absent.

## Regulatory interoperability

The internal passport is not itself an EU Digital Product Passport or a GBA certification. Export adapters should map verified internal fields to the applicable external schema/version. Regulatory claims require the corresponding evidence and assurance status.

## Integration rules

- cadastre_national remains the canonical official mineral-right store.
- ProjectSpatialContext remains the canonical project AOI/evidence coordinate context.
- Existing assays, drillholes, geophysics, geochemistry, 3D models, economics, commodity lots and trades remain domain stores.
- The graph links those records through entity_id/canonical keys rather than copying their full business state.
- Produced-material traceability starts only when a production batch/lot exists; exploration targets are never represented as produced commodity.
