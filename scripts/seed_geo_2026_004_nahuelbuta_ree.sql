-- ============================================================================
-- GEO-2026-004 — Nahuelbuta REE
-- Script de carga idempotente para el proyecto, los 7 pedimentos, la ficha
-- técnica completa (project_facts, incluye estructura de negocio, QP
-- propuesto, estándar objetivo y el comparable Trinity One Metals) y las 2
-- alertas (follow_up_tasks) descritas en la ficha entregada 01-10-2026.
--
-- NO usa la tabla `deals` (ni deal_comparables ni deal_certifier_assignments):
-- `public.deals` está marcada DEPRECADA en el propio schema —
-- supabase/migrations/20260821230028_1fe2541e-53e9-4046-87a9-e20ab68afc31.sql:1
-- dice textualmente "reemplazada por property_deal_inquiries +
-- deal_stage_events ... No usar en UI ni en métricas". Esas dos tablas de
-- reemplazo modelan el flujo de VENTA (un comprador externo consultando un
-- property_listing publicado) y no encajan con una oportunidad de
-- adquisición sourceada internamente como esta — así que en vez de forzar
-- un modelo que no corresponde, todo el contenido de "deal" (código,
-- estructura de negocio, comparable, QP) vive como filas de project_facts.
--
-- CÓMO CORRERLO
--   Este sandbox de Claude Code no tiene credenciales de la base en vivo
--   (sin SUPABASE_SERVICE_ROLE_KEY), así que este script no se ejecutó acá.
--   Corrarlo contra el proyecto Supabase real desde el SQL Editor o con:
--     supabase db execute -f scripts/seed_geo_2026_004_nahuelbuta_ree.sql
--
-- IDEMPOTENCIA
--   Cada INSERT está guardado con "WHERE NOT EXISTS" sobre una clave natural
--   (code / nombre+project_id / title+project_id), así que correrlo dos
--   veces no duplica filas.
--
-- SUPUESTOS QUE HAY QUE REVISAR ANTES DE CORRER
--   1) v_creator_email abajo asume que quien carga esto es el dueño de sesión
--      (alvaro.cumora@gmail.com). Cambialo si corresponde a otro usuario.
--   2) v_org_slug asume que ese usuario ya pertenece a al menos una
--      organización (toma la más antigua via organization_members). Si
--      tiene varias organizaciones y no es la que corresponde, fijá
--      v_org_id a mano.
--   3) El QP (Enrique Viteri) NO se carga en qualified_persons: esa tabla
--      exige user_id + license_no + registration_body reales, que no
--      vinieron en la ficha y que no se deben inventar (son datos de
--      acreditación profesional real). Queda solo como project_facts
--      ("QP propuesto", sección legal) hasta tener esos tres datos.
--
-- ⚠ HALLAZGO QUE NO SE PUDO VERIFICAR Y QUE SE CARGA TAL CUAL VINO, CON
--   ALERTA REFORZADA (no se "corrigió" nada — ver sección PEDIMENTOS):
--   a) Los vértices UTM de los 7 pedimentos, convertidos SAD69→WGS84, caen
--      entre lat -38.09 y -38.46 — es decir, 10 a 80 km AL SUR del bbox AOI
--      declarado (borde sur -38.00) y del centro declarado (Alto
--      Nahuelbuta, -37.717). Puede ser un error de transcripción en la
--      ficha (N/E invertidos, otra zona, u otro borrador). Verificar antes
--      de presentar nada.
--   b) El área real de los vértices de cada pedimento NO da 5.000 ha como
--      dice la ficha: da 8.000 ha en 6 de los 7, y 1.000 ha en el
--      NAHUELBUTA REE 6 (N_inicio/N_fin casi iguales: 5.742.000/5.741.000).
--      area_ha se cargó con el valor REAL calculado de los vértices, no con
--      el 5.000 declarado — para no esconder la inconsistencia.
-- ============================================================================

DO $$
DECLARE
  v_creator_email   text := 'alvaro.cumora@gmail.com';
  v_creator_id      uuid;
  v_org_id          uuid;
  v_project_code    text := 'NAHUELBUTA-REE';
  v_project_id      uuid;
