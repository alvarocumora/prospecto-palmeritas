// LosVerdesEngine3D: motor geocientífico modular.
// - R3F Canvas con frameloop="demand" + localClippingEnabled
// - Isosurface real (Marching Cubes) en Web Worker → mesh continuo "Leapfrog-like"
// - Modo voxel (cubos instanciados) disponible vía ?render=voxel para debug
// - Drillholes reales como cilindros instanciados (UTM→ENU vía proj4)
// - Clipping planes dinámicos X/Y/Z/libre + helper visual + invert
// - DEM real triangulado con Martini (worker)
import { Canvas } from "@react-three/fiber";
import { MapControls, Stats } from "@react-three/drei";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Loader2, Settings2, Layers as LayersIcon, Scissors, Mountain, FileDown, Boxes, Upload } from "lucide-react";

import { getAnomalyPoints } from "@/engine3d/data/anomalies.functions";
import { getDrillholes, type DrillholeSegment } from "@/engine3d/data/drillholes.functions";
import { useVoxelModel, DEFAULT_VOXEL_PARAMS, type VoxelParams } from "@/engine3d/hooks/useVoxelModel";
import { useIsosurface, DEFAULT_ISO_PARAMS, type IsosurfaceParams } from "@/engine3d/hooks/useIsosurface";
import { useTerrainDEM, type TerrainQuality } from "@/engine3d/hooks/useTerrainDEM";
import { useBlockModel, DEFAULT_BLOCK_PARAMS, type BlockModelParams } from "@/engine3d/hooks/useBlockModel";
import { BlockModelLayer, DEFAULT_BLOCK_FILTERS, type BlockFilters } from "@/engine3d/layers/BlockModelLayer";
import { ResourceModelPanel } from "@/engine3d/panels/ResourceModelPanel";
import { DrillholeImportPanel } from "@/engine3d/panels/DrillholeImportPanel";
import { QAQCPanel } from "@/engine3d/panels/QAQCPanel";
import { EstimationSettingsPanel } from "@/engine3d/panels/EstimationSettingsPanel";
import { NI43101Panel } from "@/engine3d/panels/NI43101Panel";
import { AuditTrailPanel } from "@/engine3d/panels/AuditTrailPanel";
import { EngineTabsDock, type EngineTab } from "@/engine3d/panels/EngineTabsDock";
import { AIGeologistPanel } from "@/engine3d/panels/AIGeologistPanel";
import { TargetPlanningPanel } from "@/engine3d/panels/TargetPlanningPanel";
import { ReportsPanel } from "@/engine3d/panels/ReportsPanel";
import { DrillTargetLayer } from "@/engine3d/layers/DrillTargetLayer";
import { runAIGeologist, type AIInterpretation } from "@/engine3d/ai/aiGeologist";
import { useDrillTargets, DEFAULT_TARGET_PARAMS } from "@/engine3d/hooks/useDrillTargets";
import { exportTargetsCsv, downloadString, campaignCost as computeCampaignCost } from "@/engine3d/reports/reportGenerator";
import type { DrillTarget } from "@/engine3d/ai/drillTarget.worker";
import { useQAQC } from "@/engine3d/hooks/useQAQC";
import { DEFAULT_ESTIMATION, applyEstimation, type EstimationSettings } from "@/engine3d/qaqc/estimationPresets";
import { auditTrail, computeHash } from "@/engine3d/qaqc/auditTrail";
import { modelVersions } from "@/engine3d/qaqc/modelVersions";
import type { ParsedDrillholeBundle } from "@/engine3d/data/csvDrillholes";
import { useClippingPlanes, DEFAULT_CLIP_PARAMS, type ClipParams, type ClipAxis } from "@/engine3d/sections/useClippingPlanes";
import { ClippingPlaneController } from "@/engine3d/sections/ClippingPlaneController";
import { useSection } from "@/engine3d/hooks/useSection";
import { SectionViewPanel } from "@/engine3d/sections/SectionViewPanel";
import { AnomalyVoxelLayer } from "@/engine3d/layers/AnomalyVoxelLayer";
import { AnomalyIsosurfaceLayer } from "@/engine3d/layers/AnomalyIsosurfaceLayer";
import { AnomalyPointsLayer } from "@/engine3d/layers/AnomalyPointsLayer";
import { DrillholesLayer } from "@/engine3d/layers/DrillholesLayer";
import { TerrainPlane } from "@/engine3d/layers/TerrainPlane";
import { TerrainMartiniLayer } from "@/engine3d/layers/TerrainMartiniLayer";
import { DepthAxis } from "@/engine3d/layers/DepthAxis";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Props = {
  projectId: string;
  height?: number;
  renderMode?: "iso" | "voxel";
};

