# Deals module (pilot)

Primer módulo extraído para ejecutar el plan de mejora de arquitectura.

## Estructura inicial

- `domain/`: constantes y utilidades puras del dominio deals.
- `application/`: casos de uso (inquiry/NDA) desacoplados de la ruta.
- `ui/`: componentes reutilizables de la vista de deals.

## Objetivo

Reducir acoplamiento del route file y preparar expansión hacia `application/` e `infra/` en siguientes PRs.
