-- Carga de 108 targets/anomalías de exploración para Alto Los Verdes 5 (Tilama),
-- a partir del KMZ "Tilama_Targets_Anomalias.kmz" que Alvy subió al hilo de proyecto
-- (carpeta "Targets de exploración (108)" > "generated (108)" del KMZ).
--
-- Fases: la prioridad de cada target (critical/high/medium/low) ya codifica el
-- orden de campaña sugerido por el KMZ de origen:
--   critical/high -> Fase 1: verificación/muestreo inmediato (anomalías >2% Cu, targets nombrados)
--   medium        -> Fase 2: seguimiento geoquímico
--   low           -> Fase 3: mapeo regional / clusters geoquímicos
--
-- Todos los targets quedan en stage='generated' (candidatos, sin validar en terreno),
-- consistente con report_readiness(): nunca se cuentan como "medido".
--
-- created_by se resuelve por email (con fallback al primer usuario de auth.users),
-- igual que 20260722001500_seed_ree_trento_marketplace.sql; si no hay ningún
-- usuario la migración no aborta el resto del deploy, solo deja un aviso.
--
-- Nota: los 4 clusters GCF-TIL-CD56-* traían en el KMZ original un % de Cu mal
-- calculado (off por 100x respecto al ppm acompañante, p.ej. "213.129% (≈21313
-- ppm)" cuando 21313 ppm es 2.1313%). Se corrige aquí antes de persistir, para
-- no exponer leyes físicamente imposibles (>100% Cu) en el informe/paneles.

