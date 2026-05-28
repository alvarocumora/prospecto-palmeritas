// LosVerdesEngine3D: nuevo motor geocientífico modular.
// - R3F Canvas con frameloop="demand" (solo renderiza en interacción)
// - Voxel + IDW + isovalue dinámico en Web Worker
// - Capa de puntos crudos (anomalías geofísicas + satelitales)
// - Eje de profundidad y plano de referencia
//
// Reemplaza el viewer monolítico cuando el flag está activo.
import { Canvas } from "@react-three/fiber";
import { MapControls, Stats } from "@react-three/drei";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { Loader2, Settings2, Layers as LayersIcon } from "lucide-react";

import { getAnomalyPoints } from "@/engine3d/data/anomalies.functions";
import { useVoxelModel, DEFAULT_VOXEL_PARAMS, type VoxelParams } from "@/engine3d/hooks/useVoxelModel";
import { AnomalyVoxelLayer } from "@/engine3d/layers/AnomalyVoxelLayer";
import { AnomalyPointsLayer } from "@/engine3d/layers/AnomalyPointsLayer";
import { TerrainPlane } from "@/engine3d/layers/TerrainPlane";
import { DepthAxis } from "@/engine3d/layers/DepthAxis";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Props = {
  projectId: string;
  height?: number;
};

export function LosVerdesEngine3D({ projectId, height = 640 }: Props) {
  const fetchPoints = useServerFn(getAnomalyPoints);
  const pointsQ = useQuery({
    queryKey: ["engine3d", "anomalyPoints", projectId],
    queryFn: () => fetchPoints({ data: { projectId } }),
    staleTime: 60_000,
  });

  const [params, setParams] = useState<VoxelParams>(DEFAULT_VOXEL_PARAMS);
  const [opacity, setOpacity] = useState(0.55);
  const [verticalExaggeration, setVe] = useState(2);
  const [showPoints, setShowPoints] = useState(true);
  const [showVoxels, setShowVoxels] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showStats, setShowStats] = useState(false);

  const points = pointsQ.data?.points ?? [];
  const { output: voxels, busy } = useVoxelModel(points, params);

  const cameraInitial = useMemo<[number, number, number]>(() => [2400, 1800, 2400], []);

  return (
    <div
      className="relative w-full rounded-lg border border-border overflow-hidden bg-[#08090c]"
      style={{ height }}
    >
      {/* HUD top-left */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5 max-w-[280px]">
        <div className="bg-black/70 backdrop-blur rounded-md px-3 py-2 text-[10px] font-mono text-foreground/90 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <LayersIcon className="w-3 h-3 text-orange-400" />
            <span className="uppercase tracking-wider text-orange-300">Engine 3D · voxel + IDW</span>
          </div>
          {pointsQ.isLoading ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> cargando puntos…
            </div>
          ) : (
            <div className="text-muted-foreground">
              <div>{pointsQ.data?.stats.count ?? 0} anomalías reales</div>
              <div>
                voxel {params.resolution}³ ={" "}
                {(params.resolution ** 3).toLocaleString()} celdas · activas:{" "}
                <span className="text-orange-300">{voxels?.activeCount ?? 0}</span>
              </div>
              {busy && (
                <div className="flex items-center gap-1.5 text-amber-300 mt-0.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> interpolando…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controles */}
        <div className="bg-black/70 backdrop-blur rounded-md px-3 py-2 text-[10px] font-mono text-foreground/90 border border-border space-y-2.5">
          <div className="flex items-center gap-2">
            <Settings2 className="w-3 h-3 text-gold" />
            <span className="uppercase tracking-wider text-gold">controles</span>
          </div>

          <div>
            <Label className="text-[9px] uppercase">Isovalue · {params.isovalue.toFixed(2)}</Label>
            <Slider
              min={0.1}
              max={0.95}
              step={0.05}
              value={[params.isovalue]}
              onValueChange={([v]) => setParams((p) => ({ ...p, isovalue: v }))}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-[9px] uppercase">Resolución · {params.resolution}³</Label>
            <Slider
              min={16}
              max={72}
              step={4}
              value={[params.resolution]}
              onValueChange={([v]) => setParams((p) => ({ ...p, resolution: v }))}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-[9px] uppercase">Opacidad · {opacity.toFixed(2)}</Label>
            <Slider
              min={0.1}
              max={1}
              step={0.05}
              value={[opacity]}
              onValueChange={([v]) => setOpacity(v)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-[9px] uppercase">Exag. vertical · {verticalExaggeration.toFixed(1)}×</Label>
            <Slider
              min={0.5}
              max={5}
              step={0.5}
              value={[verticalExaggeration]}
              onValueChange={([v]) => setVe(v)}
              className="mt-1"
            />
          </div>

          <div className="space-y-1.5 pt-1 border-t border-border/40">
            <ToggleRow label="Voxel isosurface" value={showVoxels} onChange={setShowVoxels} />
            <ToggleRow label="Puntos crudos" value={showPoints} onChange={setShowPoints} />
            <ToggleRow label="Grid + plano" value={showGrid} onChange={setShowGrid} />
            <ToggleRow label="FPS" value={showStats} onChange={setShowStats} />
          </div>

          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-[10px]"
            onClick={() => setParams(DEFAULT_VOXEL_PARAMS)}
          >
            Reset parámetros
          </Button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="absolute bottom-2 right-2 z-10 bg-black/70 backdrop-blur rounded-md px-3 py-2 text-[10px] font-mono border border-border">
        <div className="uppercase tracking-wider text-muted-foreground mb-1">leyenda</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-gradient-to-r from-purple-900 via-orange-500 to-amber-200" /> intensidad voxel</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-400" /> anomalía geofísica</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-400" /> anomalía satelital</div>
      </div>

      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: cameraInitial, fov: 45, near: 1, far: 50_000, up: [0, 1, 0] }}
        shadows={false}
      >
        <color attach="background" args={[0x08090c]} />
        <fog attach="fog" args={[0x08090c, 3500, 12000]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[1500, 2500, 1500]} intensity={0.9} />
        <directionalLight position={[-1500, 1200, -1500]} intensity={0.4} />

        <Suspense fallback={null}>
          {showGrid && <TerrainPlane size={4000} />}
          <DepthAxis maxDepth={400} verticalExaggeration={verticalExaggeration} />
          {showPoints && <AnomalyPointsLayer points={points} verticalExaggeration={verticalExaggeration} />}
          {showVoxels && voxels && voxels.activeCount > 0 && (
            <AnomalyVoxelLayer voxels={voxels} opacity={opacity} verticalExaggeration={verticalExaggeration} />
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

      {pointsQ.data && pointsQ.data.points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/80 px-4 py-3 rounded-md text-[11px] font-mono text-amber-300 border border-amber-500/40">
            Sin anomalías geofísicas/satelitales para este proyecto.
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