BEGIN
  -- ---- resolver creador y organización ----
  SELECT id INTO v_creator_id FROM auth.users WHERE email = v_creator_email LIMIT 1;
  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario con email %. Ajustá v_creator_email.', v_creator_email;
  END IF;

  SELECT organization_id INTO v_org_id
  FROM public.organization_members
  WHERE user_id = v_creator_id
  ORDER BY joined_at ASC
  LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'El usuario % no pertenece a ninguna organización. Fijá v_org_id a mano.', v_creator_email;
  END IF;

  -- ============================================================
  -- PROYECTO
  -- ============================================================
  SELECT id INTO v_project_id FROM public.projects WHERE code = v_project_code;
  IF v_project_id IS NULL THEN
    INSERT INTO public.projects (
      organization_id, created_by, code, name, description,
      commodity, region, country, center_lat, center_lng, status, is_public_map
    ) VALUES (
      v_org_id, v_creator_id, v_project_code, 'Nahuelbuta REE',
      'Pedimento (pre-exploración) de tierras raras tipo ion-adsorción (IAD) sobre el Batolito Costero Sur, Alto Nahuelbuta.',
      'REE', 'Biobío / Araucanía', 'Chile', -37.717, -73.033, 'pedimento', false
    )
    RETURNING id INTO v_project_id;
  END IF;

  -- ============================================================
  -- PEDIMENTOS (7 × nominalmente 5.000 ha — ver cabecera sobre el
  -- área real calculada de los vértices, que no coincide)
  -- area_ha / vertices_utm / geometry_geojson calculados a partir de la
  -- tabla de vértices SAD69 UTM 18S tal como vino, sin modificar valores.
  -- ============================================================
  INSERT INTO public.pedimentos (
    project_id, created_by, nombre, tipo, mineral, estado, legal_state,
    area_ha, juzgado, region, datum, utm_zone, vertices_utm, geometry_geojson, notas
  )
  SELECT v_project_id, v_creator_id, p.nombre, 'exploracion', 'REE', 'pendiente',
         'preliminar_sin_verificar_sigex',
         p.area_ha_real, p.juzgado, p.region, 'SAD69', 18,
         p.vertices_utm, p.geom, p.notas
  FROM (VALUES
    ('NAHUELBUTA REE 1', 8000.0, 'Cañete',     'Biobío',
     jsonb_build_object('N_inicio', 5782000, 'N_fin', 5774000, 'E_inicio', 666000, 'E_fin', 676000),
     jsonb_build_object('type','Polygon','coordinates', jsonb_build_array(jsonb_build_array(
       jsonb_build_array(-73.10756,-38.09482), jsonb_build_array(-72.993583,-38.092928),
       jsonb_build_array(-72.991608,-38.164985), jsonb_build_array(-73.105698,-38.166882),
       jsonb_build_array(-73.10756,-38.09482)))),
     'Área declarada en ficha: 5.000 ha. Área real de los vértices provistos: 8.000 ha. PRELIMINAR, coordenadas sin verificar en SIGEX.'),
    ('NAHUELBUTA REE 2', 8000.0, 'Cañete',     'Biobío',
     jsonb_build_object('N_inicio', 5774000, 'N_fin', 5766000, 'E_inicio', 666000, 'E_fin', 676000),
     jsonb_build_object('type','Polygon','coordinates', jsonb_build_array(jsonb_build_array(
       jsonb_build_array(-73.105698,-38.166882), jsonb_build_array(-72.991608,-38.164985),
       jsonb_build_array(-72.989627,-38.237041), jsonb_build_array(-73.103829,-38.238942),
       jsonb_build_array(-73.105698,-38.166882)))),
     'Área declarada en ficha: 5.000 ha. Área real de los vértices provistos: 8.000 ha. PRELIMINAR, coordenadas sin verificar en SIGEX.'),
    ('NAHUELBUTA REE 3', 8000.0, 'Lebu',       'Biobío',
     jsonb_build_object('N_inicio', 5766000, 'N_fin', 5758000, 'E_inicio', 668000, 'E_fin', 678000),
     jsonb_build_object('type','Polygon','coordinates', jsonb_build_array(jsonb_build_array(
       jsonb_build_array(-73.080988,-38.238571), jsonb_build_array(-72.966788,-38.236648),
       jsonb_build_array(-72.964777,-38.308701), jsonb_build_array(-73.07909,-38.31063),
       jsonb_build_array(-73.080988,-38.238571)))),
     'Área declarada en ficha: 5.000 ha. Área real de los vértices provistos: 8.000 ha. PRELIMINAR, coordenadas sin verificar en SIGEX.'),
    ('NAHUELBUTA REE 4', 8000.0, 'Lebu',       'Biobío',
     jsonb_build_object('N_inicio', 5758000, 'N_fin', 5750000, 'E_inicio', 670000, 'E_fin', 680000),
     jsonb_build_object('type','Polygon','coordinates', jsonb_build_array(jsonb_build_array(
       jsonb_build_array(-73.056226,-38.310253), jsonb_build_array(-72.941916,-38.308302),
       jsonb_build_array(-72.939876,-38.380354), jsonb_build_array(-73.054299,-38.38231),
       jsonb_build_array(-73.056226,-38.310253)))),
     'Área declarada en ficha: 5.000 ha. Área real de los vértices provistos: 8.000 ha. PRELIMINAR, coordenadas sin verificar en SIGEX.'),
    ('NAHUELBUTA REE 5', 8000.0, 'Purén',      'Araucanía',
     jsonb_build_object('N_inicio', 5750000, 'N_fin', 5742000, 'E_inicio', 672000, 'E_fin', 682000),
     jsonb_build_object('type','Polygon','coordinates', jsonb_build_array(jsonb_build_array(
       jsonb_build_array(-73.031413,-38.381928), jsonb_build_array(-72.916992,-38.37995),
       jsonb_build_array(-72.914922,-38.452), jsonb_build_array(-73.029456,-38.453983),
       jsonb_build_array(-73.031413,-38.381928)))),
     'Área declarada en ficha: 5.000 ha. Área real de los vértices provistos: 8.000 ha. PRELIMINAR, coordenadas sin verificar en SIGEX.'),
    ('NAHUELBUTA REE 6', 1000.0, 'Purén',      'Araucanía',
     jsonb_build_object('N_inicio', 5742000, 'N_fin', 5741000, 'E_inicio', 674000, 'E_fin', 684000),
     jsonb_build_object('type','Polygon','coordinates', jsonb_build_array(jsonb_build_array(
       jsonb_build_array(-73.006548,-38.453595), jsonb_build_array(-72.892016,-38.45159),
       jsonb_build_array(-72.891754,-38.460596), jsonb_build_array(-73.0063,-38.462602),
       jsonb_build_array(-73.006548,-38.453595)))),
     'Área declarada en ficha: 5.000 ha. Área real de los vértices provistos: SOLO 1.000 ha (N_inicio 5.742.000 y N_fin 5.741.000 difieren en 1.000 m, no en 8.000 m como los otros 6). Revisar si hay un error de transcripción en la ficha original. PRELIMINAR, coordenadas sin verificar en SIGEX.'),
    ('NAHUELBUTA REE 7', 8000.0, 'Los Álamos', 'Biobío',
     jsonb_build_object('N_inicio', 5760000, 'N_fin', 5752000, 'E_inicio', 660000, 'E_fin', 670000),
     jsonb_build_object('type','Polygon','coordinates', jsonb_build_array(jsonb_build_array(
       jsonb_build_array(-73.171,-38.294077), jsonb_build_array(-73.056707,-38.292239),
       jsonb_build_array(-73.054781,-38.364296), jsonb_build_array(-73.169187,-38.366139),
       jsonb_build_array(-73.171,-38.294077)))),
     'Área declarada en ficha: 5.000 ha. Área real de los vértices provistos: 8.000 ha. PRELIMINAR, coordenadas sin verificar en SIGEX.')
  ) AS p(nombre, area_ha_real, juzgado, region, vertices_utm, geom, notas)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pedimentos pe WHERE pe.project_id = v_project_id AND pe.nombre = p.nombre
  );

  -- ============================================================
  -- ALERTAS (follow_up_tasks)
  -- ============================================================
  -- Sin due_date: la ficha pide "antes de presentar cualquier pedimento",
  -- un gate cualitativo, no una fecha concreta.
  INSERT INTO public.follow_up_tasks (project_id, created_by, title, description, category, priority, status, source)
  SELECT v_project_id, v_creator_id,
    'VERIFICACIÓN CATASTRO — Nahuelbuta REE',
    'Verificar los 7 polígonos (NAHUELBUTA REE 1-7) en SERNAGEOMIN SIGEX (SAD69 H18S) antes de presentar. Excluir PN Nahuelbuta (68 km², polígono CONAF). ' ||
    'OJO: al convertir los vértices SAD69→WGS84 tal como vinieron en la ficha, los 7 pedimentos caen 10-80 km al sur del AOI/centro declarado (Alto Nahuelbuta, -37.717) — revisar si hay error de transcripción en las coordenadas antes de cualquier trámite. ' ||
    'Además, el área real de los vértices da 8.000 ha en 6 pedimentos y 1.000 ha en el NAHUELBUTA REE 6, no los 5.000 ha declarados en la ficha.',
    'catastro', 'high', 'open', 'manual_geo_2026_004'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.follow_up_tasks t
    WHERE t.project_id = v_project_id AND t.title = 'VERIFICACIÓN CATASTRO — Nahuelbuta REE'
  );

  INSERT INTO public.follow_up_tasks (project_id, created_by, title, description, category, priority, status, source)
  SELECT v_project_id, v_creator_id,
    'OIT 169 — Consulta previa Nahuelbuta REE',
    'Consulta previa a comunidades Mapuche obligatoria antes de avanzar (Convenio OIT 169). Alvy tiene representación de comunidades en ~35.000 ha en la zona — activo favorable a considerar en la estrategia de relacionamiento.',
    'general', 'high', 'open', 'manual_geo_2026_004'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.follow_up_tasks t
    WHERE t.project_id = v_project_id AND t.title = 'OIT 169 — Consulta previa Nahuelbuta REE'
  );

  -- ============================================================
  -- FICHA TÉCNICA (project_facts) — provenance: 'declarado' salvo lo
  -- explícitamente marcado PRELIMINAR/sin verificar, que va 'a_verificar'.
  -- ============================================================
  DELETE FROM public.project_facts WHERE project_id = v_project_id AND source = 'ficha_geo_2026_004';

  INSERT INTO public.project_facts (project_id, created_by, section, label, value, unit, provenance, source, note, sort_order)
  VALUES
    (v_project_id, v_creator_id, 'activo', 'AOI bbox WGS84', '[-73.15, -38.00, -72.40, -37.30]', NULL, 'declarado', 'ficha_geo_2026_004', 'min_lon, min_lat, max_lon, max_lat', 0),
    (v_project_id, v_creator_id, 'activo', 'Centro AOI', 'Lat -37.717 / Lon -73.033 (Alto Nahuelbuta, 1.565 m)', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 1),
    (v_project_id, v_creator_id, 'activo', 'Datum pedimentos', 'SAD69 UTM Huso 18S', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 2),
    (v_project_id, v_creator_id, 'activo', 'Regiones', 'Biobío + Araucanía', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 3),
    (v_project_id, v_creator_id, 'geologia', 'Commodity principal', 'REE (tierras raras) — LREE + HREE', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 4),
    (v_project_id, v_creator_id, 'geologia', 'Subtipo de depósito', 'Ion-Adsorción (IAD) — análogo Jiangxi, China', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 5),
    (v_project_id, v_creator_id, 'geologia', 'Roca anfitriona', 'Batolito Costero Sur, granitoides tipo-S, Carbonífero-Pérmico (~300-320 Ma)', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 6),
    (v_project_id, v_creator_id, 'geologia', 'Portador REE', 'Caolinita (intercambio iónico); alanita y monacita en roca fresca', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 7),
    (v_project_id, v_creator_id, 'tierras_raras', 'ΣREE intercambiable (pXRF/ICP-MS)', 'hasta 2.000', 'ppm', 'declarado', 'ficha_geo_2026_004', NULL, 8),
    (v_project_id, v_creator_id, 'tierras_raras', 'La/SmN (enriquecimiento LREE)', '1.22 – 2.53', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 9),
    (v_project_id, v_creator_id, 'tierras_raras', 'Gd/YbN (depleción HREE)', '2.42 – 15.10', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 10),
    (v_project_id, v_creator_id, 'tierras_raras', 'Anomalía Eu', '−0.11 a −0.25 (negativa fuerte)', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 11),
    (v_project_id, v_creator_id, 'tierras_raras', 'Profundidad regolito', 'hasta 60', 'm', 'declarado', 'ficha_geo_2026_004', 'Pedolito arcilloso 0-30 m', 12),
    (v_project_id, v_creator_id, 'tierras_raras', 'Geometría de cuerpos', 'Lentiformes sobre afloramientos graníticos', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 13),
    (v_project_id, v_creator_id, 'geologia', 'Índices satelitales a mapear (GEE)', 'CMR=B11/B12 · Iron Oxide=B4/B2 · Argílic=B11/B8A · BSI · NDVI · ASTER TIR · EMIT/EnMAP hiperespectral', NULL, 'a_verificar', 'ficha_geo_2026_004', 'Plan de mapeo, aún no ejecutado', 14),
    (v_project_id, v_creator_id, 'catastro', 'Pedimentos', '7 × 5.000 ha declaradas (NAHUELBUTA REE 1-7)', NULL, 'a_verificar', 'ficha_geo_2026_004', 'Área real calculada de los vértices no coincide — ver pedimentos.notas', 15),
    (v_project_id, v_creator_id, 'catastro', 'Juzgados', 'Cañete · Lebu · Purén · Los Álamos (Biobío/Araucanía)', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 16),
    (v_project_id, v_creator_id, 'catastro', 'Exclusión', 'PN Nahuelbuta (68 km²) — polígono CONAF', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 17),
    (v_project_id, v_creator_id, 'legal', 'Competencia — Quirihue', '43 pedimentos presentados sep-2026', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 18),
    (v_project_id, v_creator_id, 'legal', 'Competencia — Maule', '128 IRIS', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 19),
    (v_project_id, v_creator_id, 'legal', 'OIT 169', 'Consulta previa obligatoria. Alvy tiene representación de comunidades en ~35.000 ha (activo favorable).', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 20),
    (v_project_id, v_creator_id, 'legal', 'QP propuesto', 'Enrique Viteri Aldunate · +56 9 82896199 · enriqueviteri@gmail.com — PROPUESTO, no contratado', NULL, 'declarado', 'ficha_geo_2026_004', 'No cargado en qualified_persons: faltan license_no/registration_body/user_id reales', 21),
    (v_project_id, v_creator_id, 'legal', 'Estándar objetivo', 'NI 43-101 (TSX-V/CSE) + CH 20235 CMC Chile', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 22),
    (v_project_id, v_creator_id, 'economico', 'Estructura preferida', 'Opción o JV con major canadiense/australiano', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 23),
    (v_project_id, v_creator_id, 'economico', 'Exits posibles', 'JV (BHP/Rio Tinto), venta a fondo TSX-V, listing, royalty NSR', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 24),
    (v_project_id, v_creator_id, 'economico', 'Comparable', 'Trinity One Metals (TSXV:TOM) — opción firmada 03-08-2026', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 25),
    (v_project_id, v_creator_id, 'otro', 'Data sheet publicado', 'https://claude.ai/artifact/S2uqRdgDWH8JE2aavE3a4K', NULL, 'declarado', 'ficha_geo_2026_004', 'DATA_SHEET_V1', 26),
    (v_project_id, v_creator_id, 'otro', 'Referencias científicas', 'Bustos et al. (J. Geochem. Explor. 2023) · UC.cl REE Cordillera Costa Biobío · SERNAGEOMIN IR-25-122 (2025) · Metalogénesis Batolito Nahuelbuta (ResearchGate 2018)', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 27),
    (v_project_id, v_creator_id, 'activo', 'Código del deal', 'GEO-2026-004', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 28),
    (v_project_id, v_creator_id, 'legal', 'Owner', 'Álvaro Oliva Herrera · aoliva@ligniumenergy.com', NULL, 'declarado', 'ficha_geo_2026_004', NULL, 29);

  RAISE NOTICE 'GEO-2026-004 cargado. project_id=%', v_project_id;
