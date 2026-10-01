-- ============================================================================
-- GEO-2026-004 — Nahuelbuta REE
-- Script de carga idempotente contra el pipeline de deals real de Geocapitals
-- (/dashboard/pipeline, tabla `deals` + `deal_pedimentos` + `deal_alerts`,
-- migración supabase/migrations/20261001174016_...sql).
--
-- Versión anterior de este script usaba projects/pedimentos/project_facts/
-- follow_up_tasks porque `public.deals` estaba marcada DEPRECADA
-- ("No usar en UI ni en métricas", migración 20260821230028). Mientras este
-- PR estaba abierto, se agregó en main un pipeline de deals nuevo que
-- resucita esa misma tabla (ALTER TABLE ... ADD COLUMN pipeline_stage,
-- profile jsonb) con una UI completa (/dashboard/pipeline) cuyo shape de
-- `profile` calza campo a campo con esta ficha — es el destino real de
-- estos datos, así que el script se reescribió para usarlo.
--
-- CÓMO CORRERLO
--   Este sandbox de Claude Code no tiene credenciales de la base en vivo
--   (sin SUPABASE_SERVICE_ROLE_KEY), así que este script no se ejecutó acá.
--   Corrarlo contra el proyecto Supabase real desde el SQL Editor o con:
--     supabase db execute -f scripts/seed_geo_2026_004_nahuelbuta_ree.sql
--
-- IDEMPOTENCIA
--   Cada INSERT está guardado con "WHERE NOT EXISTS" sobre una clave natural
--   (deals.code / deal_pedimentos por deal_id+seq / deal_alerts por
--   deal_id+title), así que correrlo dos veces no duplica filas.
--
-- SUPUESTOS QUE HAY QUE REVISAR ANTES DE CORRER
--   1) v_creator_email abajo asume que quien carga esto es el dueño de
--      sesión (alvaro.cumora@gmail.com). Cambialo si corresponde a otro
--      usuario — deals.created_by es NOT NULL.
--   2) El QP (Enrique Viteri) va dentro de profile.qp como texto simple
--      (nombre/teléfono/email/estándar/estado) — ese sub-objeto NO pide
--      license_no ni registration_body, así que no hay datos de
--      acreditación profesional que inventar. Si alguna vez se lo quiere
--      registrar como qualified_persons real (para firmar un informe
--      NI 43-101), ahí sí van a faltar esos datos reales.
--
-- ⚠ HALLAZGOS QUE NO SE PUDIERON VERIFICAR Y QUE SE CARGAN TAL CUAL VINIERON,
--   CON ALERTA REFORZADA (no se "corrigió" nada):
--   a) Los vértices UTM de los 7 pedimentos, convertidos SAD69→WGS84, caen
--      entre lat -38.09 y -38.46 — 10 a 80 km AL SUR del bbox AOI declarado
--      (borde sur -38.00) y del centro declarado (Alto Nahuelbuta, -37.717).
--      Puede ser un error de transcripción en la ficha. Verificar antes de
--      presentar nada.
--   b) El área real de los vértices de cada pedimento NO da 5.000 ha como
--      dice la ficha: da 8.000 ha en 6 de los 7, y 1.000 ha en el
--      NAHUELBUTA REE 6 (N_inicio/N_fin casi iguales: 5.742.000/5.741.000).
--      deal_pedimentos.ha se cargó con el valor REAL calculado de los
--      vértices (suma: 49.000 ha), no con los 5.000/pedimento declarados.
--   c) profile.geochem.provenance se cargó como REFERENCIA_BIBLIOGRAFICA:
--      los valores de ΣREE/ratios/anomalía Eu de la ficha citan literatura
--      regional (Bustos et al. 2023, SERNAGEOMIN IR-25-122, análogo
--      Jiangxi), no muestreo propio del proyecto — que todavía ni tiene
--      pedimentos constituidos. La UI de /dashboard/pipeline muestra un
--      badge de advertencia para este caso.
-- ============================================================================

