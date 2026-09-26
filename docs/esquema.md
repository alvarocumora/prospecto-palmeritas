# Esquema de la base (derivado de migraciones)

> **Método:** análisis estático de las 152 migraciones en `supabase/migrations/` (Lovable las sincroniza al repo). No se corrió `supabase db pull` (sin credenciales en este entorno). Refleja los `CREATE TABLE` + `ALTER TABLE ADD COLUMN`; puede no captar DROP/RENAME/cambios de tipo posteriores ni cambios hechos a mano en la consola. Generado: análisis automático.

Total de tablas detectadas: **160**

## `advance_requests` (19 col.)

- `id` — uuid
- `lot_id` — uuid
- `requester_user_id` — uuid
- `eligibility` — text
- `advance_rate_pct` — integer
- `max_advance_usd` — numeric
- `lot_value_usd` — numeric
- `risk_score` — integer
- `indicative_fee_pct` — numeric
- `tenor_days` — integer
- `offer_snapshot` — jsonb
- `requested_amount_usd` — numeric
- `purpose` — text
- `status` — text
- `reviewer_user_id` — uuid
- `decision_notes` — text
- `decided_at` — timestamptz
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `alteration_zones` (14 col.)

- `id` — UUID
- `zone_code` — TEXT
- `name` — TEXT
- `assemblage` — TEXT
- `intensity` — TEXT
- `description` — TEXT
- `color_hex` — TEXT
- `display_order` — INTEGER
- `source` — TEXT
- `reference_id` — UUID
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ
- `project_id` — UUID

## `api_keys` (13 col.)

- `id` — uuid
- `user_id` — uuid
- `name` — text
- `key_prefix` — text
- `key_hash` — text
- `plan` — text
- `is_active` — boolean
- `monthly_count` — integer
- `month_key` — text
- `requests_total` — integer
- `last_used_at` — timestamptz
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `app_roles` (5 col.)

- `id` — uuid
- `user_id` — uuid
- `role` — public.app_role
- `granted_by` — uuid
- `created_at` — timestamptz

## `asset_offerings` (17 col.)

- `id` — uuid
- `project_id` — uuid
- `created_by` — uuid
- `token_symbol` — text
- `title` — text
- `description` — text
- `instrument` — text
- `total_units` — integer
- `price_per_unit_usd` — numeric
- `currency` — text
- `min_units` — integer
- `status` — text
- `terms_url` — text
- `opens_at` — timestamptz
- `closes_at` — timestamptz
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `audit_log` (8 col.)

- `id` — uuid
- `project_id` — uuid
- `user_id` — uuid
- `action` — text
- `entity_type` — text
- `entity_id` — uuid
- `payload` — jsonb
- `created_at` — timestamptz

## `billing_plans` (0 col.)

## `bulletin_alerts` (9 col.)

- `id` — uuid
- `project_id` — uuid
- `bulletin_id` — uuid
- `match_type` — text
- `match_detail` — text
- `is_read` — boolean
- `read_by` — uuid
- `read_at` — timestamptz
- `created_at` — timestamptz

## `bulletin_watch_holders` (8 col.)

- `id` — uuid
- `project_id` — uuid
- `holder_rut` — text
- `holder_name` — text
- `notes` — text
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `bulletin_watches` (10 col.)

- `id` — uuid
- `project_id` — uuid
- `watch_type` — text
- `value` — text
- `label` — text
- `notes` — text
- `is_active` — boolean
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `business_partners` (14 col.)

- `id` — uuid
- `owner_user_id` — uuid
- `name` — text
- `company` — text
- `role` — text
- `email` — text
- `phone` — text
- `country` — text
- `commodities` — text[]
- `notes` — text
- `status` — text
- `linked_user_id` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `buyer_profiles` (15 col.)

- `id` — UUID
- `user_id` — UUID
- `company_name` — TEXT
- `country_hq` — TEXT
- `entity_type` — TEXT
- `annual_volume_usd` — NUMERIC(16,2)
- `commodities_of_interest` — TEXT[]
- `geographies_of_interest` — TEXT[]
- `contact_phone` — TEXT
- `website` — TEXT
- `kyc_status` — public.commodity_kyc_status
- `kyc_verified_at` — TIMESTAMPTZ
- `kyc_notes` — TEXT
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `cadastre_opportunities` (25 col.)

- `id` — uuid
- `concession_id` — uuid
- `score` — numeric(5,2)
- `commodity_hint` — text[]
- `region` — text
- `commune` — text
- `area_ha` — numeric
- `holder_name` — text
- `holder_rut` — text
- `nearest_deposit_id` — uuid
- `nearest_deposit_name` — text
- `nearest_deposit_commodity` — text
- `deposit_proximity_km` — numeric
- `anomaly_overlap_count` — integer
- `patent_status` — text
- `expiry_risk` — text
- `holder_risk_score` — numeric
- `ai_thesis` — text
- `ai_action` — text
- `ai_confidence` — numeric
- `features` — jsonb
- `model` — text
- `computed_at` — timestamptz
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `campaign_budgets` (9 col.)

- `id` — UUID
- `project_id` — UUID
- `campaign_id` — UUID
- `category` — TEXT
- `planned_amount_usd` — NUMERIC
- `notes` — TEXT
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `campaign_expenses` (18 col.)

- `id` — UUID
- `project_id` — UUID
- `campaign_id` — UUID
- `hole_id` — UUID
- `category` — TEXT
- `description` — TEXT
- `amount_usd` — NUMERIC
- `meters_drilled` — NUMERIC
- `vendor` — TEXT
- `invoice_number` — TEXT
- `expense_date` — DATE
- `status` — TEXT
- `approved_by` — UUID
- `approved_at` — TIMESTAMPTZ
- `notes` — TEXT
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `catastro_alerts` (10 col.)

- `id` — UUID
- `user_id` — UUID
- `concession_code` — TEXT
- `alert_type` — TEXT
- `severity` — TEXT
- `title` — TEXT
- `message` — TEXT
- `payload` — JSONB
- `read_at` — TIMESTAMPTZ
- `created_at` — TIMESTAMPTZ

## `catastro_aoi` (8 col.)

- `id` — UUID
- `user_id` — UUID
- `name` — TEXT
- `description` — TEXT
- `geometry` — JSONB
- `area_ha` — NUMERIC
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `catastro_exports` (9 col.)

- `id` — UUID
- `user_id` — UUID
- `export_type` — TEXT
- `target_type` — TEXT
- `target_ref` — TEXT
- `file_url` — TEXT
- `status` — TEXT
- `error_message` — TEXT
- `created_at` — TIMESTAMPTZ

## `catastro_watchlist` (7 col.)

- `id` — UUID
- `user_id` — UUID
- `concession_code` — TEXT
- `notify_email` — BOOLEAN
- `notify_push` — BOOLEAN
- `notes` — TEXT
- `created_at` — TIMESTAMPTZ

## `commodity_certifications` (10 col.)

- `id` — UUID
- `code` — TEXT
- `name` — TEXT
- `issuer` — TEXT
- `description` — TEXT
- `logo_url` — TEXT
- `verify_url_template` — TEXT
- `category` — TEXT
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `commodity_inquiries` (14 col.)

- `id` — UUID
- `lot_id` — UUID
- `buyer_user_id` — UUID
- `buyer_role` — public.commodity_buyer_role
- `company_name` — TEXT
- `intended_use` — TEXT
- `target_volume_t` — NUMERIC(14,2)
- `target_price_usd_t` — NUMERIC(12,2)
- `message` — TEXT
- `nda_signed_at` — TIMESTAMPTZ
- `status` — public.commodity_inquiry_status
- `seller_notes` — TEXT
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `commodity_inquiry_messages` (6 col.)

- `id` — uuid
- `inquiry_id` — uuid
- `sender_user_id` — uuid
- `body` — text
- `read_at` — timestamptz
- `created_at` — timestamptz

## `commodity_lot_certifications` (8 col.)

- `id` — UUID
- `lot_id` — UUID
- `certification_id` — UUID
- `certificate_number` — TEXT
- `issued_at` — DATE
- `expires_at` — DATE
- `verification_url` — TEXT
- `created_at` — TIMESTAMPTZ

## `commodity_lots` (39 col.)

