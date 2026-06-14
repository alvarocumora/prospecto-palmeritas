// SyntheticDrillholeTraceLayer — sondajes conceptuales (cilindros instanciados).
// Color por cu_eq medio del intervalo mineralizado (gradiente azul→amarillo→rojo).
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { SyntheticDrillhole } from "@/lib/conceptualModel.functions";

type Props = {
  holes: SyntheticDrillhole[];
  verticalExaggeration?: number;
  radius?: number;
  clippingPlanes?: THREE.Plane[];
  onHover?: (h: SyntheticDrillhole | null) => void;
};

const UP = new THREE.Vector3(0, 1, 0);

function gradeColor(t: number, target: THREE.Color) {
  const x = Math.max(0, Math.min(1, t));
  if (x < 0.5) {
    const u = x / 0.5;
    target.setRGB(0.15 + 0.85 * u, 0.35 + 0.55 * u, 0.85 - 0.7 * u);
  } else {
    const u = (x - 0.5) / 0.5;
    target.setRGB(1.0, 0.9 - 0.7 * u, 0.15 * (1 - u));
  }
}

export function SyntheticDrillholeTraceLayer({
  holes,
  verticalExaggeration = 1,
  radius = 7,
  clippingPlanes,
  onHover,
}: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = holes.length;

  const geometry = useMemo(
    () => new THREE.CylinderGeometry(radius, radius * 0.7, 1, 14, 1, false),
    [radius],
  );
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.55,
        roughness: 0.35,
        emissive: new THREE.Color(0x0a1422),
        emissiveIntensity: 0.4,
        clippingPlanes: clippingPlanes ?? [],
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    material.clippingPlanes = clippingPlanes ?? [];
    material.needsUpdate = true;
  }, [material, clippingPlanes]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Avg cuEq per hole (mineralized intervals only)
  const avgCuEq = useMemo(
    () =>
      holes.map((h) => {
        const min = h.intervals.filter((i) => i.mineralized);
        if (!min.length) return 0;
        let sum = 0,
          w = 0;
        for (const i of min) {
          const len = i.to - i.from;
          sum += i.cuEq * len;
          w += len;
        }
        return w > 0 ? sum / w : 0;
      }),
    [holes],
  );
  const maxCuEq = useMemo(() => Math.max(0.5, ...avgCuEq, 1.2), [avgCuEq]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const dir = new THREE.Vector3();
    const q = new THREE.Quaternion();

    for (let i = 0; i < count; i++) {
      const h = holes[i];
      const cx = h.collar.x,
        cy = -h.collar.y,
        cz = h.collar.z * verticalExaggeration;
      const tx = h.toe.x,
        ty = -h.toe.y,
        tz = h.toe.z * verticalExaggeration;
      dummy.position.set((cx + tx) / 2, (cz + tz) / 2, (cy + ty) / 2);
      dir.set(tx - cx, tz - cz, ty - cy);
      const len = Math.max(1, dir.length());
      dir.normalize();
      q.setFromUnitVectors(UP, dir);
      dummy.quaternion.copy(q);
      dummy.scale.set(1, len, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      gradeColor(avgCuEq[i] / maxCuEq, color);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = count;
  }, [holes, count, verticalExaggeration, avgCuEq, maxCuEq]);

  if (count === 0) return null;
  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, Math.max(1, count)]}
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
