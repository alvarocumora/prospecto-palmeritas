# GeoCapitals Public Experience v2

## Objective

Unify the public GeoCapitals journey so marketing, investment discovery, authentication, terminal access and the private workspace feel like one coherent product.

## Branch

`feature/public-experience-v2`

## Delivery strategy

One business pull request with small, reversible commits. Each phase must preserve working routes and avoid changes to private exploration workflows unless explicitly required for navigation.

## Phase 1 — Journey and information architecture

- Define the canonical public paths for investors, project owners and advisors/QPs.
- Add a single public start point for profile selection.
- Normalize CTA labels and destinations across landing, header, footer and internal marketing pages.
- Remove ambiguous links such as a project-publication label pointing to investment opportunities.

Expected journey:

- Investor: landing → opportunities/deal flow → listing → data-room request → investor signup → terminal/workspace.
- Project owner: landing → publish project → owner signup → onboarding/workspace.
- Advisor/QP: landing → professional signup → workspace.

## Phase 2 — Public shell and navigation

- Keep `AppShell` as the canonical shell.
- Standardize header, footer, mobile navigation and button hierarchy.
- Clearly separate public marketing, terminal demo and private workspace while preserving shared brand tokens.
- Ensure all public routes expose consistent breadcrumbs or contextual navigation where useful.

## Phase 3 — Authentication and intent-aware onboarding

- Replace exploration-only language in `/auth` with GeoCapitals platform language.
- Preserve `intent=investor|owner|team` and use it to customize copy, metadata and next steps.
- Store the selected profile intent in signup metadata.
- Route confirmed users to an appropriate onboarding step before the generic dashboard when possible.

## Phase 4 — Landing restructuring

- Keep the cinematic hero and live intelligence components.
- Make the two primary paths explicit: invest and publish/finance a project.
- Position GeoCapitals Terminal as the central product experience.
- Remove unsupported placeholder metrics and claims.
- Keep live platform metrics resilient to unavailable data.

## Phase 5 — Investment journey

- Harmonize `/oportunidades`, `/inversionistas`, public listings and listing drawers.
- Use one terminology set for deals, projects, commodities, modalities and access requests.
- Add clear states for public preview, institutional access, NDA/KYC and private data-room access.
- Preserve current server functions and deal logic.

## Phase 6 — Project-owner journey

- Provide a dedicated project publication/onboarding entry.
- Explain required information: ownership, concession data, technical evidence, financing objective and data-room documents.
- Connect project-owner signup intent to the private workspace.

## Phase 7 — Terminal integration

- Distinguish public terminal demo from authenticated portfolio/workspace capabilities.
- Add clear navigation back to the public site and forward to institutional signup.
- Keep terminal visual language dark and operational, but align logo, typography, terminology and CTA behavior with the public shell.

## Phase 8 — Internationalization

- Expand the marketing dictionary beyond navigation and hero copy.
- Remove mixed Spanish/English labels where no deliberate bilingual treatment exists.
- Cover landing, start/profile selection, authentication, opportunities, investors and terminal entry points.

## Phase 9 — Accessibility, mobile and resilience

- Validate mobile navigation and full-width CTAs.
- Ensure focus states, labels, keyboard navigation and semantic headings.
- Add loading, empty and error states without blanking pages.
- Avoid layout shifts and SSR hydration mismatches.

## Phase 10 — Validation and release

Required before merge:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

Release checklist:

- Landing CTAs have correct labels and destinations.
- Investor, owner and advisor journeys are traceable end-to-end.
- Auth copy reflects selected intent.
- Public terminal and private workspace are clearly differentiated.
- Public routes use the same shell and design tokens.
- No private dashboard or exploration route regression.

## Commit order

1. `docs: define Public Experience v2 execution plan`
2. `feat(public): add profile-based start route`
3. `refactor(public): normalize header and footer actions`
4. `fix(marketing): align landing CTA labels and destinations`
5. `refactor(auth): add intent-aware platform copy`
6. `refactor(investment): unify opportunities and investor journey`
7. `feat(owner): add project publication onboarding entry`
8. `refactor(terminal): align public terminal entry and navigation`
9. `feat(i18n): complete public journey translations`
10. `test(public): add journey and route coverage`
11. `chore(public): final validation and cleanup`