- `id` — UUID
- `seller_user_id` — UUID
- `organization_id` — UUID
- `project_id` — UUID
- `title` — TEXT
- `slug` — TEXT
- `commodity` — public.commodity_kind
- `form` — public.commodity_form
- `grade_pct` — NUMERIC(8,4)
- `grade_unit` — TEXT
- `moisture_pct` — NUMERIC(6,3)
- `deleterious_json` — JSONB
- `tonnage_available_t` — NUMERIC(14,2)
- `lot_size_t` — NUMERIC(14,2)
- `frequency` — public.commodity_frequency
- `country` — TEXT
- `region` — TEXT
- `port_of_loading` — TEXT
- `origin_geojson` — JSONB
- `incoterm` — public.commodity_incoterm
- `payment_terms` — TEXT
- `price_basis` — TEXT
- `premium_discount_usd_t` — NUMERIC(12,2)
- `asking_price_usd` — NUMERIC(16,2)
- `currency` — TEXT
- `certifications_json` — JSONB
- `assay_report_url` — TEXT
- `chain_of_custody_json` — JSONB
- `cover_image_url` — TEXT
- `summary` — TEXT
- `description` — TEXT
- `status` — public.commodity_lot_status
- `is_verified` — BOOLEAN
- `verified_at` — TIMESTAMPTZ
- `verified_by` — UUID
- `views_count` — INTEGER
- `inquiry_count` — INTEGER
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `commodity_prices` (9 col.)

- `id` — uuid
- `symbol` — text
- `name` — text
- `unit` — text
- `price` — numeric
- `change_pct` — numeric
- `source` — text
- `updated_at` — timestamptz
- `created_at` — timestamptz

## `commodity_trades` (32 col.)

- `id` — uuid
- `reference` — text
- `lot_id` — uuid
- `inquiry_id` — uuid
- `buyer_user_id` — uuid
- `seller_user_id` — uuid
- `commodity` — text
- `form` — text
- `quantity_t` — numeric
- `incoterm` — text
- `unit_price_usd` — numeric
- `total_value_usd` — numeric
- `currency` — text
- `payment_instrument` — text
- `stage` — text
- `status` — text
- `notes` — text
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz
- `counterparty_name` — text
- `counterparty_company` — text
- `counterparty_country` — text
- `counterparty_email` — text
- `counterparty_phone` — text
- `counterparty_role` — text
- `counterparty_seller_token_hash` — text UNIQUE
- `counterparty_buyer_token_hash` — text UNIQUE
- `counterparty_seller_token_prefix` — text
- `counterparty_buyer_token_prefix` — text
- `counterparty_seller_email` — text
- `counterparty_buyer_email` — text

## `community_events` (13 col.)

- `id` — uuid
- `project_id` — uuid
- `event_type` — text
- `community_name` — text
- `event_date` — date
- `attendees` — integer
- `summary` — text
- `commitments` — text
- `follow_up_date` — date
- `status` — text
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `compliance_evaluations` (12 col.)

- `id` — uuid
- `report_id` — uuid
- `rule_id` — uuid
- `project_id` — uuid
- `status` — text
- `score` — integer
- `auto_evaluated` — boolean
- `evaluator_notes` — text
- `evaluated_at` — timestamptz
- `evaluated_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `compliance_rules` (13 col.)

- `id` — uuid
- `standard` — public.compliance_standard
- `rule_code` — text
- `section_no` — integer
- `title` — text
- `description` — text
- `severity` — text
- `evaluator_type` — text
- `evaluator_config` — jsonb
- `reference_url` — text
- `display_order` — integer
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `concession_alert_settings` (11 col.)

- `project_id` — uuid
- `status_change_enabled` — boolean
- `area_change_enabled` — boolean
- `area_change_threshold_pct` — numeric
- `holder_change_enabled` — boolean
- `email_notify` — boolean
- `email_recipients` — text[]
- `webhook_url` — text
- `updated_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `concession_alerts` (15 col.)

- `id` — uuid
- `project_id` — uuid
- `concession_id` — uuid
- `holder_id` — uuid
- `alert_type` — text
- `severity` — text
- `title` — text
- `message` — text
- `payload` — jsonb
- `is_read` — boolean
- `read_at` — timestamptz
- `read_by` — uuid
- `acknowledged` — boolean
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `concession_field_changes` (9 col.)

- `id` — UUID
- `concession_id` — UUID
- `project_id` — UUID
- `field` — TEXT
- `old_value` — TEXT
- `new_value` — TEXT
- `source` — TEXT
- `changed_by` — UUID
- `changed_at` — TIMESTAMPTZ

## `concession_files` (10 col.)

- `id` — UUID
- `concession_id` — UUID
- `project_id` — UUID
- `file_path` — TEXT
- `file_name` — TEXT
- `file_type` — TEXT
- `description` — TEXT
- `size_bytes` — BIGINT
- `uploaded_by` — UUID
- `uploaded_at` — TIMESTAMP WITH TIME

## `concession_history` (7 col.)

- `id` — uuid
- `concession_id` — uuid
- `project_id` — uuid
- `snapshot` — jsonb
- `diff` — jsonb
- `source` — text
- `synced_at` — timestamptz

## `concession_holders` (19 col.)

- `id` — uuid
- `project_id` — uuid
- `name` — text
- `rut` — text
- `holder_type` — text
- `legal_repr_name` — text
- `legal_repr_rut` — text
- `address` — text
- `commune` — text
- `region` — text
- `email` — text
- `phone` — text
- `website` — text
- `economic_activity` — text
- `incorporation_date` — date
- `notes` — text
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `concession_overlaps` (16 col.)

- `id` — uuid
- `concession_id` — uuid
- `project_id` — uuid
- `overlap_type` — text
- `overlap_with_id` — text
- `overlap_with_name` — text
- `area_overlap_ha` — numeric
- `pct_overlap` — numeric
- `severity` — text
- `geometry_geojson` — jsonb
- `detected_at` — timestamptz
- `resolved_at` — timestamptz
- `resolved_by` — uuid
- `notes` — text
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `concession_patents` (15 col.)

- `id` — uuid
- `concession_id` — uuid
- `project_id` — uuid
- `year` — integer
- `amount_utm` — numeric
- `amount_clp` — numeric
- `amount_usd` — numeric
- `status` — text
- `due_date` — date
- `paid_at` — date
- `receipt_url` — text
- `notes` — text
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `contact_messages` (10 col.)

- `id` — uuid
- `name` — text
- `email` — text
- `organization` — text
- `role` — text
- `message` — text
- `source` — text
- `user_agent` — text
- `status` — text
- `created_at` — timestamptz

## `core_boxes` (18 col.)

- `id` — UUID
- `project_id` — UUID
- `hole_id` — UUID
- `box_code` — TEXT
- `box_number` — INTEGER
- `depth_from` — NUMERIC
- `depth_to` — NUMERIC
- `storage_location` — TEXT
- `rack` — TEXT
- `shelf` — TEXT
- `position` — TEXT
- `status` — TEXT
- `condition` — TEXT
- `photo_urls` — TEXT[]
- `notes` — TEXT
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `court_case_alerts` (9 col.)

- `id` — uuid
- `project_id` — uuid
- `case_id` — uuid
- `match_type` — text
- `match_detail` — text
- `is_read` — boolean
- `read_at` — timestamptz
- `read_by` — uuid
- `created_at` — timestamptz

## `deal_commissions` (13 col.)

- `id` — uuid
- `owner_user_id` — uuid
- `partner_id` — uuid
- `trade_id` — uuid
- `listing_id` — uuid
- `deal_value_usd` — numeric
- `commission_pct` — numeric
- `commission_usd` — numeric
- `status` — text
- `notes` — text
- `settled_at` — timestamptz
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `deal_settlements` (17 col.)

- `id` — uuid
- `listing_id` — uuid
- `inquiry_id` — uuid
- `investor_user_id` — uuid
- `investor_company` — text
- `amount_usd` — numeric
- `amount_clp` — numeric
- `success_fee_pct` — numeric
- `status` — text
- `stripe_invoice_id` — text
- `wire_reference` — text
- `notes` — text
- `recorded_by` — uuid
- `recorded_at` — timestamptz
- `received_at` — timestamptz
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `dem_diffs` (20 col.)

