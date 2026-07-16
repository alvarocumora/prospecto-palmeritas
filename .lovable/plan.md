## Diagnóstico rápido

Revisé la plataforma y encontré por qué "no funciona muy bien":

1. **Data room vacío en los 4 listings** — `property_data_room_files` tiene 0 filas. Por eso la sección "Data room" ni aparece en `/proyectos/:id` (está detrás de `totalFiles > 0`), y el drawer autenticado muestra "sin archivos".
2. **Cero inquiries** — el flujo NDA → mensaje → deal nunca se ha ejercitado, así que el estado real es invisible al dueño.
3. **Info real por proyecto desconectada** — la ficha pública ya agrega concesiones, sondajes, muestras, anomalías, targets y NI 43-101 desde las tablas del proyecto, pero:
  - No hay CTA para "solicitar acceso / firmar NDA" desde `/proyectos/:id` (solo desde el drawer autenticado en `/inversionistas`).
  - El dueño no tiene una vista clara de "estado del listing" (publicado, docs, interesados, NDAs firmados).
4. `**DataRoomManager` existe pero está mal expuesto** — no hay una pantalla clara de administración del data room por listing para el owner.

## Plan (5 pasos, sólo frontend + seed inicial)

### 1. Panel de administración de listing (owner)

Nueva ruta `/_authenticated/dashboard/listings/$listingId` con:

- Cabecera con estado (publicado / borrador, vistas, precio).
- **DataRoomManager** embebido a tamaño completo (subir NI 43-101, geología, legal, financiero).
- Tabla de inquiries recibidas: quién, cuándo, NDA firmado, mensaje, estado, acción (responder / marcar).
- Link "Ver ficha pública" → `/proyectos/:id`.

En `/_authenticated/dashboard/listings.tsx` añadir botón "Administrar" en cada card del owner que vaya a esta ruta.

### 2. Ficha pública `/proyectos/:id` — flujo de inversión visible

- Mostrar **siempre** la sección "Data room" (aunque `totalFiles === 0` decir "En preparación por el titular").
- Añadir botón primario **"Solicitar acceso / Firmar NDA"** que:
  - Si el visitante no está logueado → `/auth?intent=investor&next=/proyectos/:id`.
  - Si está logueado → abre modal con NDA (reutiliza `signListingNda`) + textarea de mensaje (reutiliza `upsertInquiry`).
  - Tras firmar, muestra listado de archivos con botón descargar (usa `listDataRoomFiles` + `getDataRoomDownloadUrl`, que ya hacen gating por NDA).

### 3. Estado real del listing en la card pública

En `/inversionistas` (DealFlow) y `/proyectos/:id`, mostrar chips reales:

- `N documentos` (data room)
- `NDA requerido` / `abierto`
- `N interesados` (count de inquiries)

### 4. Seed de data room demo para los 4 listings

Un componente admin (o script one-shot) que suba 2-3 PDFs placeholder por listing en categorías `ni43101`, `geologia`, `legal`, para que la plataforma no se vea vacía en las demos. Alternativa: banner "Data room en preparación" cuando esté vacío (menos trabajo, más honesto).

### 5. Verificación end-to-end

- Playwright: login como owner de Los Verdes → subir un PDF → logout → login como inversor → abrir `/proyectos/:id` → firmar NDA → descargar el PDF.
- Confirmar que el owner ve la inquiry en su panel.

## Archivos a tocar

- `src/routes/_authenticated.dashboard.listings.$listingId.tsx` **(nuevo)** — panel owner.
- `src/routes/_authenticated.dashboard.listings.tsx` — añadir link "Administrar".
- `src/routes/proyectos.$listingId.tsx` — sección data room siempre visible + CTA NDA + listado condicional post-firma.
- `src/features/listings/ListingInquiriesPanel.tsx` **(nuevo)** — tabla de inquiries del owner (usa server fn nueva `listInquiriesForOwner`).
- `src/lib/dataRoom.functions.ts` — añadir `listInquiriesForOwner(listingId)` que valida ownership.
- `src/lib/listingDetail.functions.ts` — devolver `inquiriesCount` en agregados.
- `src/features/marketing/DealFlow.tsx` (o card) — chips de estado real.

