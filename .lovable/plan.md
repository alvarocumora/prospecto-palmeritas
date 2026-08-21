# GeoCapitals Consolidation Plan (auditoría + fases)

Auditoría hecha sobre el código y la base real. Todo lo que se afirma aquí está verificado con lecturas de archivos y consultas a la base.

## Estado real verificado

**Frontend**: 152 rutas, 20 carpetas de features, ~190 archivos `*.functions.ts` de servidor, navegación centralizada en `src/lib/workspace.ts`, control de acceso en `src/lib/access/`.

**Base de datos** (conteos reales, no estimados):

| Tabla | Filas | Lectura |
|---|---|---|
| projects | 4 | Registro maestro real |
| property_listings | 4 | Vitrina; **las 4 apuntan a su project_id** — spine correcto |
| data_rooms | 2 | Solo 2 de 4 proyectos tienen data room |
| deals | 5 | **Todas con `project_id` NULL y `deal_status = DUE_DILIGENCE`** — sembrado, sin UI que lo escriba |
| property_deal_inquiries | 0 | Motor de deal real, aún sin uso |
| deal_stage_events | 0 | Bitácora del motor nuevo, aún sin uso |
| commodity_trades | 11 | Operación real y completa |
| commodity_lots | 0 | Vitrina de commodities sin inventario |
| organizations / organization_members | 1 / 0 | Entidad creada, sin adopción |
| investor_profiles / investors | 0 / 0 | Perfil de inversionista sin adopción |
| market_comparables | 35 | Motor de valorización con datos reales |
| cadastre_national | 11.751 | Catastro real |

## Hallazgos de fragmentación (verificados)

1. **Dos motores de deal coexisten.** `deals` (project_id NULL en las 5 filas, ninguna escritura desde la app: solo se lee en `platformStats.functions.ts` como contador) vs. el motor real `property_deal_inquiries` + `deal_stage_events` + `dealFlow.functions.ts`, montado en `ListingDetailDrawer` y todavía con 0 filas.
2. **Métricas públicas infladas.** `src/routes/api/public/stats.ts` → `platformStats.functions.ts` cuenta `deals` (5 filas sembradas) y lo publica en la landing como métrica de plataforma.
3. **Data Room incompleto.** Existen `data_rooms`, `data_room_folders/files/access_grants/access_logs` con RLS, pero solo 2 proyectos tienen room y no hay gate NDA→acceso cableado al motor de deal.
4. **Organizaciones e investor profile son esqueleto.** Tablas y RLS existen; el permiso efectivo hoy es user→project_members / app_roles, no user→organization→role.
5. **Tres tablas sin políticas RLS**: `email_delivery_events`, `portal_otp_challenges`, `portal_sessions` (RLS activo, 0 políticas ⇒ cerradas al cliente; correcto por diseño para las dos de portal, pero debe quedar documentado, no accidental).
6. **Rutas duplicadas por caso de uso** (ya diagnosticado y parcialmente consolidado en navegación): 5 vitrinas de inversión, 3 de commodities, `/live/{4 proyectos}` casi idénticas, `/terminal/*` sin entrada de menú.
7. **Coherencia gráfica parcial**: solo 29 archivos aplican `data-theme="im-light"`.

## Matriz de consolidación priorizada