- `id` — UUID
- `project_id` — UUID
- `campaign_id` — UUID
- `name` — TEXT
- `raster_before_id` — UUID
- `raster_after_id` — UUID
- `bbox_geojson` — JSONB
- `pixel_size_m` — NUMERIC
- `fill_volume_m3` — NUMERIC
- `cut_volume_m3` — NUMERIC
- `net_volume_m3` — NUMERIC
- `cells_analyzed` — INTEGER
- `diff_min_m` — NUMERIC
- `diff_max_m` — NUMERIC
- `diff_mean_m` — NUMERIC
- `storage_path` — TEXT
- `notes` — TEXT
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `document_drafts` (13 col.)

- `id` — uuid
- `user_id` — uuid
- `template_id` — text
- `reference` — text
- `values` — jsonb
- `clauses` — text[]
- `created_at` — timestamptz
- `updated_at` — timestamptz
- `title` — text
- `client_name` — text
- `project_id` — uuid
- `trade_id` — uuid
- `inquiry_id` — uuid

## `document_registry` (9 col.)

- `reference` — text
- `title` — text
- `template_id` — text
- `doc_type` — text
- `issuer` — text
- `status` — text
- `issued_at` — timestamptz
- `updated_at` — timestamptz
- `metadata` — jsonb

## `document_sign_requests` (22 col.)

- `id` — uuid
- `created_by` — uuid
- `template_id` — text
- `reference` — text
- `title` — text
- `doc` — jsonb
- `doc_hash` — text
- `signer_name_expected` — text
- `signer_email` — text
- `token_prefix` — text
- `token_hash` — text
- `status` — text
- `signed_by_name` — text
- `signed_at` — timestamptz
- `signature_hash` — text
- `expires_at` — timestamptz
- `created_at` — timestamptz
- `updated_at` — timestamptz
- `trade_id` — uuid
- `flow_id` — uuid
- `sign_order` — integer
- `signer_role` — text

## `document_signatures` (16 col.)

- `id` — uuid
- `envelope_id` — uuid
- `project_id` — uuid
- `signer_user_id` — uuid
- `signer_name` — text
- `signer_role` — text
- `signer_email` — text
- `signing_order` — integer
- `status` — text
- `signature_hmac` — text
- `signed_document_hash` — text
- `signed_at` — timestamptz
- `rejection_reason` — text
- `ip_address` — text
- `user_agent` — text
- `created_at` — timestamptz

## `drill_core_logs` (22 col.)

- `id` — UUID
- `created_by` — UUID
- `hole_id` — UUID
- `depth_from` — NUMERIC
- `depth_to` — NUMERIC
- `lithology` — TEXT
- `alteration` — TEXT
- `mineralization` — TEXT
- `structure` — TEXT
- `recovery_pct` — NUMERIC
- `rqd_pct` — NUMERIC
- `vein_pct` — NUMERIC
- `sulfide_pct` — NUMERIC
- `au_gpt` — NUMERIC
- `ag_gpt` — NUMERIC
- `cu_pct` — NUMERIC
- `notes` — TEXT
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ
- `project_id` — UUID
- `approved_by` — UUID
- `approved_at` — TIMESTAMPTZ

## `drill_hole_surveys` (6 col.)

- `id` — uuid
- `hole_id` — uuid
- `depth` — numeric
- `azimuth` — numeric
- `dip` — numeric
- `created_at` — timestamptz

## `drill_hole_trajectories` (6 col.)

- `id` — uuid
- `hole_id` — uuid
- `points` — jsonb
- `total_length` — numeric
- `engine_version` — text
- `computed_at` — timestamptz

## `drill_holes` (18 col.)

- `id` — UUID
- `created_by` — UUID
- `hole_id` — TEXT
- `easting` — NUMERIC
- `northing` — NUMERIC
- `elevation` — NUMERIC
- `azimuth` — NUMERIC
- `dip` — NUMERIC
- `planned_depth` — NUMERIC
- `actual_depth` — NUMERIC
- `target_zone` — TEXT
- `started_at` — DATE
- `completed_at` — DATE
- `notes` — TEXT
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ
- `project_id` — UUID
- `campaign_id` — uuid

## `drone_flights` (14 col.)

- `id` — uuid
- `project_id` — uuid
- `campaign_id` — uuid
- `name` — text
- `sensor` — text
- `pilot` — text
- `flown_at` — date
- `altitude_m` — numeric
- `area_ha` — numeric
- `geometry_geojson` — jsonb
- `notes` — text
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `drone_rasters` (23 col.)

- `id` — uuid
- `project_id` — uuid
- `campaign_id` — uuid
- `flight_id` — uuid
- `name` — text
- `raster_type` — text
- `url` — text
- `bounds_geojson` — jsonb
- `captured_at` — date
- `notes` — text
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz
- `storage_path` — text
- `crs` — text
- `pixel_size_m` — numeric
- `width_px` — integer
- `height_px` — integer
- `band_count` — integer
- `min_value` — numeric
- `max_value` — numeric
- `file_size_bytes` — bigint
- `processing` — boolean

## `economic_scenarios` (42 col.)

- `id` — uuid
- `project_id` — uuid
- `model_id` — uuid
- `name` — text
- `description` — text
- `commodity_price_usd` — numeric
- `price_unit` — text
- `recovery_pct` — numeric
- `payable_pct` — numeric
- `mining_cost_usd_t` — numeric
- `processing_cost_usd_t` — numeric
- `ga_cost_usd_t` — numeric
- `waste_cost_usd_t` — numeric
- `royalty_pct` — numeric
- `refining_cost_usd_oz` — numeric
- `transport_cost_usd_t` — numeric
- `slope_angle_deg` — numeric
- `annual_throughput_t` — numeric
- `discount_rate_pct` — numeric
- `ramp_up_years` — integer
- `capex_usd` — numeric
- `sustaining_capex_usd_t` — numeric
- `status` — text
- `nsr_cutoff_usd_t` — numeric
- `ore_tonnes` — numeric
- `waste_tonnes` — numeric
- `strip_ratio` — numeric
- `mean_grade` — numeric
- `metal_payable` — numeric
- `gross_revenue_usd` — numeric
- `total_opex_usd` — numeric
- `total_capex_usd` — numeric
- `ebitda_usd` — numeric
- `npv_usd` — numeric
- `irr_pct` — numeric
- `payback_years` — numeric
- `mine_life_years` — numeric
- `notes` — text
- `computed_at` — timestamptz
- `created_at` — timestamptz
- `updated_at` — timestamptz
- `created_by` — uuid

## `economic_schedule` (15 col.)

- `id` — uuid
- `scenario_id` — uuid
- `project_id` — uuid
- `year` — integer
- `ore_tonnes` — numeric
- `waste_tonnes` — numeric
- `mean_grade` — numeric
- `metal_payable` — numeric
- `revenue_usd` — numeric
- `opex_usd` — numeric
- `capex_usd` — numeric
- `cashflow_usd` — numeric
- `discounted_cashflow_usd` — numeric
- `cumulative_cashflow_usd` — numeric
- `created_at` — timestamptz

## `email_delivery_events` (8 col.)

- `id` — UUID
- `message_id` — TEXT
- `event` — TEXT
- `recipient_email` — TEXT
- `user_agent` — TEXT
- `ip_hash` — TEXT
- `metadata` — JSONB
- `occurred_at` — TIMESTAMPTZ

## `email_send_log` (8 col.)

- `id` — UUID
- `message_id` — TEXT
- `template_name` — TEXT
- `recipient_email` — TEXT
- `status` — TEXT
- `error_message` — TEXT
- `metadata` — JSONB
- `created_at` — TIMESTAMPTZ

## `email_send_state` (7 col.)

- `id` — INT
- `retry_after_until` — TIMESTAMPTZ
- `batch_size` — INTEGER
- `send_delay_ms` — INTEGER
- `auth_email_ttl_minutes` — INTEGER
- `transactional_email_ttl_minutes` — INTEGER
- `updated_at` — TIMESTAMPTZ

## `email_unsubscribe_tokens` (5 col.)

- `id` — UUID
- `token` — TEXT
- `email` — TEXT
- `created_at` — TIMESTAMPTZ
- `used_at` — TIMESTAMPTZ

## `engine_ai_interpretations` (9 col.)

- `id` — UUID
- `project_id` — UUID
- `block_model_version_id` — UUID
- `summary` — TEXT
- `uncertainty` — NUMERIC
- `upside` — NUMERIC
- `payload` — JSONB
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ

## `engine_audit_events` (8 col.)

- `id` — UUID
- `project_id` — UUID
- `actor_id` — UUID
- `action` — TEXT
- `entity_type` — TEXT
- `entity_id` — TEXT
- `payload` — JSONB
- `created_at` — TIMESTAMPTZ