DO $$
DECLARE
  v_creator_email text := 'alvaro.cumora@gmail.com';
  v_creator_id    uuid;
  v_deal_code     text := 'GEO-2026-004';
  v_deal_id       uuid;
BEGIN
  SELECT id INTO v_creator_id FROM auth.users WHERE email = v_creator_email LIMIT 1;
  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario con email %. Ajustá v_creator_email.', v_creator_email;
  END IF;

  -- ============================================================
  -- DEAL
  -- ============================================================
  SELECT id INTO v_deal_id FROM public.deals WHERE code = v_deal_code;
  IF v_deal_id IS NULL THEN
    INSERT INTO public.deals (
      created_by, code, name, description, commodity, region, pipeline_stage, profile
    ) VALUES (
      v_creator_id, v_deal_code, 'Nahuelbuta REE',
      'REE ion-adsorción (IAD), análogo Jiangxi. Batolito Costero Sur, granitoides tipo-S Carbonífero-Pérmico.',
      'REE', 'Biobío / Araucanía', 'PEDIMENTO',
      jsonb_build_object(
        'status', 'Pedimento preliminar — coordenadas sin verificar en SIGEX',
        'subtype', 'Ion-Adsorción (IAD) — análogo Jiangxi, China',
        'aoi_ha', 49000,
        'pedimentos', 7,
        'ha_per_pedimento', 5000,
        'datum', 'SAD69 UTM Huso 18S',
        'center_lat', -37.717,
        'center_lon', -73.033,
        'elevation_m', 1565,
        'owner', 'Álvaro Oliva Herrera · aoliva@ligniumenergy.com',
        'target_standard', 'NI 43-101 (TSX-V/CSE) + CH 20235 CMC Chile',
        'qp', jsonb_build_object(
          'name', 'Enrique Viteri Aldunate',
          'phone', '+56 9 82896199',
          'email', 'enriqueviteri@gmail.com',
          'standard', 'NI 43-101',
          'status', 'PROPUESTO — no contratado aún'
        ),
        'comparable', jsonb_build_object(
          'name', 'Trinity One Metals',
          'ticker', 'TSXV:TOM',
          'event', 'Opción firmada 03-08-2026'
        ),
        'exit_options', jsonb_build_array(
          'JV (BHP/Rio Tinto)', 'Venta a fondo TSX-V', 'Listing', 'Royalty NSR'
        ),
        'geochem', jsonb_build_object(
          'provenance', 'REFERENCIA_BIBLIOGRAFICA',
          'ree_max_ppm', 2000,
          'ree_type', 'LREE+HREE — La/SmN 1.22–2.53 (enriquecimiento LREE), Gd/YbN 2.42–15.10 (depleción HREE), anomalía Eu −0.11 a −0.25 (negativa fuerte)',
          'regolith_depth_m', 60,
          'host_rock', 'Batolito Costero Sur, granitoides tipo-S, Carbonífero-Pérmico (~300-320 Ma)',
          'ree_carrier', 'Caolinita (intercambio iónico); alanita y monacita en roca fresca'
        ),
        'spectral_indices', jsonb_build_array(
          'CMR=B11/B12', 'Iron Oxide=B4/B2', 'Argílic=B11/B8A', 'BSI', 'NDVI', 'ASTER TIR',
          'EMIT/EnMAP hiperespectral'
        ),
        'scientific_refs', jsonb_build_array(
          'Bustos et al. (J. Geochem. Explor. 2023)',
          'UC.cl REE Cordillera Costa Biobío',
          'SERNAGEOMIN IR-25-122 (2025)',
          'Metalogénesis Batolito Nahuelbuta (ResearchGate 2018)'
        ),
        'datasheet_url', 'https://claude.ai/artifact/S2uqRdgDWH8JE2aavE3a4K',
        'aoi_bbox_wgs84', jsonb_build_array(-73.15, -38.00, -72.40, -37.30),
        'competencia', jsonb_build_array(
          '43 pedimentos Quirihue (sep-2026)', '128 IRIS en Maule'
        ),
        'oit169', 'Consulta previa obligatoria. Alvy tiene representación de comunidades en ~35.000 ha (activo favorable).',
        'exclusion', 'PN Nahuelbuta (68 km²) — polígono CONAF'
      )
    )
    RETURNING id INTO v_deal_id;
  END IF;

  -- ============================================================
  -- PEDIMENTOS (deal_pedimentos) — 7 × nominalmente 5.000 ha (ver cabecera
  -- sobre el área real calculada de los vértices, que no coincide). Vértices
  -- UTM tal como vinieron en la ficha, sin modificar valores.
  -- ============================================================
  INSERT INTO public.deal_pedimentos (deal_id, seq, name, ha, court, status, n_from, n_to, e_from, e_to, datum)
  SELECT v_deal_id, p.seq, p.name, p.ha_real, p.court, 'PENDIENTE',
         p.n_from, p.n_to, p.e_from, p.e_to, 'SAD69 UTM 18S'
  FROM (VALUES
    (1, 'NAHUELBUTA REE 1', 8000.0, 'Cañete',     5782000.0, 5774000.0, 666000.0, 676000.0),
    (2, 'NAHUELBUTA REE 2', 8000.0, 'Cañete',     5774000.0, 5766000.0, 666000.0, 676000.0),
    (3, 'NAHUELBUTA REE 3', 8000.0, 'Lebu',       5766000.0, 5758000.0, 668000.0, 678000.0),
    (4, 'NAHUELBUTA REE 4', 8000.0, 'Lebu',       5758000.0, 5750000.0, 670000.0, 680000.0),
    (5, 'NAHUELBUTA REE 5', 8000.0, 'Purén',      5750000.0, 5742000.0, 672000.0, 682000.0),
    (6, 'NAHUELBUTA REE 6', 1000.0, 'Purén',      5742000.0, 5741000.0, 674000.0, 684000.0),
    (7, 'NAHUELBUTA REE 7', 8000.0, 'Los Álamos', 5760000.0, 5752000.0, 660000.0, 670000.0)
  ) AS p(seq, name, ha_real, court, n_from, n_to, e_from, e_to)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.deal_pedimentos dp WHERE dp.deal_id = v_deal_id AND dp.seq = p.seq
  );

  -- ============================================================
  -- ALERTAS (deal_alerts)
  -- ============================================================
  INSERT INTO public.deal_alerts (deal_id, alert_type, priority, title, description)
  SELECT v_deal_id, 'CATASTRO', 'ALTA', 'Verificación catastro',
    'Verificar los 7 polígonos (NAHUELBUTA REE 1-7) en SERNAGEOMIN SIGEX (SAD69 H18S) antes de presentar. Excluir PN Nahuelbuta (68 km², polígono CONAF). ' ||
    'OJO: al convertir los vértices SAD69→WGS84 tal como vinieron en la ficha, los 7 pedimentos caen 10-80 km al sur del AOI/centro declarado (Alto Nahuelbuta, -37.717) — revisar si hay error de transcripción en las coordenadas antes de cualquier trámite. ' ||
    'Además, el área real de los vértices da 8.000 ha en 6 pedimentos y 1.000 ha en el NAHUELBUTA REE 6, no los 5.000 ha declarados en la ficha.'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.deal_alerts da WHERE da.deal_id = v_deal_id AND da.title = 'Verificación catastro'
  );

  INSERT INTO public.deal_alerts (deal_id, alert_type, priority, title, description)
  SELECT v_deal_id, 'OIT169', 'ALTA', 'Consulta previa OIT 169',
    'Consulta previa a comunidades Mapuche obligatoria antes de avanzar (Convenio OIT 169). Alvy tiene representación de comunidades en ~35.000 ha en la zona — activo favorable a considerar en la estrategia de relacionamiento.'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.deal_alerts da WHERE da.deal_id = v_deal_id AND da.title = 'Consulta previa OIT 169'
  );

  RAISE NOTICE 'GEO-2026-004 cargado en el pipeline de deals. deal_id=%', v_deal_id;
END $$;
