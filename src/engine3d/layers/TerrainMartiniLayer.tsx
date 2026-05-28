// Renderiza el TIN generado por Martini con normales calculadas + clipping.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { MartiniOutput } from "@/engine3d/terrain/martini.worker";

type Props = {
  mesh: MartiniOutput;
  clippingPlanes?: THREE.Plane[];
  wireframe?: boolean;
};

export function TerrainMartiniLayer({ mesh, clippingPlanes, wireframe = false }: Props) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeBoundingSphere();
    return g;
  }, [mesh]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x6b5a44,
        roughness: 0.95,
        metalness: 0.0,
        flatShading: false,
        side: THREE.DoubleSide,
        clippingPlanes: clippingPlanes ?? [],
        clipShadows: true,
        wireframe,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    material.clippingPlanes = clippingPlanes ?? [];
    material.wireframe = wireframe;
    material.needsUpdate = true;
  }, [material, clippingPlanes, wireframe]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return <mesh geometry={geometry} material={material} receiveShadow />;
}