## `engine_block_model_versions` (13 col.)

- `id` — UUID
- `project_id` — UUID
- `version_label` — TEXT
- `input_hash` — TEXT
- `settings_hash` — TEXT
- `settings` — JSONB
- `resource_summary` — JSONB
- `block_count` — INTEGER
- `binary_path` — TEXT
- `notes` — TEXT
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `engine_comments` (11 col.)

- `id` — UUID
- `project_id` — UUID
- `entity_type` — TEXT
- `entity_id` — TEXT
- `body` — TEXT
- `mentions` — UUID[]
- `status` — TEXT
- `resolved_at` — TIMESTAMPTZ
- `author_id` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `engine_drill_targets` (18 col.)

- `id` — UUID
- `project_id` — UUID
- `target_code` — TEXT
- `priority` — TEXT
- `collar_x` — DOUBLE PRECISION
- `collar_y` — DOUBLE PRECISION
- `collar_z` — DOUBLE PRECISION
- `azimuth` — NUMERIC
- `dip` — NUMERIC
- `depth` — NUMERIC
- `confidence` — NUMERIC
- `estimated_cost` — NUMERIC
- `scenario` — TEXT
- `status` — TEXT
- `payload` — JSONB
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `engine_qaqc_reports` (9 col.)

- `id` — UUID
- `project_id` — UUID
- `label` — TEXT
- `summary` — JSONB
- `issues` — JSONB
- `critical_count` — INTEGER
- `warning_count` — INTEGER
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ

## `engine_reports_generated` (9 col.)

- `id` — UUID
- `project_id` — UUID
- `kind` — TEXT
- `title` — TEXT
- `format` — TEXT
- `payload` — JSONB
- `storage_path` — TEXT
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ

## `exploration_campaigns` (13 col.)

- `id` — uuid
- `project_id` — uuid
- `name` — text
- `phase` — text
- `status` — text
- `started_at` — date
- `ended_at` — date
- `aoi_geojson` — jsonb
- `lead_user_id` — uuid
- `notes` — text
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `exploration_targets` (29 col.)

- `id` — UUID
- `project_id` — UUID
- `campaign_id` — UUID
- `created_by` — UUID
- `code` — TEXT
- `name` — TEXT
- `target_type` — TEXT
- `commodity` — TEXT
- `target_zone` — TEXT
- `lat` — NUMERIC
- `lng` — NUMERIC
- `elevation_m` — NUMERIC
- `geometry_geojson` — JSONB
- `stage` — TEXT
- `priority` — TEXT
- `score` — NUMERIC
- `confidence_pct` — NUMERIC
- `rationale` — TEXT
- `evidence` — JSONB
- `assigned_to` — UUID
- `planned_meters` — NUMERIC
- `estimated_cost_usd` — NUMERIC
- `validated_by` — UUID
- `validated_at` — TIMESTAMPTZ
- `closed_reason` — TEXT
- `closed_at` — TIMESTAMPTZ
- `notes` — TEXT
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `field_pois` (14 col.)

- `id` — UUID
- `project_id` — UUID
- `organization_id` — UUID
- `poi_type` — TEXT
- `title` — TEXT
- `note` — TEXT
- `lat` — DOUBLE PRECISION
- `lng` — DOUBLE PRECISION
- `accuracy_m` — DOUBLE PRECISION
- `elevation_m` — DOUBLE PRECISION
- `photo_path` — TEXT
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `freight_rates` (12 col.)

- `id` — UUID
- `port_origin` — TEXT
- `port_destination` — TEXT
- `container_type` — TEXT
- `usd_rate` — NUMERIC
- `transit_days` — INT
- `valid_from` — DATE
- `source` — TEXT
- `notes` — TEXT
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `geo_copilot_conversations` (8 col.)

- `id` — UUID
- `user_id` — UUID
- `project_id` — UUID
- `module` — TEXT
- `title` — TEXT
- `messages` — JSONB
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `geo_references` (13 col.)

- `id` — UUID
- `citation_key` — TEXT
- `title` — TEXT
- `authors` — TEXT
- `year` — INTEGER
- `publisher` — TEXT
- `url` — TEXT
- `doi` — TEXT
- `notes` — TEXT
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ
- `project_id` — UUID

## `geochem_analyses` (16 col.)

- `id` — UUID
- `project_id` — UUID
- `created_by` — UUID
- `created_at` — TIMESTAMP WITH TIME
- `updated_at` — TIMESTAMP WITH TIME
- `sample_count` — INTEGER
- `elements_used` — TEXT[]
- `pca_loadings` — JSONB
- `pca_variance` — JSONB
- `pca_scores` — JSONB
- `clusters` — JSONB
- `cluster_count` — INTEGER
- `pathfinder_scores` — JSONB
- `signature` — TEXT
- `signature_confidence` — NUMERIC
- `notes` — TEXT

## `geological_features` (18 col.)

- `id` — UUID
- `feature_code` — TEXT
- `name` — TEXT
- `feature_type` — TEXT
- `strike` — TEXT
- `dip` — TEXT
- `length_m` — NUMERIC
- `width_m` — NUMERIC
- `description` — TEXT
- `geometry_geojson` — JSONB
- `lithology_id` — UUID
- `alteration_id` — UUID
- `source` — TEXT
- `reference_id` — UUID
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ
- `project_id` — UUID

## `geology_wireframes` (19 col.)

- `id` — UUID
- `project_id` — UUID
- `name` — TEXT
- `commodity` — TEXT
- `iso` — DOUBLE PRECISION
- `smooth` — DOUBLE PRECISION
- `grid_n` — INTEGER
- `pad` — DOUBLE PRECISION
- `samples_used` — INTEGER
- `volume_m3` — DOUBLE PRECISION
- `vertices` — JSONB
- `faces` — JSONB
- `bbox` — JSONB
- `origin_lng` — DOUBLE PRECISION
- `origin_lat` — DOUBLE PRECISION
- `metadata` — JSONB
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `geophysics_anomalies` (28 col.)

- `id` — UUID
- `project_id` — UUID
- `survey_id` — UUID
- `station_id` — UUID
- `target_id` — UUID
- `created_by` — UUID
- `code` — TEXT
- `anomaly_type` — TEXT
- `severity` — TEXT
- `status` — TEXT
- `confidence_pct` — NUMERIC
- `lat` — NUMERIC
- `lng` — NUMERIC
- `peak_value` — NUMERIC
- `peak_unit` — TEXT
- `estimated_depth_m` — NUMERIC
- `estimated_area_m2` — NUMERIC
- `rationale` — TEXT
- `evidence` — JSONB
- `reviewed_by` — UUID
- `reviewed_at` — TIMESTAMP WITH TIME
- `validated_by` — UUID
- `validated_at` — TIMESTAMP WITH TIME
- `promoted_at` — TIMESTAMP WITH TIME
- `dismissed_reason` — TEXT
- `notes` — TEXT
- `created_at` — TIMESTAMP WITH TIME
- `updated_at` — TIMESTAMP WITH TIME

## `geophysics_lines` (11 col.)

- `id` — UUID
- `survey_id` — UUID
- `line_id` — TEXT
- `geometry_geojson` — JSONB
- `length_m` — NUMERIC
- `notes` — TEXT
- `is_synthetic` — BOOLEAN
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ
- `project_id` — UUID

## `geophysics_stations` (14 col.)

- `id` — UUID
- `survey_id` — UUID
- `station_id` — TEXT
- `lat` — NUMERIC
- `lng` — NUMERIC
- `mag_nt` — NUMERIC
- `ip_chargeability_mvv` — NUMERIC
- `ip_resistivity_ohmm` — NUMERIC
- `is_synthetic` — BOOLEAN
- `notes` — TEXT
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ
- `project_id` — UUID

## `geophysics_surveys` (15 col.)

- `id` — UUID
- `name` — TEXT
- `method` — TEXT
- `status` — TEXT
- `planned_km` — NUMERIC
- `cost_usd` — NUMERIC
- `station_spacing_m` — NUMERIC
- `expected_depth_m` — NUMERIC
- `notes` — TEXT
- `display_order` — INTEGER
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ
- `project_id` — UUID
- `campaign_id` — uuid

## `holder_files` (10 col.)

- `id` — uuid
- `holder_id` — uuid
- `project_id` — uuid
- `file_path` — text
- `file_name` — text
- `file_type` — text
- `description` — text
- `size_bytes` — bigint
- `uploaded_by` — uuid
- `uploaded_at` — timestamptz