## Qué NO incluyo

- Cambios en RLS / migraciones (todo el backend ya está en pie).
- Rehacer valuación (`ValuationPanel` ya corre por listing, verificado).
- Live maps (ya público).

## Preguntas antes de implementar

1. ¿Seed real de PDFs demo o solo el banner "En preparación"? (Recomiendo banner — evita meter PDFs falsos en producción.) banner 
2. ¿El panel de admin de listing va bajo `/dashboard/listings/$id` (nueva subruta) o dentro del drawer actual expandido? (Recomiendo ruta dedicada — más espacio y linkeable.) ruta dedicada revisar esto tambien # MASTER PROMPT — GEOCAPITALS SPV MINING DEALS + DATABASE DEPLOYMENT
  Continúa el desarrollo del proyecto GeoCapitals en la rama:
  feature/spv-mining-deals
  PR asociado:
  #108 — SPV Mining Deals — Terra Aurum Deal OS foundation
  No trabajar directamente sobre `main`.
  No modificar la rama:
  feature/public-experience-v2
  No construir una landing pública.
  El objetivo es desarrollar el módulo interno operacional “SPV Mining Deals” y desplegar correctamente toda la infraestructura de base de datos que requiera.
  ==========================================================
  1. CONTEXTO
  ==========================================================
  GeoCapitals necesita administrar vehículos de propósito especial utilizados para:
  - adquisición de activos mineros
  - joint ventures
  - desarrollo de proyectos
  - levantamiento de capital
  - entrada de socios estratégicos
  - venta parcial o total de activos
  - administración de fees, equity, carry y royalties
  - due diligence
  - data rooms
  - pipeline de inversionistas
  - distribución de fondos
  - compliance y auditoría
  El primer caso demo es:
  Terra Aurum Gold SPV I
  Datos iniciales:
  - Propietario: Terra Aurum
  - Estructurador: GeoCapitals
  - Commodity: oro
  - Estado: en estructuración
  - Valor referencial del activo: USD 20.000.000
  - Capital buscado: USD 5.000.000
  - Terra Aurum: 65%
  - Inversionistas: 25%
  - GeoCapitals: 10%
  - Fee de estructuración: USD 100.000
  - Success fee GeoCapitals: 4% del valor efectivo de la transacción
  - Carry GeoCapitals: 10% de utilidades después del retorno preferente
  - Retorno preferente del inversionista: 8% anual
  Todos estos valores deben ser editables y estar identificados como datos demo referenciales.
  ==========================================================
  2. AUDITORÍA INICIAL OBLIGATORIA
  ==========================================================
  Antes de modificar código:
  1. Revisar la rama `feature/spv-mining-deals`.
  2. Revisar los archivos ya creados en:
     src/modules/spv/
  3. Revisar las capacidades existentes en GeoCapitals que puedan reutilizarse:
     - organizations
     - projects
     - app_roles
     - has_role()
     - RLS
     - audit logs
     - Data Room
     - Investor CRM
     - Due Diligence
     - document storage
     - approvals
     - notifications
     - deals
     - marketplace
     - contact/investor records
     - reporting
     - usage limits
     - feature flags
  4. Buscar migraciones pendientes en:
     supabase/migrations/
  5. Comparar migraciones locales versus migraciones aplicadas en Lovable Cloud/Supabase.
  6. Identificar especialmente migraciones pendientes relacionadas con:
     - advance_requests
     - underwriting
     - investor workflows
     - marketplace
     - data room
     - organizations
     - project roles
     - audit logs
     - cualquier otra migración existente todavía no desplegada
  7. No asumir que una migración fue aplicada solo porque existe en GitHub.
  Generar primero un breve inventario interno:
  - migraciones aplicadas
  - migraciones pendientes
  - migraciones con riesgo de conflicto
  - tablas existentes que se reutilizarán
  - tablas nuevas requeridas por SPV Mining Deals
  ==========================================================
  3. REGLAS PARA BASE DE DATOS
  ==========================================================
  Las migraciones deben ser:
  - incrementales
  - idempotentes cuando corresponda
  - no destructivas
  - compatibles con datos existentes
  - seguras para producción
  - con RLS habilitado
  - con índices adecuados
  - con timestamps
  - con organization_id y project_id cuando aplique
  - con auditabilidad
  - compatibles con multi-tenant
  No hacer:
  - DROP TABLE
  - TRUNCATE
  - eliminación masiva
  - reemplazo de tablas productivas
  - cambios irreversibles sin respaldo
  - desactivar RLS
  - políticas públicas indiscriminadas
  - usar service role desde el frontend
  Antes de aplicar migraciones:
  - revisar conflictos de nombres
  - revisar foreign keys
  - revisar tipos existentes
  - revisar políticas existentes
  - revisar funciones SECURITY DEFINER
  - revisar exposición por RLS
  ==========================================================
  4. MODELO DE DATOS SPV
  ==========================================================
  Crear migraciones para un modelo modular y normalizado.
  Tablas base sugeridas:
  1. spv_deals
  Campos mínimos:
  - id UUID PK
  - organization_id UUID
  - project_id UUID nullable
  - mining_asset_id UUID nullable
  - legal_name
  - commercial_name
  - code
  - jurisdiction_country
  - entity_type
  - base_currency
  - purpose
  - status
  - estimated_incorporation_date
  - incorporated_at
  - target_capital
  - committed_capital
  - reference_asset_value
  - description
  - created_by
  - created_at
  - updated_at
  - archived_at
  Estados recomendados:
  - draft
  - structuring
  - due_diligence
  - roadshow
  - negotiation
  - funded
  - operating
  - exit
  - closed
  - liquidated
  - cancelled
  2. spv_mining_assets
  Campos:
  - id
  - organization_id
  - project_id nullable
  - name
  - owner_name
  - commodity
  - country
  - region
  - latitude
  - longitude
  - area_ha
  - concession_count
  - title_status
  - legal_status
  - exploration_stage
  - inferred_resources
  - indicated_resources
  - measured_resources
  - probable_reserves
  - proven_reserves
  - average_grade
  - recovery_rate
  - mine_life_years
  - estimated_capex
  - estimated_opex
  - annual_production
  - technical_standard
  - environmental_status
  - permits_summary
  - risks
  - executive_summary
  - completeness_score
  - validation_status
  - created_at
  - updated_at
  3. spv_participants
  Campos:
  - id
  - spv_id
  - organization_id
  - participant_type
  - legal_name
  - display_name
  - tax_id nullable
  - country
  - contact_name
  - contact_email
  - role_in_transaction
  - kyc_status
  - aml_status
  - beneficial_owner_status
  - related_party
  - active
  - created_at
  - updated_at
  Tipos:
  - asset_owner
  - structurer
  - investor
  - mining_operator
  - legal_advisor
  - technical_advisor
  - financial_advisor
  - auditor
  - strategic_partner
  - other
  4. spv_contributions
  Campos:
  - id
  - spv_id
  - participant_id
  - contribution_type
  - description
  - amount
  - currency
  - reference_value
  - valuation_method
  - contributed_at
  - status
  - supporting_document_id nullable
  - created_at
  - updated_at
  Tipos:
  - mining_asset
  - mining_rights
  - cash
  - geological_studies
  - professional_services
  - technology
  - equipment
  - commercial_network
  - investor_origination
  - transaction_management
  - other
  5. spv_cap_table_entries
  Campos:
  - id
  - spv_id
  - participant_id
  - investment_round_id nullable
  - contribution_value
  - securities_count
  - initial_percentage
  - post_money_percentage
  - economic_rights_percentage
  - voting_rights_percentage
  - liquidation_preference
  - vesting_terms
  - dilution_terms
  - drag_along
  - tag_along
  - status
  - effective_from
  - effective_to nullable
  - created_at
  - updated_at
  Agregar restricción o validación para evitar porcentajes fuera de 0–100.
  6. spv_investment_rounds
  Campos:
  - id
  - spv_id
  - name
  - round_type
  - pre_money_valuation
  - target_amount
  - committed_amount
  - post_money_valuation
  - currency
  - status
  - opened_at
  - closed_at
  - created_at
  - updated_at
  Tipos:
  - initial
  - development
  - construction
  - strategic
  - bridge
  - partial_sale
  - full_sale
  - other
  7. spv_compensation_rules
  Campos:
  - id
  - spv_id
  - beneficiary_participant_id
  - compensation_type
  - percentage
  - fixed_amount
  - currency
  - calculation_base
  - trigger_event
  - payment_priority
  - minimum_amount
  - maximum_amount
  - start_date
  - end_date
  - conditions
  - tax_treatment
  - disclosure_status
  - approval_status
  - payment_status
  - created_at
  - updated_at
  Tipos:
  - monthly_retainer
  - structuring_fee
  - success_fee
  - equity
  - profit_share
  - carry
  - royalty
  - nsr
  - capital_raise_commission
  - asset_sale_commission
  - milestone_fee
  - other
  Toda compensación debe quedar explícitamente divulgada.
  8. spv_financial_scenarios
  Campos:
  - id
  - spv_id
  - name
  - scenario_type
  - assumptions JSONB
  - outputs JSONB
  - disclaimer
  - version
  - created_by
  - approved_by nullable
  - created_at
  - updated_at
  Escenarios:
  - conservative
  - base
  - optimistic
  - custom
  9. spv_waterfall_steps
  Campos:
  - id
  - spv_id
  - name
  - step_order
  - distribution_type
  - beneficiary_participant_id nullable
  - percentage nullable
  - fixed_amount nullable
  - hurdle_rate nullable
  - calculation_base
  - conditions JSONB
  - active
  - created_at
  - updated_at
  10. spv_waterfall_simulations
  Campos:
  - id
  - spv_id
  - scenario_id nullable
  - gross_proceeds
  - costs
  - simulation_input JSONB
  - simulation_output JSONB
  - created_by
  - created_at
  11. spv_due_diligence_items
  Campos:
  - id
  - spv_id
  - category
  - title
  - description
  - status
  - risk_level
  - responsible_user_id nullable
  - due_date
  - evidence_document_id nullable
  - observations
  - mitigation_plan
  - reviewed_by nullable
  - reviewed_at nullable
  - created_at
  - updated_at
  Categorías:
  - legal
  - mining
  - geological
  - technical
  - financial
  - tax
  - environmental
  - social
  - corporate
  - commercial
  - compliance
  - capital_markets
  - esg
  Estados:
  - not_started
  - pending
  - in_review
  - observations
  - approved
  - rejected
  - not_applicable
  12. spv_investor_pipeline
  Campos:
  - id
  - spv_id
  - investor_id nullable
  - participant_id nullable
  - investor_name
  - company
  - investor_type
  - country
  - estimated_ticket
  - investment_thesis
  - contact_name
  - contact_email
  - stage
  - probability
  - last_interaction_at
  - next_action
  - next_action_at
  - owner_user_id
  - comments
  - created_at
  - updated_at
  Etapas:
  - identified
  - contacted
  - nda_sent
  - nda_signed
  - teaser_sent
  - dataroom_enabled
  - initial_meeting
  - preliminary_interest
  - due_diligence
  - non_binding_offer
  - binding_offer
  - negotiation
  - closed
  - discarded
  13. spv_milestones
  Campos:
  - id
  - spv_id
  - name
  - milestone_type
  - description
  - responsible_user_id
  - due_date
  - completed_at
  - status
  - evidence_document_id nullable
  - depends_on_milestone_id nullable
  - created_at
  - updated_at
  14. spv_documents
  Evaluar si conviene reutilizar el sistema Data Room actual.
  No duplicar archivos físicos si ya existe una tabla general de documentos.
  Si se reutiliza el sistema existente, crear solo una tabla relacional:
  - spv_document_links
  Campos:
  - id
  - spv_id
  - document_id
  - folder
  - version
  - access_level
  - review_status
  - responsible_user_id
  - created_at
  - updated_at
  15. spv_audit_events
  Preferentemente reutilizar el audit log global.
  Si el audit log global admite entity_type/entity_id, usar:
  - entity_type = spv_deal
  - entity_id = spv_id
  No duplicar auditoría sin necesidad.
  ==========================================================
  5. MULTI-TENANT Y RLS
  ==========================================================
  Todas las tablas del módulo deben tener RLS.
  Aplicar políticas siguiendo la arquitectura existente de GeoCapitals.
  Usar organization_id y relaciones de membresía actuales.
  Permisos funcionales:
  - Superadministrador GeoCapitals:
    acceso completo.
  - Ejecutivo de inversiones:
    crear/editar SPV, pipeline, participantes, hitos y reportes.
  - Analista financiero:
    modelo financiero, Cap Table, escenarios y waterfall.
  - Propietario del activo:
    lectura del SPV y edición limitada de información del activo y documentos autorizados.
  - Inversionista:
    acceso solo a SPV autorizados, documentos habilitados y datos permitidos.
  - Asesor legal:
    legal DD, documentos, contratos y compliance.
  - Asesor técnico/geólogo:
    ficha técnica, recursos, reservas, geología y technical DD.
  - Auditor:
    solo lectura y acceso a historial/auditoría permitido.
  No confiar solo en permisos frontend.
  Implementar permisos reales en base de datos.
  Usar funciones existentes como:
  - has_role()
  - organization membership
  - project membership
  - capabilities matrix
  Auditar cualquier función SECURITY DEFINER.
  Agregar `SET search_path` seguro en funciones SECURITY DEFINER.
  ==========================================================
  6. SEED DEMO TERRA AURUM
  ==========================================================
  Crear un seed idempotente para:
  Terra Aurum Gold SPV I
  Solo insertar si no existe por código único, por ejemplo:
  TA-GOLD-SPV-I
  Crear:
  - activo Terra Aurum Gold Project
  - SPV
  - participantes
  - aportes
  - Cap Table
  - reglas de compensación
  - escenario financiero base
  - waterfall inicial
  - checklist de due diligence
  - pipeline demo
  - hitos demo
  Participantes:
  Terra Aurum:
  - asset owner
  - 65%
  GeoCapitals:
  - structurer
  - 10%
  Investor Pool:
  - investor
  - 25%
  Compensaciones GeoCapitals:
  - structuring fee: USD 100.000
  - success fee: 4%
  - equity: 10%
  - carry: 10% después del retorno preferente
  - disclosure_status: disclosed
  Inversionista:
  - preferred return: 8% anual
  El seed debe funcionar en desarrollo y preview sin duplicar registros.
  No insertar datos demo automáticamente en producción si existe riesgo de contaminar información real.
  Usar una condición segura o función administrativa explícita para crear el demo.
  ==========================================================
  7. UI OPERACIONAL
  ==========================================================
  Después de crear el modelo de datos, implementar:
  src/modules/spv/ui/
  Componentes iniciales:
  - SPVShell
  - SPVSidebar
  - SPVTopbar
  - SPVProjectSelector
  - SPVStatusBadge
  - SPVDashboard
  - SPVKpiGrid
  - SPVFundingProgress
  - SPVEquityChart
  - SPVTimeline
  - SPVCapTable
  - SPVWaterfallSimulator
  - SPVInvestorPipeline
  - SPVDataRoom
  - SPVDueDiligenceChecklist
  Crear ruta interna protegida:
  /dashboard/spv
  Y detalle:
  /dashboard/spv/$spvId
  No hacer pública esta ruta.
  ==========================================================
  8. SIDEBAR
  ==========================================================
  Secciones:
  Overview
  Asset
  - Mining Asset
  Corporate
  - Participants
  - Corporate Structure
  - Cap Table
  Financial
  - Financial Model
  - Waterfall
  Execution
  - Investor Pipeline
  - Data Room
  - Due Diligence
  - Milestones
  Governance
  - Contracts
  - Compliance
  - Reports
  - Settings
  Debe ser responsive.
  En móvil usar Sheet/Drawer.
  ==========================================================
  9. DASHBOARD EJECUTIVO
  ==========================================================
  Usar datos reales desde Supabase después de aplicar migraciones.
  Mostrar:
  - nombre del SPV
  - proyecto minero
  - commodity
  - país
  - etapa
  - valor referencial del activo
  - capital buscado
  - capital comprometido
  - porcentaje financiado
  - equity Terra Aurum
  - equity GeoCapitals
  - equity inversionistas
  - success fee estimado
  - retorno proyectado
  - avance due diligence
  - próximo hito
  - estado general
  Gráficos:
  - capital target vs committed
  - distribución accionaria
  - distribución proyectada
  - evolución de valor
  - due diligence progress
  - timeline
  - investor pipeline funnel
  No usar datos hardcoded dentro de componentes si ya están disponibles en el seed o en Supabase.
  ==========================================================
  10. CAP TABLE
  ==========================================================
  Crear tabla dinámica con:
  - socio
  - tipo
  - aporte
  - valor
  - securities
  - porcentaje inicial
  - porcentaje post inversión
  - derechos económicos
  - votos
  - preferencia de liquidación
  - estado
  Agregar escenarios:
  - pre-money
  - post-money
  - ronda inicial
  - ronda de desarrollo
  - ronda de construcción
  - socio estratégico
  - venta parcial
  - venta total
  Toda simulación debe ser referencial.
  ==========================================================
  11. WATERFALL
  ==========================================================
  Crear orden inicial:
  1. costos de cierre
  2. obligaciones del SPV
  3. devolución de capital
  4. retorno preferente
  5. success fee GeoCapitals
  6. distribución de utilidades
  7. carry GeoCapitals
  8. distribución residual
  Permitir reordenamiento visual.
  No persistir un nuevo orden hasta que el usuario confirme.
  Mostrar resultados por participante.
  Usar cálculos puros y testeables en:
  src/modules/spv/domain/waterfall.ts
  No hacer cálculos financieros críticos directamente dentro de componentes React.
  ==========================================================
  12. DATA ROOM
  ==========================================================
  Reutilizar infraestructura existente.
  Carpetas:
  - Corporate
  - Mining Titles
  - Geology
  - NI 43-101
  - JORC
  - Metallurgy
  - Environment
  - Communities
  - Permits
  - Finance
  - Tax
  - Contracts
  - Ownership
  - Insurance
  - Litigation
  - ESG
  - Presentations
  - LOIs
  - NDAs
  - SPV Documents
  Cada archivo debe mostrar:
  - nombre
  - categoría
  - versión
  - fecha
  - responsable
  - acceso
  - revisión
  - comentarios
  - historial
  Aplicar signed URLs o mecanismo seguro existente.
  No hacer buckets públicos.
  ==========================================================
  13. DUE DILIGENCE
  ==========================================================
  Crear checklist con:
  - progreso
  - responsable
  - deadline
  - evidencia
  - observaciones
  - riesgo
  - mitigación
  - estado
  Agregar resumen:
  - avance total
  - observaciones abiertas
  - riesgos críticos
  - ítems vencidos
  - ítems aprobados
  ==========================================================
  14. PIPELINE
  ==========================================================
  Crear Kanban con etapas definidas.
  El drag and drop debe:
  - actualizar solo el registro movido
  - validar transición
  - guardar historial
  - registrar evento de auditoría
  - revertir visualmente si falla el servidor
  - no perder los demás registros
  ==========================================================
  15. DOCUMENTOS Y CONTRATOS
  ==========================================================
  Preparar generadores de borradores para:
  - NDA
  - MOU
  - mandato de estructuración
  - success fee agreement
  - shareholders agreement
  - profit participation agreement
  - investment agreement
  - term sheet
  - LOI
  - option agreement
  - SPA
  - royalty agreement
  - board resolution
  Todo documento generado debe incluir:
  “DRAFT — SUBJECT TO LEGAL REVIEW”
  No generar documentos como definitivos o listos para firma sin aprobación legal.
  ==========================================================
  16. MIGRACIONES PENDIENTES EXISTENTES
  ==========================================================
  Además de las migraciones del SPV:
  1. Identificar todas las migraciones locales pendientes existentes.
  2. Aplicarlas en orden cronológico.
  3. Incluir especialmente cualquier migración pendiente de:
     advance_requests
  4. Antes de aplicarlas:
     - revisar compatibilidad
     - revisar RLS
     - revisar índices
     - revisar dependencias
     - revisar si ya fueron aplicadas manualmente
  5. Si una migración ya fue aplicada manualmente:
     - no duplicar objetos
     - corregir el historial de migraciones de forma segura
     - documentar la situación
  6. Si una migración falla:
     - detener la secuencia
     - mostrar el error exacto
     - no continuar aplicando migraciones dependientes
     - no hacer rollback destructivo automático
     - corregir con una nueva migración incremental
  ==========================================================
  17. DESPLIEGUE LOVABLE CLOUD / SUPABASE
  ==========================================================
  Ejecutar el despliegue real de base de datos usando las herramientas disponibles de Lovable Cloud.
  Orden obligatorio:
  1. Crear migraciones locales.
  2. Validar SQL.
  3. Revisar diff de esquema.
  4. Aplicar migraciones pendientes existentes.
  5. Aplicar migraciones SPV.
  6. Verificar tablas.
  7. Verificar RLS.
  8. Verificar políticas.
  9. Verificar índices.
  10. Ejecutar seed demo de forma segura.
  11. Consultar el SPV demo desde el frontend.
  12. Validar escritura y lectura con roles permitidos.
  13. Validar bloqueo con roles no permitidos.
  No limitarse a generar archivos SQL.
  Las migraciones deben quedar realmente aplicadas en el backend conectado al proyecto.
  Si Lovable solicita confirmación para desplegar cambios de base de datos, presentar el resumen y continuar con la aplicación de los cambios autorizados.
  ==========================================================
  18. SERVER FUNCTIONS Y ACCESO A DATOS
  ==========================================================
  Crear capa de acceso dentro de:
  src/modules/spv/infra/
  y casos de uso dentro de:
  src/modules/spv/application/
  Ejemplos:
  - listSpvDeals
  - getSpvDeal
  - createSpvDeal
  - updateSpvDeal
  - getSpvDashboard
  - updateMiningAsset
  - listParticipants
  - updateCapTable
  - runWaterfallSimulation
  - listDueDiligence
  - updateDueDiligenceItem
  - listInvestorPipeline
  - moveInvestorPipelineStage
  - listSpvDocuments
  - listMilestones
  No consultar Supabase directamente desde componentes UI cuando exista una capa de aplicación.
  Validar inputs con Zod.
  No confiar en IDs enviados por el cliente sin verificar organización y acceso.
  ==========================================================
  19. AUDITORÍA
  ==========================================================
  Registrar eventos para:
  - creación SPV
  - cambio de estado
  - edición del activo
  - cambio de participación
  - nueva ronda
  - cambio Cap Table
  - edición de compensación
  - simulación waterfall
  - acceso a documentos sensibles
  - cambio due diligence
  - movimiento pipeline
  - cambio beneficiario final
  - aprobación/rechazo
  - generación de reporte
  - generación de borrador contractual
  Guardar:
  - actor
  - organization
  - spv
  - acción
  - entidad
  - before
  - after
  - timestamp
  - request_id cuando esté disponible
  ==========================================================
  20. ALERTAS DE COMPLIANCE
  ==========================================================
  Crear validaciones y alertas cuando:
  - una compensación no esté divulgada
  - un participante no tenga KYC
  - exista conflicto de interés pendiente
  - cambie el beneficiario final
  - un pago use una jurisdicción distinta
  - haya un intermediario no registrado
  - exista información técnica no validada
  - una participación cambie sin aprobación
  - la Cap Table no sume 100%
  - el waterfall incluya un beneficiario no documentado
  - el success fee no tenga contrato asociado
  No bloquear silenciosamente.
  Mostrar motivo y acción requerida.
  ==========================================================
  21. REPORTES
  ==========================================================
  Preparar reportes exportables:
  - resumen ejecutivo
  - ficha del activo
  - Cap Table
  - distribución
  - due diligence
  - pipeline
  - riesgos
  - hitos
  - comité de inversión
  - reporte mensual
  Los reportes pueden iniciar como HTML imprimible o PDF usando la infraestructura existente.
  No crear un motor PDF duplicado si ya existe uno.
  ==========================================================
  22. VALIDACIÓN FINAL
  ==========================================================
  Ejecutar:
  npm run typecheck
  npm run lint
  npm run test
  npm run build
  Si existe:
  npm run validate
  Validar además:
  - carga `/dashboard/spv`
  - carga detalle Terra Aurum
  - navegación desktop
  - navegación móvil
  - lectura de datos Supabase
  - escritura autorizada
  - bloqueo RLS
  - Cap Table = 100%
  - cálculo waterfall
  - due diligence progress
  - pipeline transitions
  - Data Room access
  - ausencia de errores en consola
  - ausencia de credenciales expuestas
  - ausencia de buckets públicos accidentales
  ==========================================================
  23. CRITERIOS DE ACEPTACIÓN
  ==========================================================
  La entrega será aceptada cuando:
  - el módulo SPV sea accesible internamente
  - Terra Aurum Gold SPV I aparezca desde Supabase
  - los datos no dependan únicamente de hardcodes
  - las migraciones pendientes estén aplicadas
  - las nuevas migraciones SPV estén aplicadas
  - RLS esté habilitado y validado
  - roles tengan permisos correctos
  - la navegación lateral funcione
  - el dashboard ejecutivo funcione
  - la Cap Table cargue
  - el waterfall simule resultados
  - el pipeline muestre inversionistas
  - el Data Room cargue carpetas/documentos
  - due diligence muestre avance
  - auditoría registre cambios críticos
  - los cálculos tengan disclaimer
  - los documentos tengan disclaimer legal
  - TypeScript, ESLint, tests y build estén limpios
  ==========================================================
  24. REPORTE FINAL OBLIGATORIO
  ==========================================================
  Al terminar, entregar un reporte con:
  1. Archivos creados.
  2. Archivos modificados.
  3. Migraciones nuevas.
  4. Migraciones pendientes detectadas.
  5. Migraciones aplicadas correctamente.
  6. Migraciones no aplicadas y motivo.
  7. Tablas creadas.
  8. Políticas RLS creadas.
  9. Funciones/triggers creados.
  10. Índices creados.
  11. Datos demo insertados.
  12. Componentes UI creados.
  13. Componentes existentes reutilizados.
  14. Riesgos o deuda técnica.
  15. Resultado exacto de:
      - typecheck
      - lint
      - tests
      - build
  16. URL/ruta de prueba.
  17. Confirmación de que el backend desplegado corresponde al proyecto Lovable conectado.
  18. Confirmación de que no se modificó `main` directamente.