| P | Dominio | Problema actual | Componente existente | Arquitectura propuesta | Cambios DB | Riesgo | Acción |
|---|---|---|---|---|---|---|---|
| P0 | Deal Engine | Dos modelos de deal; `deals` huérfana con datos sembrados | `dealFlow.functions.ts`, `DealStageTracker` | Un solo motor sobre `property_deal_inquiries` + `deal_stage_events`, con máquina de estados completa (discovery→…→closed + paused/withdrawn/rejected/expired) | Ampliar enum de etapas; migrar/retirar `deals`; índices por listing/inquiry | Medio | Consolidar |
| P0 | Métricas | Landing publica conteos de una tabla sembrada | `platformStats.functions.ts` | Métricas derivadas de `projects`, `property_deal_inquiries`, `commodity_trades`, `data_rooms` | Ninguno | Bajo | Corregir |
| P0 | Seguridad | 3 tablas con RLS y 0 políticas; verificar que sea intencional | — | Documentar en security-memory o añadir política explícita | Posibles políticas | Bajo | Auditar |
| P1 | Data Room | Solo 2/4 proyectos; sin gate NDA | `dataRoom.functions.ts`, tablas completas | Un Data Room por proyecto con 15 carpetas canónicas, gate por NDA firmado, bitácora de accesos y métricas para el vendedor | Semilla de carpetas; `nda_required` ya existe | Medio | Completar |
| P1 | NDA | Firma existe como módulo aparte del deal | `document_signatures`, `firmar.$token` | La firma del NDA dispara la transición de etapa y abre el grant del data room | Trigger o server fn que emita evento | Medio | Conectar |
| P1 | Project Master Record | Campos de proyecto repartidos entre `projects`, `property_listings`, `project_facts` | `projectFacts.functions.ts` | `projects` como único registro; listing = capa comercial que referencia, nunca copia | Migrar campos duplicados a `projects`; vistas de compatibilidad | Medio | Normalizar |
| P1 | Estado | Estado crítico de flujo aún en React en varias pantallas | — | Server state en Supabase, filtros en URL, UI state local | Ninguno | Bajo | Refactor |
| P2 | Due Diligence | No existe checklist estructurado para proyectos (sí para trades) | `TradeComplianceChecklist` | Reusar el patrón de checklist de trades con las 17 categorías mineras + score y riesgo explicado | Tabla `dd_items` / `dd_findings` por deal | Medio | Construir |
| P2 | Readiness / GeoScore | No existe | `ValuationPanel`, `market_comparables` | Transaction Readiness (documentos presentes) y GeoScore ponderado, ambos con desglose visible y sin lenguaje de asesoría financiera | Vista materializada o cálculo en server fn | Bajo | Construir |
| P2 | Organizaciones | Entidad sin adopción | `organizations`, `organization_members` | user→organization→role como capa de permiso encima de la actual, sin romper `project_members` | Backfill de 1 org; políticas aditivas | Alto | Adoptar por fases |
| P2 | Commodities | 0 lotes; 3 vitrinas | `commodity_lots`, `/dashboard/trades` (canónico) | Lotes se administran en un solo lugar y se publican al marketplace con un switch; RFQ→trade en un clic | Ninguno | Bajo | Consolidar |
| P3 | Búsqueda global ⌘K | No existe | — | Búsqueda unificada sobre projects/deals/trades/documentos con filtro por permiso | Índices trigram | Bajo | Construir |
| P3 | Coherencia gráfica | 29/152 archivos en Institutional Modernist | tokens IM | Migración módulo a módulo | Ninguno | Bajo | Migrar |
| P3 | Notificaciones y eventos | Dispersas | `notifications.functions.ts` | Capa de eventos (`deal.stage_changed`, `nda.signed`, `document.uploaded`) que alimenta bitácora y notificaciones | Tabla `platform_events` | Medio | Construir |

## Orden de ejecución propuesto

**Fase A (P0, sin regresión, reversible)**
1. Métricas públicas reales: quitar `deals` del contador y usar tablas con datos verdaderos.
2. Motor de deal único: ampliar los estados, retirar `deals` de la superficie (dejar la tabla intacta hasta migrar), asegurar que toda transición pase por `dealFlow` y quede en `deal_stage_events`.
3. Dictamen sobre las 3 tablas sin políticas y registro en la memoria de seguridad.

**Fase B (P1)**
4. Data Room canónico por proyecto con carpetas 01–15 y gate por NDA.
5. NDA integrado al motor de deal (firma → etapa → grant → bitácora).
6. Project Master Record: `projects` como fuente única, listing solo comercial.

**Fase C (P2)** Due Diligence engine + Readiness/GeoScore + consolidación de commodities + adopción de organizaciones.

**Fase D (P3)** ⌘K, capa de eventos y notificaciones, migración gráfica completa.

## Reglas de no regresión aplicadas

- Ninguna tabla se borra en la fase A; `deals` se retira de la UI y se marca como deprecada antes de migrar.
- Toda ruta eliminada se conserva como redirect (`beforeLoad` + `throw redirect`).
- Cambios de RLS solo aditivos y revisados con el escáner de seguridad tras cada fase.
- Validación por fase: AUTH → DB → RLS → rutas → UI → móvil → workflow → estados de error.
- No se agregan botones sin backend: lo no implementado se oculta o se marca como próximo.

## Nota de alcance

Este plan cubre la consolidación estructural. La capa de IA (copiloto, memos, resumen de NI 43-101) queda en P3 y solo se activa una vez que el Data Room y el motor de permisos garanticen que el contexto entregado al modelo esté restringido a lo que el usuario ya puede ver.
