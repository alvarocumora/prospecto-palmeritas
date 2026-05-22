# Certification Module

Owns certification workflows, compliance rules, approvals, evidence, signatures and report state transitions.

## Future ownership

- Compliance matrix
- Evidence drawer
- Record approvals
- Signature envelopes
- NI 43-101 / JORC rule evaluation
- Certification state machine

## Boundaries

- `domain/`: pure rules, state machine, evidence requirements.
- `application/`: use cases such as evaluate report, request evidence and transition status.
- `infra/`: Supabase/server-function/edge-function adapters.
- `ui/`: panels and components consumed by routes.
