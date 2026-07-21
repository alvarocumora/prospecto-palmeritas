-- Seed: producto de tierras raras (REE) — Proyecto TRENTO como listing de
-- marketplace (commodity_lots), rol productor / titular del proyecto.
-- Idempotente. Datos consolidados del Informe de Análisis ALS (método ME-MS82,
-- 189 muestras en 4 certificados) de la Ficha de Tierras Raras TRENTO.
--
-- Etapa exploratoria: sin tonelaje/lote físico (off-take / JV / exploración).
-- La ley se expresa en ppm ΣREE (1 ppm = 1 g/t) vía grade_unit. NO constituye
-- estimación de recursos NI 43-101.

DO $$
DECLARE
  v_owner uuid;
  v_lot uuid := '198682f2-8a91-4542-b77c-d73410f18427';
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE email = 'alvaro.cumora@gmail.com' LIMIT 1;
  IF v_owner IS NULL THEN
    SELECT id INTO v_owner FROM auth.users ORDER BY created_at LIMIT 1;
  END IF;
  IF v_owner IS NULL THEN
    RAISE NOTICE 'Sin usuarios en auth.users; no se sembró la ficha REE TRENTO.';
    RETURN;
  END IF;

  INSERT INTO public.commodity_lots (
    id, seller_user_id, title, slug, commodity, form,
    grade_pct, grade_unit, tonnage_available_t, lot_size_t, frequency,
    country, region, port_of_loading, incoterm, payment_terms, price_basis,
    currency, certifications_json, summary, description, status, is_verified
  ) VALUES (
    v_lot, v_owner,
    'Tierras raras (REE) — Proyecto TRENTO, Chile',
    'ree-proyecto-trento-chile',
    'rare_earths', 'ore',
    2055.80, 'ppm ΣREE (máx. muestra 1020)',
    NULL, NULL, NULL,
    'Chile', 'Proyecto TRENTO', NULL, NULL,
    'A convenir (off-take / JV / exploración)',
    'A convenir (off-take / JV / exploración)',
    'USD',
    ('[{"lab":"ALS","method":"ME-MS82","certificate":"TEST 656","code":"LS16037656","samples":22},'
      || '{"lab":"ALS","method":"ME-MS82","certificate":"TEST 157","code":"CO16055157","samples":17},'
      || '{"lab":"ALS","method":"ME-MS82","certificate":"TEST 697","code":"CO16082697","samples":56},'
      || '{"lab":"ALS","method":"ME-MS82","certificate":"TEST 947","code":"CO16084947","samples":94}]')::jsonb,
    'Tierras raras (REE), Proyecto TRENTO (Chile). ΣREE hasta 2.056 g/t, dominancia LREE (Ce 42% · La 31% · Nd 14% · Pr 5%). 189 muestras ALS (ME-MS82). Etapa exploratoria — off-take / JV. Operado por Geocapitals.',
    E'Producto de tierras raras (REE) del Proyecto TRENTO (Chile), ofrecido por el titular / productor del proyecto y operado por Geocapitals.\n\n'
      || E'BASE ANALÍTICA. Consolidación del Informe Técnico de Análisis de Resultados (laboratorio ALS, método ME-MS82: fusión Na2O2 + ICP-MS) sobre 189 muestras distribuidas en 4 certificados: TEST 656 (LS16037656, 22), TEST 157 (CO16055157, 17), TEST 697 (CO16082697, 56) y TEST 947 (CO16084947, 94). Elementos: La, Ce, Pr, Nd, Sm, Eu, Gd, Tb, Dy, Ho, Er, Tm, Yb, Lu, Y (valores en ppm; 1 ppm = 1 g/t).\n\n'
      || E'RESULTADOS. ΣREE máximo observado 2.055,80 ppm (2,056 kg/t, muestra 1020). Seis muestras > 1.000 ppm ΣREE en TEST 656 (1020, 1007, 1008, 1010, 1006, 1019). Relación LREE/HREE de 9,46 en la muestra top. Perfil dominante LREE (Ce+La+Nd+Pr > 90% del ΣREE): Ce 42,34% · La 31,44% · Nd 13,60% · Pr 4,67% · Sm+Eu ~3% · Gd–Lu+Y ~5% (HREE). Distribución heterogénea: pocas muestras concentran la mayor parte del ΣREE, sugiriendo zonas mineralizadas focalizadas.\n\n'
      || E'CONDICIONES. Etapa exploratoria: se ofrece bajo esquema de off-take, joint venture o exploración, a convenir tras due diligence. Muestras geológicas / prospecto; dossier técnico completo y certificados ALS disponibles bajo NDA.\n\n'
      || E'ADVERTENCIA. Datos con fines exploratorios y comparativos entre certificados; no incluyen información mineralógica ni de recuperación metalúrgica y NO constituyen estimación de recursos NI 43-101.',
    'published', false
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    grade_pct = EXCLUDED.grade_pct,
    grade_unit = EXCLUDED.grade_unit,
    payment_terms = EXCLUDED.payment_terms,
    price_basis = EXCLUDED.price_basis,
    certifications_json = EXCLUDED.certifications_json,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    updated_at = now();
END $$;