DO $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE email = 'alvaro.cumora@gmail.com' LIMIT 1;
  IF v_owner IS NULL THEN
    SELECT id INTO v_owner FROM auth.users ORDER BY created_at LIMIT 1;
  END IF;
  IF v_owner IS NULL THEN
    RAISE NOTICE 'Sin usuarios en auth.users; no se cargaron los targets de exploración de Tilama.';
    RETURN;
  END IF;

  INSERT INTO public.exploration_targets
    (project_id, created_by, code, name, target_type, commodity, stage, priority,
     score, confidence_pct, elevation_m, rationale, lat, lng)
  SELECT '7a499b02-ecdf-447b-8956-b106fe4ec087', v_owner, v.code, v.name, v.target_type, v.commodity, v.stage, v.priority,
         v.score::numeric, v.confidence_pct::numeric, v.elevation_m::numeric, v.rationale,
         v.lat::numeric, v.lng::numeric
  FROM (
    VALUES
    ('ANOM-TIL-TOO-270', 'Anomalía TOO-270 - Cu 45.57%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'critical', 98.0, NULL, NULL, 'Cu=455700 ppm (45.57%), Mo=486, Ag=0.15, Au=1.0 ppb. Cu=455700ppm   Mo=486ppm   As=180ppm', -32.0302642, -71.0752084),
    ('ANOM-TIL-TOO-210', 'Anomalía TOO-210 - Cu 6.834%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'critical', 95.0, NULL, NULL, 'Cu=68340 ppm (6.834%), Mo=72, Ag=0.15, Au=1.0 ppb. Cu=68340ppm', -32.0266399, -71.0986827),
    ('ANOM-TIL-TOO-280', 'Anomalía TOO-280 - Cu 6.1%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'critical', 98.0, NULL, NULL, 'Cu=61000 ppm (6.1%), Mo=189, Ag=0.15, Au=1.0 ppb. Cu=61000ppm   Mo=189ppm', -32.0136915, -71.0572203),
    ('ANOM-TIL-TOO-237', 'Anomalía TOO-237 - Cu 5.036%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'critical', 95.0, NULL, NULL, 'Cu=50360 ppm (5.036%), Mo=24, Ag=0.15, Au=1.0 ppb. Cu=50360ppm', -32.0632146, -71.0919981),
    ('ANOM-TIL-TOO-256', 'Anomalía TOO-256 - Cu 4.895%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 88.0, NULL, NULL, 'Cu=48950 ppm (4.895%), Mo=253, Ag=0.15, Au=1.0 ppb. Cu=48950ppm   Mo=253ppm', -32.0326772, -71.0831613),
    ('ANOM-TIL-TOO-150', 'Anomalía TOO-150 - Cu 4.868%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 88.0, NULL, NULL, 'Cu=48680 ppm (4.868%), Mo=84, Ag=11.7, Au=1.0 ppb. Cu=48680ppm   Ag=11.7ppm   As=62ppm', -32.0533327, -71.1130166),
    ('ANOM-TIL-TOO-240', 'Anomalía TOO-240 - Cu 4.689%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 85.0, NULL, NULL, 'Cu=46890 ppm (4.689%), Mo=21, Ag=0.15, Au=1.0 ppb. Cu=46890ppm', -32.062849, -71.1026444),
    ('ANOM-TIL-TOO-198', 'Anomalía TOO-198 - Cu 4.529%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 88.0, NULL, NULL, 'Cu=45290 ppm (4.529%), Mo=203, Ag=0.15, Au=1.0 ppb. Cu=45290ppm   Mo=203ppm', -32.0527137, -71.1035986),
    ('ANOM-TIL-TOO-126', 'Anomalía TOO-126 - Cu 4.337%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 88.0, NULL, NULL, 'Cu=43370 ppm (4.337%), Mo=40, Ag=20.2, Au=1.0 ppb. Cu=43370ppm   Ag=20.2ppm', -32.0439998, -71.1156082),
    ('ANOM-TIL-TOO-195', 'Anomalía TOO-195 - Cu 4.293%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 85.0, NULL, NULL, 'Cu=42930 ppm (4.293%), Mo=80, Ag=2.9, Au=1.0 ppb. Cu=42930ppm', -32.053681, -71.1045526),
    ('ANOM-TIL-TOO-220', 'Anomalía TOO-220 - Cu 3.875%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 88.0, NULL, NULL, 'Cu=38750 ppm (3.875%), Mo=58, Ag=1.0, Au=6.0 ppb. Cu=38750ppm   [DESTACADA AMARILLO - Cu muy alto]', -32.0320341, -71.0942743),
    ('ANOM-TIL-TOO-233', 'Anomalía TOO-233 - Cu 3.787%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 88.0, NULL, NULL, 'Cu=37870 ppm (3.787%), Mo=84, Ag=4.5, Au=5.0 ppb. Cu=37870ppm', -32.0554211, -71.0980583),
    ('ANOM-TIL-TOO-253', 'Anomalía TOO-253 - Cu 3.615%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 85.0, NULL, NULL, 'Cu=36150 ppm (3.615%), Mo=59, Ag=0.15, Au=1.0 ppb. Cu=36150ppm   As=315ppm', -32.053884, -71.0835359),
    ('ANOM-TIL-TOO-286', 'Anomalía TOO-286 - Cu 3.495%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 85.0, NULL, NULL, 'Cu=34950 ppm (3.495%), Mo=57, Ag=0.15, Au=1.0 ppb. Cu=34950ppm', -32.0161546, -71.0493677),
    ('ANOM-TIL-TOO-287', 'Anomalía TOO-287 - Cu 3.495%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 85.0, NULL, NULL, 'Cu=34950 ppm (3.495%), Mo=57, Ag=0.15, Au=1.0 ppb. Cu=34950ppm', -32.0126835, -71.0492905),
    ('ANOM-TIL-TOO-183', 'Anomalía TOO-183 - Cu 3.296%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 85.0, NULL, NULL, 'Cu=32960 ppm (3.296%), Mo=78, Ag=0.15, Au=1.0 ppb. Cu=32960ppm', -32.0208159, -71.105071),
    ('ANOM-TIL-TOO-271', 'Anomalía TOO-271 - Cu 3.237%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 85.0, NULL, NULL, 'Cu=32370 ppm (3.237%), Mo=4, Ag=0.15, Au=1.0 ppb. Cu=32370ppm', -32.048838, -71.0517375),
    ('ANOM-TIL-TOO-184', 'Anomalía TOO-184 - Cu 3.235%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 85.0, NULL, NULL, 'Cu=32350 ppm (3.235%), Mo=47, Ag=0.15, Au=1.0 ppb. Cu=32350ppm', -32.0217253, -71.1046154),
    ('ANOM-TIL-TOO-197', 'Anomalía TOO-197 - Cu 3.223%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 85.0, NULL, NULL, 'Cu=32230 ppm (3.223%), Mo=14, Ag=0.15, Au=1.0 ppb. Cu=32230ppm', -32.0527065, -71.1040326),
    ('LV-T-001', 'TIL1 Los Verdes', 'vein', 'Cu', 'generated', 'high', 65.0, 55.0, NULL, 'Zona Los Verdes — vetiforme Cu-Au-Ag superficial', -32.0345576689618, -71.1177202676492),
    ('LV-T-002', 'TIL2 Castellana feeder', 'vein', 'Cu', 'generated', 'critical', 82.0, 65.0, NULL, 'Leyes altas Cu-Au — feeder estructural de zona Castellana', -32.0285991093446, -71.1061701581829),
    ('LV-T-003', 'TIL4 Alto Los Verdes', 'skarn', 'Cu', 'generated', 'high', 70.0, 55.0, NULL, 'Sector Alto Los Verdes — skarn calcosilicatado con Cu', -32.0217565209809, -71.1135827631838),
    ('LV-T-004', 'TIL5 Los Peumos', 'vein', 'Cu', 'generated', 'medium', 55.0, 50.0, NULL, 'Sector Los Peumos — vetiforme Cu', -32.0438422462405, -71.1126184870253),
    ('LV-T-005', 'TIL6 Mineralización central', 'skarn', 'Cu', 'generated', 'high', 72.0, 55.0, NULL, 'Mineralización importante central — skarn Cu', -32.0418784998304, -71.1167982376482),
    ('LV-T-006', 'TIL7 Mandela', 'vein', 'Cu', 'generated', 'medium', 55.0, 45.0, NULL, 'Sector Mandela — vetiforme Cu', -32.0284592596268, -71.145699086712),
    ('LV-T-007', 'TIL8 Chele Norte', 'vein', 'Cu', 'generated', 'medium', 55.0, 45.0, NULL, 'Sector Chele Norte — vetiforme Cu', -32.0380472370989, -71.1467168885699),
    ('LV-T-008', 'Zona La Guanaca', 'skarn', 'Cu', 'generated', 'critical', 85.0, 60.0, NULL, 'Zona económica conceptual — 600×10×200 m, ~3.24 Mt @ 3.5–4% Cu visual', -32.0389059483215, -71.1127909551916),
    ('LV-T-009', 'Zona Castellana', 'vein', 'Cu', 'generated', 'high', 75.0, 55.0, NULL, 'Zona económica conceptual — 250×5×150 m, ~506 kt @ 0.8–1% Cu', -32.0317639482798, -71.1083918875314),
    ('ANOM-TIL-TOO-203', 'Anomalía TOO-203 - Cu 2.531%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 85.0, NULL, NULL, 'Cu=25310 ppm (2.531%), Mo=20, Ag=0.15, Au=1.0 ppb. Cu=25310ppm', -32.0527357, -71.1022753),
    ('ANOM-TIL-TOO-262', 'Anomalía TOO-262 - Cu 2.483%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 88.0, NULL, NULL, 'Cu=24830 ppm (2.483%), Mo=121, Ag=0.15, Au=1.0 ppb. Cu=24830ppm   Mo=121ppm', -32.0575136, -71.0898666),
    ('ANOM-TIL-TOO-148', 'Anomalía TOO-148 - Cu 2.418%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 88.0, NULL, NULL, 'Cu=24180 ppm (2.418%), Mo=58, Ag=5.9, Au=4.0 ppb. Cu=24180ppm   Ag=5.9ppm', -32.0554381, -71.1138593),
    ('GCF-TIL-CD56-0', 'Cluster geoquímico #1 – Tilama Kofu (48 muestras)', 'porphyry', NULL, 'generated', 'low', 32.5153125, 30.0, NULL, 'Geochemical Fingerprint sobre 190 muestras Kofu. Firma proyecto: Pórfido Cu-Mo ± Au. Cu medio del cluster: 0.0369% (≈369 ppm), Ag: 0.15 g/t.', -32.044347878644516, -71.10850041520511),
    ('GCF-TIL-CD56-1', 'Cluster geoquímico #2 – Tilama Kofu (43 muestras)', 'porphyry', NULL, 'generated', 'high', 100.0, 30.0, NULL, 'Geochemical Fingerprint sobre 190 muestras Kofu. Firma proyecto: Pórfido Cu-Mo ± Au. Cu medio del cluster: 2.1313% (≈21313 ppm), Ag: 0.15 g/t.', -32.035415772998824, -71.08210590187606),
    ('GCF-TIL-CD56-2', 'Cluster geoquímico #3 – Tilama Kofu (55 muestras)', 'porphyry', NULL, 'generated', 'high', 85.82323636363635, 30.0, NULL, 'Geochemical Fingerprint sobre 190 muestras Kofu. Firma proyecto: Pórfido Cu-Mo ± Au. Cu medio del cluster: 0.9248% (≈9248 ppm), Ag: 0.17 g/t.', -32.04809382023049, -71.10427125176707),
    ('GCF-TIL-CD56-3', 'Cluster geoquímico #4 – Tilama Kofu (44 muestras)', 'porphyry', NULL, 'generated', 'high', 100.0, 30.0, NULL, 'Geochemical Fingerprint sobre 190 muestras Kofu. Firma proyecto: Pórfido Cu-Mo ± Au. Cu medio del cluster: 1.1308% (≈11308 ppm), Ag: 6.48 g/t.', -32.045913756159194, -71.11042889640164),
    ('ANOM-TIL-TOO-234', 'Anomalía TOO-234 - Cu 2.397%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 85.0, NULL, NULL, 'Cu=23970 ppm (2.397%), Mo=29, Ag=0.15, Au=1.0 ppb. Cu=23970ppm', -32.0552729, -71.0961169),
    ('ANOM-TIL-TOO-156', 'Anomalía TOO-156 - Cu 2.2%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 88.0, NULL, NULL, 'Cu=22000 ppm (2.2%), Mo=75, Ag=25.6, Au=1.0 ppb. Cu=22000ppm   Ag=25.6ppm', -32.0453235, -71.1135738),
    ('ANOM-TIL-TOO-272', 'Anomalía TOO-272 - Cu 2.198%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 85.0, NULL, NULL, 'Cu=21980 ppm (2.198%), Mo=85, Ag=0.15, Au=1.0 ppb. Cu=21980ppm', -32.0228087, -71.0854468),
    ('ANOM-TIL-TOO-238', 'Anomalía TOO-238 - Cu 2.156%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 85.0, NULL, NULL, 'Cu=21560 ppm (2.156%), Mo=19, Ag=0.15, Au=1.0 ppb. Cu=21560ppm', -32.0642923, -71.0944586),
    ('ANOM-TIL-TOO-275', 'Anomalía TOO-275 - Cu 2.059%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 88.0, NULL, NULL, 'Cu=20590 ppm (2.059%), Mo=304, Ag=0.15, Au=1.0 ppb. Cu=20590ppm   Mo=304ppm', -32.020882, -71.0803006),
    ('ANOM-TIL-TOO-276', 'Anomalía TOO-276 - Cu 2.035%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 88.0, NULL, NULL, 'Cu=20350 ppm (2.035%), Mo=167, Ag=0.15, Au=1.0 ppb. Cu=20350ppm   Mo=167ppm', -32.011346, -71.0733105),
    ('ANOM-TIL-TOO-277', 'Anomalía TOO-277 - Cu 2.035%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 88.0, NULL, NULL, 'Cu=20350 ppm (2.035%), Mo=368, Ag=0.15, Au=1.0 ppb. Cu=20350ppm   Mo=368ppm', -32.0113972, -71.0701784),
    ('ANOM-TIL-TOO-255', 'Anomalía TOO-255 - Cu 1.989%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=19890 ppm (1.989%), Mo=358, Ag=0.15, Au=1.0 ppb. Cu=19890ppm   Mo=358ppm   As=315ppm', -32.0326256, -71.0862941),
    ('ANOM-TIL-TOO-258', 'Anomalía TOO-258 - Cu 1.985%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=19850 ppm (1.985%), Mo=101, Ag=0.15, Au=1.0 ppb. Cu=19850ppm   Mo=101ppm', -32.0466452, -71.0926269),
    ('ANOM-TIL-TOO-201', 'Anomalía TOO-201 - Cu 1.979%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=19790 ppm (1.979%), Mo=92, Ag=56.9, Au=1.0 ppb. Cu=19790ppm   Ag=56.9ppm', -32.0527137, -71.1035986),
    ('ANOM-TIL-TOO-273', 'Anomalía TOO-273 - Cu 1.943%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=19430 ppm (1.943%), Mo=83, Ag=0.15, Au=1.0 ppb. Cu=19430ppm', -32.0229713, -71.0755415),
    ('ANOM-TIL-TOO-155', 'Anomalía TOO-155 - Cu 1.764%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=17640 ppm (1.764%), Mo=50, Ag=13.9, Au=1.0 ppb. Cu=17640ppm   Ag=13.9ppm', -32.0456438, -71.1143753),
    ('ANOM-TIL-TOO-143', 'Anomalía TOO-143 - Cu 1.699%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=16990 ppm (1.699%), Mo=17, Ag=4.5, Au=1.0 ppb. Cu=16990ppm', -32.0559675, -71.1145599),
    ('ANOM-TIL-TOO-196', 'Anomalía TOO-196 - Cu 1.633%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=16330 ppm (1.633%), Mo=75, Ag=0.15, Au=1.0 ppb. Cu=16330ppm', -32.0530763, -71.1040305),
    ('ANOM-TIL-TOO-211', 'Anomalía TOO-211 - Cu 1.617%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=16170 ppm (1.617%), Mo=175, Ag=0.15, Au=1.0 ppb. Cu=16170ppm   Mo=175ppm', -32.0271159, -71.1009803),
    ('ANOM-TIL-TOO-166', 'Anomalía TOO-166 - Cu 1.563%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=15630 ppm (1.563%), Mo=92, Ag=0.15, Au=1.0 ppb. Cu=15630ppm', -32.0422515, -71.101432),
    ('ANOM-TIL-TOO-281', 'Anomalía TOO-281 - Cu 1.487%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=14870 ppm (1.487%), Mo=271, Ag=0.15, Au=1.0 ppb. Cu=14870ppm   Mo=271ppm', -32.0103908, -71.082064),
    ('ANOM-TIL-TOO-199', 'Anomalía TOO-199 - Cu 1.419%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=14190 ppm (1.419%), Mo=85, Ag=6.0, Au=1.0 ppb. Cu=14190ppm   Ag=6.0ppm', -32.0532586, -71.1022873),
    ('ANOM-TIL-TOO-132', 'Anomalía TOO-132 - Cu 1.17%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=11700 ppm (1.17%), Mo=6, Ag=0.15, Au=1.0 ppb. Cu=11700ppm', -32.0612089, -71.1551586),
    ('ANOM-TIL-TOO-124', 'Anomalía TOO-124 - Cu 1.069%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=10690 ppm (1.069%), Mo=5, Ag=8.1, Au=1.0 ppb. Cu=10690ppm   Ag=8.1ppm', -32.0415356, -71.1173515),
    ('ANOM-TIL-TOO-189', 'Anomalía TOO-189 - Cu 1.057%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=10570 ppm (1.057%), Mo=6, Ag=5.5, Au=1.0 ppb. Cu=10570ppm   Ag=5.5ppm', -32.0521371, -71.1035642),
    ('ANOM-TIL-TOO-207', 'Anomalía TOO-207 - Cu 1.057%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=10570 ppm (1.057%), Mo=59, Ag=0.15, Au=1.0 ppb. Cu=10570ppm', -32.0541252, -71.1027837),
    ('ANOM-TIL-TOO-227', 'Anomalía TOO-227 - Cu 1.0%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=10000 ppm (1.0%), Mo=91, Ag=0.15, Au=1.0 ppb. Cu=10000ppm', -32.0531922, -71.102487),
    ('ANOM-TIL-TOO-179', 'Anomalía TOO-179 - Cu 0.94%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=9400 ppm (0.94%), Mo=127, Ag=0.15, Au=1.0 ppb. Cu=9400ppm   Mo=127ppm', -32.0463944, -71.096338),
    ('ANOM-TIL-TOO-179A', 'Anomalía TOO-179A - Cu 0.94%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=9400 ppm (0.94%), Mo=127, Ag=0.15, Au=1.0 ppb. Cu=9400ppm   Mo=127ppm', -32.0463944, -71.096338),
    ('ANOM-TIL-TOO-180', 'Anomalía TOO-180 - Cu 0.94%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=9400 ppm (0.94%), Mo=127, Ag=0.15, Au=1.0 ppb. Cu=9400ppm   Mo=127ppm', -32.0463913, -71.0965285),
    ('ANOM-TIL-TOO-181', 'Anomalía TOO-181 - Cu 0.94%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=9400 ppm (0.94%), Mo=127, Ag=0.15, Au=1.0 ppb. Cu=9400ppm   Mo=127ppm', -32.0463769, -71.0973965),
    ('ANOM-TIL-TOO-182', 'Anomalía TOO-182 - Cu 0.94%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=9400 ppm (0.94%), Mo=47, Ag=0.15, Au=1.0 ppb. Cu=9400ppm', -32.0495473, -71.0965687),
    ('ANOM-TIL-TOO-235', 'Anomalía TOO-235 - Cu 0.9279%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=9279 ppm (0.9279%), Mo=1, Ag=0.15, Au=1.0 ppb. Cu=9279ppm', -32.0558048, -71.096129),
    ('ANOM-TIL-TOO-194', 'Anomalía TOO-194 - Cu 0.9%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=9000 ppm (0.9%), Mo=78, Ag=0.5, Au=1.0 ppb. Cu=9000ppm', -32.0545608, -71.1042551),
    ('ANOM-TIL-TOO-192', 'Anomalía TOO-192 - Cu 0.892%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=8920 ppm (0.892%), Mo=31, Ag=0.15, Au=1.0 ppb. Cu=8920ppm', -32.0570957, -71.1036777),
    ('ANOM-TIL-TOO-116', 'Anomalía TOO-116 - Cu 0.828%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=8280 ppm (0.828%), Mo=2, Ag=1.1, Au=1.0 ppb. Cu=8280ppm', -32.0460654, -71.1188325),
    ('ANOM-TIL-TOO-267', 'Anomalía TOO-267 - Cu 0.804%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=8040 ppm (0.804%), Mo=3, Ag=0.15, Au=1.0 ppb. Cu=8040ppm', -32.0466452, -71.0926269),
    ('ANOM-TIL-TOO-268', 'Anomalía TOO-268 - Cu 0.804%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=8040 ppm (0.804%), Mo=4, Ag=0.15, Au=1.0 ppb. Cu=8040ppm', -32.0466452, -71.0926269),
    ('ANOM-TIL-TOO-229', 'Anomalía TOO-229 - Cu 0.775%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=7750 ppm (0.775%), Mo=72, Ag=0.7, Au=1.0 ppb. Cu=7750ppm', -32.057707, -71.1021667),
    ('ANOM-TIL-TOO-284', 'Anomalía TOO-284 - Cu 0.733%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=7330 ppm (0.733%), Mo=400, Ag=0.15, Au=1.0 ppb. Cu=7330ppm   Mo=400ppm', -32.0307463, -71.0444307),
    ('ANOM-TIL-TOO-285', 'Anomalía TOO-285 - Cu 0.694%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=6940 ppm (0.694%), Mo=400, Ag=0.15, Au=1.0 ppb. Cu=6940ppm   Mo=400ppm', -32.0162465, -71.0436746),
    ('ANOM-TIL-TOO-265', 'Anomalía TOO-265 - Cu 0.668%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=6680 ppm (0.668%), Mo=121, Ag=0.15, Au=1.0 ppb. Cu=6680ppm   Mo=121ppm', -32.0481541, -71.0935507),
    ('ANOM-TIL-TOO-266', 'Anomalía TOO-266 - Cu 0.668%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=6680 ppm (0.668%), Mo=4, Ag=0.15, Au=1.0 ppb. Cu=6680ppm', -32.0481541, -71.0935507),
    ('ANOM-TIL-TOO-278', 'Anomalía TOO-278 - Cu 0.6299%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=6299 ppm (0.6299%), Mo=189, Ag=0.15, Au=1.0 ppb. Cu=6299ppm   Mo=189ppm', -32.0124992, -71.0573313),
    ('ANOM-TIL-TOO-279', 'Anomalía TOO-279 - Cu 0.6299%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=6299 ppm (0.6299%), Mo=234, Ag=0.15, Au=1.0 ppb. Cu=6299ppm   Mo=234ppm', -32.0124992, -71.0573313),
    ('ANOM-TIL-TOO-200', 'Anomalía TOO-200 - Cu 0.613%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=6130 ppm (0.613%), Mo=65, Ag=0.5, Au=1.0 ppb. Cu=6130ppm   As=53ppm', -32.0527357, -71.1022753),
    ('ANOM-TIL-TOO-118', 'Anomalía TOO-118 - Cu 0.584%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=5840 ppm (0.584%), Mo=3, Ag=2.2, Au=1.0 ppb. Cu=5840ppm', -32.0424263, -71.1234076),
    ('ANOM-TIL-TOO-128', 'Anomalía TOO-128 - Cu 0.581%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 75.0, NULL, NULL, 'Cu=5810 ppm (0.581%), Mo=5, Ag=1.5, Au=1.0 ppb. Cu=5810ppm', -32.0398136, -71.1232414),
    ('ANOM-TIL-TOO-259', 'Anomalía TOO-259 - Cu 0.56%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=5600 ppm (0.56%), Mo=106, Ag=0.15, Au=1.0 ppb. Cu=5600ppm   Mo=106ppm   As=180ppm', -32.0466452, -71.0926269),
    ('ANOM-TIL-TOO-260', 'Anomalía TOO-260 - Cu 0.56%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'high', 78.0, NULL, NULL, 'Cu=5600 ppm (0.56%), Mo=130, Ag=0.15, Au=1.0 ppb. Cu=5600ppm   Mo=130ppm', -32.0580184, -71.0876965),
    ('ANOM-TIL-TOO-105', 'Anomalía TOO-105 - Cu 0.473%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 63.0, NULL, NULL, 'Cu=4730 ppm (0.473%), Mo=7, Ag=12.8, Au=1.0 ppb. Ag=12.8ppm   [ANOMALÍA ROJA]', -32.0370542, -71.1129602),
    ('ANOM-TIL-TOO-103', 'Anomalía TOO-103 - Cu 0.378%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 60.0, NULL, NULL, 'Cu=3780 ppm (0.378%), Mo=7, Ag=0.8, Au=1.0 ppb. [ANOMALÍA ROJA]', -32.039446, -71.1128563),
    ('ANOM-TIL-TOO-108', 'Anomalía TOO-108 - Cu 0.286%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 63.0, NULL, NULL, 'Cu=2860 ppm (0.286%), Mo=22, Ag=5.3, Au=1.0 ppb. Ag=5.3ppm   [ANOMALÍA ROJA]', -32.035534, -71.114884),
    ('ANOM-TIL-TOO-102', 'Anomalía TOO-102 - Cu 0.2505%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 60.0, NULL, NULL, 'Cu=2505 ppm (0.2505%), Mo=20, Ag=0.4, Au=1.0 ppb. [ANOMALÍA ROJA]', -32.0405019, -71.1133571),
    ('ANOM-TIL-TOO-242', 'Anomalía TOO-242 - Cu 0.184%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 63.0, NULL, NULL, 'Cu=1840 ppm (0.184%), Mo=111, Ag=0.15, Au=1.0 ppb. Mo=111ppm', -32.0669046, -71.1000999),
    ('ANOM-TIL-TOO-274', 'Anomalía TOO-274 - Cu 0.117%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 63.0, NULL, NULL, 'Cu=1170 ppm (0.117%), Mo=148, Ag=0.15, Au=1.0 ppb. Mo=148ppm', -32.0229194, -71.0787057),
    ('ANOM-TIL-TOO-241', 'Anomalía TOO-241 - Cu 0.088%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 50.0, NULL, NULL, 'Cu=880 ppm (0.088%), Mo=112, Ag=0.15, Au=1.0 ppb. Mo=112ppm', -32.0664423, -71.1007884),
    ('ANOM-TIL-TOO-106A', 'Anomalía TOO-106A - Cu 0.054%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 47.0, NULL, NULL, 'Cu=540 ppm (0.054%), Mo=32, Ag=0.7, Au=1.0 ppb. [ANOMALÍA ROJA]', -32.0330458, -71.1126563),
    ('ANOM-TIL-TOO-243', 'Anomalía TOO-243 - Cu 0.0438%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 50.0, NULL, NULL, 'Cu=438 ppm (0.0438%), Mo=167, Ag=0.15, Au=1.0 ppb. Mo=167ppm', -32.0678076, -71.0951319),
    ('ANOM-TIL-TOO-101', 'Anomalía TOO-101 - Cu 0.0367%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 47.0, NULL, NULL, 'Cu=367 ppm (0.0367%), Mo=4, Ag=0.15, Au=1.0 ppb. [ANOMALÍA ROJA]', -32.0404501, -71.1148382),
    ('ANOM-TIL-TOO-282', 'Anomalía TOO-282 - Cu 0.031%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 50.0, NULL, NULL, 'Cu=310 ppm (0.031%), Mo=197, Ag=0.15, Au=1.0 ppb. Mo=197ppm', -32.0091318, -71.0774417),
    ('ANOM-TIL-TOO-257', 'Anomalía TOO-257 - Cu 0.03%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 50.0, NULL, NULL, 'Cu=300 ppm (0.03%), Mo=157, Ag=0.15, Au=1.0 ppb. Mo=157ppm', -32.0357516, -71.0832309),
    ('ANOM-TIL-TOO-283', 'Anomalía TOO-283 - Cu 0.029%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 50.0, NULL, NULL, 'Cu=290 ppm (0.029%), Mo=752, Ag=0.15, Au=1.0 ppb. Mo=752ppm', -32.0091318, -71.0774417),
    ('ANOM-TIL-TOO-204', 'Anomalía TOO-204 - Cu 0.023%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 50.0, NULL, NULL, 'Cu=230 ppm (0.023%), Mo=56, Ag=9.5, Au=1.0 ppb. Ag=9.5ppm', -32.0532586, -71.1022873),
    ('ANOM-TIL-TOO-193', 'Anomalía TOO-193 - Cu 0.0109%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 50.0, NULL, NULL, 'Cu=109 ppm (0.0109%), Mo=27, Ag=60.3, Au=1.0 ppb. Ag=60.3ppm', -32.0570957, -71.1036777),
    ('ANOM-TIL-TOO-264', 'Anomalía TOO-264 - Cu 0.008%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 47.0, NULL, NULL, 'Cu=80 ppm (0.008%), Mo=65, Ag=0.15, Au=1.0 ppb. As=245ppm', -32.0198679, -71.1062138),
    ('ANOM-TIL-TOO-154', 'Anomalía TOO-154 - Cu 0.0072%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 50.0, NULL, NULL, 'Cu=72 ppm (0.0072%), Mo=131, Ag=0.15, Au=1.0 ppb. Mo=131ppm', -32.0482459, -71.1124761),
    ('ANOM-TIL-TOO-249', 'Anomalía TOO-249 - Cu 0.007%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 50.0, NULL, NULL, 'Cu=70 ppm (0.007%), Mo=292, Ag=0.15, Au=1.0 ppb. Mo=292ppm', -32.0396398, -71.0859132),
    ('ANOM-TIL-TOO-236', 'Anomalía TOO-236 - Cu 0.0052%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 50.0, NULL, NULL, 'Cu=52 ppm (0.0052%), Mo=283, Ag=0.15, Au=4.0 ppb. Mo=283ppm', -32.0558088, -71.0958855),
    ('ANOM-TIL-TOO-104', 'Anomalía TOO-104 - Cu 0.0047%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 47.0, NULL, NULL, 'Cu=47 ppm (0.0047%), Mo=5, Ag=1.5, Au=1.0 ppb. [ANOMALÍA ROJA]', -32.045665, -71.1131051),
    ('ANOM-TIL-TOO-109', 'Anomalía TOO-109 - Cu 0.0039%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 47.0, NULL, NULL, 'Cu=39 ppm (0.0039%), Mo=8, Ag=0.15, Au=1.0 ppb. [ANOMALÍA ROJA]', -32.0460229, -71.1213729),
    ('ANOM-TIL-TOO-224', 'Anomalía TOO-224 - Cu 0.0031%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 47.0, NULL, NULL, 'Cu=31 ppm (0.0031%), Mo=25, Ag=0.15, Au=1.0 ppb. As=71ppm', -32.0325197, -71.1025331),
    ('ANOM-TIL-TOO-106', 'Anomalía TOO-106 - Cu 0.0016%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 47.0, NULL, NULL, 'Cu=16 ppm (0.0016%), Mo=5, Ag=0.15, Au=1.0 ppb. [ANOMALÍA ROJA]', -32.036066, -71.1127257),
    ('ANOM-TIL-TOO-247', 'Anomalía TOO-247 - Cu 0.0016%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 50.0, NULL, NULL, 'Cu=16 ppm (0.0016%), Mo=148, Ag=0.15, Au=1.0 ppb. Mo=148ppm', -32.0617279, -71.1071517),
    ('ANOM-TIL-TOO-250', 'Anomalía TOO-250 - Cu 0.0012%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 47.0, NULL, NULL, 'Cu=12 ppm (0.0012%), Mo=16, Ag=0.15, Au=1.0 ppb. As=137ppm', -32.035975, -71.079509),
    ('ANOM-TIL-TOO-107', 'Anomalía TOO-107 - Cu 0.0008%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 47.0, NULL, NULL, 'Cu=8 ppm (0.0008%), Mo=63, Ag=0.5, Au=1.0 ppb. [ANOMALÍA ROJA]', -32.0343558, -71.1152275),
    ('ANOM-TIL-TOO-254', 'Anomalía TOO-254 - Cu 0.0008%', 'porphyry', 'Cu-Mo-Ag', 'generated', 'medium', 47.0, NULL, NULL, 'Cu=8 ppm (0.0008%), Mo=4, Ag=0.15, Au=1.0 ppb. As=180ppm', -32.0352876, -71.0873074)
  ) AS v(code, name, target_type, commodity, stage, priority, score, confidence_pct, elevation_m, rationale, lat, lng)
  ON CONFLICT (project_id, code) DO NOTHING;
END $$;
