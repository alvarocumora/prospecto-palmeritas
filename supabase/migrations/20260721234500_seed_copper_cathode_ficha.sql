-- Seed: primera ficha de commodities — Cátodos de cobre refinado, Sonora (México).
-- Idempotente. Crea dos artefactos enlazados por el mismo material, operados por
-- Geocapitals:
--   (A) Listing de marketplace  → public.commodity_lots (campos estructurados:
--       base de precio LME, cadencia spot, stock, lote, ley, puerto).
--   (B) Requerimiento + ficha de proveedor → public.sourcing_requests +
--       public.sourcing_submissions (página pública /ficha-proveedor/<token>,
--       verificación QR y PDF institucional con logo/QR).
--
-- El owner es la cuenta del operador (por email, con fallback al primer usuario).
-- El share token de la ficha viaja fuera de este archivo: aquí solo persiste su
-- hash SHA-256 (mismo esquema que generateSubmissionShareLink).

DO $$
DECLARE
  v_owner uuid;
  v_req uuid := 'cc9c7cc4-4bf9-491d-a0cb-0cbebb789146';
  v_sub uuid := 'ad626c91-7eba-40a8-8bf7-9263ce9fea83';
  v_lot uuid := 'd7805640-8910-4c27-a535-da756c85580b';
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE email = 'alvaro.cumora@gmail.com' LIMIT 1;
  IF v_owner IS NULL THEN
    SELECT id INTO v_owner FROM auth.users ORDER BY created_at LIMIT 1;
  END IF;
  IF v_owner IS NULL THEN
    RAISE NOTICE 'Sin usuarios en auth.users; no se sembró la ficha de cobre.';
    RETURN;
  END IF;

  ----------------------------------------------------------------------------
  -- (A) Marketplace listing (commodity_lots)
  ----------------------------------------------------------------------------
  INSERT INTO public.commodity_lots (
    id, seller_user_id, title, slug, commodity, form,
    grade_pct, grade_unit, tonnage_available_t, lot_size_t, frequency,
    country, region, port_of_loading, incoterm, payment_terms,
    price_basis, currency, summary, description, status, is_verified
  ) VALUES (
    v_lot, v_owner,
    'Cátodos de cobre refinado 99,99% Cu — Sonora, México',
    'catodos-cobre-sonora-mx',
    'cu_cathode', 'cathode',
    99.99, '%', 300, 80, 'spot',
    'México', 'Estado de Sonora', 'Sonora, México', 'EXW',
    'Contado por transferencia electrónica al momento de la carga y recepción de la mercancía.',
    'LME menos 5%', 'USD',
    'Cátodos de cobre refinado 99,99% Cu. Stock 300 t · suministro 250 t/semana · precio LME −5% · primera operación spot 80 t. Operado por Geocapitals.',
    E'Cátodos de cobre refinado con pureza mínima 99,99% Cu, en placas planas de aprox. 1,00 m × 0,80 m y espesor 5–10 mm.\n\n'
      || E'Disponibilidad: 300 toneladas en stock, con capacidad de suministro de 250 toneladas por semana. Precio referenciado al valor LME con descuento de 5%.\n\n'
      || E'Primera operación spot: 80 toneladas. Pago de contado mediante transferencia electrónica al momento de la carga y recepción de la mercancía. Se puede coordinar visita técnica, inspección y toma de muestras (requiere identificación de los asistentes y Orden de Compra); tras el análisis de muestras se formaliza el contrato y se programa la fecha de compra y carga.\n\n'
      || E'Aplicaciones: conductores eléctricos, cables, componentes eléctricos y usos industriales. Operación bajo esquema formal y cumplimiento fiscal en México. Operado por Geocapitals.',
    'published', false
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    grade_pct = EXCLUDED.grade_pct,
    tonnage_available_t = EXCLUDED.tonnage_available_t,
    lot_size_t = EXCLUDED.lot_size_t,
    price_basis = EXCLUDED.price_basis,
    payment_terms = EXCLUDED.payment_terms,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    updated_at = now();

  ----------------------------------------------------------------------------
  -- (B.1) Requerimiento (RFQ) del operador para el material
  ----------------------------------------------------------------------------
  INSERT INTO public.sourcing_requests (
    id, owner_user_id, reference, commodity, form, quantity_t, incoterm,
    destination, target_price_usd_t, specs, notes, status,
    submit_token_prefix, submit_token_hash
  ) VALUES (
    v_req, v_owner, 'SRC-CU-CATODO-SONORA-2026', 'Cobre', 'Cátodo', 300, 'EXW',
    'A definir con el comprador', NULL,
    'Cátodos de cobre refinado 99,99% Cu. Placas planas ~1,00 m × 0,80 m, espesor 5–10 mm. Precio referenciado a LME con descuento de 5%.',
    'Disponibilidad de material físico en Sonora, México. Operado por Geocapitals bajo esquema formal y cumplimiento fiscal en México.',
    'abierto',
    'gcsrc_084683', '15a8d07f9d2b4bc60ea413ed7b446de326f2865c3145c4d810f284b61a44e796'
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
    'Productor certificado — Sonora (México)',
    'Reservado bajo NCNDA',
    'México',
    NULL, NULL, NULL, 300,
    'EXW', 'Suministro 250 t/semana',
    'productor', 'Sonora, México',
    'Contado por transferencia electrónica al momento de la carga y recepción de la mercancía.',
    NULL,
    '99,99% Cu (pureza mínima)',
    'Placas planas ~1,00 m × 0,80 m · espesor 5–10 mm',
    'Cátodos de cobre refinado. Precio referenciado al valor LME con descuento de 5%. Aplicaciones: conductores eléctricos, cables, componentes eléctricos y usos industriales.',
    E'Primera operación spot: 80 t. Posibilidad de coordinar visita técnica, inspección y toma de muestras (requiere identificación de los asistentes y Orden de Compra). Tras el análisis de muestras se formaliza el contrato y se programa la fecha de compra y carga. Operación bajo esquema formal y cumplimiento fiscal en México. Operado por Geocapitals — interesados pueden solicitar dossier técnico, documentación comercial y coordinación de visita a terreno.',
    '[]'::jsonb,
    'recibida',
    'gcshr_883593', 'cf23816ac1605cd43a389213abd86ff32a4f9267a78cf929912cabf2de91d9eb'
  )
  ON CONFLICT (id) DO UPDATE SET
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
