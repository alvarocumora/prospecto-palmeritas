// DrillholesLayer: renderiza sondajes como cilindros instanciados.
// Color por estado / IA; longitud y orientación derivadas de collar→toe.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { DrillholeSegment } from "@/engine3d/data/drillholes.functions";

type Props = {
  holes: DrillholeSegment[];
  verticalExaggeration?: number;
  radius?: number;
  onHover?: (hole: DrillholeSegment | null) => void;
  clippingPlanes?: THREE.Plane[];
  unlit?: boolean;
};

const UP = new THREE.Vector3(0, 1, 0);

function colorForHole(h: DrillholeSegment, target: THREE.Color) {
  if (h.isAi) {
    target.setRGB(0.55, 0.85, 1.0); // cyan AI
    return;
  }
  switch ((h.status ?? "").toLowerCase()) {
    case "completed":
      target.setRGB(0.95, 0.75, 0.25); // gold
      return;
    case "in_progress":
    case "drilling":
      target.setRGB(0.95, 0.45, 0.20); // orange
      return;
    case "planned":
      target.setRGB(0.55, 0.55, 0.65); // grey
      return;
    default:
      target.setRGB(0.85, 0.85, 0.85);
  }
}

export function DrillholesLayer({
  holes,
  verticalExaggeration = 1,
  radius = 6,
  onHover,
  clippingPlanes,
  unlit = false,
}: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = holes.length;

  // Cilindro unitario de altura 1, alineado a Y. Lo escalamos en Y por hole length.
  const geometry = useMemo(
    () => new THREE.CylinderGeometry(radius, radius * 0.6, 1, 12, 1, false),
    [radius],
  );

  const material = useMemo(
    () => {
      if (unlit) {
        return new THREE.MeshBasicMaterial({
          vertexColors: true,
          clippingPlanes: clippingPlanes ?? [],
          toneMapped: false,
        });
      }
      return new THREE.MeshStandardMaterial({
        vertexColors: false,
        metalness: 0.35,
        roughness: 0.45,
        emissive: new THREE.Color(0x111111),
        emissiveIntensity: 0.2,
        clippingPlanes: clippingPlanes ?? [],
      });
    },
    [clippingPlanes, unlit],
  );

  useEffect(() => {
    material.clippingPlanes = clippingPlanes ?? [];
    material.needsUpdate = true;
  }, [material, clippingPlanes]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const vDir = new THREE.Vector3();
    const q = new THREE.Quaternion();

    for (let i = 0; i < count; i++) {
      const h = holes[i];
      // ENU(x,y,z) → three(x, z*ve, -y)
      const cx = h.collar.x, cy = -h.collar.y, cz = h.collar.z * verticalExaggeration;
      const tx = h.toe.x,    ty = -h.toe.y,    tz = h.toe.z * verticalExaggeration;
      const midX = (cx + tx) / 2;
      const midY = (cz + tz) / 2;
      const midZ = (cy + ty) / 2;
      vDir.set(tx - cx, tz - cz, ty - cy);
      const len = Math.max(1, vDir.length());
      vDir.normalize();
      q.setFromUnitVectors(UP, vDir);

      dummy.position.set(midX, midY, midZ);
      dummy.quaternion.copy(q);
      dummy.scale.set(1, len, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      colorForHole(h, color);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = count;
  }, [holes, count, verticalExaggeration]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      onPointerOver={(e) => {
        if (!onHover) return;
        const id = e.instanceId;
        if (id != null && holes[id]) onHover(holes[id]);
      }}
      onPointerOut={() => onHover?.(null)}
    />
  );
}
