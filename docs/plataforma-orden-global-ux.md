# Orden global de la plataforma — blueprint UI/UX

GeoCapitals hoy funciona pero está **fragmentado**: sitio público + dashboard con
~80 rutas sin jerarquía + varios shells y visores por proyecto que no comparten
lenguaje. Este documento propone el **orden global** para que sea una sola interfaz
de **inversión, trading y exploración**. Es el plano; la ejecución es incremental
(no se reescribe todo de una vez).

## 1. Diagnóstico (lo que hay)

- **145 rutas**; ~80 bajo `_authenticated.dashboard.*` sin agrupación visible.
- **Shells múltiples** que no comparten navegación ni layout: `AppShell` (público,
  nav plano de 10 ítems), `PublicCatastroShell`, `TerminalShell`, `MarketingShell`,
  y dashboards por proyecto (`FrancoDashboard`, `PalmerasDashboard`,
  `TrackminDashboard`, `Pre43101Shell`).
- **Visores heterogéneos**: `ProjectMasterViewer`, `SatelliteMapViewer`, 3D
  (`Geology3DViewer`, `SatToSubsurface3DViewer`, `BlockModel3DViewer`…), mapa de
  catastro — cada uno con su chrome.
- **Tarjetas/KPIs/tablas** con estilos distintos entre secciones (marketing vs. app
  vs. catastro público).
- Resultado: el usuario salta entre "mini-apps" en vez de una plataforma.

## 1b. Corrección tras revisión de código (importante)

El **dashboard autenticado YA está unificado** — no hay que reconstruirlo:
- `_authenticated.tsx` es el shell único: `TopBar` (con **conmutador de proyecto** +
  breadcrumb), `CommandRail` (nav lateral agrupado), `ModuleSwitcher` (conmutador de
  espacios), `StatusBar`, `MobileBottomNav`, `WorkspaceTabs`, gating por rol/plan.
- `WORKSPACE_NAV` ya agrupa el nav: INICIO · CATASTRO & EXPLORACIÓN · CAPITAL &
  DEALS · TRADE & COMMODITIES · ADMINISTRACIÓN (≈ los 4 espacios de abajo).
- `ModuleKey = catastro | commodities | capital` (+ core) ≈ Explorar/Comercializar/
  Invertir; ADMINISTRACIÓN es el back-office.

**Conclusión:** el "paso 2" (AppShell unificado + conmutador de proyecto) está
sustancialmente hecho. El trabajo real de orden global es:
1. **Adoptar el design system** (`ui-system/`) en el CONTENIDO de las secciones,
   que es lo visualmente disparejo (cabeceras, tarjetas, KPIs, paneles).
2. **Alinear** el naming de grupos/módulos a los 4 espacios si se desea (cosmético).
3. **Sitio público** (AppShell marketing) y los visores por proyecto: unificar el
   lenguaje visual con el mismo design system.
El resto de este documento (4 espacios, principios) sigue válido como guía.

## 2. Principio de orden: 4 espacios de trabajo (workspaces)

Reagrupar las ~80 rutas en **4 espacios**, alineados al negocio (inversión, trading,
exploración) + back-office. Un único **app shell** con navegación lateral por espacio
y un **conmutador de proyecto** global en la barra superior.

| Espacio | Propósito | Rutas que agrupa (ejemplos) |
|---|---|---|
| **Explorar** (geociencia) | catastro, targeting, geociencia, informes | catastro, map, targets, satellite-intel, sat3d, geophysics, geology3d, estimation, sampling, drilling, qaqc, qps, ni43101, project-report, reports, opportunities, boletin, drones, agua, hse, expediente, mag-revalidations |
| **Invertir** (capital) | fichas, rondas, cap table, inversionistas | investments, offerings, investors, projects (catálogo), plan, precios, mission, analytics |
| **Comercializar** (trading) | marketplace, RFQ, lotes, logística, cobros | marketplace, rfqs, sourcing, commodity-lots, trade-board, trades, deals, listings, inventory, envios, cobranza, anticipos, my-inquiries, clientes, proveedores |
| **Administrar** (back-office) | finanzas, documentos, firmas, equipo | finance, documentos, firmas, team, approvals, audit, api, campaigns, admin, profile |

Reglas:
- **Un solo AppShell**: barra superior (logo · conmutador de proyecto · búsqueda
  global · notificaciones/alertas · usuario) + nav lateral que muestra las secciones
  del espacio activo. Los shells por proyecto se retiran: un proyecto es el
  **contexto seleccionado**, no un dashboard aparte.
- **El proyecto es contexto, no ruta**: Cholqui/Palmeras/Los Verdes dejan de ser
  dashboards separados; se eligen en el conmutador y todas las secciones se
  recalculan para ese proyecto (o "Todos" para vista de portafolio/holding).
- **Público vs. app** comparten design system; el shell público mantiene su header
  pero usa los mismos tokens/tarjetas.

## 3. Design system (un solo lenguaje)

Definir/consolidar en un solo lugar (extiende lo ya existente en el visor):
- **Tokens**: color (navy/gold/blue ya en `geocapitals.css`), tipografía, espaciado,
  radios, sombras — una fuente de verdad.
- **Componentes base**: `Card`, `Panel`, `KpiTile`, `DataTable`, `Badge` (reusar los
  **badges de evidencia** OFICIAL/MEDIDO/DERIVADO/INTERPRETADO/PROPUESTO ya hechos),
  `MapViewer` (chrome común: leyenda colapsable, capas, inspector — ya en
  `ProjectMasterViewer`), `SectionHeader`, `Toolbar`.
- **Patrón de página**: header (título + acciones) → filtros → contenido (cards/tabla/
  visor) → inspector lateral. Consistente en todas las secciones.
- **Procedencia siempre visible**: la disciplina de evidencia del visor se vuelve
  transversal (toda cifra lleva su badge de origen).

## 4. Vista "trading/inversión" (lo que el usuario pide ver)

Una **home unificada por rol**:
- **Inversionista**: portafolio (posiciones, valorización), oportunidades activas
  (fichas + simulador), alertas de mercado.
- **Explorador/operador**: mapa maestro (catastro + targets + capas), pipeline de
  targets, vigilancia (alertas de catastro), próximos hitos.
- **Comercializador**: RFQ activos, lotes, deals en curso, cobros.
Cada tarjeta enlaza a su sección dentro del mismo shell (no salta a otra mini-app).

## 5. Plan de ejecución (incremental, sin romper)

1. **Design system**: crear `src/components/ui-system/` con `Card/Panel/KpiTile/
   Badge/SectionHeader` y tokens únicos; adoptar en 1–2 secciones piloto.
2. **AppShell unificado**: un shell con barra superior + nav por espacio +
   conmutador de proyecto; envolver el dashboard actual sin mover rutas todavía.
3. **Agrupar nav** en los 4 espacios (solo reetiquetado/orden del menú; las rutas no
   cambian de URL).
4. **Proyecto como contexto**: un `ProjectProvider` global; migrar las secciones a
   leer el proyecto activo; retirar `FrancoDashboard`/`PalmerasDashboard` en favor de
   las secciones genéricas.
5. **Home por rol** + búsqueda global (catastro/proyectos/RFQ).
6. **Visor único**: consolidar los visores 2D/3D bajo el chrome común de `MapViewer`.

Cada paso es un PR chico y verificable (typecheck + una sección a la vez). No hay
"big bang".

## 6. Métrica de éxito

De "saltar entre mini-apps" a "una plataforma con 4 espacios, un shell, un lenguaje
visual y el proyecto como contexto" — lista para inversión, trading y exploración.
