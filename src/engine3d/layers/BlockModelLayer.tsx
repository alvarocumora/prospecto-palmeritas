// Renderiza el block model con InstancedMesh + filtros (cutoff, depth, confidence,
// classification, opacity). Clipping plane aware.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { BlockModelOutput } from "@/engine3d/workers/blockModel.worker";

export type BlockFilters = {
  cutoff: number;
  minDepth: number;
  maxDepth: number;
  minConfidence: number;
  showMeasured: boolean;
  showIndicated: boolean;
  showInferred: boolean;
  showWaste: boolean;
  opacity: number;
  /** "grade" | "classification" | "confidence" */
  colorBy: "grade" | "classification" | "confidence";
};

// eslint-disable-next-line react-refresh/only-export-components
export const DEFAULT_BLOCK_FILTERS: BlockFilters = {
  cutoff: 0.3,
  minDepth: 0,
  maxDepth: 1000,
  minConfidence: 0,
  showMeasured: true,
  showIndicated: true,
  showInferred: true,
  showWaste: false,
  opacity: 0.85,
  colorBy: "grade",
};

type Props = {
  model: BlockModelOutput;
  filters: BlockFilters;
  verticalExaggeration: number;
  clippingPlanes?: THREE.Plane[];
};

const CLASS_COLORS = [
  new THREE.Color(0x16a34a), // measured — verde
  new THREE.Color(0xeab308), // indicated — amarillo
  new THREE.Color(0xef4444), // inferred — rojo
  new THREE.Color(0x6b7280), // waste — gris
];

function gradeColor(t: number, target: THREE.Color) {
  // viridis-like
  const x = Math.max(0, Math.min(1, t));
  const stops: Array<[number, [number, number, number]]> = [
    [0, [0.27, 0, 0.33]],
    [0.25, [0.23, 0.32, 0.55]],
    [0.5, [0.13, 0.57, 0.55]],
    [0.75, [0.49, 0.83, 0.36]],
    [1, [0.99, 0.91, 0.14]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i];
    const [b, cb] = stops[i + 1];
    if (x >= a && x <= b) {
      const u = (x - a) / (b - a);
      target.setRGB(
        ca[0] + (cb[0] - ca[0]) * u,
        ca[1] + (cb[1] - ca[1]) * u,
        ca[2] + (cb[2] - ca[2]) * u,
      );
      return;
    }
  }
  target.setRGB(0.99, 0.91, 0.14);
}

export function BlockModelLayer({ model, filters, verticalExaggeration, clippingPlanes }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(
    () => new THREE.BoxGeometry(model.blockSize.x, model.blockSize.z, model.blockSize.y),
    [model.blockSize.x, model.blockSize.y, model.blockSize.z],
  );

  const material = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        transparent: true,
        opacity: filters.opacity,
        clippingPlanes: clippingPlanes ?? [],
        clipShadows: true,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    material.opacity = filters.opacity;
    material.transparent = filters.opacity < 1;
    material.clippingPlanes = clippingPlanes ?? [];
    material.needsUpdate = true;
  }, [material, filters.opacity, clippingPlanes]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const { dummy, color } = useMemo(
    () => ({ dummy: new THREE.Object3D(), color: new THREE.Color() }),
    [],
  );

  // Reconstruir instancias cuando cambien modelo o filtros
  const { visibleCount } = useMemo(() => {
    const mesh = meshRef.current;
    if (!mesh) return { visibleCount: 0 };
    const { positions, grades, classification, confidence } = model;
    const gMin = model.stats.gradeMin;
    const gMax = model.stats.gradeMax;
    const gRange = Math.max(1e-6, gMax - gMin);
    let visible = 0;
    for (let i = 0; i < model.count; i++) {
      const cls = classification[i];
      const grade = grades[i];
      const conf = confidence[i];
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const depth = -z; // z negativo = profundidad
      // Filtros
      if (cls === 0 && !filters.showMeasured) continue;
      if (cls === 1 && !filters.showIndicated) continue;
      if (cls === 2 && !filters.showInferred) continue;
      if (cls === 3 && !filters.showWaste) continue;
      if (cls !== 3 && grade < filters.cutoff) continue;
      if (conf < filters.minConfidence) continue;
      if (depth < filters.minDepth || depth > filters.maxDepth) continue;
      // Three: Y up = altura geológica (z), Z three = -y geológico
      dummy.position.set(x, z * verticalExaggeration, -y);
      dummy.updateMatrix();
      mesh.setMatrixAt(visible, dummy.matrix);
      if (filters.colorBy === "classification") {
        color.copy(CLASS_COLORS[cls] ?? CLASS_COLORS[3]);
      } else if (filters.colorBy === "confidence") {
        gradeColor(conf, color);
      } else {
        gradeColor((grade - gMin) / gRange, color);
      }
      mesh.setColorAt(visible, color);
      visible++;
    }
    mesh.count = visible;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return { visibleCount: visible };
  }, [model, filters, verticalExaggeration, dummy, color]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, model.count]}
      frustumCulled={false}
      // hint para que React no se queje
      key={`bm-${model.count}-${visibleCount}`}
    />
  );
}