## `holder_links` (12 col.)

- `id` — uuid
- `holder_id` — uuid
- `project_id` — uuid
- `link_type` — text
- `bulletin_id` — uuid
- `case_id` — uuid
- `external_url` — text
- `label` — text
- `notes` — text
- `auto_matched` — boolean
- `linked_by` — uuid
- `linked_at` — timestamptz

## `hse_incidents` (15 col.)

- `id` — uuid
- `project_id` — uuid
- `occurred_at` — timestamptz
- `severity` — text
- `category` — text
- `location` — text
- `description` — text
- `people_affected` — integer
- `corrective_actions` — text
- `status` — text
- `reported_by` — uuid
- `closed_at` — timestamptz
- `notes` — text
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `hse_permits` (14 col.)

- `id` — uuid
- `project_id` — uuid
- `permit_type` — text
- `authority` — text
- `number` — text
- `title` — text
- `issued_at` — date
- `expires_at` — date
- `status` — text
- `document_url` — text
- `notes` — text
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `hyperspectral_products` (25 col.)

- `id` — UUID
- `project_id` — UUID
- `source` — TEXT
- `acquisition_date` — TIMESTAMPTZ
- `scene_id` — TEXT
- `stac_href` — TEXT
- `bbox_geojson` — JSONB
- `pixel_size_m` — NUMERIC
- `cloud_pct` — NUMERIC
- `mineral` — hyperspectral_mineral
- `assemblage` — alteration_assemblage
- `cog_url` — TEXT
- `thumbnail_url` — TEXT
- `area_ha` — NUMERIC
- `mean_score` — NUMERIC
- `max_score` — NUMERIC
- `cells_above_threshold` — INT
- `threshold` — NUMERIC
- `algorithm` — TEXT
- `spectral_library` — TEXT
- `notes` — TEXT
- `metadata` — JSONB
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `insar_alert_actions` (12 col.)

- `id` — uuid
- `project_id` — uuid
- `insar_id` — uuid
- `follow_up_task_id` — uuid
- `action_type` — text
- `severity_at_time` — text
- `velocity_mm_year` — numeric
- `recommendation` — text
- `notes` — text
- `metadata` — jsonb
- `created_by` — uuid
- `created_at` — timestamptz

## `insar_displacement` (22 col.)

- `id` — UUID
- `project_id` — UUID
- `asset_name` — TEXT
- `asset_type` — TEXT
- `source` — TEXT
- `reference_date` — DATE
- `end_date` — DATE
- `bbox_geojson` — JSONB
- `point_geojson` — JSONB
- `velocity_mm_year` — NUMERIC
- `cumulative_displacement_mm` — NUMERIC
- `coherence` — NUMERIC
- `ascending` — BOOLEAN
- `los_vector` — JSONB
- `time_series` — JSONB
- `alert_severity` — TEXT
- `cog_url` — TEXT
- `notes` — TEXT
- `metadata` — JSONB
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `investor_profiles` (1 col.)

- `terms_accepted_at` — timestamptz

## `lithology_units` (15 col.)

- `id` — UUID
- `unit_code` — TEXT
- `name` — TEXT
- `age` — TEXT
- `formation` — TEXT
- `rock_type` — TEXT
- `description` — TEXT
- `color_hex` — TEXT
- `display_order` — INTEGER
- `source` — TEXT
- `reference_id` — UUID
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ
- `project_id` — UUID

## `mag_target_revalidation_diffs` (17 col.)

- `id` — uuid
- `revalidation_id` — uuid
- `project_id` — uuid
- `change_type` — text
- `name` — text
- `prev_rank` — integer
- `new_rank` — integer
- `prev_lat` — double precision
- `prev_lon` — double precision
- `new_lat` — double precision
- `new_lon` — double precision
- `prev_mag_nt` — double precision
- `new_mag_nt` — double precision
- `shift_m` — double precision
- `mag_delta_nt` — double precision
- `rank_delta` — integer
- `created_at` — timestamptz

## `mag_target_revalidations` (22 col.)

- `id` — uuid
- `project_id` — uuid
- `bbox` — jsonb
- `grid_n` — integer
- `top_k` — integer
- `prev_count` — integer
- `new_count` — integer
- `added_count` — integer
- `removed_count` — integer
- `moved_count` — integer
- `mag_changed_count` — integer
- `unchanged_count` — integer
- `mean_shift_m` — double precision
- `max_shift_m` — double precision
- `mean_mag_delta_nt` — double precision
- `max_mag_delta_nt` — double precision
- `stats` — jsonb
- `prev_snapshot` — jsonb
- `new_snapshot` — jsonb
- `triggered_by` — text
- `created_by` — uuid
- `created_at` — timestamptz

## `mag_targets` (13 col.)

- `id` — uuid
- `project_id` — uuid
- `name` — text
- `lat` — double precision
- `lon` — double precision
- `mag_nt` — double precision
- `rank` — integer
- `radius_m` — double precision
- `source` — text
- `bbox` — jsonb
- `metadata` — jsonb
- `created_by` — uuid
- `created_at` — timestamptz

## `map_annotations` (16 col.)

- `id` — uuid
- `project_id` — uuid
- `created_by` — uuid
- `lat` — numeric
- `lng` — numeric
- `text` — text
- `color` — text
- `resolved` — boolean
- `created_at` — timestamp with time
- `updated_at` — timestamp with time
- `target_id` — uuid
- `campaign_id` — uuid
- `phase` — text
- `resolved_reason` — text
- `resolved_by` — uuid
- `resolved_at` — timestamptz

## `map_views` (10 col.)

- `id` — uuid
- `user_id` — uuid
- `project_id` — uuid
- `name` — text
- `layer_state` — jsonb
- `center_lat` — numeric
- `center_lng` — numeric
- `zoom` — numeric
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `market_comparables` (22 col.)

- `id` — uuid
- `source` — text
- `source_url` — text
- `deal_type` — text
- `project_name` — text
- `operator` — text
- `country` — text
- `region` — text
- `commodity` — text
- `stage` — text
- `area_ha` — numeric
- `price_usd` — numeric
- `price_per_ha_usd` — numeric
- `resource_tonnes` — numeric
- `resource_grade` — numeric
- `resource_grade_unit` — text
- `resource_confidence` — text
- `deal_date` — date
- `notes` — text
- `is_verified` — boolean
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `marketplace_layer_reviews` (7 col.)

- `id` — uuid
- `layer_key` — text
- `user_id` — uuid
- `rating` — integer
- `comment` — text
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `mine_plan_phases` (20 col.)

- `id` — uuid
- `project_id` — uuid
- `phase_no` — integer
- `name` — text
- `target_id` — uuid
- `method` — text
- `area_polygon` — jsonb
- `avg_thickness_m` — numeric
- `density_tm3` — numeric
- `cutoff_grade` — numeric
- `recovery_pct` — numeric
- `capex_usd` — numeric
- `opex_usd_t` — numeric
- `metal_price_assumption` — jsonb
- `grade_estimate` — jsonb
- `start_year` — integer
- `duration_years` — integer
- `notes` — text
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `mineralogy` (15 col.)

- `id` — UUID
- `mineral` — TEXT
- `formula` — TEXT
- `category` — TEXT
- `paragenetic_stage` — TEXT
- `abundance` — TEXT
- `occurrence` — TEXT
- `description` — TEXT
- `display_order` — INTEGER
- `source` — TEXT
- `reference_id` — UUID
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ
- `project_id` — UUID

## `mining_bulletins` (22 col.)

- `id` — uuid
- `source` — text
- `publication_number` — text
- `publication_date` — date
- `publication_type` — text
- `holder_name` — text
- `holder_rut` — text
- `concession_name` — text
- `concession_code` — text
- `region` — text
- `provincia` — text
- `comuna` — text
- `area_ha` — numeric
- `centroid_lat` — numeric
- `centroid_lng` — numeric
- `geometry_geojson` — jsonb
- `source_url` — text
- `raw_payload` — jsonb
- `content_hash` — text
- `scraped_at` — timestamptz
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `mining_concessions` (26 col.)

