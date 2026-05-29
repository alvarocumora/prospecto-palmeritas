// PitShellLayer — superficies de pit conceptuales (Lerchs-Grossmann simplificado).
// Render como mallas semi-transparentes con color por revenue factor.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { PitShell } from "@/lib/conceptualModel.functions";

type Props = {
  shells: PitShell[];
  verticalExaggeration?: number;
  clippingPlanes?: THREE.Plane[];
  opacity?: number;
  /** Mostrar solo shells con rf <= maxRf */
  maxRf?: number;
};

function rfColor(rf: number): THREE.Color {
  // 0.6 → azul, 1.0 → verde, 1.4 → ámbar
  const t = Math.max(0, Math.min(1, (rf - 0.6) / 0.8));
  const c = new THREE.Color();
  if (t < 0.5) {
    const u = t / 0.5;
    c.setRGB(0.2 + 0.1 * u, 0.45 + 0.4 * u, 0.85 - 0.4 * u);
  } else {
    const u = (t - 0.5) / 0.5;
    c.setRGB(0.3 + 0.7 * u, 0.85 - 0.2 * u, 0.45 - 0.4 * u);
  }
  return c;
}

export function PitShellLayer({
  shells,
  verticalExaggeration = 1,
  clippingPlanes,
  opacity = 0.32,
  maxRf = 1.4,
}: Props) {
  const meshes = useMemo(
    () =>
      shells
        .filter((s) => s.rf <= maxRf + 1e-6)
        .map((s) => {
          const geom = new THREE.BufferGeometry();
          // Convertir ENU(x,y,z) → three(x, z*ve, -y)
          const pos = new Float32Array(s.positions.length);
          for (let i = 0; i < s.positions.length; i += 3) {
            pos[i] = s.positions[i];
            pos[i + 1] = s.positions[i + 2] * verticalExaggeration;
            pos[i + 2] = -s.positions[i + 1];
          }
          geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
          geom.setIndex(s.indices);
          geom.computeVertexNormals();
          return { id: s.id, rf: s.rf, geom, color: rfColor(s.rf) };
        }),
    [shells, verticalExaggeration, maxRf],
  );

  useEffect(
    () => () => {
      meshes.forEach((m) => m.geom.dispose());
    },
    [meshes],
  );

  if (meshes.length === 0) return null;
  return (
    <group>
      {meshes.map((m) => (
        <mesh key={m.id} geometry={m.geom} renderOrder={5}>
          <meshStandardMaterial
            color={m.color}
            transparent
            opacity={opacity}
            metalness={0.2}
            roughness={0.7}
            side={THREE.DoubleSide}
            depthWrite={false}
            clippingPlanes={clippingPlanes ?? []}
            emissive={m.color}
            emissiveIntensity={0.12}
          />
        </mesh>
      ))}
    </group>
  );
}
