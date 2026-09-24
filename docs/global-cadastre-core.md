# Global Cadastre Core

GeoCapitals uses one cadastral core for public search, projects, due diligence and investment workflows.

## Canonical identity

Official records are identified by:

`country_code + authority + source_record_id`

`cadastre_national` is the canonical current-store. Project-declared records remain in
`mining_concessions` and may link to the canonical official record through
`cadastre_national_id`. They are not overwritten conceptually: reconciliation explains the
relationship between documentary/project evidence and official evidence.

## Read contract

All new consumers use `searchCadastre({ scope })`.

Supported scopes:
- country
- bbox
- project
- role

A successful response with `total: 0` means the source answered with no records.
`sourceState: "unavailable"` means the official source could not answer.

## Migration rule

Existing routes remain operational while their internal data access is migrated behind the
global contract. Do not create new project-specific cadastre engines.

Next: DB-first reads + official-source write-through into `cadastre_national`, then a shared
`CadastreMap` for national, project and intelligence views.
