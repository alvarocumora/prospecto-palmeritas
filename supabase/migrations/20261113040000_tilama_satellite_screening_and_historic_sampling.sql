-- Inyección de datos reales del proyecto Tilama (Los Verdes, project_id
-- 7a499b02-ecdf-447b-8956-b106fe4ec087): screening satelital Nivel 0 sobre el
-- AOI del proyecto integrado (LV4+LV5+La Peumo+Las Trancas, mismo pipeline
-- gc_remote usado en Cholqui) y muestreo histórico de roca aún no cargado.
--
-- 1) satellite_analysis_runs + satellite_anomalies: 15 anomalías Al-OH/gossan
--    derivadas de 18 escenas Sentinel-2 L2A (2019-2026, Planetary Computer
--    STAC), cobertura interpretable 95.3%/98.0% (típico/mejor caso). Todas
--    quedan con procedencia DERIVADO/INTERPRETADO — no son identificación
--    mineral, requieren verificación de terreno.
--
-- 2) sampling_results: 17 muestras de roca de la Tabla 1 del informe Harry
--    Esterio (2014, sector Los Verdes) — CuT/CuSH/Ag/Au/Mo/Pb/Zn digitalizados
--    del original impreso/fotografiado. Sin coordenadas digitalizadas (el
--    informe no las trae por muestra) y sin lab/certificado -> quedan como
--    dato "declared" (real pero sin certificar), nunca "measured", consistente
--    con report_readiness(). No se inventa posición ni CRS.
--
-- created_by se resuelve por email, igual que
-- 20261102110000_tilama_losverdes5_exploration_targets_kmz_import.sql; si no
-- hay usuarios la migración no aborta el resto del deploy.

