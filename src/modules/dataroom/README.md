# Data Room Module

Owns secure file organization, document access rules and future deal-level data rooms.

## Future ownership

- Deal data room structure
- File ACLs
- Watermark rules
- Document metadata
- Secure sharing flows

## Boundaries

- `domain/`: file categories, access policies and watermark rules.
- `application/`: upload file, grant access and revoke access.
- `infra/`: storage and Supabase/server-function adapters.
- `ui/`: data room views and file management panels.
