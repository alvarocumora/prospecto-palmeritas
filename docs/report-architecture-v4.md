# GeoCapitals Report Architecture v4

## Principle

A report is not a dump of available project fields. The **document profile owns the narrative** and the project dataset fills that narrative. Missing evidence is shown as a gap; it never causes unrelated sections to move forward or disappear without explanation.

All outputs continue to use the same canonical project/evidence layer. The architecture only controls selection, order and presentation.

## Evidence vocabulary

| Class | Meaning | Typical use |
| --- | --- | --- |
| OFFICIAL | Government or authoritative source | cadastre, permits, official tariffs |
| CERTIFIED | Signed/accredited analytical evidence | laboratory certificates |
| DOCUMENTARY | Contract, title, report or other document | ownership evidence, agreements |
| DECLARED | Statement supplied by owner/operator | operating assumptions |
| OBSERVED | Field observation | mapping, mineralogy, structures |
| DERIVED | Reproducible calculation from source data | ratios, inversion, spectral anomaly |
| INTERPRETED | Geological/geoscientific interpretation | target model, conceptual body |
| PROPOSED | Future work, not completed evidence | drill grid, work program |
| SCENARIO | Economic/engineering sensitivity | price/grade/throughput case |
| PENDING_DD | Material item not yet verified | title gap, permits, metallurgy |

No class upgrades another class. In particular, DERIVED/INTERPRETED outputs do not become CERTIFIED because their inputs are certified.

## 1. Investment Memorandum

Purpose: answer why the asset merits diligence, what supports the thesis, what capital is requested and which uncertainties must be retired.

1. Executive Investment Snapshot
2. Evidence & Confidence Dashboard
3. Asset & Ownership
4. Why This Asset
5. Evidence Base
6. Development Strategy
7. Economics & Sensitivities
8. Capital Raise & Use of Funds
9. Key Risks & De-risking
10. Value-Creation Milestones
11. Due-Diligence Checklist
12. Technical Appendices

Detailed assay tables, coordinates, fleet schedules and monthly cash-flow tables belong in appendices unless they are material to the investment decision.

## 2. Technical Report

Purpose: state what is technically known, from which source, at what quality and with what limitations.

1. Scope & Purpose
2. Evidence & Confidence Dashboard
3. Data Inventory & Provenance
4. Property & Coordinate Systems
5. Geological Setting
6. Field Observations
7. Sampling & QA/QC
8. Laboratory Results
9. Geochemistry
10. Geophysics
11. Remote Sensing
12. Integrated Geological Interpretation
13. Exploration Targets
14. Exploration Gaps
15. Recommended Work Program
16. Technical Limitations
17. Technical Appendices

**Excluded from technical evidence:** equity terms, valuation, capital raise, investor ticket and economic scenarios presented as technical facts.

## 3. Exploration Targeting Report

Purpose: preserve a reproducible chain from source datasets to anomalies, target ranking and field validation.

1. Objective
2. Evidence & Confidence Dashboard
3. Input Datasets & Provenance
4. Data Quality & Coverage
5. Processing Methodology
6. Spectral Products
7. Structural Interpretation
8. Detected Anomalies
9. Multi-Layer Target Ranking
10. Ground-Truth Program
11. Validated Targets
12. Conceptual Drilling
13. Limitations
14. Reproducibility & Run Metadata
15. Technical Appendices

A spectral anomaly is not mineralization. A conceptual collar remains **PROPOSED** until the target has sufficient ground truth and technical review.

## Rendering rules

- Every report shows Evidence & Confidence as section 02.
- Every material KPI should be traceable to a provenance class.
- Missing required evidence is rendered as a gap, not silently omitted.
- Maps must identify CRS, source, capture/run date and imagery/data source.
- Technical reports cannot promote SCENARIO or PROPOSED items to technical evidence.
- Targeting reports must place ground truth before conceptual drilling.
- Investment outputs may show scenarios, but they must remain visibly labelled SCENARIO.
- Full laboratory tables, coordinate lists and detailed schedules default to appendices.
