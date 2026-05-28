// TerrainPlane: superficie de referencia simple (grid + plano sutil).
// Sprint 2: reemplazar por malla DEM real de scene3d.server.
import { useMemo } from "react";
import * as THREE from "three";

export function TerrainPlane({ size = 4000 }: { size?: number }) {
  const planeGeo = useMemo(() => new THREE.PlaneGeometry(size, size, 1, 1), [size]);
  const gridGeo = useMemo(() => {
    const helper = new THREE.GridHelper(size, 40, 0x4a4a4a, 0x2a2a2a);
    helper.rotation.x = 0;
    return helper;
  }, [size]);

  return (
    <group>
      {/* Plano semi-transparente como "superficie 0" */}
      <mesh geometry={planeGeo} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial
          color={0x141414}
          roughness={0.95}
          metalness={0.05}
          transparent
          opacity={0.6}
        />
      </mesh>
      <primitive object={gridGeo} />
    </group>
  );
}
