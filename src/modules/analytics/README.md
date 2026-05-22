# Analytics Module

Owns the event catalog and future product analytics layer.

## Future ownership

- Product event taxonomy
- Dashboard activity events
- Deal pipeline events
- Certification events
- Data room events
- Billing/usage events

## Boundaries

- `domain/`: typed event names and payload contracts.
- `application/`: event emission use cases.
- `infra/`: analytics storage adapters and server functions.
- `ui/`: dashboards and reporting widgets.
