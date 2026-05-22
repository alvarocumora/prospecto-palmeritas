# QPS Module

Owns reviewer profiles, availability, specialization and future deal/report matching.

## Future ownership

- Reviewer registry
- Competency and specialization metadata
- Deal to reviewer matching
- Report assignment
- Signature eligibility

## Boundaries

- `domain/`: profile types, competency rules and matching criteria.
- `application/`: assign reviewer, match reviewer, validate eligibility.
- `infra/`: Supabase/server-function adapters.
- `ui/`: registry and matching panels.
