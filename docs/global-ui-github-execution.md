# GeoCapitals — Global UI/UX · ejecución priorizada desde GitHub

## Propósito
Avanzar el diseño institucional **sin consumir créditos de Lovable durante la implementación**. Trabajar sobre `alvarocumora/prospecto-palmeritas`, que contiene la misma base de código de GeoCapitals. Cada iteración llega por rama + PR, validación CI y revisión antes de integrar. No desplegar ni editar `main` directamente.

### Decisiones de arquitectura
- **Un único shell autenticado existente** (`src/routes/_authenticated.tsx`, `TopBar`, `CommandRail`, `MobileBottomNav`). No reconstruirlo.
- **Identidad Institutional Modernist canónica**: tokens semánticos y `data-theme="im-light"` para superficies de contenido, sin hex hardcodeados en componentes nuevos.
- **Canvas geográfico/técnico como excepción interna** al workspace, sin segundo sistema de diseño. Reutilizar GeoScene3D (MapLibre + deck.gl), no otro motor 3D.
- **Proyecto activo y permisos actuales se preservan**. Público (slug) y privado (UUID) no son intercambiables arbitrariamente.
- Toda cifra financiera debe diferenciar **capital histórico confirmado, órdenes pendientes, colocación externa declarada, escenarios y valuaciones referenciales**; no inferir saldo disponible, retorno o liquidez.
- Toda imagen o dato geoespacial debe mostrar procedencia y límites; sin coordenadas o rasters sintéticos presentados como medidos.

## Primer PR GitHub (esta entrega)
- Crear `PlatformPage`, `PageHeader` y `ContentState` compartidos, sin alterar el shell existente.
- Migrar **Proyectos** y **Marketplace de propiedades** a estos componentes. Preservar navegación, filtros, roles, drawer, alta de proyectos, onboarding y llamadas actuales.
- Mejora mobile-first: acciones apilables, tamaños táctiles 44 px, título consistente, controles legibles y estados loading/empty diferenciados.
- Pruebas del design system. Sin cambios de servicios ni base de datos.

## Próximos PRs (sin Lovable)
| Orden | Área | Tarea | Condición de cierre |
| --- | --- | --- | --- |
| P1 | Investment / Portfolio / Wallet | Adoptar `PlatformPage` y cabeceras; evitar duplicación visual | Tickets, KYC, PDF y estados preservados |
| P2 | Colateral / Marketing / Auth | Alinear acciones y jerarquías, consolidar visual de landing | Flujos de suscripción y conversión funcionando |
| P3 | Proyectos / Reporting / Operaciones | Migrar patrones de panel, filtros y evidence badges | Entorno por proyecto y reportes intactos |
| P4 | GeoViewer 2D/3D | Chrome técnico común con cabecera/capas/inspector/contexto y controles mobile | Misma geometría, cámara, registro de capas y procedencia |
| P5 | Administración / Trade / CRM | Tablas, workflows, permisos, formularios y estados | Flujos y roles validados |
| P6 | QA transversal | Accesibilidad, performance, visual regression y PWA | CI verde, revisión en 320/390/1440 |

## Gate para cada PR
1. Diff acotado y sin cambiar contratos backend, RLS o RPC.
2. `npm run typecheck`, `npm run lint`, `npm run test` y `npm run build` por GitHub Actions.
3. QA 320 / 390 / 1440 cuando haya entorno autenticado; marcar limitaciones sin afirmar prueba no ejecutada.
4. Revisar que no se rompan permisos/roles, navegación por UUID/slug, datos reales, ni el service worker seguro.
5. Merge con aprobación. Solo usar Lovable al final para verificación visual/UX integrada y publicación explícitamente autorizada.

## Alcance y límites
Esta entrega no rediseña ni toca el motor 3D, auth, esquemas o ledger. No garantiza que todos los estilos legacy estén migrados; el sistema se extiende mediante pilotos medibles, evitando un cambio global de tokens que pueda romper superficies técnicas.
