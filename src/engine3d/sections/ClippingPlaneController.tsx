// Helper visual del plano de corte: cuadrilátero translúcido + borde.
// Sólo para feedback visual; el corte real lo hacen los materiales con clippingPlanes.
import { useMemo } from "react";
import * as THREE from "three";
import type { ClipParams } from "./useClippingPlanes";

type Props = {
  params: ClipParams;
  /** Tamaño del helper (m). Debe ser ≥ extensión visible. */
  size?: number;
};

const UP = new THREE.Vector3(0, 1, 0);

export function ClippingPlaneController({ params, size = 5000 }: Props) {
  const { quaternion, position } = useMemo(() => {
    let n: THREE.Vector3;
    switch (params.axis) {
      case "x": n = new THREE.Vector3(1, 0, 0); break;
      case "y": n = new THREE.Vector3(0, 1, 0); break;
      case "z": n = new THREE.Vector3(0, 0, 1); break;
      default:
        n = new THREE.Vector3(
          params.freeNormal?.x ?? 1,
          params.freeNormal?.y ?? 0,
          params.freeNormal?.z ?? 0,
        ).normalize();
    }
    const q = new THREE.Quaternion().setFromUnitVectors(UP, n);
    const p = n.clone().multiplyScalar(params.position);
    return { quaternion: q, position: p };
  }, [params.axis, params.position, params.freeNormal]);

  if (!params.enabled) return null;

  return (
    <group position={position} quaternion={quaternion}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          color={0xffc04a}
          opacity={0.08}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <gridHelper
        args={[size, 20, 0xffc04a, 0x7a5418]}
        rotation={[0, 0, 0]}
      />
    </group>
  );
}
