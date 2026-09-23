# Investment Marketplace v3

## Objective

Make the public investment journey canonical and prevent demo data from being presented as active deal-flow.

## Canonical journey

Landing → Investor Marketplace → Investment Memo → NDA/KYC → Data Room → SPV/Closing → Portfolio.

## Data provenance

Public investment surfaces distinguish:
- Demo: sample data; never an active investment opportunity.
- Traceable: production data with source traceability, pending QP review.
- QP verified: reviewed/signed by a Qualified Person under the applicable technical standard.

Demo projects remain available for product demonstrations, but are excluded from:
- landing investment grids,
- active investor deal-flow,
- live opportunity counts,
- investment conversion surfaces.

## UX rules

1. Use “Explore opportunities” as the primary investor CTA.
2. Treat /inversionistas as the canonical public investment marketplace.
3. Do not mix showcase/demo cards with live opportunities without an explicit sandbox boundary.
4. Show provenance on every active opportunity card.
5. Do not describe traceable data as QP-verified unless the verification layer says so.
6. Keep financial simulations referential and separate from certified technical valuation.

## Follow-up

- Add field-level provenance in the database (official_source, owner_provided, independent_report, geocapitals_estimate, ai_generated).
- Add canonical /investments alias or migrate /inversionistas after route compatibility review.
- Convert the listing drawer into a full Investment Memo.
- Add KYM score only after scoring methodology, evidence model, and disclaimers are implemented.
- Connect Request Data Room → NDA/KYC → SPV → Portfolio.
