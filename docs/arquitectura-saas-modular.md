# Arquitectura SaaS modular — login, dashboard y menú por módulos

> Objetivo: un **sistema completo y vendible como SaaS**, no fraccionado, y **modular**:
> un cliente contrata **Catastro** (tenencia/exploración minera), **Commodities**
> (mesa de trading e intermediación) o ambos. Login limpio, dashboard inicial que
> refleja el módulo, y marketplace no-huérfano. La UI/rutas son de Lovable (`/src`);
> este doc es el blueprint + el backend que habilita la modularidad.

## 1. El problema hoy

El menú (`_authenticated.tsx`) mezcla dominios: el grupo **"NEGOCIO"** junta M&A de
proyectos (deals, investments, listings) con trading de commodities (trades, sourcing,
cobranza, envíos, anticipos); **"OPERACIÓN"** junta catastro/boletín con proyectos/
mission; y hay 161 rutas sin una separación de producto. Se vende difícil porque no se
lee como "un sistema" ni se puede activar por partes.

## 2. Módulos (productos)

| Módulo                                                                 | Qué es                                          | Rutas (dashboard)                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Catastro & Exploración**                                             | Tenencia minera, catastro, boletín, exploración | `catastro`, `boletin`, `franco`, `map`, `projects`, `mission`, `project-report`, `campaigns`, `geophysics`, `mag-revalidations`, `drones`, `drilling`, `section`, `sampling`, `qaqc`, `targets`, `ni43101`, `geology3d`, `estimation`, `sat3d`, `satellite-intel`, `field-map` |
| **Commodities & Trading**                                              | Intermediación de metales/commodities           | `trades` (Mesa de operaciones), `trade-board`, `commodity-lots`, `marketplace`, `sourcing` (Requerimientos), `my-inquiries`, `clientes`, `proveedores`, `documentos`, `firmas`, `cobranza`, `envios`, `fletes`, `anticipos`, `finance`, `precios`                              |
| **Capital & Deals** _(opcional, 3er módulo o sub-área de Commodities)_ | Venta de proyectos e inversión                  | `deals`, `investments`, `listings`, `offerings`, `oportunidades`                                                                                                                                                                                                               |
| **Compartido / Admin**                                                 | Transversal a todos                             | `index` (Inicio), `analytics`, `profile`, `team`, `plan`, `admin*`, `agents`, `approvals`, `audit`, `enlaces`                                                                                                                                                                  |

Rutas **huérfanas/duplicadas** a redirigir dentro de su módulo: `operaciones*`→`trades`,
`rfqs*`→`sourcing`, `proveedor`/`invitaciones`→`clientes/proveedores` (ver
`docs/plan-mejoras-operaciones.md`).

## 3. Navegación (CommandRail) reorganizada

- Un **selector de módulo** arriba del rail (Catastro ▸ Commodities ▸ Capital), que
  filtra los grupos visibles. El usuario ve **solo** los módulos que su organización
  tiene contratados (ver §6).
- Dentro de cada módulo, grupos con nombre de negocio (no técnico). Ejemplo Commodities:
  _Mesa de operaciones · Sourcing · Marketplace · Clientes & Proveedores · Documentos &
  Firma · Finanzas (cobranza/anticipos/envíos)_.
- "Inicio", "Analítica", perfil/equipo/plan quedan **transversales** (fuera de módulo).

## 4. Login + dashboard inicial

- **Login único** (`auth.tsx`) para toda la plataforma; el rol y los módulos del usuario
  definen a dónde entra.
- **Dashboard inicial** (`/dashboard`) _module-aware_:
  - 1 módulo contratado → entra directo a su home con KPIs de ese módulo.
  - 2+ módulos → home unificado con **una tarjeta por módulo** (KPIs resumidos + CTA
    "Entrar"), sin mezclar métricas de dominios distintos.
- KPIs por módulo desde datos ya existentes: Commodities (trades activos, readiness de
  compliance, negociaciones abiertas, cobranza pendiente); Catastro (concesiones
  vigentes, terreno franco, alertas de boletín, obligaciones por vencer).

## 5. Marketplace de commodities (no huérfano)

- **Público:** `/marketplace` (+ `/marketplace/$lotId`) en el nav público y en la landing
  (arreglar el link roto a `/dashboard/commodity-lots`, ver plan-mejoras).
- **In-app:** dentro del módulo Commodities, como puerta de entrada a lotes/ofertas que
  derivan en una operación (trade) con su negociación y compliance.

## 6. Modularidad / empaquetado SaaS (backend que puedo aportar)

Para "vender por módulos" hace falta **entitlements por organización**:

- Tabla `plan_modules` (qué módulos incluye cada `billing_plan`) y/o
  `org_module_entitlements` (overrides por organización).
- RPC `get_my_modules()` → devuelve los módulos activos del usuario/organización, que el
  front usa para renderizar el selector y gatear rutas.
- Gate de ruta por módulo (`beforeLoad`) que consulta `get_my_modules()`.

Esto **es mi territorio** (tabla + RPC), pero depende del modelo de `organizations` /
`billing_plans` de Lovable (hoy drifteado). Propongo construirlo cuando confirmemos ese
modelo, o una versión mínima basada en un enum de módulos + entitlement por org.

## 7. Reparto de trabajo

- **Lovable (`/src`):** selector de módulo en el rail, reagrupar rutas por módulo,
  dashboard inicial module-aware, login→landing por rol/módulo, fix marketplace, redirigir
  huérfanas.
- **Claude Code (backend):** `get_my_modules()` + entitlements (cuando se confirme el
  modelo de org/planes); KPIs por módulo vía vistas/RPC si se requieren agregados.

## 8. Fases sugeridas

1. **Reagrupar el menú** en módulos (Lovable) — impacto visual inmediato de "un sistema".
2. **Dashboard inicial module-aware** + fix marketplace/landing (Lovable).
3. **Entitlements** `get_my_modules()` (Claude) + gate de rutas por módulo (Lovable).
4. Consolidar huérfanas/duplicados (Lovable) — cerrar la fragmentación.
