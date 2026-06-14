// BasemapLayer: dibuja imagen satelital/topográfica ESRI/OSM bajo la escena.
// - Modo plano: PlaneGeometry horizontal con UVs derivadas de ENU.
// - Modo drape DEM: clona positions/indices del DEM y calcula UVs por vértice.
// - Si las tiles fallan, hace fallback automático y muestra warning.
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  buildBasemapTexture,
  type BasemapSource,
  type TileGrid,
} from "@/engine3d/terrain/basemapTiles";
import type { MartiniOutput } from "@/engine3d/terrain/martini.worker";

type Props = {
  source: BasemapSource;
  centerLng: number;
  centerLat: number;
  extentMeters: number;
  opacity: number;
  /** Si se provee, drapeará el basemap sobre el TIN del DEM. */
  demMesh?: MartiniOutput | null;
  /** Offset vertical para evitar z-fighting con DEM/grid. */
  yOffset?: number;
  onStatus?: (s: { source: BasemapSource; failed: boolean; zoom: number }) => void;
};

export function BasemapLayer({
  source,
  centerLng,
  centerLat,
  extentMeters,
  opacity,
  demMesh,
  yOffset = 0.5,
  onStatus,
}: Props) {
  const [grid, setGrid] = useState<TileGrid | null>(null);
  const [loading, setLoading] = useState(false);
  const failedFallbackRef = useRef(false);

  useEffect(() => {
    if (source === "none") {
      setGrid(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    failedFallbackRef.current = false;
    (async () => {
      let g = await buildBasemapTexture(source, centerLng, centerLat, extentMeters);
      if (cancelled) return;
      // Si ESRI falla, intenta OSM como fallback automático
      if (g?.failed && source !== "osm" && !failedFallbackRef.current) {
        failedFallbackRef.current = true;
        console.warn("[basemap] primary failed → fallback to OSM");
        const fb = await buildBasemapTexture("osm", centerLng, centerLat, extentMeters);
        if (!cancelled && fb) g = fb;
      }
      if (cancelled) return;
      setGrid(g);
      setLoading(false);
      if (g) onStatus?.({ source: g.source, failed: g.failed, zoom: g.zoom });
    })();
    return () => {
      cancelled = true;
    };
  }, [source, centerLng, centerLat, extentMeters, onStatus]);

  const texture = useMemo(() => {
    if (!grid) return null;
    const tex = new THREE.CanvasTexture(grid.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, [grid]);

  useEffect(
    () => () => {
      texture?.dispose();
    },
    [texture],
  );

  // Geometría: drape sobre DEM si existe, si no plano horizontal
  const geometry = useMemo(() => {
    if (!grid) return null;
    const cw = grid.enuMaxX - grid.enuMinX;
    const ch = grid.enuMaxY - grid.enuMinY;
    if (cw < 1 || ch < 1) return null;

    if (demMesh && demMesh.positions.length > 0) {
      // Drape: clonar posiciones del DEM, calcular UVs desde world (x, _, z)
      const g = new THREE.BufferGeometry();
      const pos = demMesh.positions;
      const n = pos.length / 3;
      const uvs = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const wx = pos[i * 3];
        const wz = pos[i * 3 + 2];
        const enuX = wx;
        const enuY = -wz;
        uvs[i * 2] = (enuX - grid.enuMinX) / cw;
        uvs[i * 2 + 1] = (enuY - grid.enuMinY) / ch;
      }
      g.setAttribute("position", new THREE.BufferAttribute(pos.slice(0), 3));
      g.setAttribute("normal", new THREE.BufferAttribute(demMesh.normals.slice(0), 3));
      g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      g.setIndex(new THREE.BufferAttribute(demMesh.indices.slice(0), 1));
      g.computeBoundingSphere();
      return g;
    }

    // Plano horizontal del tamaño del extent
    const ext = extentMeters;
    const g = new THREE.PlaneGeometry(ext, ext, 1, 1);
    // Por defecto PlaneGeometry está en XY; tras rotar -π/2 alrededor de X
    // queda en XZ. Override UVs para que (px,py) → ENU(x,y) → UV en canvas.
    const positionAttr = g.getAttribute("position") as THREE.BufferAttribute;
    const uvAttr = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < positionAttr.count; i++) {
      const px = positionAttr.getX(i);
      const py = positionAttr.getY(i); // antes de rotar = ENU.y
      const u = (px - grid.enuMinX) / cw;
      const v = (py - grid.enuMinY) / ch;
      uvAttr.setXY(i, u, v);
    }
    uvAttr.needsUpdate = true;
    return g;
  }, [grid, demMesh, extentMeters]);

  useEffect(
    () => () => {
      geometry?.dispose();
    },
    [geometry],
  );

  if (!grid || !texture || !geometry) {
    if (loading) {
      // sin overlay 3D; el panel HUD muestra el estado
      return null;
    }
    return null;
  }

  // Si drape sobre DEM, no rotamos; si plano, rotamos -π/2 en X.
  const isDrape = !!(demMesh && demMesh.positions.length > 0);

  return (
    <mesh
      geometry={geometry}
      rotation={isDrape ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}
      position={[0, yOffset, 0]}
      renderOrder={isDrape ? -1 : -2}
    >
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
        toneMapped={false}
      />
    </mesh>
  );
}
