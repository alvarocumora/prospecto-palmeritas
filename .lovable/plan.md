## Visión

Geocapitals evoluciona a **plataforma dual**: (1) inversión en proyectos mineros (ya existe) + (2) **marketplace de commodities certificados** (concentrados Cu/Zn/Pb, cátodos, doré Au/Ag, tierras raras, litio) desde Chile, Perú, Brasil, Colombia, Venezuela y África. La web comunica esta visión con nuevo hero dual, ruta `/marketplace` funcional y sección "Vision & Geografías".

## Fase 1 — Backend del marketplace (MVP funcional)

Nueva migración con estas tablas (todas con RLS + GRANTs):

**`commodity_lots`** — lote publicado por un seller verificado
- `seller_user_id`, `organization_id`, `project_id?` (link opcional a proyecto)
- `commodity` (enum: `cu_concentrate`, `zn_concentrate`, `pb_concentrate`, `cu_cathode`, `au_dore`, `ag_dore`, `au_bullion`, `rare_earths`, `li_carbonate`, `li_spodumene`, `fe_ore`, `sn_concentrate`, `mo_concentrate`)
- `form` (concentrate, cathode, doré, bullion, oxide, carbonate), `grade_pct`, `moisture_pct`, `deleterious_json`
- `tonnage_available_t`, `lot_size_t`, `frequency` (spot, monthly, quarterly, annual offtake)
- `country` (CL, PE, BR, CO, VE, AR, EC, BO, ZA, DRC, ZM, GH, MA, NA), `region`, `port_of_loading`
- `incoterm` (FOB, CIF, CFR, EXW, DAP), `payment_terms`
- `price_basis` (LME, LBMA, London PM Fix, negotiated), `premium_discount_usd_t`, `asking_price_usd?`
- `certifications_json` (ISO 9001, ISO 14001, LBMA Good Delivery, RJC, ICMM, Fairmined, EITI, CoC)
- `assay_report_url?`, `chain_of_custody_json`, `cover_image_url?`, `summary`
- `status` (draft, pending_verification, published, under_negotiation, sold, archived)
- `is_verified` bool (aprobado por admin), `verified_at`, `verified_by`
- `views_count`, `inquiry_count`

**`commodity_certifications`** — catálogo de estándares (ISO 9001, LBMA, RJC, Fairmined, ICMM, EITI, ISO 14001, ISO 45001)
- `code`, `name`, `issuer`, `description`, `logo_url`, `verify_url_template`
- Público read-only (`TO anon SELECT`)

**`commodity_lot_certifications`** — join lot↔certification con `certificate_number`, `issued_at`, `expires_at`, `verification_url`

**`commodity_inquiries`** — buyer/trader solicita muestra/oferta
- `lot_id`, `buyer_user_id`, `buyer_role` (trader, refinery, offtaker, industrial_end_user, investor)
- `intended_use`, `target_volume_t`, `target_price_usd_t`, `message`, `nda_signed_at?`
- `status` (new, contacted, sample_requested, offer_sent, negotiating, closed_won, closed_lost)

**`buyer_profiles`** — perfil ampliado del comprador
- `user_id`, `company_name`, `country_hq`, `entity_type` (trader, refinery, smelter, fund, industrial, family_office)
- `annual_volume_usd`, `commodities_of_interest[]`, `geographies_of_interest[]`
- `kyc_status` (pending, verified, rejected), `kyc_verified_at`

**Reglas RLS**:
- `commodity_lots`: SELECT público solo cuando `status='published' AND is_verified=true`; owner ve sus drafts; admin ve todo.
- `commodity_inquiries`: buyer ve las suyas, seller ve las de sus lots.
- `buyer_profiles`: owner ve/edita el suyo; seller del lot ve datos básicos solo si hay inquiry.
- `commodity_certifications`: read-only público.

**Seeds**: 6-10 lotes demo verificados repartidos en Chile (Cu concentrate + Au doré), Perú (Zn concentrate), Brasil (Fe ore + tierras raras), Colombia (Au bullion Fairmined), Venezuela (Fe/Au), Sudáfrica (Cu cathode), RDC (Co/Cu).

