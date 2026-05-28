// Renderiza la malla isosurface (mesh continuo "Leapfrog-like") generada por marching cubes.
// Color por intensidad (heatmap) usando vertex colors. Soporta clipping planes.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { IsoOutput } from "@/engine3d/workers/isosurface.worker";

type Props = {
  iso: IsoOutput;
  opacity: number;
  verticalExaggeration?: number;
  clippingPlanes?: THREE.Plane[];
};

function heatColor(t: number, target: THREE.Color) {
  const x = Math.min(1, Math.max(0, t));
  if (x < 0.4) {
    const k = x / 0.4;
    target.setRGB(0.18 + 0.55 * k, 0.04 + 0.08 * k, 0.30 - 0.18 * k);
  } else if (x < 0.75) {
    const k = (x - 0.4) / 0.35;
    target.setRGB(0.73 + 0.22 * k, 0.12 + 0.55 * k, 0.10);
  } else {
    const k = (x - 0.75) / 0.25;
    target.setRGB(0.95, 0.67 + 0.30 * k, 0.10 + 0.85 * k);
  }
}

export function AnomalyIsosurfaceLayer({
  iso, opacity, verticalExaggeration = 1, clippingPlanes,
}: Props) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Construye BufferGeometry remapeando ENU(x,y,z) → three(x, z*ve, -y)
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const n = iso.vertexCount;
    if (n === 0) return geom;

    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = iso.positions[i*3];
      const y = iso.positions[i*3+1];
      const z = iso.positions[i*3+2] * verticalExaggeration;
      positions[i*3]   = x;
      positions[i*3+1] = z;
      positions[i*3+2] = -y;
    }

    // Normales: remap correspondiente (rotación equivalente)
    const normals = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const nx = iso.normals[i*3];
      const ny = iso.normals[i*3+1];
      const nz = iso.normals[i*3+2];
      normals[i*3]   = nx;
      normals[i*3+1] = nz;
      normals[i*3+2] = -ny;
    }

    // Colores por valor
    const colors = new Float32Array(n * 3);
    const c = new THREE.Color();
    // Normaliza valores a [0..1] usando fieldMin/fieldMax
    const range = Math.max(1e-6, iso.fieldMax - iso.fieldMin);
    for (let i = 0; i < n; i++) {
      const v = (iso.values[i] - iso.fieldMin) / range;
      heatColor(v, c);
      colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
    }

    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("normal",   new THREE.BufferAttribute(normals,   3));
    geom.setAttribute("color",    new THREE.BufferAttribute(colors,    3));
    geom.setIndex(new THREE.BufferAttribute(iso.indices, 1));
    geom.computeBoundingSphere();
    return geom;
  }, [iso, verticalExaggeration]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        transparent: true,
        opacity,
        metalness: 0.05,
        roughness: 0.55,
        emissive: new THREE.Color(0x140602),
        emissiveIntensity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: opacity > 0.85,
        clippingPlanes: clippingPlanes ?? [],
        clipShadows: true,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    material.opacity = opacity;
    material.depthWrite = opacity > 0.85;
    material.clippingPlanes = clippingPlanes ?? [];
    material.needsUpdate = true;
  }, [material, opacity, clippingPlanes]);

  useEffect(() => () => {
    geometry.dispose();
  }, [geometry]);

  if (iso.vertexCount === 0) {
    // Fallback blob mode: render gaussian spheres around top anomalies
    if (iso.mode === "blob" && iso.blobs.length > 0) {
      return (
        <group>
          {iso.blobs.map((b, i) => {
            const col = new THREE.Color();
            heatColor(b.v, col);
            return (
              <mesh
                key={i}
                position={[b.x, b.z * verticalExaggeration, -b.y]}
              >
                <sphereGeometry args={[b.r, 24, 16]} />
                <meshStandardMaterial
                  color={col}
                  transparent
                  opacity={Math.max(0.25, opacity * 0.7)}
                  emissive={col}
                  emissiveIntensity={0.35}
                  roughness={0.6}
                  metalness={0.05}
                  depthWrite={false}
                  clippingPlanes={clippingPlanes ?? []}
                />
              </mesh>
            );
          })}
        </group>
      );
    }
    return null;
  }

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} castShadow={false} receiveShadow={false} />
  );
}
