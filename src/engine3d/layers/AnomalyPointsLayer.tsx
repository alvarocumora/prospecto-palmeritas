// AnomalyPointsLayer: puntos crudos (antes de la interpolación) como esferas
// pequeñas marcadoras. Útil como ground-truth visual.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { AnomalyPoint } from "@/engine3d/data/anomalies.functions";

export function AnomalyPointsLayer({
  points,
  verticalExaggeration = 1,
  unlit = false,
}: {
  points: AnomalyPoint[];
  verticalExaggeration?: number;
  unlit?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.SphereGeometry(15, 12, 8), []);
  const material = useMemo(() => {
    if (unlit) {
      return new THREE.MeshBasicMaterial({
        vertexColors: true,
        toneMapped: false,
      });
    }
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.4,
      metalness: 0.4,
      roughness: 0.35,
    });
  }, [unlit]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    points.forEach((p, i) => {
      dummy.position.set(p.x, p.z * verticalExaggeration, -p.y);
      dummy.scale.setScalar(0.8 + p.v * 1.6);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (p.kind === "satellite") color.setRGB(0.2, 0.85, 1.0);
      else color.setRGB(1.0, 0.8, 0.1);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = points.length;
  }, [points, verticalExaggeration]);

  if (points.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, material, points.length]} frustumCulled={false} />
  );
}