DO $$
DECLARE
  v_owner uuid;
  v_project uuid := '7a499b02-ecdf-447b-8956-b106fe4ec087';
  v_run uuid;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE email = 'alvaro.cumora@gmail.com' LIMIT 1;
  IF v_owner IS NULL THEN
    SELECT id INTO v_owner FROM auth.users ORDER BY created_at LIMIT 1;
  END IF;
  IF v_owner IS NULL THEN
    RAISE NOTICE 'Sin usuarios en auth.users; no se cargó la inyección de datos de Tilama.';
    RETURN;
  END IF;

  INSERT INTO public.satellite_analysis_runs
    (project_id, created_by, provider, sensor, index_code, status, date_from, date_to,
     max_cloud_cover_pct, parameters, source_metadata, pipeline_version, content_hash,
     started_at, completed_at)
  VALUES
    (v_project, v_owner, 'Microsoft Planetary Computer', 'Sentinel-2 L2A', 'ALOH_GOSSAN', 'completed',
     '2019-02-01', '2026-04-30', 10,
     jsonb_build_object('months', jsonb_build_array(2,3,4), 'strike_deg', 25.0, 'percentile', 97.0, 'max_n', 15),
     jsonb_build_object('scenes_used', 18, 'coverage_typical_pct', 95.3, 'coverage_bestcase_pct', 98.0,
                         'area_basis', 'AOI_POLYGONS', 'aoi', 'losverdes_proyecto_integrado.geojson'),
     'gc-remote-0.1.0', '408937163cea43b47241e80e4b0a502375d1c1ceac747f1743d8f70ee3225f46',
     now(), now())
  RETURNING id INTO v_run;

  INSERT INTO public.satellite_anomalies
    (project_id, run_id, created_by, index_code, score, severity, geometry, bbox, sensor, notes)
  VALUES
  (v_project, v_run, v_owner, 'CLAY_MINERALS', 0.928, 'alta', '{"type": "Polygon", "coordinates": [[[-71.0953996231919, -32.03352254054054], [-71.09412437680811, -32.03352254054054], [-71.09412437680811, -32.032441459459456], [-71.0953996231919, -32.032441459459456], [-71.0953996231919, -32.03352254054054]]]}'::jsonb, ARRAY[-71.095400,-32.033523,-71.094124,-32.032441]::numeric[], 'Sentinel-2 L2A', 'Anomalia Al-OH z=8.35 (gossan 1.83). DERIVADO Sentinel-2. | DERIVADO / INTERPRETADO — no verificado en terreno'),
  (v_project, v_run, v_owner, 'HYDROTHERMAL_ALTERATION', 0.658, 'media', '{"type": "Polygon", "coordinates": [[[-71.11880359285806, -32.02916554054054], [-71.11752840714195, -32.02916554054054], [-71.11752840714195, -32.02808445945946], [-71.11880359285806, -32.02808445945946], [-71.11880359285806, -32.02916554054054]]]}'::jsonb, ARRAY[-71.118804,-32.029166,-71.117528,-32.028084]::numeric[], 'Sentinel-2 L2A', 'Anomalia Al-OH z=5.92 (gossan 4.06). DERIVADO Sentinel-2. | DERIVADO / INTERPRETADO — no verificado en terreno'),
  (v_project, v_run, v_owner, 'CLAY_MINERALS', 0.627, 'media', '{"type": "Polygon", "coordinates": [[[-71.09493461068718, -32.03172654054054], [-71.09365938931282, -32.03172654054054], [-71.09365938931282, -32.03064545945946], [-71.09493461068718, -32.03064545945946], [-71.09493461068718, -32.03172654054054]]]}'::jsonb, ARRAY[-71.094935,-32.031727,-71.093659,-32.030645]::numeric[], 'Sentinel-2 L2A', 'Anomalia Al-OH z=5.64 (gossan 1.69). DERIVADO Sentinel-2. | DERIVADO / INTERPRETADO — no verificado en terreno'),
  (v_project, v_run, v_owner, 'HYDROTHERMAL_ALTERATION', 0.604, 'media', '{"type": "Polygon", "coordinates": [[[-71.11921078003425, -32.05603554054054], [-71.11793521996574, -32.05603554054054], [-71.11793521996574, -32.05495445945946], [-71.11921078003425, -32.05495445945946], [-71.11921078003425, -32.05603554054054]]]}'::jsonb, ARRAY[-71.119211,-32.056036,-71.117935,-32.054954]::numeric[], 'Sentinel-2 L2A', 'Anomalia Al-OH z=5.44 (gossan 3.72). DERIVADO Sentinel-2. | DERIVADO / INTERPRETADO — no verificado en terreno'),
  (v_project, v_run, v_owner, 'HYDROTHERMAL_ALTERATION', 0.593, 'media', '{"type": "Polygon", "coordinates": [[[-71.08974564268226, -32.03632154054054], [-71.08847035731773, -32.03632154054054], [-71.08847035731773, -32.03524045945946], [-71.08974564268226, -32.03524045945946], [-71.08974564268226, -32.03632154054054]]]}'::jsonb, ARRAY[-71.089746,-32.036322,-71.088470,-32.035240]::numeric[], 'Sentinel-2 L2A', 'Anomalia Al-OH z=5.34 (gossan 3.73). DERIVADO Sentinel-2. | DERIVADO / INTERPRETADO — no verificado en terreno'),
  (v_project, v_run, v_owner, 'CLAY_MINERALS', 0.576, 'media', '{"type": "Polygon", "coordinates": [[[-71.09971658376685, -32.02785954054054], [-71.09844141623316, -32.02785954054054], [-71.09844141623316, -32.02677845945946], [-71.09971658376685, -32.02677845945946], [-71.09971658376685, -32.02785954054054]]]}'::jsonb, ARRAY[-71.099717,-32.027860,-71.098441,-32.026778]::numeric[], 'Sentinel-2 L2A', 'Anomalia Al-OH z=5.18 (gossan 1.59). DERIVADO Sentinel-2. | DERIVADO / INTERPRETADO — no verificado en terreno'),
  (v_project, v_run, v_owner, 'HYDROTHERMAL_ALTERATION', 0.548, 'media', '{"type": "Polygon", "coordinates": [[[-71.09593959424338, -32.02936454054054], [-71.09466440575663, -32.02936454054054], [-71.09466440575663, -32.02828345945946], [-71.09593959424338, -32.02828345945946], [-71.09593959424338, -32.02936454054054]]]}'::jsonb, ARRAY[-71.095940,-32.029365,-71.094664,-32.028283]::numeric[], 'Sentinel-2 L2A', 'Anomalia Al-OH z=4.93 (gossan 6.51). DERIVADO Sentinel-2. | DERIVADO / INTERPRETADO — no verificado en terreno'),
  (v_project, v_run, v_owner, 'HYDROTHERMAL_ALTERATION', 0.547, 'media', '{"type": "Polygon", "coordinates": [[[-71.09183363365048, -32.03502454054054], [-71.09055836634951, -32.03502454054054], [-71.09055836634951, -32.03394345945946], [-71.09183363365048, -32.03394345945946], [-71.09183363365048, -32.03502454054054]]]}'::jsonb, ARRAY[-71.091834,-32.035025,-71.090558,-32.033943]::numeric[], 'Sentinel-2 L2A', 'Anomalia Al-OH z=4.92 (gossan 4.76). DERIVADO Sentinel-2. | DERIVADO / INTERPRETADO — no verificado en terreno'),
  (v_project, v_run, v_owner, 'HYDROTHERMAL_ALTERATION', 0.546, 'media', '{"type": "Polygon", "coordinates": [[[-71.119608516186, -32.018148540540544], [-71.118333483814, -32.018148540540544], [-71.118333483814, -32.01706745945946], [-71.119608516186, -32.01706745945946], [-71.119608516186, -32.018148540540544]]]}'::jsonb, ARRAY[-71.119609,-32.018149,-71.118333,-32.017067]::numeric[], 'Sentinel-2 L2A', 'Anomalia Al-OH z=4.91 (gossan 3.74). DERIVADO Sentinel-2. | DERIVADO / INTERPRETADO — no verificado en terreno'),
  (v_project, v_run, v_owner, 'CLAY_MINERALS', 0.543, 'media', '{"type": "Polygon", "coordinates": [[[-71.124679513083, -32.01770254054054], [-71.12340448691701, -32.01770254054054], [-71.12340448691701, -32.01662145945946], [-71.124679513083, -32.01662145945946], [-71.124679513083, -32.01770254054054]]]}'::jsonb, ARRAY[-71.124680,-32.017703,-71.123404,-32.016621]::numeric[], 'Sentinel-2 L2A', 'Anomalia Al-OH z=4.89 (gossan 1.76). DERIVADO Sentinel-2. | DERIVADO / INTERPRETADO — no verificado en terreno'),
  (v_project, v_run, v_owner, 'HYDROTHERMAL_ALTERATION', 0.534, 'media', '{"type": "Polygon", "coordinates": [[[-71.12278251581726, -32.01809554054054], [-71.12150748418274, -32.01809554054054], [-71.12150748418274, -32.01701445945946], [-71.12278251581726, -32.01701445945946], [-71.12278251581726, -32.01809554054054]]]}'::jsonb, ARRAY[-71.122783,-32.018096,-71.121507,-32.017014]::numeric[], 'Sentinel-2 L2A', 'Anomalia Al-OH z=4.81 (gossan 3.07). DERIVADO Sentinel-2. | DERIVADO / INTERPRETADO — no verificado en terreno'),
  (v_project, v_run, v_owner, 'HYDROTHERMAL_ALTERATION', 0.534, 'media', '{"type": "Polygon", "coordinates": [[[-71.11851250501962, -32.01654354054054], [-71.11723749498037, -32.01654354054054], [-71.11723749498037, -32.01546245945946], [-71.11851250501962, -32.01546245945946], [-71.11851250501962, -32.01654354054054]]]}'::jsonb, ARRAY[-71.118513,-32.016544,-71.117237,-32.015462]::numeric[], 'Sentinel-2 L2A', 'Anomalia Al-OH z=4.81 (gossan 3.11). DERIVADO Sentinel-2. | DERIVADO / INTERPRETADO — no verificado en terreno'),
  (v_project, v_run, v_owner, 'CLAY_MINERALS', 0.528, 'media', '{"type": "Polygon", "coordinates": [[[-71.12881167333337, -32.04072254054054], [-71.12753632666663, -32.04072254054054], [-71.12753632666663, -32.03964145945946], [-71.12881167333337, -32.03964145945946], [-71.12881167333337, -32.04072254054054]]]}'::jsonb, ARRAY[-71.128812,-32.040723,-71.127536,-32.039641]::numeric[], 'Sentinel-2 L2A', 'Anomalia Al-OH z=4.75 (gossan 2.81). DERIVADO Sentinel-2. | DERIVADO / INTERPRETADO — no verificado en terreno'),
  (v_project, v_run, v_owner, 'HYDROTHERMAL_ALTERATION', 0.516, 'media', '{"type": "Polygon", "coordinates": [[[-71.12801281547054, -32.06111854054054], [-71.12673718452946, -32.06111854054054], [-71.12673718452946, -32.06003745945946], [-71.12801281547054, -32.06003745945946], [-71.12801281547054, -32.06111854054054]]]}'::jsonb, ARRAY[-71.128013,-32.061119,-71.126737,-32.060037]::numeric[], 'Sentinel-2 L2A', 'Anomalia Al-OH z=4.64 (gossan 4.67). DERIVADO Sentinel-2. | DERIVADO / INTERPRETADO — no verificado en terreno'),
  (v_project, v_run, v_owner, 'CLAY_MINERALS', 0.511, 'media', '{"type": "Polygon", "coordinates": [[[-71.12016449227505, -32.01471154054054], [-71.11888950772496, -32.01471154054054], [-71.11888950772496, -32.013630459459456], [-71.12016449227505, -32.013630459459456], [-71.12016449227505, -32.01471154054054]]]}'::jsonb, ARRAY[-71.120164,-32.014712,-71.118890,-32.013630]::numeric[], 'Sentinel-2 L2A', 'Anomalia Al-OH z=4.6 (gossan 2.96). DERIVADO Sentinel-2. | DERIVADO / INTERPRETADO — no verificado en terreno');

  INSERT INTO public.sampling_results
    (project_id, created_by, sample_code, sample_type, zone, au_gpt, ag_gpt, cu_pct, mo_ppm, pb_ppm, zn_ppm, notes)
  VALUES
  (v_project, v_owner, 'T00-112', 'rock', 'Los Verdes / Tilama', NULL, 0.15, 0.0, 0.5, 1.5, 58, 'Observacion: Veta mineralizada NS | CuSH 0.0% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'T00-181', 'rock', 'Los Verdes / Tilama', NULL, 1.3, 0.94, 3.0, 3.0, 74, 'Observacion: Veta mineralizada NS | CuSH 0.73% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'T00-182', 'rock', 'Los Verdes / Tilama', NULL, 0.15, 0.01, 0.5, 1.5, 19, 'Observacion: Estratificacion | CuSH 0.0% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'T00-183', 'rock', 'Los Verdes / Tilama', NULL, 4.0, 3.24, 47.0, 59.0, 197, 'Observacion: Veta mineralizada NS | CuSH 2.68% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'T00-184', 'rock', 'Los Verdes / Tilama', NULL, 0.15, 0.03, 0.5, 1.5, 38, 'Observacion: Contacto | CuSH 0.02% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'T00-185', 'rock', 'Los Verdes / Tilama', NULL, 6.6, 3.3, 78.0, 6.0, 123, 'Observacion: Veta mineralizada NS | CuSH 2.59% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'T00-186', 'rock', 'Los Verdes / Tilama', NULL, 53.8, 3.27, 4.0, 45.0, 33, 'Observacion: Veta mineralizada NS | CuSH 2.46% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'T00-187', 'rock', 'Los Verdes / Tilama', NULL, 0.15, 0.03, 15.0, 6.0, 59, 'Observacion: Estratificacion | CuSH 0.01% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'T00-212', 'rock', 'Los Verdes / Tilama', NULL, 15.8, 1.62, 0.5, 4.0, 96, 'Observacion: Veta mineralizada NS | CuSH 1.5% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'T00-220', 'rock', 'Los Verdes / Tilama', NULL, 88.2, 3.88, 0.5, 58.0, 2437, 'Observacion: Veta mineralizada NS | CuSH 0.55% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'T00-255', 'rock', 'Los Verdes / Tilama', NULL, 20.8, 1.99, 4.0, 338.0, 203, 'Observacion: Veta mineralizada NS | CuSH 2.0% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'T00-262', 'rock', 'Los Verdes / Tilama', NULL, 2.7, 2.48, 7.0, 4.0, 65, 'Observacion: Veta mineralizada NS | CuSH 2.6% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'T00-266', 'rock', 'Los Verdes / Tilama', NULL, 4.7, 0.8, 0.5, 1.5, 31, 'Observacion: Veta mineralizada NS | CuSH 0.65% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'ALV2-2516', 'rock', 'Los Verdes / Tilama', 4.9, 45.0, 3.33, NULL, NULL, NULL, 'Observacion: Veta mineralizada NS (compuesta Alto Los Verdes 2, pertenencias 1-15) | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'ALV1-2517', 'rock', 'Los Verdes / Tilama', 1.5, 11.0, 0.94, NULL, NULL, NULL, 'Observacion: Veta mineralizada NS (compuesta Alto Los Verdes 1, pertenencias 1-15) | CuSH 0.1% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'MLVT-M1', 'rock', 'Los Verdes / Tilama', NULL, NULL, 7.7, NULL, NULL, NULL, 'Observacion: Desmontes mina Los Verdes Tilama | CuSH 7.6% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.'),
  (v_project, v_owner, 'MLVT-M2-GUANACA', 'rock', 'Los Verdes / Tilama', NULL, NULL, 10.65, NULL, NULL, NULL, 'Observacion: Desmontes mina Los Verdes Tilama - La Guanaca | CuSH 2.2% | Fuente: Informe Harry Esterio 2014, Tabla 1 (sector Los Verdes). Sin coordenadas digitalizadas ni certificado de laboratorio -- dato historico declarado, no medido.');

  RAISE NOTICE 'Tilama: cargadas % anomalías satelitales y % muestras históricas (run %)', 15, 17, v_run;
END $$;
