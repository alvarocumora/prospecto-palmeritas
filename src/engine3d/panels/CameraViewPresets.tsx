// CameraViewPresets — vistas predefinidas N/E/S/W/Top/Iso ajustadas a bounds.
// Mount inside <Canvas>. Re-runs when `nonce` changes.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneBounds } from "@/engine3d/sections/AutoFitCamera";

export type CameraView = "N" | "E" | "S" | "W" | "top" | "iso";

type Props = { view: CameraView; bounds: SceneBounds; nonce: number };

type ControlsLike = {
  target: THREE.Vector3;
  update?: () => void;
  minDistance?: number;
  maxDistance?: number;
};

export function CameraViewPresets({ view, bounds, nonce }: Props) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as ControlsLike | null;
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (nonce === 0 || !bounds) return;
    const allFinite = [...bounds.min, ...bounds.max].every(Number.isFinite);
    if (!allFinite) return;

    const min = new THREE.Vector3(...bounds.min);
    const max = new THREE.Vector3(...bounds.max);
    const box = new THREE.Box3(min, max);
    if (box.isEmpty()) return;
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const r = Math.max(size.length(), 200) * 1.4;

    const persp = camera as THREE.PerspectiveCamera;
    // En three: X=East, Y=Up, Z=South (porque mapeamos ENU.y → -Z)
    switch (view) {
      case "N": persp.position.set(center.x, center.y + r * 0.15, center.z - r); break;
      case "S": persp.position.set(center.x, center.y + r * 0.15, center.z + r); break;
      case "E": persp.position.set(center.x + r, center.y + r * 0.15, center.z); break;
      case "W": persp.position.set(center.x - r, center.y + r * 0.15, center.z); break;
      case "top": persp.position.set(center.x, center.y + r * 1.2, center.z + 0.001); break;
      case "iso":
      default: persp.position.set(center.x + r * 0.8, center.y + r * 0.7, center.z + r * 0.8); break;
    }
    persp.near = Math.max(0.1, r / 5000);
    persp.far = Math.max(50_000, r * 8);
    persp.lookAt(center);
    persp.updateProjectionMatrix();
    if (controls?.target) {
      controls.target.copy(center);
      controls.update?.();
    }
    invalidate?.();
  }, [view, nonce, bounds, camera, controls, invalidate]);

  return null;
}