export function LosVerdesEngine3D({ projectId, height = 640, renderMode = "iso" }: Props) {
  const fetchPoints = useServerFn(getAnomalyPoints);
  const fetchHoles = useServerFn(getDrillholes);
  const pointsQ = useQuery({
    queryKey: ["engine3d", "anomalyPoints", projectId],
    queryFn: () => fetchPoints({ data: { projectId } }),
    staleTime: 60_000,
  });
  const holesQ = useQuery({
    queryKey: ["engine3d", "drillholes", projectId],
    queryFn: () => fetchHoles({ data: { projectId } }),
    staleTime: 60_000,
  });

  const [voxelParams, setVoxelParams] = useState<VoxelParams>(DEFAULT_VOXEL_PARAMS);
  const [isoParams, setIsoParams] = useState<IsosurfaceParams>(DEFAULT_ISO_PARAMS);
  const [clipParams, setClipParams] = useState<ClipParams>(DEFAULT_CLIP_PARAMS);
  const [opacity, setOpacity] = useState(0.6);
  const [verticalExaggeration, setVe] = useState(2);
  const [showPoints, setShowPoints] = useState(true);
  const [showSurface, setShowSurface] = useState(true);
  const [showHoles, setShowHoles] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [sectionMode, setSectionMode] = useState(false);
  const [showClipHelper, setShowClipHelper] = useState(true);
  const [demEnabled, setDemEnabled] = useState(true);
  const [demQuality, setDemQuality] = useState<TerrainQuality>("med");
  const [demWireframe, setDemWireframe] = useState(false);
  const [hoveredHole, setHoveredHole] = useState<DrillholeSegment | null>(null);
  const [sectionWidth, setSectionWidth] = useState(25);
  const [sectionTrigger, setSectionTrigger] = useState(0);
  const [showSectionPanel, setShowSectionPanel] = useState(false);
  const [followHoleId, setFollowHoleId] = useState<string | null>(null);
  const [blockParams, setBlockParams] = useState<BlockModelParams>(DEFAULT_BLOCK_PARAMS);
  const [blockFilters, setBlockFilters] = useState<BlockFilters>(DEFAULT_BLOCK_FILTERS);
  const [showBlocks, setShowBlocks] = useState(true);
  const [showResourcePanel, setShowResourcePanel] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importedBundle, setImportedBundle] = useState<ParsedDrillholeBundle | null>(null);
  const [econ, setEcon] = useState({ price: 2400, opex: 25, capex: 50_000_000, recovery: 85, discount: 0.08, years: 8 });

  // Sprint 4: estimation settings + active tab + NI 43-101 mode
  const [estimation, setEstimation] = useState<EstimationSettings>(DEFAULT_ESTIMATION);
  const [activeTab, setActiveTab] = useState<EngineTab>("viewer");
  const [ni43Mode, setNi43Mode] = useState(false);

  // Sprint 5: AI Geologist + Targets + Reports
  const [aiInterpretation, setAiInterpretation] = useState<AIInterpretation | null>(null);
  const [scenarioIds, setScenarioIds] = useState<Set<string>>(new Set());
  const [showTargets3D, setShowTargets3D] = useState(true);
  const [hoveredTarget, setHoveredTarget] = useState<DrillTarget | null>(null);

  const points = pointsQ.data?.points ?? [];
  const holes = holesQ.data?.holes ?? [];

  // Sprint 4: QA/QC sobre el bundle importado
  const qaqcInput = useMemo(() => {
    if (!importedBundle) return null;
    return {
      collars: importedBundle.collars,
      surveys: importedBundle.surveys,
      assays: importedBundle.assays,
      lithology: importedBundle.lithology,
    };
  }, [importedBundle]);
  const { result: qaqcResult, busy: qaqcBusy } = useQAQC(qaqcInput);

  // Aplicar estimation settings sobre los blockParams
  useEffect(() => {
    setBlockParams((p) => applyEstimation(p, estimation));
  }, [estimation]);

  // (block model rebuild logging — declarado más abajo, ver useEffect después de useBlockModel)

  // Log QA/QC runs
  useEffect(() => {
    if (qaqcResult) {
      auditTrail.log("qaqc.run", { summary: qaqcResult.summary });
    }
  }, [qaqcResult]);

  // Log CSV imports
  useEffect(() => {
    if (importedBundle) {
      auditTrail.log("import.csv", {
        collars: importedBundle.collars.length,
        surveys: importedBundle.surveys.length,
        assays: importedBundle.assays.length,
        lithology: importedBundle.lithology.length,
        errors: importedBundle.errors.length,
      });
    }
  }, [importedBundle]);

  const { output: iso, busy: isoBusy } = useIsosurface(
    renderMode === "iso" ? points : [],
    isoParams,
  );
  const { output: voxels, busy: voxBusy } = useVoxelModel(
    renderMode === "voxel" ? points : [],
    voxelParams,
  );
  const { output: blockModel, busy: blockBusy, error: blockError } = useBlockModel(
    blockParams.enabled ? points : [],
    blockParams,
  );
  const { mesh: demMesh, busy: demBusy, loading: demLoading } = useTerrainDEM(
    projectId,
    demEnabled,
    demQuality,
    verticalExaggeration,
    4000,
  );

  // Sprint 5: Drill target ranking (worker)
  const existingCollars = useMemo(
    () => holes.map((h) => ({ x: h.collar.x, y: h.collar.y, z: h.collar.z })),
    [holes],
  );
  const targetParams = useMemo(() => {
    const critical = qaqcResult?.summary.critical ?? 0;
    const penalty = critical > 0 ? Math.max(0.4, 1 - critical * 0.1) : 1;
    return { ...DEFAULT_TARGET_PARAMS, qaqcPenalty: penalty };
  }, [qaqcResult]);
  const { output: drillTargets, busy: targetsBusy } = useDrillTargets(
    points,
    existingCollars,
    targetParams,
    points.length > 0,
  );

  // Sprint 5: log drill target generation
  useEffect(() => {
    if (drillTargets) {
      auditTrail.log("blockmodel.build", {
        kind: "drill.targets",
        selected: drillTargets.stats.selected,
        aPriority: drillTargets.stats.aPriority,
      });
    }
  }, [drillTargets]);


  // Sprint 4: log block model rebuilds + versionado (después de useBlockModel)
  useEffect(() => {
    if (!blockModel) return;
    const inputHash = computeHash({
      n: points.length,
      blockSize: blockModel.blockSize,
      commodity: blockModel.commodity,
    });
    const summary = {
      blocks: blockModel.count,
      tonnes: blockModel.stats.tonnesTotal,
      gradeMean: blockModel.stats.gradeMean,
      metalContent: blockModel.stats.metalTotal,
      cutoff: blockFilters.cutoff,
      measured: blockModel.stats.measured,
      indicated: blockModel.stats.indicated,
      inferred: blockModel.stats.inferred,
    };
    const v = modelVersions.push({ inputHash, settings: blockParams, summary });
    auditTrail.log("blockmodel.build", { modelId: v.modelId, summary });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockModel]);

  // Section mode = clipping forzado activo
  const effectiveClip = useMemo<ClipParams>(
    () => (sectionMode ? { ...clipParams, enabled: true } : clipParams),
    [sectionMode, clipParams],
  );
  const clippingPlanes = useClippingPlanes(effectiveClip);

  // Plano en formato sectionEngine (normal three + constant THREE.Plane: n·p + c = 0)
  const planeNormal = useMemo(() => {
    const ax = effectiveClip.axis;
    let n =
      ax === "x" ? { x: 1, y: 0, z: 0 } :
      ax === "y" ? { x: 0, y: 1, z: 0 } :
      ax === "z" ? { x: 0, y: 0, z: 1 } :
      { ...(effectiveClip.freeNormal ?? { x: 1, y: 0, z: 0 }) };
    if (effectiveClip.invert) n = { x: -n.x, y: -n.y, z: -n.z };
    const len = Math.hypot(n.x, n.y, n.z) || 1;
    return { x: n.x / len, y: n.y / len, z: n.z / len };
  }, [effectiveClip.axis, effectiveClip.invert, effectiveClip.freeNormal]);
  const planeConstant = -effectiveClip.position;

  // Section engine — auto-recalcula al cambiar plano/ancho/datasets o trigger manual
  const section = useSection({
    iso,
    terrain: demMesh ?? null,
    holes,
    samples: points,
    planeNormal,
    planeConstant,
    width: sectionWidth,
    verticalExaggeration,
    trigger: sectionTrigger,
  });

  // Follow drillhole: alinea plano de corte al azimut del sondaje (perpendicular a azimut).
  useEffect(() => {
    if (!followHoleId) return;
    const h = holes.find((x) => x.holeId === followHoleId);
    if (!h) return;
    const azRad = (h.azimuth * Math.PI) / 180;
    // dirección horizontal del sondaje en three: (sin(az), 0, -cos(az))
    // normal del plano que contiene la traza vertical: cross(dir, up) = (cos(az), 0, sin(az))
    const nx = Math.cos(azRad);
    const nz = Math.sin(azRad);
    // collar en three
    const cx = h.collar.x;
    const cy = h.collar.z * verticalExaggeration;
    const cz = -h.collar.y;
    const position = nx * cx + 0 * cy + nz * cz;
    setClipParams((p) => ({
      ...p,
      enabled: true,
      axis: "free",
      freeNormal: { x: nx, y: 0, z: nz },
      position,
      invert: false,
    }));
    setSectionMode(true);
    setShowSectionPanel(true);
  }, [followHoleId, holes, verticalExaggeration]);

  const cameraInitial = useMemo<[number, number, number]>(() => [2400, 1800, 2400], []);
  const busy = (renderMode === "iso" ? isoBusy : voxBusy) || demBusy;

  const resolution = renderMode === "iso" ? isoParams.resolution : voxelParams.resolution;
  const isovalue = renderMode === "iso" ? isoParams.isovalue : voxelParams.isovalue;
  const setResolution = (v: number) =>
    renderMode === "iso"
      ? setIsoParams((p) => ({ ...p, resolution: v }))
      : setVoxelParams((p) => ({ ...p, resolution: v }));
  const setIsovalue = (v: number) =>
    renderMode === "iso"
      ? setIsoParams((p) => ({ ...p, isovalue: v }))
      : setVoxelParams((p) => ({ ...p, isovalue: v }));

  // Rango razonable de posición del plano según eje
  const planeRange = effectiveClip.axis === "y" ? 800 : 3000;

  return (
    <div
      className="relative w-full rounded-lg border border-border overflow-hidden bg-[#08090c]"
      style={{ height }}
    >
      {/* HUD top-left */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5 max-w-[300px] max-h-[calc(100%-1rem)] overflow-y-auto pr-1">
        <div className="bg-black/70 backdrop-blur rounded-md px-3 py-2 text-[10px] font-mono text-foreground/90 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <LayersIcon className="w-3 h-3 text-orange-400" />
            <span className="uppercase tracking-wider text-orange-300">
              Engine 3D · {renderMode === "iso" ? "marching cubes" : "voxel cubes"}
            </span>
          </div>
          {pointsQ.isLoading ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> cargando puntos…
            </div>
          ) : (
            <div className="text-muted-foreground space-y-0.5">
              <div>{pointsQ.data?.stats.count ?? 0} anomalías · {holes.length} sondajes</div>
              {renderMode === "iso" && iso && (
                <div>
                  field {iso.resolution}³ ·{" "}
                  <span className="text-orange-300">{iso.triangleCount.toLocaleString()}</span> tri
                </div>
              )}
              {renderMode === "voxel" && voxels && (
                <div>
                  voxel {voxelParams.resolution}³ · activas:{" "}
                  <span className="text-orange-300">{voxels.activeCount}</span>
                </div>
              )}
              {demMesh && (
                <div>
                  DEM {demQuality} ·{" "}
                  <span className="text-emerald-300">
                    {demMesh.triangleCount.toLocaleString()}
                  </span>{" "}
                  tri
                </div>
              )}
              {(busy || demLoading) && (
                <div className="flex items-center gap-1.5 text-amber-300">
                  <Loader2 className="w-3 h-3 animate-spin" /> calculando…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Anomalías */}
        <div className="bg-black/70 backdrop-blur rounded-md px-3 py-2 text-[10px] font-mono text-foreground/90 border border-border space-y-2.5">
          <div className="flex items-center gap-2">
            <Settings2 className="w-3 h-3 text-gold" />
            <span className="uppercase tracking-wider text-gold">anomalías</span>
          </div>
          <div>
            <Label className="text-[9px] uppercase">Isovalue · {isovalue.toFixed(2)}</Label>
            <Slider min={0.1} max={0.95} step={0.05} value={[isovalue]} onValueChange={([v]) => setIsovalue(v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[9px] uppercase">Resolución · {resolution}³</Label>
            <Slider min={16} max={renderMode === "iso" ? 96 : 72} step={renderMode === "iso" ? 8 : 4} value={[resolution]} onValueChange={([v]) => setResolution(v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[9px] uppercase">Opacidad · {opacity.toFixed(2)}</Label>
            <Slider min={0.1} max={1} step={0.05} value={[opacity]} onValueChange={([v]) => setOpacity(v)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[9px] uppercase">Exag. vertical · {verticalExaggeration.toFixed(1)}×</Label>
            <Slider min={0.5} max={5} step={0.5} value={[verticalExaggeration]} onValueChange={([v]) => setVe(v)} className="mt-1" />
          </div>
        </div>

        {/* Clipping / sección */}
        <div className="bg-black/70 backdrop-blur rounded-md px-3 py-2 text-[10px] font-mono text-foreground/90 border border-border space-y-2.5">
          <div className="flex items-center gap-2">
            <Scissors className="w-3 h-3 text-cyan-300" />
            <span className="uppercase tracking-wider text-cyan-300">sección / clipping</span>
          </div>
          <ToggleRow label="Section Mode" value={sectionMode} onChange={setSectionMode} />
          <ToggleRow
            label="Clipping activo"
            value={clipParams.enabled || sectionMode}
            onChange={(v) => setClipParams((p) => ({ ...p, enabled: v }))}
          />
          <div>
            <Label className="text-[9px] uppercase">Eje</Label>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {(["x", "y", "z", "free"] as ClipAxis[]).map((ax) => (
                <Button
                  key={ax}
                  size="sm"
                  variant={effectiveClip.axis === ax ? "default" : "outline"}
                  className="h-6 text-[10px] px-1"
                  onClick={() => setClipParams((p) => ({ ...p, axis: ax }))}
                >
                  {ax.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[9px] uppercase">
              Posición · {effectiveClip.position.toFixed(0)} m
            </Label>
            <Slider
              min={-planeRange}
              max={planeRange}
              step={10}
              value={[effectiveClip.position]}
              onValueChange={([v]) => setClipParams((p) => ({ ...p, position: v }))}
              className="mt-1"
            />
          </div>
          <ToggleRow
            label="Invert clipping"
            value={effectiveClip.invert}
            onChange={(v) => setClipParams((p) => ({ ...p, invert: v }))}
          />
          <ToggleRow label="Helper visual" value={showClipHelper} onChange={setShowClipHelper} />
        </div>

        {/* Section export / corte 2D */}
        <div className="bg-black/70 backdrop-blur rounded-md px-3 py-2 text-[10px] font-mono text-foreground/90 border border-border space-y-2.5">
          <div className="flex items-center gap-2">
            <FileDown className="w-3 h-3 text-fuchsia-300" />
            <span className="uppercase tracking-wider text-fuchsia-300">section view</span>
          </div>
          <div>
            <Label className="text-[9px] uppercase">Corredor · ±{(sectionWidth / 2).toFixed(0)} m</Label>
            <div className="grid grid-cols-5 gap-1 mt-1">
              {[5, 10, 25, 50, 100].map((w) => (
                <Button
                  key={w}
                  size="sm"
                  variant={sectionWidth === w ? "default" : "outline"}
                  className="h-6 text-[10px] px-1"
                  onClick={() => setSectionWidth(w)}
                >
                  {w}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[9px] uppercase">Follow drillhole</Label>
            <select
              className="mt-1 w-full bg-black/60 border border-border rounded px-1.5 py-1 text-[10px] font-mono"
              value={followHoleId ?? ""}
              onChange={(e) => setFollowHoleId(e.target.value || null)}
            >
              <option value="">— ninguno —</option>
              {holes.map((h) => (
                <option key={h.holeId} value={h.holeId}>
                  {h.holeId} · {h.azimuth.toFixed(0)}°/{h.dip.toFixed(0)}°
                </option>
              ))}
            </select>
          </div>
          {section.result && (
            <div className="text-muted-foreground text-[9px] leading-tight">
              {section.result.stats.holesIntersected} sondajes ·{" "}
              {section.result.stats.samplesInSlab} muestras ·{" "}
              {section.result.anomalySegments.length} segs · {section.result.stats.elapsedMs.toFixed(0)} ms
              {section.busy && " · calculando…"}
            </div>
          )}
          <div className="grid grid-cols-2 gap-1">
            <Button
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => {
                setShowSectionPanel(true);
                setSectionTrigger((n) => n + 1);
              }}
              disabled={section.busy}
            >
              Generate
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px]"
              onClick={() => {
                setShowSectionPanel(false);
                setFollowHoleId(null);
                section.reset();
              }}
            >
              Reset
            </Button>
          </div>
        </div>


        {/* Terreno DEM */}
        <div className="bg-black/70 backdrop-blur rounded-md px-3 py-2 text-[10px] font-mono text-foreground/90 border border-border space-y-2.5">
          <div className="flex items-center gap-2">
            <Mountain className="w-3 h-3 text-emerald-300" />
            <span className="uppercase tracking-wider text-emerald-300">DEM · martini</span>
          </div>
          <ToggleRow label="DEM activo" value={demEnabled} onChange={setDemEnabled} />
          <div>
            <Label className="text-[9px] uppercase">Calidad</Label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {(["low", "med", "high"] as TerrainQuality[]).map((q) => (
                <Button
                  key={q}
                  size="sm"
                  variant={demQuality === q ? "default" : "outline"}
                  className="h-6 text-[10px] px-1"
                  onClick={() => setDemQuality(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
          <ToggleRow label="Wireframe" value={demWireframe} onChange={setDemWireframe} />
        </div>

        {/* Block model */}
        <div className="bg-black/70 backdrop-blur rounded-md px-3 py-2 text-[10px] font-mono text-foreground/90 border border-border space-y-2.5">
          <div className="flex items-center gap-2">
            <Boxes className="w-3 h-3 text-amber-300" />
            <span className="uppercase tracking-wider text-amber-300">block model</span>
          </div>
          <ToggleRow
            label="Engine activo"
            value={blockParams.enabled}
            onChange={(v) => setBlockParams((p) => ({ ...p, enabled: v }))}
          />
          {blockParams.enabled && (
            <>
              <div>
                <Label className="text-[9px] uppercase">Block size · {blockParams.blockSize} m</Label>
                <Slider
                  min={10} max={100} step={5}
                  value={[blockParams.blockSize]}
                  onValueChange={([v]) => setBlockParams((p) => ({ ...p, blockSize: v }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[9px] uppercase">Commodity</Label>
                <div className="grid grid-cols-4 gap-1 mt-1">
                  {(["au", "ag", "cu", "fe"] as const).map((c) => (
                    <Button
                      key={c}
                      size="sm"
                      variant={blockParams.commodity === c ? "default" : "outline"}
                      className="h-6 text-[10px] px-1"
                      onClick={() => setBlockParams((p) => ({ ...p, commodity: c }))}
                    >
                      {c.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-[9px] uppercase">
                  Grade scale · 0..1 → {blockParams.gradeScale} {blockParams.commodity === "au" || blockParams.commodity === "ag" ? "g/t" : "%"}
                </Label>
                <Slider
                  min={0.5} max={20} step={0.5}
                  value={[blockParams.gradeScale]}
                  onValueChange={([v]) => setBlockParams((p) => ({ ...p, gradeScale: v }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[9px] uppercase">Search radius · {blockParams.searchRadius} m</Label>
                <Slider
                  min={20} max={500} step={10}
                  value={[blockParams.searchRadius]}
                  onValueChange={([v]) => setBlockParams((p) => ({ ...p, searchRadius: v }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[9px] uppercase">
                  Cutoff · {blockFilters.cutoff.toFixed(2)} {blockParams.commodity === "au" || blockParams.commodity === "ag" ? "g/t" : "%"}
                </Label>
                <Slider
                  min={0} max={Math.max(2, blockParams.gradeScale)} step={0.05}
                  value={[blockFilters.cutoff]}
                  onValueChange={([v]) => setBlockFilters((f) => ({ ...f, cutoff: v }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[9px] uppercase">Confianza mín · {(blockFilters.minConfidence * 100).toFixed(0)}%</Label>
                <Slider
                  min={0} max={1} step={0.05}
                  value={[blockFilters.minConfidence]}
                  onValueChange={([v]) => setBlockFilters((f) => ({ ...f, minConfidence: v }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[9px] uppercase">
                  Depth · {blockFilters.minDepth}–{blockFilters.maxDepth} m
                </Label>
                <Slider
                  min={0} max={1000} step={25}
                  value={[blockFilters.minDepth, blockFilters.maxDepth]}
                  onValueChange={([a, b]) => setBlockFilters((f) => ({ ...f, minDepth: a, maxDepth: b }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-[9px] uppercase">Color por</Label>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  {(["grade", "classification", "confidence"] as const).map((m) => (
                    <Button
                      key={m}
                      size="sm"
                      variant={blockFilters.colorBy === m ? "default" : "outline"}
                      className="h-6 text-[10px] px-1"
                      onClick={() => setBlockFilters((f) => ({ ...f, colorBy: m }))}
                    >
                      {m === "classification" ? "class" : m === "confidence" ? "conf" : "grade"}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-[9px] uppercase">Opacidad · {blockFilters.opacity.toFixed(2)}</Label>
                <Slider
                  min={0.1} max={1} step={0.05}
                  value={[blockFilters.opacity]}
                  onValueChange={([v]) => setBlockFilters((f) => ({ ...f, opacity: v }))}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-3 gap-1">
                <ClassChip
                  label="MEAS"
                  active={blockFilters.showMeasured}
                  onClick={() => setBlockFilters((f) => ({ ...f, showMeasured: !f.showMeasured }))}
                  color="bg-green-500/70"
                />
                <ClassChip
                  label="IND"
                  active={blockFilters.showIndicated}
                  onClick={() => setBlockFilters((f) => ({ ...f, showIndicated: !f.showIndicated }))}
                  color="bg-yellow-500/70"
                />
                <ClassChip
                  label="INF"
                  active={blockFilters.showInferred}
                  onClick={() => setBlockFilters((f) => ({ ...f, showInferred: !f.showInferred }))}
                  color="bg-red-500/70"
                />
              </div>
              {blockError && (
                <div className="text-[9px] text-amber-300">{blockError}</div>
              )}
              {blockModel && (
                <div className="text-muted-foreground text-[9px] leading-tight">
                  {blockModel.count.toLocaleString()} bloques · medias {blockModel.stats.gradeMean.toFixed(2)} ·{" "}
                  {(blockModel.stats.tonnesTotal / 1_000_000).toFixed(2)} Mt · {blockModel.stats.elapsedMs.toFixed(0)} ms
                  {blockBusy && " · calc…"}
                </div>
              )}
              <div className="grid grid-cols-2 gap-1">
                <Button
                  size="sm"
                  className="h-7 text-[10px]"
                  disabled={!blockModel}
                  onClick={() => setShowResourcePanel(true)}
                >
                  Resource KPI
                </Button>
                <ToggleRow label="Visible" value={showBlocks} onChange={setShowBlocks} />
              </div>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-[10px] mt-1"
            onClick={() => setShowImportPanel(true)}
          >
            <Upload className="w-3 h-3 mr-1" /> Import CSV holes
          </Button>
          {importedBundle && (
            <div className="text-[9px] text-emerald-300">
              ✓ {importedBundle.collars.length} collars · {importedBundle.assays.length} assays importados
            </div>
          )}
        </div>

        <div className="bg-black/70 backdrop-blur rounded-md px-3 py-2 text-[10px] font-mono text-foreground/90 border border-border space-y-1.5">
          <ToggleRow label={renderMode === "iso" ? "Isosurface" : "Voxel cubes"} value={showSurface} onChange={setShowSurface} />
          <ToggleRow label="Sondajes" value={showHoles} onChange={setShowHoles} />
          <ToggleRow label="Puntos crudos" value={showPoints} onChange={setShowPoints} />
          <ToggleRow label="Grid fallback" value={showGrid} onChange={setShowGrid} />
          <ToggleRow label="FPS" value={showStats} onChange={setShowStats} />
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-[10px] mt-1"
            onClick={() => {
              setIsoParams(DEFAULT_ISO_PARAMS);
              setVoxelParams(DEFAULT_VOXEL_PARAMS);
              setClipParams(DEFAULT_CLIP_PARAMS);
              setSectionMode(false);
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {hoveredHole && (
        <div className="absolute top-2 right-2 z-10 bg-black/85 backdrop-blur rounded-md px-3 py-2 text-[10px] font-mono border border-gold/40 max-w-[240px]">
          <div className="text-gold uppercase tracking-wider mb-1">{hoveredHole.holeId}</div>
          <div className="text-muted-foreground space-y-0.5">
            <div>azimuth: <span className="text-foreground">{hoveredHole.azimuth.toFixed(0)}°</span></div>
            <div>dip: <span className="text-foreground">{hoveredHole.dip.toFixed(0)}°</span></div>
            <div>profundidad: <span className="text-foreground">{hoveredHole.depth.toFixed(0)} m</span></div>
            {hoveredHole.status && <div>estado: <span className="text-foreground">{hoveredHole.status}</span></div>}
            {hoveredHole.isAi && <div className="text-cyan-300">target IA</div>}
          </div>
        </div>
      )}

      <div className="absolute bottom-2 right-2 z-10 bg-black/70 backdrop-blur rounded-md px-3 py-2 text-[10px] font-mono border border-border">
        <div className="uppercase tracking-wider text-muted-foreground mb-1">leyenda</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-gradient-to-r from-purple-900 via-orange-500 to-amber-200" /> intensidad geo</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-400" /> anomalía geofísica</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-400" /> anomalía satelital</div>
        <div className="flex items-center gap-2"><span className="w-1.5 h-3 rounded-sm bg-amber-400" /> sondaje</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[#6b5a44]" /> terreno DEM</div>
      </div>

      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: cameraInitial, fov: 45, near: 1, far: 50_000, up: [0, 1, 0] }}
        shadows={false}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
      >
        <color attach="background" args={[0x08090c]} />
        <fog attach="fog" args={[0x08090c, 3500, 12000]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[1500, 2500, 1500]} intensity={0.95} />
        <directionalLight position={[-1500, 1200, -1500]} intensity={0.45} />

        <Suspense fallback={null}>
          {demEnabled && demMesh ? (
            <TerrainMartiniLayer
              mesh={demMesh}
              clippingPlanes={clippingPlanes}
              wireframe={demWireframe}
            />
          ) : (
            showGrid && <TerrainPlane size={4000} />
          )}
          <DepthAxis maxDepth={400} verticalExaggeration={verticalExaggeration} />
          {showPoints && <AnomalyPointsLayer points={points} verticalExaggeration={verticalExaggeration} />}
          {showSurface && renderMode === "iso" && iso && iso.vertexCount > 0 && (
            <AnomalyIsosurfaceLayer
              iso={iso}
              opacity={opacity}
              verticalExaggeration={verticalExaggeration}
              clippingPlanes={clippingPlanes}
            />
          )}
          {showSurface && renderMode === "voxel" && voxels && voxels.activeCount > 0 && (
            <AnomalyVoxelLayer
              voxels={voxels}
              opacity={opacity}
              verticalExaggeration={verticalExaggeration}
            />
          )}
          {showHoles && holes.length > 0 && (
            <DrillholesLayer
              holes={holes}
              verticalExaggeration={verticalExaggeration}
              onHover={setHoveredHole}
              clippingPlanes={clippingPlanes}
            />
          )}
          {showBlocks && blockParams.enabled && blockModel && blockModel.count > 0 && (
            <BlockModelLayer
              model={blockModel}
              filters={blockFilters}
              verticalExaggeration={verticalExaggeration}
              clippingPlanes={clippingPlanes}
            />
          )}
          {showClipHelper && <ClippingPlaneController params={effectiveClip} size={4500} />}
          {showTargets3D && drillTargets && drillTargets.targets.length > 0 && (
            <DrillTargetLayer
              targets={drillTargets.targets}
              verticalExaggeration={verticalExaggeration}
              clippingPlanes={clippingPlanes}
              onHover={setHoveredTarget}
            />
          )}
        </Suspense>

        <MapControls
          enableDamping
          dampingFactor={0.08}
          minDistance={300}
          maxDistance={10_000}
          maxPolarAngle={Math.PI / 2.05}
        />
        {showStats && <Stats className="!left-auto !right-2 !top-2" />}
      </Canvas>

      {pointsQ.data && pointsQ.data.points.length === 0 && holes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/80 px-4 py-3 rounded-md text-[11px] font-mono text-amber-300 border border-amber-500/40">
            Sin anomalías ni sondajes para este proyecto.
          </div>
        </div>
      )}

      {showSectionPanel && (
        <SectionViewPanel
          result={section.result}
          busy={section.busy}
          onClose={() => setShowSectionPanel(false)}
          onFollowHole={(id) => setFollowHoleId(id)}
          followHoleId={followHoleId}
        />
      )}


      {showResourcePanel && blockModel && (
        <ResourceModelPanel
          model={blockModel}
          filters={blockFilters}
          price={econ.price}
          opex={econ.opex}
          capex={econ.capex}
          recovery={econ.recovery}
          discount={econ.discount}
          years={econ.years}
          onClose={() => setShowResourcePanel(false)}
        />
      )}

      {showImportPanel && (
        <DrillholeImportPanel
          onClose={() => setShowImportPanel(false)}
          onImport={(b) => setImportedBundle(b)}
        />
      )}

      {/* Sprint 4: Tabs dock */}
      <EngineTabsDock
        active={activeTab}
        onChange={(t) => {
          setActiveTab(t);
          if (t === "section") setShowSectionPanel(true);
          if (t === "resource") setShowResourcePanel(true);
          if (t === "ni43101") setNi43Mode(true);
          if (t === "viewer") {
            setShowSectionPanel(false);
            setShowResourcePanel(false);
            setNi43Mode(false);
          }
        }}
        badges={{
          qaqc: qaqcResult?.summary.critical || qaqcResult?.summary.warning || undefined,
          ni43101: ni43Mode ? "ON" : undefined,
          targets: drillTargets?.stats.aPriority || undefined,
          ai: aiInterpretation ? aiInterpretation.upside.slice(0, 3).toUpperCase() : undefined,
        }}
      />

      {hoveredTarget && (
        <div className="absolute bottom-2 left-2 z-20 bg-black/85 backdrop-blur rounded-md px-3 py-2 text-[10px] font-mono border border-cyan-500/40 max-w-[260px]">
          <div className="text-cyan-200 uppercase tracking-wider mb-1">
            {hoveredTarget.targetId} · {hoveredTarget.priority}
          </div>
          <div className="text-muted-foreground space-y-0.5">
            <div>score: <span className="text-foreground">{(hoveredTarget.score * 100).toFixed(0)}</span></div>
            <div>depth: <span className="text-foreground">{hoveredTarget.depth.toFixed(0)} m</span></div>
            <div>cost: <span className="text-foreground">${(hoveredTarget.estimatedCost / 1000).toFixed(0)}k</span></div>
            <div className="text-[9px] pt-1">{hoveredTarget.rationale[0]}</div>
          </div>
        </div>
      )}

      {activeTab === "qaqc" && (
        <QAQCPanel result={qaqcResult} busy={qaqcBusy} onClose={() => setActiveTab("viewer")} />
      )}
      {activeTab === "estimation" && (
        <EstimationSettingsPanel
          value={estimation}
          onChange={setEstimation}
          onClose={() => setActiveTab("viewer")}
        />
      )}
      {activeTab === "ni43101" && (
        <NI43101Panel
          projectId={projectId}
          model={blockModel}
          params={blockParams}
          estimation={estimation}
          qaqc={qaqcResult}
          bundle={importedBundle}
          econ={econ}
          onClose={() => {
            setActiveTab("viewer");
            setNi43Mode(false);
          }}
        />
      )}
      {activeTab === "audit" && (
        <AuditTrailPanel onClose={() => setActiveTab("viewer")} />
      )}
      {activeTab === "ai" && (
        <AIGeologistPanel
          interpretation={aiInterpretation}
          onRegenerate={() => {
            const i = runAIGeologist({
              points,
              holes,
              blockModel: blockModel ?? null,
              qaqc: qaqcResult,
              bundle: importedBundle,
            });
            setAiInterpretation(i);
            auditTrail.log("ni43101.snapshot", { kind: "ai.interpretation", headline: i.headline, upside: i.upside });
          }}
          onClose={() => setActiveTab("viewer")}
        />
      )}
      {activeTab === "targets" && (
        <TargetPlanningPanel
          output={drillTargets}
          busy={targetsBusy}
          scenarioIds={scenarioIds}
          onToggleScenario={(id) => {
            setScenarioIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
            auditTrail.log("preset.save", { kind: "scenario.toggle", targetId: id });
          }}
          onExportCsv={(targets) => {
            downloadString(
              `drill-plan-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`,
              exportTargetsCsv(targets),
              "text/csv",
            );
            auditTrail.log("section.export", { kind: "drill.plan.csv", count: targets.length });
          }}
          onGenerateInvestorSummary={() => setActiveTab("reports")}
          onClose={() => setActiveTab("viewer")}
        />
      )}
      {activeTab === "reports" && (
        <ReportsPanel
          input={{
            projectId,
            ai: aiInterpretation,
            blockModel: blockModel ?? null,
            qaqc: qaqcResult,
            bundle: importedBundle,
            targets: drillTargets,
            scenarioTargets: (drillTargets?.targets ?? []).filter((t) => scenarioIds.has(t.targetId)),
            econ,
            campaignCost: computeCampaignCost(
              (drillTargets?.targets ?? []).filter((t) => scenarioIds.has(t.targetId)),
            ),
          }}
          onClose={() => setActiveTab("viewer")}
        />
      )}
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px]">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function ClassChip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1 h-6 rounded text-[9px] uppercase border ${
        active ? "border-amber-400/60 text-foreground" : "border-border/40 text-muted-foreground opacity-60"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-sm ${color}`} />
      {label}
    </button>
  );
}

