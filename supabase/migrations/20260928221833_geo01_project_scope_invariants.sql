-- GEO-01 delta: invariantes de aislamiento por proyecto para la capa de
-- evidencia geocientífica unificada + vocabulario del Mining Asset Graph.
--
-- Contexto: 20260927180000_geoscience_evidence_foundation.sql ya conecta
-- satellite_anomalies.target_id, satellite_evidence.exploration_target_id y
-- target_scores.target_id a exploration_targets (el target canónico). Esos
-- FKs simples garantizan que el target referenciado EXISTE, pero no que
-- pertenezca al MISMO proyecto que la evidencia/score que lo referencia.
-- Lo mismo aplica a geophysics_anomalies.target_id y a
-- mining_asset_edges.from_node_id/to_node_id contra mining_asset_nodes.
--
-- RLS (is_project_member) protege el acceso normal, pero una service/secret
-- key —o un bug de aplicación— puede saltarse RLS y no un FK. Este archivo
-- agrega FKs COMPUESTOS (id, project_id) para que la integridad de "mismo
-- proyecto" quede garantizada por la base de datos, no solo por políticas.
--
-- Todas las constraints se agregan NOT VALID: no bloquean escrituras nuevas
-- inconsistentes desde ya, pero NO fuerzan un escaneo completo de filas
-- históricas en este mismo deploy. La validación de datos preexistentes
-- (ALTER TABLE ... VALIDATE CONSTRAINT ...) se deja para un paso posterior,
-- después de correr las queries de auditoría documentadas en
-- docs/geoscience-evidence-foundation.md contra la base viva.

-- ============================================================
-- 1) Llaves (id, project_id) para permitir referenciarlas desde FKs
--    compuestos. UNIQUE(id, project_id) es redundante con la PK (id) para
--    unicidad, pero es lo que Postgres exige para poder apuntar un FK
--    compuesto a esas dos columnas.
-- ============================================================
ALTER TABLE public.exploration_targets
  ADD CONSTRAINT exploration_targets_id_project_key UNIQUE (id, project_id);

ALTER TABLE public.mining_asset_nodes
  ADD CONSTRAINT mining_asset_nodes_id_project_key UNIQUE (id, project_id);

-- ============================================================
-- 2) Evidencia/score -> target del MISMO proyecto
-- ============================================================
ALTER TABLE public.satellite_anomalies
  ADD CONSTRAINT satellite_anomalies_target_project_fk
  FOREIGN KEY (target_id, project_id)
  REFERENCES public.exploration_targets (id, project_id)
  NOT VALID;

ALTER TABLE public.satellite_evidence
  ADD CONSTRAINT satellite_evidence_target_project_fk
  FOREIGN KEY (exploration_target_id, project_id)
  REFERENCES public.exploration_targets (id, project_id)
  NOT VALID;

ALTER TABLE public.geophysics_anomalies
  ADD CONSTRAINT geophysics_anomalies_target_project_fk
  FOREIGN KEY (target_id, project_id)
  REFERENCES public.exploration_targets (id, project_id)
  NOT VALID;

ALTER TABLE public.target_scores
  ADD CONSTRAINT target_scores_target_project_fk
  FOREIGN KEY (target_id, project_id)
  REFERENCES public.exploration_targets (id, project_id)
  NOT VALID;

-- ============================================================
-- 3) Mining Asset Graph: un edge no puede unir nodos de proyectos distintos
-- ============================================================
ALTER TABLE public.mining_asset_edges
  ADD CONSTRAINT mining_asset_edges_from_project_fk
  FOREIGN KEY (from_node_id, project_id)
  REFERENCES public.mining_asset_nodes (id, project_id)
  NOT VALID;

ALTER TABLE public.mining_asset_edges
  ADD CONSTRAINT mining_asset_edges_to_project_fk
  FOREIGN KEY (to_node_id, project_id)
  REFERENCES public.mining_asset_nodes (id, project_id)
  NOT VALID;

-- ============================================================
-- 4) Mining Asset Graph: vocabulario para evidencia geocientífica unificada.
--    El CHECK inline original no incluye estos tres node_type; se agregan
--    para que el grafo pueda representar
--    dataset -> anomaly -> evidence -> target sin otra migración.
-- ============================================================
ALTER TABLE public.mining_asset_nodes
  DROP CONSTRAINT mining_asset_nodes_node_type_check;

ALTER TABLE public.mining_asset_nodes
  ADD CONSTRAINT mining_asset_nodes_node_type_check CHECK (node_type IN (
    'project','concession','target','geological_body','sample','assay','drillhole',
    'geophysics_dataset','geochemistry_dataset','interpretation','resource_model',
    'economic_model','investment_asset','production_batch','commodity_lot','mineral_passport',
    'remote_sensing_dataset','anomaly','evidence'
  ));

COMMENT ON CONSTRAINT satellite_anomalies_target_project_fk ON public.satellite_anomalies IS
  'Invariante de aislamiento: target_id, cuando existe, debe pertenecer al mismo project_id. NOT VALID — pendiente VALIDATE CONSTRAINT tras auditar filas históricas.';
COMMENT ON CONSTRAINT satellite_evidence_target_project_fk ON public.satellite_evidence IS
  'Invariante de aislamiento: exploration_target_id, cuando existe, debe pertenecer al mismo project_id. NOT VALID — pendiente VALIDATE CONSTRAINT tras auditar filas históricas.';
COMMENT ON CONSTRAINT geophysics_anomalies_target_project_fk ON public.geophysics_anomalies IS
  'Invariante de aislamiento: target_id, cuando existe, debe pertenecer al mismo project_id. NOT VALID — pendiente VALIDATE CONSTRAINT tras auditar filas históricas.';
COMMENT ON CONSTRAINT target_scores_target_project_fk ON public.target_scores IS
  'Invariante de aislamiento: target_id debe pertenecer al mismo project_id que el score. NOT VALID — pendiente VALIDATE CONSTRAINT tras auditar filas históricas.';
COMMENT ON CONSTRAINT mining_asset_edges_from_project_fk ON public.mining_asset_edges IS
  'Invariante de aislamiento: from_node_id debe pertenecer al mismo project_id que el edge. NOT VALID — pendiente VALIDATE CONSTRAINT tras auditar filas históricas.';
COMMENT ON CONSTRAINT mining_asset_edges_to_project_fk ON public.mining_asset_edges IS
  'Invariante de aislamiento: to_node_id debe pertenecer al mismo project_id que el edge. NOT VALID — pendiente VALIDATE CONSTRAINT tras auditar filas históricas.';