## Fase 2 — Web pública: nuevo hero + ruta marketplace

### 2.1 Home rehecha (`src/features/marketing/MarketingLanding.tsx`)
Nuevo **hero dual** con dos "caminos" desde el H1:
- H1: *"Capital y commodities para la nueva minería de Latinoamérica y África"*
- Dos tarjetas grandes bajo el hero: **"Invierte en proyectos"** → `/inversionistas`, **"Compra & vende commodities certificados"** → `/marketplace`.
- Franja de logos de certificaciones (LBMA, RJC, Fairmined, ISO, ICMM, EITI).
- Mapa/tira de banderas de geografías cubiertas (CL, PE, BR, CO, VE, AR, ZA, DRC, GH, MA).
- Sección "Cómo funciona" con dos columnas paralelas: flujo proyecto vs flujo commodity.
- CTA final dual (crear cuenta como inversionista / seller / buyer).

### 2.2 Nueva ruta `/marketplace` (`src/routes/marketplace.tsx`)
- `head()` con title, description, og:*, canonical `https://geocapitals.com/marketplace`, JSON-LD `Marketplace`.
- Hero corto + filtros (commodity, forma, país, certificación, incoterm).
- Grid de lotes verificados (loader llama server fn público `listPublishedCommodityLots`).
- Sidebar de "Geografías" y "Certificaciones" con conteos.
- CTA para sellers ("Publica tu lote") y para buyers ("Solicita acceso KYC").

### 2.3 Nueva ruta `/marketplace/$lotId` (`src/routes/marketplace.$lotId.tsx`)
- Ficha del lote: origen, ley, tonelaje, certificaciones con verificación, chain of custody, incoterm, precio, imágenes.
- `head()` dinámico con og:image = `cover_image_url` del lote.
- Botón "Solicitar oferta" → si logueado abre drawer con formulario que inserta `commodity_inquiries`; si no, redirige a `/auth?intent=buyer`.
- Server fn autenticado `createCommodityInquiry` (usa `requireSupabaseAuth`).

### 2.4 Nueva ruta `/vision` (opcional, solo si sobra ámbito) — omitida en esta fase; el contenido de visión vive en la home rehecha.

## Fase 3 — Dashboard: entradas para seller y buyer

- **Sección "Mis lotes"** (`/_authenticated/dashboard/marketplace/lotes`): CRUD básico de `commodity_lots` con estados draft/pending/published.
- **Sección "Mis solicitudes"** (buyer): lista de `commodity_inquiries` con estado.
- **Bandeja seller "Inquiries recibidas"**: lista de inquiries sobre sus lots, con cambio de estado.
- Card en dashboard-home: "Publica tu primer lote" / "Explora el marketplace" según rol.

## Fase 4 — SEO + Publicación

- Actualizar `sitemap.xml` para incluir `/marketplace` y `/marketplace/$lotId` de lotes publicados.
- Meta tags específicos por commodity/país en la ficha.
- Correr `supabase--linter` + `security--run_security_scan`, arreglar findings.
- Publicar a `geocapitals.com`.

## Detalles técnicos

- Server functions públicas (`.functions.ts`) para listar/filtrar lotes usando **server publishable client** (`SUPABASE_PUBLISHABLE_KEY`, sin admin) con policy `TO anon` para lotes verificados y publicados.
- Server function autenticada `createCommodityInquiry` con `requireSupabaseAuth`.
- Ninguna transacción de pago en esta fase — solo lead capture + NDA opcional.
- Todos los `CREATE TABLE` con GRANTs explícitos (SELECT anon solo donde la policy lo permite).
- i18n mínimo: español por defecto, textos preparados para inglés más adelante.

## Fuera de alcance

- Pagos, escrow, firma electrónica de contratos.
- Módulo 3D / satelital / NI 43-101 (ya existentes).
- Cotización en vivo LME/LBMA (solo referencia textual del `price_basis`).
- App móvil.
