import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDemTile } from "@/engine3d/terrain/dem.functions";
import { cholquiCadTerrain } from "@/lib/cholqui/cadTerrain";
import { loadImageDrape } from "@/lib/geospatial/imageDrape";
import type { TerrainTile } from "@/lib/geospatial/terrainTile";
import satelliteAsset from "@/assets/cholqui-world-imagery.jpg.asset.json";
import satelliteMetadata from "@/data/geo/cholqui_satellite_imagery.json";

const LOS_VERDES_ID = "7a499b02-ecdf-447b-8956-b106fe4ec087";
const LOS_VERDES_CENTER = { lat: -32.032, lng: -71.114 };
const EXAGGERATION = 1.5;

type ProjectKey = "cholqui" | "losverdes";

const NOTES: Record<ProjectKey, string> = {
  cholqui:
    "Cholqui · relieve DERIVADO de curvas CAD del titular (DECLARADO) · imagen Esri World Imagery · exageración vertical 1,5×",
  losverdes:
    "Los Verdes · relieve Copernicus GLO-30 · color por altura · exageración vertical 1,5×",
};

/** Elevation ramp used only when no georeferenced imagery is available. */
function rampColor(t: number, out: THREE.Color) {
  const low = new THREE.Color("#1f3a4d");
  const mid = new THREE.Color("#8a6a45");
  const high = new THREE.Color("#e9dcc6");
  return t < 0.5 ? out.copy(low).lerp(mid, t * 2) : out.copy(mid).lerp(high, (t - 0.5) * 2);
}

function TerrainMesh({ tile, texture }: { tile: TerrainTile; texture: THREE.Texture | null }) {
  const geometry = useMemo(() => {
    const n = tile.size;
    const g = new THREE.PlaneGeometry(tile.extentMeters, tile.extentMeters, n - 1, n - 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const mask = "validMask" in tile ? tile.validMask : null;
    const range = Math.max(1, tile.maxH - tile.minH);
    const colors = new Float32Array(n * n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n * n; i++) {
      pos.setY(i, tile.heights[i] * EXAGGERATION);
      rampColor((tile.heights[i] - tile.minH) / range, c);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    if (mask) {
      const src = g.index!.array;
      const keep: number[] = [];
      for (let i = 0; i < src.length; i += 3)
        if (mask[src[i]] && mask[src[i + 1]] && mask[src[i + 2]]) keep.push(src[i], src[i + 1], src[i + 2]);
      g.setIndex(keep);
    }
    g.computeVertexNormals();
    return g;
  }, [tile]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    // Remount instead of updating props: dev tooling injects attributes R3F cannot patch.
    <mesh key={texture ? "drape" : "ramp"} geometry={geometry}>
      {texture ? (
        <meshStandardMaterial map={texture} roughness={0.95} />
      ) : (
        <meshStandardMaterial vertexColors roughness={0.9} />
      )}
    </mesh>
  );
}

export default function HeroTerrain3D() {
  const [project, setProject] = useState<ProjectKey>("cholqui");
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const fetchDem = useServerFn(getDemTile);
  const losVerdes = useQuery({
    queryKey: ["hero-dem", LOS_VERDES_ID],
    queryFn: () =>
      fetchDem({
        data: {
          projectId: LOS_VERDES_ID,
          size: 129,
          extentMeters: 9000,
          centerLat: LOS_VERDES_CENTER.lat,
          centerLng: LOS_VERDES_CENTER.lng,
        },
      }),
    staleTime: Infinity,
  });

  useEffect(() => {
    let cancelled = false;
    loadImageDrape(
      { url: satelliteAsset.url, bbox: satelliteMetadata.bbox, attribution: satelliteMetadata.attribution, source: satelliteMetadata.source },
      cholquiCadTerrain,
    )
      .then((t) => !cancelled && setTexture(t))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Never show a procedural fallback as if it were real terrain.
  const lvTile = losVerdes.data && losVerdes.data.source === "copernicus" ? losVerdes.data : null;
  const tile: TerrainTile | null = project === "cholqui" ? cholquiCadTerrain : lvTile;
  const extent = tile?.extentMeters ?? 10000;

  return (
    <div className="absolute inset-0">
      {tile ? (
        <Canvas
          key={project}
          dpr={[1, 1.5]}
          camera={{ position: [extent * 0.55, extent * 0.42, extent * 0.62], fov: 40, near: 10, far: extent * 6 }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[extent, extent, extent * 0.3]} intensity={1.6} />
          <TerrainMesh tile={tile} texture={project === "cholqui" ? texture : null} />
          <OrbitControls autoRotate autoRotateSpeed={0.4} enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2.3} />
        </Canvas>
      ) : (
        <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {losVerdes.isError || losVerdes.data ? "Relieve de Los Verdes no disponible ahora" : "Cargando relieve…"}
        </div>
      )}
      <div className="absolute bottom-4 right-4 left-4 flex flex-wrap items-end justify-between gap-3 pointer-events-none">
        <p className="max-w-md font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          {NOTES[project]}
          {project === "cholqui" && " · Source: Esri"}
        </p>
        <div className="pointer-events-auto flex rounded-sm border border-border bg-background/80 backdrop-blur">
          {(["cholqui", "losverdes"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setProject(k)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${project === k ? "bg-copper text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {k === "cholqui" ? "Cholqui" : "Los Verdes"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
