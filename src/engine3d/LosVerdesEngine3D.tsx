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
import { Suspense, useMemo, useState } from "react";
import { Loader2, Settings2, Layers as LayersIcon, Scissors, Mountain } from "lucide-react";

import { getAnomalyPoints } from "@/engine3d/data/anomalies.functions";
import { getDrillholes, type DrillholeSegment } from "@/engine3d/data/drillholes.functions";
import { useVoxelModel, DEFAULT_VOXEL_PARAMS, type VoxelParams } from "@/engine3d/hooks/useVoxelModel";
import { useIsosurface, DEFAULT_ISO_PARAMS, type IsosurfaceParams } from "@/engine3d/hooks/useIsosurface";
import { useTerrainDEM, type TerrainQuality } from "@/engine3d/hooks/useTerrainDEM";
import { useClippingPlanes, DEFAULT_CLIP_PARAMS, type ClipParams, type ClipAxis } from "@/engine3d/sections/useClippingPlanes";
import { ClippingPlaneController } from "@/engine3d/sections/ClippingPlaneController";
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

  const points = pointsQ.data?.points ?? [];
  const holes = holesQ.data?.holes ?? [];

  const { output: iso, busy: isoBusy } = useIsosurface(
    renderMode === "iso" ? points : [],
    isoParams,
  );
  const { output: voxels, busy: voxBusy } = useVoxelModel(
    renderMode === "voxel" ? points : [],
    voxelParams,
  );
  const { mesh: demMesh, busy: demBusy, loading: demLoading } = useTerrainDEM(
    projectId,
    demEnabled,
    demQuality,
    verticalExaggeration,
    4000,
  );

  // Section mode = clipping forzado activo
  const effectiveClip = useMemo<ClipParams>(
    () => (sectionMode ? { ...clipParams, enabled: true } : clipParams),
    [sectionMode, clipParams],
  );
  const clippingPlanes = useClippingPlanes(effectiveClip);

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

        {/* Capas */}
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
        gl={{ antialias: true, powerPreference: "high-performance", localClippingEnabled: true }}
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
          {showClipHelper && <ClippingPlaneController params={effectiveClip} size={4500} />}
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
