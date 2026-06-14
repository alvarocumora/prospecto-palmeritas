// DrillTargetLayer — Sprint 5
// Renderiza targets propuestos como cilindros instanciados semitransparentes,
// coloreados por prioridad (A=verde, B=ámbar, C=rojo).
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { DrillTarget } from "@/engine3d/ai/drillTarget.worker";

const PRIORITY_COLOR: Record<DrillTarget["priority"], THREE.Color> = {
  A: new THREE.Color(0x22c55e),
  B: new THREE.Color(0xf59e0b),
  C: new THREE.Color(0xef4444),
};

type Props = {
  targets: DrillTarget[];
  verticalExaggeration: number;
  clippingPlanes?: THREE.Plane[];
  onHover?: (t: DrillTarget | null) => void;
};

export function DrillTargetLayer({
  targets,
  verticalExaggeration,
  clippingPlanes,
  onHover,
}: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.CylinderGeometry(4, 4, 1, 12, 1, true), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        clippingPlanes: clippingPlanes ?? [],
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    material.clippingPlanes = clippingPlanes ?? [];
    material.needsUpdate = true;
  }, [material, clippingPlanes]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    targets.forEach((t, i) => {
      const azRad = (t.azimuth * Math.PI) / 180;
      const dipRad = (t.dip * Math.PI) / 180;
      // dirección en three (Y arriba)
      const dx = Math.sin(azRad) * Math.cos(dipRad);
      const dy = Math.sin(dipRad); // negativo = abajo
      const dz = -Math.cos(azRad) * Math.cos(dipRad);
      const len = t.depth;
      const cx = t.collar.x + (dx * len) / 2;
      const cy = ((t.collar.z + dy * len) / 2) * verticalExaggeration;
      const cz = -t.collar.y + (dz * len) / 2;
      dummy.position.set(cx, cy, cz);
      // orientar cilindro: Y local apunta a dirección
      const dir = new THREE.Vector3(dx, dy * verticalExaggeration, dz).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
      dummy.quaternion.copy(quat);
      dummy.scale.set(1, len, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.copy(PRIORITY_COLOR[t.priority]);
      mesh.setColorAt(i, color);
    });
    mesh.count = targets.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [targets, verticalExaggeration]);

  if (targets.length === 0) return null;
  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, Math.max(1, targets.length)]}
      frustumCulled={false}
      onPointerOver={(e) => {
        e.stopPropagation();
        const id = e.instanceId;
        if (id !== undefined && onHover) onHover(targets[id] ?? null);
      }}
      onPointerOut={() => onHover?.(null)}
    />
  );
}
