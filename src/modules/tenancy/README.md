# Tenancy Module

Owns organizations, projects, plans, tenant administration and future billing integration.

## Future ownership

- Organization management
- Project tenancy
- Plan assignment
- Feature and usage policy composition
- Super-admin workflows

## Boundaries

- `domain/`: tenant model, plan model and policy rules.
- `application/`: change plan, create tenant and manage project access.
- `infra/`: Supabase/server-function adapters.
- `ui/`: tenant admin and plan management screens.
