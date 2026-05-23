# Platform Module

Owns cross-cutting platform capabilities shared by business modules.

## Future ownership

- Observability
- Request context
- Feature flags
- Usage limits
- Auth and capabilities
- Shared infrastructure policies

## Boundaries

- `domain/`: pure platform policy types and rules.
- `application/`: shared platform use cases.
- `infra/`: adapters for telemetry, auth and storage.
- `ui/`: shared platform UI components when needed.

Existing code in `src/lib/observability`, `src/lib/features`, `src/lib/usage`, and auth-related hooks should be migrated here progressively with compatibility re-exports.