- `id` — UUID
- `project_id` — UUID
- `created_by` — UUID
- `code` — TEXT
- `name` — TEXT
- `concession_type` — TEXT
- `status` — TEXT
- `holder` — TEXT
- `area_ha` — NUMERIC
- `granted_at` — DATE
- `expires_at` — DATE
- `region` — TEXT
- `commune` — TEXT
- `geometry_geojson` — JSONB
- `notes` — TEXT
- `source` — TEXT
- `created_at` — TIMESTAMP WITH TIME
- `updated_at` — TIMESTAMP WITH TIME
- `rut_holder` — text
- `provincia` — text
- `datum` — text
- `external_id` — text
- `last_synced_at` — timestamptz
- `holder_id` — uuid
- `parcel_ids` — text
- `geom` — extensions.geometry(Geometry, 4326)

## `mining_court_cases` (20 col.)

- `id` — uuid
- `source` — text
- `case_number` — text
- `court` — text
- `jurisdiction` — text
- `matter` — text
- `plaintiff` — text
- `defendant` — text
- `defendant_rut` — text
- `comuna` — text
- `region` — text
- `filed_at` — date
- `last_movement_at` — date
- `status` — text
- `source_url` — text
- `raw_payload` — jsonb
- `content_hash` — text
- `scraped_at` — timestamptz
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `offering_subscriptions` (9 col.)

- `id` — uuid
- `offering_id` — uuid
- `investor_user_id` — uuid
- `units` — integer
- `amount_usd` — numeric
- `status` — text
- `note` — text
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `partner_invitation_events` (5 col.)

- `id` — uuid
- `invitation_id` — uuid
- `event` — text
- `metadata` — jsonb
- `created_at` — timestamptz

## `partner_invitations` (22 col.)

- `id` — uuid
- `token` — text
- `email` — text
- `full_name` — text
- `company` — text
- `suggested_role` — public.partner_invitation_role
- `chosen_role` — public.partner_invitation_role
- `status` — public.partner_invitation_status
- `project_ids` — uuid[]
- `trade_ids` — uuid[]
- `ncnda_ref` — text
- `ncnda_pdf_url` — text
- `sent_at` — timestamptz
- `opened_at` — timestamptz
- `signed_at` — timestamptz
- `accepted_at` — timestamptz
- `accepted_user_id` — uuid
- `invited_by` — uuid
- `message` — text
- `expires_at` — timestamptz
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `patent_remates` (23 col.)

- `id` — uuid
- `year` — integer
- `rol` — text
- `dv_rol` — text
- `concession_code` — text
- `concession_name` — text
- `holder_name` — text
- `holder_rut` — text
- `region` — text
- `comuna` — text
- `concession_type` — text
- `years_owed` — integer
- `amount_clp` — numeric
- `court` — text
- `court_role` — text
- `status` — text
- `source` — text
- `source_url` — text
- `raw_payload` — jsonb
- `content_hash` — text
- `ingested_at` — timestamptz
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `payment_orders` (11 col.)

- `id` — uuid
- `user_id` — uuid
- `plan_code` — text
- `billing` — text
- `amount_clp` — integer
- `amount_usd` — numeric
- `provider` — text
- `preference_id` — text
- `payment_id` — text
- `created_at` — timestamptz
- `paid_at` — timestamptz

## `pit_shells` (13 col.)

- `id` — UUID
- `project_id` — UUID
- `revenue_factor` — DOUBLE PRECISION
- `tonnage_mt` — DOUBLE PRECISION
- `grade_avg_cu_eq` — DOUBLE PRECISION
- `strip_ratio` — DOUBLE PRECISION
- `npv_usd` — DOUBLE PRECISION
- `mesh_positions` — JSONB
- `mesh_indices` — JSONB
- `bounds` — JSONB
- `method` — TEXT
- `is_conceptual` — BOOLEAN
- `created_at` — TIMESTAMPTZ

## `profiles` (11 col.)

- `id` — UUID
- `user_id` — UUID
- `display_name` — TEXT
- `avatar_url` — TEXT
- `email` — TEXT
- `organization` — TEXT
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ
- `specialty` — text
- `phone` — text
- `country` — text

## `project_facts` (13 col.)

- `id` — uuid
- `project_id` — uuid
- `section` — text
- `label` — text
- `value` — text
- `unit` — text
- `provenance` — text
- `source` — text
- `note` — text
- `sort_order` — integer
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `project_fundraises` (23 col.)

- `id` — uuid
- `project_id` — uuid
- `round_size_usd` — numeric
- `min_ticket_usd` — numeric
- `instrument` — text
- `equity_offered_pct` — numeric
- `horizon_years` — numeric
- `valuation_low_usd` — numeric
- `valuation_high_usd` — numeric
- `valuation_method` — text
- `financing_structure` — text
- `use_of_funds` — jsonb
- `milestones` — jsonb
- `scenarios` — jsonb
- `highlights` — jsonb
- `notes` — text
- `status` — text
- `is_public` — boolean
- `public_token_prefix` — text
- `public_token_hash` — text
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `project_invitations` (11 col.)

- `id` — uuid
- `project_id` — uuid
- `email` — text
- `role` — public.project_role
- `token` — text
- `status` — text
- `invited_by` — uuid
- `expires_at` — timestamptz
- `accepted_at` — timestamptz
- `accepted_by` — uuid
- `created_at` — timestamptz

## `project_member_capabilities` (7 col.)

- `id` — UUID
- `project_id` — UUID
- `user_id` — UUID
- `capability` — TEXT
- `granted_by` — UUID
- `granted_at` — TIMESTAMPTZ
- `expires_at` — TIMESTAMPTZ

## `project_members` (6 col.)

- `id` — UUID
- `project_id` — UUID
- `user_id` — UUID
- `role` — public.project_role
- `invited_by` — UUID
- `created_at` — TIMESTAMPTZ

## `projects` (14 col.)

- `id` — UUID
- `code` — TEXT
- `name` — TEXT
- `description` — TEXT
- `commodity` — TEXT
- `country` — TEXT
- `region` — TEXT
- `center_lat` — NUMERIC
- `center_lng` — NUMERIC
- `status` — TEXT
- `cover_image_url` — TEXT
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `property_data_room_files` (10 col.)

- `id` — uuid
- `listing_id` — uuid
- `file_name` — text
- `file_path` — text
- `file_size_bytes` — bigint
- `mime_type` — text
- `category` — text
- `requires_nda` — boolean
- `uploaded_by` — uuid
- `created_at` — timestamptz

## `property_deal_inquiries` (12 col.)

- `id` — uuid
- `listing_id` — uuid
- `inquirer_user_id` — uuid
- `status` — text
- `message` — text
- `nda_signed_at` — timestamptz
- `nda_ip` — text
- `nda_signature` — text
- `closed_at` — timestamptz
- `closed_reason` — text
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `property_deal_messages` (6 col.)

- `id` — uuid
- `inquiry_id` — uuid
- `sender_user_id` — uuid
- `body` — text
- `read_at` — timestamptz
- `created_at` — timestamptz

## `property_listings` (21 col.)

- `id` — uuid
- `owner_user_id` — uuid
- `project_id` — uuid
- `title` — text
- `code` — text
- `commodity` — text
- `country` — text
- `region` — text
- `area_ha` — numeric
- `stage` — text
- `modality` — text
- `asking_price_usd` — numeric
- `royalty_pct` — numeric
- `summary` — text
- `geometry_geojson` — jsonb
- `cover_image_url` — text
- `data_available` — text[]
- `is_published` — boolean
- `views_count` — integer
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `prospectivity_cells` (10 col.)

- `id` — uuid
- `project_id` — uuid
- `run_id` — uuid
- `cell_lat` — numeric
- `cell_lng` — numeric
- `cell_size_m` — numeric
- `score` — numeric
- `features` — jsonb
- `generated_at` — timestamptz
- `generated_by` — uuid

## `prospectivity_runs` (9 col.)

- `id` — uuid
- `project_id` — uuid
- `generated_by` — uuid
- `generated_at` — timestamptz
- `bbox_geojson` — jsonb
- `cell_size_m` — numeric
- `cell_count` — integer
- `weights` — jsonb
- `notes` — text

## `public_concessions_cache` (21 col.)

- `id` — uuid
- `code` — text
- `concession_type` — text
- `name` — text
- `holder` — text
- `rut` — text
- `area_ha` — numeric
- `status` — text
- `granted_at` — date
- `expires_at` — date
- `region` — text
- `region_slug` — text
- `commune` — text
- `province` — text
- `datum` — text
- `geometry` — geometry(MultiPolygon, 4326)
- `centroid` — geometry(Point, 4326)
- `raw_attrs` — jsonb
- `last_synced_at` — timestamptz
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `public_holders` (9 col.)

