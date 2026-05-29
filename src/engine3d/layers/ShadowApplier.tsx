// ShadowApplier: aplica castShadow/receiveShadow a meshes de la escena.
// Corre dentro del Canvas y observa el scene graph en cada cambio relevante.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

type Props = {
  enabled: boolean;
  /** Deps externos (cuando cambian las capas) para re-aplicar shadows */
  deps: unknown[];
};

export function ShadowApplier({ enabled, deps }: Props) {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!enabled) return;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      // El terreno es enorme y plano → recibe sombras
      // Los drillholes y shells finos castean para definir relieve
      const name = mesh.name || "";
      const isTerrain = name.includes("terrain") || name.includes("dem") || name.includes("basemap");
      mesh.castShadow = !isTerrain;
      mesh.receiveShadow = true;
      // PBR boost: si el material es Standard/Physical, sube envMapIntensity
      const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (mat && "envMapIntensity" in mat) {
        mat.envMapIntensity = Math.max(mat.envMapIntensity ?? 1, 0.8);
      }
    });
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scene, ...deps]);

  return null;
}
