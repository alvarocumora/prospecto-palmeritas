# SPV Mining Deals

Operational module for structuring, administering and monitoring mining special-purpose vehicles used for acquisitions, joint ventures, development, financing and exits.

## Initial case

**Terra Aurum Gold SPV I**

- Asset owner: Terra Aurum
- Structurer: GeoCapitals
- Commodity: Gold
- Status: Structuring
- Reference asset value: USD 20,000,000
- Capital sought: USD 5,000,000
- Ownership: Terra Aurum 65%, investors 25%, GeoCapitals 10%
- GeoCapitals success fee: 4% of effective transaction value
- Structuring fee: USD 100,000
- GeoCapitals carry: 10% of distributable profits after investor preferred return
- Investor preferred return: 8% annually

All demo values are editable and referential. They are not a certified technical valuation or binding investment offer.

## Delivery order

1. Domain model, status transitions, permissions and demo data.
2. Internal shell and SPV sidebar.
3. Executive dashboard.
4. Mining asset record.
5. Cap table and investment rounds.
6. Waterfall simulator.
7. Investor pipeline.
8. Data room.
9. Due diligence.
10. Milestones, documents, compliance and reporting.
11. Supabase persistence, RLS, audit history and exports.

## Guardrails

- Keep this work separate from Public Experience v2.
- Reuse existing deal, investor, data-room and audit capabilities where possible.
- Do not duplicate marketplace or due-diligence business logic.
- No hidden or undocumented commissions.
- Generated documents must be labelled drafts and require legal review.
- Financial simulations must include technical, financial, legal and tax disclaimers.