- `id` — uuid
- `rut` — text
- `holder_name` — text
- `holder_slug` — text
- `total_concessions` — integer
- `total_area_ha` — numeric
- `regions` — text[]
- `last_updated` — timestamptz
- `created_at` — timestamptz

## `qaqc_results` (19 col.)

- `id` — UUID
- `project_id` — UUID
- `sample_id` — UUID
- `sample_code` — TEXT
- `qc_type` — TEXT
- `element` — TEXT
- `measured_value` — NUMERIC
- `standard_id` — UUID
- `parent_sample_code` — TEXT
- `status` — TEXT
- `certificate` — TEXT
- `lab` — TEXT
- `measured_at` — DATE
- `notes` — TEXT
- `reviewed_by` — UUID
- `reviewed_at` — TIMESTAMPTZ
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `qaqc_standards` (13 col.)

- `id` — UUID
- `project_id` — UUID
- `code` — TEXT
- `name` — TEXT
- `element` — TEXT
- `expected_value` — NUMERIC
- `tolerance_pct` — NUMERIC
- `unit` — TEXT
- `certifying_lab` — TEXT
- `notes` — TEXT
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `qualified_persons` (13 col.)

- `id` — uuid
- `user_id` — uuid
- `full_name` — text
- `profession` — text
- `registration_body` — text
- `license_no` — text
- `competency_areas` — text[]
- `cv_url` — text
- `signature_url` — text
- `bio` — text
- `is_verified` — boolean
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `report_evidence_links` (10 col.)

- `id` — uuid
- `report_id` — uuid
- `rule_id` — uuid
- `project_id` — uuid
- `evidence_type` — text
- `evidence_id` — uuid
- `url` — text
- `caption` — text
- `created_at` — timestamptz
- `created_by` — uuid

## `report_section_cache` (8 col.)

- `id` — uuid
- `project_id` — uuid
- `section` — text
- `data_hash` — text
- `payload` — jsonb
- `model` — text
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `resource_block_economics` (12 col.)

- `id` — uuid
- `scenario_id` — uuid
- `project_id` — uuid
- `block_id` — uuid
- `nsr_usd_t` — numeric
- `insitu_value_usd` — numeric
- `total_cost_usd_t` — numeric
- `margin_usd_t` — numeric
- `in_pit` — boolean
- `is_ore` — boolean
- `extraction_year` — integer
- `created_at` — timestamptz

## `resource_blocks` (15 col.)

- `id` — uuid
- `model_id` — uuid
- `project_id` — uuid
- `ix` — integer
- `iy` — integer
- `iz` — integer
- `x` — numeric
- `y` — numeric
- `z` — numeric
- `grade` — numeric
- `variance` — numeric
- `n_samples` — integer
- `nearest_dist` — numeric
- `classification` — text
- `created_at` — timestamptz

## `resource_composites` (13 col.)

- `id` — uuid
- `model_id` — uuid
- `project_id` — uuid
- `hole_id` — uuid
- `hole_code` — text
- `depth_from` — numeric
- `depth_to` — numeric
- `length_m` — numeric
- `grade` — numeric
- `x` — numeric
- `y` — numeric
- `z` — numeric
- `created_at` — timestamptz

## `resource_models` (35 col.)

- `id` — uuid
- `project_id` — uuid
- `campaign_id` — uuid
- `name` — text
- `commodity` — text
- `method` — text
- `cutoff_grade` — numeric
- `density_t_m3` — numeric
- `block_size_x` — numeric
- `block_size_y` — numeric
- `block_size_z` — numeric
- `search_radius` — numeric
- `min_samples` — integer
- `max_samples` — integer
- `power` — numeric
- `composite_length` — numeric
- `bbox_min_x` — numeric
- `bbox_max_x` — numeric
- `bbox_min_y` — numeric
- `bbox_max_y` — numeric
- `bbox_min_z` — numeric
- `bbox_max_z` — numeric
- `blocks_total` — integer
- `blocks_estimated` — integer
- `composites_count` — integer
- `tonnage_total` — numeric
- `tonnage_above_cutoff` — numeric
- `mean_grade` — numeric
- `metal_content` — numeric
- `status` — text
- `notes` — text
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz
- `estimated_at` — timestamptz

## `sample_custody` (16 col.)

- `id` — UUID
- `project_id` — UUID
- `sample_id` — UUID
- `sample_code` — TEXT
- `event_type` — TEXT
- `event_at` — TIMESTAMPTZ
- `location` — TEXT
- `from_user` — UUID
- `to_user` — UUID
- `carrier` — TEXT
- `waybill` — TEXT
- `seal_number` — TEXT
- `photo_urls` — TEXT[]
- `notes` — TEXT
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ

## `sampling_results` (29 col.)

- `id` — UUID
- `created_by` — UUID
- `sample_code` — TEXT
- `sample_type` — TEXT
- `zone` — TEXT
- `easting` — NUMERIC
- `northing` — NUMERIC
- `elevation` — NUMERIC
- `depth_from` — NUMERIC
- `depth_to` — NUMERIC
- `au_gpt` — NUMERIC
- `ag_gpt` — NUMERIC
- `cu_pct` — NUMERIC
- `mo_ppm` — NUMERIC
- `pb_ppm` — NUMERIC
- `zn_ppm` — NUMERIC
- `as_ppm` — NUMERIC
- `sb_ppm` — NUMERIC
- `hg_ppm` — NUMERIC
- `lab` — TEXT
- `certificate` — TEXT
- `sampled_at` — DATE
- `notes` — TEXT
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ
- `project_id` — UUID
- `campaign_id` — uuid
- `approved_by` — UUID
- `approved_at` — TIMESTAMPTZ

## `satellite_analysis_runs` (5 col.)

- `version` — integer
- `parent_run_id` — uuid
- `content_hash` — text
- `pipeline_version` — text
- `last_modified_by` — uuid

## `satellite_anomalies` (0 col.)

## `satellite_run_status_events` (10 col.)

- `id` — uuid
- `run_id` — uuid
- `project_id` — uuid
- `from_status` — text
- `to_status` — text
- `message` — text
- `duration_ms` — bigint
- `actor_user_id` — uuid
- `metadata` — jsonb
- `created_at` — timestamptz

## `shared_layers` (12 col.)

- `id` — uuid
- `name` — text
- `description` — text
- `category` — text
- `geometry_geojson` — jsonb
- `tags` — text[]
- `thumbnail_url` — text
- `is_public` — boolean
- `owner_id` — uuid
- `downloads_count` — integer
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `signature_audit_trail` (9 col.)

- `id` — uuid
- `envelope_id` — uuid
- `project_id` — uuid
- `action` — text
- `actor_user_id` — uuid
- `actor_name` — text
- `payload` — jsonb
- `hash_chain` — text
- `created_at` — timestamptz

## `signature_envelopes` (16 col.)

- `id` — uuid
- `project_id` — uuid
- `document_type` — text
- `document_ref_id` — uuid
- `document_title` — text
- `document_hash` — text
- `document_storage_path` — text
- `status` — text
- `required_signers` — integer
- `completed_signers` — integer
- `expires_at` — timestamptz
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz
- `completed_at` — timestamptz
- `metadata` — jsonb

## `sourcing_dispatches` (13 col.)

- `id` — uuid
- `owner_user_id` — uuid
- `submission_id` — uuid
- `request_id` — uuid
- `recipient_email` — text
- `recipient_name` — text
- `recipient_company` — text
- `partner_id` — uuid
- `ncnda_ref` — text
- `message_id` — text
- `status` — text
- `note` — text
- `created_at` — timestamptz

## `sourcing_requests` (17 col.)

- `id` — uuid
- `owner_user_id` — uuid
- `reference` — text
- `commodity` — text
- `form` — text
- `quantity_t` — numeric
- `incoterm` — text
- `destination` — text
- `target_price_usd_t` — numeric
- `specs` — text
- `notes` — text
- `status` — text
- `submit_token_prefix` — text
- `submit_token_hash` — text
- `expires_at` — timestamptz
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `sourcing_share_token_views` (8 col.)

- `id` — uuid
- `submission_id` — uuid
- `request_id` — uuid
- `ip_hash` — text
- `ua_hash` — text
- `referer` — text
- `outcome` — text
- `viewed_at` — timestamptz

