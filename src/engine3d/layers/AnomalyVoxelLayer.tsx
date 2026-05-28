// AnomalyVoxelLayer: renderiza el voxel grid como InstancedMesh de cubos
// con color por intensidad (heatmap rojo→amarillo→blanco). 1 instancia por celda activa.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { VoxelOutput } from "@/engine3d/workers/voxel.worker";

type Props = {
  voxels: VoxelOutput;
  opacity: number;
  /** Factor de escala vertical para exagerar profundidad (default 1) */
  verticalExaggeration?: number;
};

// Heatmap inferno-like: 0=oscuro, 0.5=naranja, 1=blanco
function heatColor(v: number, target: THREE.Color) {
  const t = Math.min(1, Math.max(0, v));
  // Tres tramos lineales
  if (t < 0.4) {
    const k = t / 0.4;
    target.setRGB(0.15 + 0.55 * k, 0.05 + 0.05 * k, 0.25 - 0.15 * k);
  } else if (t < 0.75) {
    const k = (t - 0.4) / 0.35;
    target.setRGB(0.7 + 0.25 * k, 0.1 + 0.55 * k, 0.1);
  } else {
    const k = (t - 0.75) / 0.25;
    target.setRGB(0.95, 0.65 + 0.3 * k, 0.1 + 0.85 * k);
  }
}

export function AnomalyVoxelLayer({ voxels, opacity, verticalExaggeration = 1 }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = voxels.values.length;

  const geometry = useMemo(() => {
    const size = Math.max(voxels.cellSize, 1) * 0.9;
    return new THREE.BoxGeometry(size, size, Math.max(voxels.cellSizeZ, 1) * 0.9);
  }, [voxels.cellSize, voxels.cellSizeZ]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        transparent: true,
        opacity,
        metalness: 0.1,
        roughness: 0.55,
        emissive: new THREE.Color(0x110000),
        emissiveIntensity: 0.25,
      }),
    [opacity],
  );

  useEffect(() => {
    material.opacity = opacity;
    material.needsUpdate = true;
  }, [material, opacity]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const x = voxels.positions[i * 3];
      const y = voxels.positions[i * 3 + 1];
      const z = voxels.positions[i * 3 + 2] * verticalExaggeration;
      // R3F usa Y-up: mapeamos ENU(x,y,z) → three(x, z, -y) para que Z geológico apunte arriba
      dummy.position.set(x, z, -y);
      dummy.scale.setScalar(0.5 + voxels.values[i] * 0.8);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      heatColor(voxels.values[i], color);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = count;
  }, [voxels, count, verticalExaggeration]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    />
  );
}
