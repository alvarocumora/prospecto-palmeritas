// AutoFitCamera — ajusta cámara + controles a un bounding box válido.
// Si no hay bounds válidos, no toca nada (fallback queda intacto).
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export type SceneBounds = {
  min: [number, number, number];
  max: [number, number, number];
} | null;

type ControlsLike = {
  target: THREE.Vector3;
  update?: () => void;
  minDistance?: number;
  maxDistance?: number;
};

export function fitCameraToBounds(
  camera: THREE.Camera,
  controls: ControlsLike | null,
  bounds: SceneBounds,
  invalidate?: () => void,
) {
  if (!bounds) return false;
  const allFinite = [...bounds.min, ...bounds.max].every(Number.isFinite);
  if (!allFinite) return false;

  const min = new THREE.Vector3(...bounds.min);
  const max = new THREE.Vector3(...bounds.max);
  const box = new THREE.Box3(min, max);
  if (box.isEmpty()) return false;

  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  const diagonal = Math.max(size.length(), 100);
  const radius = diagonal * 1.6;

  const persp = camera as THREE.PerspectiveCamera;
  persp.position.set(center.x + radius, center.y + radius * 0.75, center.z + radius);
  persp.near = Math.max(0.1, diagonal / 5000);
  persp.far = Math.max(50_000, radius * 8);
  persp.lookAt(center);
  persp.updateProjectionMatrix();

  if (controls && controls.target) {
    controls.target.copy(center);
    if (typeof controls.minDistance === "number")
      controls.minDistance = Math.min(controls.minDistance, radius * 0.1);
    if (typeof controls.maxDistance === "number")
      controls.maxDistance = Math.max(controls.maxDistance, radius * 6);
    controls.update?.();
  }

  invalidate?.();
  return true;
}

export function AutoFitCamera({
  bounds,
  enabled = true,
  trigger = 0,
}: {
  bounds: SceneBounds;
  enabled?: boolean;
  trigger?: number;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as ControlsLike | null;
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!enabled) return;
    fitCameraToBounds(camera, controls, bounds, invalidate);
  }, [bounds, enabled, trigger, camera, controls, invalidate]);

  return null;
}

/** Calcula bounds a partir de arrays heterogéneos, ignorando NaN/Infinity. */
export function computeSceneBounds(
  sources: Array<{ positions?: ArrayLike<number>; points?: Array<[number, number, number]> }>,
): SceneBounds {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  let count = 0;

  const accept = (x: number, y: number, z: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    if (Math.abs(x) > 1e7 || Math.abs(y) > 1e7 || Math.abs(z) > 1e7) return;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
    count++;
  };

  for (const src of sources) {
    if (src.positions && src.positions.length >= 3) {
      const p = src.positions;
      // sample to avoid scanning huge arrays
      const stride = Math.max(3, Math.floor(p.length / 3 / 5000) * 3);
      for (let i = 0; i + 2 < p.length; i += stride) {
        accept(p[i], p[i + 1], p[i + 2]);
      }
    }
    if (src.points) {
      for (const pt of src.points) accept(pt[0], pt[1], pt[2]);
    }
  }

  if (count === 0) return null;
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}
