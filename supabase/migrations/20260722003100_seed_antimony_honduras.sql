-- Seed: proveedor de antimonio Corporación Minera A&D (Honduras) — Soft
-- Corporate Offer del 24-06-2026. Mismo proceso que cátodos de cobre:
--   (A) Listing de marketplace  → public.commodity_lots (commodity sb_ore).
--   (B) Requerimiento + ficha de proveedor → public.sourcing_requests +
--       public.sourcing_submissions (página pública /ficha-proveedor/<token>,
--       verificación QR y PDF institucional).
-- Idempotente. El enum sb_ore lo agrega la migración 20260722003000_*.
-- El share token solo se persiste como hash SHA-256.

DO $$
DECLARE
  v_owner uuid;
  v_lot uuid := 'dbb7618a-afc5-4b29-a2c8-28434a14b779';
  v_req uuid := '492f53a0-f59b-49a0-b22f-415927b5cf86';
  v_sub uuid := '3f5a5268-944c-4ef9-9e74-569d2827856a';
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE email = 'alvaro.cumora@gmail.com' LIMIT 1;
  IF v_owner IS NULL THEN
    SELECT id INTO v_owner FROM auth.users ORDER BY created_at LIMIT 1;
  END IF;
  IF v_owner IS NULL THEN
    RAISE NOTICE 'Sin usuarios en auth.users; no se sembró la ficha de antimonio.';
    RETURN;
  END IF;

  ----------------------------------------------------------------------------
  -- (A) Marketplace listing (commodity_lots)
  ----------------------------------------------------------------------------
  INSERT INTO public.commodity_lots (
    id, seller_user_id, title, slug, commodity, form,
    grade_pct, grade_unit, tonnage_available_t, lot_size_t, frequency,
    country, region, port_of_loading, incoterm, payment_terms, price_basis,
    currency, certifications_json, summary, description, status, is_verified
  ) VALUES (
    v_lot, v_owner,
    'Antimonio en breña 35–77% Sb — Honduras (Corp. Minera A&D)',
    'antimonio-brena-honduras-ad',
    'sb_ore', 'ore',
    35.0, '% Sb (rango 35–77%, precio por ley)',
    100, NULL, 'monthly',
    'Honduras', 'Concesiones Corp. Minera A&D',
    'Puerto Cortés (Cortés) · Puerto Castilla (Colón) · San Lorenzo (Choluteca)',
    'FOB',
    'SBLC 100% irrevocable, transferible y divisible; pago en puerto de carga tras informes de inspección y documentos de embarque vía SWIFT MT103. Comprador debe acreditar prueba de fondos (POF).',
    'Por ley de Sb: 35% US$5.616/MT → 77% US$7.030/MT (con impuestos); ajustable a bolsa internacional.',
    'USD',
    '[{"tipo":"concesion","titular":"Corporación Minera A&D, S.A. de C.V.","pais":"Honduras","nota":"Titular de concesiones mineras (declarado en SCO)"}]'::jsonb,
    'Antimonio en breña (mineral triturado) 35–77% Sb, Honduras. 100 t/mes a más, contrato 12 meses. FOB puertos Cortés/Castilla/San Lorenzo. Precio por ley US$5.616–7.030/MT. Operado por Geocapitals.',
    E'Oferta de antimonio en breña (mineral triturado) del productor Corporación Minera A&D, S.A. de C.V. (Honduras), titular de las concesiones mineras. Operado por Geocapitals.\n\n'
      || E'PRODUCTO. Antimonio en breña, granulometría de 1 pulgada a finos. Ley: 35% a 77% Sb. Origen: Honduras.\n\n'
      || E'PRECIO. En USD con impuestos, escalonado por ley de antimonio, desde US$5.616/MT (35% Sb) hasta US$7.030/MT (77% Sb). Ante variación de la bolsa internacional, el precio se ajusta de manera proporcional.\n\n'
      || E'DISPONIBILIDAD. 100 toneladas por mes (a más). Período de contrato: 1 año (12 meses), a más. Modalidad FOB. Puertos de embarque: Puerto Cortés (Depto. Cortés) y Puerto Castilla (Depto. Colón) en el Atlántico; San Lorenzo (Depto. Choluteca) en el Pacífico.\n\n'
      || E'PAGO. Oferta solo para compradores directos con prueba de fondos, listos para emitir SBLC 100% irrevocable, transferible y divisible, con pago en el puerto de carga tras informes de inspección y documentos de envío mediante SWIFT MT103. Banca: Bank of America (intermediario), Banco FICOHSA (beneficiario), beneficiario final Corporación Minera A&D, S.A. de C.V.\n\n'
      || E'CONTRAPARTE. Corporación Minera A&D, S.A. de C.V. — Rep. legal Delmer Francisco Munguía Pagoada; Gerente General César González Díaz. SCO emitida el 24-06-2026.',
    'published', false
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    grade_pct = EXCLUDED.grade_pct,
    grade_unit = EXCLUDED.grade_unit,
    tonnage_available_t = EXCLUDED.tonnage_available_t,
    frequency = EXCLUDED.frequency,
    port_of_loading = EXCLUDED.port_of_loading,
    payment_terms = EXCLUDED.payment_terms,
    price_basis = EXCLUDED.price_basis,
    certifications_json = EXCLUDED.certifications_json,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    updated_at = now();

  ----------------------------------------------------------------------------
  -- (B.1) Requerimiento (RFQ) del operador
  ----------------------------------------------------------------------------
  INSERT INTO public.sourcing_requests (
    id, owner_user_id, reference, commodity, form, quantity_t, incoterm,
    destination, target_price_usd_t, specs, notes, status,
    submit_token_prefix, submit_token_hash
  ) VALUES (
    v_req, v_owner, 'SRC-SB-BRENA-HONDURAS-2026', 'Antimonio (Sb)', 'Breña / mineral', 100, 'FOB',
    'A definir con el comprador', NULL,
    'Antimonio en breña 35–77% Sb, granulometría 1 pulgada a finos. Precio por ley US$5.616–7.030/MT (con impuestos), ajustable a bolsa.',
    'Oferta (SCO) de Corporación Minera A&D, S.A. de C.V. (Honduras), titular de concesiones. 100 t/mes a más, contrato 12 meses, FOB. Operado por Geocapitals.',
    'abierto',
    'gcsrc_3df7fe', 'ec0817189941f1bf55dfa681deca1cba370dcf5b630c79927e14642882032417'
  )
  ON CONFLICT (id) DO UPDATE SET
    reference = EXCLUDED.reference,
    specs = EXCLUDED.specs,
    notes = EXCLUDED.notes,
    updated_at = now();

  ----------------------------------------------------------------------------
  -- (B.2) Ficha de proveedor (submission) — página pública + QR + PDF
  ----------------------------------------------------------------------------
  INSERT INTO public.sourcing_submissions (
    id, request_id, supplier_name, supplier_company, supplier_country,
    contact_email, contact_phone, offer_price_usd_t, offer_quantity_t,
    incoterm, lead_time, supplier_role, port_loading, payment_terms,
    offer_valid_until, quality_grade, packaging, specs, notes, documents,
    status, share_token_prefix, share_token_hash
  ) VALUES (
    v_sub, v_req,
    'Corporación Minera A&D, S.A. de C.V.',
    'Corporación Minera A&D, S.A. de C.V.',
    'Honduras',
    NULL, NULL, NULL, 100,
    'FOB', '100 t/mes a más · contrato 12 meses',
    'productor', 'Puerto Cortés / Puerto Castilla / San Lorenzo (Honduras)',
    'SBLC 100% irrevocable, transferible y divisible; pago en puerto de carga tras inspección y documentos de embarque vía SWIFT MT103 (POF requerida).',
    NULL,
    'Sb 35% a 77% (precio escalonado por ley)',
    'Breña / mineral triturado · granulometría 1 pulgada a finos',
    'Antimonio en breña, origen Honduras. Precio por ley: 35% US$5.616/MT … 77% US$7.030/MT (con impuestos), ajustable a bolsa internacional. Modalidad FOB.',
    E'SCO emitida el 24-06-2026 por Corporación Minera A&D, S.A. de C.V. — Rep. legal Delmer Francisco Munguía Pagoada; Gerente General César González Díaz. Titular de las concesiones mineras. Banca: Bank of America (intermediario), Banco FICOHSA (beneficiario). Oferta solo para compradores directos con prueba de fondos. Operado por Geocapitals — dossier técnico y coordinación bajo NDA.',
    '[]'::jsonb,
    'recibida',
    'gcshr_beda69', '78655bc0b0d4ca9bad6bd87fa53da8c8a1c5905947845282641e866aafb5c975'
  )
  ON CONFLICT (id) DO UPDATE SET
    supplier_company = EXCLUDED.supplier_company,
    supplier_country = EXCLUDED.supplier_country,
    offer_quantity_t = EXCLUDED.offer_quantity_t,
    lead_time = EXCLUDED.lead_time,
    supplier_role = EXCLUDED.supplier_role,
    port_loading = EXCLUDED.port_loading,
    payment_terms = EXCLUDED.payment_terms,
    quality_grade = EXCLUDED.quality_grade,
    packaging = EXCLUDED.packaging,
    specs = EXCLUDED.specs,
    notes = EXCLUDED.notes,
    share_token_prefix = EXCLUDED.share_token_prefix,
    share_token_hash = EXCLUDED.share_token_hash,
    updated_at = now();
END $$;