## `sourcing_submissions` (28 col.)

- `id` — uuid
- `request_id` — uuid
- `supplier_name` — text
- `supplier_company` — text
- `supplier_country` — text
- `contact_email` — text
- `contact_phone` — text
- `offer_price_usd_t` — numeric
- `offer_quantity_t` — numeric
- `incoterm` — text
- `lead_time` — text
- `specs` — text
- `notes` — text
- `documents` — jsonb
- `status` — text
- `share_token_prefix` — text
- `share_token_hash` — text
- `created_at` — timestamptz
- `updated_at` — timestamptz
- `trade_id` — uuid
- `supplier_role` — text
- `port_loading` — text
- `payment_terms` — text
- `offer_valid_until` — date
- `quality_grade` — text
- `packaging` — text
- `share_token_revoked_at` — timestamptz
- `ficha_detail` — jsonb

## `stac_acquisitions` (12 col.)

- `id` — UUID
- `project_id` — UUID
- `collection` — TEXT
- `scene_id` — TEXT
- `stac_href` — TEXT
- `acquisition_date` — TIMESTAMPTZ
- `bbox_geojson` — JSONB
- `cloud_pct` — NUMERIC
- `thumbnail_url` — TEXT
- `assets` — JSONB
- `properties` — JSONB
- `cached_at` — TIMESTAMPTZ

## `stockpile_volumes` (19 col.)

- `id` — UUID
- `project_id` — UUID
- `campaign_id` — UUID
- `raster_id` — UUID
- `name` — TEXT
- `material` — TEXT
- `polygon_geojson` — JSONB
- `base_method` — TEXT
- `base_elevation_m` — NUMERIC
- `volume_m3` — NUMERIC
- `area_m2` — NUMERIC
- `mean_height_m` — NUMERIC
- `max_height_m` — NUMERIC
- `cells_analyzed` — INTEGER
- `pixel_size_m` — NUMERIC
- `notes` — TEXT
- `created_by` — UUID
- `created_at` — TIMESTAMPTZ
- `updated_at` — TIMESTAMPTZ

## `subscriptions` (9 col.)

- `id` — uuid
- `user_id` — uuid
- `plan` — text
- `status` — text
- `stripe_customer_id` — text
- `stripe_subscription_id` — text
- `current_period_end` — timestamptz
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `suppressed_emails` (5 col.)

- `id` — UUID
- `email` — TEXT
- `reason` — TEXT
- `metadata` — JSONB
- `created_at` — TIMESTAMPTZ

## `synthetic_assays` (11 col.)

- `id` — UUID
- `hole_id` — UUID
- `from_m` — DOUBLE PRECISION
- `to_m` — DOUBLE PRECISION
- `cu_pct` — DOUBLE PRECISION
- `au_gpt` — DOUBLE PRECISION
- `ag_gpt` — DOUBLE PRECISION
- `mo_pct` — DOUBLE PRECISION
- `lithology` — TEXT
- `alteration` — TEXT
- `mineralized` — BOOLEAN

## `synthetic_block_model` (13 col.)

- `id` — BIGSERIAL
- `project_id` — UUID
- `x_utm` — DOUBLE PRECISION
- `y_utm` — DOUBLE PRECISION
- `z_m` — DOUBLE PRECISION
- `size_x` — DOUBLE PRECISION
- `size_y` — DOUBLE PRECISION
- `size_z` — DOUBLE PRECISION
- `cu_eq_pct` — DOUBLE PRECISION
- `confidence` — DOUBLE PRECISION
- `domain` — TEXT
- `method` — TEXT
- `version` — INT

## `synthetic_drillholes` (16 col.)

- `id` — UUID
- `project_id` — UUID
- `hole_code` — TEXT
- `collar_x_utm` — DOUBLE PRECISION
- `collar_y_utm` — DOUBLE PRECISION
- `collar_z_m` — DOUBLE PRECISION
- `utm_zone` — INT
- `azimuth_deg` — DOUBLE PRECISION
- `dip_deg` — DOUBLE PRECISION
- `depth_m` — DOUBLE PRECISION
- `source` — TEXT
- `generated_from_kind` — TEXT
- `generated_from_id` — UUID
- `is_conceptual` — BOOLEAN
- `meta` — JSONB
- `created_at` — TIMESTAMPTZ

## `technical_report_sections` (16 col.)

- `id` — uuid
- `report_id` — uuid
- `project_id` — uuid
- `section_no` — integer
- `title` — text
- `content_md` — text
- `status` — text
- `qp_id` — uuid
- `signed_at` — timestamptz
- `signature_hash` — text
- `figures` — jsonb
- `references_ids` — uuid[]
- `word_count` — integer
- `updated_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `technical_report_versions` (10 col.)

- `id` — uuid
- `report_id` — uuid
- `project_id` — uuid
- `version_no` — integer
- `snapshot` — jsonb
- `hash_sha256` — text
- `pdf_url` — text
- `watermark` — text
- `generated_by` — uuid
- `generated_at` — timestamptz

## `technical_reports` (16 col.)

- `id` — uuid
- `project_id` — uuid
- `title` — text
- `effective_date` — date
- `signature_date` — date
- `report_type` — text
- `status` — text
- `lead_qp_id` — uuid
- `version` — integer
- `summary` — text
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz
- `compliance_threshold` — integer
- `compliance_score_cached` — integer
- `compliance_evaluated_at` — timestamptz

## `trade_board_prefs` (6 col.)

- `user_id` — UUID
- `hidden_stages` — TEXT[]
- `wip_limits` — JSONB
- `column_order` — TEXT[]
- `preferred_view` — TEXT
- `updated_at` — TIMESTAMPTZ

## `trade_documents` (14 col.)

- `id` — uuid
- `trade_id` — uuid
- `doc_type` — text
- `phase` — text
- `status` — text
- `file_url` — text
- `issuer` — text
- `reference` — text
- `signed_by` — uuid
- `signed_at` — timestamptz
- `notes` — text
- `created_by` — uuid
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `trade_events` (7 col.)

- `id` — uuid
- `trade_id` — uuid
- `actor_user_id` — uuid
- `kind` — text
- `detail` — text
- `doc_type` — text
- `created_at` — timestamptz

## `trade_pack_versions` (10 col.)

- `id` — UUID
- `trade_id` — UUID
- `doc_type` — TEXT
- `version_number` — INT
- `terms_hash` — TEXT
- `storage_path` — TEXT
- `filename` — TEXT
- `ctx_snapshot` — JSONB
- `generated_by` — UUID
- `created_at` — TIMESTAMPTZ

## `trade_payments` (17 col.)

- `id` — uuid
- `trade_id` — uuid
- `created_by` — uuid
- `kind` — text
- `label` — text
- `amount_usd` — numeric
- `currency` — text
- `instrument` — text
- `reference` — text
- `due_date` — date
- `status` — text
- `paid_at` — timestamptz
- `notes` — text
- `created_at` — timestamptz
- `updated_at` — timestamptz
- `last_reminder_at` — timestamptz
- `reminder_count` — integer

## `trade_shipments` (18 col.)

- `id` — uuid
- `trade_id` — uuid
- `created_by` — uuid
- `reference` — text
- `vessel_name` — text
- `bl_number` — text
- `carrier` — text
- `container_count` — integer
- `quantity_t` — numeric
- `port_loading` — text
- `port_discharge` — text
- `etd` — date
- `eta` — date
- `status` — text
- `tracking_url` — text
- `notes` — text
- `created_at` — timestamptz
- `updated_at` — timestamptz

## `validation_snapshots` (7 col.)

- `id` — UUID
- `project_id` — UUID
- `table_name` — TEXT
- `row_count` — INTEGER
- `status` — TEXT
- `created_by` — UUID
- `created_at` — TIMESTAMP WITH TIME

## `veins` (19 col.)

- `id` — uuid
- `project_id` — uuid
- `code` — text
- `name` — text
- `commodity` — text
- `strike_deg` — numeric
- `dip_deg` — numeric
- `dip_dir_deg` — numeric
- `thickness_m` — numeric
- `length_m` — numeric
- `depth_top_m` — numeric
- `depth_bottom_m` — numeric
- `grade_estimate` — jsonb
- `density_tm3` — numeric
- `confidence` — text
- `geometry` — jsonb
- `notes` — text
- `created_at` — timestamptz
- `updated_at` — timestamptz