END $$;

-- ============================================================================
-- QP (Enrique Viteri) — NO CARGAR hasta tener estos 3 datos reales:
--   - ¿Ya tiene cuenta de usuario en Geocapitals? (user_id)
--   - license_no (N° de registro profesional)
--   - registration_body (ej. CMC Chile / otro colegio profesional)
-- No hay todavía una tabla no-deprecada que asocie un QP a un proyecto
-- fuera del flujo de informes NI 43-101 (technical_reports.lead_qp_id) —
-- crear un informe solo para registrar un QP "propuesto, no contratado"
-- sería forzar ese modelo. Por ahora el QP propuesto queda documentado
-- como project_facts (fila "QP propuesto" arriba); recién insertar en
-- qualified_persons cuando estén esos 3 datos reales y se sepa cómo se
-- va a asociar al proyecto/informe:
--
-- INSERT INTO public.qualified_persons (user_id, full_name, profession, registration_body, license_no, competency_areas)
-- VALUES (
--   '<<TODO: user_id real de Enrique Viteri>>'::uuid,
--   'Enrique Viteri Aldunate', 'Geólogo',
--   '<<TODO: ej. CMC Chile>>', '<<TODO: N° de registro>>',
--   ARRAY['REE', 'geología de exploración']
-- );
-- END $$;
-- ============================================================================
