// SyntheticBlockModelLayer — block model conceptual (cubos instanciados).
// Filtros: cutoff cuEq, opacidad. Color por cuEq con gradiente viridis-like.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { SyntheticBlock } from "@/lib/conceptualModel.functions";

type Props = {
  blocks: SyntheticBlock[];
  cutoff?: number;
  opacity?: number;
  verticalExaggeration?: number;
  clippingPlanes?: THREE.Plane[];
  maxCuEq?: number;
};

function viridis(t: number, target: THREE.Color) {
  const x = Math.max(0, Math.min(1, t));
  const stops: Array<[number, [number, number, number]]> = [
    [0, [0.27, 0, 0.33]],
    [0.25, [0.23, 0.32, 0.55]],
    [0.5, [0.13, 0.57, 0.55]],
    [0.75, [0.49, 0.83, 0.36]],
    [1, [0.99, 0.91, 0.14]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i];
    const [b, cb] = stops[i + 1];
    if (x >= a && x <= b) {
      const u = (x - a) / (b - a);
      target.setRGB(
        ca[0] + (cb[0] - ca[0]) * u,
        ca[1] + (cb[1] - ca[1]) * u,
        ca[2] + (cb[2] - ca[2]) * u,
      );
      return;
    }
  }
}

export function SyntheticBlockModelLayer({
  blocks,
  cutoff = 0.3,
  opacity = 0.75,
  verticalExaggeration = 1,
  clippingPlanes,
  maxCuEq,
}: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const baseSize = blocks[0] ?? { sx: 15, sy: 15, sz: 10 };
  const geometry = useMemo(
    () => new THREE.BoxGeometry(baseSize.sx, baseSize.sz, baseSize.sy),
    [baseSize.sx, baseSize.sy, baseSize.sz],
  );
  const material = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        transparent: true,
        opacity,
        clippingPlanes: clippingPlanes ?? [],
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    material.opacity = opacity;
    material.transparent = opacity < 1;
    material.clippingPlanes = clippingPlanes ?? [];
    material.needsUpdate = true;
  }, [material, opacity, clippingPlanes]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const max = useMemo(
    () => maxCuEq ?? Math.max(0.5, ...blocks.map((b) => b.cuEq)),
    [blocks, maxCuEq],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let visible = 0;
    for (const b of blocks) {
      if (b.cuEq < cutoff) continue;
      // ENU(x,y,z) → three(x, z*ve, -y)
      dummy.position.set(b.x, b.z * verticalExaggeration, -b.y);
      dummy.scale.set(b.sx / baseSize.sx, b.sz / baseSize.sz, b.sy / baseSize.sy);
      dummy.updateMatrix();
      mesh.setMatrixAt(visible, dummy.matrix);
      viridis(b.cuEq / max, color);
      mesh.setColorAt(visible, color);
      visible++;
    }
    mesh.count = visible;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [blocks, cutoff, verticalExaggeration, baseSize.sx, baseSize.sy, baseSize.sz, max]);

  if (blocks.length === 0) return null;
  return (
    <instancedMesh ref={meshRef} args={[geometry, material, blocks.length]} frustumCulled={false} />
  );
}
